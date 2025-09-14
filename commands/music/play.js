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

      // Check if extractors are loaded
      if (!global.extractorsLoaded) {
        console.log(`[Play Command] Extractors not loaded yet, waiting...`);
        return await interaction.editReply({ 
          content: "⏳ Music system is still loading, please try again in a moment..."
        });
      }
      
      console.log(`[Play Command] Sending search message`);
      await interaction.editReply({ 
        content: "🔍 Searching for your music..." 
      });

      console.log(`[Play Command] Searching for: ${query}`);
      console.log(`[Play Command] Extractors registered successfully.`);
      
      // Use proper Discord Player v7 API
      try {
        // Search for the track
        const searchResult = await interaction.client.player.search(query, {
          requestedBy: interaction.user,
        });
        
        if (!searchResult || !searchResult.tracks || searchResult.tracks.length === 0) {
          console.log(`[Play Command] No tracks found for query: ${query}`);
          return await interaction.editReply('❌ No tracks found. Please try a different search term or check if the URL is valid.');
        }
        
        const track = searchResult.tracks[0];
        console.log(`[Play Command] Found track: ${track.title} by ${track.author}`);
        console.log(`[Play Command] Track duration: ${track.duration} (${track.durationMS}ms)`);
        console.log(`[Play Command] Track source: ${track.source}`);
        
        // Get or create queue
        let queue = interaction.client.player.nodes.get(interaction.guild.id);
        
        if (!queue) {
          console.log(`[Play Command] Creating new queue`);
          queue = interaction.client.player.nodes.create(interaction.guild, {
            metadata: { channel: interaction.channel },
            leaveOnEnd: false,
            leaveOnEmpty: false,
            leaveOnStop: false,
            skipOnEmpty: false,
          });
        }
        
        // Connect to voice channel if not already connected
        if (!queue.connection) {
          console.log(`[Play Command] Connecting to voice channel`);
          await queue.connect(voiceChannel);
        }
        
        // Add track to queue
        console.log(`[Play Command] Adding track to queue`);
        queue.addTrack(track);
        
        // Start playing if not already playing
        if (!queue.node.isPlaying()) {
          console.log(`[Play Command] Starting playback`);
          await queue.node.play();
        }
        
        console.log(`[Play Command] Successfully queued: ${track.title}`);
        console.log(`[Play Command] Queue size: ${queue.tracks.size}`);
        console.log(`[Play Command] Is playing: ${queue.node.isPlaying()}`);
        console.log(`[Play Command] Current track: ${queue.currentTrack?.title || 'None'}`);
        
        if (queue.tracks.size > 1) {
          await interaction.editReply(`🎵 **${track.title}** by ${track.author || 'Unknown Artist'} added to queue`);
        } else {
          await interaction.editReply(`🎶 Now playing **${track.title}** by ${track.author || 'Unknown Artist'}`);
        }
        
      } catch (playError) {
        console.error(`[Play Command] Playback failed:`, playError);
        await interaction.editReply(`❌ Failed to play music: ${playError.message || 'Unknown error'}`);
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