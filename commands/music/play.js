const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song from YouTube or Spotify")
    .addStringOption(option =>
      option.setName("query").setDescription("Song name or link").setRequired(true)
    ),
  async execute(interaction) {
    const query = interaction.options.getString("query");
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: "⚠️ You need to join a voice channel first!", flags: 64 });
    }

    await interaction.deferReply(); // defer for async operation

    try {
      const queue = interaction.client.player.nodes.create(interaction.guild, {
        metadata: { channel: interaction.channel },
        leaveOnEnd: false,
        leaveOnEmpty: false,
        leaveOnEmptyCooldown: 300000,
      });

      const result = await queue.play(query, { nodeOptions: { metadata: { channel: interaction.channel } } });
      await interaction.editReply(`🎶 Now playing **${result.track.title}**`);
    } catch (error) {
      console.error(error);
      await interaction.editReply('❌ Could not find any results for that query.');
    }
  },
};
