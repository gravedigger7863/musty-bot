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
    if (!interaction.deferred && !interaction.replied) {
      try {
        await interaction.deferReply();
        console.log(`[Play Command] Interaction deferred successfully`);
      } catch (deferError) {
        console.error(`[Play Command] Failed to defer interaction:`, deferError);
        // If defer fails, the interaction is likely already handled
        return;
      }
    } else {
      console.log(`[Play Command] Interaction already deferred or replied`);
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

      // Search for tracks first with multiple fallback engines
      console.log(`[Play Command] Searching for: ${query}`);
      let searchResult;
      
      // Try different search engines as fallback
      const searchEngines = ['youtube', 'soundcloud', 'spotify'];
      for (const engine of searchEngines) {
        try {
          console.log(`[Play Command] Trying search engine: ${engine}`);
          searchResult = await interaction.client.player.search(query, {
            requestedBy: interaction.user,
            searchEngine: engine
          });
          
          if (searchResult.hasTracks()) {
            console.log(`[Play Command] Found tracks with ${engine}: ${searchResult.tracks[0].title}`);
            break;
          }
        } catch (searchError) {
          console.log(`[Play Command] Search failed with ${engine}:`, searchError.message);
          continue;
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
          selfMute: false
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

      // Start playing if not already playing
      if (!queue.node.isPlaying()) {
        console.log(`[Play Command] Starting playback`);
        await queue.node.play();
        console.log(`[Play Command] Playback started - waiting for trackStart event`);
      } else {
        console.log(`[Play Command] Already playing, track added to queue`);
      }

      // Send success message - don't check queue state immediately as it may not be updated yet
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
