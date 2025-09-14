require('dotenv').config();

// Set timeout environment variables to prevent negative timeouts
process.env.NODE_OPTIONS = '--max-old-space-size=4096';
process.env.UV_THREADPOOL_SIZE = '16';

// Force use of native Opus encoder instead of OpusScript
process.env.DP_FORCE_NATIVE_OPUS = 'true';
process.env.DP_DISABLE_OPUSSCRIPT = 'true';
process.env.DP_USE_NATIVE_OPUS = 'true';

// Additional Opus configuration
process.env.OPUS_APPLICATION = 'voip';
process.env.OPUS_BITRATE = '128000';
process.env.OPUS_FRAME_SIZE = '960';

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
// Import extractors from the main package
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
    GatewayIntentBits.GuildVoiceStates, // 🔑 ABSOLUTELY REQUIRED for voice connection state - ENABLED IN PORTAL
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
    timeout: 60000, // Increased timeout
    requestOptions: {
      timeout: 60000, // Increased timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    }
  },
  // Global voice connection options for v7
  skipFFmpeg: false,
  useLegacyFFmpeg: false,
  // Ensure bot is never deafened or muted
  selfDeaf: false,
  selfMute: false,
  // Debug options for VPS troubleshooting
  leaveOnEmpty: true,
  leaveOnEnd: true,
  leaveOnStop: true,
  // Additional configuration to prevent immediate track finishing
  bufferingTimeout: 30000,
  connectionTimeout: 30000,
  // Additional extractor configuration
  extractors: {
    enabled: true,
    providers: ['youtube', 'spotify', 'soundcloud', 'apple', 'deezer']
  }
});

// Configure Discord Player for proper voice connections (v7.1 API)
client.player.events.on('connection', (queue) => {
  console.log(`[Player] Connected to voice channel in ${queue.guild.name}`);
  
  // Wait a moment for voice state to be available
  setTimeout(() => {
    const voiceState = queue.connection?.voice;
    if (voiceState) {
      console.log(`[Player] ✅ Voice connection established - Deafened: ${voiceState.deaf}, Muted: ${voiceState.mute}`);
    } else {
      console.log(`[Player] ⚠️ Voice state not available - this is normal during connection establishment`);
    }
  }, 1000);
});

// Register extractors for v7.1 - Enhanced approach with SoundCloud focus
(async () => {
  try {
    // Wait for player to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('🔍 Registering extractors...');
    
    // Use the simple loadMulti method as per Discord Player docs
    await client.player.extractors.loadMulti(DefaultExtractors);
    
    console.log(`✅ Extractors registered successfully`);
    
    // Verify extractors are loaded
    const loadedExtractors = client.player.extractors.store;
    console.log(`✅ Loaded extractors: ${Array.from(loadedExtractors.keys()).join(', ')}`);
    console.log(`✅ Extractor store size: ${loadedExtractors.size}`);
    
    // Specifically check SoundCloud extractor
    const soundcloudExtractor = loadedExtractors.get('com.discord-player.soundcloudextractor');
    if (soundcloudExtractor) {
      console.log(`✅ SoundCloud extractor loaded successfully`);
    } else {
      console.log(`⚠️ SoundCloud extractor not found - this may cause SoundCloud track issues`);
    }
    
    global.extractorsLoaded = true;
  } catch (error) {
    console.error('Failed to register extractors:', error);
    console.error('Extractor error details:', error.stack);
    global.extractorsLoaded = false;
  }
})();

// Enhanced event handlers for 2025
client.player.events.on('error', (queue, error) => {
  console.error(`[Player Error] ${queue.guild.name}:`, error.message);
  console.error(`[Player Error] Full error:`, error);
  
  // Handle extractor errors specifically
  if (error.message && error.message.includes('Could not extract stream')) {
    console.error(`[Player Error] Extractor error detected - this may indicate missing or misconfigured extractors`);
    console.error(`[Player Error] Available extractors:`, global.extractorsLoaded ? 'Loaded' : 'Not loaded');
    console.error(`[Player Error] Extractor store:`, client.player.extractors.store ? Array.from(client.player.extractors.store.keys()) : 'No store available');
  }
  
  // Handle Opus encoder errors gracefully
  if (error.message && (error.message.includes('Cannot convert "undefined" to int') || error.message.includes('OpusScript'))) {
    console.log(`[Player Error] Opus encoder error detected, skipping track...`);
    if (queue.node.isPlaying()) {
      queue.node.skip();
    }
    return;
  }
  
  // Handle FFmpeg errors
  if (error.message && error.message.includes('ffmpeg')) {
    console.error(`[Player Error] FFmpeg error detected - check FFmpeg installation on VPS`);
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
  console.log(`[Player] 🎵 PLAYER START EVENT TRIGGERED`);
  console.log(`[Player] Now playing: ${track.title} by ${track.author} in ${queue.guild.name}`);
  console.log(`[Player] Track duration: ${track.duration} (${track.durationMS}ms)`);
  console.log(`[Player] Queue size: ${queue.tracks.size}`);
  console.log(`[Player] Is playing: ${queue.node.isPlaying()}`);
  console.log(`[Player] Voice connection: ${queue.connection ? 'Connected' : 'Not connected'}`);
  console.log(`[Player] Current track: ${queue.currentTrack?.title || 'None'}`);
  console.log(`[Player] Track ID: ${track.id || 'No ID'}`);
  console.log(`[Player] Track URL: ${track.url || 'No URL'}`);
  
  // Additional debugging for track start
  console.log(`[Player] Track source: ${track.source || 'Unknown'}`);
  console.log(`[Player] Track stream URL: ${track.raw?.url || track.url || 'No stream URL'}`);
  console.log(`[Player] Track format: ${track.raw?.format || 'Unknown format'}`);
  console.log(`[Player] Track quality: ${track.raw?.quality || 'Unknown quality'}`);
  
  // Check if track has valid duration
  if (!track.durationMS || track.durationMS <= 0) {
    console.log(`[Player] ⚠️ WARNING: Track has invalid duration (${track.durationMS}ms)`);
  }
  
  // Send "Now Playing" message to channel
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
  console.log(`[Player] Track ID: ${track.id || 'No ID'}`);
  console.log(`[Player] Track URL: ${track.url || 'No URL'}`);
  
  // Only show "Added to queue" message if there are multiple tracks (not the currently playing one)
  if (queue.metadata?.channel && queue.tracks.size > 1) {
    queue.metadata.channel.send(`🎵 Added to queue: **${track.title}** by ${track.author}`).catch(console.error);
  }
});

// Add event handler for when tracks are actually playing (not just started)
client.player.events.on('playerUpdate', (queue, oldState, newState) => {
  if (oldState.status !== newState.status) {
    console.log(`[Player] Status changed: ${oldState.status} -> ${newState.status}`);
    console.log(`[Player] Current track: ${queue.currentTrack?.title || 'None'}`);
    console.log(`[Player] Is playing: ${queue.node.isPlaying()}`);
    console.log(`[Player] Position: ${queue.node.getTimestamp()?.current || 'Unknown'}`);
  }
});

// Add comprehensive debug logging for queue and connection issues
client.player.events.on('debug', (message) => {
  console.log(`[Player Debug] ${message}`);
});

// Add connection stability event handlers
client.player.events.on('connectionCreate', (queue) => {
  console.log(`[Player] ✅ Voice connection established in ${queue.guild.name}`);
  console.log(`[Player] Connection state: ${queue.connection?.state || 'Unknown'}`);
  console.log(`[Player] Voice channel: ${queue.connection?.joinConfig?.channelId || 'Unknown'}`);
});

client.player.events.on('connectionDestroy', (queue) => {
  console.log(`[Player] ❌ Voice connection destroyed in ${queue.guild.name}`);
  console.log(`[Player] Reason: ${queue.connection?.state || 'Unknown'}`);
});

// Add queue-specific event handlers
client.player.events.on('queueEnd', (queue) => {
  console.log(`[Player] 📭 Queue ended in ${queue.guild.name}`);
  console.log(`[Player] Final queue size: ${queue.tracks.size}`);
  console.log(`[Player] Is playing when queue ends: ${queue.node.isPlaying()}`);
  console.log(`[Player] Current track when queue ends: ${queue.currentTrack?.title || 'None'}`);
});

// Add track loading validation
client.player.events.on('trackLoad', (queue, track) => {
  console.log(`[Player] 📥 Track loaded: ${track.title}`);
  console.log(`[Player] Track source: ${track.source}`);
  console.log(`[Player] Track duration: ${track.duration} (${track.durationMS}ms)`);
  console.log(`[Player] Track URL: ${track.url}`);
  console.log(`[Player] Track format: ${track.raw?.format || 'Unknown'}`);
  console.log(`[Player] Track quality: ${track.raw?.quality || 'Unknown'}`);
  
  // Validate track has proper duration
  if (!track.durationMS || track.durationMS <= 0) {
    console.log(`[Player] ⚠️ WARNING: Track has invalid duration - this may cause immediate finishing`);
  }
});

client.player.events.on(GuildQueueEvent.PlayerFinish, (queue, track) => {
  console.log(`[Player] 🏁 PLAYER FINISH EVENT TRIGGERED`);
  console.log(`[Player] Finished: ${track.title} in ${queue.guild.name}`);
  console.log(`[Player] Track ended - duration was: ${track.duration} (${track.durationMS}ms)`);
  console.log(`[Player] Queue size before cleanup: ${queue.tracks.size}`);
  console.log(`[Player] Is playing after track end: ${queue.node.isPlaying()}`);
  console.log(`[Player] Voice connection: ${queue.connection ? 'Connected' : 'Not connected'}`);
  console.log(`[Player] Current track after finish: ${queue.currentTrack?.title || 'None'}`);
  
  // Additional debugging for track finish reasons
  console.log(`[Player] Track finish reason: ${track.finishReason || 'Unknown'}`);
  console.log(`[Player] Track source: ${track.source || 'Unknown'}`);
  console.log(`[Player] Track stream URL: ${track.url || 'No URL'}`);
  console.log(`[Player] Track duration in seconds: ${Math.floor(track.durationMS / 1000)}s`);
  console.log(`[Player] Track position when finished: ${queue.node.getTimestamp()?.current || 'Unknown'}`);
  
  // Get more detailed finish reason from the queue node
  try {
    const finishReason = queue.node.getPlayerFinishReason();
    console.log(`[Player] Detailed finish reason: ${finishReason || 'Unknown'}`);
  } catch (error) {
    console.log(`[Player] Could not get detailed finish reason: ${error.message}`);
  }
  
  // Check if this is an immediate finish (less than 5 seconds)
  const trackDuration = track.durationMS || 0;
  if (trackDuration > 0 && trackDuration < 5000) {
    console.log(`[Player] ⚠️ WARNING: Track finished very quickly (${trackDuration}ms) - possible streaming issue`);
    console.log(`[Player] This suggests either: 1) Stream failed to load, 2) Voice connection dropped, or 3) Track format issue`);
    
    // If this is an immediate finish, try to prevent the queue from getting stuck
    if (queue.tracks.size === 0 && !queue.node.isPlaying()) {
      console.log(`[Player] Queue is empty and not playing after immediate finish - this is normal`);
    }
  }
  
  // Check if queue is actually playing to prevent ghost replays
  if (!queue.node.isPlaying()) {
    console.log(`[Player] Queue is not playing, track finished normally`);
  } else {
    console.log(`[Player] Queue is still playing, track finished but continuing`);
  }
  
  // The track has finished - Discord Player should automatically handle queue progression
  // We just need to ensure proper cleanup and messaging
  
  // Don't send empty message here - let EmptyQueue event handle it
  console.log(`[Player] Track finished, queue size: ${queue.tracks.size}`);
});


client.player.events.on('trackError', (queue, error) => {
  console.error(`[Track Error] ${queue.guild.name}:`, error.message);
  console.error(`[Track Error] Full error:`, error);
  console.error(`[Track Error] Current track: ${queue.currentTrack?.title || 'None'}`);
  console.error(`[Track Error] Is playing: ${queue.node.isPlaying()}`);
  
  // Handle specific streaming errors that cause immediate track finishing
  if (error.message && (
    error.message.includes('stream') || 
    error.message.includes('format') || 
    error.message.includes('codec') ||
    error.message.includes('ffmpeg') ||
    error.message.includes('opus')
  )) {
    console.error(`[Track Error] Streaming error detected - this may cause immediate track finishing`);
  }
  
  if (queue.metadata?.channel) {
    queue.metadata.channel.send(`❌ Track error: ${error.message}`).catch(console.error);
  }
});

client.player.events.on(GuildQueueEvent.EmptyQueue, (queue) => {
  console.log(`[Player] Queue empty in ${queue.guild.name}`);
  console.log(`[Player] Queue size when empty: ${queue.tracks.size}`);
  console.log(`[Player] Is playing when empty: ${queue.node.isPlaying()}`);
  console.log(`[Player] Current track when empty: ${queue.currentTrack?.title || 'None'}`);
  
  // This event fires when the queue becomes empty
  // If we're not currently playing anything, show the empty message
  if (!queue.node.isPlaying() && queue.metadata?.channel) {
    console.log(`[Player] Queue is empty and not playing, showing empty message from EmptyQueue event`);
    queue.metadata.channel.send(`🎵 Queue is empty. Add more songs with /play!`).catch(console.error);
  }
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
  console.log(`[Player] Final queue size: ${queue.tracks.size}`);
  console.log(`[Player] Is playing when queue ends: ${queue.node.isPlaying()}`);
  console.log(`[Player] Current track when queue ends: ${queue.currentTrack?.title || 'None'}`);
  
  if (queue.metadata?.channel) {
    queue.metadata.channel.send(`🎵 Queue finished! Thanks for listening!`).catch(console.error);
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