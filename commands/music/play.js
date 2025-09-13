const { SlashCommandBuilder } = require("discord.js");

// Track play command executions to prevent duplicates
const playExecutions = new Set();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play music from multiple sources with automatic fallback")
    .addStringOption(option =>
      option.setName("query")
        .setDescription("Song name, YouTube URL, or direct audio file URL (.mp3, .ogg, .wav, .m4a)")
        .setRequired(true)
    ),
  async execute(interaction) {
    // CRITICAL: Check if interaction already processed to prevent duplicate execution
    if (interaction.deferred || interaction.replied) {
      console.log(`[Play Command] Interaction already processed, skipping duplicate execution`);
      return;
    }

    // Additional check: prevent duplicate play command executions
    const executionKey = `${interaction.id}-${interaction.user.id}`;
    if (playExecutions.has(executionKey)) {
      console.log(`[Play Command] Duplicate play command execution detected, skipping: ${executionKey}`);
      return;
    }
    playExecutions.add(executionKey);

    // ULTRA-FAST DEFER: Prevent Discord retry race condition - MUST be first!
    if (!interaction.deferred && !interaction.replied) {
      try {
        await interaction.deferReply();
        console.log(`[Play Command] Interaction deferred successfully - Discord retry prevented`);
      } catch (err) {
        console.warn("Failed to defer interaction:", err.message);
        return; // Exit if we can't defer - interaction is likely expired
      }
    } else {
      console.log(`[Play Command] Interaction already deferred or replied, continuing...`);
    }
    
    try {
      console.log(`[Play Command] Starting play command for query: ${interaction.options.getString("query")}`);
      
      // Small delay to ensure extractors are loaded
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const query = interaction.options.getString("query");
      const voiceChannel = interaction.member?.voice?.channel;

      if (!voiceChannel) {
        return await interaction.editReply({ 
          content: "⚠️ You need to join a voice channel first!"
        });
      }
      
      // Send initial processing message
      await interaction.editReply({ 
        content: "🔍 Searching YouTube for your music..." 
      });

      // RACE-PROOF TRACK RESOLUTION: Fully resolve track before adding to queue
      console.log(`[Play Command] Searching for: ${query}`);
      let track;
      
      try {
        // YouTube-only search with extended timeout and retry logic
        console.log(`[Play Command] Searching YouTube for: ${query}`);
        
        let youtubeResult;
        let searchAttempts = 0;
        const maxAttempts = 3;
        
        while (searchAttempts < maxAttempts) {
          try {
            searchAttempts++;
            console.log(`[Play Command] YouTube search attempt ${searchAttempts}/${maxAttempts}`);
            
            // Try different search engine parameters based on attempt
            let searchEngine = 'youtube_search';
            if (searchAttempts === 2) {
              searchEngine = 'youtube_video';
            } else if (searchAttempts === 3) {
              searchEngine = 'youtube';
            }
            
            console.log(`[Play Command] Using search engine: ${searchEngine}`);
            
            // Use Promise.race with longer timeout for YouTube-only search
            youtubeResult = await Promise.race([
              interaction.client.player.search(query, {
                requestedBy: interaction.user,
                searchEngine: searchEngine, // Try different search engines
                // Force YouTube-only, disable all other sources
                fallbackSearchEngine: 'youtube_search',
                // Additional options to ensure YouTube-only
                useYouTube: true,
                useSoundCloud: false,
                useSpotify: false,
                // Add play-dl integration for better YouTube results
                usePlayDL: true
              }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('YouTube search timeout')), 15000) // 15 seconds
              )
            ]);
            
            if (youtubeResult && youtubeResult.hasTracks()) {
              track = youtubeResult.tracks[0];
              console.log(`[Play Command] Found YouTube track: ${track.title}`);
              console.log(`[Play Command] Track source verification:`, {
                source: track.source,
                url: track.url,
                isYouTube: track.url.includes('youtube.com') || track.url.includes('youtu.be')
              });
              break; // Success, exit retry loop
            } else {
              console.log(`[Play Command] No results in attempt ${searchAttempts}`);
              if (searchAttempts === maxAttempts) {
                return await interaction.editReply('❌ No tracks found on YouTube. Please try a different search term.');
              }
              
              // Update user on retry
              await interaction.editReply({ 
                content: `🔍 Searching YouTube... (attempt ${searchAttempts + 1}/${maxAttempts})` 
              });
              
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (searchError) {
            console.log(`[Play Command] Search attempt ${searchAttempts} failed:`, searchError.message);
            
            // On final attempt, try play-dl direct search as last resort
            if (searchAttempts === maxAttempts) {
              console.log(`[Play Command] Trying play-dl direct search as final fallback...`);
              try {
                const play = require('play-dl');
                const playDLResult = await play.search(query, { limit: 1 });
                
                if (playDLResult && playDLResult.length > 0) {
                  const playDLTrack = playDLResult[0];
                  console.log(`[Play Command] play-dl found track: ${playDLTrack.title}`);
                  
                  // Convert play-dl result to Discord Player format
                  youtubeResult = {
                    tracks: [{
                      title: playDLTrack.title,
                      url: playDLTrack.url,
                      duration: playDLTrack.durationInSec * 1000, // Convert to milliseconds
                      thumbnail: playDLTrack.thumbnails?.[0]?.url,
                      author: playDLTrack.channel?.name || 'Unknown Artist',
                      source: 'youtube',
                      id: playDLTrack.id,
                      raw: playDLTrack
                    }],
                    hasTracks: () => true
                  };
                  
                  if (youtubeResult && youtubeResult.hasTracks()) {
                    track = youtubeResult.tracks[0];
                    console.log(`[Play Command] play-dl track converted successfully: ${track.title}`);
                    break; // Success with play-dl
                  }
                }
              } catch (playDLError) {
                console.error(`[Play Command] play-dl fallback also failed:`, playDLError.message);
              }
              
              throw searchError; // Re-throw original error if play-dl also fails
            }
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        
        // Verify track is fully resolved and from YouTube only
        if (!track.url && !track.id) {
          console.error(`[Play Command] Track not properly resolved:`, track);
          return await interaction.editReply('❌ Track could not be properly resolved. Please try again.');
        }
        
        // CRITICAL: Ensure track is from YouTube only (reject SoundCloud/other sources)
        if (track.source && track.source !== 'youtube') {
          console.error(`[Play Command] CRITICAL: Non-YouTube track detected:`, {
            source: track.source,
            title: track.title,
            url: track.url
          });
          return await interaction.editReply('❌ Only YouTube tracks are supported. Please try a different search.');
        }
        
        // Additional URL validation to ensure it's YouTube
        if (track.url && !track.url.includes('youtube.com') && !track.url.includes('youtu.be')) {
          console.error(`[Play Command] CRITICAL: Non-YouTube URL detected:`, track.url);
          return await interaction.editReply('❌ Only YouTube tracks are supported. Please try a different search.');
        }
        
        console.log(`[Play Command] Track resolved successfully: ${track.title} (${track.source})`);
        
        // YOUTUBE-ONLY: Create track object for Discord Player (no stream resolution needed)
        console.log(`[Play Command] Creating YouTube track object...`);
        try {
          // YouTube tracks are already properly formatted for Discord Player
          track = {
            title: track.title,
            url: track.url,
            duration: Number(track.duration) || 0, // Ensure duration is a number
            requestedBy: interaction.user,
            thumbnail: track.thumbnail,
            source: 'youtube',
            author: track.author || 'Unknown Artist',
            description: track.description || '',
            views: track.views || 0,
            id: track.id || track.url,
            raw: track.raw || track
          };
          
          console.log(`[Play Command] YouTube track object created:`, {
            title: track.title,
            url: track.url ? 'Present' : 'Missing',
            duration: track.duration,
            durationType: typeof track.duration,
            source: track.source
          });
          
        } catch (trackError) {
          console.error(`[Play Command] Track object creation failed:`, trackError);
          return await interaction.editReply('❌ Could not create track object. Please try again.');
        }
        
      } catch (searchError) {
        console.error(`[Play Command] YouTube search failed after ${maxAttempts} attempts:`, searchError);
        
        // Provide specific error messages based on the error type
        if (searchError.message && searchError.message.includes('timeout')) {
          return await interaction.editReply('❌ YouTube search timed out. Please try again with a shorter search term.');
        } else if (searchError.message && searchError.message.includes('rate limit')) {
          return await interaction.editReply('❌ YouTube search rate limited. Please wait a moment and try again.');
        } else if (searchError.message && searchError.message.includes('network')) {
          return await interaction.editReply('❌ Network error during search. Please check your connection and try again.');
        } else {
          return await interaction.editReply('❌ YouTube search failed. Please try a different search term.');
        }
      }

      // Create or get existing queue
      console.log(`[Play Command] Creating/getting queue for guild: ${interaction.guild.id}`);
      let queue = interaction.client.player.nodes.get(interaction.guild.id);
      
      if (!queue) {
        console.log(`[Play Command] Creating new queue`);
        queue = interaction.client.player.nodes.create(interaction.guild, {
          metadata: { channel: interaction.channel },
          leaveOnEnd: false,
          leaveOnEmpty: false,
          leaveOnEmptyCooldown: 300000,
          leaveOnStop: false,
          selfDeaf: false,
          selfMute: false,
          // Prevent queue from being auto-destroyed
          skipOnEmpty: false,
          skipOnEmptyCooldown: 300000,
          // Additional stability options
          autoSelfDeaf: false,
          autoSelfMute: false,
          // Enhanced stability for race condition prevention
          bufferingTimeout: 5000,
          connectionTimeout: 30000,
          // Prevent immediate destruction
          destroyOnEmpty: false,
          destroyOnEnd: false
        });
      }

      // Ensure queue and node exist
      if (!queue || !queue.node) {
        console.error(`[Play Command] Queue or node is undefined after creation`);
        return await interaction.editReply('❌ Failed to create music queue. Please try again.');
      }

      // Connect to voice channel if not already connected
      if (!queue.connection) {
        console.log(`[Play Command] Connecting to voice channel: ${voiceChannel.name}`);
        try {
          await queue.connect(voiceChannel);
          console.log(`[Play Command] Connected to voice channel successfully`);
        } catch (connectError) {
          console.error(`[Play Command] Failed to connect:`, connectError);
          queue.delete();
          return await interaction.editReply('❌ Could not join voice channel!');
        }
      } else {
        console.log(`[Play Command] Already connected to voice channel - skipping connect() to prevent queue reset`);
        // Verify the connection is still valid
        if (!queue.connection.voice) {
          console.log(`[Play Command] Connection exists but voice is null, reconnecting...`);
          try {
            await queue.connect(voiceChannel);
            console.log(`[Play Command] Reconnected to voice channel successfully`);
          } catch (connectError) {
            console.error(`[Play Command] Failed to reconnect:`, connectError);
            queue.delete();
            return await interaction.editReply('❌ Voice connection lost and could not reconnect!');
          }
        }
      }

      // RACE-PROOF TRACK ADDITION: Add YouTube track to queue
      console.log(`[Play Command] Adding YouTube track to queue...`);
      
      // Final safety check before adding to queue
      if (!track.title || !track.url) {
        console.error(`[Play Command] CRITICAL: Resolved track is missing required properties:`, {
          title: track.title,
          url: track.url,
          source: track.source
        });
        return await interaction.editReply('❌ Track is missing required properties. Please try again.');
      }
      
      // Validate that URL is a proper YouTube URL
      if (!track.url.includes('http')) {
        console.error(`[Play Command] CRITICAL: Track URL is not a proper URL:`, track.url);
        return await interaction.editReply('❌ Track URL is not playable. Please try again.');
      }
      
      // Ensure it's a YouTube URL
      if (!track.url.includes('youtube.com') && !track.url.includes('youtu.be')) {
        console.error(`[Play Command] CRITICAL: Track URL is not a YouTube URL:`, track.url);
        return await interaction.editReply('❌ Track is not from YouTube. Please try a different search.');
      }
      
      // Validate duration is a number
      if (typeof track.duration !== 'number') {
        console.error(`[Play Command] CRITICAL: Track duration is not a number:`, {
          duration: track.duration,
          type: typeof track.duration
        });
        return await interaction.editReply('❌ Track duration is invalid. Please try again.');
      }
      
      // Add the safe track to queue
      queue.addTrack(track);
      
      // Verify track was added
      console.log(`[Play Command] Queue size after adding track: ${queue.tracks.size}`);
      
      // Additional queue stability check
      if (queue.tracks.size === 0) {
        console.error(`[Play Command] CRITICAL: Track was not added to queue!`);
        return await interaction.editReply('❌ Failed to add track to queue. Please try again.');
      }
      
      // RACE-PROOF PLAYBACK: Wait for track to be fully registered
      console.log(`[Play Command] Waiting for track to be fully registered...`);
      
      // Wait until the track is fully added (as recommended by GPT)
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify queue state before playback
      console.log(`[Play Command] Pre-playback queue state:`, {
        tracksSize: queue.tracks.size,
        isPlaying: queue.node.isPlaying(),
        connectionExists: !!queue.connection,
        nodeExists: !!queue.node
      });
      
      // Only start playback if queue has tracks and is not already playing (recommended pattern)
      if (queue.tracks.size > 0 && !queue.node.isPlaying()) {
        console.log(`[Play Command] Starting playback with ${queue.tracks.size} tracks in queue`);
        console.log(`[Play Command] Track details:`, {
          title: track.title,
          source: track.source,
          url: track.url ? 'Present' : 'Missing',
          duration: track.duration
        });
        
        try {
          await queue.node.play();
          console.log(`[Play Command] Playback started successfully`);
          
          // Send final success message
          await interaction.editReply(`🎶 Now playing **${track.title}**`);
          
          // Verify queue state after playback
          setTimeout(() => {
            console.log(`[Play Command] Post-playback queue state:`, {
              tracksSize: queue.tracks.size,
              isPlaying: queue.node.isPlaying(),
              connectionExists: !!queue.connection,
              nodeExists: !!queue.node
            });
            if (queue.tracks.size === 0) {
              console.error(`[Play Command] CRITICAL: Queue was emptied after playback attempt!`);
            }
          }, 2000);
          
        } catch (playError) {
          console.error(`[Play Command] Playback failed:`, playError);
          await interaction.editReply(`❌ Failed to start playback: ${playError.message || 'Unknown error'}`);
        }
      } else {
        console.warn(`[Play Command] Queue not ready for playback:`, {
          tracksSize: queue.tracks.size,
          isPlaying: queue.node.isPlaying()
        });
        if (queue.tracks.size === 0) {
          await interaction.editReply('❌ No tracks in queue. Please try again.');
        } else {
          await interaction.editReply('🎶 Track added to queue');
        }
      }
    } catch (err) {
      console.error('Play command error:', err);
      
      let errorMessage = '❌ Failed to play music. Please try again.';
      
      if (err.message && err.message.includes('Failed to connect')) {
        errorMessage = '❌ Failed to connect to voice channel. Please check permissions.';
      } else if (err.message && err.message.includes('No extractor')) {
        errorMessage = '❌ No audio extractor available for this source.';
      } else if (err.message && err.message.includes('FFmpeg')) {
        errorMessage = '❌ Audio processing error. Please try a different song.';
      } else if (err.message && err.message.includes('Could not extract stream')) {
        errorMessage = '❌ Could not extract audio stream. Try a different song or check if the source is available.';
      } else if (err.code === 'ERR_NO_RESULT') {
        errorMessage = '❌ Could not find a playable audio stream for this track. Try a different song.';
      }
      
      // Use fallback if interaction is not replied to
      try {
        if (!interaction.replied) {
          await interaction.editReply(errorMessage);
        } else {
          await interaction.followUp({ content: errorMessage, ephemeral: true });
        }
      } catch (replyError) {
        console.error('Failed to send error message:', replyError);
      }
    } finally {
      // Clean up execution tracking
      const executionKey = `${interaction.id}-${interaction.user.id}`;
      playExecutions.delete(executionKey);
      
      // Clean up old executions (keep only last 1000)
      if (playExecutions.size > 1000) {
        const toDelete = Array.from(playExecutions).slice(0, 100);
        toDelete.forEach(key => playExecutions.delete(key));
      }
    }
  },
};

