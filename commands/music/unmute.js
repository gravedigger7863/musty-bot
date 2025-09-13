const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmute the bot if it\'s muted'),
  async execute(interaction) {
    const me = interaction.guild.members.me;
    
    if (!me?.voice?.channel) {
      return interaction.reply({ 
        content: '⚠️ Bot is not in a voice channel.', 
        flags: 64 
      });
    }

    if (!me.voice.mute) {
      return interaction.reply({ 
        content: '✅ Bot is not muted.', 
        flags: 64 
      });
    }

    try {
      await me.voice.setMute(false);
      return interaction.reply('🔊 Bot unmuted successfully!');
    } catch (error) {
      console.error('Failed to unmute bot:', error);
      return interaction.reply({ 
        content: '❌ Failed to unmute bot. Check permissions.', 
        flags: 64 
      });
    }
  },
};
