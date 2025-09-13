const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song from YouTube or Spotify")
    .addStringOption(option =>
      option.setName("query")
        .setDescription("Song name or link")
        .setRequired(true)
    ),
  async execute(interaction) {
    const query = interaction.options.getString("query");
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({ content: "⚠️ You need to join a voice channel first!", flags: 64 });
    }

    await interaction.deferReply(); // defer first

    try {
      // Create or get the guild queue
      const queue = interaction.client.player.nodes.create(interaction.guild, {
        metadata: { channel: interaction.channel },
        leaveOnEnd: false,       // 24/7 mode
        leaveOnEmpty: false,     // don't leave if empty
        leaveOnEmptyCooldown: 300000, // 5 min
      });

      // Ensure bot joins the voice channel
      if (!queue.connection) await queue.connect(voiceChannel);

      // Play the track
      const result = await queue.play(query, {
        nodeOptions: { metadata: { channel: interaction.channel } },
      });

      // Reply with the track info
      await interaction.editReply(`🎶 Now playing **${result.track.title}**`);
    } catch (err) {
      console.error(err);
      await interaction.editReply('❌ No results found for that query.');
    }
  },
};
