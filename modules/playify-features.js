const { EmbedBuilder } = require('discord.js');

class PlayifyFeatures {
  constructor() {
    this.audioFilters = {
      'slowed': { speed: 0.8, pitch: 0.8 },
      'nightcore': { speed: 1.2, pitch: 1.2 },
      'reverb': { reverb: 0.3 },
      'bassboost': { bass: 0.2 },
      'vaporwave': { speed: 0.9, pitch: 0.9, reverb: 0.2 },
      'chipmunk': { speed: 1.5, pitch: 1.5 },
      'deep': { speed: 0.7, pitch: 0.7 }
    };
    
    this.autoplayEnabled = new Map(); // Guild ID -> boolean
    this.queues = new Map(); // Guild ID -> queue data
  }

  // Audio Filter Management
  applyFilter(queue, filterName) {
    if (!this.audioFilters[filterName]) {
      throw new Error(`Unknown filter: ${filterName}`);
    }

    const filter = this.audioFilters[filterName];
    console.log(`🎛️ Applying ${filterName} filter to queue`);
    
    // Apply filter to the queue's audio filters
    if (queue.node.filters) {
      Object.assign(queue.node.filters, filter);
    }
    
    return filter;
  }

  getAvailableFilters() {
    return Object.keys(this.audioFilters);
  }

  // Autoplay Management
  enableAutoplay(guildId) {
    this.autoplayEnabled.set(guildId, true);
    console.log(`🔄 Autoplay enabled for guild ${guildId}`);
  }

  disableAutoplay(guildId) {
    this.autoplayEnabled.set(guildId, false);
    console.log(`🔄 Autoplay disabled for guild ${guildId}`);
  }

  isAutoplayEnabled(guildId) {
    return this.autoplayEnabled.get(guildId) || false;
  }

  // Enhanced Queue Management
  addToQueue(guildId, track) {
    if (!this.queues.has(guildId)) {
      this.queues.set(guildId, []);
    }
    
    const queue = this.queues.get(guildId);
    queue.push(track);
    console.log(`📝 Added ${track.title} to queue for guild ${guildId}`);
  }

  getQueue(guildId) {
    return this.queues.get(guildId) || [];
  }

  clearQueue(guildId) {
    this.queues.set(guildId, []);
    console.log(`🗑️ Cleared queue for guild ${guildId}`);
  }

  // Smart Track Recommendations
  async getSimilarTracks(track, client) {
    try {
      console.log(`🔍 Finding similar tracks for: ${track.title}`);
      
      // Search for similar tracks using the artist name
      const searchQuery = `${track.author} similar songs`;
      const searchResult = await client.player.search(searchQuery, {
        requestedBy: track.requestedBy,
        searchEngine: 'auto'
      });

      if (searchResult.hasTracks()) {
        // Return up to 3 similar tracks
        return searchResult.tracks.slice(0, 3);
      }
      
      return [];
    } catch (error) {
      console.error('❌ Error finding similar tracks:', error.message);
      return [];
    }
  }

  // Enhanced Embed Creation
  createNowPlayingEmbed(track, queue, filter = null) {
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('🎵 Now Playing')
      .setDescription(`**${track.title}**\nby ${track.author}`)
      .setThumbnail(track.thumbnail)
      .addFields(
        { name: 'Duration', value: this.formatDuration(track.durationMS), inline: true },
        { name: 'Source', value: track.source, inline: true },
        { name: 'Queue Position', value: `${queue.tracks.size + 1}`, inline: true }
      )
      .setTimestamp();

    if (filter) {
      embed.addFields({ name: '🎛️ Filter', value: filter, inline: true });
    }

    if (this.isAutoplayEnabled(queue.guild.id)) {
      embed.setFooter({ text: '🔄 Autoplay enabled' });
    }

    return embed;
  }

  createQueueEmbed(queue) {
    const tracks = queue.tracks.toArray();
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('📋 Music Queue')
      .setTimestamp();

    if (tracks.length === 0) {
      embed.setDescription('Queue is empty');
    } else {
      const queueList = tracks.slice(0, 10).map((track, index) => 
        `${index + 1}. **${track.title}** - ${track.author}`
      ).join('\n');
      
      embed.setDescription(queueList);
      
      if (tracks.length > 10) {
        embed.setFooter({ text: `And ${tracks.length - 10} more tracks...` });
      }
    }

    return embed;
  }

  // Utility Functions
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

  // Platform-specific optimizations
  getOptimalSearchEngine(query) {
    // YouTube for most queries
    if (query.includes('youtube.com') || query.includes('youtu.be')) {
      return 'youtube';
    }
    
    // Spotify for Spotify links
    if (query.includes('spotify.com')) {
      return 'spotify';
    }
    
    // SoundCloud for SoundCloud links
    if (query.includes('soundcloud.com')) {
      return 'soundcloud';
    }
    
    // Default to auto for general searches
    return 'auto';
  }

  // Enhanced error handling
  handlePlaybackError(error, queue) {
    console.error('❌ Playback error:', error.message);
    
    if (error.message.includes('Sign in to confirm')) {
      return 'YouTube is currently blocked. Trying alternative sources...';
    }
    
    if (error.message.includes('Could not extract stream')) {
      return 'Failed to extract audio stream. The track may be unavailable.';
    }
    
    if (error.message.includes('No tracks found')) {
      return 'No tracks found for your query. Try a different search term.';
    }
    
    return 'An error occurred during playback. Please try again.';
  }
}

module.exports = PlayifyFeatures;
