const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const LocalMusicManager = require('../../modules/local-music');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song from local files, YouTube, SoundCloud, or Spotify')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Song name, artist, or URL to play')
        .setRequired(true)
    ),
  
  async execute(interaction, client) {
    const query = interaction.options.getString('query');
    
    // Check if user is in a voice channel
    if (!interaction.member.voice.channel) {
      return interaction.editReply({ 
        content: '❌ You need to be in a voice channel to use this command!'
      });
    }
    
    // Check if bot has permission to join and speak
    const permissions = interaction.member.voice.channel.permissionsFor(interaction.guild.members.me);
    if (!permissions.has(['Connect', 'Speak'])) {
      return interaction.editReply({ 
        content: '❌ I need Connect and Speak permissions to join your voice channel!'
      });
    }
    
    // Interaction is already deferred by interactionCreate event
    
    try {
      // Get or create queue
      const queue = client.player.nodes.create(interaction.guild, {
        metadata: {
          channel: interaction.channel,
          client: interaction.guild.members.me,
          requestedBy: interaction.user
        },
        selfDeaf: true,
        volume: 80,
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 300000,
        leaveOnEnd: true,
        leaveOnEndCooldown: 300000,
      });
      
      // Connect to voice channel
      if (!queue.connection) {
        console.log(`[Play Command] Connecting to voice channel: ${interaction.member.voice.channel.name}`);
        await queue.connect(interaction.member.voice.channel);
        console.log(`[Play Command] ✅ Connected to voice channel successfully`);
      } else {
        console.log(`[Play Command] Using existing voice connection`);
      }
      
      let track;
      let isLocalFile = false;
      
      // Search for tracks online (local files disabled for now due to compatibility issues)
      console.log(`[Play Command] Searching for: ${query}`);
      
      // Try multiple search strategies
      let searchResult = null;
      
      // Strategy 1: YouTube search
      try {
        console.log(`[Play Command] Trying YouTube search...`);
        searchResult = await client.player.search(query, {
          requestedBy: interaction.user,
          searchEngine: 'youtube'
        });
        if (searchResult.hasTracks()) {
          console.log(`[Play Command] ✅ YouTube search found ${searchResult.tracks.length} tracks`);
        } else {
          console.log(`[Play Command] ❌ YouTube search returned no tracks`);
        }
      } catch (error) {
        console.log(`[Play Command] YouTube search failed:`, error.message);
        // If YouTube fails due to authentication, try with a different approach
        if (error.message.includes('Sign in to confirm') || error.message.includes('bot')) {
          console.log(`[Play Command] YouTube blocked - trying alternative search...`);
          searchResult = null; // Reset to try other strategies
        }
      }
      
      // Strategy 1.5: Try YouTube with direct URL if search failed
      if (!searchResult || !searchResult.hasTracks()) {
        try {
          console.log(`[Play Command] Trying YouTube with direct URL approach...`);
          // Try searching for a known YouTube video to test if extractor works
          const testQuery = `https://www.youtube.com/watch?v=dQw4w9WgXcQ`; // Rick Roll as test
          searchResult = await client.player.search(testQuery, {
            requestedBy: interaction.user
          });
          if (searchResult.hasTracks()) {
            console.log(`[Play Command] ✅ YouTube extractor works, trying original query...`);
            // Now try the original query
            searchResult = await client.player.search(query, {
              requestedBy: interaction.user,
              searchEngine: 'youtube'
            });
            if (searchResult.hasTracks()) {
              console.log(`[Play Command] ✅ YouTube search with direct approach found ${searchResult.tracks.length} tracks`);
            }
          }
        } catch (error) {
          console.log(`[Play Command] YouTube direct approach failed:`, error.message);
        }
      }
      
      // Strategy 2: Try other sources first (avoid SoundCloud if possible)
      if (!searchResult || !searchResult.hasTracks()) {
        try {
          console.log(`[Play Command] Trying Spotify search...`);
          searchResult = await client.player.search(query, {
            requestedBy: interaction.user,
            searchEngine: 'spotify'
          });
          if (searchResult.hasTracks()) {
            console.log(`[Play Command] ✅ Spotify search found ${searchResult.tracks.length} tracks`);
          }
        } catch (error) {
          console.log(`[Play Command] Spotify search failed:`, error.message);
        }
      }
      
      // Strategy 3: Auto search if other sources failed
      if (!searchResult || !searchResult.hasTracks()) {
        try {
          console.log(`[Play Command] Trying auto search...`);
          searchResult = await client.player.search(query, {
            requestedBy: interaction.user,
            searchEngine: 'auto'
          });
          if (searchResult.hasTracks()) {
            console.log(`[Play Command] ✅ Auto search found ${searchResult.tracks.length} tracks`);
          }
        } catch (error) {
          console.log(`[Play Command] Auto search failed:`, error.message);
        }
      }
      
      // Strategy 3: YouTube with "official" keyword
      if (!searchResult || !searchResult.hasTracks()) {
        try {
          console.log(`[Play Command] Trying YouTube with 'official' keyword...`);
          searchResult = await client.player.search(`${query} official`, {
            requestedBy: interaction.user,
            searchEngine: 'youtube'
          });
          if (searchResult.hasTracks()) {
            console.log(`[Play Command] ✅ YouTube official search found ${searchResult.tracks.length} tracks`);
          }
        } catch (error) {
          console.log(`[Play Command] YouTube official search failed:`, error.message);
        }
      }
      
      // Strategy 4: Try without search engine specification
      if (!searchResult || !searchResult.hasTracks()) {
        try {
          console.log(`[Play Command] Trying default search...`);
          searchResult = await client.player.search(query, {
            requestedBy: interaction.user
          });
          if (searchResult.hasTracks()) {
            console.log(`[Play Command] ✅ Default search found ${searchResult.tracks.length} tracks`);
          }
        } catch (error) {
          console.log(`[Play Command] Default search failed:`, error.message);
        }
      }
      
      if (!searchResult.hasTracks()) {
        return interaction.editReply({ 
          content: '❌ No tracks found for your query!' 
        });
      }
      
      // Try to find a good track (prefer YouTube over SoundCloud for reliability)
      let bestTrack = null;
      const tracks = searchResult.tracks;
      
      console.log(`[Play Command] Found ${tracks.length} tracks from ${searchResult.source || 'unknown source'}`);
      
      // First, try to find a YouTube track
      bestTrack = tracks.find(t => t.source === 'youtube');
      if (bestTrack) {
        console.log(`[Play Command] ✅ Found YouTube track: ${bestTrack.title}`);
      }
      
      // If no YouTube track, try other sources (avoid SoundCloud if possible)
      if (!bestTrack) {
        bestTrack = tracks.find(t => t.source !== 'soundcloud');
        if (bestTrack) {
          console.log(`[Play Command] ✅ Found ${bestTrack.source} track: ${bestTrack.title}`);
        }
      }
      
      // If only SoundCloud tracks available, try to find one without restrictions
      if (!bestTrack) {
        console.log(`[Play Command] ⚠️ Only SoundCloud tracks available - checking for restrictions`);
        // Look for SoundCloud tracks that might be more reliable
        const soundcloudTracks = tracks.filter(t => t.source === 'soundcloud');
        
        // Try to find a track without ad support or restrictions
        bestTrack = soundcloudTracks.find(t => 
          !t.raw?.monetization_model || 
          t.raw?.monetization_model !== 'AD_SUPPORTED'
        );
        
        // If no good SoundCloud track found, use the first one but warn
        if (!bestTrack) {
          bestTrack = tracks[0];
          console.log(`[Play Command] ⚠️ Only restricted SoundCloud tracks available - may have playback issues`);
        } else {
          console.log(`[Play Command] ⚠️ Only SoundCloud tracks available - selected one without ads`);
        }
      }
      
      track = bestTrack;
      console.log(`[Play Command] Selected track: ${track.title} by ${track.author} (${track.source})`);
      
      // Validate track before adding to queue
      if (track.source === 'soundcloud') {
        console.log(`[Play Command] SoundCloud track detected - checking for restrictions`);
        
        // Check if track has metadata that might indicate restrictions
        if (track.raw && track.raw.monetization_model === 'AD_SUPPORTED') {
          console.log(`[Play Command] ⚠️ Ad-supported track detected - may cause issues`);
        }
        
        if (track.raw && track.raw.license === 'all-rights-reserved') {
          console.log(`[Play Command] ⚠️ All-rights-reserved track - may have restrictions`);
        }
        
        // Check if track is streamable
        if (track.raw && track.raw.streamable === false) {
          console.log(`[Play Command] ❌ Track is not streamable - skipping`);
          return interaction.editReply({ 
            content: '❌ This SoundCloud track is not available for streaming. Try a different track.' 
          });
        }
      }
      
      // Add track to queue
      queue.addTrack(track);
      
      // Create embed
      const embed = new EmbedBuilder()
        .setColor(isLocalFile ? '#00bfff' : (track.source === 'soundcloud' ? '#ff8800' : '#00ff00'))
        .setTitle(isLocalFile ? '🎵 Local Track Added' : '🎵 Track Added')
        .setDescription(`**${track.title}** by ${track.author}`)
        .setThumbnail(track.thumbnail)
        .addFields(
          { name: 'Duration', value: track.duration, inline: true },
          { name: 'Source', value: track.source, inline: true },
          { name: 'Position in Queue', value: `${queue.tracks.size}`, inline: true }
        )
        .setFooter({ text: `Requested by ${interaction.user.tag}` })
        .setTimestamp();
      
      // Add warning for SoundCloud tracks
      if (track.source === 'soundcloud') {
        embed.addFields({
          name: '⚠️ Note',
          value: 'This is a SoundCloud track. If it doesn\'t play properly, try searching for a different version.',
          inline: false
        });
      }
      
      // Start playing if not already playing
      if (!queue.isPlaying()) {
        console.log(`[Play Command] Starting playback of single track`);
        await queue.node.play();
        console.log(`[Play Command] Playback started successfully`);
      } else {
        console.log(`[Play Command] Queue is already playing, track added to queue`);
      }
      
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Play command error:', error);
      console.error('Error details:', error.stack);
      
      let errorMessage = '❌ An error occurred while trying to play the track!';
      
      // Provide more specific error messages
      if (error.message && error.message.includes('Could not extract stream')) {
        errorMessage = '❌ Could not extract audio stream from this source. Try a different track or URL.';
      } else if (error.message && error.message.includes('ENOTFOUND')) {
        errorMessage = '❌ Network error - could not connect to the audio source. Please try again.';
      } else if (error.message && error.message.includes('voice')) {
        errorMessage = '❌ Voice connection error. Please make sure I can join your voice channel.';
      }
      
      await interaction.editReply({ 
        content: errorMessage 
      });
    }
  },
};
