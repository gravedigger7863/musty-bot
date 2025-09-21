const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const DopamineFeatures = require('../../modules/dopamine-features');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('library')
    .setDescription('View your music library (Dopamine-inspired organization)')
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Type of library content to view')
        .setRequired(false)
        .addChoices(
          { name: 'Recent', value: 'recent' },
          { name: 'Favorites', value: 'favorites' },
          { name: 'Artists', value: 'artists' },
          { name: 'Genres', value: 'genres' }
        )
    )
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

  async execute(interaction) {
    const dopamine = new DopamineFeatures();
    const type = interaction.options.getString('type') || 'recent';
    const theme = interaction.options.getString('theme') || 'dark';
    
    try {
      await interaction.deferReply();

      // Set theme if provided
      if (theme) {
        dopamine.setTheme(theme);
      }

      // Create library embed
      const embed = dopamine.createLibraryEmbed(interaction.guildId, type, theme);
      
      // Add statistics if viewing recent
      if (type === 'recent') {
        const stats = dopamine.getStatistics(interaction.guildId);
        if (stats) {
          embed.addFields({
            name: '📊 Statistics',
            value: `**Tracks:** ${stats.totalTracks}\n**Artists:** ${stats.uniqueArtists}\n**Total Play Time:** ${stats.totalPlayTime}`,
            inline: true
          });
        }
      }

      return interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Library command error:', error);
      return interaction.editReply({
        content: '❌ An error occurred while retrieving your library.'
      });
    }
  },
};
