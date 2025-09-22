const { EmbedBuilder } = require('discord.js');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Track } = require('discord-player');
const CustomStreamHandler = require('./custom-stream-handler');

class YtdlpIntegration {
  constructor() {
    this.downloadQueue = new Map(); // Guild ID -> download queue
    this.downloadedFiles = new Map(); // Guild ID -> downloaded files
    this.downloadsPath = path.join(__dirname, '..', 'downloads');
    this.streamHandler = new CustomStreamHandler();
    
    // Ensure downloads directory exists
    if (!fs.existsSync(this.downloadsPath)) {
      fs.mkdirSync(this.downloadsPath, { recursive: true });
    }
  }

  // Download music using yt-dlp
  async downloadTrack(url, guildId, requestedBy) {
    try {
      const filename = this.generateFilename(guildId);
      const filePath = path.join(this.downloadsPath, filename);
      
      console.log(`[YtDlp] Starting download from: ${url}`);
      
      const ytdlp = spawn('yt-dlp', [
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '192K',
        '--output', filePath.replace('.mp3', '.%(ext)s'),
        '--no-playlist',
        '--no-warnings',
        '--quiet',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        '--referer', 'https://www.youtube.com/',
        '--sleep-requests', '1',
        '--sleep-interval', '1',
        '--max-sleep-interval', '2',
        url
      ]);

      return new Promise((resolve, reject) => {
        let stderr = '';
        
        ytdlp.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        ytdlp.on('close', (code) => {
          if (code === 0) {
            // Find the actual downloaded file
            const actualFilePath = this.findDownloadedFile(guildId);
            if (actualFilePath && fs.existsSync(actualFilePath)) {
              const fileInfo = {
                filename: path.basename(actualFilePath),
                filePath: actualFilePath,
                originalUrl: url,
                requestedBy,
                downloadedAt: Date.now(),
                size: fs.statSync(actualFilePath).size
              };
              
              // Store file info
              if (!this.downloadedFiles.has(guildId)) {
                this.downloadedFiles.set(guildId, []);
              }
              this.downloadedFiles.get(guildId).push(fileInfo);
              
            console.log(`[YtDlp] ✅ Downloaded: ${fileInfo.filename} (${fileInfo.size} bytes)`);
            
            // Register the downloaded file with stream handler
            this.streamHandler.registerDownloadedFile(url, actualFilePath);
            
            resolve(fileInfo);
            } else {
              reject(new Error('Downloaded file not found'));
            }
          } else {
            console.error(`[YtDlp] Download failed with code ${code}:`, stderr);
            reject(new Error(`yt-dlp failed: ${stderr}`));
          }
        });

        ytdlp.on('error', (error) => {
          console.error(`[YtDlp] Spawn error:`, error);
          reject(error);
        });
      });

    } catch (error) {
      console.error('YtDlp download error:', error);
      throw error;
    }
  }

  // Find the actual downloaded file
  findDownloadedFile(guildId) {
    try {
      const files = fs.readdirSync(this.downloadsPath);
      const guildFile = files.find(file => file.startsWith(`${guildId}_`));
      if (guildFile) {
        return path.join(this.downloadsPath, guildFile);
      }
      return null;
    } catch (error) {
      console.error('Error finding downloaded file:', error);
      return null;
    }
  }

  // Generate unique filename
  generateFilename(guildId) {
    const timestamp = Date.now();
    return `${guildId}_${timestamp}.mp3`;
  }

  // Download and create local track object
  async downloadAndPlay(url, guildId, requestedBy, player) {
    try {
      // Check if already downloading
      if (this.downloadQueue.has(guildId)) {
        throw new Error('Download already in progress for this server');
      }

      this.downloadQueue.set(guildId, true);

      const fileInfo = await this.downloadTrack(url, guildId, requestedBy);
      
      // Get track metadata using yt-dlp
      const metadata = await this.getTrackMetadata(url);
      
      // Create a proper Track object for discord-player
      // Try using local file path as URL to see if Discord Player can handle it
      const localTrack = new Track(player, {
        title: metadata.title || this.extractTitleFromFilename(fileInfo.filename),
        description: metadata.description || 'Downloaded track',
        author: metadata.uploader || metadata.artist || 'Unknown Artist',
        url: `file://${fileInfo.filePath}`, // Try file:// protocol for local files
        thumbnail: metadata.thumbnail || null,
        duration: metadata.duration_string || '0:00',
        durationMS: metadata.duration * 1000 || 0,
        views: metadata.view_count || 0,
        requestedBy: requestedBy,
        source: 'local',
        isLocal: true,
        raw: {
          ...metadata,
          localPath: fileInfo.filePath,
          downloadedAt: fileInfo.downloadedAt,
          fileSize: fileInfo.size,
          originalUrl: url,
          isDownloaded: true
        }
      });

      this.downloadQueue.delete(guildId);
      return localTrack;

    } catch (error) {
      this.downloadQueue.delete(guildId);
      throw error;
    }
  }

  // Get track metadata using yt-dlp
  async getTrackMetadata(url) {
    return new Promise((resolve, reject) => {
      const ytdlp = spawn('yt-dlp', [
        '--dump-json',
        '--no-playlist',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        '--referer', 'https://www.youtube.com/',
        url
      ]);

      let stdout = '';
      let stderr = '';

      ytdlp.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ytdlp.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ytdlp.on('close', (code) => {
        if (code === 0) {
          try {
            const metadata = JSON.parse(stdout);
            resolve(metadata);
          } catch (error) {
            console.error('[YtDlp] Error parsing metadata JSON:', error);
            resolve({}); // Return empty metadata if parsing fails
          }
        } else {
          console.error(`[YtDlp] Metadata extraction failed with code ${code}:`, stderr);
          resolve({}); // Return empty metadata if extraction fails
        }
      });

      ytdlp.on('error', (error) => {
        console.error('[YtDlp] Metadata extraction spawn error:', error);
        resolve({}); // Return empty metadata if spawn fails
      });
    });
  }

  // Extract title from filename (basic implementation)
  extractTitleFromFilename(filename) {
    // Remove guild ID and timestamp, keep the rest as title
    return filename.replace(/^\d+_\d+\./, '').replace(/\.mp3$/, '') || 'Downloaded Track';
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
              console.log(`[YtDlp] 🗑️ Deleted old file: ${file.filename}`);
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
      .setTitle('📥 Download Status (yt-dlp)')
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

  // Check if URL is supported by yt-dlp
  isSupportedUrl(url) {
    // yt-dlp supports almost everything, but let's prioritize YouTube and other major platforms
    const supportedDomains = [
      'youtube.com',
      'youtu.be',
      'spotify.com',
      'open.spotify.com',
      'tiktok.com',
      'vm.tiktok.com',
      'instagram.com',
      'twitter.com',
      'x.com',
      'twitch.tv',
      'vimeo.com',
      'bandcamp.com',
      'mixcloud.com'
    ];
    
    try {
      const urlObj = new URL(url);
      return supportedDomains.some(domain => 
        urlObj.hostname.includes(domain)
      ) || true; // yt-dlp supports most URLs
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

  // Test yt-dlp installation
  async testInstallation() {
    return new Promise((resolve, reject) => {
      const ytdlp = spawn('yt-dlp', ['--version']);
      
      ytdlp.on('close', (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          reject(new Error('yt-dlp not working properly'));
        }
      });
      
      ytdlp.on('error', (error) => {
        reject(error);
      });
    });
  }

  // Cleanup resources
  cleanup(guildId) {
    this.downloadQueue.delete(guildId);
    this.downloadedFiles.delete(guildId);
    console.log(`[YtDlp] 🧹 Cleaned up yt-dlp integration for guild ${guildId}`);
  }
}

module.exports = YtdlpIntegration;
