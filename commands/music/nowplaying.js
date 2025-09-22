const { SlashCommandBuilder } = require('discord.js');
const CommandUtils = require('../../modules/command-utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show the currently playing track with detailed information')
    .addStringOption(option =>
      option
        .setName('theme')
        .setDescription('Choose a theme for the display')
        .setRequired(false)
        .addChoices(
          { name: 'Dark', value: 'dark' },
          { name: 'Light', value: 'light' },
          { name: 'Purple', value: 'purple' }
        )
    ),

  async execute(interaction, client) {
    const utils = new CommandUtils();
    const theme = interaction.options.getString('theme') || 'dark';
    
    try {
      // Check cooldown
      const cooldown = utils.isOnCooldown(interaction.user.id, 'nowplaying');
      if (cooldown) {
        return interaction.editReply({
          embeds: [utils.createErrorEmbed('Cooldown', `Please wait ${cooldown} seconds before using this command again.`)]
        });
      }

      // Validate queue
      const queueValidation = utils.validateQueue(interaction, true);
      if (!queueValidation.valid) {
        return interaction.editReply({
          embeds: [utils.createErrorEmbed('Queue Required', queueValidation.error)]
        });
      }

      const queue = queueValidation.queue;
      const track = queue.currentTrack;
      
      // Set cooldown
      utils.setCooldown(interaction.user.id, 'nowplaying');

      // Create enhanced now playing embed
      const embed = utils.createTrackEmbed(track, queue, '🎵 Now Playing');
      
      // Add theme-based styling
      const themeColors = {
        dark: '#1a1a1a',
        light: '#ffffff',
        purple: '#2d1b69'
      };
      embed.setColor(themeColors[theme] || themeColors.dark);

      // Add detailed track information
      embed.addFields(
        { name: '📡 Source', value: `${utils.getSourceEmoji(track.source)} ${track.source.charAt(0).toUpperCase() + track.source.slice(1)}`, inline: true },
        { name: '🔊 Volume', value: `${queue.node.volume}%`, inline: true },
        { name: '🔄 Loop', value: queue.repeatMode === 1 ? '🔁 On' : '❌ Off', inline: true }
      );

      // Add queue information
      if (queue.tracks.count > 0) {
        const nextTrack = queue.tracks.at(0);
        embed.addFields({
          name: '⏭️ Next Track',
          value: `**${nextTrack.title}** by ${nextTrack.author}`,
          inline: false
        });
      }

      // Add playback status
      const isPaused = queue.node.isPaused();
      embed.addFields({
        name: '▶️ Playback Status',
        value: isPaused ? '⏸️ Paused' : '▶️ Playing',
        inline: true
      });

      // Add autoplay status
      embed.addFields({
        name: '🔄 Autoplay',
        value: queue.node.isAutoplay ? '▶️ On' : '❌ Off',
        inline: true
      });

      // Add requested by information
      if (track.requestedBy) {
        embed.addFields({
          name: '👤 Requested By',
          value: track.requestedBy.tag,
          inline: true
        });
      }

      // Add timestamp for when track started
      const timestamp = queue.node.getTimestamp();
      if (timestamp && timestamp.current) {
        const startTime = Date.now() - timestamp.current.value;
        embed.addFields({
          name: '🕐 Started',
          value: utils.formatTimeAgo(startTime),
          inline: true
        });
      }

      return interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Now playing command error:', error);
      return interaction.editReply({
        embeds: [utils.createErrorEmbed('Error', 'An error occurred while getting track information.')]
      });
    }
  },
};