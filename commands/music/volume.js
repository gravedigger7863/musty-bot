const { SlashCommandBuilder } = require('discord.js');
const { useQueue } = require('discord-player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set the music volume (1-100)')
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Volume level (1-100)')
        .setRequired(true)
    ),
  async execute(interaction) {
    const queue = useQueue(interaction.guild.id);
    if (!queue || !queue.currentTrack) {
      return interaction.reply({ content: '⚠️ No music is currently playing.', ephemeral: true });
    }

    const amount = interaction.options.getInteger('amount');
    if (amount < 1 || amount > 100) {
      return interaction.reply({ content: '⚠️ Volume must be between 1 and 100.', ephemeral: true });
    }

    queue.node.setVolume(amount);
    return interaction.reply(`🔊 Volume set to **${amount}%**`);
  },
};
