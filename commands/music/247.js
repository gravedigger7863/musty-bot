const { SlashCommandBuilder } = require('discord.js');
const { useQueue } = require('discord-player');

// store 24/7 status per guild
const stayInVC = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('247')
    .setDescription('Toggle 24/7 mode (stay in VC even with no music)'),
  async execute(interaction) {
    const queue = useQueue(interaction.guild.id);
    if (!queue || !queue.channel) {
      return interaction.reply({ content: '⚠️ The bot must be in a voice channel first.', ephemeral: true });
    }

    const enabled = stayInVC.get(interaction.guild.id) || false;
    stayInVC.set(interaction.guild.id, !enabled);

    // if disabled, destroy queue when music ends
    if (enabled) {
      queue.setRepeatMode(0); // reset any loop/autoplay
      queue.node.on('end', () => queue.delete()); 
    }

    return interaction.reply(`🔄 24/7 mode is now **${!enabled ? 'ENABLED ✅' : 'DISABLED ❌'}**`);
  },
};
