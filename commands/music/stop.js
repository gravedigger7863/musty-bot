const { SlashCommandBuilder } = require("discord.js");
const CommandUtils = require('../../modules/command-utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop the music and clear the queue")
    .addBooleanOption(option =>
      option
        .setName('confirm')
        .setDescription('Confirm that you want to stop the music')
        .setRequired(false)
    ),
    
  async execute(interaction, client) {
    const utils = new CommandUtils();
    const confirm = interaction.options.getBoolean('confirm');
    
    // Check cooldown
    const cooldown = utils.isOnCooldown(interaction.user.id, 'stop');
    if (cooldown) {
      return interaction.editReply({
        embeds: [utils.createErrorEmbed('Cooldown', `Please wait ${cooldown} seconds before using this command again.`)]
      });
    }

    // Validate queue
    const queueValidation = utils.validateQueue(interaction);
    if (!queueValidation.valid) {
      return interaction.editReply({
        embeds: [utils.createErrorEmbed('Queue Required', queueValidation.error)]
      });
    }

    const queue = queueValidation.queue;
    
    // If no confirmation and there are tracks, ask for confirmation
    if (!confirm && queue.tracks.count > 0) {
      const embed = utils.createInfoEmbed(
        'Stop Music Confirmation',
        `Are you sure you want to stop the music and clear **${queue.tracks.count + 1}** track${queue.tracks.count === 0 ? '' : 's'} from the queue?\n\nUse \`/stop confirm:true\` to confirm.`,
        '#ffaa00',
        'This action cannot be undone'
      );

      if (queue.currentTrack) {
        embed.addFields({
          name: '🎵 Currently Playing',
          value: `**${queue.currentTrack.title}** by ${queue.currentTrack.author}`,
          inline: false
        });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    // Set cooldown
    utils.setCooldown(interaction.user.id, 'stop');

    const currentTrack = queue.currentTrack;
    const queueCount = queue.tracks.count;
    
    // Stop and clear the queue
    queue.delete();

    const embed = utils.createSuccessEmbed(
      'Music Stopped',
      `Stopped the music and cleared the queue`,
      `Music stopped by ${interaction.user.tag}`
    );

    if (currentTrack) {
      embed.addFields({
        name: '🎵 Last Track',
        value: `**${currentTrack.title}** by ${currentTrack.author}`,
        inline: true
      });
    }

    embed.addFields({
      name: '📊 Cleared',
      value: `${queueCount + 1} track${queueCount === 0 ? '' : 's'} removed from queue`,
      inline: true
    });

    embed.addFields({
      name: '🔊 Status',
      value: 'Music stopped and bot left voice channel',
      inline: true
    });

    await interaction.editReply({ embeds: [embed] });
  },
};