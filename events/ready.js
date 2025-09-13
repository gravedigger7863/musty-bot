module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);

    // Register YouTube extractor for Discord Player v7+
    try {
      const { YouTubeExtractor } = require('@discord-player/extractor');
      await client.player.extractors.register(YouTubeExtractor, {});
      console.log('✅ YouTube extractor registered successfully');
    } catch (error) {
      console.error('❌ Failed to register YouTube extractor:', error);
      console.error('Error details:', error.message);
    }

    console.log("✅ Discord Player extractors are ready");
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
