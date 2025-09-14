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

      let queue = player.nodes.get(guildId);
      if (!queue) {
        queue = player.nodes.create(voiceChannel, {
          metadata: { channel: interaction.channel },
          leaveOnEnd: true,
          leaveOnEmpty: true,
          leaveOnStop: true,
          selfDeaf: false,
          selfMute: false
        });
      }

      if (!queue.connection) {
        await queue.connect(voiceChannel);
        await entersState(queue.connection, VoiceConnectionStatus.Ready, 30_000).catch(() => {
          queue.delete();
          return replyToUser(interaction, "❌ Could not establish voice connection! Please try again.");
        });
      }

      if (searchResult.playlist) {
        const validTracks = searchResult.tracks.filter(t => t.url).slice(0, 100);
        queue.addTrack(validTracks);
        if (!queue.node.isPlaying()) await queue.node.play();
        return replyToUser(interaction, `🎵 Added **${validTracks.length} tracks** from **${searchResult.playlist.title}** to the queue!`);
      } else {
        const track = searchResult.tracks[0];
        if (!track.url) return replyToUser(interaction, "❌ Track has no playable URL. Try a different source.");
        if (queue.tracks.find(t => t.title === track.title && t.author === track.author)) {
          return replyToUser(interaction, `🎵 **${track.title}** is already in the queue!`);
        }

        queue.addTrack(track);
        if (!queue.node.isPlaying()) await queue.node.play();
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