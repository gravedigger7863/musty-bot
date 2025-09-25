const axios = require('axios');

class CnvMP3Converter {
  constructor() {
    this.baseUrl = 'https://cnvmp3.com/v33';
    this.timeout = 30000; // 30 seconds timeout
  }

  async convertToMP3(url, quality = '128kb/s') {
    try {
      console.log(`[CnvMP3] Converting URL to MP3: ${url}`);
      
      // Try the main page first to get the form
      const pageResponse = await axios.get(this.baseUrl, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      console.log(`[CnvMP3] Page response status: ${pageResponse.status}`);

      // Try different API endpoints
      const endpoints = [
        `${this.baseUrl}/api/convert`,
        `${this.baseUrl}/convert`,
        `${this.baseUrl}/api/v1/convert`,
        `${this.baseUrl}/download`
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`[CnvMP3] Trying endpoint: ${endpoint}`);
          
          const formData = new URLSearchParams();
          formData.append('url', url);
          formData.append('quality', quality);
          formData.append('format', 'MP3');

          const response = await axios.post(endpoint, formData, {
            timeout: this.timeout,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': this.baseUrl,
              'Origin': this.baseUrl
            },
            maxRedirects: 5,
            validateStatus: function (status) {
              return status < 500; // Accept all status codes under 500
            }
          });

          console.log(`[CnvMP3] Response status: ${response.status}`);
          console.log(`[CnvMP3] Response headers:`, response.headers);

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
          }
        } catch (endpointError) {
          console.log(`[CnvMP3] Endpoint ${endpoint} failed:`, endpointError.message);
        }
      }

      throw new Error('All conversion endpoints failed');
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
      console.log(`[CnvMP3] Extracting download URL from response...`);
      console.log(`[CnvMP3] Response length: ${htmlResponse.length} characters`);
      
      // Look for download URL patterns in the HTML response
      const downloadPatterns = [
        /href="([^"]*\.mp3[^"]*)"/i,
        /downloadUrl['"]\s*:\s*['"]([^'"]*)['"]/i,
        /"download_url":\s*"([^"]*)"/i,
        /download.*?href="([^"]*)"/i,
        /<a[^>]*href="([^"]*\.mp3[^"]*)"[^>]*>/i,
        /window\.location\.href\s*=\s*['"]([^'"]*)['"]/i,
        /location\.href\s*=\s*['"]([^'"]*)['"]/i,
        /redirect.*?['"]([^'"]*)['"]/i
      ];

      for (const pattern of downloadPatterns) {
        const match = htmlResponse.match(pattern);
        if (match && match[1]) {
          let url = match[1];
          console.log(`[CnvMP3] Found potential download URL: ${url}`);
          
          // Ensure it's a full URL
          if (url.startsWith('/')) {
            url = this.baseUrl + url;
          } else if (!url.startsWith('http')) {
            url = this.baseUrl + '/' + url;
          }
          
          console.log(`[CnvMP3] Processed download URL: ${url}`);
          return url;
        }
      }

      // If no patterns match, look for any MP3 URL in the response
      const mp3Pattern = /https?:\/\/[^\s"']+\.mp3[^\s"']*/i;
      const mp3Match = htmlResponse.match(mp3Pattern);
      if (mp3Match) {
        console.log(`[CnvMP3] Found MP3 URL: ${mp3Match[0]}`);
        return mp3Match[0];
      }

      console.log(`[CnvMP3] No download URL found in response`);
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
