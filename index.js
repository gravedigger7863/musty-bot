require('dotenv').config();

const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');
const ffmpeg = require('ffmpeg-static');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

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

// Initialize player with optimized configuration
client.player = new Player(client, {
  ffmpegPath: ffmpegPath,
  selfDeaf: false,
  selfMute: false,
  bufferingTimeout: 10000,
  connectionTimeout: 30000,
  // Enhanced configuration for better stability
  skipOnEmpty: true,
  skipOnEmptyCooldown: 30000,
  leaveOnEnd: true,
  leaveOnEmpty: true,
  leaveOnEmptyCooldown: 30000,
  leaveOnStop: true,
  autoSelfDeaf: false,
  autoSelfMute: false
});

// Load default extractors using the new method
const { DefaultExtractors } = require('@discord-player/extractor');
client.player.extractors.loadMulti(DefaultExtractors);

console.log(`✅ Loaded default extractors`);

// Enhanced event handlers for better music experience
client.player.events.on('error', (queue, error) => {
  console.error(`[Player Error] ${queue.guild.name}:`, error.message);
  if (queue.metadata?.channel) {
    queue.metadata.channel.send(`❌ Music player error: ${error.message || 'Unknown error'}`).catch(console.error);
  }
});

client.player.events.on('playerError', (queue, error) => {
  console.error(`[Player Error] ${queue.guild.name}:`, error.message);
  if (queue.metadata?.channel) {
    queue.metadata.channel.send(`❌ Track playback error: ${error.message || 'Unknown error'}`).catch(console.error);
  }
});

client.player.events.on('connectionError', (queue, error) => {
  console.error(`[Connection Error] ${queue.guild.name}:`, error.message);
  if (queue.metadata?.channel) {
    queue.metadata.channel.send(`❌ Voice connection error: ${error.message || 'Unknown error'}`).catch(console.error);
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
    queue.metadata.channel.send(`❌ Track error: ${error.message || 'Unknown error'}`).catch(console.error);
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

console.log('✅ Discord Player configuration complete');

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

// --- Crash Handling ---
process.on('unhandledRejection', err => console.error('Unhandled Rejection:', err));
process.on('uncaughtException', err => console.error('Uncaught Exception:', err));

// --- Login ---
client.login(process.env.DISCORD_TOKEN);

// --- Uptime server ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Musty Bot is alive! 🎵'));
app.listen(PORT, () => console.log(`Uptime server running on port ${PORT}`));

module.exports = client;
