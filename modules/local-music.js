const fs = require('fs');
const path = require('path');

class LocalMusicManager {
  constructor(musicPath = '/home/music') {
    this.musicPath = musicPath;
    this.cache = new Map();
    this.lastScan = 0;
    this.scanInterval = 300000; // 5 minutes
  }

  // Scan for music files and build cache
  async scanMusicFiles() {
    const now = Date.now();
    if (now - this.lastScan < this.scanInterval && this.cache.size > 0) {
      return this.cache;
    }

    console.log('🔍 Scanning local music files...');
    this.cache.clear();
    
    try {
      await this._scanDirectory(this.musicPath);
      this.lastScan = now;
      console.log(`✅ Found ${this.cache.size} local music files`);
    } catch (error) {
      console.error('❌ Error scanning music files:', error);
    }

    return this.cache;
  }

  async _scanDirectory(dir) {
    const items = await fs.promises.readdir(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory()) {
        await this._scanDirectory(fullPath);
      } else if (this._isMusicFile(item.name)) {
        const relativePath = path.relative(this.musicPath, fullPath);
        const trackInfo = {
          title: path.parse(item.name).name,
          author: path.basename(path.dirname(relativePath)),
          duration: 'Unknown',
          source: 'local',
          url: fullPath,
          thumbnail: null,
          relativePath: relativePath
        };
        
        this.cache.set(relativePath.toLowerCase(), trackInfo);
      }
    }
  }

  _isMusicFile(filename) {
    const musicExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac'];
    const ext = path.extname(filename).toLowerCase();
    return musicExtensions.includes(ext);
  }

  // Search for tracks by query
  async searchTracks(query) {
    await this.scanMusicFiles();
    const results = [];
    const searchTerm = query.toLowerCase();

    for (const [path, track] of this.cache) {
      if (
        track.title.toLowerCase().includes(searchTerm) ||
        track.author.toLowerCase().includes(searchTerm) ||
        path.includes(searchTerm)
      ) {
        results.push(track);
      }
    }

    return results.sort((a, b) => {
      // Prioritize exact matches in title
      const aTitleMatch = a.title.toLowerCase().includes(searchTerm);
      const bTitleMatch = b.title.toLowerCase().includes(searchTerm);
      if (aTitleMatch && !bTitleMatch) return -1;
      if (!aTitleMatch && bTitleMatch) return 1;
      return 0;
    });
  }

  // Get all tracks
  async getAllTracks() {
    await this.scanMusicFiles();
    return Array.from(this.cache.values());
  }

  // Get tracks by artist
  async getTracksByArtist(artist) {
    await this.scanMusicFiles();
    const results = [];
    const searchTerm = artist.toLowerCase();

    for (const track of this.cache.values()) {
      if (track.author.toLowerCase().includes(searchTerm)) {
        results.push(track);
      }
    }

    return results;
  }

  // Get random tracks
  async getRandomTracks(count = 10) {
    await this.scanMusicFiles();
    const tracks = Array.from(this.cache.values());
    const shuffled = tracks.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }
}

module.exports = LocalMusicManager;
