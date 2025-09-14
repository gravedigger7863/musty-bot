const { SlashCommandBuilder } = require('discord.js');

// store 24/7 status per guild
const stayInVC = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('247')
    .setDescription('Toggle 24/7 mode (stay in VC even with no music)'),
  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const queue = interaction.client.player.nodes.get(interaction.guild.id);
    if (!queue || !queue.connection) {
      return interaction.editReply({ content: '⚠️ The bot must be in a voice channel first.' });
    }

    const enabled = stayInVC.get(interaction.guild.id) || false;
    stayInVC.set(interaction.guild.id, !enabled);

    // if disabled, destroy queue when music ends
    if (enabled) {
      queue.setRepeatMode(0); // reset any loop/autoplay
      // Note: In v7, queue cleanup is handled automatically by the player
      // No need to manually add event listeners for queue deletion
    }

    return interaction.editReply(`🔄 24/7 mode is now **${!enabled ? 'ENABLED ✅' : 'DISABLED ❌'}**`);
  },
};