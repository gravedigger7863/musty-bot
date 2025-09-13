require('dotenv').config();
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { Player } = require('discord-player');
const { YoutubeiExtractor } = require('discord-player-youtubei');
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
client.player = new Player(client, {
  // Disable any automatic muting behavior
  skipFFmpeg: false,
  ytdlOptions: {
    quality: 'highestaudio',
    highWaterMark: 1 << 25
  }
});

// Register YouTube extractor
client.player.extractors.register(YoutubeiExtractor);

// Add these imports if you install the packages
// const { SpotifyExtractor } = require('discord-player-spotify');
// const { SoundCloudExtractor } = require('discord-player-soundcloud');

// Register additional extractors
// client.player.extractors.register(SpotifyExtractor);
// client.player.extractors.register(SoundCloudExtractor);

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

// --- Voice State Monitoring ---
client.on('voiceStateUpdate', (oldState, newState) => {
  // Only monitor the bot's own voice state
  if (newState.member.id === client.user.id) {
    console.log(`Bot voice state changed:`, {
      channel: newState.channel?.name || 'None',
      mute: newState.mute,
      deaf: newState.deaf,
      selfMute: newState.selfMute,
      selfDeaf: newState.selfDeaf
    });
    
    // If bot gets muted, try to unmute it
    if (newState.mute && !oldState.mute) {
      console.log('Bot was muted! Attempting to unmute...');
      newState.setMute(false).catch(err => {
        console.error('Failed to unmute bot:', err);
      });
    }
    
    // If bot gets deafened, try to undeafen it
    if (newState.deaf && !oldState.deaf) {
      console.log('Bot was deafened! Attempting to undeafen...');
      newState.setDeaf(false).catch(err => {
        console.error('Failed to undeafen bot:', err);
      });
    }
  }
});

// --- Button Interaction Handler ---
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const queue = client.player.nodes.get(interaction.guild.id);
  if (!queue) return interaction.reply({ content: '⚠️ No music is playing.', flags: 64 });

  switch (interaction.customId) {
    case 'pause':
      queue.node.setPaused(!queue.node.isPaused());
      return interaction.reply({
        content: queue.node.isPaused() ? '⏸️ Paused' : '▶️ Resumed',
        flags: 64
      });
    case 'skip':
      queue.node.skip();
      return interaction.reply({
        content: '⏭️ Skipped',
        flags: 64
      });
    case 'stop':
      queue.delete();
      return interaction.reply({
        content: '🛑 Stopped',
        flags: 64
      });
    case 'volup':
      queue.node.setVolume(Math.min(queue.node.volume + 10, 100));
      return interaction.reply({
        content: `🔊 Volume: ${queue.node.volume}%`,
        flags: 64
      });
    case 'voldown':
      queue.node.setVolume(Math.max(queue.node.volume - 10, 0));
      return interaction.reply({
        content: `🔉 Volume: ${queue.node.volume}%`,
        flags: 64
      });
    case 'loop':
      queue.setRepeatMode(queue.repeatMode === 0 ? 1 : 0);
      return interaction.reply({
        content: queue.repeatMode === 1 ? '🔁 Looping current track' : 'Loop disabled',
        flags: 64
      });
    case 'autoplay':
      queue.node.setAutoplay(!queue.node.isAutoplay);
      return interaction.reply({
        content: queue.node.isAutoplay ? '▶️ Autoplay Enabled' : 'Autoplay Disabled',
        flags: 64
      });
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
      return interaction.reply({
        content: text,
        flags: 64
      });
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
