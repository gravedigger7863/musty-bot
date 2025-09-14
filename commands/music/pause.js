const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the current track'),
  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const queue = interaction.client.player.nodes.get(interaction.guild.id);
    if (!queue || !queue.current) {
      return interaction.editReply({ content: '⚠️ No music is currently playing.' });
    }

    if (queue.node.isPaused()) {
      return interaction.editReply({ content: '⏸️ Player is already paused.' });
    }

    const ok = queue.node.setPaused(true);
    return interaction.editReply({ content: ok ? '⏸️ Playback paused.' : '❌ Could not pause playback.' });
  },
};