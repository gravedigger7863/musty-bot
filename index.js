require('dotenv').config();
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { Player } = require('discord-player');
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
client.player = new Player(client);

const { 
  SoundCloudExtractor, 
  SpotifyExtractor, 
  VimeoExtractor, 
  BandcampExtractor, 
  AppleMusicExtractor, 
  ReverbNationExtractor 
} = require('@discord-player/extractor');

// Register all extractors
client.player.extractors.register(SoundCloudExtractor);
client.player.extractors.register(SpotifyExtractor);
client.player.extractors.register(VimeoExtractor);
client.player.extractors.register(BandcampExtractor);
client.player.extractors.register(AppleMusicExtractor);
client.player.extractors.register(ReverbNationExtractor);

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
for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// --- Button Interaction Handler ---
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const queue = client.player.nodes.get(interaction.guild.id);
  if (!queue) return interaction.reply({ content: '⚠️ No music is playing.', ephemeral: true });

  switch (interaction.customId) {
    case 'pause':
      queue.node.setPaused(!queue.node.isPaused());
      return interaction.reply({ content: queue.node.isPaused() ? '⏸️ Paused' : '▶️ Resumed', ephemeral: true });
    case 'skip':
      queue.node.skip();
      return interaction.reply({ content: '⏭️ Skipped', ephemeral: true });
    case 'stop':
      queue.delete();
      return interaction.reply({ content: '🛑 Stopped', ephemeral: true });
    case 'volup':
      queue.node.setVolume(Math.min(queue.node.volume + 10, 100));
      return interaction.reply({ content: `🔊 Volume: ${queue.node.volume}%`, ephemeral: true });
    case 'voldown':
      queue.node.setVolume(Math.max(queue.node.volume - 10, 0));
      return interaction.reply({ content: `🔉 Volume: ${queue.node.volume}%`, ephemeral: true });
    case 'loop':
      queue.setRepeatMode(queue.repeatMode === 0 ? 1 : 0);
      return interaction.reply({ content: queue.repeatMode === 1 ? '🔁 Looping current track' : 'Loop disabled', ephemeral: true });
    case 'autoplay':
      queue.node.setAutoplay(!queue.node.isAutoplay);
      return interaction.reply({ content: queue.node.isAutoplay ? '▶️ Autoplay Enabled' : 'Autoplay Disabled', ephemeral: true });
    case 'queue':
      const current = queue.currentTrack;
      const tracks = queue.tracks.toArray();
      let text = `🎶 **Now Playing:** ${current.title}\n`;
      if (tracks.length > 0) {
        text += '\n📜 **Up Next:**\n';
        tracks.slice(0, 10).forEach((t, i) => text += `${i + 1}. ${t.title}\n`);
        if (tracks.length > 10) text += `...and ${tracks.length - 10} more`;
      } else {
        text += '\n🚫 No more songs in the queue.';
      }
      return interaction.reply({ content: text, ephemeral: true });
  }
});

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
