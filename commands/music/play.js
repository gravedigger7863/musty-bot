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

      // Search for tracks first
      console.log(`[Play Command] Searching for: ${query}`);
      const searchResult = await interaction.client.player.search(query, {
        requestedBy: interaction.user,
        searchEngine: 'auto'
      });

      console.log(`[Play Command] Search result: ${searchResult.hasTracks() ? 'Found tracks' : 'No tracks found'}`);
      if (searchResult.hasTracks()) {
        console.log(`[Play Command] First track: ${searchResult.tracks[0].title}`);
      }

      if (!searchResult.hasTracks()) {
        return await interaction.editReply('❌ No results found for your search query.');
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
      console.log(`[Play Command] Queue is playing: ${queue.isPlaying()}`);
      console.log(`[Play Command] Current track: ${queue.currentTrack?.title || 'None'}`);

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
      }
      
      await interaction.editReply(errorMessage);
    }
  },
};
