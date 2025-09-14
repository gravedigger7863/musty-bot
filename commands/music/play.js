const { SlashCommandBuilder } = require("discord.js");
const { useMainPlayer } = require("discord-player");

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
      
      // Use the modern Discord Player v7 approach
      const player = useMainPlayer();
      const searchResult = await player.search(query, { requestedBy: interaction.user });

      if (!searchResult || !searchResult.tracks.length) return interaction.editReply("❌ No tracks found.");

      const track = searchResult.tracks[0];
      console.log(`[Play Command] Found track: ${track.title} by ${track.author}`);

      // Get or create queue using the modern approach
      let queue = player.nodes.get(interaction.guild.id);
      if (!queue) {
        console.log(`[Play Command] Creating new queue`);
        queue = player.nodes.create(interaction.guild, {
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
          console.log(`[Play Command] ✅ Connection initiated successfully`);
          
          // Wait for voice connection to be ready with proper state monitoring
          let connectionReady = false;
          let attempts = 0;
          const maxAttempts = 20; // 10 seconds total
          
          while (!connectionReady && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
            
            const voiceState = queue.connection?.voice;
            if (voiceState) {
              console.log(`[Play Command] Voice connection state - Attempt ${attempts}/${maxAttempts}: ${voiceState.state}`);
              if (voiceState.state === 'ready') {
                connectionReady = true;
                console.log(`[Play Command] ✅ Voice connection is ready after ${attempts * 500}ms`);
                break;
              }
            } else {
              console.log(`[Play Command] Voice connection state - Attempt ${attempts}/${maxAttempts}: undefined (intent issue?)`);
            }
          }
          
          if (!connectionReady) {
            console.log(`[Play Command] ❌ Voice connection not ready after 10s - this will cause playback issues`);
            console.log(`[Play Command] Check: 1) GUILD_VOICE_STATES intent enabled, 2) Bot has Connect+Speak permissions`);
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
        
        // Check if voice connection is ready before attempting playback
        const voiceState = queue.connection?.voice;
        if (!voiceState || voiceState.state !== 'ready') {
          console.log(`[Play Command] ❌ Voice connection not ready (${voiceState?.state || 'undefined'}), cannot start playback`);
          return interaction.editReply(`❌ Voice connection not ready. Please check bot permissions and try again.`);
        }
        
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