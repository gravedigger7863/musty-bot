const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const CommandUtils = require('../../modules/command-utils');
const YouTubeSearchSimple = require('../../modules/youtube-search-simple');

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

      // Method 1: Try Discord Player search first (most reliable)
      try {
        console.log(`[Play Command] Trying Discord Player search first...`);
        searchResult = await client.player.search(query, {
          requestedBy: interaction.user
        });
        
        console.log(`[Play Command] Discord Player search result:`, {
          hasTracks: searchResult.hasTracks(),
          tracksCount: searchResult.tracks.length,
          searchEngine: searchResult.searchEngine
        });
        
        if (searchResult.hasTracks()) {
          track = searchResult.tracks[0];
          console.log(`[Play Command] ✅ Found via Discord Player: ${track.title} - ${track.author}`);
          console.log(`[Play Command] Track URL: ${track.url}`);
          console.log(`[Play Command] Track source: ${track.source}`);
          console.log(`[Play Command] Track duration: ${track.duration}`);
        }
      } catch (error) {
        console.log(`[Play Command] Discord Player search failed:`, error.message);
      }

      // Method 2: If Discord Player fails, try YouTube search using yt-dlp
      if (!track) {
        try {
          console.log(`[Play Command] Trying YouTube search with yt-dlp...`);
          const youtubeSearch = new YouTubeSearchSimple();
          const youtubeResults = await youtubeSearch.search(query, 5);
          
          console.log(`[Play Command] YouTube search result:`, {
            found: youtubeResults.length,
            results: youtubeResults.map(r => r.title)
          });
          
          if (youtubeResults.length > 0) {
            // Try to use the YouTube URL with Discord Player
            try {
              console.log(`[Play Command] Attempting Discord Player conversion for: ${youtubeResults[0].url}`);
              const youtubeSearchResult = await client.player.search(youtubeResults[0].url, {
                requestedBy: interaction.user
              });
              
              if (youtubeSearchResult.hasTracks()) {
                track = youtubeSearchResult.tracks[0];
                console.log(`[Play Command] ✅ YouTube URL converted via Discord Player: ${track.title} - ${track.author}`);
              } else {
                throw new Error('Discord Player could not convert YouTube URL');
              }
            } catch (conversionError) {
              console.log(`[Play Command] YouTube URL conversion failed:`, conversionError.message);
              
              // Create a basic track and let Discord Player handle it
              track = {
                title: youtubeResults[0].title,
                author: youtubeResults[0].author,
                url: youtubeResults[0].url,
                duration: youtubeResults[0].duration,
                thumbnail: youtubeResults[0].thumbnail,
                source: 'youtube',
                requestedBy: interaction.user
              };
              console.log(`[Play Command] Basic YouTube track created: ${track.title} - ${track.author}`);
            }
          }
        } catch (error) {
          console.log(`[Play Command] YouTube search failed:`, error.message);
        }
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
              return await this.showTrackSelection(interaction, allTracks, queue, client);
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
        console.log(`[Play Command] Queue state:`, {
          isPlaying: queue.isPlaying(),
          isPaused: queue.isPaused(),
          tracksCount: queue.tracks.count,
          currentTrack: queue.currentTrack ? {
            title: queue.currentTrack.title,
            author: queue.currentTrack.author,
            url: queue.currentTrack.url
          } : null
        });
        
        try {
          console.log(`[Play Command] Calling queue.node.play()...`);
          await queue.node.play();
          console.log(`[Play Command] ✅ Playback started successfully`);
          
          // Wait a moment and check if it's actually playing
          setTimeout(() => {
            console.log(`[Play Command] Post-playback check (2s):`, {
              isPlaying: queue.isPlaying(),
              isPaused: queue.isPaused(),
              currentTrack: queue.currentTrack ? queue.currentTrack.title : 'None'
            });
          }, 2000);
          
          // Check again after 5 seconds
          setTimeout(() => {
            console.log(`[Play Command] Post-playback check (5s):`, {
              isPlaying: queue.isPlaying(),
              isPaused: queue.isPaused(),
              currentTrack: queue.currentTrack ? queue.currentTrack.title : 'None'
            });
            
            if (!queue.isPlaying() && !queue.isPaused()) {
              console.log(`[Play Command] ⚠️ WARNING: Track was added but playback never started!`);
            }
          }, 5000);
          
        } catch (playError) {
          console.error(`[Play Command] ❌ Playback failed:`, playError);
          console.error(`[Play Command] Error details:`, {
            name: playError.name,
            message: playError.message,
            stack: playError.stack
          });
          
          // Try multiple recovery methods
          const recoveryMethods = [
            {
              name: 'Reconnect and retry',
              action: async () => {
                console.log(`[Play Command] Trying reconnect method...`);
                await queue.connect(interaction.member.voice.channel);
                await queue.node.play();
              }
            },
            {
              name: 'Skip and retry',
              action: async () => {
                console.log(`[Play Command] Trying skip and retry method...`);
                queue.skip();
                await queue.node.play();
              }
            },
            {
              name: 'Clear queue and retry',
              action: async () => {
                console.log(`[Play Command] Trying clear queue method...`);
                queue.tracks.clear();
                queue.addTrack(track);
                await queue.node.play();
              }
            }
          ];
          
          let recoverySuccess = false;
          for (const method of recoveryMethods) {
            try {
              console.log(`[Play Command] Attempting recovery: ${method.name}`);
              await method.action();
              console.log(`[Play Command] ✅ Recovery successful: ${method.name}`);
              recoverySuccess = true;
              break;
            } catch (recoveryError) {
              console.log(`[Play Command] ❌ Recovery failed: ${method.name}`, recoveryError.message);
            }
          }
          
          if (!recoverySuccess) {
            console.error(`[Play Command] ❌ All recovery methods failed`);
          throw playError;
          }
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
  async showTrackSelection(interaction, tracks, queue, client) {
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

    // Store tracks and queue in client for later use
    if (!client.trackSelections) {
      client.trackSelections = new Map();
    }
    client.trackSelections.set(interaction.id, { tracks, queue });

    await interaction.editReply({ 
      embeds: [embed], 
      components: [row] 
    });
  }
};
