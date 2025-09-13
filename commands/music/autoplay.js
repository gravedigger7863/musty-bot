const { SlashCommandBuilder } = require('discord.js');
const { useQueue } = require('discord-player');

// store autoplay status per guild
const autoplayStatus = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Toggle autoplay for related tracks'),
  async execute(interaction) {
    // Defer immediately to prevent interaction timeout
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const queue = useQueue(interaction.guild.id);
    if (!queue || !queue.channel) {
      return interaction.editReply({ content: '⚠️ The bot must be in a voice channel first.' });
    }

    const enabled = autoplayStatus.get(interaction.guild.id) || false;
    autoplayStatus.set(interaction.guild.id, !enabled);

    // enable or disable autoplay
    queue.node.setAutoplay(!enabled);

    return interaction.editReply(`🔁 Autoplay is now **${!enabled ? 'ENABLED ✅' : 'DISABLED ❌'}**`);
  },
};
