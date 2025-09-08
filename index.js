require('dotenv').config();
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent // needed for reading messages
  ],
});

// collections for commands
client.commands = new Collection();

// load commands with safety check
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

// load events
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

client.login(process.env.DISCORD_TOKEN);

// index.js (or at the bottom)
const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;

// Simple endpoint for UptimeRobot
app.get('/', (req, res) => res.send('Bot is alive!'));

app.listen(PORT, () => console.log(`Uptime server running on port ${PORT}`));
