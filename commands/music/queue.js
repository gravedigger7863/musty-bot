const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current music queue'),
  
  async execute(interaction, client) {
    const player = client.manager.players.get(interaction.guild.id);
    
    if (!player || !player.queue.length) {
      return interaction.reply({ 
        content: '❌ There are no tracks in the queue!', 
        ephemeral: true 
      });
    }
    
    const queue = player.queue;
    const currentTrack = player.queue.current;
    
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
    const upcomingTracks = queue.slice(0, 10);
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
      { name: 'Total Tracks', value: `${queue.length}`, inline: true },
      { name: 'Queue Duration', value: this.formatDuration(queue.duration), inline: true },
      { name: 'Loop Mode', value: player.queueRepeat ? '🔁 On' : '❌ Off', inline: true }
    );
    
    await interaction.reply({ embeds: [embed] });
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
