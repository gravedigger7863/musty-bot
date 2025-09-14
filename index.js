require('dotenv').config();

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { Manager } = require('erela.js');
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

// --- Lavalink Manager Setup ---
client.manager = new Manager({
  nodes: [
    {
      host: process.env.LAVALINK_HOST || '94.130.97.149', // Your VPS IP
      port: parseInt(process.env.LAVALINK_PORT) || 2333,
      password: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
    }
  ],
  send: (id, payload) => {
    const guild = client.guilds.cache.get(id);
    if (guild) guild.shard.send(payload);
  },
  autoPlay: false,
  plugins: [],
});

// --- Event Handlers ---
client.on('ready', () => {
  console.log(`✅ ${client.user.tag} is ready with Lavalink!`);
  console.log(`🎵 Connected to ${client.manager.nodes.size} Lavalink node(s)`);
});

client.manager.on('nodeConnect', node => {
  console.log(`🔗 Lavalink node "${node.options.identifier}" connected`);
});

client.manager.on('nodeError', (node, error) => {
  console.error(`❌ Lavalink node "${node.options.identifier}" error:`, error);
});

client.manager.on('trackStart', (player, track) => {
  const channel = client.channels.cache.get(player.textChannel);
  if (channel) {
    channel.send(`🎵 Now playing: **${track.title}** by ${track.author}`);
  }
});

client.manager.on('trackEnd', (player, track, reason) => {
  console.log(`🏁 Track ended: ${track.title} (${reason})`);
});

client.manager.on('trackError', (player, track, error) => {
  console.error(`❌ Track error: ${error.message}`);
  const channel = client.channels.cache.get(player.textChannel);
  if (channel) {
    channel.send(`❌ Track error: ${error.message}`);
  }
});

client.manager.on('queueEnd', (player) => {
  const channel = client.channels.cache.get(player.textChannel);
  if (channel) {
    channel.send(`🎵 Queue finished! Thanks for listening!`);
  }
});

client.manager.on('playerMove', (player, oldChannel, newChannel) => {
  if (!newChannel) {
    player.destroy();
    const channel = client.channels.cache.get(player.textChannel);
    if (channel) {
      channel.send(`👋 Left voice channel - no one is listening!`);
    }
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
