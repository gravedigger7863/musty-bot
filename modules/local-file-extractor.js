const { BaseExtractor } = require('@discord-player/extractor');
const fs = require('fs');
const path = require('path');

class LocalFileExtractor extends BaseExtractor {
  constructor() {
    super('local-file', ['local', 'file', 'mp3']);
  }

  async validate(query) {
    // Check if it's a local file path
    try {
      if (typeof query === 'string') {
        // Check for absolute paths or relative paths to downloads folder
        if (query.startsWith('/') || query.includes('downloads/') || query.endsWith('.mp3')) {
          return fs.existsSync(query) && path.extname(query).toLowerCase() === '.mp3';
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  async handle(query, context) {
    try {
      if (!fs.existsSync(query)) {
        throw new Error('Local file does not exist');
      }

      const stats = fs.statSync(query);
      const filename = path.basename(query, '.mp3');
      
      // Extract title from filename (remove guild ID and timestamp)
      let title = filename.replace(/^\d+_\d+_/, '').replace(/\.mp3$/, '');
      if (!title) title = 'Downloaded Track';
      
      // Create a track object for the local file
      const track = {
        title: title,
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
      };

      console.log(`[LocalFileExtractor] Created track for local file: ${title}`);

      return {
        tracks: [track]
      };
    } catch (error) {
      console.error(`[LocalFileExtractor] Failed to handle local file "${query}": ${error.message}`);
      throw error;
    }
  }
}

module.exports = LocalFileExtractor;
