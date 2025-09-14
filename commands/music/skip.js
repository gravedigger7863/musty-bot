const { SlashCommandBuilder } = require("discord.js");
const { useQueue } = require('discord-player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip the current song"),
  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const queue = useQueue(interaction.guild.id);

    if (!queue) {
      return interaction.editReply({ content: "❌ No active queue in this server." });
    }

    if (!queue.currentTrack) {
      return interaction.editReply({ content: "❌ No track is currently playing." });
    }

    queue.node.skip();
    await interaction.editReply("⏭️ Skipped!");
  },
};