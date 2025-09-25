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

// --- Discord Player Setup (Fixed for Voice Issues) ---
client.player = new Player(client, {
  ytdlOptions: {
    quality: 'highestaudio',
    highWaterMark: 1 << 25,
    filter: 'audioonly',
    format: 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio',
    timeout: 30000,
    requestOptions: {
      timeout: 30000,
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
  bufferingTimeout: 15000,
  connectionTimeout: 15000,
  volume: 50,
  // Add these to fix voice connection issues
  useLegacyFFmpeg: false,
  skipFFmpeg: false,
  // Reduce timeouts to prevent hanging
  maxMemoryUsage: 50 * 1024 * 1024, // 50MB
  maxQueueSize: 50
});

// Load extractors for reliable music playback
console.log('🔍 Loading music extractors...');

client.player.extractors.loadMulti(DefaultExtractors).then(async () => {
  console.log('✅ Music extractors loaded successfully');
  
  // Verify extractors are loaded
  const loadedExtractors = Array.from(client.player.extractors.store.keys());
  console.log('✅ Available extractors:', loadedExtractors);
  
}).catch(error => {
  console.error('❌ Error loading extractors:', error);
  console.log('⚠️ Bot will continue with limited functionality');
});

// --- Event Handlers ---
client.on('ready', () => {
  console.log(`✅ ${client.user.tag} is ready with Discord Player!`);
  console.log(`🎵 Discord Player initialized successfully`);
});

client.player.events.on('playerStart', (queue, track) => {
  console.log(`🎵 Started playing: ${track.title} by ${track.author}`);
  console.log(`🎵 Track details:`, {
    url: track.url,
    source: track.source,
    duration: track.duration,
    thumbnail: track.thumbnail
  });
  console.log(`🎵 Queue state:`, {
    isPlaying: queue.isPlaying(),
    isPaused: queue.isPaused(),
    tracksCount: queue.tracks.count
  });
  console.log(`🎵 PlayerStart event fired! Audio should be playing now.`);
  
  const channel = client.channels.cache.get(queue.metadata.channel.id);
  if (channel) {
    channel.send(`🎵 Now playing: **${track.title}** by ${track.author}`);
  }
});

client.player.events.on('playerFinish', (queue, track) => {
  console.log(`🏁 Track finished: ${track.title}`);
  
  // Clean up local files if they exist
  if (track.localFilePath) {
    if (client.fileServer) {
      client.fileServer.cleanupFile(track.localFilePath);
    } else {
      const fs = require('fs').promises;
      fs.unlink(track.localFilePath).then(() => {
        console.log(`🗑️ Cleaned up local file: ${track.localFilePath}`);
      }).catch(error => {
        console.error(`❌ Failed to clean up local file:`, error.message);
      });
    }
  }
});

client.player.events.on('playerError', (queue, error) => {
  console.error(`❌ Player error in ${queue.guild.name}:`, error.message);
  console.error(`❌ Error details:`, {
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: error.code
  });
  console.error(`❌ Queue state during error:`, {
    isPlaying: queue.isPlaying(),
    isPaused: queue.isPaused(),
    tracksCount: queue.tracks.count,
    currentTrack: queue.currentTrack ? {
      title: queue.currentTrack.title,
      url: queue.currentTrack.url,
      source: queue.currentTrack.source
    } : null
  });
  
  const channel = client.channels.cache.get(queue.metadata.channel.id);
  if (channel) {
    let errorMessage = `❌ Track playback failed. Try a different track.`;
    
    if (error.message && error.message.includes('AbortError')) {
      errorMessage = `❌ Connection timeout. Please try again.`;
    } else if (error.message && error.message.includes('ENOTFOUND')) {
      errorMessage = `❌ Network error. Please try again.`;
    } else if (error.message && error.message.includes('No video')) {
      errorMessage = `❌ Video not available. Try a different track.`;
    } else if (error.message && error.message.includes('Private video')) {
      errorMessage = `❌ Video is private. Try a different track.`;
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

// Connection event handler
client.player.events.on('connection', (queue) => {
  console.log(`🔗 Connected to voice channel in ${queue.guild.name}`);
});

// --- Optimized Command Loader ---
const commandsPath = path.join(__dirname, 'commands');
const commandLoadStart = Date.now();

try {
  const folders = fs.readdirSync(commandsPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const folder of folders) {
  const folderPath = path.join(commandsPath, folder);
    const commandFiles = fs.readdirSync(folderPath)
      .filter(f => f.endsWith('.js'))
      .sort(); // Sort for consistent loading order

  for (const file of commandFiles) {
      try {
        const commandPath = path.join(folderPath, file);
        // Clear require cache to ensure fresh loading
        delete require.cache[require.resolve(commandPath)];
        
        const command = require(commandPath);
        
    if (!command.data || !command.execute) {
      console.warn(`⚠️ Skipped invalid command file: ${file}`);
      continue;
    }
        
        // Validate command structure
        if (typeof command.execute !== 'function') {
          console.warn(`⚠️ Command ${command.data.name} has invalid execute function`);
          continue;
        }
        
    client.commands.set(command.data.name, command);
    console.log(`✅ Loaded command: ${command.data.name}`);
      } catch (error) {
        console.error(`❌ Error loading command ${file}:`, error.message);
      }
    }
  }
  
  const commandLoadTime = Date.now() - commandLoadStart;
  console.log(`⚡ Commands loaded in ${commandLoadTime}ms`);
} catch (error) {
  console.error('❌ Error loading commands:', error.message);
}

// --- Optimized Event Loader ---
const eventsPath = path.join(__dirname, 'events');
const eventLoadStart = Date.now();

try {
  const eventFiles = fs.readdirSync(eventsPath)
    .filter(f => f.endsWith('.js'))
    .sort(); // Sort for consistent loading order

  for (const file of eventFiles) {
    try {
      const eventPath = path.join(eventsPath, file);
      // Clear require cache to ensure fresh loading
      delete require.cache[require.resolve(eventPath)];
      
      const event = require(eventPath);
      
      if (!event.name || !event.execute) {
        console.warn(`⚠️ Skipped invalid event file: ${file}`);
        continue;
      }
      
      // Validate event structure
      if (typeof event.execute !== 'function') {
        console.warn(`⚠️ Event ${event.name} has invalid execute function`);
        continue;
      }
  
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
    console.log(`✅ Event loaded (once): ${event.name}`);
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
    console.log(`✅ Event loaded: ${event.name}`);
      }
    } catch (error) {
      console.error(`❌ Error loading event ${file}:`, error.message);
    }
  }
  
  const eventLoadTime = Date.now() - eventLoadStart;
  console.log(`⚡ Events loaded in ${eventLoadTime}ms`);
} catch (error) {
  console.error('❌ Error loading events:', error.message);
}

// Command execution handler
client.on('interactionCreate', async (interaction) => {
  if (interaction.isCommand()) {
    try {
      const command = client.commands.get(interaction.commandName);
      if (command) {
        await command.execute(interaction, client);
      }
    } catch (error) {
      console.error(`❌ Command execution error:`, error);
    }
  }
});


// Process error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down gracefully...');
  if (client.player) {
    client.player.destroy();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down gracefully...');
  if (client.player) {
    client.player.destroy();
  }
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
