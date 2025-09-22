const { createReadStream } = require('fs');
const { pipeline } = require('stream');
const { promisify } = require('util');

class CustomStreamHandler {
  constructor() {
    this.downloadedFiles = new Map(); // Track local files by original URL
  }

  // Register a downloaded file for a URL
  registerDownloadedFile(originalUrl, localPath) {
    this.downloadedFiles.set(originalUrl, localPath);
    console.log(`[CustomStreamHandler] Registered local file: ${originalUrl} -> ${localPath}`);
  }

  // Check if we have a local file for this URL
  hasLocalFile(url) {
    return this.downloadedFiles.has(url);
  }

  // Get the local file path for a URL
  getLocalFilePath(url) {
    return this.downloadedFiles.get(url);
  }

  // Create a stream from local file
  createLocalStream(localPath) {
    try {
      const stream = createReadStream(localPath);
      console.log(`[CustomStreamHandler] Created stream from local file: ${localPath}`);
      return stream;
    } catch (error) {
      console.error(`[CustomStreamHandler] Error creating stream from ${localPath}:`, error);
      throw error;
    }
  }

  // Clean up old entries
  cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    // This is a simple cleanup - in production you'd want more sophisticated cleanup
    console.log(`[CustomStreamHandler] Cleanup: ${this.downloadedFiles.size} registered files`);
  }
}

module.exports = CustomStreamHandler;
