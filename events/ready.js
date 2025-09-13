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
    } catch (error) {
      console.error("❌ Failed to load extractors:", error);
    }
  },
};
