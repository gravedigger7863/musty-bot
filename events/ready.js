module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`✅ Bot is ready in ${client.guilds.cache.size} servers`);
    
    // Log bot intents for debugging
    console.log(`[Debug] Bot intents:`, {
      GUILDS: client.options.intents.has('Guilds'),
      GUILD_VOICE_STATES: client.options.intents.has('GuildVoiceStates'),
      GUILD_MESSAGES: client.options.intents.has('GuildMessages'),
      MESSAGE_CONTENT: client.options.intents.has('MessageContent')
    });
    
    // Log VPS environment info
    console.log(`[Debug] VPS Environment:`, {
      NodeVersion: process.version,
      Platform: process.platform,
      Architecture: process.arch,
      MemoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
    });
    
    console.log(`✅ Extractors registered successfully`);
    console.log('✅ Discord Player ready for music functionality');
    console.log('✅ Bot is online and ready to play music! 🎵');
  },
};