const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current music queue'),
  
  async execute(interaction, client) {
    const queue = client.player.nodes.get(interaction.guild.id);
    
    if (!queue || !queue.tracks.size) {
      return interaction.editReply({ 
        content: '❌ There are no tracks in the queue!'
      });
    }
    
    const currentTrack = queue.currentTrack;
    
    // Create embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('🎵 Music Queue')
      .setTimestamp();
    
    // Add current track
    if (currentTrack) {
      embed.addFields({
        name: '🎶 Now Playing',
        value: `**${currentTrack.title}** by ${currentTrack.author}\nDuration: ${currentTrack.duration}`,
        inline: false
      });
    }
    
    // Add upcoming tracks (limit to 10)
    const upcomingTracks = queue.tracks.toArray().slice(0, 10);
    if (upcomingTracks.length > 0) {
      const trackList = upcomingTracks.map((track, index) => 
        `**${index + 1}.** ${track.title} by ${track.author} (${track.duration})`
      ).join('\n');
      
      embed.addFields({
        name: '📋 Upcoming Tracks',
        value: trackList,
        inline: false
      });
    }
    
    // Add queue info
    embed.addFields(
      { name: 'Total Tracks', value: `${queue.tracks.size}`, inline: true },
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
