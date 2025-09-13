const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmute the bot if it\'s muted'),
  async execute(interaction) {
    const me = interaction.guild.members.me;
    
    if (!me?.voice?.channel) {
      return interaction.editReply('⚠️ Bot is not in a voice channel.');
    }

    if (!me.voice.mute) {
      return interaction.editReply('✅ Bot is not muted.');
    }

    try {
      await me.voice.setMute(false);
      return interaction.editReply('🔊 Bot unmuted successfully!');
    } catch (error) {
      console.error('Failed to unmute bot:', error);
      return interaction.editReply('❌ Failed to unmute bot. Check permissions.');
    }
  },
};
