const { EmbedBuilder } = require('discord.js');

class LavaPlayerFeatures {
  constructor() {
    this.audioProcessors = new Map(); // Guild ID -> audio processors
    this.trackHistory = new Map(); // Guild ID -> track history
    this.performanceMetrics = new Map(); // Guild ID -> performance data
  }

  // LavaPlayer-inspired audio processing
  createAudioProcessor(guildId) {
    const processor = {
      volume: 100,
      filters: {
        bass: 0,
        treble: 0,
        reverb: 0,
        speed: 1.0,
        pitch: 1.0
      },
      equalizer: new Array(15).fill(0), // 15-band equalizer
      isProcessing: false
    };
    
    this.audioProcessors.set(guildId, processor);
    console.log(`🎛️ Created audio processor for guild ${guildId}`);
    return processor;
  }

  getAudioProcessor(guildId) {
    if (!this.audioProcessors.has(guildId)) {
      return this.createAudioProcessor(guildId);
    }
    return this.audioProcessors.get(guildId);
  }

  // Advanced equalizer (inspired by LavaPlayer's audio processing)
  setEqualizer(guildId, bands) {
    const processor = this.getAudioProcessor(guildId);
    
    if (bands.length !== 15) {
      throw new Error('Equalizer must have exactly 15 bands');
    }
    
    processor.equalizer = bands;
    processor.isProcessing = true;
    
    console.log(`🎚️ Set equalizer for guild ${guildId}:`, bands);
    return processor;
  }

  // Preset equalizer configurations
  getEqualizerPresets() {
    return {
      'flat': new Array(15).fill(0),
      'bass_boost': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.1, 0.2, 0.3],
      'treble_boost': [0.3, 0.2, 0.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      'vocal_boost': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0.1, 0.2, 0.3, 0.2, 0.1, 0],
      'rock': [0, 0, 0, 0, 0, 0, 0, 0, 0.1, 0.2, 0.3, 0.2, 0.1, 0, 0],
      'jazz': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.1, 0.2, 0.3, 0.2],
      'classical': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.1, 0.2],
      'electronic': [0.2, 0.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.1, 0.2, 0.3, 0.2]
    };
  }

  // Track history management (LavaPlayer-inspired)
  addToHistory(guildId, track) {
    if (!this.trackHistory.has(guildId)) {
      this.trackHistory.set(guildId, []);
    }
    
    const history = this.trackHistory.get(guildId);
    history.push({
      title: track.title,
      author: track.author,
      duration: track.durationMS,
      source: track.source,
      timestamp: Date.now()
    });
    
    // Keep only last 50 tracks
    if (history.length > 50) {
      history.shift();
    }
    
    console.log(`📚 Added to history: ${track.title} by ${track.author}`);
  }

  getHistory(guildId, limit = 10) {
    const history = this.trackHistory.get(guildId) || [];
    return history.slice(-limit).reverse();
  }

  // Performance monitoring (LavaPlayer-inspired)
  startPerformanceMonitoring(guildId) {
    const metrics = {
      tracksPlayed: 0,
      totalPlayTime: 0,
      averageTrackLength: 0,
      errors: 0,
      startTime: Date.now()
    };
    
    this.performanceMetrics.set(guildId, metrics);
    console.log(`📊 Started performance monitoring for guild ${guildId}`);
  }

  updatePerformanceMetrics(guildId, track, error = false) {
    const metrics = this.performanceMetrics.get(guildId);
    if (!metrics) return;
    
    metrics.tracksPlayed++;
    metrics.totalPlayTime += track.durationMS || 0;
    metrics.averageTrackLength = metrics.totalPlayTime / metrics.tracksPlayed;
    
    if (error) {
      metrics.errors++;
    }
    
    console.log(`📊 Updated metrics for guild ${guildId}: ${metrics.tracksPlayed} tracks, ${metrics.errors} errors`);
  }

  getPerformanceMetrics(guildId) {
    const metrics = this.performanceMetrics.get(guildId);
    if (!metrics) return null;
    
    const uptime = Date.now() - metrics.startTime;
    const errorRate = (metrics.errors / metrics.tracksPlayed) * 100 || 0;
    
    return {
      ...metrics,
      uptime,
      errorRate: errorRate.toFixed(2) + '%'
    };
  }

  // Advanced audio effects (LavaPlayer-inspired)
  applyAudioEffect(guildId, effect, value) {
    const processor = this.getAudioProcessor(guildId);
    
    switch (effect) {
      case 'volume':
        processor.volume = Math.max(0, Math.min(200, value));
        break;
      case 'bass':
        processor.filters.bass = Math.max(-1, Math.min(1, value));
        break;
      case 'treble':
        processor.filters.treble = Math.max(-1, Math.min(1, value));
        break;
      case 'reverb':
        processor.filters.reverb = Math.max(0, Math.min(1, value));
        break;
      case 'speed':
        processor.filters.speed = Math.max(0.25, Math.min(4, value));
        break;
      case 'pitch':
        processor.filters.pitch = Math.max(0.25, Math.min(4, value));
        break;
      default:
        throw new Error(`Unknown audio effect: ${effect}`);
    }
    
    processor.isProcessing = true;
    console.log(`🎵 Applied ${effect}: ${value} for guild ${guildId}`);
    return processor;
  }

  // LavaPlayer-inspired track validation
  validateTrack(track) {
    const issues = [];
    
    if (!track.title || track.title.trim() === '') {
      issues.push('Missing title');
    }
    
    if (!track.author || track.author.trim() === '') {
      issues.push('Missing author');
    }
    
    if (!track.durationMS || track.durationMS <= 0) {
      issues.push('Invalid duration');
    }
    
    if (!track.source) {
      issues.push('Missing source');
    }
    
    if (track.durationMS > 10 * 60 * 60 * 1000) { // 10 hours
      issues.push('Track too long (over 10 hours)');
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }

  // Create LavaPlayer-inspired embed
  createTrackInfoEmbed(track, processor = null) {
    const validation = this.validateTrack(track);
    
    const embed = new EmbedBuilder()
      .setColor(validation.isValid ? '#00ff00' : '#ffaa00')
      .setTitle('🎵 Track Information')
      .setDescription(`**${track.title}**\nby ${track.author}`)
      .setThumbnail(track.thumbnail)
      .addFields(
        { name: 'Duration', value: this.formatDuration(track.durationMS), inline: true },
        { name: 'Source', value: track.source, inline: true },
        { name: 'Status', value: validation.isValid ? '✅ Valid' : '⚠️ Issues detected', inline: true }
      )
      .setTimestamp();

    if (!validation.isValid) {
      embed.addFields({
        name: '⚠️ Issues',
        value: validation.issues.join(', '),
        inline: false
      });
    }

    if (processor && processor.isProcessing) {
      embed.addFields({
        name: '🎛️ Audio Processing',
        value: `Volume: ${processor.volume}%\nSpeed: ${processor.filters.speed}x\nPitch: ${processor.filters.pitch}x`,
        inline: false
      });
    }

    return embed;
  }

  // Utility functions
  formatDuration(ms) {
    if (!ms) return 'Unknown';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
  }

  // Cleanup resources
  cleanup(guildId) {
    this.audioProcessors.delete(guildId);
    this.trackHistory.delete(guildId);
    this.performanceMetrics.delete(guildId);
    console.log(`🧹 Cleaned up resources for guild ${guildId}`);
  }
}

module.exports = LavaPlayerFeatures;
