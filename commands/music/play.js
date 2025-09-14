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
      
      // Use the v7 API to play music
      try {
        const result = await interaction.client.player.play(voiceChannel, query, {
          nodeOptions: {
            metadata: { channel: interaction.channel }
          }
        });

        console.log(`[Play Command] Successfully queued: ${result.track.title}`);
        console.log(`[Play Command] Track duration: ${result.track.duration} (${typeof result.track.duration})`);
        console.log(`[Play Command] Track durationMS: ${result.track.durationMS}`);
        console.log(`[Play Command] Track source: ${result.track.source}`);
        console.log(`[Play Command] Track raw data:`, {
          title: result.track.title,
          duration: result.track.duration,
          durationMS: result.track.durationMS,
          source: result.track.source,
          url: result.track.url
        });
        
        // Check queue status after adding track
        const queue = interaction.client.player.nodes.get(interaction.guild.id);
        if (queue) {
          console.log(`[Play Command] Queue exists: true`);
          console.log(`[Play Command] Queue size: ${queue.tracks.size}`);
          console.log(`[Play Command] Is playing: ${queue.node.isPlaying()}`);
          console.log(`[Play Command] Current track: ${queue.currentTrack?.title || 'None'}`);
        } else {
          console.log(`[Play Command] Queue exists: false`);
        }
        
        if (result.track) {
          await interaction.editReply(`🎶 Now playing **${result.track.title}** by ${result.track.author || 'Unknown Artist'}`);
        } else {
          await interaction.editReply(`🎵 **${result.track.title}** by ${result.track.author || 'Unknown Artist'} added to queue`);
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