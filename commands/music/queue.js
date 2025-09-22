const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const CommandUtils = require('../../modules/command-utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current music queue')
    .addIntegerOption(option =>
      option
        .setName('page')
        .setDescription('Page number to view (1-10)')
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false)
    ),
  
  async execute(interaction, client) {
    const utils = new CommandUtils();
    const page = interaction.options.getInteger('page') || 1;
    const tracksPerPage = 10;
    
    // Check cooldown
    const cooldown = utils.isOnCooldown(interaction.user.id, 'queue');
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
    
    // Set cooldown
    utils.setCooldown(interaction.user.id, 'queue');

    const totalTracks = queue.tracks.count;
    const totalPages = Math.ceil(totalTracks / tracksPerPage);
    
    if (page > totalPages && totalTracks > 0) {
      return interaction.editReply({
        embeds: [utils.createErrorEmbed('Invalid Page', `Page ${page} doesn't exist. There are only ${totalPages} page${totalPages === 1 ? '' : 's'}.`)]
      });
    }

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('📜 Music Queue')
      .setTimestamp();

    // Add current track if playing
    if (queue.currentTrack) {
      const currentTrack = queue.currentTrack;
      const timestamp = queue.node.getTimestamp();
      const current = timestamp?.current?.value || 0;
      const total = currentTrack.durationMS || 0;
      
      let currentTrackInfo = `**${currentTrack.title}**\nby ${currentTrack.author}`;
      
      if (total > 0) {
        const progressBar = utils.createProgressBar(current, total, 15);
        const currentTime = utils.formatDuration(current);
        const totalTime = utils.formatDuration(total);
        currentTrackInfo += `\n${progressBar}\n${currentTime} / ${totalTime}`;
      }
      
      embed.addFields({
        name: '🎵 Now Playing',
        value: currentTrackInfo,
        inline: false
      });
    }

    // Add queue tracks
    if (totalTracks > 0) {
      const tracks = queue.tracks.toArray();
      const startIndex = (page - 1) * tracksPerPage;
      const endIndex = Math.min(startIndex + tracksPerPage, totalTracks);
      const pageTracks = tracks.slice(startIndex, endIndex);
      
      let queueList = '';
      pageTracks.forEach((track, index) => {
        const trackNumber = startIndex + index + 1;
        const duration = utils.formatDuration(track.durationMS);
        const source = utils.getSourceEmoji(track.source);
        queueList += `${trackNumber}. **${track.title}** - ${track.author}\n   ⏱️ ${duration} • ${source} ${track.source}\n`;
      });

      embed.addFields({
        name: `📋 Queue (${startIndex + 1}-${endIndex} of ${totalTracks})`,
        value: queueList || 'No tracks in queue',
        inline: false
      });

      // Add pagination info
      if (totalPages > 1) {
        embed.setFooter({ 
          text: `Page ${page} of ${totalPages} • Use /queue page:${page < totalPages ? page + 1 : page} to see more` 
        });
      }
    } else {
      embed.addFields({
        name: '📋 Queue',
        value: 'No tracks in queue',
        inline: false
      });
    }

    // Add queue statistics
    const queueStats = [];
    queueStats.push(`**Total Tracks:** ${totalTracks}`);
    queueStats.push(`**Volume:** ${queue.node.volume}%`);
    queueStats.push(`**Loop Mode:** ${queue.repeatMode === 1 ? '🔁 On' : '❌ Off'}`);
    queueStats.push(`**Autoplay:** ${queue.node.isAutoplay ? '▶️ On' : '❌ Off'}`);

    embed.addFields({
      name: '📊 Queue Statistics',
      value: queueStats.join(' • '),
      inline: false
    });

    await interaction.editReply({ embeds: [embed] });
  },
};
