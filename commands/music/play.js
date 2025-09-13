const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play music from multiple sources with automatic fallback")
    .addStringOption(option =>
      option.setName("query")
        .setDescription("Song name, YouTube URL, or direct audio file URL (.mp3, .ogg, .wav, .m4a)")
        .setRequired(true)
    ),
  async execute(interaction) {
    console.log(`[Play Command] Starting play command for query: ${interaction.options.getString("query")}`);
    
    const query = interaction.options.getString("query");
    const voiceChannel = interaction.member?.voice?.channel;

    if (!voiceChannel) {
      return await interaction.editReply({ 
        content: "⚠️ You need to join a voice channel first!"
      });
    }

    try {
      // Send initial processing message
      await interaction.editReply({ 
        content: "🔍 Searching for your music..." 
      });
      // Get or create the queue
      console.log(`[Play Command] Getting or creating queue for guild: ${interaction.guild.id}`);
      const queue = interaction.client.player.nodes.get(interaction.guild.id) || 
        interaction.client.player.nodes.create(interaction.guild, {
        metadata: { channel: interaction.channel },
        leaveOnEnd: false,
        leaveOnEmpty: false,
        leaveOnEmptyCooldown: 300000
      });

      // Connect to voice channel if not already connected
      if (!queue.connection) {
        console.log(`[Play Command] Connecting to voice channel: ${voiceChannel.name}`);
        await queue.connect(voiceChannel, {
          selfDeaf: false,
          selfMute: false
        });
        console.log(`[Play Command] Connected to voice channel successfully`);
      } else {
        console.log(`[Play Command] Already connected to voice channel`);
      }

      // Search and play the track using Discord Player's built-in search
      console.log(`[Play Command] Searching for: ${query}`);
      const searchResult = await interaction.client.player.search(query, {
        requestedBy: interaction.user,
        searchEngine: 'auto'
      });

      console.log(`[Play Command] Search result: ${searchResult.hasTracks() ? 'Found tracks' : 'No tracks found'}`);
      if (searchResult.hasTracks()) {
        console.log(`[Play Command] First track: ${searchResult.tracks[0].title}`);
      }

      if (!searchResult.hasTracks()) {
        return await interaction.editReply('❌ No results found for your search query.');
      }

      // Add the track to the queue
      console.log(`[Play Command] Adding track to queue: ${searchResult.tracks[0].title}`);
      queue.addTrack(searchResult.tracks[0]);

      // Start playing if nothing is currently playing
      if (!queue.isPlaying()) {
        console.log(`[Play Command] Starting playback`);
        await queue.node.play();
        console.log(`[Play Command] Playback started`);
      } else {
        console.log(`[Play Command] Already playing, track added to queue`);
      }

      // Send success message
      await interaction.editReply(`🎶 Now playing **${searchResult.tracks[0].title}**`);
    } catch (err) {
      console.error('Play command error:', err);
      
      let errorMessage = '❌ Failed to play music. Please try again.';
      
      if (err.message && err.message.includes('Failed to connect')) {
        errorMessage = '❌ Failed to connect to voice channel. Please check permissions.';
      }
      
      await interaction.editReply(errorMessage);
    }
  },
};
