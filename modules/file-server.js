const express = require('express');
const path = require('path');
const fs = require('fs');

class FileServer {
  constructor() {
    this.app = express();
    this.port = 3001;
    this.server = null;
    this.baseUrl = `http://localhost:${this.port}`;
  }

  start() {
    return new Promise((resolve, reject) => {
      try {
        // Serve files from temp directory
        this.app.use('/temp', express.static(path.join(__dirname, '../temp')));
        
        // Health check endpoint
        this.app.get('/health', (req, res) => {
          res.json({ status: 'ok', port: this.port });
        });

        this.server = this.app.listen(this.port, '0.0.0.0', () => {
          console.log(`[FileServer] ✅ Started on port ${this.port}`);
          resolve();
        });

        this.server.on('error', (error) => {
          if (error.code === 'EADDRINUSE') {
            console.log(`[FileServer] Port ${this.port} already in use, trying ${this.port + 1}`);
            this.port++;
            this.baseUrl = `http://localhost:${this.port}`;
            this.start().then(resolve).catch(reject);
          } else {
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log(`[FileServer] ✅ Stopped`);
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getFileUrl(filePath) {
    const relativePath = path.relative(path.join(__dirname, '../temp'), filePath);
    return `${this.baseUrl}/temp/${relativePath}`;
  }

  async cleanupFile(filePath) {
    try {
      await fs.promises.unlink(filePath);
      console.log(`[FileServer] ✅ Cleaned up file: ${filePath}`);
    } catch (error) {
      console.error(`[FileServer] ❌ Cleanup failed:`, error.message);
    }
  }
}

module.exports = FileServer;
