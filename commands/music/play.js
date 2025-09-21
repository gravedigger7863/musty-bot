const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const PlayifyFeatures = require('../../modules/playify-features');
const LavaPlayerFeatures = require('../../modules/lavaplayer-features');
const DopamineFeatures = require('../../modules/dopamine-features');

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
    const playify = new PlayifyFeatures();
    const lavaPlayer = new LavaPlayerFeatures();
    const dopamine = new DopamineFeatures();
    
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
        await queue.connect(interaction.member.voice.channel);
        console.log(`[Play Command] ✅ Connected to voice channel successfully`);
      }
      
      let track;
      
      // Search for tracks using Playify's smart search strategy
      const searchEngine = playify.getOptimalSearchEngine(query);
      
      let searchResult = null;
      
      try {
        searchResult = await client.player.search(query, {
          requestedBy: interaction.user,
          searchEngine: searchEngine
        });
        
        if (searchResult.hasTracks()) {
          console.log(`[Play Command] ✅ Found ${searchResult.tracks.length} tracks`);
        }
      } catch (error) {
        console.log(`[Play Command] ${searchEngine} search failed:`, error.message);
        
             // If YouTube is blocked, try multiple fallbacks
             if (error.message.includes('Sign in to confirm') || error.message.includes('bot')) {
               console.log(`[Play Command] YouTube blocked, trying alternative sources...`);
               
               try {
                 await interaction.followUp({
                   content: '⚠️ YouTube is blocked, trying alternative sources...',
                   ephemeral: true
                 });
               } catch (followUpError) {
                 // Ignore follow-up errors
               }

               // Try Spotify first
               try {
                 searchResult = await client.player.search(query, {
                   requestedBy: interaction.user,
                   searchEngine: 'spotify'
                 });
                 if (searchResult.hasTracks()) {
                   console.log(`[Play Command] ✅ Found ${searchResult.tracks.length} Spotify tracks`);
                 }
               } catch (spotifyError) {
                 console.log(`[Play Command] Spotify search failed:`, spotifyError.message);
               }

               // If Spotify failed, try SoundCloud
               if (!searchResult || !searchResult.hasTracks()) {
                 try {
                   searchResult = await client.player.search(query, {
                     requestedBy: interaction.user,
                     searchEngine: 'soundcloud'
                   });
                   if (searchResult.hasTracks()) {
                     console.log(`[Play Command] ✅ Found ${searchResult.tracks.length} SoundCloud tracks`);
                   }
                 } catch (soundcloudError) {
                   console.log(`[Play Command] SoundCloud search failed:`, soundcloudError.message);
                 }
               }
             }
        
        // Final fallback to auto search
        if (!searchResult || !searchResult.hasTracks()) {
          try {
            searchResult = await client.player.search(query, {
              requestedBy: interaction.user,
              searchEngine: 'auto'
            });
          } catch (autoError) {
            // Search failed, will be handled below
          }
        }
      }
      
         if (!searchResult.hasTracks()) {
           return interaction.editReply({
             content: '❌ No tracks found for your query! Try searching for a different song or check if the song name is correct.'
           });
         }
      
      // Use Playify's smart track selection
      const tracks = searchResult.tracks;
      
      // Find the best track using Playify's strategy
      let bestTrack = null;
      
      // First, try to find a YouTube track
      bestTrack = tracks.find(t => t.source === 'youtube');
      
      // If no YouTube track, try other sources (avoid SoundCloud if possible)
      if (!bestTrack) {
        bestTrack = tracks.find(t => t.source !== 'soundcloud');
      }
      
      // If only SoundCloud tracks available, try to find one without restrictions
      if (!bestTrack) {
        const soundcloudTracks = tracks.filter(t => t.source === 'soundcloud');
        
        // Try to find a track without ad support or restrictions
        bestTrack = soundcloudTracks.find(t => 
          !t.raw?.monetization_model || 
          t.raw?.monetization_model !== 'AD_SUPPORTED'
        );
        
        // If no good SoundCloud track found, use the first one
        if (!bestTrack) {
          bestTrack = tracks[0];
        }
      }
      
      track = bestTrack;
      
      // LavaPlayer-inspired track validation
      const validation = lavaPlayer.validateTrack(track);
      if (!validation.isValid) {
        // If track has critical issues, try to find a better one
        if (validation.issues.includes('Invalid duration') || validation.issues.includes('Track too long')) {
          const alternativeTrack = tracks.find(t => t !== track && lavaPlayer.validateTrack(t).isValid);
          if (alternativeTrack) {
            track = alternativeTrack;
          }
        }
      }
      
      // Additional SoundCloud-specific validation
      if (track.source === 'soundcloud') {
        if (track.raw && track.raw.streamable === false) {
          return interaction.editReply({ 
            content: '❌ This SoundCloud track is not available for streaming. Try a different track.' 
          });
        }
      }
      
      // Add track to queue
      queue.addTrack(track);
      
      // Create enhanced embed using Playify features
      const embed = playify.createNowPlayingEmbed(track, queue);
      embed.setTitle('🎵 Track Added to Queue')
        .setFooter({ text: `Requested by ${interaction.user.tag}` });
      
      // Add validation warnings if any
      const trackValidation = lavaPlayer.validateTrack(track);
      if (!trackValidation.isValid && trackValidation.issues.length > 0) {
        embed.addFields({
          name: '⚠️ Track Issues',
          value: trackValidation.issues.join(', '),
          inline: false
        });
      }
      
      // Add warning for SoundCloud tracks
      if (track.source === 'soundcloud') {
        embed.addFields({
          name: '⚠️ SoundCloud Note',
          value: 'This is a SoundCloud track. If it doesn\'t play properly, try searching for a different version.',
          inline: false
        });
      }
      
      // Start playing if not already playing
      if (!queue.isPlaying()) {
        await queue.node.play();
      }
      
      await interaction.editReply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Play command error:', error);
      console.error('Error details:', error.stack);
      
      // Use Playify's enhanced error handling
      const errorMessage = playify.handlePlaybackError(error, queue);
      
      await interaction.editReply({ 
        content: `❌ ${errorMessage}` 
      });
    }
  },
};
