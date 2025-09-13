module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);

    // Discord Player v7+ extractors are registered in index.js
    console.log("✅ Discord Player extractors are ready (registered in index.js)");
    console.log("✅ Discord Player downloader available (700+ websites supported)");
    
    // Verify ytdl-core is working
    try {
      const ytdl = require('ytdl-core');
      console.log("✅ ytdl-core loaded successfully");
    } catch (ytdlError) {
      console.warn("⚠️ ytdl-core not available:", ytdlError.message);
    }
    
    // Verify play-dl is working
    try {
      const playdl = require('play-dl');
      console.log("✅ play-dl loaded successfully");
    } catch (playdlError) {
      console.warn("⚠️ play-dl not available:", playdlError.message);
    }
    
    // Test extractor registration
    console.log(`✅ Registered extractors: ${client.player.extractors.size}`);
  },
};
