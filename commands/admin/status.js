const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Check bot status and extractor information"),
  async execute(interaction) {
    try {
      const extractorsLoaded = global.extractorsLoaded || false;
      
      let statusMessage = `🤖 **Bot Status**\n`;
      statusMessage += `📊 **Extractors Loaded:** ${extractorsLoaded ? '✅ Yes' : '❌ No'}\n`;
      statusMessage += `🔢 **Extractors:** YouTube, Spotify, SoundCloud\n`;
      statusMessage += `⏰ **Uptime:** ${Math.floor(process.uptime())} seconds\n`;
      statusMessage += `💾 **Memory Usage:** ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB\n`;
      
      await interaction.reply({ content: statusMessage, ephemeral: true });
    } catch (error) {
      console.error('Status command error:', error);
      await interaction.reply({ 
        content: `❌ Error getting status: ${error.message}`, 
        ephemeral: true 
      });
    }
  },
};
