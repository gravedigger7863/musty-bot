const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play music from YouTube, Spotify, SoundCloud, and more!")
    .addStringOption(option =>
      option.setName("query")
        .setDescription("Song name, artist, or URL")
        .setRequired(true)
    ),

  async execute(interaction) {
    const query = interaction.options.getString("query");
    const voiceChannel = interaction.member?.voice?.channel;

    if (!voiceChannel) return interaction.editReply("⚠️ You need to join a voice channel first!");
    if (!interaction.client.player) return interaction.editReply("⏳ Music system not ready yet, try again later.");

    try {
      console.log(`[Play Command] Searching for: ${query}`);
      const searchResult = await interaction.client.player.search(query, { requestedBy: interaction.user });

      if (!searchResult || !searchResult.tracks.length) return interaction.editReply("❌ No tracks found.");

      const track = searchResult.tracks[0];
      console.log(`[Play Command] Found track: ${track.title} by ${track.author}`);

      // Get or create queue
      let queue = interaction.client.player.nodes.get(interaction.guild.id);
      if (!queue) {
        console.log(`[Play Command] Creating new queue`);
        queue = interaction.client.player.nodes.create(interaction.guild, {
          metadata: { channel: interaction.channel },
          selfDeaf: false,
          selfMute: false,
        });
      }

      // Connect to voice channel if not already connected
      if (!queue.connection) {
        console.log(`[Play Command] Connecting to voice channel: ${voiceChannel.name}`);
        console.log(`[Play Command] Voice channel ID: ${voiceChannel.id}`);
        console.log(`[Play Command] Guild ID: ${interaction.guild.id}`);
        
        try {
          await queue.connect(voiceChannel);
          console.log(`[Play Command] Connection initiated, checking state...`);
          
          // Wait for voice connection to be ready with better state checking
          let attempts = 0;
          const maxAttempts = 20; // 10 seconds max wait
          
          while (attempts < maxAttempts) {
            const connection = queue.connection;
            const voiceState = connection?.voice;
            
            console.log(`[Play Command] Attempt ${attempts + 1}/${maxAttempts} - Connection exists: ${!!connection}, Voice state: ${voiceState?.state || 'undefined'}`);
            
            if (connection && voiceState && voiceState.state === 'ready') {
              console.log(`[Play Command] ✅ Voice connection is ready after ${attempts * 0.5}s`);
              break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms between checks
            attempts++;
          }
          
          if (attempts >= maxAttempts) {
            console.log(`[Play Command] ❌ Voice connection timeout after ${maxAttempts * 0.5}s`);
            console.log(`[Play Command] Final state - Connection: ${!!queue.connection}, Voice: ${queue.connection?.voice?.state || 'undefined'}`);
            return interaction.editReply("❌ Failed to connect to voice channel. Please try again.");
          }
        } catch (connectError) {
          console.error(`[Play Command] Connection error:`, connectError);
          return interaction.editReply(`❌ Failed to connect to voice channel: ${connectError.message}`);
        }
      } else {
        console.log(`[Play Command] Already connected to voice channel`);
      }

      // Add track to queue
      queue.addTrack(track);
      console.log(`[Play Command] Track added, queue size: ${queue.tracks.size}`);

      // Play track if not already playing
      if (!queue.isPlaying()) {
        console.log(`[Play Command] About to start playback for: ${track.title}`);
        console.log(`[Play Command] Queue state - Is playing: ${queue.isPlaying()}, Current track: ${queue.currentTrack?.title || 'None'}`);
        console.log(`[Play Command] Voice connection state before play: ${queue.connection?.voice?.state || 'undefined'}`);
        
        try {
          await queue.node.play(track);
          console.log(`[Play Command] ✅ Playback command sent for: ${track.title}`);
          console.log(`[Play Command] Post-play state - Is playing: ${queue.isPlaying()}, Voice state: ${queue.connection?.voice?.state || 'undefined'}`);
          await interaction.editReply(`🎶 Starting playback...`);
        } catch (playError) {
          console.error(`[Play Command] Playback error:`, playError);
          return interaction.editReply(`❌ Failed to start playback: ${playError.message}`);
        }
      } else {
        console.log(`[Play Command] Queue is already playing, adding to queue instead`);
        await interaction.editReply(`🎵 **${track.title}** added to the queue (position ${queue.tracks.size})`);
      }
    } catch (err) {
      console.error(`[Play Command] Error:`, err);
      return interaction.editReply(`❌ Failed to play music: ${err.message || "Unknown error"}`);
    }
  },
};