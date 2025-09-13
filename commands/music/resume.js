const { SlashCommandBuilder } = require('discord.js');
const { useQueue } = require('discord-player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume the current track'),
  async execute(interaction) {
    const queue = useQueue(interaction.guild.id);
    if (!queue || !queue.currentTrack) {
      return interaction.reply({ content: '⚠️ No music is currently playing.', flags: 64 });
    }

    // if not paused, tell the user
    if (!queue.node.isPaused()) {
      return interaction.reply({ content: '▶️ Player is already playing.', flags: 64 });
    }

    // Ensure bot is not muted when resuming
    const me = interaction.guild.members.me;
    if (me?.voice?.mute) {
      try {
        await me.voice.setMute(false);
        console.log('Bot unmuted on resume');
      } catch (muteErr) {
        console.error('Failed to unmute bot on resume:', muteErr);
      }
    }

    const ok = queue.node.setPaused(false);
    return interaction.reply({ content: ok ? '▶️ Playback resumed.' : '❌ Could not resume playback.' });
  },
};
