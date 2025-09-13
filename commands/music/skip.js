const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip the current song"),
  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const queue = interaction.client.player.nodes.get(interaction.guild.id);
    if (!queue || !queue.isPlaying()) {
      return interaction.editReply("⚠️ No music is currently playing.");
    }

    queue.node.skip();
    await interaction.editReply("⏭️ Skipped!");
  },
};
