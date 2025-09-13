require('dotenv').config();

const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { Player } = require('discord-player');
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
});

client.commands = new Collection();

// Initialize player with 2025 optimized configuration
client.player = new Player(client, {
  ffmpegPath: ffmpegPath,
  selfDeaf: false,
  selfMute: false,
  bufferingTimeout: 15000,
  connectionTimeout: 30000,
  skipOnEmpty: true,
  skipOnEmptyCooldown: 30000,
  leaveOnEnd: true,
  leaveOnEmpty: true,
  leaveOnEmptyCooldown: 30000,
  leaveOnStop: true,
  autoSelfDeaf: false,
  autoSelfMute: false,
  // Fix Opus encoder issues
  useLegacyFFmpeg: false,
  ytdlOptions: {
    quality: 'highestaudio',
    highWaterMark: 1 << 25,
    // Add audio format validation
    filter: 'audioonly',
    format: 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio',
    // Fix timeout issues
    timeout: 30000,
    requestOptions: {
      timeout: 30000
    }
  },
  // Add Opus encoder configuration
  opusEncoder: {
    rate: 48000,
    channels: 2,
    frameSize: 960
  }
});

// Load extractors using the latest 2025 method
(async () => {
  try {
    await client.player.extractors.loadMulti(DefaultExtractors);
    console.log(`✅ Loaded ${client.player.extractors.size} extractors`);
    global.extractorsLoaded = true;
  } catch (error) {
    console.error('Failed to load extractors:', error);
    global.extractorsLoaded = false;
  }
})();

// Enhanced event handlers for 2025
client.player.events.on('error', (queue, error) => {
  console.error(`[Player Error] ${queue.guild.name}:`, error.message);
  
  // Handle Opus encoder errors gracefully
  if (error.message && error.message.includes('Cannot convert "undefined" to int')) {
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
  if (error.message && error.message.includes('Cannot convert "undefined" to int')) {
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

client.player.events.on('trackStart', (queue, track) => {
  console.log(`[Player] Now playing: ${track.title} by ${track.author} in ${queue.guild.name}`);
  if (queue.metadata?.channel) {
    queue.metadata.channel.send(`🎶 Now playing: **${track.title}** by ${track.author}`).catch(console.error);
  }
});

client.player.events.on('trackEnd', (queue, track) => {
  console.log(`[Player] Finished: ${track.title} in ${queue.guild.name}`);
});

client.player.events.on('trackAdd', (queue, track) => {
  console.log(`[Player] Added to queue: ${track.title} in ${queue.guild.name}`);
  if (queue.metadata?.channel && queue.tracks.size > 1) {
    queue.metadata.channel.send(`🎵 Added to queue: **${track.title}** by ${track.author}`).catch(console.error);
  }
});

client.player.events.on('trackError', (queue, error) => {
  console.error(`[Track Error] ${queue.guild.name}:`, error.message);
  if (queue.metadata?.channel) {
    queue.metadata.channel.send(`❌ Track error: ${error.message}`).catch(console.error);
  }
});

client.player.events.on('emptyQueue', (queue) => {
  console.log(`[Player] Queue empty in ${queue.guild.name}`);
  if (queue.metadata?.channel) {
    queue.metadata.channel.send(`🎵 Queue is empty. Add more songs with /play!`).catch(console.error);
  }
});

client.player.events.on('emptyChannel', (queue) => {
  console.log(`[Player] Channel empty in ${queue.guild.name}`);
  if (queue.metadata?.channel) {
    queue.metadata.channel.send(`👋 Left voice channel - no one is listening!`).catch(console.error);
  }
});

client.player.events.on('queueEnd', (queue) => {
  console.log(`[Player] Queue ended in ${queue.guild.name}`);
  if (queue.metadata?.channel) {
    queue.metadata.channel.send(`🎵 Queue finished! Thanks for listening!`).catch(console.error);
  }
});

client.player.events.on('connection', (queue) => {
  console.log(`[Player] Connected to voice channel in ${queue.guild.name}`);
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
  if (err.message && err.message.includes('Cannot convert "undefined" to int')) {
    console.log('Opus encoder error detected, continuing...');
    return;
  }
  // Handle timeout warnings
  if (err.message && err.message.includes('TimeoutNegativeWarning')) {
    console.log('Timeout warning detected, continuing...');
    return;
  }
  // For other critical errors, exit
  process.exit(1);
});

// --- Login ---
client.login(process.env.DISCORD_TOKEN);

// --- Uptime server ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Musty Bot 2025 is alive! 🎵'));
app.listen(PORT, () => console.log(`Uptime server running on port ${PORT}`));

module.exports = client;