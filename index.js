require('dotenv').config();

// Force discord-player to use play-dl for better stream extraction
process.env.DP_FORCE_YTDL_MOD = 'play-dl';

const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');
const ffmpeg = require('ffmpeg-static');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const { Mediaplex } = require('mediaplex');

// Verify FFmpeg paths
console.log('FFmpeg path (ffmpeg-static):', ffmpeg);
console.log('FFmpeg path (ffmpeg-installer):', ffmpegInstaller.path);

// Use the more reliable FFmpeg path
const ffmpegPath = ffmpegInstaller.path || ffmpeg;

// Global interaction lock to prevent Discord retry race conditions
const activeInteractions = new Set();

// Additional libraries
const express = require('express');

// --- Client Setup ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.commands = new Collection();

// Initialize player first with ffmpeg-static and play-dl configuration
client.player = new Player(client, {
  ytdlOptions: { 
    quality: 'highestaudio', 
    filter: 'audioonly',
    highWaterMark: 1 << 25,
    // Enhanced options for better stability
    requestOptions: {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    }
  },
  // Use enhanced FFmpeg for better audio processing
  ffmpegPath: ffmpegPath,
  // Force use of play-dl for better stream extraction
  useLegacyFFmpeg: false,
  skipFFmpeg: false,
  // Ensure bot doesn't get deafened
  selfDeaf: false,
  selfMute: false,
  // Add additional options for better compatibility
  bufferingTimeout: 5000,
  connectionTimeout: 30000
});

// Extractors will be registered in the ready event

// Load default extractors (YouTube, SoundCloud, Spotify, etc.) and downloader - v7+ method
// This will be called after the bot is ready in events/ready.js

// Add comprehensive error event handlers
client.player.events.on('error', (queue, error) => {
  console.error(`[Player Error] ${queue.guild.name}:`, error);
  // Try to notify the channel about the error
  if (queue.metadata?.channel) {
    queue.metadata.channel.send(`❌ Music player error: ${error.message || 'Unknown error'}`).catch(console.error);
  }
});

client.player.events.on('playerError', (queue, error) => {
  console.log(`Player error in ${queue.guild.name}:`, error);
  // Try to notify the channel about the error
  if (queue.metadata?.channel) {
    queue.metadata.channel.send(`❌ Music player error: ${error.message || 'Unknown error'}`).catch(console.error);
  }
});

client.player.events.on('connectionError', (queue, error) => {
  console.error(`[Connection Error] ${queue.guild.name}:`, error);
  // Try to notify the channel about the error
  if (queue.metadata?.channel) {
    queue.metadata.channel.send(`❌ Voice connection error: ${error.message || 'Unknown error'}`).catch(console.error);
  }
});

// Add better error handling for stream extraction
client.player.events.on('trackStart', (queue, track) => {
  console.log(`[Player] Now playing: ${track.title} in ${queue.connection?.channel?.name || queue.guild.name}`);
  console.log(`[Player] Queue size: ${queue.tracks.size}, Is playing: ${queue.isPlaying()}`);
});

client.player.events.on('trackEnd', (queue, track) => {
  console.log(`[Player] Finished playing: ${track.title} in ${queue.guild.name}`);
  console.log(`[Player] Queue size after track end: ${queue.tracks.size}`);
});

client.player.events.on('trackAdd', (queue, track) => {
  console.log(`[Player] Added to queue: ${track.title} in ${queue.guild.name}`);
  console.log(`[Player] Queue size after add: ${queue.tracks.size}`);
});

// Add error handling for track errors
client.player.events.on('trackError', (queue, error) => {
  console.error(`[Track Error] ${queue.guild.name}:`, error);
  // Try to notify the channel about the error
  if (queue.metadata?.channel) {
    queue.metadata.channel.send(`❌ Track error: ${error.message || 'Unknown error'}`).catch(console.error);
  }
});

// Add comprehensive debug logging for troubleshooting
client.player.events.on('debug', (queue, message) => {
  // Log all debug messages for troubleshooting
  console.log(`[Player Debug] ${queue?.guild?.name || 'No Guild'}: ${message}`);
});

client.player.events.on('emptyQueue', (queue) => {
  console.log(`[Player] Queue empty in ${queue.guild.name}`);
  console.log(`[Player] Empty queue details:`, {
    guildId: queue.guild.id,
    guildName: queue.guild.name,
    connectionExists: !!queue.connection,
    nodeExists: !!queue.node,
    tracksSize: queue.tracks.size,
    isPlaying: queue.node?.isPlaying?.() || false
  });
});

client.player.events.on('emptyChannel', (queue) => {
  console.log(`[Player] Channel empty in ${queue.guild.name}`);
});

client.player.events.on('queueEnd', (queue) => {
  console.log(`[Player] Queue ended in ${queue.connection?.channel?.name || queue.guild.name}`);
});

// Bot should connect without being deafened now
client.player.events.on('connection', (queue) => {
  console.log(`[Player] Connected to voice channel in ${queue.guild.name}`);
});

// Extractors and downloader are now properly loaded in events/ready.js
console.log('✅ Discord Player configuration complete - extractors and downloader will load on ready');

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
  }
}

// --- Event Loader ---
const eventsPath = path.join(__dirname, 'events');
const loadedEvents = new Set();

// Make activeInteractions available globally for event handlers
global.activeInteractions = activeInteractions;

for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
  const event = require(path.join(eventsPath, file));
  
  // Prevent duplicate event registration
  if (loadedEvents.has(event.name)) {
    console.log(`⚠️ Duplicate event detected: ${event.name} - skipping`);
    continue;
  }
  loadedEvents.add(event.name);
  
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
    console.log(`✅ Event loaded (once): ${event.name}`);
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
    console.log(`✅ Event loaded: ${event.name}`);
  }
}

// --- Voice State Monitoring ---
let voiceStateFixAttempts = new Map(); // Track fix attempts per guild

// Disabled voice state monitoring - let Discord handle it naturally
// client.on('voiceStateUpdate', (oldState, newState) => {
//   // Voice state monitoring disabled to prevent infinite loops
// });

// Button interactions are now handled in events/interactionCreate.js

// --- Crash Handling ---
process.on('unhandledRejection', err => console.error('Unhandled Rejection:', err));
process.on('uncaughtException', err => console.error('Uncaught Exception:', err));


// --- Login ---
client.login(process.env.DISCORD_TOKEN);

// --- Uptime server ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`Uptime server running on port ${PORT}`));

module.exports = client;
