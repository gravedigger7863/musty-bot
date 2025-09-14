const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { useMainPlayer } = require("discord-player");
const { entersState, VoiceConnectionStatus, AudioPlayerStatus } = require("@discordjs/voice");

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
    if (playCommandLocks.has(guildId)) {
      return replyToUser(interaction, "⏳ Another play command is already running, please wait...", true);
    }
    playCommandLocks.set(guildId, true);

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

      // Use the simplified player.play() approach for v7.1
      console.log(`[Play Command] Searching for: ${query}`);
      
      try {
        const result = await player.play(voiceChannel, query, {
          requestedBy: interaction.user,
          nodeOptions: {
            metadata: { channel: interaction.channel },
            leaveOnEnd: true,
            leaveOnEmpty: true,
            leaveOnStop: true,
            selfDeaf: true, // Changed to true for better practice
            selfMute: false,
            bufferingTimeout: 30000,
            connectionTimeout: 30000,
            volume: 50,
            autoplay: false
          }
        });

        if (result.success) {
          const { track, queue } = result;
          
          console.log(`[Play Command] ✅ Playback started successfully`);
          console.log(`[Play Command] Track: ${track.title} by ${track.author}`);
          console.log(`[Play Command] Source: ${track.source}`);
          console.log(`[Play Command] Duration: ${track.duration} (${track.durationMS}ms)`);
          
          // Check if it's a playlist
          if (track.playlist) {
            return replyToUser(interaction, `🎵 Added **${track.playlist.tracks.length} tracks** from **${track.playlist.title}** to the queue!`);
          } else {
            return replyToUser(interaction, `🎶 Started playing **${track.title}** by ${track.author}!`);
          }
        } else {
          console.log(`[Play Command] ❌ Playback failed: ${result.error || 'Unknown error'}`);
          return replyToUser(interaction, "❌ Something went wrong, please try again.");
        }
      } catch (error) {
        console.error(`[Play Command] ❌ Error during playback:`, error.message);
        return replyToUser(interaction, `❌ Failed to play music: ${error.message}`);
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