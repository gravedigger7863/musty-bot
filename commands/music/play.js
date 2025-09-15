const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const LocalMusicManager = require('../../modules/local-music');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song from local files, YouTube, SoundCloud, or Spotify')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Song name, artist, or URL to play')
        .setRequired(true)
    ),
  
  async execute(interaction, client) {
    const query = interaction.options.getString('query');
    
    // Check if user is in a voice channel
    if (!interaction.member.voice.channel) {
      return interaction.editReply({ 
        content: '❌ You need to be in a voice channel to use this command!'
      });
    }
    
    // Check if bot has permission to join and speak
    const permissions = interaction.member.voice.channel.permissionsFor(interaction.guild.members.me);
    if (!permissions.has(['Connect', 'Speak'])) {
      return interaction.editReply({ 
        content: '❌ I need Connect and Speak permissions to join your voice channel!'
      });
    }
    
    // Interaction is already deferred by interactionCreate event
    
    try {
      // Get or create queue
      const queue = client.player.nodes.create(interaction.guild, {
        metadata: {
          channel: interaction.channel,
          client: interaction.guild.members.me,
          requestedBy: interaction.user
        },
        selfDeaf: true,
        volume: 80,
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 300000,
        leaveOnEnd: true,
        leaveOnEndCooldown: 300000,
      });
      
      // Connect to voice channel
      if (!queue.connection) {
        await queue.connect(interaction.member.voice.channel);
      }
      
      let track;
      let isLocalFile = false;
      
      // First, try to find local files
      const localMusic = new LocalMusicManager();
      const localResults = await localMusic.searchTracks(query);
      
      if (localResults.length > 0) {
        // Use local file - create a track object that Discord Player can handle
        const localTrack = localResults[0];
        track = {
          title: localTrack.title,
          author: localTrack.author,
          duration: localTrack.duration,
          source: 'local',
          url: `file://${localTrack.url}`,
          thumbnail: localTrack.thumbnail,
          requestedBy: interaction.user,
          // Add required properties for Discord Player
          id: `local_${Date.now()}`,
          stream: null,
          live: false,
          raw: {
            title: localTrack.title,
            author: localTrack.author,
            duration: localTrack.duration,
            url: `file://${localTrack.url}`
          }
        };
        isLocalFile = true;
        console.log(`🎵 Playing local file: ${localTrack.title}`);
      } else {
        // Fall back to online search
        const searchResult = await client.player.search(query, {
          requestedBy: interaction.user,
          searchEngine: 'auto'
        });
        
        if (!searchResult.hasTracks()) {
          return interaction.editReply({ 
            content: '❌ No tracks found for your query!' 
          });
        }
        
        track = searchResult.tracks[0];
      }
      
      // Add track to queue
      queue.addTrack(track);
      
      // Create embed
      const embed = new EmbedBuilder()
        .setColor(isLocalFile ? '#00bfff' : '#00ff00')
        .setTitle(isLocalFile ? '🎵 Local Track Added' : '🎵 Track Added')
        .setDescription(`**${track.title}** by ${track.author}`)
        .setThumbnail(track.thumbnail)
        .addFields(
          { name: 'Duration', value: track.duration, inline: true },
          { name: 'Source', value: track.source, inline: true },
          { name: 'Position in Queue', value: `${queue.tracks.size}`, inline: true }
        )
        .setFooter({ text: `Requested by ${interaction.user.tag}` })
        .setTimestamp();
      
      // Start playing if not already playing
      if (!queue.isPlaying()) {
        await queue.node.play();
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
