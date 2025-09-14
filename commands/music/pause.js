const { SlashCommandBuilder } = require('discord.js');
const { useQueue } = require('discord-player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Toggle pause/resume playback'),
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

    if (queue.node.isPaused()) {
      queue.node.resume();
      return interaction.editReply("▶️ Resumed playback!");
    } else {
      queue.node.pause();
      return interaction.editReply("⏸️ Paused playback!");
    }
  },
};