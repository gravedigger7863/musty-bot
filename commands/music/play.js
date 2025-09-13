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
    console.log(`[Play Command] Starting play command for query: ${interaction.options.getString("query")}`);
    
    // Defer immediately to prevent interaction timeout
    await interaction.deferReply();
    
    const query = interaction.options.getString("query");
    const voiceChannel = interaction.member?.voice?.channel;

    if (!voiceChannel) {
      return await interaction.editReply({ 
        content: "⚠️ You need to join a voice channel first!"
      });
    }

    try {
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

      // Use the play method directly instead of managing queue manually
      console.log(`[Play Command] Playing track: ${searchResult.tracks[0].title}`);
      const queue = await interaction.client.player.play(voiceChannel, searchResult.tracks[0], {
        nodeOptions: {
          metadata: { channel: interaction.channel },
          leaveOnEnd: false,
          leaveOnEmpty: false,
          leaveOnEmptyCooldown: 300000,
          selfDeaf: false,
          selfMute: false
        }
      });

      console.log(`[Play Command] Queue created/updated for guild: ${interaction.guild.id}`);
      if (queue && queue.node) {
        console.log(`[Play Command] Queue is playing: ${queue.node.isPlaying()}`);
        console.log(`[Play Command] Current track: ${queue.currentTrack?.title || 'None'}`);
      } else {
        console.log(`[Play Command] Queue or node is undefined`);
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
      
      await interaction.editReply(errorMessage);
    }
  },
};
