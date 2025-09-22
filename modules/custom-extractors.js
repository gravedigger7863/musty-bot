const { BaseExtractor } = require('@discord-player/extractor');

class CustomYouTubeExtractor extends BaseExtractor {
  constructor() {
    super('custom-youtube', ['youtube.com', 'youtu.be']);
  }

  async validate(query) {
    return this.isYouTubeUrl(query) || this.isSearchQuery(query);
  }

  async handle(query, context) {
    try {
      const { requestedBy } = context;
      
      // Use yt-dlp for better reliability
      const ytdlp = require('ytdl-core');
      
      if (this.isYouTubeUrl(query)) {
        return await this.handleDirectUrl(query, requestedBy, ytdlp);
      } else {
        return await this.handleSearch(query, requestedBy, ytdlp);
      }
    } catch (error) {
      console.error('Custom YouTube extractor error:', error);
      throw error;
    }
  }

  isYouTubeUrl(query) {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    return youtubeRegex.test(query);
  }

  isSearchQuery(query) {
    // If it doesn't look like a URL, treat as search
    return !query.includes('http') && !query.includes('www.');
  }

  async handleDirectUrl(url, requestedBy, ytdlp) {
    try {
      const info = await ytdlp.getInfo(url);
      
      return {
        tracks: [{
          title: info.videoDetails.title,
          author: info.videoDetails.author.name,
          url: info.videoDetails.video_url,
          duration: this.parseDuration(info.videoDetails.lengthSeconds),
          thumbnail: info.videoDetails.thumbnails[0]?.url,
          source: 'youtube',
          requestedBy: requestedBy,
          isLive: info.videoDetails.isLive,
          views: parseInt(info.videoDetails.viewCount) || 0
        }]
      };
    } catch (error) {
      console.error('Direct URL handling error:', error);
      throw new Error('Failed to extract video information');
    }
  }

  async handleSearch(query, requestedBy, ytdlp) {
    try {
      // Use YouTube search API or scraping
      const searchResults = await this.searchYouTube(query);
      
      const tracks = searchResults.map(result => ({
        title: result.title,
        author: result.author,
        url: result.url,
        duration: result.duration,
        thumbnail: result.thumbnail,
        source: 'youtube',
        requestedBy: requestedBy,
        isLive: result.isLive || false,
        views: result.views || 0
      }));

      return { tracks };
    } catch (error) {
      console.error('Search handling error:', error);
      throw new Error('Failed to search for tracks');
    }
  }

  async searchYouTube(query) {
    // Simple YouTube search implementation
    // In production, you'd want to use a proper YouTube search API
    const axios = require('axios');
    
    try {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      // Parse search results from HTML (basic implementation)
      const results = this.parseSearchResults(response.data);
      return results.slice(0, 10); // Return top 10 results
    } catch (error) {
      console.error('YouTube search error:', error);
      return [];
    }
  }

  parseSearchResults(html) {
    // Basic HTML parsing for search results
    // This is a simplified implementation
    const results = [];
    
    try {
      // Extract video IDs from the HTML
      const videoIdRegex = /"videoId":"([^"]+)"/g;
      let match;
      
      while ((match = videoIdRegex.exec(html)) !== null && results.length < 10) {
        const videoId = match[1];
        const titleMatch = html.match(new RegExp(`"title":\\s*{\\s*"runs":\\s*\\[\\s*{\\s*"text":\\s*"([^"]+)"`, 'g'));
        const authorMatch = html.match(new RegExp(`"ownerText":\\s*{\\s*"runs":\\s*\\[\\s*{\\s*"text":\\s*"([^"]+)"`, 'g'));
        
        if (titleMatch && authorMatch) {
          results.push({
            id: videoId,
            title: this.decodeHtml(titleMatch[0].match(/"text":\s*"([^"]+)"/)[1]),
            author: this.decodeHtml(authorMatch[0].match(/"text":\s*"([^"]+)"/)[1]),
            url: `https://www.youtube.com/watch?v=${videoId}`,
            duration: '0:00', // Would need additional parsing
            thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            views: 0
          });
        }
      }
    } catch (error) {
      console.error('Error parsing search results:', error);
    }
    
    return results;
  }

  parseDuration(seconds) {
    if (!seconds) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  }

  decodeHtml(text) {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
}

class CustomSoundCloudExtractor extends BaseExtractor {
  constructor() {
    super('custom-soundcloud', ['soundcloud.com']);
  }

  async validate(query) {
    return query.includes('soundcloud.com');
  }

  async handle(query, context) {
    try {
      const { requestedBy } = context;
      
      // Use SoundCloud API or scraping
      const trackInfo = await this.getSoundCloudInfo(query);
      
      return {
        tracks: [{
          title: trackInfo.title,
          author: trackInfo.author,
          url: query,
          duration: trackInfo.duration,
          thumbnail: trackInfo.thumbnail,
          source: 'soundcloud',
          requestedBy: requestedBy,
          plays: trackInfo.plays || 0,
          likes: trackInfo.likes || 0
        }]
      };
    } catch (error) {
      console.error('Custom SoundCloud extractor error:', error);
      throw error;
    }
  }

  async getSoundCloudInfo(url) {
    // Basic SoundCloud info extraction
    const axios = require('axios');
    
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      // Parse track info from HTML
      const html = response.data;
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      const authorMatch = html.match(/"username":"([^"]+)"/);
      
      return {
        title: titleMatch ? titleMatch[1].split(' by ')[0] : 'Unknown Title',
        author: authorMatch ? authorMatch[1] : 'Unknown Artist',
        duration: '0:00', // Would need additional parsing
        thumbnail: null, // Would need additional parsing
        plays: 0,
        likes: 0
      };
    } catch (error) {
      console.error('SoundCloud info extraction error:', error);
      throw new Error('Failed to extract SoundCloud track information');
    }
  }
}

module.exports = {
  CustomYouTubeExtractor,
  CustomSoundCloudExtractor
};
