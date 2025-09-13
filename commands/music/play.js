const { SlashCommandBuilder } = require("discord.js");
const { QueryType } = require("discord-player");

// Track play command executions to prevent duplicates
const playExecutions = new Set();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play music from Apple Music and Spotify with automatic fallback")
    .addStringOption(option =>
      option.setName("query")
        .setDescription("Song name, artist, or music service URL (Apple Music, Spotify)")
        .setRequired(true)
    ),
  async execute(interaction) {
    // CRITICAL: Check if interaction already processed to prevent duplicate execution
    if (interaction.deferred || interaction.replied) {
      console.log(`[Play Command] Interaction already processed, skipping duplicate execution`);
      return;
    }

    // Additional check: prevent duplicate play command executions
    const executionKey = `${interaction.id}-${interaction.user.id}`;
    if (playExecutions.has(executionKey)) {
      console.log(`[Play Command] Duplicate play command execution detected, skipping: ${executionKey}`);
      return;
    }
    playExecutions.add(executionKey);

    // Defer interaction to prevent timeout (only if not already handled)
    if (!interaction.deferred && !interaction.replied) {
      try {
        await interaction.deferReply();
        console.log(`[Play Command] Interaction deferred successfully`);
      } catch (err) {
        console.warn("Failed to defer interaction:", err.message);
        return; // Exit if we can't defer - interaction is likely expired
      }
    } else {
      console.log(`[Play Command] Interaction already handled, continuing...`);
    }
    
    try {
      console.log(`[Play Command] Starting play command for query: ${interaction.options.getString("query")}`);
      
      // Small delay to ensure extractors are loaded
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const query = interaction.options.getString("query");
      const voiceChannel = interaction.member?.voice?.channel;

      if (!voiceChannel) {
        return await interaction.editReply({ 
          content: "⚠️ You need to join a voice channel first!"
        });
      }
      
      // Send initial processing message
      await interaction.editReply({ 
        content: "🔍 Searching for your music..." 
      });

      // Search for track using Discord Player's built-in search
      console.log(`[Play Command] Searching for: ${query}`);
      let searchResult;
      
      try {
        // Try only the most reliable music sources
        const searchEngines = [
          QueryType.APPLE_MUSIC_SEARCH,  // Most reliable
          QueryType.SPOTIFY_SEARCH       // Very reliable
        ];
        
        for (const searchEngine of searchEngines) {
          try {
            console.log(`[Play Command] Trying search engine: ${searchEngine}`);
            searchResult = await interaction.client.player.search(query, {
              requestedBy: interaction.user,
              searchEngine: searchEngine,
            });
            
            if (searchResult && searchResult.hasTracks()) {
              console.log(`[Play Command] Found results with ${searchEngine}`);
              break; // Success, exit the loop
            }
          } catch (engineError) {
            console.log(`[Play Command] ${searchEngine} failed:`, engineError.message);
            continue; // Try next engine
          }
        }
        
        // If all reliable sources fail, return error
        if (!searchResult || !searchResult.hasTracks()) {
          return await interaction.editReply('❌ No tracks found on Apple Music or Spotify. Please try a different search term.');
        }
        
        const track = searchResult.tracks[0];
        console.log(`[Play Command] Found track: ${track.title} from ${track.source}`);
        
        // Accept only the most reliable music sources
        const supportedSources = ['apple_music', 'spotify'];
        if (!supportedSources.includes(track.source)) {
          console.warn(`[Play Command] Unsupported track source: ${track.source}`);
          return await interaction.editReply('❌ Unsupported music source. Please try a different search.');
        }
        
      } catch (searchError) {
        console.error(`[Play Command] Search failed:`, searchError);
        
        // Provide specific error messages based on the error type
        if (searchError.message && searchError.message.includes('timeout')) {
          return await interaction.editReply('❌ Search timed out. Please try again with a shorter search term.');
        } else if (searchError.message && searchError.message.includes('rate limit')) {
          return await interaction.editReply('❌ Search rate limited. Please wait a moment and try again.');
        } else if (searchError.message && searchError.message.includes('network')) {
          return await interaction.editReply('❌ Network error during search. Please check your connection and try again.');
        } else {
          return await interaction.editReply('❌ Search failed. Please try a different search term.');
        }
      }

      // Create or get existing queue
      console.log(`[Play Command] Creating/getting queue for guild: ${interaction.guild.id}`);
      let queue = interaction.client.player.nodes.get(interaction.guild.id);
      
      if (!queue) {
        console.log(`[Play Command] Creating new queue`);
        queue = interaction.client.player.nodes.create(interaction.guild, {
          metadata: { channel: interaction.channel },
          leaveOnEnd: true,
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 30000,
          leaveOnStop: true,
          selfDeaf: false,
          selfMute: false,
          // Simple, stable configuration
          skipOnEmpty: true,
          skipOnEmptyCooldown: 30000,
          autoSelfDeaf: false,
          autoSelfMute: false,
          bufferingTimeout: 10000,
          connectionTimeout: 30000
        });
      }

      // Ensure queue and node exist
      if (!queue || !queue.node) {
        console.error(`[Play Command] Queue or node is undefined after creation`);
        return await interaction.editReply('❌ Failed to create music queue. Please try again.');
      }

      // Connect to voice channel
      console.log(`[Play Command] Connecting to voice channel: ${voiceChannel.name}`);
      try {
        await queue.connect(voiceChannel);
        console.log(`[Play Command] Connected to voice channel successfully`);
      } catch (connectError) {
        console.error(`[Play Command] Failed to connect:`, connectError);
        queue.delete();
        return await interaction.editReply('❌ Could not join voice channel!');
      }

      // Add track to queue
      console.log(`[Play Command] Adding track to queue...`);
      const track = searchResult.tracks[0];
      queue.addTrack(track);
      
      // Start playback if not already playing
      if (!queue.node.isPlaying()) {
        try {
          await queue.node.play();
          await interaction.editReply(`🎶 Now playing **${track.title}**`);
        } catch (playError) {
          console.error(`[Play Command] Playback failed:`, playError);
          await interaction.editReply(`❌ Failed to start playback: ${playError.message || 'Unknown error'}`);
        }
      } else {
        await interaction.editReply(`🎶 **${track.title}** added to queue`);
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
      
      // Use fallback if interaction is not replied to
      try {
        if (!interaction.replied) {
          await interaction.editReply(errorMessage);
        } else {
          await interaction.followUp({ content: errorMessage, ephemeral: true });
        }
      } catch (replyError) {
        console.error('Failed to send error message:', replyError);
      }
    } finally {
      // Clean up execution tracking
      const executionKey = `${interaction.id}-${interaction.user.id}`;
      playExecutions.delete(executionKey);
      
      // Clean up old executions (keep only last 1000)
      if (playExecutions.size > 1000) {
        const toDelete = Array.from(playExecutions).slice(0, 100);
        toDelete.forEach(key => playExecutions.delete(key));
      }
    }
  },
};

