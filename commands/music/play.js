const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play music from YouTube, Spotify, SoundCloud, and more!")
    .addStringOption(option =>
      option.setName("query")
        .setDescription("Song name, artist, or URL (YouTube, Spotify, SoundCloud, etc.)")
        .setRequired(true)
    ),
  async execute(interaction) {
    console.log(`[Play Command] Processing play command for: ${interaction.id}`);
    
    try {
      const query = interaction.options.getString("query");
      const voiceChannel = interaction.member?.voice?.channel;

      console.log(`[Play Command] Query: ${query}, Voice Channel: ${voiceChannel?.name || 'None'}`);

      if (!voiceChannel) {
        console.log(`[Play Command] No voice channel, sending error`);
        return await interaction.editReply({ 
          content: "⚠️ You need to join a voice channel first!"
        });
      }
      
      console.log(`[Play Command] Sending search message`);
      await interaction.editReply({ 
        content: "🔍 Searching for your music..." 
      });

      console.log(`[Play Command] Searching for: ${query}`);
      console.log(`[Play Command] Available extractors: ${interaction.client.player.extractors.size}`);
      
      // Search for track using traditional API
      const searchResult = await interaction.client.player.search(query, {
        requestedBy: interaction.user,
        searchEngine: 'youtube',
      });
      
      console.log(`[Play Command] Search result: ${searchResult ? searchResult.hasTracks() : 'null'}`);
      
      if (!searchResult || !searchResult.hasTracks()) {
        console.log(`[Play Command] No tracks found for query: ${query}`);
        return await interaction.editReply('❌ No tracks found. Please try a different search term or check if the URL is valid.');
      }
      
      const track = searchResult.tracks[0];
      console.log(`[Play Command] Found track: ${track.title} from ${track.source}`);

      // Create or get existing queue
      let queue = interaction.client.player.nodes.get(interaction.guild.id);
      
      if (!queue) {
        console.log(`[Play Command] Creating new queue`);
        queue = interaction.client.player.nodes.create(interaction.guild, {
          metadata: { channel: interaction.channel },
          leaveOnEnd: true,
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 30000,
          leaveOnStop: true,
          selfDeaf: false,
          selfMute: false,
          skipOnEmpty: true,
          skipOnEmptyCooldown: 30000,
          autoSelfDeaf: false,
          autoSelfMute: false,
          bufferingTimeout: 10000,
          connectionTimeout: 20000,
        });
      }

      // Connect to voice channel
      try {
        await queue.connect(voiceChannel);
        console.log(`[Play Command] Connected to voice channel successfully`);
      } catch (connectError) {
        console.error(`[Play Command] Failed to connect:`, connectError);
        queue.delete();
        return await interaction.editReply('❌ Could not join voice channel!');
      }

      // Add track to queue and start playing
      queue.addTrack(track);
      
      if (!queue.node.isPlaying()) {
        try {
          console.log(`[Play Command] Starting playback`);
          await queue.node.play();
          console.log(`[Play Command] Sending now playing message`);
          await interaction.editReply(`🎶 Now playing **${track.title}** by ${track.author || 'Unknown Artist'}`);
        } catch (playError) {
          console.error(`[Play Command] Playback failed:`, playError);
          await interaction.editReply(`❌ Failed to start playback: ${playError.message || 'Unknown error'}`);
        }
      } else {
        console.log(`[Play Command] Adding to queue`);
        await interaction.editReply(`🎵 **${track.title}** by ${track.author || 'Unknown Artist'} added to queue`);
      }
      
    } catch (err) {
      console.error('Play command error:', err);
      
      let errorMessage = '❌ Failed to play music. Please try again.';
      
      if (err.message && err.message.includes('Failed to connect')) {
        errorMessage = '❌ Failed to connect to voice channel. Please check permissions.';
      } else if (err.message && err.message.includes('No extractor')) {
        errorMessage = '❌ No audio extractor available for this source.';
      } else if (err.message && err.message.includes('FFmpeg')) {
        errorMessage = '❌ Audio processing error. Please try a different song.';
      } else if (err.message && err.message.includes('Could not extract stream')) {
        errorMessage = '❌ Could not extract audio stream. Try a different song or check if the source is available.';
      } else if (err.code === 'ERR_NO_RESULT') {
        errorMessage = '❌ Could not find a playable audio stream for this track. Try a different song.';
      }
      
      try {
        if (interaction.deferred) {
          await interaction.editReply(errorMessage);
        } else {
          await interaction.reply({ content: errorMessage, flags: 64 });
        }
      } catch (replyError) {
        console.error('Failed to send error message:', replyError);
      }
    }
  },
};