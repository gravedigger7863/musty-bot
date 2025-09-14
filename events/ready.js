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
    
    console.log(`✅ Extractors registered successfully`);
    console.log('✅ Discord Player ready for music functionality');
    console.log('✅ Bot is online and ready to play music! 🎵');
  },
};