require('dotenv').config();
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');

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
client.player = new Player(client, {
  ytdlOptions: { 
    quality: 'highestaudio', 
    filter: 'audioonly' 
  },
  // Ensure bot doesn't get deafened
  selfDeaf: false,
  selfMute: false
});

// Load default extractors (YouTube, SoundCloud, Spotify, etc.)
client.player.extractors.loadMulti(DefaultExtractors);

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
  console.log(`[Player] Started playing: ${track.title} in ${queue.guild.name}`);
});

client.player.events.on('trackEnd', (queue, track) => {
  console.log(`[Player] Finished playing: ${track.title} in ${queue.guild.name}`);
});

// Add error handling for track errors
client.player.events.on('trackError', (queue, error) => {
  console.error(`[Track Error] ${queue.guild.name}:`, error);
  // Try to notify the channel about the error
  if (queue.metadata?.channel) {
    queue.metadata.channel.send(`❌ Track error: ${error.message || 'Unknown error'}`).catch(console.error);
  }
});

// Add additional player events for better monitoring (reduced logging)
client.player.events.on('debug', (queue, message) => {
  // Only log important debug messages
  if (message.includes('error') || message.includes('failed') || message.includes('Error')) {
    console.log(`[Player Debug] ${queue.guild.name}: ${message}`);
  }
});

client.player.events.on('emptyQueue', (queue) => {
  console.log(`[Player] Queue empty in ${queue.guild.name}`);
});

client.player.events.on('emptyChannel', (queue) => {
  console.log(`[Player] Channel empty in ${queue.guild.name}`);
});

// Ensure bot stays unmuted and undeafened when connecting to voice
client.player.events.on('connection', (queue) => {
  console.log(`[Player] Connected to voice channel in ${queue.guild.name}`);
  
  // Try multiple approaches to fix voice state
  const fixVoiceState = async () => {
    const me = queue.guild.members.me;
    if (me?.voice) {
      console.log('Bot voice state on connection:', {
        mute: me.voice.mute,
        deaf: me.voice.deaf,
        selfMute: me.voice.selfMute,
        selfDeaf: me.voice.selfDeaf
      });
      
      // Try different approaches
      try {
        // Approach 1: Direct fix
        await me.voice.setMute(false);
        await me.voice.setDeaf(false);
        console.log('Voice state fix attempt 1 completed');
        
        // Wait and try again
        await new Promise(resolve => setTimeout(resolve, 500));
        await me.voice.setMute(false);
        await me.voice.setDeaf(false);
        console.log('Voice state fix attempt 2 completed');
        
        // Wait and try one more time
        await new Promise(resolve => setTimeout(resolve, 500));
        await me.voice.setMute(false);
        await me.voice.setDeaf(false);
        console.log('Voice state fix attempt 3 completed');
        
      } catch (err) {
        console.log('Voice state fix failed:', err.message);
      }
    }
  };
  
  // Try immediately
  fixVoiceState();
  
  // Try again after 2 seconds
  setTimeout(fixVoiceState, 2000);
  
  // Try one more time after 5 seconds
  setTimeout(fixVoiceState, 5000);
});

// Extractors are now properly loaded with loadDefault()
console.log('✅ Discord Player extractors loaded successfully');

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
let voiceStateFixAttempts = new Map(); // Track fix attempts per guild

// Disabled voice state monitoring - let Discord handle it naturally
// client.on('voiceStateUpdate', (oldState, newState) => {
//   // Voice state monitoring disabled to prevent infinite loops
// });

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
