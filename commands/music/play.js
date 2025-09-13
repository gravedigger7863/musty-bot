const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song from Spotify, SoundCloud, Bandcamp, Vimeo, Apple Music, or ReverbNation")
    .addStringOption(option =>
      option.setName("query")
        .setDescription("Song name or link")
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

      // Play the track with better configuration and retry mechanism
      let result;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          // Try different approaches based on retry count
          if (retryCount === 0) {
            // First attempt: Use default search
            result = await queue.play(query, { 
              nodeOptions: { 
                metadata: { channel: interaction.channel },
                selfDeaf: false,
                selfMute: false
              },
              searchOptions: {
                limit: 1,
                type: 'video'
              }
            });
          } else if (retryCount === 1) {
            // Second attempt: Use YouTube-specific search
            result = await queue.play(query, { 
              nodeOptions: { 
                metadata: { channel: interaction.channel },
                selfDeaf: false,
                selfMute: false
              },
              searchOptions: {
                limit: 1,
                type: 'video',
                source: 'youtube'
              }
            });
          } else {
            // Third attempt: Use ytdl-core directly
            const ytdl = require('ytdl-core');
            if (ytdl.validateURL(query)) {
              result = await queue.play(query, { 
                nodeOptions: { 
                  metadata: { channel: interaction.channel },
                  selfDeaf: false,
                  selfMute: false
                },
                searchOptions: {
                  limit: 1,
                  type: 'video',
                  source: 'youtube'
                }
              });
            } else {
              throw new Error('Invalid YouTube URL');
            }
          }
          break; // Success, exit retry loop
        } catch (playError) {
          retryCount++;
          console.error(`[Play Command] Attempt ${retryCount} failed:`, playError);
          
          if (retryCount < maxRetries) {
            console.log(`[Play Command] Retrying in 2 seconds... (${retryCount}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            throw playError; // Re-throw the error if all retries failed
          }
        }
      }

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
