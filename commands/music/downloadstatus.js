const { SlashCommandBuilder } = require('discord.js');
const CobaltIntegration = require('../../modules/cobalt-integration');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('downloadstatus')
    .setDescription('Check download status and see recently downloaded files'),

  async execute(interaction) {
    const cobalt = new CobaltIntegration();

    try {
      await interaction.deferReply();

      const embed = cobalt.createDownloadStatusEmbed(interaction.guildId);
      
      // Add global queue info
      const queueInfo = cobalt.getQueueInfo();
      embed.addFields({
        name: 'Global Status',
        value: `Active Downloads: ${queueInfo.activeDownloads}\nTotal Downloaded Files: ${queueInfo.totalDownloadedFiles}`,
        inline: false
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Download status command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while checking download status.'
      });
    }
  }
};
