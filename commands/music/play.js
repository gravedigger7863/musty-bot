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
    
    // Check if there's already a play command running for this guild
    if (playCommandLocks.has(guildId)) {
      console.log(`[Play Command] Another play command already running for guild ${guildId}, skipping`);
      return replyToUser(interaction, "⏳ Another play command is already running, please wait...");
    }
    
    // Lock this guild's play command
    playCommandLocks.set(guildId, interactionId);
    console.log(`[Play Command] Locked guild ${guildId} for interaction ${interactionId}`);
    
    let queue = null;
    
    try {
      const query = interaction.options.getString("query");
      const voiceChannel = interaction.member?.voice?.channel;

      if (!voiceChannel) return replyToUser(interaction, "⚠️ You need to join a voice channel first!");
      if (!interaction.client.player) return replyToUser(interaction, "⏳ Music system not ready yet, try again later.");

      // Check bot permissions in the voice channel
      const botMember = interaction.guild.members.me;
      const permissions = voiceChannel.permissionsFor(botMember);
      console.log(`[Play Command] Bot permissions in voice channel:`, {
        Connect: permissions.has('Connect'),
        Speak: permissions.has('Speak'),
        ViewChannel: permissions.has('ViewChannel'),
        allPermissions: permissions.toArray()
      });
      
      if (!permissions.has(['Connect', 'Speak'])) {
        return replyToUser(interaction, "❌ I don't have permission to connect or speak in this voice channel!");
      }

      // Show searching message
      await replyToUser(interaction, "⏳ Searching for your music...");

      console.log(`[Play Command] Searching for: ${query}`);
      
      // Use the modern Discord Player v7 approach with proper player.play() method
      const player = useMainPlayer();
      
      // Check for recent duplicate track additions (within last 5 seconds)
      const trackKey = `${interaction.guild.id}-${query}`;
      const now = Date.now();
      const lastAdded = recentTracks.get(trackKey);
      
      if (lastAdded && (now - lastAdded) < 5000) {
        console.log(`[Play Command] Track added too recently, preventing spam`);
        return replyToUser(interaction, `⏳ Please wait a moment before adding the same track again!`);
      }
      
      // Record this track addition
      recentTracks.set(trackKey, now);
      
      // Clean up old entries (older than 30 seconds)
      for (const [key, timestamp] of recentTracks.entries()) {
        if (now - timestamp > 30000) {
          recentTracks.delete(key);
        }
      }

      console.log(`[Play Command] Using v7 player.play() method for: ${query}`);
      
      // Use the proper v7 player.play() method which handles everything
      const result = await player.play(voiceChannel, query, {
        nodeOptions: {
          metadata: { channel: interaction.channel },
          volume: 80,
          leaveOnEnd: false,
          leaveOnEmpty: true,
          leaveOnStop: true,
          selfDeaf: false,
          selfMute: false
        },
        requestedBy: interaction.user
      });

      if (!result) {
        return replyToUser(interaction, "❌ No tracks found.");
      }

      // Handle the result - let player events handle messaging
      if (result.track) {
        console.log(`[Play Command] ✅ Playing: ${result.track.title} by ${result.track.author}`);
        return replyToUser(interaction, `🎶 Added **${result.track.title}** to the queue!`);
      } else if (result.playlist) {
        console.log(`[Play Command] ✅ Playing playlist: ${result.playlist.title} with ${result.tracks.length} tracks`);
        return replyToUser(interaction, `🎵 Playing **${result.playlist.title}** with ${result.tracks.length} tracks!`);
      } else {
        console.log(`[Play Command] ✅ Added to queue: ${result.tracks.length} tracks`);
        return replyToUser(interaction, `🎵 Added to queue!`);
      }

    } catch (err) {
      console.error(`[Play Command] Error:`, err);
      return replyToUser(interaction, `❌ Failed to play music: ${err.message || "Unknown error"}`);
    } finally {
      // Always release the lock
      playCommandLocks.delete(guildId);
      console.log(`[Play Command] Released lock for guild ${guildId}`);
    }
  },
};