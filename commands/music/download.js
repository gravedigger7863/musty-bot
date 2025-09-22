const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const CobaltIntegration = require('../../modules/cobalt-integration');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('download')
    .setDescription('Download music locally using Cobalt.tools')
    .addStringOption(option =>
      option
        .setName('url')
        .setDescription('URL of the track to download (YouTube, Spotify, SoundCloud, etc.)')
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option
        .setName('play_after')
        .setDescription('Play the downloaded track immediately')
        .setRequired(false)
    ),

  async execute(interaction) {
    const cobalt = new CobaltIntegration();
    const url = interaction.options.getString('url');
    const playAfter = interaction.options.getBoolean('play_after') || false;

    try {
      await interaction.deferReply();

      // Check if URL is supported
      if (!cobalt.isSupportedUrl(url)) {
        return interaction.editReply({
          content: '❌ This URL is not supported by Cobalt.tools. Supported platforms: YouTube, Spotify, SoundCloud, TikTok, Instagram, Twitter, Twitch'
        });
      }

      // Check if already downloading
      if (cobalt.downloadQueue.has(interaction.guildId)) {
        return interaction.editReply({
          content: '⏳ A download is already in progress for this server. Please wait for it to complete.'
        });
      }

      const statusEmbed = new EmbedBuilder()
        .setColor('#ffaa00')
        .setTitle('📥 Starting Download')
        .setDescription(`Downloading from: ${url}`)
        .addFields(
          { name: 'Status', value: '⏳ Processing...', inline: true },
          { name: 'Platform', value: this.getPlatformName(url), inline: true },
          { name: 'Play After', value: playAfter ? 'Yes' : 'No', inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [statusEmbed] });

      // Download the track
      const localTrack = await cobalt.downloadAndPlay(
        url, 
        interaction.guildId, 
        interaction.user, 
        interaction.client.player
      );

      // Create success embed
      const successEmbed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Download Complete')
        .setDescription(`**${localTrack.title}** has been downloaded successfully!`)
        .addFields(
          { name: 'File Size', value: this.formatFileSize(localTrack.filePath), inline: true },
          { name: 'Downloaded At', value: new Date().toLocaleString(), inline: true },
          { name: 'Status', value: playAfter ? '🎵 Playing now...' : '📁 Saved locally', inline: true }
        )
        .setTimestamp();

      // If play_after is true, add to queue
      if (playAfter) {
        const queue = interaction.client.player.nodes.get(interaction.guildId);
        
        if (!queue) {
          // Create new queue if none exists
          const voiceChannel = interaction.member.voice.channel;
          if (!voiceChannel) {
            return interaction.editReply({
              content: '❌ You need to be in a voice channel to play music!'
            });
          }

          await interaction.client.player.play(voiceChannel, localTrack, {
            nodeOptions: {
              metadata: interaction.channel
            }
          });

          successEmbed.addFields({
            name: '🎵 Now Playing',
            value: `**${localTrack.title}**\n*Local download*`,
            inline: false
          });
        } else {
          queue.addTrack(localTrack);
          successEmbed.addFields({
            name: '🎵 Added to Queue',
            value: `**${localTrack.title}**\n*Position: ${queue.tracks.count + 1}*`,
            inline: false
          });
        }
      }

      await interaction.editReply({ embeds: [successEmbed] });

      // Clean up old downloads periodically
      if (Math.random() < 0.1) { // 10% chance to clean up
        cobalt.cleanupOldDownloads();
      }

    } catch (error) {
      console.error('Download command error:', error);
      
      let errorMessage = '❌ Download failed. ';
      if (error.message.includes('timeout')) {
        errorMessage += 'The download timed out. Try again with a shorter video.';
      } else if (error.message.includes('not supported')) {
        errorMessage += 'This URL is not supported.';
      } else if (error.message.includes('already in progress')) {
        errorMessage += 'A download is already in progress.';
      } else {
        errorMessage += 'Please try again later.';
      }

      const errorEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Download Failed')
        .setDescription(errorMessage)
        .addFields(
          { name: 'Error', value: error.message.substring(0, 100), inline: false },
          { name: 'URL', value: url.substring(0, 100), inline: false }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },

  getPlatformName(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      if (hostname.includes('youtube') || hostname.includes('youtu.be')) return 'YouTube';
      if (hostname.includes('spotify')) return 'Spotify';
      if (hostname.includes('soundcloud')) return 'SoundCloud';
      if (hostname.includes('tiktok')) return 'TikTok';
      if (hostname.includes('instagram')) return 'Instagram';
      if (hostname.includes('twitter') || hostname.includes('x.com')) return 'Twitter/X';
      if (hostname.includes('twitch')) return 'Twitch';
      
      return 'Unknown';
    } catch {
      return 'Invalid URL';
    }
  },

  formatFileSize(filePath) {
    try {
      const stats = fs.statSync(filePath);
      const bytes = stats.size;
      
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    } catch {
      return 'Unknown';
    }
  }
};
