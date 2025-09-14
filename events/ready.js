module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`✅ Bot is ready in ${client.guilds.cache.size} servers`);
    console.log(`✅ Extractors registered successfully`);
    console.log('✅ Discord Player ready for music functionality');
    console.log('✅ Bot is online and ready to play music! 🎵');
  },
};