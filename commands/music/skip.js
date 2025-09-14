const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip the current song"),
  async execute(interaction, client) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const player = client.manager.players.get(interaction.guild.id);

    if (!player) {
      return interaction.editReply({ content: "❌ No active queue in this server." });
    }

    if (!player.queue.current) {
      return interaction.editReply({ content: "❌ No track is currently playing." });
    }

    player.skip();
    await interaction.editReply("⏭️ Skipped!");
  },
};