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

      // Method 1: Try yt-dlp conversion first (most reliable)
      try {
        console.log(`[Play Command] Trying yt-dlp conversion first...`);
        
        // First, try to find a YouTube URL using yt-dlp
        const youtubeSearch = new YouTubeSearchSimple();
        const youtubeResults = await youtubeSearch.search(query, 1);
        
        if (youtubeResults.length > 0) {
          console.log(`[Play Command] Found YouTube URL: ${youtubeResults[0].url}`);
          
          // Convert to MP3 using yt-dlp directly (bypassing cookies)
          const localFilePath = await this.convertWithYtdlpDirect(youtubeResults[0].url, youtubeResults[0].title);
          
          if (localFilePath) {
            console.log(`[Play Command] ✅ yt-dlp conversion successful: ${localFilePath}`);
            
            // Create a local track object
            track = {
              title: youtubeResults[0].title,
              author: youtubeResults[0].author || 'Unknown',
              url: localFilePath,
              duration: youtubeResults[0].duration || '3:00',
              thumbnail: youtubeResults[0].thumbnail,
              source: 'local',
              requestedBy: interaction.user,
              localFilePath: localFilePath
            };
            console.log(`[Play Command] ✅ Local MP3 track created: ${track.title}`);
          }
        } else {
          console.log(`[Play Command] No YouTube URL found for yt-dlp`);
        }
      } catch (error) {
        console.log(`[Play Command] yt-dlp conversion failed:`, error.message);
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
          isPaused: queue.node.isPaused ? queue.node.isPaused() : 'N/A',
          tracksCount: queue.tracks.count,
          currentTrack: queue.currentTrack ? {
            title: queue.currentTrack.title,
            author: queue.currentTrack.author,
            url: queue.currentTrack.url
          } : null
        });
        
        try {
          // For local files, use direct voice streaming instead of Discord Player
          if (track.source === 'local' && track.localFilePath) {
            console.log(`[Play Command] Using direct voice streaming for local file...`);
            console.log(`[Play Command] Local file path: ${track.localFilePath}`);
            
            const { createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
            const fs = require('fs');
            
            // Check if file exists
            if (!fs.existsSync(track.localFilePath)) {
              throw new Error(`Local file not found: ${track.localFilePath}`);
            }
            
            // Check file size and properties
            const stats = fs.statSync(track.localFilePath);
            console.log(`[Play Command] File stats:`, {
              size: stats.size,
              isFile: stats.isFile(),
              path: track.localFilePath
            });
            
            if (stats.size < 1000) {
              throw new Error(`File too small (${stats.size} bytes), likely corrupted`);
            }
            
            // Check if the file is actually a valid MP3 by reading the first few bytes
            const fileBuffer = fs.readFileSync(track.localFilePath, { start: 0, end: 10 });
            const fileHeader = fileBuffer.toString('hex');
            console.log(`[Play Command] File header (first 10 bytes): ${fileHeader}`);
            
            // Check for MP3 header (ID3 tag or MP3 frame sync)
            if (!fileHeader.startsWith('494433') && !fileHeader.startsWith('fffb') && !fileHeader.startsWith('fff3')) {
              console.log(`[Play Command] ⚠️ File doesn't appear to be a valid MP3 - header: ${fileHeader}`);
            } else {
              console.log(`[Play Command] ✅ File appears to be a valid MP3`);
            }
            
            // Test the file with FFmpeg to see if it's actually playable
            try {
              const { spawn } = require('child_process');
              const ffprobe = spawn('ffprobe', [
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                track.localFilePath
              ]);
              
              let ffprobeOutput = '';
              ffprobe.stdout.on('data', (data) => {
                ffprobeOutput += data.toString();
              });
              
              ffprobe.on('close', (code) => {
                if (code === 0) {
                  try {
                    const probeData = JSON.parse(ffprobeOutput);
                    const duration = probeData.format?.duration;
                    const audioStream = probeData.streams?.find(s => s.codec_type === 'audio');
                    
                    console.log(`[Play Command] FFprobe analysis:`, {
                      duration: duration ? `${duration}s` : 'Unknown',
                      codec: audioStream?.codec_name || 'Unknown',
                      sampleRate: audioStream?.sample_rate || 'Unknown',
                      channels: audioStream?.channels || 'Unknown'
                    });
                    
                    if (!duration || duration < 1) {
                      console.log(`[Play Command] ⚠️ File has no duration or very short duration - likely corrupted`);
                    }
                  } catch (parseError) {
                    console.log(`[Play Command] ⚠️ Could not parse FFprobe output:`, parseError.message);
                  }
                } else {
                  console.log(`[Play Command] ⚠️ FFprobe failed with code ${code} - file may be corrupted`);
                }
              });
            } catch (ffprobeError) {
              console.log(`[Play Command] ⚠️ Could not run FFprobe:`, ffprobeError.message);
            }
            
            // Create audio resource from local file with proper options
            const audioResource = createAudioResource(track.localFilePath, {
              inputType: 'file',
              inlineVolume: false
            });
            const audioPlayer = createAudioPlayer({
              behaviors: {
                noSubscriber: 'play', // Keep playing even when no subscribers detected
                maxMissedFrames: 10,
                maxMissedFramesInterval: 10000
              }
            });
            
            // Set up event handlers
            audioPlayer.on(AudioPlayerStatus.Playing, () => {
              console.log(`[Play Command] ✅ Audio is now playing!`);
              console.log(`[Play Command] 🎵 Now playing: ${track.title} by ${track.author}`);
              console.log(`[Play Command] Audio player state:`, audioPlayer.state);
            });
            
            audioPlayer.on(AudioPlayerStatus.Paused, () => {
              console.log(`[Play Command] ⏸️ Audio paused`);
            });
            
            // Check if there are people in the voice channel
            const voiceChannel = interaction.member.voice.channel;
            const membersInChannel = voiceChannel.members.filter(member => !member.user.bot).size;
            console.log(`[Play Command] People in voice channel: ${membersInChannel}`);
            
            // Only set up autopaused handling if there are people in the channel
            if (membersInChannel > 0) {
              console.log(`[Play Command] ✅ People detected in voice channel - audio should not autopause`);
              
              // Track restart attempts to prevent infinite loops
              let restartAttempts = 0;
              const maxRestartAttempts = 2; // Reduced attempts since people are present
              
              audioPlayer.on(AudioPlayerStatus.AutoPaused, () => {
                console.log(`[Play Command] ⚠️ Audio autopaused despite ${membersInChannel} people in channel!`);
                console.log(`[Play Command] This should not happen - attempting immediate restart...`);
                
                // Only try to restart if we haven't exceeded max attempts
                if (restartAttempts < maxRestartAttempts) {
                  restartAttempts++;
                  
                  // Try to resume immediately since people are present
                  setTimeout(() => {
                    if (audioPlayer.state.status === AudioPlayerStatus.AutoPaused) {
                      console.log(`[Play Command] 🔄 Immediate restart attempt ${restartAttempts}/${maxRestartAttempts}...`);
                      try {
                        // Stop current playback
                        audioPlayer.stop();
                        
                        // Create new audio resource and restart
                        const newAudioResource = createAudioResource(track.localFilePath, {
                          inputType: 'file',
                          inlineVolume: false
                        });
                        
                        audioPlayer.play(newAudioResource);
                        console.log(`[Play Command] ✅ Audio restarted successfully`);
                      } catch (error) {
                        console.error(`[Play Command] ❌ Restart failed:`, error.message);
                      }
                    }
                  }, 500); // Much faster restart since people are present
                } else {
                  console.log(`[Play Command] ⚠️ Max restart attempts reached despite people being present!`);
                }
              });
            } else {
              console.log(`[Play Command] ⚠️ No people detected in voice channel - autopausing is expected`);
            }
            
            audioPlayer.on(AudioPlayerStatus.Idle, () => {
              console.log(`[Play Command] 🏁 Audio finished playing (Idle state)`);
              console.log(`[Play Command] Audio player state:`, audioPlayer.state);
              // Clean up local file
              if (track.localFilePath) {
                fs.unlink(track.localFilePath, (err) => {
                  if (err) console.error(`[Play Command] ❌ Cleanup failed:`, err.message);
                  else console.log(`[Play Command] ✅ Cleaned up local file: ${track.localFilePath}`);
                });
              }
            });
            
            audioPlayer.on('error', (error) => {
              console.error(`[Play Command] ❌ Audio player error:`, error);
              console.error(`[Play Command] Error details:`, {
                name: error.name,
                message: error.message,
                stack: error.stack
              });
            });
            
            audioPlayer.on('stateChange', (oldState, newState) => {
              console.log(`[Play Command] Audio player state changed: ${oldState.status} -> ${newState.status}`);
            });
            
            // Get voice connection directly from the member's voice channel
            const { getVoiceConnection, joinVoiceChannel } = require('@discordjs/voice');
            let connection = getVoiceConnection(interaction.guild.id);
            
            if (!connection) {
              console.log(`[Play Command] ❌ No voice connection found, creating new one...`);
              connection = joinVoiceChannel({
                channelId: interaction.member.voice.channel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
              });
              
              console.log(`[Play Command] ✅ Created new voice connection`);
            }
            
            console.log(`[Play Command] Voice connection state:`, connection.state);
            console.log(`[Play Command] Voice connection status:`, connection.state.status);
            
            // Subscribe the audio player to the connection
            connection.subscribe(audioPlayer);
            
            // Start playing immediately - let Discord handle the connection state
            console.log(`[Play Command] Starting audio playback...`);
            audioPlayer.play(audioResource);
            console.log(`[Play Command] ✅ Direct voice streaming started for: ${track.title}`);
            
            // Monitor connection state changes
            connection.on('stateChange', (oldState, newState) => {
              console.log(`[Play Command] Voice connection state changed: ${oldState.status} -> ${newState.status}`);
              if (newState.status === VoiceConnectionStatus.Ready) {
                console.log(`[Play Command] ✅ Voice connection is now ready!`);
                // Reset restart attempts when connection is ready
                restartAttempts = 0;
              } else if (newState.status === VoiceConnectionStatus.Disconnected) {
                console.log(`[Play Command] ❌ Voice connection disconnected`);
              }
            });
            
            // Send success message
            const successEmbed = new EmbedBuilder()
              .setColor('#00ff00')
              .setTitle('🎵 Now Playing')
              .setDescription(`**${track.title}** by ${track.author}`)
              .addFields(
                { name: '📡 Source', value: 'Local MP3', inline: true },
                { name: '⏱️ Duration', value: track.duration || 'Unknown', inline: true }
              )
              .setThumbnail(track.thumbnail)
              .setTimestamp();
            
            await interaction.editReply({ embeds: [successEmbed] });
            return;
          }
          
          // For non-local files, use Discord Player
          console.log(`[Play Command] Using Discord Player for: ${track.source}`);
          console.log(`[Play Command] Calling queue.node.play()...`);
          console.log(`[Play Command] Track URL: ${track.url}`);
          console.log(`[Play Command] Track source: ${track.source}`);
          console.log(`[Play Command] Queue state before play:`, {
            isPlaying: queue.isPlaying(),
            isPaused: queue.node.isPaused ? queue.node.isPaused() : 'N/A',
            tracksCount: queue.tracks.count,
            currentTrack: queue.currentTrack ? queue.currentTrack.title : 'None'
          });
          
          // Add timeout to play call
          const playPromise = queue.node.play();
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Play timeout after 10 seconds')), 10000)
          );
          
          const playResult = await Promise.race([playPromise, timeoutPromise]);
          console.log(`[Play Command] ✅ Playback started successfully`);
          console.log(`[Play Command] Play result:`, playResult);
          
          // Immediate check
          setTimeout(() => {
            console.log(`[Play Command] Immediate post-play check:`, {
              isPlaying: queue.isPlaying(),
              isPaused: queue.node.isPaused ? queue.node.isPaused() : 'N/A',
              currentTrack: queue.currentTrack ? queue.currentTrack.title : 'None'
            });
          }, 100);
          
          // Wait a moment and check if it's actually playing
          setTimeout(() => {
            console.log(`[Play Command] Post-playback check (2s):`, {
              isPlaying: queue.isPlaying(),
              isPaused: queue.node.isPaused ? queue.node.isPaused() : 'N/A',
              currentTrack: queue.currentTrack ? queue.currentTrack.title : 'None'
            });
          }, 2000);
          
          // Check again after 5 seconds
          setTimeout(async () => {
            console.log(`[Play Command] Post-playback check (5s):`, {
              isPlaying: queue.isPlaying(),
              isPaused: queue.node.isPaused ? queue.node.isPaused() : 'N/A',
              currentTrack: queue.currentTrack ? queue.currentTrack.title : 'None'
            });
            
            if (!queue.isPlaying() && !(queue.node.isPaused && queue.node.isPaused())) {
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
          console.error(`[Play Command] Track that failed:`, {
            title: track.title,
            url: track.url,
            source: track.source
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
  },

  async convertWithYtdlpDirect(youtubeUrl, title) {
    return new Promise((resolve) => {
      const { spawn } = require('child_process');
      const timestamp = Date.now();
      const filename = `${title.replace(/[^a-zA-Z0-9\s]/g, '')}_${timestamp}.mp3`;
      const outputPath = path.join(__dirname, '..', '..', 'temp', filename);
      
      console.log(`[Play Command] Converting with yt-dlp (direct): ${youtubeUrl} -> ${outputPath}`);
      
      const ytdlp = spawn('yt-dlp', [
        '--no-cookies',
        '--no-check-certificate',
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '128K',
        '--output', outputPath,
        '--no-playlist',
        '--max-filesize', '50M',
        youtubeUrl
      ]);
      
      let stderr = '';
      ytdlp.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      ytdlp.on('close', (code) => {
        if (code === 0) {
          // Check if file was created and has content
          try {
            const stats = fs.statSync(outputPath);
            if (stats.size > 1000) { // File should be at least 1KB
              console.log(`[Play Command] ✅ yt-dlp direct conversion successful: ${outputPath} (${stats.size} bytes)`);
              resolve(outputPath);
            } else {
              console.log(`[Play Command] ❌ yt-dlp output file too small: ${stats.size} bytes`);
              resolve(null);
            }
          } catch (accessError) {
            console.log(`[Play Command] ❌ yt-dlp output file not found:`, accessError.message);
            resolve(null);
          }
        } else {
          console.log(`[Play Command] ❌ yt-dlp direct conversion failed with code ${code}: ${stderr}`);
          resolve(null);
        }
      });
    });
  }
};
