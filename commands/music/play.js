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

    try {
      // Get or create the queue
      const queue = interaction.client.player.nodes.get(interaction.guild.id) || 
        interaction.client.player.nodes.create(interaction.guild, {
        metadata: { channel: interaction.channel },
        leaveOnEnd: false,
        leaveOnEmpty: false,
          leaveOnEmptyCooldown: 300000
        });

      // Connect to voice channel if not already connected
      if (!queue.connection) {
          await queue.connect(voiceChannel);
      }

      // Search and play the track using Discord Player's built-in search
      const searchResult = await interaction.client.player.search(query, {
        requestedBy: interaction.user,
        searchEngine: 'auto'
      });

      if (!searchResult.hasTracks()) {
        return await interaction.editReply('❌ No results found for your search query.');
      }

      // Add the track to the queue
      queue.addTrack(searchResult.tracks[0]);

      // Start playing if nothing is currently playing
      if (!queue.isPlaying()) {
        await queue.node.play();
      }

      // Send success message
      await interaction.editReply(`🎶 Now playing **${searchResult.tracks[0].title}**`);
    } catch (err) {
      console.error('Play command error:', err);
      
      let errorMessage = '❌ Failed to play music. Please try again.';
      
      if (err.message && err.message.includes('Failed to connect')) {
        errorMessage = '❌ Failed to connect to voice channel. Please check permissions.';
      }
      
      await interaction.editReply(errorMessage);
    }
  },
};
