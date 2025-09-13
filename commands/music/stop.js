const { SlashCommandBuilder } = require("discord.js");
const { useQueue } = require("discord-player");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop the music and clear the queue"),
  async execute(interaction) {
    // Defer immediately to prevent interaction timeout
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const queue = useQueue(interaction.guild.id);
    if (!queue) {
      return interaction.editReply("⚠️ No music is currently playing.");
    }

    queue.delete();
    await interaction.editReply("🛑 Music stopped!");
  },
};
