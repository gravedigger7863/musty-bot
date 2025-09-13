const { BaseExtractor } = require('discord-player');
const ytdl = require('ytdl-core');

class CustomYouTubeExtractor extends BaseExtractor {
  constructor() {
    super();
    this.name = 'custom-youtube';
    this.aliases = ['yt', 'youtube'];
  }

  async validate(query) {
    return ytdl.validateURL(query) || query.includes('youtube.com') || query.includes('youtu.be');
  }

  async handle(query, context) {
    try {
      const info = await ytdl.getInfo(query);
      const track = {
        title: info.videoDetails.title,
        description: info.videoDetails.description,
        url: info.videoDetails.video_url,
        thumbnail: info.videoDetails.thumbnails[0]?.url,
        duration: info.videoDetails.lengthSeconds,
        views: info.videoDetails.viewCount,
        author: info.videoDetails.author.name,
        source: 'youtube'
      };

      return {
        tracks: [track],
        playlist: null
      };
    } catch (error) {
      console.error('Custom YouTube extractor error:', error);
      return { tracks: [], playlist: null };
    }
  }

  async stream(info) {
    try {
      return ytdl(info.url, {
        quality: 'highestaudio',
        filter: 'audioonly',
        highWaterMark: 1 << 25
      });
    } catch (error) {
      console.error('Custom YouTube stream error:', error);
      throw error;
    }
  }
}

module.exports = CustomYouTubeExtractor;
