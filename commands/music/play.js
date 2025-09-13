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
        content: "🔍 Searching for your music..." 
      });

      // RACE-PROOF TRACK RESOLUTION: Fully resolve track before adding to queue
      console.log(`[Play Command] Searching for: ${query}`);
      let track;
      
      try {
        // First try YouTube with proper await
        console.log(`[Play Command] Trying YouTube search...`);
        const youtubeResult = await interaction.client.player.search(query, {
          requestedBy: interaction.user,
          searchEngine: 'youtube'
        });
        
        if (youtubeResult && youtubeResult.hasTracks()) {
          track = youtubeResult.tracks[0];
          console.log(`[Play Command] Found YouTube track: ${track.title}`);
        } else {
          // Fallback to SoundCloud with proper await
          console.log(`[Play Command] YouTube failed, trying SoundCloud...`);
          const soundcloudResult = await interaction.client.player.search(query, {
            requestedBy: interaction.user,
            searchEngine: 'soundcloud'
          });
          
          if (soundcloudResult && soundcloudResult.hasTracks()) {
            track = soundcloudResult.tracks[0];
            console.log(`[Play Command] Found SoundCloud track: ${track.title}`);
          }
        }
        
        if (!track) {
          return await interaction.editReply('❌ No tracks found. Please try a different search term.');
        }
        
        // Verify track is fully resolved
        if (!track.url && !track.id) {
          console.error(`[Play Command] Track not properly resolved:`, track);
          return await interaction.editReply('❌ Track could not be properly resolved. Please try again.');
        }
        
        console.log(`[Play Command] Track resolved successfully: ${track.title} (${track.source})`);
        
        // CRITICAL: Resolve track to proper playable stream URL
        console.log(`[Play Command] Resolving track to playable stream...`);
        try {
          const resolvedTrack = await interaction.client.player.extractors.resolve(track.url, {
            requestedBy: interaction.user
          });
          
          if (!resolvedTrack || !resolvedTrack.streamURL) {
            console.error(`[Play Command] Failed to resolve track to playable stream:`, {
              originalUrl: track.url,
              resolvedTrack: resolvedTrack
            });
            return await interaction.editReply('❌ Could not resolve track to playable stream. Please try again.');
          }
          
          console.log(`[Play Command] Track stream resolved successfully:`, {
            title: resolvedTrack.title,
            streamURL: resolvedTrack.streamURL ? 'Present' : 'Missing',
            duration: resolvedTrack.duration,
            source: resolvedTrack.source
          });
          
          // Create properly resolved track for Discord Player
          track = {
            title: resolvedTrack.title,
            url: resolvedTrack.streamURL, // Direct audio stream URL
            duration: resolvedTrack.duration, // Should be number in milliseconds
            requestedBy: interaction.user,
            thumbnail: resolvedTrack.thumbnail,
            source: resolvedTrack.source || 'unknown',
            author: resolvedTrack.author || 'Unknown Artist',
            description: resolvedTrack.description || '',
            views: resolvedTrack.views || 0,
            id: resolvedTrack.id || resolvedTrack.streamURL,
            raw: resolvedTrack.raw || resolvedTrack
          };
          
          console.log(`[Play Command] Final track object:`, {
            title: track.title,
            url: track.url ? 'Present' : 'Missing',
            duration: track.duration,
            durationType: typeof track.duration,
            source: track.source
          });
          
        } catch (resolveError) {
          console.error(`[Play Command] Track resolution failed:`, resolveError);
          return await interaction.editReply('❌ Could not resolve track to playable stream. Please try a different song.');
        }
        
      } catch (searchError) {
        console.error(`[Play Command] Search failed:`, searchError);
        return await interaction.editReply('❌ Search failed. Please try again.');
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

      // RACE-PROOF TRACK ADDITION: Add safe track to queue
      console.log(`[Play Command] Adding safe track to queue...`);
      
      // Final safety check before adding to queue
      if (!track.title || !track.url) {
        console.error(`[Play Command] CRITICAL: Resolved track is missing required properties:`, {
          title: track.title,
          url: track.url,
          source: track.source
        });
        return await interaction.editReply('❌ Track is missing required properties. Please try again.');
      }
      
      // Validate that URL is a proper stream URL
      if (!track.url.includes('http') || track.url.includes('soundcloud.com/') && !track.url.includes('stream')) {
        console.error(`[Play Command] CRITICAL: Track URL is not a proper stream URL:`, track.url);
        return await interaction.editReply('❌ Track URL is not playable. Please try again.');
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

