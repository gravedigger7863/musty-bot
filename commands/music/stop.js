const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop the music and clear the queue"),
  async execute(interaction, client) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const player = client.manager.players.get(interaction.guild.id);
    if (!player) {
      return interaction.editReply("⚠️ No music is currently playing.");
    }

    player.destroy();
    await interaction.editReply("🛑 Music stopped!");
  },
};