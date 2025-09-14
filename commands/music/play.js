const { SlashCommandBuilder } = require("discord.js");
const { useMainPlayer } = require("discord-player");

// Track recent track additions to prevent spam
const recentTracks = new Map();

// Global lock to prevent multiple play commands from executing simultaneously
const playCommandLocks = new Map();

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
      return interaction.editReply("⏳ Another play command is already running, please wait...");
    }
    
    // Lock this guild's play command
    playCommandLocks.set(guildId, interactionId);
    console.log(`[Play Command] Locked guild ${guildId} for interaction ${interactionId}`);
    
    try {
      const query = interaction.options.getString("query");
      const voiceChannel = interaction.member?.voice?.channel;

      if (!voiceChannel) return interaction.editReply("⚠️ You need to join a voice channel first!");
      if (!interaction.client.player) return interaction.editReply("⏳ Music system not ready yet, try again later.");

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
        return interaction.editReply("❌ I don't have permission to connect or speak in this voice channel!");
      }

      try {
        console.log(`[Play Command] Searching for: ${query}`);
        
        // Use the modern Discord Player v7 approach
        const player = useMainPlayer();
        const searchResult = await player.search(query, { requestedBy: interaction.user });

        if (!searchResult || !searchResult.tracks.length) return interaction.editReply("❌ No tracks found.");

        const track = searchResult.tracks[0];
        console.log(`[Play Command] Found track: ${track.title} by ${track.author}`);

        // Check for recent duplicate track additions (within last 5 seconds)
        const trackKey = `${interaction.guild.id}-${track.title}-${track.author}`;
        const now = Date.now();
        const lastAdded = recentTracks.get(trackKey);
        
        if (lastAdded && (now - lastAdded) < 5000) {
          console.log(`[Play Command] Track added too recently, preventing spam`);
          return interaction.editReply(`⏳ Please wait a moment before adding the same track again!`);
        }
        
        // Record this track addition
        recentTracks.set(trackKey, now);
        
        // Clean up old entries (older than 30 seconds)
        for (const [key, timestamp] of recentTracks.entries()) {
          if (now - timestamp > 30000) {
            recentTracks.delete(key);
          }
        }

        // Get or create queue using the modern approach
        let queue = player.nodes.get(interaction.guild.id);
        if (!queue) {
          console.log(`[Play Command] Creating new queue`);
          queue = player.nodes.create(interaction.guild, {
            metadata: { channel: interaction.channel },
            selfDeaf: false,
            selfMute: false,
          });
        } else {
          console.log(`[Play Command] Using existing queue`);
          
          // Check if the same track is already in the queue to prevent duplicates
          const existingTrack = queue.tracks.find(t => 
            t.title === track.title && t.author === track.author
          );
          
          if (existingTrack) {
            console.log(`[Play Command] Track already in queue, skipping duplicate`);
            return interaction.editReply(`🎵 **${track.title}** is already in the queue!`);
          }
        }

        // Connect to voice channel with proper error handling
        if (!queue.connection) {
          console.log(`[Play Command] Connecting to voice channel: ${voiceChannel.name}`);
          console.log(`[Play Command] Voice channel ID: ${voiceChannel.id}`);
          console.log(`[Play Command] Guild ID: ${interaction.guild.id}`);
          
          try {
            await queue.connect(voiceChannel);
            console.log(`[Play Command] ✅ Connection initiated successfully`);
            
            // Wait for voice connection to be fully ready
            console.log(`[Play Command] Waiting for voice connection to be ready...`);
            let connectionReady = false;
            let attempts = 0;
            const maxAttempts = 10; // 5 seconds total
            
            while (!connectionReady && attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 500));
              attempts++;
              
              const voiceState = queue.connection?.voice;
              if (voiceState && voiceState.state === 'ready') {
                connectionReady = true;
                console.log(`[Play Command] ✅ Voice connection ready after ${attempts * 500}ms`);
              } else {
                console.log(`[Play Command] Voice state check ${attempts}/${maxAttempts}: ${voiceState?.state || 'undefined'}`);
              }
            }
            
            if (!connectionReady) {
              console.log(`[Play Command] ❌ Voice connection not ready after 5s - destroying queue`);
              queue.destroy();
              return interaction.editReply(`❌ Could not join your voice channel! Please check bot permissions.`);
            }
            
          } catch (connectError) {
            console.error(`[Play Command] Connection error:`, connectError);
            queue.destroy();
            return interaction.editReply(`❌ Could not join your voice channel! ${connectError.message}`);
          }
        } else {
          console.log(`[Play Command] Already connected to voice channel`);
        }

        // Add track to queue
        queue.addTrack(track);
        console.log(`[Play Command] Track added, queue size: ${queue.tracks.size}`);

        // Play track if not already playing
        if (!queue.node.isPlaying()) {
          console.log(`[Play Command] About to start playback for: ${track.title}`);
          console.log(`[Play Command] Queue state - Is playing: ${queue.node.isPlaying()}, Current track: ${queue.currentTrack?.title || 'None'}`);
          console.log(`[Play Command] Voice connection state before play: ${queue.connection?.voice?.state || 'undefined'}`);
          
          // Ensure voice connection is ready before playing
          if (!queue.connection || !queue.connection.voice || queue.connection.voice.state !== 'ready') {
            console.log(`[Play Command] ❌ Voice connection not ready for playback`);
            return interaction.editReply(`❌ Voice connection not ready. Please try again.`);
          }
          
          try {
            // Use node.play() without passing the track - let Discord Player handle it automatically
            await queue.node.play();
            console.log(`[Play Command] ✅ Playback command sent for: ${track.title}`);
            console.log(`[Play Command] Post-play state - Is playing: ${queue.node.isPlaying()}, Voice state: ${queue.connection?.voice?.state || 'undefined'}`);
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
    } catch (err) {
      console.error(`[Play Command] Error:`, err);
      return interaction.editReply(`❌ Failed to play music: ${err.message || "Unknown error"}`);
    } finally {
      // Always release the lock
      playCommandLocks.delete(guildId);
      console.log(`[Play Command] Released lock for guild ${guildId}`);
    }
  },
};