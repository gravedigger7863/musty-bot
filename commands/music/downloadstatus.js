const { SlashCommandBuilder } = require('discord.js');
const YtdlpIntegration = require('../../modules/ytdlp-integration');
const CommandUtils = require('../../modules/command-utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('downloadstatus')
    .setDescription('Check download status and see recently downloaded files'),

  async execute(interaction) {
    const utils = new CommandUtils();
    const ytdlp = new YtdlpIntegration();

    try {
      await interaction.deferReply();

      const embed = ytdlp.createDownloadStatusEmbed(interaction.guildId);
      
      // Add global queue info
      const queueInfo = ytdlp.getQueueInfo();
      embed.addFields({
        name: 'Global Status',
        value: `Active Downloads: ${queueInfo.activeDownloads}\nTotal Downloaded Files: ${queueInfo.totalDownloadedFiles}`,
        inline: false
      });

      // Add auto-download info
      embed.addFields({
        name: '🤖 Auto-Download Status',
        value: 'The bot automatically downloads tracks using yt-dlp when using `/play` for better reliability!',
        inline: false
      });

      embed.setFooter({ 
        text: 'Tracks are automatically downloaded with yt-dlp and cached for faster playback' 
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Download status command error:', error);
      await interaction.editReply({
        embeds: [utils.createErrorEmbed('Error', 'An error occurred while checking download status.')]
      });
    }
  }
};
