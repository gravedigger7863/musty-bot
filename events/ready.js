module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`✅ Bot is ready in ${client.guilds.cache.size} servers`);
    
    // Ensure extractors are loaded
    if (client.player.extractors.size === 0) {
      console.log('⚠️ No extractors found, loading defaults...');
      client.player.extractors.loadDefault();
    }
    
    console.log(`✅ Loaded ${client.player.extractors.size} extractors`);
    console.log('✅ Discord Player ready for music functionality');
    console.log('✅ Bot is online and ready to play music! 🎵');
  },
};
