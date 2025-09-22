const { SlashCommandBuilder } = require('discord.js');
const CommandUtils = require('../../modules/command-utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Toggle pause/resume playback'),
    
  async execute(interaction, client) {
    const utils = new CommandUtils();
    
    // Check cooldown
    const cooldown = utils.isOnCooldown(interaction.user.id, 'pause');
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
    const isPaused = queue.node.isPaused();
    queue.node.setPaused(!isPaused);

    // Set cooldown
    utils.setCooldown(interaction.user.id, 'pause');
    
    const embed = utils.createSuccessEmbed(
      isPaused ? 'Resumed Playback' : 'Paused Playback',
      `**${queue.currentTrack.title}** by ${queue.currentTrack.author}`,
      `Track ${isPaused ? 'resumed' : 'paused'} by ${interaction.user.tag}`
    );

    embed.setThumbnail(queue.currentTrack.thumbnail);
    embed.addFields(
      { name: '🎵 Track', value: queue.currentTrack.title, inline: true },
      { name: '👤 Artist', value: queue.currentTrack.author, inline: true },
      { name: '⏱️ Duration', value: utils.formatDuration(queue.currentTrack.durationMS), inline: true }
    );

    return interaction.editReply({ embeds: [embed] });
  },
};
