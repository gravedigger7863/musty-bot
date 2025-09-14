const { SlashCommandBuilder } = require('discord.js');

function progressBar(queue) {
  const total = queue.currentTrack.durationMS;
  const timestamp = queue.node.getTimestamp();
  const barLength = 20;

  if (!timestamp || !timestamp.current) return '◼️'.repeat(barLength);

  const current = timestamp.current.value;
  const percent = timestamp.current.label;

  if (!current) return '◼️'.repeat(barLength);

  const position = Math.floor((current / total) * barLength);

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
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const queue = interaction.client.player.nodes.get(interaction.guild.id);
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