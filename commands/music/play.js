const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { useMainPlayer } = require("discord-player");
const { entersState, VoiceConnectionStatus } = require("@discordjs/voice");

// Track recent track additions to prevent spam
const recentTracks = new Map();

// Global lock to prevent multiple play commands from executing simultaneously
const playCommandLocks = new Map();

// Helper function for consistent replies
const replyToUser = async (interaction, message, ephemeral = false) => {
  try {
    return await interaction.editReply({ content: message, flags: ephemeral ? 64 : 0 });
  } catch (error) {
    console.error(`[Play Command] Failed to reply: ${error.message}`);
  }
};

// Helper function to create rich track embeds
const createTrackEmbed = (track, action = "playing") => {
  const embed = new EmbedBuilder()
    .setColor(0x1DB954)
    .setTitle(`🎵 ${action === "playing" ? "Now Playing" : "Added to Queue"}`)
    .setDescription(`**${track.title}** by ${track.author}`)
    .setThumbnail(track.thumbnail || null)
    .setFooter({ text: `Duration: ${track.duration}` });

  if (track.url) {
    embed.setURL(track.url);
  }

  return embed;
};

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
    const guildId = interaction.guild.id;
    const interactionId = interaction.id;

    // Defer immediately to avoid Discord retries
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply().catch(() => {});
    }

    // Prevent duplicate execution for the same interaction
    if (playCommandLocks.has(interactionId)) {
      return replyToUser(interaction, "⏳ Command is already being processed...", true);
    }
    playCommandLocks.set(interactionId, true);

    // Check if another play command is running for this guild
    if (playCommandLocks.has(guildId) && playCommandLocks.get(guildId) !== interactionId) {
      return replyToUser(interaction, "⏳ Another play command is already running, please wait...", true);
    }
    playCommandLocks.set(guildId, interactionId);

    try {
      const query = interaction.options.getString("query");
      const voiceChannel = interaction.member?.voice?.channel;
      if (!voiceChannel) return replyToUser(interaction, "⚠️ You need to join a voice channel first!");

      const player = useMainPlayer();
      if (!player) return replyToUser(interaction, "⏳ Music system not ready yet, try again later.");

      const botMember = interaction.guild.members.me;
      const permissions = voiceChannel.permissionsFor(botMember);
      if (!permissions.has(['Connect', 'Speak'])) {
        return replyToUser(interaction, "❌ I don't have permission to connect or speak in this voice channel!");
      }

      await replyToUser(interaction, "⏳ Searching for your music...");

      // Duplicate track spam prevention
      const trackKey = `${guildId}-${query}`;
      const now = Date.now();
      const lastAdded = recentTracks.get(trackKey);
      if (lastAdded && now - lastAdded < 5000) {
        return replyToUser(interaction, "⏳ Please wait a moment before adding the same track again!");
      }
      recentTracks.set(trackKey, now);
      for (const [key, timestamp] of recentTracks.entries()) {
        if (now - timestamp > 30000) recentTracks.delete(key);
      }

      const searchResult = await player.search(query, { requestedBy: interaction.user });
      if (!searchResult || !searchResult.tracks.length) return replyToUser(interaction, "❌ No tracks found.");

      // Validate search result and log details
      console.log(`[Play Command] Search completed for: ${query}`);
      console.log(`[Play Command] Found ${searchResult.tracks.length} tracks`);
      console.log(`[Play Command] Playlist: ${searchResult.playlist ? searchResult.playlist.title : 'None'}`);
      
      // Log first track details for debugging
      const firstTrack = searchResult.tracks[0];
      if (firstTrack) {
        console.log(`[Play Command] First track: ${firstTrack.title}`);
        console.log(`[Play Command] Track source: ${firstTrack.source}`);
        console.log(`[Play Command] Track duration: ${firstTrack.duration} (${firstTrack.durationMS}ms)`);
        console.log(`[Play Command] Track URL: ${firstTrack.url}`);
        console.log(`[Play Command] Track format: ${firstTrack.raw?.format || 'Unknown'}`);
        console.log(`[Play Command] Track quality: ${firstTrack.raw?.quality || 'Unknown'}`);
        
        // Validate track has proper duration
        if (!firstTrack.durationMS || firstTrack.durationMS <= 0) {
          console.log(`[Play Command] ⚠️ WARNING: Track has invalid duration - this may cause immediate finishing`);
          return replyToUser(interaction, "❌ Track has invalid duration. Try a different source.");
        }
      }

      let queue = player.nodes.get(guildId);
      if (!queue) {
        queue = player.nodes.create(voiceChannel, {
          metadata: { channel: interaction.channel },
          leaveOnEnd: true,
          leaveOnEmpty: true,
          leaveOnStop: true,
          selfDeaf: false,
          selfMute: false,
          // Additional configuration to prevent immediate track finishing
          bufferingTimeout: 30000,
          connectionTimeout: 30000,
          // Ensure proper audio streaming
          volume: 50,
          // Disable autoplay initially to prevent issues
          autoplay: false
        });
      }

      if (!queue.connection) {
        console.log(`[Play Command] Connecting to voice channel: ${voiceChannel.name}`);
        
        try {
          // Connect to voice channel
          await queue.connect(voiceChannel);
          console.log(`[Play Command] Voice connection initiated`);
          
          // Wait for connection to be ready with retry logic
          await entersState(queue.connection, VoiceConnectionStatus.Ready, 30_000);
          console.log(`[Play Command] ✅ Voice connection established successfully`);
          
          // Additional verification that connection is working
          if (queue.connection && queue.connection.state === VoiceConnectionStatus.Ready) {
            console.log(`[Play Command] ✅ Voice connection verified as Ready`);
          } else {
            console.log(`[Play Command] ⚠️ Voice connection state: ${queue.connection?.state?.status || 'Unknown'}`);
          }
          
        } catch (error) {
          console.error(`[Play Command] ❌ Voice connection failed:`, error.message);
          console.error(`[Play Command] Full error:`, error);
          queue.delete();
          return replyToUser(interaction, "❌ Could not establish voice connection! Please try again.");
        }
      } else {
        console.log(`[Play Command] Using existing voice connection`);
        console.log(`[Play Command] Connection state: ${queue.connection?.state?.status || 'Unknown'}`);
        
        // Check if existing connection is still ready
        if (queue.connection && queue.connection.state !== VoiceConnectionStatus.Ready) {
          console.log(`[Play Command] ⚠️ Existing connection not ready, waiting for it to be ready...`);
          try {
            await entersState(queue.connection, VoiceConnectionStatus.Ready, 10_000);
            console.log(`[Play Command] ✅ Existing voice connection is now ready`);
          } catch (error) {
            console.error(`[Play Command] ❌ Existing voice connection failed to become ready:`, error.message);
            // Try to reconnect
            console.log(`[Play Command] Attempting to reconnect...`);
            try {
              await queue.connect(voiceChannel);
              await entersState(queue.connection, VoiceConnectionStatus.Ready, 30_000);
              console.log(`[Play Command] ✅ Reconnected successfully`);
            } catch (reconnectError) {
              console.error(`[Play Command] ❌ Reconnection failed:`, reconnectError.message);
              queue.delete();
              return replyToUser(interaction, "❌ Voice connection lost. Please try again.");
            }
          }
        }
      }

      if (searchResult.playlist) {
        const validTracks = searchResult.tracks.filter(t => t.url && t.durationMS > 0).slice(0, 100);
        console.log(`[Play Command] Adding ${validTracks.length} valid tracks from playlist`);
        
        if (validTracks.length === 0) {
          return replyToUser(interaction, "❌ No valid tracks found in playlist. Try a different source.");
        }
        
        queue.addTrack(validTracks);
        if (!queue.node.isPlaying()) {
          console.log(`[Play Command] Starting playback of playlist`);
          
          // Ensure voice connection is ready before playing playlist
          const connectionState = queue.connection?.state?.status || queue.connection?.state;
          if (queue.connection && (connectionState === VoiceConnectionStatus.Ready || connectionState === 'ready')) {
            console.log(`[Play Command] Voice connection is ready, starting playlist playback`);
            try {
              await queue.node.play();
              console.log(`[Play Command] Playlist playback started successfully`);
            } catch (playError) {
              console.error(`[Play Command] ❌ Playlist playback failed:`, playError.message);
              return replyToUser(interaction, "❌ Failed to start playlist playback. Please try again.");
            }
          } else {
            console.log(`[Play Command] ⚠️ Voice connection not ready for playlist, state: ${connectionState || 'Unknown'}`);
            return replyToUser(interaction, "❌ Voice connection not ready. Please try again.");
          }
        }
        return replyToUser(interaction, `🎵 Added **${validTracks.length} tracks** from **${searchResult.playlist.title}** to the queue!`);
      } else {
        const track = searchResult.tracks[0];
        if (!track.url) return replyToUser(interaction, "❌ Track has no playable URL. Try a different source.");
        if (!track.durationMS || track.durationMS <= 0) {
          return replyToUser(interaction, "❌ Track has invalid duration. Try a different source.");
        }
        if (queue.tracks.find(t => t.title === track.title && t.author === track.author)) {
          return replyToUser(interaction, `🎵 **${track.title}** is already in the queue!`);
        }

        console.log(`[Play Command] Adding single track: ${track.title}`);
        queue.addTrack(track);
        
        if (!queue.node.isPlaying()) {
          console.log(`[Play Command] Starting playback of single track`);
          
          // Final check that voice connection is ready before playing
          const connectionState = queue.connection?.state?.status || queue.connection?.state;
          if (queue.connection && (connectionState === VoiceConnectionStatus.Ready || connectionState === 'ready')) {
            console.log(`[Play Command] Voice connection is ready, starting playback`);
            try {
              await queue.node.play();
              console.log(`[Play Command] Playback started successfully`);
            } catch (playError) {
              console.error(`[Play Command] ❌ Playback failed:`, playError.message);
              return replyToUser(interaction, "❌ Failed to start playback. Please try again.");
            }
          } else {
            console.log(`[Play Command] ⚠️ Voice connection not ready, state: ${connectionState || 'Unknown'}`);
            return replyToUser(interaction, "❌ Voice connection not ready. Please try again.");
          }
        } else {
          console.log(`[Play Command] Track added to queue, already playing`);
        }
        
        return replyToUser(interaction, `🎶 Added **${track.title}** to the queue!`);
      }

    } catch (err) {
      console.error("[Play Command] Error:", err);
      return replyToUser(interaction, `❌ Failed to play music: ${err.message || "Unknown error"}`);
    } finally {
      playCommandLocks.delete(interactionId);
      playCommandLocks.delete(guildId);
    }
  },
};