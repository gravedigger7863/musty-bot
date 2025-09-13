const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume the current track'),
  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const queue = interaction.client.player.nodes.get(interaction.guild.id);
    if (!queue || !queue.currentTrack) {
      return interaction.editReply({ content: '⚠️ No music is currently playing.' });
    }

    if (!queue.node.isPaused()) {
      return interaction.editReply({ content: '▶️ Player is already playing.' });
    }

    const ok = queue.node.setPaused(false);
    return interaction.editReply({ content: ok ? '▶️ Playback resumed.' : '❌ Could not resume playback.' });
  },
};
