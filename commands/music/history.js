const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const LavaPlayerFeatures = require('../../modules/lavaplayer-features');
const CommandUtils = require('../../modules/command-utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('View recently played tracks (LavaPlayer-inspired)')
    .addIntegerOption(option =>
      option
        .setName('limit')
        .setDescription('Number of tracks to show (1-20)')
        .setMinValue(1)
        .setMaxValue(20)
        .setRequired(false)
    ),

  async execute(interaction, client) {
    const utils = new CommandUtils();
    const lavaPlayer = new LavaPlayerFeatures();
    
    try {
      // Check cooldown
      const cooldown = utils.isOnCooldown(interaction.user.id, 'history');
      if (cooldown) {
        return interaction.editReply({
          embeds: [utils.createErrorEmbed('Cooldown', `Please wait ${cooldown} seconds before using this command again.`)]
        });
      }

      const limit = interaction.options.getInteger('limit') || 10;
      const history = lavaPlayer.getHistory(interaction.guildId, limit);
      
      // Set cooldown
      utils.setCooldown(interaction.user.id, 'history');
      
      if (history.length === 0) {
        const embed = utils.createInfoEmbed(
          'No History',
          'No tracks in your history yet! Start playing some music to build your history.',
          '#ffaa00'
        );
        return interaction.editReply({ embeds: [embed] });
      }

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📚 Recently Played Tracks')
        .setDescription(`Showing last ${history.length} tracks`)
        .setTimestamp();

      const historyList = history.map((track, index) => {
        const duration = utils.formatDuration(track.duration);
        const timeAgo = utils.formatTimeAgo(track.timestamp);
        const sourceEmoji = utils.getSourceEmoji(track.source);
        return `${index + 1}. **${track.title}** - ${track.author}\n   ⏱️ ${duration} • ${sourceEmoji} ${track.source} • ${timeAgo}`;
      }).join('\n\n');

      embed.setDescription(historyList);

      if (history.length === limit) {
        embed.setFooter({ text: `Showing last ${limit} tracks` });
      }

      return interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('History command error:', error);
      return interaction.editReply({
        embeds: [utils.createErrorEmbed('Error', 'An error occurred while retrieving history.')]
      });
    }
  },

  formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  }
};
