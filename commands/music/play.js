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

      console.log(`[Play Command] Using controlled queue management for: ${query}`);
      
      // Search for tracks first
      const searchResult = await player.search(query, { requestedBy: interaction.user });
      if (!searchResult || !searchResult.tracks.length) {
        return replyToUser(interaction, "❌ No tracks found.");
      }

      // Get or create queue with proper state management
      let queue = player.nodes.get(interaction.guild.id);
      if (!queue) {
        console.log(`[Play Command] Creating new queue`);
        queue = player.nodes.create(voiceChannel, {
          metadata: { channel: interaction.channel },
          leaveOnEnd: true,
          leaveOnEmpty: true,
          leaveOnStop: true,
          selfDeaf: false,
          selfMute: false
        });
      }

      // Connect to voice channel if not already connected
      if (!queue.connection) {
        console.log(`[Play Command] Connecting to voice channel: ${voiceChannel.name}`);
        await queue.connect(voiceChannel);
        console.log(`[Play Command] ✅ Connected to voice channel`);
        
        // Wait for voice connection to be ready (increased to 30s for VPS)
        try {
          await entersState(queue.connection, VoiceConnectionStatus.Ready, 30_000);
          console.log(`[Play Command] ✅ Voice connection ready`);
        } catch (error) {
          console.log(`[Play Command] ❌ Voice connection not ready after 30s`);
          queue.delete();
          return replyToUser(interaction, `❌ Could not establish voice connection! Please try again.`);
        }
      }

      // Handle playlists vs single tracks
      if (searchResult.playlist) {
        console.log(`[Play Command] Adding playlist: ${searchResult.playlist.title} with ${searchResult.tracks.length} tracks`);
        
        // Validate playlist tracks have playable URLs
        const validTracks = searchResult.tracks.filter(track => track.url);
        if (validTracks.length === 0) {
          return replyToUser(interaction, `❌ No tracks in playlist have playable URLs.`);
        }
        
        if (validTracks.length < searchResult.tracks.length) {
          console.log(`[Play Command] Filtered out ${searchResult.tracks.length - validTracks.length} tracks without URLs`);
        }
        
        queue.addTrack(validTracks);
        
        // Start playing if not already playing
        if (!queue.node.isPlaying()) {
          await queue.node.play();
        }
        
        return replyToUser(interaction, `🎵 Added **${validTracks.length} tracks** from **${searchResult.playlist.title}** to the queue!`);
      } else {
        // Handle single track
        const track = searchResult.tracks[0];
        console.log(`[Play Command] Adding single track: ${track.title} by ${track.author}`);
        console.log(`[Play Command] Track URL: ${track.url || 'No URL'}`);
        console.log(`[Play Command] Track duration: ${track.duration || 'Unknown'}`);
        
        // Validate track has playable URL
        if (!track.url) {
          console.log(`[Play Command] ❌ Track has no playable URL`);
          return replyToUser(interaction, `❌ Track has no playable URL. Try a different source.`);
        }
        
        // Check for duplicates
        const existingTrack = queue.tracks.find(t => 
          t.title === track.title && t.author === track.author
        );
        
        if (existingTrack) {
          return replyToUser(interaction, `🎵 **${track.title}** is already in the queue!`);
        }
        
        // Add track to queue FIRST to ensure proper state
        queue.addTrack(track);
        console.log(`[Play Command] Track added, queue size: ${queue.tracks.size}`);
        
        // Start playing if not already playing
        if (!queue.node.isPlaying()) {
          console.log(`[Play Command] Starting playback...`);
          await queue.node.play();
          console.log(`[Play Command] ✅ Started playback`);
        } else {
          console.log(`[Play Command] Queue already playing, track added to queue`);
        }
        
        return replyToUser(interaction, `🎶 Added **${track.title}** to the queue!`);
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