require('dotenv').config();

// Set timeout environment variables to prevent negative timeouts
process.env.NODE_OPTIONS = '--max-old-space-size=4096';
process.env.UV_THREADPOOL_SIZE = '16';

// Force use of native Opus encoder instead of OpusScript
process.env.DP_FORCE_NATIVE_OPUS = 'true';
process.env.DP_DISABLE_OPUSSCRIPT = 'true';

// Prevent OpusScript from being loaded at runtime
const originalRequire = require;
require = function(id) {
  if (id === 'opusscript' || id.includes('opusscript')) {
    console.log('Blocked OpusScript from loading, using mediaplex instead');
    return { encode: () => Buffer.alloc(0) }; // Return dummy encoder
  }
  return originalRequire.apply(this, arguments);
};

// Override setTimeout to prevent negative timeouts
const originalSetTimeout = global.setTimeout;
global.setTimeout = (callback, delay, ...args) => {
  if (typeof delay === 'number' && delay < 0) {
    console.log('Preventing negative timeout, using 1000ms instead');
    delay = 1000;
  }
  return originalSetTimeout(callback, delay, ...args);
};

const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { Player, GuildQueueEvent } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');
const ffmpeg = require('ffmpeg-static');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const express = require('express');

// Use the more reliable FFmpeg path
const ffmpegPath = ffmpegInstaller.path || ffmpeg;

console.log('FFmpeg path:', ffmpegPath);

// --- Client Setup ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  rest: {
    rejectOnRateLimit: (rateLimitData) => {
      console.log(`[Rate Limit] Hit rate limit: ${rateLimitData.method} ${rateLimitData.url} - Retry after: ${rateLimitData.retryAfter}ms`);
      return false; // Don't throw, just log
    }
  }
});

client.commands = new Collection();

// Initialize Discord Player v7
client.player = new Player(client, {
  ytdlOptions: {
    quality: 'highestaudio',
    highWaterMark: 1 << 25,
    filter: 'audioonly',
    format: 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio',
    timeout: 30000,
    requestOptions: {
      timeout: 30000
    }
  },
  // Global voice connection options for v7
  skipFFmpeg: false,
  useLegacyFFmpeg: false,
  // Ensure bot is never deafened or muted
  selfDeaf: false,
  selfMute: false
});

// Configure Discord Player for proper voice connections (v7.1 API)
client.player.events.on('connection', (queue) => {
  console.log(`[Player] Connected to voice channel in ${queue.guild.name}`);
  
  // Ensure the bot is not deafened or muted
  if (queue.connection && queue.connection.voice) {
    console.log(`[Player] Voice state - Deafened: ${queue.connection.voice.deaf}, Muted: ${queue.connection.voice.mute}`);
  }
});

// Register extractors for v7.1
(async () => {
  try {
    // Use the correct v7.1 method as shown in the error message
    await client.player.extractors.loadMulti(DefaultExtractors);
    console.log(`✅ Loaded default extractors using loadMulti`);
    
    global.extractorsLoaded = true;
  } catch (error) {
    console.error('Failed to register extractors:', error);
    global.extractorsLoaded = false;
  }
})();

// Enhanced event handlers for 2025
client.player.events.on('error', (queue, error) => {
  console.error(`[Player Error] ${queue.guild.name}:`, error.message);
  
  // Handle Opus encoder errors gracefully
  if (error.message && (error.message.includes('Cannot convert "undefined" to int') || error.message.includes('OpusScript'))) {
    console.log(`[Player Error] Opus encoder error detected, skipping track...`);
    if (queue.node.isPlaying()) {
      queue.node.skip();
    }
    return;
  }
  
  if (queue.metadata?.channel) {
    queue.metadata.channel.send(`❌ Music player error: ${error.message}`).catch(console.error);
  }
});

client.player.events.on('playerError', (queue, error) => {
  console.error(`[Player Error] ${queue.guild.name}:`, error.message);
  
  // Handle Opus encoder errors gracefully
  if (error.message && (error.message.includes('Cannot convert "undefined" to int') || error.message.includes('OpusScript'))) {
    console.log(`[Player Error] Opus encoder error detected, skipping track...`);
    if (queue.node.isPlaying()) {
      queue.node.skip();
    }
    return;
  }
  
  if (queue.metadata?.channel) {
    queue.metadata.channel.send(`❌ Track playback error: ${error.message}`).catch(console.error);
  }
});

client.player.events.on('connectionError', (queue, error) => {
  console.error(`[Connection Error] ${queue.guild.name}:`, error.message);
  if (queue.metadata?.channel) {
    queue.metadata.channel.send(`❌ Voice connection error: ${error.message}`).catch(console.error);
  }
});

client.player.events.on(GuildQueueEvent.PlayerStart, (queue, track) => {
  console.log(`[Player] Now playing: ${track.title} by ${track.author} in ${queue.guild.name}`);
  console.log(`[Player] Track duration: ${track.duration} (${track.durationMS}ms)`);
  console.log(`[Player] Queue size: ${queue.tracks.size}`);
  console.log(`[Player] Is playing: ${queue.node.isPlaying()}`);
  
  if (queue.metadata?.channel) {
    queue.metadata.channel.send(`🎶 Now playing: **${track.title}** by ${track.author}`).catch(console.error);
  }
});

// Add debugging for when tracks are added to queue
client.player.events.on('trackAdd', (queue, track) => {
  console.log(`[Player] Added to queue: ${track.title} in ${queue.guild.name}`);
  console.log(`[Player] Queue size after add: ${queue.tracks.size}`);
  console.log(`[Player] Is playing: ${queue.node.isPlaying()}`);
  console.log(`[Player] Current track: ${queue.currentTrack?.title || 'None'}`);
  
  if (queue.metadata?.channel && queue.tracks.size > 1) {
    queue.metadata.channel.send(`🎵 Added to queue: **${track.title}** by ${track.author}`).catch(console.error);
  }
});

client.player.events.on(GuildQueueEvent.PlayerFinish, (queue, track) => {
  console.log(`[Player] Finished: ${track.title} in ${queue.guild.name}`);
  console.log(`[Player] Track ended - duration was: ${track.duration} (${track.durationMS}ms)`);
  console.log(`[Player] Queue size after track end: ${queue.tracks.size}`);
  console.log(`[Player] Is playing after track end: ${queue.node.isPlaying()}`);
  
  // If there are no more tracks in the queue after this one ends, show the empty message
  if (queue.tracks.size === 0 && queue.metadata?.channel) {
    setTimeout(() => {
      // Double-check that we're still not playing anything
      if (!queue.node.isPlaying() && queue.tracks.size === 0) {
        queue.metadata.channel.send(`🎵 Queue is empty. Add more songs with /play!`).catch(console.error);
      }
    }, 1000); // Small delay to ensure the track has fully ended
  }
});


client.player.events.on('trackError', (queue, error) => {
  console.error(`[Track Error] ${queue.guild.name}:`, error.message);
  if (queue.metadata?.channel) {
    queue.metadata.channel.send(`❌ Track error: ${error.message}`).catch(console.error);
  }
});

client.player.events.on(GuildQueueEvent.EmptyQueue, (queue) => {
  console.log(`[Player] Queue empty in ${queue.guild.name}`);
  console.log(`[Player] Queue size when empty: ${queue.tracks.size}`);
  console.log(`[Player] Is playing when empty: ${queue.node.isPlaying()}`);
  console.log(`[Player] Current track when empty: ${queue.currentTrack?.title || 'None'}`);
  
  // Don't show empty queue message here - let playerFinish handle it
  // This event fires when queue becomes empty but track might still be playing
  console.log(`[Player] Queue became empty, but not showing message yet`);
});

client.player.events.on(GuildQueueEvent.EmptyChannel, (queue) => {
  console.log(`[Player] Channel empty in ${queue.guild.name}`);
  console.log(`[Player] Current track when channel empty: ${queue.currentTrack?.title || 'None'}`);
  console.log(`[Player] Is playing when channel empty: ${queue.node.isPlaying()}`);
  
  if (queue.metadata?.channel) {
    queue.metadata.channel.send(`👋 Left voice channel - no one is listening!`).catch(console.error);
  }
});

client.player.events.on(GuildQueueEvent.QueueEnd, (queue) => {
  console.log(`[Player] Queue ended in ${queue.guild.name}`);
  if (queue.metadata?.channel) {
    queue.metadata.channel.send(`🎵 Queue finished! Thanks for listening!`).catch(console.error);
  }
});

client.player.events.on('connection', (queue) => {
  console.log(`[Player] Connected to voice channel in ${queue.guild.name}`);
  
  // Monitor voice connection state changes
  const checkVoiceState = () => {
    const voiceState = queue.connection?.voice;
    if (voiceState) {
      console.log(`[Player] Voice connection state - Ready: ${voiceState.state === 'ready'}, Deafened: ${voiceState.deaf}, Muted: ${voiceState.mute}`);
      
      if (voiceState.state === 'ready') {
        console.log(`[Player] Voice connection is now ready for playback!`);
      }
    } else {
      console.log(`[Player] Voice connection state - Voice state not available yet`);
    }
  };
  
  // Check immediately and then every 500ms for up to 10 seconds
  checkVoiceState();
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    checkVoiceState();
    
    if (attempts >= 20 || (queue.connection?.voice?.state === 'ready')) {
      clearInterval(interval);
    }
  }, 500);
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

// --- Crash Handling ---
process.on('unhandledRejection', err => {
  console.error('Unhandled Rejection:', err);
  // Don't exit on unhandled rejections for music bots
});

process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err);
  // Handle Opus encoder errors gracefully
  if (err.message && (err.message.includes('Cannot convert "undefined" to int') || err.message.includes('OpusScript') || err.message.includes('opusscript'))) {
    console.log('Opus encoder error detected, continuing...');
    return;
  }
  // Handle timeout warnings
  if (err.message && err.message.includes('TimeoutNegativeWarning')) {
    console.log('Timeout warning detected, continuing...');
    return;
  }
  // Handle other common music bot errors
  if (err.message && (err.message.includes('ENOTFOUND') || err.message.includes('ECONNRESET') || err.message.includes('ETIMEDOUT'))) {
    console.log('Network error detected, continuing...');
    return;
  }
  // For other critical errors, exit
  process.exit(1);
});

// --- Process Monitoring ---
const processId = process.pid;
console.log(`[Process] Starting bot with PID: ${processId}`);

// Monitor for duplicate processes
setInterval(() => {
  const { exec } = require('child_process');
  exec('tasklist | findstr node', (error, stdout) => {
    if (stdout) {
      const nodeProcesses = stdout.split('\n').filter(line => line.includes('node.exe'));
      if (nodeProcesses.length > 1) {
        console.warn(`[Process] WARNING: ${nodeProcesses.length} Node.js processes detected!`);
        nodeProcesses.forEach(proc => {
          const parts = proc.trim().split(/\s+/);
          const pid = parts[1];
          if (pid && pid !== processId.toString()) {
            console.warn(`[Process] Other Node.js process found: PID ${pid}`);
          }
        });
      }
    }
  });
}, 30000); // Check every 30 seconds

// --- Login ---
client.login(process.env.DISCORD_TOKEN);

// --- Uptime server ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Musty Bot 2025 is alive! 🎵'));
app.listen(PORT, () => console.log(`Uptime server running on port ${PORT}`));

module.exports = client;