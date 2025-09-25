const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const CommandUtils = require('../../modules/command-utils');
const YouTubeSearchSimple = require('../../modules/youtube-search-simple');
const CnvMP3Converter = require('../../modules/cnvmp3-converter');
const FileServer = require('../../modules/file-server');

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

      // Method 1: Try CnvMP3 conversion first (most reliable)
      try {
        console.log(`[Play Command] Trying CnvMP3 conversion first...`);
        const converter = new CnvMP3Converter();
        
        // First, try to find a YouTube URL using yt-dlp
        const youtubeSearch = new YouTubeSearchSimple();
        const youtubeResults = await youtubeSearch.search(query, 1);
        
        if (youtubeResults.length > 0 && converter.isSupported(youtubeResults[0].url)) {
          console.log(`[Play Command] Found YouTube URL: ${youtubeResults[0].url}`);
          
          // Convert to MP3
          const conversionResult = await converter.convertToMP3(youtubeResults[0].url, '128kb/s');
          
          if (conversionResult.success) {
            console.log(`[Play Command] ✅ CnvMP3 conversion successful: ${conversionResult.downloadUrl}`);
            
            // Download the MP3 file to local storage
            const localFilePath = await this.downloadMP3File(conversionResult.downloadUrl, youtubeResults[0].title);
            
            if (localFilePath) {
              // Try using yt-dlp to convert the file to a more compatible format
              try {
                const ytdlpPath = await this.convertWithYtdlp(youtubeResults[0].url, localFilePath);
                if (ytdlpPath) {
                  console.log(`[Play Command] ✅ yt-dlp conversion successful: ${ytdlpPath}`);
                  
                  // Create a track object using the original YouTube URL (let Discord Player handle it)
                  track = {
                    title: youtubeResults[0].title,
                    author: youtubeResults[0].author,
                    url: youtubeResults[0].url, // Use original YouTube URL
                    duration: youtubeResults[0].duration,
                    thumbnail: youtubeResults[0].thumbnail,
                    source: 'youtube',
                    requestedBy: interaction.user,
                    localFilePath: ytdlpPath // Store path for cleanup
                  };
                  console.log(`[Play Command] ✅ YouTube track with local backup created: ${track.title}`);
                } else {
                  throw new Error('yt-dlp conversion failed');
                }
              } catch (ytdlpError) {
                console.log(`[Play Command] yt-dlp conversion failed, using HTTP server:`, ytdlpError.message);
                
                // Fallback to HTTP server
                const fileServer = client.fileServer || new FileServer();
                if (!client.fileServer) {
                  client.fileServer = fileServer;
                  await fileServer.start();
                }
                
                // Create HTTP URL for the file
                const httpUrl = fileServer.getFileUrl(localFilePath);
                console.log(`[Play Command] File server base URL: ${fileServer.baseUrl}`);
                
                // Create a track object for the local file
                track = {
                  title: youtubeResults[0].title,
                  author: youtubeResults[0].author,
                  url: httpUrl,
                  duration: youtubeResults[0].duration,
                  thumbnail: youtubeResults[0].thumbnail,
                  source: 'local',
                  requestedBy: interaction.user,
                  localFilePath: localFilePath // Store path for cleanup
                };
                console.log(`[Play Command] ✅ Local MP3 track created: ${track.title}`);
                console.log(`[Play Command] HTTP URL: ${httpUrl}`);
              }
            }
          } else {
            console.log(`[Play Command] ❌ CnvMP3 conversion failed: ${conversionResult.error}`);
          }
        } else {
          console.log(`[Play Command] No supported YouTube URL found for CnvMP3`);
        }
      } catch (error) {
        console.log(`[Play Command] CnvMP3 conversion failed:`, error.message);
      }

      // Method 2: If CnvMP3 fails, try Discord Player as fallback
      if (!track) {
        try {
          console.log(`[Play Command] Trying Discord Player search as fallback...`);
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
          }
        } catch (error) {
          console.log(`[Play Command] Discord Player search failed:`, error.message);
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
          console.log(`[Play Command] Track URL: ${track.url}`);
          console.log(`[Play Command] Track source: ${track.source}`);
          
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
          setTimeout(async () => {
            console.log(`[Play Command] Post-playback check (5s):`, {
              isPlaying: queue.isPlaying(),
              isPaused: queue.isPaused(),
              currentTrack: queue.currentTrack ? queue.currentTrack.title : 'None'
            });
            
            if (!queue.isPlaying() && !queue.isPaused()) {
              console.log(`[Play Command] ⚠️ WARNING: Track was added but playback never started!`);
              
              // For local files, try a different approach
              if (track.source === 'local' && track.localFilePath) {
                console.log(`[Play Command] Trying to play local file directly...`);
                try {
                  // Try using the local file path directly
                  const localTrack = {
                    ...track,
                    url: track.localFilePath // Use direct path instead of file://
                  };
                  
                  queue.tracks.clear();
                  queue.addTrack(localTrack);
                  await queue.node.play();
                  console.log(`[Play Command] ✅ Local file playback started`);
                } catch (localError) {
                  console.error(`[Play Command] ❌ Local file playback failed:`, localError.message);
                }
              } else {
                // Try CnvMP3 conversion as fallback
                await this.tryCnvMP3Fallback(queue, track, interaction);
              }
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
  },

  async downloadMP3File(downloadUrl, title) {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const axios = require('axios');
      
      // Create temp directory if it doesn't exist
      const tempDir = path.join(__dirname, '../../temp');
      await fs.mkdir(tempDir, { recursive: true });
      
      // Generate safe filename
      const safeTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 50);
      const timestamp = Date.now();
      const filename = `${safeTitle}_${timestamp}.mp3`;
      const filePath = path.join(tempDir, filename);
      
      console.log(`[Play Command] Downloading MP3 to: ${filePath}`);
      
      // Download the file
      const response = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'stream',
        timeout: 60000 // 60 seconds timeout
      });
      
      // Write to file
      const writer = require('fs').createWriteStream(filePath);
      response.data.pipe(writer);
      
      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log(`[Play Command] ✅ MP3 downloaded successfully: ${filePath}`);
          resolve(filePath);
        });
        writer.on('error', (error) => {
          console.error(`[Play Command] ❌ Download failed:`, error.message);
          reject(error);
        });
      });
    } catch (error) {
      console.error(`[Play Command] ❌ MP3 download error:`, error.message);
      return null;
    }
  },

  async cleanupLocalFile(filePath) {
    try {
      const fs = require('fs').promises;
      await fs.unlink(filePath);
      console.log(`[Play Command] ✅ Cleaned up local file: ${filePath}`);
    } catch (error) {
      console.error(`[Play Command] ❌ Cleanup failed:`, error.message);
    }
  },

  async convertWithYtdlp(youtubeUrl, originalPath) {
    try {
      const { spawn } = require('child_process');
      const path = require('path');
      const fs = require('fs').promises;
      
      // Create a new filename for the yt-dlp output
      const timestamp = Date.now();
      const outputPath = path.join(path.dirname(originalPath), `ytdlp_${timestamp}.mp3`);
      
      console.log(`[Play Command] Converting with yt-dlp: ${youtubeUrl} -> ${outputPath}`);
      
      return new Promise((resolve, reject) => {
        const ytdlp = spawn('yt-dlp', [
          '--extract-audio',
          '--audio-format', 'mp3',
          '--audio-quality', '128K',
          '--output', outputPath,
          youtubeUrl
        ]);

        let stderr = '';

        ytdlp.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        ytdlp.on('close', async (code) => {
          if (code === 0) {
            // Check if file was created
            try {
              await fs.access(outputPath);
              console.log(`[Play Command] ✅ yt-dlp conversion successful: ${outputPath}`);
              
              // Clean up the original CnvMP3 file
              try {
                await fs.unlink(originalPath);
                console.log(`[Play Command] ✅ Cleaned up original CnvMP3 file`);
              } catch (cleanupError) {
                console.log(`[Play Command] ⚠️ Could not clean up original file:`, cleanupError.message);
              }
              
              resolve(outputPath);
            } catch (accessError) {
              console.error(`[Play Command] ❌ yt-dlp output file not found:`, accessError.message);
              reject(new Error('yt-dlp output file not found'));
            }
          } else {
            console.error(`[Play Command] ❌ yt-dlp conversion failed with code ${code}:`, stderr);
            reject(new Error(`yt-dlp failed: ${stderr}`));
          }
        });

        ytdlp.on('error', (error) => {
          console.error(`[Play Command] ❌ yt-dlp spawn error:`, error.message);
          reject(error);
        });
      });
    } catch (error) {
      console.error(`[Play Command] ❌ yt-dlp conversion error:`, error.message);
      return null;
    }
  },

  async tryCnvMP3Fallback(queue, track, interaction) {
    try {
      console.log(`[Play Command] Trying CnvMP3 fallback for: ${track.url}`);
      
      const converter = new CnvMP3Converter();
      
      // Check if the URL is supported by CnvMP3
      if (!converter.isSupported(track.url)) {
        console.log(`[Play Command] URL not supported by CnvMP3: ${track.url}`);
        return;
      }

      // Convert to MP3
      const conversionResult = await converter.convertToMP3(track.url, '128kb/s');
      
      if (conversionResult.success) {
        console.log(`[Play Command] ✅ CnvMP3 conversion successful: ${conversionResult.downloadUrl}`);
        
        // Download the MP3 file to local storage
        const localFilePath = await this.downloadMP3File(conversionResult.downloadUrl, track.title);
        
        if (localFilePath) {
          // Create a new track with the local file
          const convertedTrack = {
            ...track,
            url: `file://${localFilePath}`,
            source: 'local',
            title: `${track.title} (Converted)`,
            localFilePath: localFilePath
          };

          // Replace the current track in the queue
          queue.tracks.clear();
          queue.addTrack(convertedTrack);
          
          // Try to play the converted track
          try {
            await queue.node.play();
            console.log(`[Play Command] ✅ Converted track playback started`);
            
            // Notify the user
            const channel = interaction.channel;
            if (channel) {
              await channel.send(`🔄 **Track converted and playing!** The original track couldn't be played, so I converted it to MP3 format.`);
            }
          } catch (playError) {
            console.error(`[Play Command] ❌ Converted track playback failed:`, playError.message);
          }
        }
      } else {
        console.log(`[Play Command] ❌ CnvMP3 conversion failed: ${conversionResult.error}`);
      }
    } catch (error) {
      console.error(`[Play Command] ❌ CnvMP3 fallback error:`, error.message);
    }
  }
};
