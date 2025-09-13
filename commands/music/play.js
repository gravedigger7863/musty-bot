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
    // Check if interaction already processed
    if (interaction.deferred || interaction.replied) {
      console.log(`[Play Command] Interaction already processed, skipping`);
      return;
    }

    // Check if interaction is still valid
    const interactionAge = Date.now() - interaction.createdTimestamp;
    if (interactionAge > 2500) {
      console.log(`[Play Command] Interaction too old, skipping: ${interactionAge}ms`);
      return;
    }

    try {
      await interaction.deferReply();
      console.log(`[Play Command] Interaction deferred successfully`);
    } catch (err) {
      console.warn("Failed to defer interaction:", err.message);
      // Try to reply instead
      try {
        await interaction.reply({ content: "❌ Command failed to start. Please try again.", flags: 64 });
      } catch (replyErr) {
        console.error("Failed to reply to interaction:", replyErr.message);
      }
      return;
    }
    
    try {
      const query = interaction.options.getString("query");
      const voiceChannel = interaction.member?.voice?.channel;

      if (!voiceChannel) {
        return await interaction.editReply({ 
          content: "⚠️ You need to join a voice channel first!"
        });
      }
      
      await interaction.editReply({ 
        content: "🔍 Searching for your music..." 
      });

      console.log(`[Play Command] Searching for: ${query}`);
      console.log(`[Play Command] Available extractors: ${interaction.client.player.extractors.size}`);
      
      // Ensure extractors are loaded
      if (interaction.client.player.extractors.size === 0) {
        console.log(`[Play Command] No extractors available, loading them...`);
        try {
          const { DefaultExtractors } = require('@discord-player/extractor');
          await interaction.client.player.extractors.loadMulti(DefaultExtractors);
          console.log(`[Play Command] Loaded ${interaction.client.player.extractors.size} extractors`);
        } catch (loadError) {
          console.error(`[Play Command] Failed to load extractors:`, loadError);
          return await interaction.editReply('❌ Failed to load music extractors. Please try again.');
        }
      }
      
      // Search for track using the latest 2025 method
      let searchResult;
      try {
        // Try YouTube first (most reliable in 2025)
        searchResult = await interaction.client.player.search(query, {
          requestedBy: interaction.user,
          searchEngine: 'youtube',
        });
        
        console.log(`[Play Command] YouTube search result: ${searchResult ? searchResult.hasTracks() : 'null'}`);
        
        // If no results, try other engines
        if (!searchResult || !searchResult.hasTracks()) {
          const fallbackEngines = ['spotify', 'soundcloud'];
          for (const engine of fallbackEngines) {
            try {
              console.log(`[Play Command] Trying fallback engine: ${engine}`);
              searchResult = await interaction.client.player.search(query, {
                requestedBy: interaction.user,
                searchEngine: engine,
              });
              if (searchResult && searchResult.hasTracks()) {
                console.log(`[Play Command] Found results with ${engine}`);
                break;
              }
            } catch (engineError) {
              console.log(`[Play Command] ${engine} search failed:`, engineError.message);
              continue;
            }
          }
        }
      } catch (searchError) {
        console.error(`[Play Command] Search failed:`, searchError);
        return await interaction.editReply('❌ Search failed. Please try a different search term.');
      }
      
      if (!searchResult || !searchResult.hasTracks()) {
        return await interaction.editReply('❌ No tracks found. Please try a different search term or check if the URL is valid.');
      }
      
      const track = searchResult.tracks[0];
      console.log(`[Play Command] Found track: ${track.title} from ${track.source}`);

      // Create or get existing queue using 2025 best practices
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
          skipOnEmpty: true,
          skipOnEmptyCooldown: 30000,
          autoSelfDeaf: false,
          autoSelfMute: false,
          bufferingTimeout: 10000,
          connectionTimeout: 20000,
          // Add timeout configuration to prevent negative timeout warnings
          ytdlOptions: {
            timeout: 20000,
            requestOptions: {
              timeout: 20000
            }
          }
        });
      }

      // Connect to voice channel
      try {
        await queue.connect(voiceChannel);
        console.log(`[Play Command] Connected to voice channel successfully`);
      } catch (connectError) {
        console.error(`[Play Command] Failed to connect:`, connectError);
        queue.delete();
        return await interaction.editReply('❌ Could not join voice channel!');
      }

      // Add track to queue
      queue.addTrack(track);
      
      // Start playback if not already playing
      if (!queue.node.isPlaying()) {
        try {
          await queue.node.play();
          await interaction.editReply(`🎶 Now playing **${track.title}** by ${track.author || 'Unknown Artist'}`);
        } catch (playError) {
          console.error(`[Play Command] Playback failed:`, playError);
          await interaction.editReply(`❌ Failed to start playback: ${playError.message || 'Unknown error'}`);
        }
      } else {
        await interaction.editReply(`🎵 **${track.title}** by ${track.author || 'Unknown Artist'} added to queue`);
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