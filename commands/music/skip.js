const { SlashCommandBuilder } = require("discord.js");
const CommandUtils = require('../../modules/command-utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip the current song")
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Number of tracks to skip (default: 1)')
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false)
    ),
    
  async execute(interaction, client) {
    const utils = new CommandUtils();
    const amount = interaction.options.getInteger('amount') || 1;
    
    // Check cooldown
    const cooldown = utils.isOnCooldown(interaction.user.id, 'skip');
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
    const currentTrack = queue.currentTrack;

    // Check if there are enough tracks to skip
    if (amount > queue.tracks.count + 1) {
      return interaction.editReply({
        embeds: [utils.createErrorEmbed('Invalid Amount', `Cannot skip ${amount} tracks. Only ${queue.tracks.count + 1} tracks available.`)]
      });
    }

    // Set cooldown
    utils.setCooldown(interaction.user.id, 'skip');

    // Skip the tracks
    for (let i = 0; i < amount; i++) {
      if (queue.tracks.count > 0 || i === 0) {
        queue.node.skip();
      }
    }

    const embed = utils.createSuccessEmbed(
      amount === 1 ? 'Track Skipped' : `${amount} Tracks Skipped`,
      amount === 1 
        ? `**${currentTrack.title}** by ${currentTrack.author}`
        : `Skipped **${currentTrack.title}** and ${amount - 1} other track${amount - 1 === 1 ? '' : 's'}`,
      `Skipped by ${interaction.user.tag}`
    );

    embed.setThumbnail(currentTrack.thumbnail);
    
    if (amount === 1) {
      embed.addFields(
        { name: '🎵 Skipped Track', value: currentTrack.title, inline: true },
        { name: '👤 Artist', value: currentTrack.author, inline: true },
        { name: '⏱️ Duration', value: utils.formatDuration(currentTrack.durationMS), inline: true }
      );
    } else {
      embed.addFields(
        { name: '🎵 Last Skipped Track', value: currentTrack.title, inline: true },
        { name: '👤 Artist', value: currentTrack.author, inline: true },
        { name: '📊 Total Skipped', value: `${amount} tracks`, inline: true }
      );
    }

    // Show next track if available
    if (queue.currentTrack) {
      embed.addFields({
        name: '🎵 Now Playing',
        value: `**${queue.currentTrack.title}** by ${queue.currentTrack.author}`,
        inline: false
      });
    } else if (queue.tracks.count === 0) {
      embed.addFields({
        name: '📋 Queue Status',
        value: 'No more tracks in queue',
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};