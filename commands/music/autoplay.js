const { SlashCommandBuilder } = require('discord.js');

// store autoplay status per guild
const autoplayStatus = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Toggle autoplay for related tracks'),
  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const queue = interaction.client.player.nodes.get(interaction.guild.id);
    if (!queue || !queue.connection) {
      return interaction.editReply({ content: '⚠️ The bot must be in a voice channel first.' });
    }

    const enabled = autoplayStatus.get(interaction.guild.id) || false;
    autoplayStatus.set(interaction.guild.id, !enabled);

    // enable or disable autoplay
    queue.node.setAutoplay(!enabled);

    return interaction.editReply(`🔁 Autoplay is now **${!enabled ? 'ENABLED ✅' : 'DISABLED ❌'}**`);
  },
};
