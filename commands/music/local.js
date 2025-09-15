const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const LocalMusicManager = require('../../modules/local-music');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('local')
    .setDescription('Browse and search local music files')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Search for specific songs or artists (optional)')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Number of results to show (1-20)')
        .setMinValue(1)
        .setMaxValue(20)
        .setRequired(false)
    ),
  
  async execute(interaction, client) {
    const query = interaction.options.getString('query');
    const limit = interaction.options.getInteger('limit') || 10;
    
    try {
      const localMusic = new LocalMusicManager();
      let results;
      
      if (query) {
        results = await localMusic.searchTracks(query);
      } else {
        results = await localMusic.getRandomTracks(limit);
      }
      
      if (results.length === 0) {
        return interaction.editReply({ 
          content: query ? 
            `❌ No local tracks found for "${query}"` : 
            '❌ No local music files found!'
        });
      }
      
      // Limit results
      results = results.slice(0, limit);
      
      // Create embed
      const embed = new EmbedBuilder()
        .setColor('#00bfff')
        .setTitle('🎵 Local Music Library')
        .setDescription(query ? 
          `Found ${results.length} local track(s) matching "${query}":` :
          `Random ${results.length} local track(s):`
        )
        .setTimestamp();
      
      // Add track list
      const trackList = results.map((track, index) => {
        const duration = track.duration === 'Unknown' ? '?' : track.duration;
        return `${index + 1}. **${track.title}** by ${track.author} (${duration})`;
      }).join('\n');
      
      embed.addFields({
        name: 'Tracks',
        value: trackList.length > 1024 ? 
          trackList.substring(0, 1020) + '...' : 
          trackList,
        inline: false
      });
      
      // Add usage info
      embed.addFields({
        name: 'How to Play',
        value: 'Use `/play <song name>` to play any of these tracks!',
        inline: false
      });
      
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Local command error:', error);
      await interaction.editReply({ 
        content: '❌ An error occurred while browsing local music!'
      });
    }
  },
};
