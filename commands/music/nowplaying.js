const { SlashCommandBuilder } = require('discord.js');
const { useQueue } = require('discord-player');

function progressBar(queue) {
  const total = queue.currentTrack.durationMS;
  const current = queue.node.getTimestamp().current.value;
  const barLength = 20;

  if (!current) return '◼️'.repeat(barLength);

  const percent = queue.node.getTimestamp().current.label;
  const position = Math.floor((queue.node.getTimestamp().current.value / total) * barLength);

  let bar = '';
  for (let i = 0; i < barLength; i++) {
    bar += i === position ? '🔘' : '▬';
  }
  return `${bar} (${percent})`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show the currently playing track with progress bar'),
  async execute(interaction) {
    // Defer immediately to prevent interaction timeout
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const queue = useQueue(interaction.guild.id);
    if (!queue || !queue.currentTrack) {
      return interaction.editReply({ content: '⚠️ No music is currently playing.' });
    }

    const track = queue.currentTrack;

    const embed = {
      color: 0x1db954,
      title: `🎶 Now Playing`,
      description: `[${track.title}](${track.url})`,
      fields: [
        { name: 'Duration', value: track.duration, inline: true },
        { name: 'Progress', value: progressBar(queue), inline: false },
      ],
    };

    return interaction.editReply({ embeds: [embed] });
  },
};
