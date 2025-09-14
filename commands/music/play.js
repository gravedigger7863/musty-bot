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
      
      // Debug: Show available extractors
      const availableExtractors = player.extractors.store;
      console.log(`[Play Command] Available extractors: ${Array.from(availableExtractors.keys()).join(', ')}`);
      
      try {
        // Try multiple search engines in order of preference
        // Using actual extractor identifiers from the loaded extractors
        const preferredSearchEngines = [
          'auto',           // Try all sources automatically
          'com.retrouser955.discord-player.deezr-ext', // Deezer (most reliable)
          'com.discord-player.youtubeextractor', // YouTube (default extractor)
          'com.discord-player.ytdlpextractor', // yt-dlp YouTube (if available)
          'com.discord-player.spotifyextractor', // Spotify
          'com.discord-player.applemusicextractor', // Apple Music
          'com.discord-player.vimeoextractor', // Vimeo
          'com.discord-player.reverbnationextractor', // Reverbnation
          'com.discord-player.soundcloudextractor' // SoundCloud (last, will be filtered for ad-supported)
        ];
        
        // Filter to only use available extractors
        const searchEngines = preferredSearchEngines.filter(engine => 
          engine === 'auto' || availableExtractors.has(engine)
        );
        
        console.log(`[Play Command] Using search engines: ${searchEngines.join(', ')}`);
        let searchResult = null;
        let selectedTrack = null;
        let searchEngineUsed = 'auto';
        
        for (const engine of searchEngines) {
          console.log(`[Play Command] Searching with ${engine}...`);
          
          try {
            searchResult = await player.search(query, {
              requestedBy: interaction.user,
              searchEngine: engine
            });
            
            if (searchResult.hasTracks()) {
              const track = searchResult.tracks[0];
              console.log(`[Play Command] Found track with ${engine}: ${track.title} by ${track.author}`);
              console.log(`[Play Command] Track source: ${track.source}`);
              
              // Check if it's a SoundCloud track and validate metadata
              if (track.source === 'soundcloud' && track.__metadata) {
                console.log(`[Play Command] SoundCloud track validation:`);
                console.log(`[Play Command] - Streamable: ${track.__metadata.streamable || 'Unknown'}`);
                console.log(`[Play Command] - Monetization: ${track.__metadata.monetization_model || 'Unknown'}`);
                console.log(`[Play Command] - License: ${track.__metadata.license || 'Unknown'}`);
                
                // Block non-streamable tracks
                if (track.__metadata.streamable === false) {
                  console.log(`[Play Command] ❌ Track is not streamable - trying next source`);
                  continue;
                }
                
                // Block ad-supported tracks
                if (track.__metadata.monetization_model === 'AD_SUPPORTED') {
                  console.log(`[Play Command] ❌ Track is ad-supported - trying next source`);
                  continue;
                }
              }
              
              // Check if it's a Deezer track and validate stream URL
              if (track.source === 'deezer') {
                console.log(`[Play Command] Deezer track validation:`);
                console.log(`[Play Command] - Track URL: ${track.url}`);
                console.log(`[Play Command] - Stream URL: ${track.raw?.url || 'No stream URL'}`);
                console.log(`[Play Command] - Format: ${track.raw?.format || 'Unknown'}`);
                
                // Check if the track URL is a webpage URL instead of audio stream
                if (track.url && track.url.includes('deezer.com/track/') && !track.url.includes('stream')) {
                  console.log(`[Play Command] ❌ Deezer track has webpage URL instead of stream URL - trying next source`);
                  continue;
                }
                
                // Check if raw stream URL exists and is valid
                if (!track.raw?.url || track.raw.url === track.url) {
                  console.log(`[Play Command] ❌ Deezer track missing valid stream URL - trying next source`);
                  continue;
                }
              }
              
              // Check if it's a Spotify track and validate stream URL
              if (track.source === 'spotify') {
                console.log(`[Play Command] Spotify track validation:`);
                console.log(`[Play Command] - Track URL: ${track.url}`);
                console.log(`[Play Command] - Stream URL: ${track.raw?.url || 'No stream URL'}`);
                console.log(`[Play Command] - Format: ${track.raw?.format || 'Unknown'}`);
                
                // Check if the track URL is a webpage URL instead of audio stream
                if (track.url && track.url.includes('open.spotify.com/track/') && !track.url.includes('stream')) {
                  console.log(`[Play Command] ❌ Spotify track has webpage URL instead of stream URL - trying next source`);
                  continue;
                }
                
                // Check if raw stream URL exists and is valid
                if (!track.raw?.url || track.raw.url === track.url) {
                  console.log(`[Play Command] ❌ Spotify track missing valid stream URL - trying next source`);
                  continue;
                }
              }
              
              // If we get here, the track is valid
              selectedTrack = track;
              searchEngineUsed = engine;
              console.log(`[Play Command] ✅ Valid track found with ${engine}: ${track.title}`);
              break;
            }
          } catch (error) {
            console.log(`[Play Command] ⚠️ Search failed with ${engine}: ${error.message}`);
            console.log(`[Play Command] ⚠️ Search error details:`, error);
            continue;
          }
        }
        
        // If no valid track found after trying all engines, try all available extractors
        if (!selectedTrack) {
          console.log(`[Play Command] ❌ No valid tracks found with preferred search engines`);
          console.log(`[Play Command] 🔄 Trying all available extractors as fallback...`);
          
          // Try all available extractors as fallback
          const extractorIds = Array.from(availableExtractors.keys());
          console.log(`[Play Command] Available extractors for fallback: ${extractorIds.join(', ')}`);
          
          // Add timeout protection
          const fallbackTimeout = setTimeout(() => {
            console.log(`[Play Command] ⏰ Fallback search timeout reached, stopping search`);
          }, 10000); // 10 second timeout
          
          let fallbackAttempts = 0;
          const maxFallbackAttempts = extractorIds.length;
          
          for (const extractorId of extractorIds) {
            fallbackAttempts++;
            if (fallbackAttempts > maxFallbackAttempts) {
              console.log(`[Play Command] ⚠️ Maximum fallback attempts reached, stopping search`);
              break;
            }
            if (extractorId === 'auto') continue; // Skip auto as we already tried it
            
            console.log(`[Play Command] Fallback search with ${extractorId}...`);
            
            try {
              searchResult = await player.search(query, {
                requestedBy: interaction.user,
                searchEngine: extractorId
              });
              
              if (searchResult.hasTracks()) {
                const track = searchResult.tracks[0];
                console.log(`[Play Command] Found track with ${extractorId}: ${track.title} by ${track.author}`);
                console.log(`[Play Command] Track source: ${track.source}`);
                
                // Apply the same validation logic
                let isValid = true;
                
                // SoundCloud validation
                if (track.source === 'soundcloud' && track.__metadata) {
                  if (track.__metadata.streamable === false || track.__metadata.monetization_model === 'AD_SUPPORTED') {
                    console.log(`[Play Command] ❌ SoundCloud track validation failed - trying next source`);
                    isValid = false;
                  }
                }
                
                // Deezer validation
                if (track.source === 'deezer') {
                  if (track.url && track.url.includes('deezer.com/track/') && !track.url.includes('stream')) {
                    console.log(`[Play Command] ❌ Deezer track has webpage URL - trying next source`);
                    isValid = false;
                  }
                  if (!track.raw?.url || track.raw.url === track.url) {
                    console.log(`[Play Command] ❌ Deezer track missing stream URL - trying next source`);
                    isValid = false;
                  }
                }
                
                // Spotify validation
                if (track.source === 'spotify') {
                  if (track.url && track.url.includes('open.spotify.com/track/') && !track.url.includes('stream')) {
                    console.log(`[Play Command] ❌ Spotify track has webpage URL - trying next source`);
                    isValid = false;
                  }
                  if (!track.raw?.url || track.raw.url === track.url) {
                    console.log(`[Play Command] ❌ Spotify track missing stream URL - trying next source`);
                    isValid = false;
                  }
                }
                
                if (isValid) {
                  selectedTrack = track;
                  searchEngineUsed = extractorId;
                  console.log(`[Play Command] ✅ Valid track found with ${extractorId}: ${track.title}`);
                  clearTimeout(fallbackTimeout);
                  break;
                }
              }
            } catch (error) {
              console.log(`[Play Command] ⚠️ Fallback search failed with ${extractorId}: ${error.message}`);
              continue;
            }
          }
          
          // Clear timeout if we found a track or finished searching
          clearTimeout(fallbackTimeout);
        }
        
        // Final check
        if (!selectedTrack) {
          console.log(`[Play Command] ❌ No valid tracks found with any search engine`);
          return replyToUser(interaction, "❌ No playable tracks found. The track might be restricted or unavailable on all platforms.");
        }
        
        console.log(`[Play Command] Using track from ${searchEngineUsed}: ${selectedTrack.title}`);
        
        // Proceed with playback using the selected track
        let result = await player.play(voiceChannel, query, {
          requestedBy: interaction.user,
          searchEngine: searchEngineUsed, // Use the specific engine that worked
          nodeOptions: {
            metadata: { channel: interaction.channel },
            leaveOnEnd: true,
            leaveOnEmpty: true,
            leaveOnStop: true,
            selfDeaf: false, // Keep false for SoundCloud compatibility
            selfMute: false,
            bufferingTimeout: 30000,
            connectionTimeout: 30000,
            volume: 50,
            autoplay: false,
            // SoundCloud specific options
            preferBridgedMetadata: true,
            disableFallbackStream: false
          }
        });

        // Note: Fallback logic removed to prevent double playback
        // The issue is that SoundCloud tracks are still finishing immediately
        // even with bridge enabled, so we need to focus on fixing the root cause

        if (result.success) {
          const { track, queue } = result;
          
          console.log(`[Play Command] ✅ Playback started successfully`);
          console.log(`[Play Command] Track: ${track.title} by ${track.author}`);
          console.log(`[Play Command] Source: ${track.source} (via ${searchEngineUsed})`);
          console.log(`[Play Command] Duration: ${track.duration} (${track.durationMS}ms)`);
          
          // Debug stream URLs to identify invalid streams
          console.log(`[Play Command] Track URL: ${track.url}`);
          console.log(`[Play Command] Stream URL: ${track.raw?.url || 'No stream URL'}`);
          console.log(`[Play Command] Track format: ${track.raw?.format || 'Unknown'}`);
          console.log(`[Play Command] Track quality: ${track.raw?.quality || 'Unknown'}`);
          
          // Track validation already happened in pre-validation step
          console.log(`[Play Command] ✅ Track passed validation and is ready to play`);
          
          // Validate track has proper duration
          if (!track.durationMS || track.durationMS <= 0) {
            console.log(`[Play Command] ⚠️ WARNING: Track has invalid duration - this will cause immediate finishing`);
            return replyToUser(interaction, "❌ Track has invalid duration. Try a different source.");
          }
          
          // Check if it's a playlist
          if (track.playlist) {
            return replyToUser(interaction, `🎵 Added **${track.playlist.tracks.length} tracks** from **${track.playlist.title}** to the queue! (via ${searchEngineUsed})`);
          } else {
            return replyToUser(interaction, `🎶 Started playing **${track.title}** by ${track.author}! (via ${searchEngineUsed})`);
          }
        } else {
          console.log(`[Play Command] ❌ Playback failed: ${result.error || 'Unknown error'}`);
          console.log(`[Play Command] Full error details:`, result);
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