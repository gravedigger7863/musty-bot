const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const CommandUtils = require('../../modules/command-utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song from local files, YouTube, SoundCloud, or Spotify')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Song name, artist, or URL to play')
        .setRequired(true)
    ),
  
  async execute(interaction, client) {
    const query = interaction.options.getString('query');
    const utils = new CommandUtils();
    
    // Defer the reply first
    await interaction.deferReply();
    
    // Check cooldown
    const cooldown = utils.isOnCooldown(interaction.user.id, 'play');
    if (cooldown) {
      return interaction.editReply({
        embeds: [utils.createErrorEmbed('Cooldown', `Please wait ${cooldown} seconds before using this command again.`)]
      });
    }

    // Validate voice channel
    const voiceValidation = await utils.validateVoiceChannel(interaction);
    if (!voiceValidation.valid) {
      return interaction.editReply({
        embeds: [utils.createErrorEmbed('Voice Channel Required', voiceValidation.error)]
      });
    }
    
    
    // Set cooldown
    utils.setCooldown(interaction.user.id, 'play');
    
    let queue; // Declare queue outside try block for error handling
    
    try {
      // Get or create queue
      queue = client.player.nodes.create(interaction.guild, {
        metadata: {
          channel: interaction.channel,
          client: interaction.guild.members.me,
          requestedBy: interaction.user
        },
        selfDeaf: false,
        volume: 50,
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 30000,
        leaveOnEnd: true,
        leaveOnEndCooldown: 30000,
        bufferingTimeout: 15000,
        connectionTimeout: 15000
      });
      
      // Connect to voice channel
      if (!queue.connection) {
        try {
          await queue.connect(interaction.member.voice.channel);
          console.log(`[Play Command] ✅ Connected to voice channel successfully`);
        } catch (connectionError) {
          console.error(`[Play Command] ❌ Voice connection failed:`, connectionError);
          return interaction.editReply({
            embeds: [utils.createErrorEmbed('Voice Connection Failed', 'Could not connect to voice channel. Please try again.')]
          });
        }
      }
      
      // Search for track using Discord Player
      console.log(`[Play Command] Searching for: "${query}"`);
      
      const searchEmbed = utils.createInfoEmbed(
        'Searching for Track',
        `Searching for "${query}"...`,
        '#0099ff'
      );
      
      await interaction.editReply({ embeds: [searchEmbed] });

      // Try YouTube first (should work most of the time)
      let searchResult = null;
      let track = null;
      let allTracks = [];

      // Method 1: Try YouTube search (primary)
      try {
        console.log(`[Play Command] Trying YouTube search...`);
        searchResult = await client.player.search(query, {
          requestedBy: interaction.user,
          searchEngine: 'youtube'
        });
        
        console.log(`[Play Command] YouTube search result:`, {
          hasTracks: searchResult.hasTracks(),
          tracksCount: searchResult.tracks.length
        });
        
        if (searchResult.hasTracks()) {
          track = searchResult.tracks[0];
          console.log(`[Play Command] YouTube found: ${track.title} - ${track.author}`);
        }
      } catch (error) {
        console.log(`[Play Command] YouTube search failed:`, error.message);
      }

      // Method 2: If YouTube fails, try SoundCloud with multiple options
      if (!track) {
        try {
          console.log(`[Play Command] Trying SoundCloud search...`);
          searchResult = await client.player.search(query, {
            requestedBy: interaction.user,
            searchEngine: 'soundcloud'
          });
          
          if (searchResult.hasTracks()) {
            allTracks = searchResult.tracks.slice(0, 10); // Get first 10 results
            console.log(`[Play Command] SoundCloud found ${allTracks.length} tracks`);
            
            // If only 1 track, use it directly
            if (allTracks.length === 1) {
              track = allTracks[0];
              console.log(`[Play Command] Using single SoundCloud track: ${track.title}`);
            } else {
              // Show selection menu for multiple tracks
              return await this.showTrackSelection(interaction, allTracks, queue);
            }
          }
        } catch (error) {
          console.log(`[Play Command] SoundCloud search failed:`, error.message);
        }
      }

      // Method 3: If both fail, try Spotify
      if (!track) {
        try {
          console.log(`[Play Command] Trying Spotify search...`);
          searchResult = await client.player.search(query, {
            requestedBy: interaction.user,
            searchEngine: 'spotify'
          });
          
          if (searchResult.hasTracks()) {
            track = searchResult.tracks[0];
            console.log(`[Play Command] Spotify found: ${track.title} - ${track.author}`);
          }
        } catch (error) {
          console.log(`[Play Command] Spotify search failed:`, error.message);
        }
      }

      if (!track) {
        return interaction.editReply({
          embeds: [utils.createErrorEmbed('No Tracks Found', `No tracks found for "${query}". Try a different search term or URL.`)]
        });
      }

      console.log(`[Play Command] Final track: ${track.title} - ${track.author} (${track.source})`);
      
      // Add track to queue
      queue.addTrack(track);
      
      // Debug logging
      console.log(`[Play Command] Track added to queue:`, {
        title: track.title,
        author: track.author,
        url: track.url,
        source: track.source,
        duration: track.duration
      });
      
      // Create simple embed
      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🎵 Track Added to Queue')
        .setDescription(`**${track.title}** by ${track.author}`)
        .addFields(
          { name: '📡 Source', value: track.source.charAt(0).toUpperCase() + track.source.slice(1), inline: true },
          { name: '⏱️ Duration', value: track.duration || 'Unknown', inline: true }
        )
        .setThumbnail(track.thumbnail)
        .setTimestamp();

      // Add queue position if not first
      if (queue.tracks.count > 0) {
        embed.addFields({
          name: '📋 Queue Position',
          value: `${queue.tracks.count + 1} tracks in queue`,
          inline: true
        });
      }
      
      // Start playing if not already playing
      if (!queue.isPlaying()) {
        console.log(`[Play Command] Starting playback...`);
        try {
          await queue.node.play();
          console.log(`[Play Command] ✅ Playback started successfully`);
        } catch (playError) {
          console.error(`[Play Command] ❌ Playback failed:`, playError);
          throw playError;
        }
      } else {
        console.log(`[Play Command] Already playing, track added to queue`);
      }

      // Create simple control buttons
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('pause')
            .setLabel('⏸️ Pause')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('skip')
            .setLabel('⏭️ Skip')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('stop')
            .setLabel('⏹️ Stop')
            .setStyle(ButtonStyle.Danger)
        );
      
      await interaction.editReply({ 
        embeds: [embed],
        components: [row]
      });
      
    } catch (error) {
      console.error('Play command error:', error);
      
      let errorMessage = 'An unexpected error occurred while playing the track.';
      
      if (error.message.includes('No tracks found')) {
        errorMessage = 'No tracks found for your search! Try a different song name or URL.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'The search timed out. Please try again.';
      } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
        errorMessage = 'Network error occurred. Please try again.';
      } else if (error.message.includes('permission')) {
        errorMessage = 'Permission denied. Make sure I have the necessary permissions.';
      }
      
      const errorEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Playback Error')
        .setDescription(errorMessage)
        .addFields({
          name: '💡 Suggestion',
          value: 'Try using a different song or check if the URL is valid.',
          inline: false
        })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },

  // Method to show track selection for SoundCloud results
  async showTrackSelection(interaction, tracks, queue) {
    const embed = new EmbedBuilder()
      .setColor('#ff8800')
      .setTitle('🎵 Multiple Tracks Found')
      .setDescription(`Found ${tracks.length} tracks on SoundCloud. Please select one:`)
      .setTimestamp();

    // Create selection menu
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('track_selection')
      .setPlaceholder('Choose a track to play...')
      .setMinValues(1)
      .setMaxValues(1);

    // Add options for each track (max 25 due to Discord limit)
    tracks.slice(0, 25).forEach((track, index) => {
      const title = track.title.length > 100 ? track.title.substring(0, 97) + '...' : track.title;
      const author = track.author.length > 50 ? track.author.substring(0, 47) + '...' : track.author;
      
      selectMenu.addOptions({
        label: `${index + 1}. ${title}`,
        description: `by ${author} • ${track.duration || 'Unknown duration'}`,
        value: index.toString()
      });
    });

    const row = new ActionRowBuilder().addComponents(selectMenu);

    // Store tracks in interaction for later use
    interaction.tracks = tracks;
    interaction.queue = queue;

    await interaction.editReply({ 
      embeds: [embed], 
      components: [row] 
    });
  }
};
