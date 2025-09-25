const { spawn } = require('child_process');

class YouTubeSearchSimple {
  constructor() {
    this.baseUrl = 'https://www.youtube.com';
  }

  /**
   * Search for videos on YouTube using yt-dlp
   * @param {string} query - Search query
   * @param {number} limit - Number of results to return (default: 5)
   * @returns {Promise<Array>} Array of video objects
   */
  async search(query, limit = 5) {
    try {
      console.log(`[YouTube Search Simple] Searching for: "${query}"`);
      
      return new Promise((resolve, reject) => {
        const ytdlp = spawn('yt-dlp', [
          '--dump-json',
          '--no-playlist',
          '--flat-playlist',
          '--cookies', '/root/musty-bot/cookies.txt',
          '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          '--referer', 'https://www.youtube.com/',
          '--retries', '3',
          '--socket-timeout', '30',
          `ytsearch${limit}:${query}`
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
              const results = [];
              const lines = stdout.trim().split('\n');
              
              for (const line of lines) {
                if (line.trim()) {
                  try {
                    const data = JSON.parse(line);
                    if (data.id && data.title) {
                      results.push({
                        id: data.id,
                        url: `https://www.youtube.com/watch?v=${data.id}`,
                        title: data.title,
                        author: data.uploader || data.channel || 'Unknown',
                        duration: data.duration_string || 'Unknown',
                        thumbnail: data.thumbnail || `https://img.youtube.com/vi/${data.id}/maxresdefault.jpg`,
                        viewCount: data.view_count || 0,
                        source: 'youtube'
                      });
                    }
                  } catch (parseError) {
                    console.log(`[YouTube Search Simple] Error parsing line:`, parseError.message);
                  }
                }
              }
              
              console.log(`[YouTube Search Simple] Found ${results.length} videos`);
              resolve(results);
            } catch (error) {
              console.error('[YouTube Search Simple] Error parsing results:', error);
              resolve([]);
            }
          } else {
            console.error(`[YouTube Search Simple] yt-dlp failed with code ${code}:`, stderr);
            resolve([]);
          }
        });

        ytdlp.on('error', (error) => {
          console.error('[YouTube Search Simple] yt-dlp spawn error:', error);
          resolve([]);
        });
      });

    } catch (error) {
      console.error('[YouTube Search Simple] Search failed:', error.message);
      return [];
    }
  }

  /**
   * Get video details by ID using yt-dlp
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} Video details
   */
  async getVideoDetails(videoId) {
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      
      return new Promise((resolve, reject) => {
        const ytdlp = spawn('yt-dlp', [
          '--dump-json',
          '--no-playlist',
          '--cookies', '/root/musty-bot/cookies.txt',
          '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          '--referer', 'https://www.youtube.com/',
          '--retries', '3',
          '--socket-timeout', '30',
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
              const data = JSON.parse(stdout);
              resolve({
                id: videoId,
                url: url,
                title: data.title || 'Unknown Title',
                author: data.uploader || data.channel || 'Unknown Artist',
                duration: data.duration_string || 'Unknown',
                thumbnail: data.thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                viewCount: data.view_count || 0,
                source: 'youtube'
              });
            } catch (error) {
              console.error('[YouTube Search Simple] Error parsing video details:', error);
              resolve(null);
            }
          } else {
            console.error(`[YouTube Search Simple] Video details failed with code ${code}:`, stderr);
            resolve(null);
          }
        });

        ytdlp.on('error', (error) => {
          console.error('[YouTube Search Simple] Video details spawn error:', error);
          resolve(null);
        });
      });

    } catch (error) {
      console.error('[YouTube Search Simple] Failed to get video details:', error.message);
      return null;
    }
  }
}

module.exports = YouTubeSearchSimple;
