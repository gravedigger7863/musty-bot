const { SlashCommandBuilder } = require('discord.js');
const { useQueue } = require('discord-player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the current track'),
  async execute(interaction) {
    const queue = useQueue(interaction.guild.id);
    if (!queue || !queue.currentTrack) {
      return interaction.reply({ content: '⚠️ No music is currently playing.', ephemeral: true });
    }

    // if already paused, tell the user
    if (queue.node.isPaused()) {
      return interaction.reply({ content: '⏸️ Player is already paused.', ephemeral: true });
    }

    const ok = queue.node.setPaused(true);
    return interaction.reply({ content: ok ? '⏸️ Playback paused.' : '❌ Could not pause playback.' });
  },
};
