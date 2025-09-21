const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const DopamineFeatures = require('../../modules/dopamine-features');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription('Get lyrics for the currently playing track (Dopamine-inspired)')
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
    const theme = interaction.options.getString('theme') || 'dark';
    
    try {
      await interaction.deferReply();

      const queue = interaction.client.player.nodes.get(interaction.guildId);
      
      if (!queue || !queue.currentTrack) {
        return interaction.editReply({
          content: '❌ No music is currently playing!'
        });
      }

      const track = queue.currentTrack;
      
      // Set theme if provided
      if (theme) {
        dopamine.setTheme(theme);
      }

      // Fetch lyrics
      const lyrics = await dopamine.fetchLyrics(track);
      
      // Create lyrics embed
      const embed = dopamine.createLyricsEmbed(track, lyrics, theme);
      
      return interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Lyrics command error:', error);
      return interaction.editReply({
        content: '❌ An error occurred while fetching lyrics.'
      });
    }
  },
};
