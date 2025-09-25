const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
        selfDeaf: true,
        volume: 80,
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 300000,
        leaveOnEnd: true,
        leaveOnEndCooldown: 300000,
      });
      
      // Connect to voice channel
      if (!queue.connection) {
        await queue.connect(interaction.member.voice.channel);
        console.log(`[Play Command] ✅ Connected to voice channel successfully`);
      }
      
      // Search for track using Discord Player
      console.log(`[Play Command] Searching for: "${query}"`);
      
      const searchEmbed = utils.createInfoEmbed(
        'Searching for Track',
        `Searching for "${query}"...`,
        '#0099ff'
      );
      
      await interaction.editReply({ embeds: [searchEmbed] });

      // Try multiple search methods for better reliability
      let searchResult = null;
      let track = null;

      // Method 1: Try Discord Player search with YouTube
      try {
        console.log(`[Play Command] Trying Discord Player search...`);
        searchResult = await client.player.search(query, {
          requestedBy: interaction.user,
          searchEngine: 'youtube'
        });
        
        console.log(`[Play Command] Search result:`, {
          hasTracks: searchResult.hasTracks(),
          tracksCount: searchResult.tracks.length,
          playlist: searchResult.playlist ? searchResult.playlist.title : 'None'
        });
        
        if (searchResult.hasTracks()) {
          track = searchResult.tracks[0];
          console.log(`[Play Command] Discord Player found: ${track.title} - ${track.author}`);
        } else {
          console.log(`[Play Command] Discord Player search returned no tracks`);
        }
      } catch (error) {
        console.log(`[Play Command] Discord Player search failed:`, error.message);
        console.log(`[Play Command] Error details:`, error);
      }

      // Method 2: If Discord Player fails, try with different search engines
      if (!track) {
        try {
          console.log(`[Play Command] Trying alternative search engines...`);
          const searchEngines = ['youtube', 'soundcloud', 'spotify'];
          
          for (const engine of searchEngines) {
            try {
              searchResult = await client.player.search(query, {
                requestedBy: interaction.user,
                searchEngine: engine
              });
              
              if (searchResult.hasTracks()) {
                track = searchResult.tracks[0];
                console.log(`[Play Command] ${engine} found: ${track.title} - ${track.author}`);
                break;
              }
            } catch (engineError) {
              console.log(`[Play Command] ${engine} search failed:`, engineError.message);
            }
          }
        } catch (error) {
          console.log(`[Play Command] Alternative search failed:`, error.message);
        }
      }

      // Method 3: If all else fails, try direct YouTube URL search
      if (!track) {
        try {
          console.log(`[Play Command] Trying direct YouTube URL search...`);
          const youtubeQuery = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
          searchResult = await client.player.search(youtubeQuery, {
            requestedBy: interaction.user
          });
          
          if (searchResult.hasTracks()) {
            track = searchResult.tracks[0];
            console.log(`[Play Command] Direct URL search found: ${track.title} - ${track.author}`);
          }
        } catch (error) {
          console.log(`[Play Command] Direct URL search failed:`, error.message);
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
};
