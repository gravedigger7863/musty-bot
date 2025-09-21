const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const PlayifyFeatures = require('../../modules/playify-features');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current music queue'),
  
  async execute(interaction, client) {
    const playify = new PlayifyFeatures();
    const queue = client.player.nodes.get(interaction.guild.id);
    
    if (!queue || !queue.tracks.count) {
      return interaction.editReply({ 
        content: '❌ There are no tracks in the queue!'
      });
    }
    
    const currentTrack = queue.currentTrack;
    
    // Use Playify's enhanced queue embed
    const embed = playify.createQueueEmbed(queue);
    
    // Add current track if playing
    if (currentTrack) {
      embed.addFields({
        name: '🎶 Now Playing',
        value: `**${currentTrack.title}** by ${currentTrack.author}\nDuration: ${currentTrack.duration}`,
        inline: false
      });
    }
    
    // Add queue info
    embed.addFields(
      { name: 'Total Tracks', value: `${queue.tracks.count}`, inline: true },
      { name: 'Volume', value: `${queue.node.volume}%`, inline: true },
      { name: 'Loop Mode', value: queue.repeatMode === 1 ? '🔁 On' : '❌ Off', inline: true }
    );
    
    await interaction.editReply({ embeds: [embed] });
  },
  
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else {
      return `${minutes}m ${seconds % 60}s`;
    }
  },
};
