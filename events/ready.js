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
    } catch (error) {
      console.error("❌ Failed to load extractors:", error);
    }
  },
};
