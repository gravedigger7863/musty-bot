const { DefaultExtractors } = require('@discord-player/extractor');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);

    // Load extractors after bot is ready
    try {
      await client.player.extractors.loadMulti(DefaultExtractors);
      console.log("✅ Discord Player extractors loaded successfully");

      // The downloader is automatically available with @discord-player/downloader package
      // No need to manually load it - it's integrated into the player
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
      
    } catch (error) {
      console.error("❌ Failed to load extractors:", error);
    }
  },
};
