const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop the music and clear the queue"),
  async execute(interaction, client) {
    // Interaction is already deferred by interactionCreate event

    const queue = client.player.nodes.get(interaction.guild.id);
    if (!queue) {
      return interaction.editReply("⚠️ No music is currently playing.");
    }

    queue.delete();
    await interaction.editReply("🛑 Music stopped!");
  },
};