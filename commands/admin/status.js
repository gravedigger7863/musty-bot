const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Show bot performance and system status'),
  
  async execute(interaction, client) {
    await interaction.deferReply();
    
    try {
      // Get performance report
      const report = client.performance.getReport();
      const cacheStats = client.cache.getStats();
      
      // Get system information
      const memUsage = process.memoryUsage();
      const uptime = process.uptime();
      
      // Create status embed
      const embed = new EmbedBuilder()
        .setTitle('🤖 Bot Status & Performance')
        .setColor('#00ff00')
        .setTimestamp()
        .addFields(
          {
            name: '📊 Performance Metrics',
            value: [
              `**Uptime:** ${Math.floor(uptime / 60)} minutes`,
              `**Commands Executed:** ${report.commands}`,
              `**Error Rate:** ${report.errorRate}`,
              `**Avg Response Time:** ${report.averageResponseTime}`
            ].join('\n'),
            inline: true
          },
          {
            name: '💾 Memory Usage',
            value: [
              `**Current:** ${report.memory.current}`,
              `**Peak:** ${report.memory.peak}`,
              `**RSS:** ${report.memory.rss}`
            ].join('\n'),
            inline: true
          },
          {
            name: '🎵 Music Status',
            value: [
              `**Guilds:** ${report.activity.guilds}`,
              `**Channels:** ${report.activity.channels}`,
              `**Users:** ${report.activity.users}`
            ].join('\n'),
            inline: true
          },
          {
            name: '🗄️ Cache Statistics',
            value: [
              `**Size:** ${cacheStats.size}/${cacheStats.maxSize}`,
              `**Hit Rate:** ${cacheStats.hitRate}`,
              `**Sets:** ${cacheStats.sets}`,
              `**Hits:** ${cacheStats.hits}`
            ].join('\n'),
            inline: true
          }
        );
      
      // Add alerts if any
      if (report.alerts.length > 0) {
        const recentAlerts = report.alerts.slice(-3);
        embed.addFields({
          name: '⚠️ Recent Alerts',
          value: recentAlerts.map(alert => 
            `**${alert.type}:** ${alert.message}`
          ).join('\n'),
          inline: false
        });
      }
      
      // Add optimization suggestions if any
      if (report.suggestions.length > 0) {
        const suggestions = report.suggestions.slice(0, 2);
        embed.addFields({
          name: '💡 Optimization Suggestions',
          value: suggestions.map(s => 
            `**${s.type}:** ${s.suggestion}`
          ).join('\n'),
          inline: false
        });
      }
      
      // Add footer with Node.js version
      embed.setFooter({ 
        text: `Node.js ${process.version} | Discord.js ${require('discord.js').version}` 
      });
      
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error in status command:', error);
      await interaction.editReply({
        content: '❌ Error retrieving status information'
      });
    }
  }
};