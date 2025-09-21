const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const PlayifyFeatures = require('../../modules/playify-features');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('filter')
    .setDescription('Apply audio filters to the current track')
    .addStringOption(option =>
      option
        .setName('filter')
        .setDescription('Choose an audio filter')
        .setRequired(true)
        .addChoices(
          { name: 'Slowed', value: 'slowed' },
          { name: 'Nightcore', value: 'nightcore' },
          { name: 'Reverb', value: 'reverb' },
          { name: 'Bass Boost', value: 'bassboost' },
          { name: 'Vaporwave', value: 'vaporwave' },
          { name: 'Chipmunk', value: 'chipmunk' },
          { name: 'Deep', value: 'deep' },
          { name: 'None (Remove filters)', value: 'none' }
        )
    ),

  async execute(interaction) {
    const playify = new PlayifyFeatures();
    const filter = interaction.options.getString('filter');
    
    try {
      await interaction.deferReply();

      const queue = interaction.client.player.nodes.get(interaction.guildId);
      
      if (!queue || !queue.isPlaying()) {
        return interaction.editReply({
          content: '❌ No music is currently playing!'
        });
      }

      if (filter === 'none') {
        // Remove all filters
        if (queue.node.filters) {
          queue.node.filters.clear();
        }
        
        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('🎛️ Filters Removed')
          .setDescription('All audio filters have been removed from the current track.')
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // Apply the selected filter
      try {
        playify.applyFilter(queue, filter);
        
        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('🎛️ Filter Applied')
          .setDescription(`Applied **${filter}** filter to the current track.`)
          .addFields(
            { name: 'Current Track', value: queue.currentTrack.title, inline: true },
            { name: 'Filter', value: filter, inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
        
      } catch (error) {
        return interaction.editReply({
          content: `❌ Error applying filter: ${error.message}`
        });
      }

    } catch (error) {
      console.error('Filter command error:', error);
      return interaction.editReply({
        content: '❌ An error occurred while applying the filter.'
      });
    }
  },
};
