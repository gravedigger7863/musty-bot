const { EmbedBuilder } = require('discord.js');

class DopamineFeatures {
  constructor() {
    this.themes = {
      dark: {
        primary: '#1a1a1a',
        secondary: '#2d2d2d',
        accent: '#00d4aa',
        text: '#ffffff',
        textSecondary: '#b3b3b3'
      },
      light: {
        primary: '#ffffff',
        secondary: '#f5f5f5',
        accent: '#007acc',
        text: '#333333',
        textSecondary: '#666666'
      },
      purple: {
        primary: '#2d1b69',
        secondary: '#4a2c8a',
        accent: '#9c27b0',
        text: '#ffffff',
        textSecondary: '#e1bee7'
      }
    };
    
    this.currentTheme = 'dark';
    this.musicLibrary = new Map(); // Guild ID -> music library data
    this.lyricsCache = new Map(); // Track ID -> lyrics
  }

  // Dopamine-inspired clean design embeds
  createCleanEmbed(title, description, theme = this.currentTheme) {
    const colors = this.themes[theme];
    
    return new EmbedBuilder()
      .setColor(colors.accent)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp()
      .setFooter({ 
        text: '🎵 Musty Bot - Clean & Simple',
        iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.png' // Add bot icon
      });
  }

  // Music library management (inspired by Dopamine's organization)
  addToLibrary(guildId, track, category = 'recent') {
    if (!this.musicLibrary.has(guildId)) {
      this.musicLibrary.set(guildId, {
        recent: [],
        favorites: [],
        playlists: new Map(),
        artists: new Map(),
        genres: new Map()
      });
    }
    
    const library = this.musicLibrary.get(guildId);
    
    // Add to recent (keep last 50)
    library.recent.unshift({
      title: track.title,
      author: track.author,
      duration: track.durationMS,
      source: track.source,
      addedAt: Date.now(),
      playCount: 1
    });
    
    if (library.recent.length > 50) {
      library.recent.pop();
    }
    
    // Organize by artist
    if (!library.artists.has(track.author)) {
      library.artists.set(track.author, []);
    }
    library.artists.get(track.author).push(track);
    
    console.log(`📚 Added to library: ${track.title} by ${track.author}`);
  }

  // Get organized music data
  getLibraryData(guildId, type = 'recent', limit = 10) {
    const library = this.musicLibrary.get(guildId);
    if (!library) return [];
    
    switch (type) {
      case 'recent':
        return library.recent.slice(0, limit);
      case 'favorites':
        return library.favorites.slice(0, limit);
      case 'artists':
        return Array.from(library.artists.keys()).slice(0, limit);
      case 'genres':
        return Array.from(library.genres.keys()).slice(0, limit);
      default:
        return library.recent.slice(0, limit);
    }
  }

  // Lyrics support (Dopamine feature)
  async fetchLyrics(track) {
    const cacheKey = `${track.source}_${track.title}_${track.author}`;
    
    if (this.lyricsCache.has(cacheKey)) {
      return this.lyricsCache.get(cacheKey);
    }
    
    try {
      // Simple lyrics fetching (you can integrate with a lyrics API)
      const lyrics = await this.searchLyrics(track.title, track.author);
      this.lyricsCache.set(cacheKey, lyrics);
      return lyrics;
    } catch (error) {
      console.error('Error fetching lyrics:', error);
      return null;
    }
  }

  async searchLyrics(title, artist) {
    // Placeholder for lyrics search
    // You can integrate with lyrics-finder or other APIs
    return `🎵 Lyrics for "${title}" by ${artist}\n\n[Lyrics would be fetched here]\n\n*Powered by Musty Bot*`;
  }

  // Clean progress bar (Dopamine-inspired)
  createProgressBar(current, total, length = 20) {
    if (!total || total <= 0) return '▬'.repeat(length);
    
    const progress = Math.min(current / total, 1);
    const filled = Math.floor(progress * length);
    
    let bar = '';
    for (let i = 0; i < length; i++) {
      if (i < filled) {
        bar += '█';
      } else if (i === filled) {
        bar += '🔘';
      } else {
        bar += '▬';
      }
    }
    
    return bar;
  }

  // Format time (Dopamine style)
  formatTime(ms) {
    if (!ms || ms < 0) return '0:00';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
  }

  // Create now playing embed (Dopamine-inspired clean design)
  createNowPlayingEmbed(track, queue, theme = this.currentTheme) {
    const colors = this.themes[theme];
    const timestamp = queue.node.getTimestamp();
    const current = timestamp?.current?.value || 0;
    const total = track.durationMS || 0;
    
    const embed = this.createCleanEmbed(
      '🎵 Now Playing',
      `**[${track.title}](${track.url})**\nby ${track.author}`,
      theme
    );
    
    // Add progress bar
    const progressBar = this.createProgressBar(current, total);
    const currentTime = this.formatTime(current);
    const totalTime = this.formatTime(total);
    
    embed.addFields({
      name: 'Progress',
      value: `${progressBar}\n${currentTime} / ${totalTime}`,
      inline: false
    });
    
    // Add track info
    embed.addFields(
      { name: 'Source', value: track.source, inline: true },
      { name: 'Volume', value: `${queue.node.volume}%`, inline: true },
      { name: 'Queue', value: `${queue.tracks.count} tracks`, inline: true }
    );
    
    // Add thumbnail
    if (track.thumbnail) {
      embed.setThumbnail(track.thumbnail);
    }
    
    return embed;
  }

  // Create library embed (Dopamine-inspired organization)
  createLibraryEmbed(guildId, type = 'recent', theme = this.currentTheme) {
    const colors = this.themes[theme];
    const data = this.getLibraryData(guildId, type, 10);
    
    if (data.length === 0) {
      return this.createCleanEmbed(
        '📚 Music Library',
        'No music in your library yet. Start playing some tracks!',
        theme
      );
    }
    
    const embed = this.createCleanEmbed(
      '📚 Music Library',
      `Showing ${type} tracks`,
      theme
    );
    
    const trackList = data.map((item, index) => {
      if (type === 'artists') {
        return `${index + 1}. **${item}**`;
      } else {
        return `${index + 1}. **${item.title}** by ${item.author}`;
      }
    }).join('\n');
    
    embed.addFields({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      value: trackList,
      inline: false
    });
    
    return embed;
  }

  // Create lyrics embed
  createLyricsEmbed(track, lyrics, theme = this.currentTheme) {
    const embed = this.createCleanEmbed(
      '🎤 Lyrics',
      `**${track.title}** by ${track.author}`,
      theme
    );
    
    if (lyrics) {
      // Truncate if too long
      const maxLength = 2000;
      const displayLyrics = lyrics.length > maxLength 
        ? lyrics.substring(0, maxLength) + '...'
        : lyrics;
      
      embed.setDescription(displayLyrics);
    } else {
      embed.setDescription('No lyrics found for this track.');
    }
    
    return embed;
  }

  // Theme management
  setTheme(theme) {
    if (this.themes[theme]) {
      this.currentTheme = theme;
      console.log(`🎨 Theme changed to: ${theme}`);
      return true;
    }
    return false;
  }

  getAvailableThemes() {
    return Object.keys(this.themes);
  }

  // Clean up old data
  cleanup(guildId) {
    this.musicLibrary.delete(guildId);
    console.log(`🧹 Cleaned up library for guild ${guildId}`);
  }

  // Get statistics (Dopamine-inspired)
  getStatistics(guildId) {
    const library = this.musicLibrary.get(guildId);
    if (!library) return null;
    
    const totalTracks = library.recent.length;
    const uniqueArtists = library.artists.size;
    const totalPlayTime = library.recent.reduce((sum, track) => sum + (track.duration || 0), 0);
    
    return {
      totalTracks,
      uniqueArtists,
      totalPlayTime: this.formatTime(totalPlayTime),
      mostPlayed: this.getMostPlayed(guildId)
    };
  }

  getMostPlayed(guildId, limit = 5) {
    const library = this.musicLibrary.get(guildId);
    if (!library) return [];
    
    return library.recent
      .sort((a, b) => (b.playCount || 1) - (a.playCount || 1))
      .slice(0, limit);
  }
}

module.exports = DopamineFeatures;
