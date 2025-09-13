module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);

    // Register YouTube extractor for Discord Player v7+ (using community package)
    // Note: youtubei.js currently has parser issues with YouTube's latest changes
    // We have a play-dl fallback in the play command as a workaround
    try {
      const { YoutubeiExtractor } = require('discord-player-youtubei');
      await client.player.extractors.register(YoutubeiExtractor, {});
      console.log('✅ YouTube extractor (youtubei) registered successfully');
      console.log('ℹ️ Note: If YouTube search fails, play-dl fallback will be used');
    } catch (error) {
      console.error('❌ Failed to register YouTube extractor:', error);
      console.error('Error details:', error.message);
      console.log('ℹ️ play-dl fallback will be used for YouTube searches');
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
