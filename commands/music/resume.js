const { SlashCommandBuilder } = require('discord.js');
const { useQueue } = require('discord-player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume the current track'),
  async execute(interaction) {
    // Defer immediately to prevent interaction timeout
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const queue = useQueue(interaction.guild.id);
    if (!queue || !queue.currentTrack) {
      return interaction.editReply({ content: '⚠️ No music is currently playing.' });
    }

    // if not paused, tell the user
    if (!queue.node.isPaused()) {
      return interaction.editReply({ content: '▶️ Player is already playing.' });
    }

    const ok = queue.node.setPaused(false);
    return interaction.editReply({ content: ok ? '▶️ Playback resumed.' : '❌ Could not resume playback.' });
  },
};
