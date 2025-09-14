const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song from YouTube, SoundCloud, or Spotify')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Song name, artist, or URL to play')
        .setRequired(true)
    ),
  
  async execute(interaction, client) {
    const query = interaction.options.getString('query');
    
    // Check if user is in a voice channel
    if (!interaction.member.voice.channel) {
      return interaction.reply({ 
        content: '❌ You need to be in a voice channel to use this command!', 
        ephemeral: true 
      });
    }
    
    // Check if bot has permission to join and speak
    const permissions = interaction.member.voice.channel.permissionsFor(interaction.guild.members.me);
    if (!permissions.has(['Connect', 'Speak'])) {
      return interaction.reply({ 
        content: '❌ I need Connect and Speak permissions to join your voice channel!', 
        ephemeral: true 
      });
    }
    
    await interaction.deferReply();
    
    try {
      // Get or create player
      const player = client.manager.players.get(interaction.guild.id) || 
        client.manager.create({
          guild: interaction.guild.id,
          voiceChannel: interaction.member.voice.channel.id,
          textChannel: interaction.channel.id,
        });
      
      // Search for tracks
      const searchResult = await client.manager.search(query, interaction.user);
      
      if (!searchResult.tracks.length) {
        return interaction.editReply({ 
          content: '❌ No tracks found for your query!' 
        });
      }
      
      const track = searchResult.tracks[0];
      
      // Add track to queue
      player.queue.add(track);
      
      // Create embed
      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🎵 Track Added')
        .setDescription(`**${track.title}** by ${track.author}`)
        .setThumbnail(track.thumbnail)
        .addFields(
          { name: 'Duration', value: track.duration, inline: true },
          { name: 'Source', value: track.source, inline: true },
          { name: 'Position in Queue', value: `${player.queue.size}`, inline: true }
        )
        .setFooter({ text: `Requested by ${interaction.user.tag}` })
        .setTimestamp();
      
      // Start playing if not already playing
      if (!player.playing && !player.paused) {
        player.play();
      }
      
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Play command error:', error);
      await interaction.editReply({ 
        content: '❌ An error occurred while trying to play the track!' 
      });
    }
  },
};
