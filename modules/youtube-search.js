const axios = require('axios');

class YouTubeSearch {
    constructor() {
        this.baseUrl = 'https://www.youtube.com';
    }

    /**
     * Search for videos on YouTube using web scraping
     * @param {string} query - Search query
     * @param {number} limit - Number of results to return (default: 5)
     * @returns {Promise<Array>} Array of video objects
     */
    async search(query, limit = 5) {
        try {
            console.log(`[YouTube Search] Searching for: "${query}"`);
            
            // Create search URL
            const searchUrl = `${this.baseUrl}/results?search_query=${encodeURIComponent(query)}`;
            
            // Make request with proper headers
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                },
                timeout: 10000
            });

            // Parse the HTML response to extract video data
            const videoData = this.parseSearchResults(response.data, limit);
            
            console.log(`[YouTube Search] Found ${videoData.length} videos`);
            return videoData;
            
        } catch (error) {
            console.error('[YouTube Search] Search failed:', error.message);
            throw new Error(`YouTube search failed: ${error.message}`);
        }
    }

    /**
     * Parse YouTube search results from HTML
     * @param {string} html - HTML content
     * @param {number} limit - Number of results to extract
     * @returns {Array} Array of video objects
     */
    parseSearchResults(html, limit) {
        const videos = [];
        
        try {
            // Extract video data from the HTML
            // YouTube stores video data in JSON format within script tags
            const scriptRegex = /var ytInitialData = ({.+?});/;
            const match = html.match(scriptRegex);
            
            if (!match) {
                console.log('[YouTube Search] No ytInitialData found, trying alternative parsing');
                return this.parseAlternativeResults(html, limit);
            }
            
            const data = JSON.parse(match[1]);
            const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;
            
            if (!contents) {
                console.log('[YouTube Search] No contents found in ytInitialData');
                return this.parseAlternativeResults(html, limit);
            }
            
            for (const item of contents) {
                if (videos.length >= limit) break;
                
                const videoRenderer = item?.videoRenderer;
                if (!videoRenderer) continue;
                
                const videoId = videoRenderer?.videoId;
                const title = videoRenderer?.title?.runs?.[0]?.text;
                const author = videoRenderer?.ownerText?.runs?.[0]?.text;
                const duration = videoRenderer?.lengthText?.simpleText;
                const viewCount = videoRenderer?.viewCountText?.simpleText;
                const thumbnail = videoRenderer?.thumbnail?.thumbnails?.[0]?.url;
                
                if (videoId && title) {
                    videos.push({
                        id: videoId,
                        url: `https://www.youtube.com/watch?v=${videoId}`,
                        title: title,
                        author: author || 'Unknown',
                        duration: duration || 'Unknown',
                        viewCount: viewCount || 'Unknown',
                        thumbnail: thumbnail || null,
                        source: 'youtube'
                    });
                }
            }
            
        } catch (error) {
            console.error('[YouTube Search] Parsing error:', error.message);
            return this.parseAlternativeResults(html, limit);
        }
        
        return videos;
    }

    /**
     * Alternative parsing method using regex
     * @param {string} html - HTML content
     * @param {number} limit - Number of results to extract
     * @returns {Array} Array of video objects
     */
    parseAlternativeResults(html, limit) {
        const videos = [];
        
        try {
            // Look for video URLs in the HTML
            const videoUrlRegex = /"url":"\/watch\?v=([a-zA-Z0-9_-]{11})"/g;
            const titleRegex = /"title":{"runs":\[{"text":"([^"]+)"}\]}/g;
            const authorRegex = /"ownerText":{"runs":\[{"text":"([^"]+)"}\]}/g;
            
            let match;
            const videoIds = [];
            const titles = [];
            const authors = [];
            
            // Extract video IDs
            while ((match = videoUrlRegex.exec(html)) !== null && videoIds.length < limit) {
                if (!videoIds.includes(match[1])) {
                    videoIds.push(match[1]);
                }
            }
            
            // Extract titles
            while ((match = titleRegex.exec(html)) !== null && titles.length < limit) {
                if (!titles.includes(match[1])) {
                    titles.push(match[1]);
                }
            }
            
            // Extract authors
            while ((match = authorRegex.exec(html)) !== null && authors.length < limit) {
                if (!authors.includes(match[1])) {
                    authors.push(match[1]);
                }
            }
            
            // Combine the data
            for (let i = 0; i < Math.min(videoIds.length, titles.length, limit); i++) {
                videos.push({
                    id: videoIds[i],
                    url: `https://www.youtube.com/watch?v=${videoIds[i]}`,
                    title: titles[i] || 'Unknown Title',
                    author: authors[i] || 'Unknown Artist',
                    duration: 'Unknown',
                    viewCount: 'Unknown',
                    thumbnail: null,
                    source: 'youtube'
                });
            }
            
        } catch (error) {
            console.error('[YouTube Search] Alternative parsing error:', error.message);
        }
        
        return videos;
    }

    /**
     * Get video details by ID
     * @param {string} videoId - YouTube video ID
     * @returns {Promise<Object>} Video details
     */
    async getVideoDetails(videoId) {
        try {
            const url = `https://www.youtube.com/watch?v=${videoId}`;
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                },
                timeout: 10000
            });

            // Parse video details from HTML
            const titleMatch = response.data.match(/"title":"([^"]+)"/);
            const authorMatch = response.data.match(/"author":"([^"]+)"/);
            
            return {
                id: videoId,
                url: url,
                title: titleMatch ? titleMatch[1] : 'Unknown Title',
                author: authorMatch ? authorMatch[1] : 'Unknown Artist',
                source: 'youtube'
            };
            
        } catch (error) {
            console.error('[YouTube Search] Failed to get video details:', error.message);
            throw error;
        }
    }
}

module.exports = YouTubeSearch;
