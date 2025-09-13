module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);

    // Register reliable music extractors (NO YOUTUBE - it's broken)
    try {
      // Register Apple Music extractor (most reliable)
      const { AppleMusicExtractor } = require('@discord-player/extractor');
      await client.player.extractors.register(AppleMusicExtractor, {});
      console.log('✅ Apple Music extractor registered successfully');
    } catch (error) {
      console.error('❌ Failed to register Apple Music extractor:', error);
    }

    try {
      // Register Spotify extractor (very reliable)
      const { SpotifyExtractor } = require('@discord-player/extractor');
      await client.player.extractors.register(SpotifyExtractor, {});
      console.log('✅ Spotify extractor registered successfully');
    } catch (error) {
      console.error('❌ Failed to register Spotify extractor:', error);
    }


    console.log("✅ Discord Player extractors are ready");
    console.log("✅ Discord Player downloader available (700+ websites supported)");
    
    // Test extractor registration
    console.log(`✅ Registered extractors: ${client.player.extractors.size}`);
  },
};
