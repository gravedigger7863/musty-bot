require('dotenv').config();

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');
const fs = require('fs');
const path = require('path');
const express = require('express');

// Environment validation
const requiredEnvVars = ['DISCORD_TOKEN', 'CLIENT_ID'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please check your .env file and ensure all required variables are set.');
  process.exit(1);
}

console.log('✅ Environment variables validated successfully');

// --- Client Setup ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates, // Required for voice connection
  ],
});

client.commands = new Collection();

// --- Discord Player Setup ---
client.player = new Player(client, {
  ytdlOptions: {
    quality: 'highestaudio',
    highWaterMark: 1 << 25,
    filter: 'audioonly',
    format: 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio',
    timeout: 60000,
    requestOptions: {
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }
  },
  skipFFmpeg: false,
  useLegacyFFmpeg: false,
  selfDeaf: false,
  selfMute: false,
  leaveOnEmpty: true,
  leaveOnEnd: true,
  leaveOnStop: true,
  bufferingTimeout: 30000,
  connectionTimeout: 30000,
  volume: 50
});

// Load extractors with better configuration
console.log('🔍 Loading extractors...');
client.player.extractors.loadMulti(DefaultExtractors).then(() => {
  // Verify extractors are loaded
  const loadedExtractors = Array.from(client.player.extractors.store.keys());
  console.log('✅ Loaded extractors:', loadedExtractors);
  
  // Check specifically for YouTube extractor
  const hasYouTube = loadedExtractors.some(key => key.toLowerCase().includes('youtube'));
  if (hasYouTube) {
    console.log('✅ YouTube extractor loaded successfully');
  } else {
    console.log('❌ YouTube extractor not found - this will cause search issues');
  }
}).catch(error => {
  console.error('❌ Error loading extractors:', error);
});

// --- Event Handlers ---
client.on('ready', () => {
  console.log(`✅ ${client.user.tag} is ready with Discord Player!`);
  console.log(`🎵 Discord Player initialized successfully`);
});

client.player.events.on('playerStart', (queue, track) => {
  const channel = client.channels.cache.get(queue.metadata.channel.id);
  if (channel) {
    channel.send(`🎵 Now playing: **${track.title}** by ${track.author}`);
  }
});

client.player.events.on('playerFinish', async (queue, track) => {
  console.log(`🏁 Track finished: ${track.title}`);
  
  // Check if track finished immediately (less than 5 seconds) - likely an issue
  const trackDuration = track.durationMS || 0;
  const isImmediateFinish = trackDuration > 0 && trackDuration < 5000;
  
  // Also check if it's a SoundCloud track that finished quickly (common issue)
  const isSoundCloudIssue = track.source === 'soundcloud' && (isImmediateFinish || trackDuration === 0);
  
  if (isImmediateFinish || isSoundCloudIssue) {
    console.log(`⚠️ Track finished very quickly (${trackDuration}ms) - attempting to find alternative`);
    
    // Try to find the same song on a different platform
    try {
      const searchQuery = `${track.title} ${track.author}`;
      console.log(`🔍 Searching for alternative: ${searchQuery}`);
      
      // Search on YouTube specifically (most reliable)
      const searchResult = await queue.player.search(searchQuery, {
        requestedBy: track.requestedBy,
        searchEngine: 'youtube'
      });
      
      if (searchResult.hasTracks()) {
        const alternativeTrack = searchResult.tracks[0];
        console.log(`✅ Found alternative: ${alternativeTrack.title} by ${alternativeTrack.author} (${alternativeTrack.source})`);
        
        // Add the alternative track to the queue
        queue.addTrack(alternativeTrack);
        
        // Notify the channel
        const channel = queue.metadata?.channel;
        if (channel) {
          await channel.send(`🔄 **Auto-replacement:** The previous track failed, found alternative: **${alternativeTrack.title}** by ${alternativeTrack.author}`);
        }
      } else {
        console.log(`❌ No alternative found for: ${track.title}`);
      }
    } catch (error) {
      console.error(`❌ Error searching for alternative:`, error.message);
    }
  }
});

client.player.events.on('playerError', async (queue, error) => {
  console.error(`❌ Player error in ${queue.guild.name}:`, error.message);
  
  // Handle specific error types
  if (error.message && error.message.includes('Could not extract stream')) {
    console.error(`❌ Stream extraction failed - attempting to find alternative`);
    
    // Try to find alternative track if current one failed
    if (queue.currentTrack) {
      try {
        const searchQuery = `${queue.currentTrack.title} ${queue.currentTrack.author}`;
        console.log(`🔍 Searching for alternative due to error: ${searchQuery}`);
        
        // Search on YouTube specifically (most reliable)
        const searchResult = await queue.player.search(searchQuery, {
          requestedBy: queue.currentTrack.requestedBy,
          searchEngine: 'youtube'
        });
        
        if (searchResult.hasTracks()) {
          const alternativeTrack = searchResult.tracks[0];
          console.log(`✅ Found alternative: ${alternativeTrack.title} by ${alternativeTrack.author} (${alternativeTrack.source})`);
          
          // Skip the current track and add the alternative
          queue.node.skip();
          queue.addTrack(alternativeTrack);
          
          // Notify the channel
          const channel = queue.metadata?.channel;
          if (channel) {
            await channel.send(`🔄 **Auto-replacement:** The previous track failed, found alternative: **${alternativeTrack.title}** by ${alternativeTrack.author}`);
          }
          return; // Don't send error message since we found alternative
        }
      } catch (searchError) {
        console.error(`❌ Error searching for alternative:`, searchError.message);
      }
    }
  }
  
  if (error.message && (error.message.includes('ENOTFOUND') || error.message.includes('ECONNRESET'))) {
    console.error(`❌ Network error detected - connection issues`);
  }
  
  const channel = client.channels.cache.get(queue.metadata.channel.id);
  if (channel) {
    let errorMessage = `❌ Track playback failed. Try a different track.`;
    
    // Provide more helpful error messages
    if (error.message && error.message.includes('stream')) {
      if (queue.currentTrack && queue.currentTrack.source === 'soundcloud') {
        errorMessage = `❌ This SoundCloud track is not available for streaming (may have ads or restrictions). Try a different track.`;
      } else {
        errorMessage = `❌ This track is not available for streaming. Try a different track.`;
      }
    } else if (error.message && error.message.includes('network')) {
      errorMessage = `❌ Network error. Please try again.`;
    }
    
    channel.send(errorMessage).catch(console.error);
  }
});

client.player.events.on('queueEnd', (queue) => {
  const channel = client.channels.cache.get(queue.metadata.channel.id);
  if (channel) {
    channel.send(`🎵 Queue finished! Thanks for listening!`);
  }
});

client.player.events.on('emptyChannel', (queue) => {
  console.log(`👋 Channel empty in ${queue.guild.name} - leaving voice channel`);
  queue.delete();
  const channel = client.channels.cache.get(queue.metadata.channel.id);
  if (channel) {
    channel.send(`👋 Left voice channel - no one is listening!`);
  }
});

// Add connection event handlers
client.player.events.on('connection', (queue) => {
  console.log(`🔗 Connected to voice channel in ${queue.guild.name}`);
  
  // Wait a moment for voice state to be available
  setTimeout(() => {
    const voiceState = queue.connection?.voice;
    if (voiceState) {
      console.log(`🔗 Voice connection established - Deafened: ${voiceState.deaf}, Muted: ${voiceState.mute}`);
      
      // Ensure bot is not deafened or muted
      if (voiceState.deaf) {
        console.log(`⚠️ WARNING: Bot is deafened - this will prevent audio playback!`);
      }
      if (voiceState.mute) {
        console.log(`⚠️ WARNING: Bot is muted - this will prevent audio playback!`);
      }
    } else {
      console.log(`⚠️ Voice state not available - this is normal during connection establishment`);
    }
  }, 1000);
});

// Add meaningful debug logging (only for important events)
client.player.events.on('debug', (message) => {
  // Only log important debug messages, not object spam
  if (typeof message === 'string' && (
    message.includes('error') || 
    message.includes('warning') || 
    message.includes('connection') ||
    message.includes('stream') ||
    message.includes('extractor')
  )) {
    console.log(`[Player Debug] ${message}`);
  }
});

// --- Command Loader ---
const commandsPath = path.join(__dirname, 'commands');
for (const folder of fs.readdirSync(commandsPath)) {
  const folderPath = path.join(commandsPath, folder);
  const commandFiles = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));

  for (const file of commandFiles) {
    const command = require(path.join(folderPath, file));
    if (!command.data || !command.execute) {
      console.warn(`⚠️ Skipped invalid command file: ${file}`);
      continue;
    }
    client.commands.set(command.data.name, command);
    console.log(`✅ Loaded command: ${command.data.name}`);
  }
}

// --- Event Loader ---
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
  const event = require(path.join(eventsPath, file));
  
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
    console.log(`✅ Event loaded (once): ${event.name}`);
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
    console.log(`✅ Event loaded: ${event.name}`);
  }
}

// --- Process Error Handling ---
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit on unhandled rejections for music bots
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  
  // Handle specific errors gracefully
  if (error.message && (
    error.message.includes('Cannot convert "undefined" to int') ||
    error.message.includes('OpusScript') ||
    error.message.includes('opusscript') ||
    error.message.includes('ENOTFOUND') ||
    error.message.includes('ECONNRESET') ||
    error.message.includes('ETIMEDOUT')
  )) {
    console.log('⚠️ Non-critical error detected, continuing...');
    return;
  }
  
  // For critical errors, exit
  console.error('💥 Critical error, shutting down...');
  process.exit(1);
});

// --- Graceful Shutdown ---
process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

// --- Login ---
client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error('❌ Failed to login:', error);
  process.exit(1);
});

// --- Uptime server ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    bot: 'Musty Bot 2025',
    version: '2.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`🌐 Uptime server running on port ${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
});

module.exports = client;
