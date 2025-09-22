const { Extractor, ExtractorStreamable, Track } = require('discord-player');
const fs = require('fs');
const path = require('path');

class LocalFileExtractor extends Extractor {
  static identifier = 'com.discord-player.localfileextractor';

  async validate(query) {
    // Check if it's a local file path
    try {
      if (typeof query === 'string' && query.startsWith('/')) {
        return fs.existsSync(query) && path.extname(query).toLowerCase() === '.mp3';
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  async handle(query, context) {
    this.debug(`[LocalFileExtractor] Handling local file: ${query}`);
    
    try {
      if (!fs.existsSync(query)) {
        throw new Error('Local file does not exist');
      }

      const stats = fs.statSync(query);
      const filename = path.basename(query, '.mp3');
      
      // Create a track for the local file
      const track = new Track(this.player, {
        title: filename,
        description: 'Local downloaded track',
        author: 'Downloaded Track',
        url: query,
        thumbnail: null,
        duration: '0:00', // Will be determined during playback
        durationMS: 0,
        views: 0,
        requestedBy: context.requestedBy,
        source: 'local',
        isLocal: true,
        raw: {
          localPath: query,
          fileSize: stats.size,
          filename: filename
        }
      });

      return this.create({ playlist: null, tracks: [track] });
    } catch (error) {
      this.error(`[LocalFileExtractor] Failed to handle local file "${query}": ${error.message}`);
      throw error;
    }
  }

  async getStream(track) {
    this.debug(`[LocalFileExtractor] Getting stream for local file: ${track.url}`);
    
    try {
      // Create a readable stream from the local file
      const stream = fs.createReadStream(track.url);
      
      return ExtractorStreamable.from(stream, {
        type: 'arbitrary',
        metadata: {
          title: track.title,
          source: 'local'
        }
      });
    } catch (error) {
      this.error(`[LocalFileExtractor] Failed to get stream for "${track.title}": ${error.message}`);
      throw error;
    }
  }
}

module.exports = LocalFileExtractor;
