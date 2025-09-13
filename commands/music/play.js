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

      // Search for tracks with optimized timeout
      console.log(`[Play Command] Searching for: ${query}`);
      let searchResult;
      
      try {
        // Try YouTube first (usually fastest) with timeout
        searchResult = await Promise.race([
          interaction.client.player.search(query, {
            requestedBy: interaction.user,
            searchEngine: 'youtube'
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('YouTube search timeout')), 5000)
          )
        ]);
        
        if (searchResult.hasTracks()) {
          console.log(`[Play Command] Found tracks with YouTube: ${searchResult.tracks[0].title}`);
        } else {
          throw new Error('No YouTube results');
        }
      } catch (youtubeError) {
        console.log(`[Play Command] YouTube failed, trying SoundCloud:`, youtubeError.message);
        
        // Fallback to SoundCloud if YouTube fails
        try {
          searchResult = await Promise.race([
            interaction.client.player.search(query, {
              requestedBy: interaction.user,
              searchEngine: 'soundcloud'
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('SoundCloud search timeout')), 5000)
            )
          ]);
          
          if (searchResult.hasTracks()) {
            console.log(`[Play Command] Found tracks with SoundCloud: ${searchResult.tracks[0].title}`);
          } else {
            throw new Error('No SoundCloud results');
          }
        } catch (soundcloudError) {
          console.log(`[Play Command] SoundCloud also failed:`, soundcloudError.message);
          throw new Error('All search engines failed');
        }
      }

      if (!searchResult || !searchResult.hasTracks()) {
        return await interaction.editReply('❌ No results found for your search query on any platform.');
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

      // RACE-FREE PLAYBACK: Use setImmediate to ensure queue state is fully updated
      console.log(`[Play Command] Adding track and preparing for race-free playback...`);
      
      // Add track to queue
      queue.addTrack(searchResult.tracks[0]);
      
      // Verify track was added
      console.log(`[Play Command] Queue size after adding track: ${queue.tracks.size}`);
      
      // Additional queue stability check
      if (queue.tracks.size === 0) {
        console.error(`[Play Command] CRITICAL: Track was not added to queue!`);
        return await interaction.editReply('❌ Failed to add track to queue. Please try again.');
      }
      
      // Wait for queue to be fully ready before starting playback
      console.log(`[Play Command] Pre-playback queue state:`, {
        tracksSize: queue.tracks.size,
        isPlaying: queue.node.isPlaying(),
        connectionExists: !!queue.connection,
        nodeExists: !!queue.node
      });
      
      // Only start playback if queue has tracks and is not already playing
      if (queue.tracks.size > 0 && !queue.node.isPlaying()) {
        console.log(`[Play Command] Starting playback with ${queue.tracks.size} tracks in queue`);
        
        // Small delay to ensure queue is fully stable
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Verify queue is still stable before playback
        console.log(`[Play Command] Pre-playback verification:`, {
          tracksSize: queue.tracks.size,
          isPlaying: queue.node.isPlaying(),
          connectionExists: !!queue.connection,
          nodeExists: !!queue.node
        });
        
        if (queue.tracks.size === 0) {
          console.error(`[Play Command] CRITICAL: Queue was emptied during delay!`);
          return await interaction.editReply('❌ Queue was emptied unexpectedly. Please try again.');
        }
        
        try {
          await queue.node.play();
          console.log(`[Play Command] Playback started successfully`);
          
          // Send final success message
          await interaction.editReply(`🎶 Now playing **${searchResult.tracks[0].title}**`);
          
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

