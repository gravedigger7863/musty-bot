const { DefaultExtractors } = require('@discord-player/extractor');
const { Downloader } = require('@discord-player/downloader');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    
    // Load extractors and downloader after bot is ready
    try {
      await client.player.extractors.loadMulti(DefaultExtractors);
      console.log("✅ Discord Player extractors loaded successfully");
      
      // Load the downloader for enhanced audio source support
      await client.player.extractors.load(Downloader);
      console.log("✅ Discord Player downloader loaded successfully");
    } catch (error) {
      console.error("❌ Failed to load extractors/downloader:", error);
    }
  },
};
