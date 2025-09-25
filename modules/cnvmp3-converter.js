const axios = require('axios');

class CnvMP3Converter {
  constructor() {
    this.baseUrl = 'https://cnvmp3.com/v33';
    this.timeout = 30000; // 30 seconds timeout
  }

  async convertToMP3(url, quality = '128kb/s') {
    try {
      console.log(`[CnvMP3] Converting URL to MP3: ${url}`);
      
      // First, get the conversion page
      const response = await axios.post(`${this.baseUrl}/convert`, {
        url: url,
        quality: quality,
        format: 'MP3'
      }, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      // Parse the response to get the download URL
      const downloadUrl = this.extractDownloadUrl(response.data);
      
      if (downloadUrl) {
        console.log(`[CnvMP3] ✅ Conversion successful: ${downloadUrl}`);
        return {
          success: true,
          downloadUrl: downloadUrl,
          format: 'mp3',
          quality: quality
        };
      } else {
        throw new Error('Could not extract download URL from response');
      }
    } catch (error) {
      console.error(`[CnvMP3] ❌ Conversion failed:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  extractDownloadUrl(htmlResponse) {
    try {
      // Look for download URL patterns in the HTML response
      const downloadPatterns = [
        /href="([^"]*\.mp3[^"]*)"/i,
        /downloadUrl['"]\s*:\s*['"]([^'"]*)['"]/i,
        /"download_url":\s*"([^"]*)"/i
      ];

      for (const pattern of downloadPatterns) {
        const match = htmlResponse.match(pattern);
        if (match && match[1]) {
          let url = match[1];
          // Ensure it's a full URL
          if (url.startsWith('/')) {
            url = this.baseUrl + url;
          }
          return url;
        }
      }

      return null;
    } catch (error) {
      console.error(`[CnvMP3] Error extracting download URL:`, error.message);
      return null;
    }
  }

  async getStreamInfo(url) {
    try {
      console.log(`[CnvMP3] Getting stream info for: ${url}`);
      
      const response = await axios.head(url, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      return {
        success: true,
        contentType: response.headers['content-type'],
        contentLength: response.headers['content-length'],
        lastModified: response.headers['last-modified']
      };
    } catch (error) {
      console.error(`[CnvMP3] Error getting stream info:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Check if a URL is supported by CnvMP3
  isSupported(url) {
    const supportedDomains = [
      'youtube.com',
      'youtu.be',
      'tiktok.com',
      'reddit.com',
      'instagram.com',
      'facebook.com',
      'twitch.tv',
      'twitter.com',
      'x.com'
    ];

    try {
      const urlObj = new URL(url);
      return supportedDomains.some(domain => 
        urlObj.hostname.includes(domain)
      );
    } catch (error) {
      return false;
    }
  }
}

module.exports = CnvMP3Converter;
