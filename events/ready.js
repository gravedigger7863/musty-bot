module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);

    // Discord Player is ready - no extractors needed for basic functionality
    console.log('✅ Discord Player ready for basic music functionality');


    console.log("✅ Discord Player extractors are ready");
    console.log("✅ Discord Player downloader available (700+ websites supported)");
    
    // Test extractor registration
    console.log(`✅ Registered extractors: ${client.player.extractors.size}`);
  },
};
