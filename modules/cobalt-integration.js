const { EmbedBuilder } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class CobaltIntegration {
  constructor() {
    this.downloadQueue = new Map(); // Guild ID -> download queue
    this.downloadedFiles = new Map(); // Guild ID -> downloaded files
    this.cobaltApiUrl = 'https://api.cobalt.tools/api/json';
    this.downloadsPath = path.join(__dirname, '..', 'downloads');
    
    // Ensure downloads directory exists
    if (!fs.existsSync(this.downloadsPath)) {
      fs.mkdirSync(this.downloadsPath, { recursive: true });
    }
  }

  // Download music using Cobalt.tools API
  async downloadTrack(url, guildId, requestedBy) {
    try {
      const response = await axios.post(this.cobaltApiUrl, {
        url: url,
        vQuality: 'max',
        vFormat: 'mp4',
        aFormat: 'mp3',
        isAudioOnly: true,
        isNoTTWatermark: true,
        isTTFullAudio: true
      }, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 60000 // 60 seconds timeout
      });

      if (response.data && response.data.status === 'success' && response.data.url) {
        const downloadUrl = response.data.url;
        const filename = this.generateFilename(response.data.text || 'track', guildId);
        const filePath = path.join(this.downloadsPath, filename);
        
        // Download the file
        const fileResponse = await axios.get(downloadUrl, {
          responseType: 'stream',
          timeout: 300000 // 5 minutes for download
        });

        const writer = fs.createWriteStream(filePath);
        fileResponse.data.pipe(writer);

        return new Promise((resolve, reject) => {
          writer.on('finish', () => {
            // Store file info
            if (!this.downloadedFiles.has(guildId)) {
              this.downloadedFiles.set(guildId, []);
            }
            
            const fileInfo = {
              filename,
              filePath,
              originalUrl: url,
              requestedBy,
              downloadedAt: Date.now(),
              size: fs.statSync(filePath).size
            };
            
            this.downloadedFiles.get(guildId).push(fileInfo);
            
            console.log(`✅ Downloaded: ${filename} (${fileInfo.size} bytes)`);
            resolve(fileInfo);
          });
          
          writer.on('error', reject);
        });
      } else {
        throw new Error('Cobalt API returned unsuccessful response');
      }
    } catch (error) {
      console.error('Cobalt download error:', error.message);
      throw error;
    }
  }

  // Generate unique filename
  generateFilename(title, guildId) {
    const timestamp = Date.now();
    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    return `${guildId}_${safeTitle}_${timestamp}.mp3`;
  }

  // Download and play locally
  async downloadAndPlay(url, guildId, requestedBy, player) {
    try {
      // Check if already downloading
      if (this.downloadQueue.has(guildId)) {
        throw new Error('Download already in progress for this server');
      }

      this.downloadQueue.set(guildId, true);

      const fileInfo = await this.downloadTrack(url, guildId, requestedBy);
      
      // Create a local track object for discord-player
      const localTrack = {
        title: fileInfo.filename.replace('.mp3', ''),
        author: 'Local Download',
        url: fileInfo.filePath,
        duration: '0:00', // Will be determined by player
        thumbnail: null,
        source: 'local',
        requestedBy: requestedBy,
        isLocal: true
      };

      this.downloadQueue.delete(guildId);
      return localTrack;

    } catch (error) {
      this.downloadQueue.delete(guildId);
      throw error;
    }
  }

  // Get download status
  getDownloadStatus(guildId) {
    const isDownloading = this.downloadQueue.has(guildId);
    const downloadedFiles = this.downloadedFiles.get(guildId) || [];
    
    return {
      isDownloading,
      downloadedCount: downloadedFiles.length,
      totalSize: downloadedFiles.reduce((sum, file) => sum + file.size, 0),
      files: downloadedFiles.slice(-10) // Last 10 files
    };
  }

  // Clean up old downloads
  cleanupOldDownloads(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
    const now = Date.now();
    
    for (const [guildId, files] of this.downloadedFiles.entries()) {
      const validFiles = files.filter(file => {
        if (now - file.downloadedAt > maxAge) {
          // Delete old file
          try {
            if (fs.existsSync(file.filePath)) {
              fs.unlinkSync(file.filePath);
              console.log(`🗑️ Deleted old file: ${file.filename}`);
            }
          } catch (error) {
            console.error(`Error deleting file ${file.filename}:`, error.message);
          }
          return false;
        }
        return true;
      });
      
      this.downloadedFiles.set(guildId, validFiles);
    }
  }

  // Create download status embed
  createDownloadStatusEmbed(guildId) {
    const status = this.getDownloadStatus(guildId);
    const embed = new EmbedBuilder()
      .setColor(status.isDownloading ? '#ffaa00' : '#00ff00')
      .setTitle('📥 Download Status')
      .setDescription(status.isDownloading ? 'Download in progress...' : 'No downloads in progress')
      .addFields(
        { name: 'Downloaded Files', value: status.downloadedCount.toString(), inline: true },
        { name: 'Total Size', value: this.formatBytes(status.totalSize), inline: true },
        { name: 'Status', value: status.isDownloading ? '⏳ Downloading' : '✅ Ready', inline: true }
      )
      .setTimestamp();

    if (status.files.length > 0) {
      const fileList = status.files.map((file, index) => 
        `${index + 1}. ${file.filename} (${this.formatBytes(file.size)})`
      ).join('\n');
      
      embed.addFields({
        name: 'Recent Downloads',
        value: fileList.length > 1000 ? fileList.substring(0, 1000) + '...' : fileList,
        inline: false
      });
    }

    return embed;
  }

  // Format bytes to human readable
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Check if URL is supported by Cobalt
  isSupportedUrl(url) {
    const supportedDomains = [
      'youtube.com',
      'youtu.be',
      'soundcloud.com',
      'spotify.com',
      'open.spotify.com',
      'tiktok.com',
      'vm.tiktok.com',
      'instagram.com',
      'twitter.com',
      'x.com',
      'twitch.tv'
    ];
    
    try {
      const urlObj = new URL(url);
      return supportedDomains.some(domain => 
        urlObj.hostname.includes(domain)
      );
    } catch {
      return false;
    }
  }

  // Get download queue info
  getQueueInfo() {
    const activeDownloads = Array.from(this.downloadQueue.keys());
    const totalFiles = Array.from(this.downloadedFiles.values())
      .reduce((sum, files) => sum + files.length, 0);
    
    return {
      activeDownloads: activeDownloads.length,
      activeGuilds: activeDownloads,
      totalDownloadedFiles: totalFiles
    };
  }

  // Cleanup resources
  cleanup(guildId) {
    this.downloadQueue.delete(guildId);
    this.downloadedFiles.delete(guildId);
    console.log(`🧹 Cleaned up Cobalt integration for guild ${guildId}`);
  }
}

module.exports = CobaltIntegration;
