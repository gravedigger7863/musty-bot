require('dotenv').config();
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { Player } = require('discord-player');
// Removed problematic YouTube extractors - using fallback system instead
// const { YoutubeiExtractor } = require('discord-player-youtubei');
// const { YouTubeExtractor } = require('@discord-player/extractor');

// Additional fallback libraries
const play = require('play-dl');
const ytSearch = require('yt-search');
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
    highWaterMark: 1 << 25,
    // Add more robust options
    requestOptions: {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    },
    // Add additional options for better compatibility
    filter: 'audioonly',
    format: 'mp4',
    liveBuffer: 20000,
    highWaterMark: 1 << 25,
    dlChunkSize: 0,
    bitrate: 128
  },
  // Add better error handling
  connectionTimeout: 30000,
  lagMonitor: 30000,
  // Disable problematic features that might cause stream extraction issues
  disableEqualizer: true,
  disableBiquad: true,
  disableFilterer: true,
  // Add retry configuration
  retry: 3,
  // Enable fallback streaming
  enableStreamInterceptor: true,
  // Add better stream handling
  bufferingTimeout: 3000,
  leaveOnEnd: false,
  leaveOnEmpty: false,
  leaveOnEmptyCooldown: 300000,
  // Add better extractor configuration
  useLegacyFFmpeg: false,
  // Add better error recovery
  selfDeaf: false,
  selfMute: false,
  // Add better stream handling
  useLegacySearch: false,
  // Add better error handling
  onError: (error) => {
    console.error('[Player] Global error:', error);
  }
});

// Add comprehensive error event handlers
client.player.events.on('error', (queue, error) => {
  console.error(`[Player Error] ${queue.guild.name}:`, error);
  // Try to notify the channel about the error
  if (queue.metadata?.channel) {
    queue.metadata.channel.send(`❌ Music player error: ${error.message || 'Unknown error'}`).catch(console.error);
  }
});

client.player.events.on('playerError', (queue, error) => {
  console.error(`[Player Error] ${queue.guild.name}:`, error);
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
  
  // Ensure bot is not muted or deafened when connecting
  const me = queue.guild.members.me;
  if (me?.voice) {
    // Use a more robust approach to fix voice state
    const fixVoiceState = async () => {
      try {
        // First, try to set both mute and deaf to false
        await Promise.all([
          me.voice.setMute(false),
          me.voice.setDeaf(false)
        ]);
        console.log('Successfully fixed bot voice state');
      } catch (err) {
        console.error('Failed to fix bot voice state:', err);
        
        // If that fails, try a more aggressive approach
        try {
          // Disconnect and reconnect to reset voice state
          await me.voice.disconnect();
          await new Promise(resolve => setTimeout(resolve, 1000));
          await queue.connect(queue.connection.channel);
        } catch (reconnectErr) {
          console.error('Failed to reconnect bot:', reconnectErr);
        }
      }
    };
    
    if (me.voice.mute || me.voice.deaf) {
      console.log('Bot has voice issues on connection, attempting to fix...');
      fixVoiceState();
    }
  }
});

// Register working extractors - we need at least one for discord-player to work
try {
  // Try to register the basic YouTube extractor from @discord-player/extractor
  const { YouTubeExtractor } = require('@discord-player/extractor');
  client.player.extractors.register(YouTubeExtractor);
  console.log('✅ Registered basic YouTubeExtractor');
} catch (error) {
  console.error('❌ Failed to register basic YouTubeExtractor:', error);
  
  // If that fails, try to register a minimal extractor
  try {
    const { YoutubeiExtractor } = require('discord-player-youtubei');
    client.player.extractors.register(YoutubeiExtractor);
    console.log('✅ Registered YoutubeiExtractor as fallback');
  } catch (fallbackError) {
    console.error('❌ Failed to register any extractors:', fallbackError);
    console.log('⚠️ Bot may not be able to play music without extractors');
  }
}

// Add custom stream interceptor for better YouTube handling
client.player.events.on('beforeCreateStream', async (track, source, _queue) => {
  // Handle all YouTube tracks with multiple fallback methods
  if (source === 'youtube' || track.url.includes('youtube.com') || track.url.includes('youtu.be')) {
    console.log(`[Stream Interceptor] Processing track: ${track.title}`);
    
    try {
      // Try play-dl first (more reliable)
      if (await play.yt_validate(track.url)) {
        console.log(`[Stream Interceptor] Using play-dl for: ${track.title}`);
        
        const stream = await play.stream(track.url, {
          quality: 'highestaudio',
          type: 'audio'
        });
        
        return stream.stream;
      }
      
      // Fallback to ytdl-core
      const ytdl = require('ytdl-core');
      if (ytdl.validateURL(track.url)) {
        console.log(`[Stream Interceptor] Using ytdl-core fallback for: ${track.title}`);
        
        const stream = ytdl(track.url, {
          quality: 'highestaudio',
          filter: 'audioonly',
          highWaterMark: 1 << 25,
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          }
        });
        
        // Add error handling for the stream
        stream.on('error', (error) => {
          console.error('[Stream Interceptor] ytdl-core stream error:', error);
        });
        
        return stream;
      } else {
        console.log(`[Stream Interceptor] Invalid YouTube URL: ${track.url}`);
        return undefined;
      }
    } catch (error) {
      console.error('[Stream Interceptor Error]:', error);
      return undefined;
    }
  }
  
  return undefined;
});

// Add a fallback for when extractors fail
client.player.events.on('error', (queue, error) => {
  if (error.message && error.message.includes('Could not extract stream')) {
    console.log('[Player] Stream extraction failed, trying ytdl-core fallback...');
    
    // Try to use ytdl-core directly
    try {
      const ytdl = require('ytdl-core');
      const currentTrack = queue.currentTrack;
      
      if (currentTrack && ytdl.validateURL(currentTrack.url)) {
        console.log('[Player] Using ytdl-core fallback for current track');
        
        const stream = ytdl(currentTrack.url, {
          quality: 'highestaudio',
          filter: 'audioonly',
          highWaterMark: 1 << 25,
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          }
        });
        
        // Replace the current track's stream
        if (queue.node && queue.node.player) {
          queue.node.player.play(stream);
        }
      }
    } catch (fallbackError) {
      console.error('[Player] ytdl-core fallback failed:', fallbackError);
    }
  }
});

// Additional extractors are available but not registered to avoid errors
// Uncomment these if you want to use them:
// const { SpotifyExtractor } = require('discord-player-spotify');
// const { SoundCloudExtractor } = require('discord-player-soundcloud');
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
    
    // Only try to fix mute/deaf if bot is in a voice channel
    if (newState.channel) {
      // Check if bot has any voice issues
      const hasVoiceIssues = newState.mute || newState.deaf || newState.selfMute || newState.selfDeaf;
      const hadVoiceIssues = oldState.mute || oldState.deaf || oldState.selfMute || oldState.selfDeaf;
      
      if (hasVoiceIssues && !hadVoiceIssues) {
        console.log('Bot has voice issues! Attempting to fix...');
        
        // Use a more robust approach to fix voice state
        const fixVoiceState = async () => {
          try {
            // Try to fix all voice state issues at once
            await Promise.all([
              newState.setMute(false),
              newState.setDeaf(false)
            ]);
            console.log('Successfully fixed bot voice state');
          } catch (err) {
            console.error('Failed to fix bot voice state:', err);
          }
        };
        
        // Fix voice state with a single attempt
        fixVoiceState();
      }
    } else {
      // Bot is not in a voice channel, but if it was deafened, try to fix it
      if (newState.deaf && !oldState.deaf) {
        console.log('Bot was deafened outside voice channel! Attempting to undeafen...');
        newState.setDeaf(false).catch(err => {
          console.error('Failed to undeafen bot:', err);
        });
      }
      
      if (newState.selfDeaf && !oldState.selfDeaf) {
        console.log('Bot was self-deafened outside voice channel! Attempting to undeafen...');
        newState.setDeaf(false).catch(err => {
          console.error('Failed to undeafen bot:', err);
        });
      }
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

// --- Periodic Voice State Check (Reduced frequency since bot is working) ---
setInterval(() => {
  client.guilds.cache.forEach(guild => {
    const me = guild.members.me;
    if (me?.voice?.channel && (me.voice.deaf || me.voice.mute || me.voice.selfDeaf || me.voice.selfMute)) {
      console.log(`[Periodic Check] Bot has voice issues in ${guild.name}, attempting to fix...`);
      
      // Use a more robust approach to fix voice state
      const fixVoiceState = async () => {
        try {
          // Try to fix all voice state issues at once
          await Promise.all([
            me.voice.setMute(false),
            me.voice.setDeaf(false)
          ]);
          console.log(`[Periodic Check] Successfully fixed bot voice state in ${guild.name}`);
        } catch (err) {
          console.error(`[Periodic Check] Failed to fix bot voice state in ${guild.name}:`, err);
        }
      };
      
      fixVoiceState();
    }
  });
}, 60000); // Check every 60 seconds (reduced from 15 seconds)

// --- Login ---
client.login(process.env.DISCORD_TOKEN);

// --- Uptime server ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`Uptime server running on port ${PORT}`));

module.exports = client;
