require('dotenv').config();

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');
const fs = require('fs');
const path = require('path');
const express = require('express');

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

// Load extractors
client.player.extractors.loadMulti(DefaultExtractors);

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

client.player.events.on('playerFinish', (queue, track) => {
  console.log(`🏁 Track finished: ${track.title}`);
});

client.player.events.on('playerError', (queue, error) => {
  console.error(`❌ Player error:`, error);
  console.error(`❌ Error details:`, error.stack);
  
  // Handle specific error types
  if (error.message && error.message.includes('Could not extract stream')) {
    console.error(`❌ Stream extraction failed - this may indicate missing or misconfigured extractors`);
  }
  
  if (error.message && error.message.includes('ENOTFOUND') || error.message.includes('ECONNRESET')) {
    console.error(`❌ Network error detected - this may cause immediate track finishing`);
  }
  
  const channel = client.channels.cache.get(queue.metadata.channel.id);
  if (channel) {
    let errorMessage = `❌ Player error: ${error.message}`;
    
    // Provide more helpful error messages
    if (error.message && error.message.includes('stream')) {
      errorMessage = `❌ Track streaming failed. This track may not be available for streaming. Try a different track.`;
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

// Add debug logging
client.player.events.on('debug', (message) => {
  console.log(`[Player Debug] ${message}`);
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

// --- Login ---
client.login(process.env.DISCORD_TOKEN);

// --- Uptime server ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Musty Bot 2025 with Lavalink is alive! 🎵'));
app.listen(PORT, () => console.log(`Uptime server running on port ${PORT}`));

module.exports = client;
