const { SlashCommandBuilder } = require("discord.js");

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
    // Defer immediately to prevent interaction timeout - MUST be first!
    try {
      await interaction.deferReply();
      console.log(`[Play Command] Interaction deferred successfully`);
    } catch (err) {
      console.warn("Failed to defer interaction:", err.message);
      return; // Exit if we can't defer - interaction is likely expired
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
          selfDeaf: false,
          selfMute: false,
          // Prevent queue from being auto-destroyed
          skipOnEmpty: false,
          skipOnEmptyCooldown: 300000
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
        console.log(`[Play Command] Already connected to voice channel`);
      }

      // Add track to queue
      console.log(`[Play Command] Adding track to queue: ${searchResult.tracks[0].title}`);
      queue.addTrack(searchResult.tracks[0]);
      
      // Verify track was added to queue
      console.log(`[Play Command] Queue size after adding track: ${queue.tracks.size}`);

      // Start playing if not already playing
      if (!queue.node.isPlaying()) {
        console.log(`[Play Command] Starting playback`);
        try {
          await queue.node.play();
          console.log(`[Play Command] Playback started - waiting for trackStart event`);
          
          // Wait a moment for track to start, then verify
          setTimeout(() => {
            console.log(`[Play Command] Queue state check - Size: ${queue.tracks.size}, Playing: ${queue.node.isPlaying()}`);
          }, 2000);
          
        } catch (playError) {
          console.error(`[Play Command] Failed to start playback:`, playError);
          return await interaction.editReply('❌ Failed to start playback. This might be due to FFmpeg issues or audio stream problems.');
        }
      } else {
        console.log(`[Play Command] Already playing, track added to queue`);
      }

      // Send success message
      await interaction.editReply(`🎶 Now playing **${searchResult.tracks[0].title}**`);
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
    }
  },
};
