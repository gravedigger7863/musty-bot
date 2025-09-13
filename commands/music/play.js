const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play music from multiple sources with automatic fallback")
    .addStringOption(option =>
      option.setName("query")
        .setDescription("Song name, YouTube URL, or direct audio file URL (.mp3, .ogg, .wav, .m4a)")
        .setRequired(true)
    ),
  async execute(interaction) {
    const query = interaction.options.getString("query");
    const voiceChannel = interaction.member?.voice?.channel;

    if (!voiceChannel) {
      try {
        return await interaction.editReply({ 
          content: "⚠️ You need to join a voice channel first!"
        });
      } catch (err) {
        console.error('Failed to send voice channel error:', err);
        return;
      }
    }

    // Send initial processing message
    try {
      await interaction.editReply({ 
        content: "🔍 Searching for your music..." 
      });
    } catch (err) {
      console.error('Failed to send processing message:', err);
    }

    try {
      const queue = interaction.client.player.nodes.create(interaction.guild, {
        metadata: { channel: interaction.channel },
        leaveOnEnd: false,
        leaveOnEmpty: false,
        leaveOnEmptyCooldown: 300000,
        // Add better queue configuration
        selfDeaf: false,
        selfMute: false,
        // Add better connection options
        connectionOptions: {
          selfDeaf: false,
          selfMute: false
        }
      });

      // Connect to voice channel with better error handling
      if (!queue.connection) {
        try {
          await queue.connect(voiceChannel);
        } catch (connectErr) {
          console.error('Failed to connect to voice channel:', connectErr);
          throw new Error('Failed to connect to voice channel. Please check permissions.');
        }
      }

      // Play the track with comprehensive fallback system
      let result;
      let searchAttempts = 0;
      const maxAttempts = 5; // Multiple fallback sources
      
      // Check if it's a direct audio file URL first
      let isDirectAudio = false;
      if (query.startsWith('http') && (query.includes('.mp3') || query.includes('.ogg') || query.includes('.wav') || query.includes('.m4a'))) {
        console.log('[Play Command] Detected direct audio file URL');
        isDirectAudio = true;
        try {
          result = await queue.play(query, { 
            nodeOptions: { 
              metadata: { channel: interaction.channel },
              selfDeaf: false,
              selfMute: false
            }
          });
          console.log('[Play Command] ✅ Success with direct audio file!');
        } catch (directError) {
          console.error('[Play Command] ❌ Direct audio file failed:', directError.message);
          // Continue to fallback strategies
        }
      }
      
      // Only run fallback strategies if direct audio didn't work or wasn't detected
      if (!isDirectAudio || !result) {
        // Define fallback search strategies
        const searchStrategies = [
        // Strategy 1: ytdl-core for direct YouTube URLs
        {
          name: 'ytdl-core Direct',
          query: query,
          options: {
            searchOptions: { limit: 1, type: 'video', source: 'youtube' }
          },
          isDirect: true
        },
        // Strategy 2: YouTube search with ytsearch prefix
        {
          name: 'YouTube Search',
          query: query.startsWith('http') ? query : `ytsearch:${query}`,
          options: {
            searchOptions: { limit: 1, type: 'video', source: 'youtube' }
          }
        },
        // Strategy 3: SoundCloud search
        {
          name: 'SoundCloud',
          query: `scsearch:${query}`,
          options: {
            searchOptions: { limit: 1, type: 'track', source: 'soundcloud' }
          }
        },
        // Strategy 4: Generic search (any source)
        {
          name: 'Generic Search',
          query: query,
          options: {
            searchOptions: { limit: 1, type: 'video' }
          }
        },
        // Strategy 5: YouTube with different search terms
        {
          name: 'YouTube Alternative',
          query: `ytsearch:${query} music`,
          options: {
            searchOptions: { limit: 1, type: 'video', source: 'youtube' }
          }
        }
      ];
      
      while (searchAttempts < maxAttempts) {
        const strategy = searchStrategies[searchAttempts];
        console.log(`[Play Command] Trying ${strategy.name}... (${searchAttempts + 1}/${maxAttempts})`);
        
        try {
          if (strategy.isDirect && query.startsWith('http')) {
            // For direct URLs, try ytdl-core validation first
            const ytdl = require('ytdl-core');
            if (ytdl.validateURL(query)) {
              console.log(`[Play Command] Using ytdl-core for direct YouTube URL`);
              result = await queue.play(query, { 
                nodeOptions: { 
                  metadata: { channel: interaction.channel },
                  selfDeaf: false,
                  selfMute: false
                },
                ...strategy.options
              });
            } else {
              throw new Error('Invalid YouTube URL for ytdl-core');
            }
          } else {
            // Regular search
            result = await queue.play(strategy.query, { 
              nodeOptions: { 
                metadata: { channel: interaction.channel },
                selfDeaf: false,
                selfMute: false
              },
              ...strategy.options
            });
          }
          
          console.log(`[Play Command] ✅ Success with ${strategy.name}!`);
          break; // Success, exit retry loop
          
        } catch (playError) {
          searchAttempts++;
          console.error(`[Play Command] ❌ ${strategy.name} failed:`, playError.message);
          
          if (searchAttempts < maxAttempts) {
            console.log(`[Play Command] Trying next fallback in 1 second...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            // All strategies failed
            throw new Error(`All ${maxAttempts} search strategies failed. Last error: ${playError.message}`);
          }
        }
      }
      } // End of fallback strategies

      // Send success message
      try {
        await interaction.editReply(`🎶 Now playing **${result.track.title}**`);
      } catch (editErr) {
        console.error('Failed to send success message:', editErr);
        // Try follow-up as fallback
        try {
          await interaction.followUp({ 
            content: `🎶 Now playing **${result.track.title}**`, 
            flags: 64 
          });
        } catch (followUpErr) {
          console.error('Failed to send follow-up success message:', followUpErr);
        }
      }
    } catch (err) {
      console.error('Play command error:', err);
      
      let errorMessage = '❌ No results found for that query or the source is unsupported.';
      
      // Provide more specific error messages
      if (err.message && err.message.includes('Could not extract stream')) {
        errorMessage = '❌ Could not extract audio stream. The video might be unavailable or restricted.';
      } else if (err.message && err.message.includes('NoResultError')) {
        errorMessage = '❌ No results found for your search query.';
      } else if (err.message && err.message.includes('timeout')) {
        errorMessage = '❌ Request timed out. Please try again.';
      } else if (err.message && err.message.includes('Failed to connect')) {
        errorMessage = '❌ Failed to connect to voice channel. Please check permissions.';
      } else if (err.message && err.message.includes('No tracks found')) {
        errorMessage = '❌ No tracks found for your search.';
      }
      
      try {
        await interaction.editReply(errorMessage);
      } catch (editErr) {
        console.error('Failed to edit reply:', editErr);
        // Try to send a follow-up if edit fails
        try {
          await interaction.followUp({ content: errorMessage, flags: 64 });
        } catch (followUpErr) {
          console.error('Failed to send follow-up:', followUpErr);
        }
      }
    }
  },
};
