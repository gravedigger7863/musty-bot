const { SlashCommandBuilder } = require('discord.js');
const CommandUtils = require('../../modules/command-utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set the music volume (0-100)')
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Volume level (0-100)')
        .setMinValue(0)
        .setMaxValue(100)
        .setRequired(true)
    ),
    
  async execute(interaction, client) {
    const utils = new CommandUtils();
    const amount = interaction.options.getInteger('amount');
    
    // Check cooldown
    const cooldown = utils.isOnCooldown(interaction.user.id, 'volume');
    if (cooldown) {
      return interaction.editReply({
        embeds: [utils.createErrorEmbed('Cooldown', `Please wait ${cooldown} seconds before using this command again.`)]
      });
    }

    // Validate volume
    const volumeValidation = utils.validateVolume(amount);
    if (!volumeValidation.valid) {
      return interaction.editReply({
        embeds: [utils.createErrorEmbed('Invalid Volume', volumeValidation.error)]
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
    const oldVolume = queue.node.volume;
    
    // Set cooldown
    utils.setCooldown(interaction.user.id, 'volume');

    // Set new volume
    queue.node.setVolume(amount);

    const embed = utils.createSuccessEmbed(
      'Volume Changed',
      `Volume changed from **${oldVolume}%** to **${amount}%**`,
      `Volume changed by ${interaction.user.tag}`
    );

    embed.setThumbnail(queue.currentTrack.thumbnail);
    embed.addFields(
      { name: '🎵 Current Track', value: queue.currentTrack.title, inline: true },
      { name: '👤 Artist', value: queue.currentTrack.author, inline: true },
      { name: '🔊 New Volume', value: `${amount}%`, inline: true }
    );

    // Add volume bar visualization
    const volumeBar = utils.createProgressBar(amount, 100, 20);
    embed.addFields({
      name: '📊 Volume Level',
      value: `${volumeBar} ${amount}%`,
      inline: false
    });

    // Add volume level description
    let volumeDescription = '';
    if (amount === 0) volumeDescription = '🔇 Muted';
    else if (amount <= 20) volumeDescription = '🔈 Very Quiet';
    else if (amount <= 40) volumeDescription = '🔉 Quiet';
    else if (amount <= 60) volumeDescription = '🔊 Normal';
    else if (amount <= 80) volumeDescription = '📢 Loud';
    else volumeDescription = '📣 Very Loud';

    embed.addFields({
      name: '📝 Volume Level',
      value: volumeDescription,
      inline: true
    });

    return interaction.editReply({ embeds: [embed] });
  },
};