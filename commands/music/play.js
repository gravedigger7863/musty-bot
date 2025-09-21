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
    
    // Initialize features only once (reuse from client if available)
    const playify = client.playify || new PlayifyFeatures();
    const lavaPlayer = client.lavaPlayer || new LavaPlayerFeatures();
    const dopamine = client.dopamine || new DopamineFeatures();
    
    // Store features in client for reuse
    if (!client.playify) client.playify = playify;
    if (!client.lavaPlayer) client.lavaPlayer = lavaPlayer;
    if (!client.dopamine) client.dopamine = dopamine;
    
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
      
         // Optimized search strategy - try sources sequentially to avoid duplicates
         let searchResult = null;
         const searchEngines = ['spotify', 'soundcloud', 'youtube']; // Prioritize working sources
         
         for (const engine of searchEngines) {
           try {
             console.log(`[Play Command] Trying ${engine} search...`);
             searchResult = await client.player.search(query, {
               requestedBy: interaction.user,
               searchEngine: engine
             });
             
             if (searchResult.hasTracks()) {
               console.log(`[Play Command] ✅ Found ${searchResult.tracks.length} tracks from ${engine}`);
               break; // Use the first successful search
             }
           } catch (error) {
             console.log(`[Play Command] ${engine} search failed:`, error.message);
           }
         }
      
         if (!searchResult.hasTracks()) {
           return interaction.editReply({
             content: '❌ No tracks found for your query! Try searching for a different song or check if the song name is correct.'
           });
         }
      
      // Use smart track selection (prioritize working sources)
      const tracks = searchResult.tracks;
      
      // Find the best track - prioritize non-YouTube sources due to blocking
      let bestTrack = null;

      // First, try to find a Spotify track (most reliable)
      bestTrack = tracks.find(t => t.source === 'spotify');

      // If no Spotify track, try SoundCloud
      if (!bestTrack) {
        bestTrack = tracks.find(t => t.source === 'soundcloud');
      }

      // If no Spotify or SoundCloud, try other sources (avoid YouTube if possible)
      if (!bestTrack) {
        bestTrack = tracks.find(t => t.source !== 'youtube');
      }

      // If only YouTube tracks available, use the first one (with warning)
      if (!bestTrack) {
        bestTrack = tracks[0];
        console.log(`[Play Command] ⚠️ Only YouTube tracks available - may have playback issues`);
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
      
      // Add source information
      embed.addFields({
        name: '📡 Source',
        value: track.source.charAt(0).toUpperCase() + track.source.slice(1),
        inline: true
      });
      
      // Add validation warnings if any
      const trackValidation = lavaPlayer.validateTrack(track);
      if (!trackValidation.isValid && trackValidation.issues.length > 0) {
        embed.addFields({
          name: '⚠️ Track Issues',
          value: trackValidation.issues.join(', '),
          inline: false
        });
      }
      
      // Add warning for YouTube tracks (due to blocking issues)
      if (track.source === 'youtube') {
        embed.addFields({
          name: '⚠️ YouTube Note',
          value: 'This is a YouTube track. Due to bot detection, it may not play properly. Try searching for the same song on Spotify or SoundCloud.',
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
