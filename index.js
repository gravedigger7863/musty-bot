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
    highWaterMark: 1 << 25
  }
});

// Load extractors
client.player.extractors.loadMulti(DefaultExtractors);

// Add local file support
const { LocalExtractor } = require('@discord-player/extractor');
client.player.extractors.register(LocalExtractor, {});

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
  const channel = client.channels.cache.get(queue.metadata.channel.id);
  if (channel) {
    channel.send(`❌ Player error: ${error.message}`);
  }
});

client.player.events.on('queueEnd', (queue) => {
  const channel = client.channels.cache.get(queue.metadata.channel.id);
  if (channel) {
    channel.send(`🎵 Queue finished! Thanks for listening!`);
  }
});

client.player.events.on('emptyChannel', (queue) => {
  queue.delete();
  const channel = client.channels.cache.get(queue.metadata.channel.id);
  if (channel) {
    channel.send(`👋 Left voice channel - no one is listening!`);
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

// --- Login ---
client.login(process.env.DISCORD_TOKEN);

// --- Uptime server ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Musty Bot 2025 with Lavalink is alive! 🎵'));
app.listen(PORT, () => console.log(`Uptime server running on port ${PORT}`));

module.exports = client;
