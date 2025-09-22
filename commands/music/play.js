const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const PlayifyFeatures = require('../../modules/playify-features');
const LavaPlayerFeatures = require('../../modules/lavaplayer-features');
const DopamineFeatures = require('../../modules/dopamine-features');
const CommandUtils = require('../../modules/command-utils');
const YtdlpIntegration = require('../../modules/ytdlp-integration');

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
    const utils = new CommandUtils();
    const ytdlp = new YtdlpIntegration();
    const query = interaction.options.getString('query');
    
    // Check cooldown
    const cooldown = utils.isOnCooldown(interaction.user.id, 'play');
    if (cooldown) {
      return interaction.editReply({
        embeds: [utils.createErrorEmbed('Cooldown', `Please wait ${cooldown} seconds before using this command again.`)]
      });
    }

    // Validate voice channel
    const voiceValidation = await utils.validateVoiceChannel(interaction);
    if (!voiceValidation.valid) {
      return interaction.editReply({
        embeds: [utils.createErrorEmbed('Voice Channel Required', voiceValidation.error)]
      });
    }

    // Initialize features only once (reuse from client if available)
    const playify = client.playify || new PlayifyFeatures();
    const lavaPlayer = client.lavaPlayer || new LavaPlayerFeatures();
    const dopamine = client.dopamine || new DopamineFeatures();
    
    // Store features in client for reuse
    if (!client.playify) client.playify = playify;
    if (!client.lavaPlayer) client.lavaPlayer = lavaPlayer;
    if (!client.dopamine) client.dopamine = dopamine;

    // Set cooldown
    utils.setCooldown(interaction.user.id, 'play');
    
    let queue; // Declare queue outside try block for error handling
    
    try {
      // Get or create queue
      queue = client.player.nodes.create(interaction.guild, {
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

      // Check if query is a direct URL that yt-dlp can handle
      const isDirectUrl = ytdlp.isSupportedUrl(query);
      
      if (isDirectUrl) {
        // Direct URL - download with yt-dlp
        console.log(`[Play Command] Direct URL detected, downloading with yt-dlp...`);
        
        const downloadEmbed = utils.createInfoEmbed(
          'Downloading Track',
          `Downloading track from ${query}...\nThis may take a few moments.`,
          '#ffaa00'
        );
        
        await interaction.editReply({ embeds: [downloadEmbed] });

        try {
          const localTrack = await ytdlp.downloadAndPlay(
            query, 
            interaction.guildId, 
            interaction.user, 
            client.player
          );
          
          track = localTrack;
          console.log(`[Play Command] ✅ Successfully downloaded: ${track.title}`);
          
        } catch (downloadError) {
          console.error(`[Play Command] yt-dlp download failed:`, downloadError);
          
          // Fallback to regular search if download fails
          console.log(`[Play Command] Falling back to regular search...`);
          const searchResult = await client.player.search(query, {
            requestedBy: interaction.user,
            searchEngine: 'youtube'
          });
          
          if (!searchResult.hasTracks()) {
            return interaction.editReply({
              embeds: [utils.createErrorEmbed('Download Failed', `Failed to download from ${query}. Please try a different URL or search term.`)]
            });
          }
          
          track = searchResult.tracks[0];
        }
      } else {
        // Search query - find track first, then download
        console.log(`[Play Command] Search query detected, finding track first...`);
        
        const searchEmbed = utils.createInfoEmbed(
          'Searching for Track',
          `Searching for "${query}"...`,
          '#0099ff'
        );
        
        await interaction.editReply({ embeds: [searchEmbed] });

        // Search for the track using extractors
        let searchResult = null;
        const searchEngines = ['spotify', 'soundcloud', 'youtube'];
        
        for (const engine of searchEngines) {
          try {
            console.log(`[Play Command] Trying ${engine} search...`);
            searchResult = await client.player.search(query, {
              requestedBy: interaction.user,
              searchEngine: engine
            });
            
            if (searchResult.hasTracks()) {
              console.log(`[Play Command] ✅ Found ${searchResult.tracks.length} tracks from ${engine}`);
              break;
            }
          } catch (error) {
            console.log(`[Play Command] ${engine} search failed:`, error.message);
          }
        }
        
        if (!searchResult || !searchResult.hasTracks()) {
          return interaction.editReply({
            embeds: [utils.createErrorEmbed('No Tracks Found', `No tracks found for "${query}". Try a different search term or URL.`)]
          });
        }

        const foundTrack = searchResult.tracks[0];
        console.log(`[Play Command] Found track: ${foundTrack.title} - ${foundTrack.author} (${foundTrack.source})`);
        
        // Now download the track using yt-dlp
        const downloadEmbed = utils.createInfoEmbed(
          'Downloading Track',
          `Downloading **${foundTrack.title}** by ${foundTrack.author}...\nThis may take a few moments.`,
          '#ffaa00'
        );
        
        await interaction.editReply({ embeds: [downloadEmbed] });

        try {
          const localTrack = await ytdlp.downloadAndPlay(
            foundTrack.url, 
            interaction.guildId, 
            interaction.user, 
            client.player
          );
          
          track = localTrack;
          console.log(`[Play Command] ✅ Successfully downloaded: ${track.title}`);
          
        } catch (downloadError) {
          console.error(`[Play Command] yt-dlp download failed:`, downloadError);
          
          // Use the original track if download fails
          track = foundTrack;
          console.log(`[Play Command] Using original track as fallback`);
          
          await interaction.followUp({
            content: '⚠️ **Note:** Download failed, using streaming instead. This may be less reliable.',
            ephemeral: true
          });
        }
      }
      
      // Add track to queue
      queue.addTrack(track);
      
      // Debug logging
      console.log(`[Play Command] Track added to queue:`, {
        title: track.title,
        author: track.author,
        url: track.url,
        source: track.source,
        isLocal: track.isLocal,
        duration: track.duration
      });
      
      // Create enhanced embed using utils
      const embed = utils.createTrackEmbed(track, queue, '🎵 Track Added to Queue');
      
      // Add download/streaming status
      const isLocalTrack = track.source === 'local' || track.isLocal;
      embed.addFields({
        name: '📡 Status',
        value: isLocalTrack ? '💾 Downloaded & Ready' : '🌐 Streaming',
        inline: true
      });

      // Add source information with emoji
      embed.addFields({
        name: '📡 Source',
        value: isLocalTrack ? '💾 Local Download' : `${utils.getSourceEmoji(track.source)} ${track.source.charAt(0).toUpperCase() + track.source.slice(1)}`,
        inline: true
      });

      // Add queue position if not first
      if (queue.tracks.count > 0) {
        embed.addFields({
          name: '📋 Queue Position',
          value: `${queue.tracks.count + 1} tracks in queue`,
          inline: true
        });
      }

      // Add download benefits if local
      if (isLocalTrack) {
        embed.addFields({
          name: '✅ Benefits',
          value: '• Faster playback\n• No streaming issues\n• Better reliability',
          inline: false
        });
      }
      
      // Start playing if not already playing
      if (!queue.isPlaying()) {
        console.log(`[Play Command] Starting playback...`);
        try {
          await queue.node.play();
          console.log(`[Play Command] ✅ Playback started successfully`);
        } catch (playError) {
          console.error(`[Play Command] ❌ Playback failed:`, playError);
          throw playError;
        }
      } else {
        console.log(`[Play Command] Already playing, track added to queue`);
      }

      // Create control buttons
      const controlButtons = utils.createMusicControlButtons(queue);
      const queueButtons = utils.createQueueControlButtons(queue);
      
      await interaction.editReply({ 
        embeds: [embed],
        components: [controlButtons, queueButtons]
      });
      
    } catch (error) {
      console.error('Play command error:', error);
      console.error('Error details:', error.stack);
      
      let errorMessage = 'An unexpected error occurred while playing the track.';
      
      if (error.message.includes('No tracks found')) {
        errorMessage = 'No tracks found for your search! Try a different song name or URL.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'The search timed out. Please try again with a shorter query.';
      } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
        errorMessage = 'Network error occurred. Please check your internet connection and try again.';
      } else if (error.message.includes('permission')) {
        errorMessage = 'Permission denied. Make sure I have the necessary permissions to join your voice channel.';
      }

      await interaction.editReply({
        embeds: [utils.createErrorEmbed('Playback Error', errorMessage, 'Try using a different song or check if the URL is valid.')]
      });
    }
  },
};
