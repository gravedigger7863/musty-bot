require('dotenv').config();

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');
const POTokenProvider = require('./modules/po-token-provider');
const PlayifyFeatures = require('./modules/playify-features');
const LavaPlayerFeatures = require('./modules/lavaplayer-features');
const DopamineFeatures = require('./modules/dopamine-features');
const fs = require('fs');
const path = require('path');
const express = require('express');

// Environment validation
const requiredEnvVars = ['DISCORD_TOKEN', 'CLIENT_ID'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please check your .env file and ensure all required variables are set.');
  process.exit(1);
}

console.log('✅ Environment variables validated successfully');

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

// Initialize PO Token Provider
const poTokenProvider = new POTokenProvider();

// Initialize Playify Features
const playify = new PlayifyFeatures();

// Initialize LavaPlayer Features
const lavaPlayer = new LavaPlayerFeatures();

// Initialize Dopamine Features
const dopamine = new DopamineFeatures();

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
    },
    // Add extractor args to bypass bot detection
    extractorArgs: {
      youtube: {
        player_client: 'android_music',
        player_skip: ['webpage']
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

// Load extractors with better configuration
console.log('🔍 Loading extractors...');

// Load default extractors first
client.player.extractors.loadMulti(DefaultExtractors).then(async () => {
  console.log('✅ Default extractors loaded');
  
  // Initialize PO Token Provider
  await poTokenProvider.initialize();

  // Manually add YouTube extractor using discord-player-ytdlp with PO Token support
  try {
    console.log('🔍 Loading YouTube extractor with PO Token support...');
    const { YtDlpExtractor } = require('discord-player-ytdlp');
    
    // Get PO Token for YouTube
    const poToken = await poTokenProvider.getValidToken();
    
    const ytdlpOptions = [
      '--no-check-certificates',
      '--prefer-insecure',
      '--no-warnings',
      '--no-call-home',
      '--no-cache-dir',
      '--socket-timeout', '10',
      '--retries', '3',
      '--fragment-retries', '3',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '--referer', 'https://www.youtube.com/',
      '--add-header', 'Accept-Language:en-US,en;q=0.9',
      '--extractor-args', 'youtube:player-client=android_music'
    ];

    // Add PO Token if available
    if (poToken) {
      // Replace the last two elements (--extractor-args and value) with PO token version
      ytdlpOptions.splice(-2, 2, '--extractor-args', `youtube:po_token=mweb.gvs+${poToken}`);
      console.log('✅ YouTube extractor configured with PO Token');
    } else {
      console.log('⚠️ YouTube extractor configured without PO Token (using Android Music client)');
    }

    console.log('🔧 ytdlpOptions:', ytdlpOptions.join(' '));

    const extractorArgs = {
      youtube: {
        player_client: 'android_music'
      }
    };
    console.log('🔧 extractorArgs:', JSON.stringify(extractorArgs));

    await client.player.extractors.register(YtDlpExtractor, {
      ytdlpPath: '/usr/local/bin/yt-dlp',
      ytdlpOptions,
      extractorArgs
    });
    console.log('✅ YouTube extractor loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load YouTube extractor:', error.message);
  }
  
  // Verify all extractors are loaded
  const loadedExtractors = Array.from(client.player.extractors.store.keys());
  console.log('✅ All loaded extractors:', loadedExtractors);
  
  // Check specifically for YouTube extractor (ytdlp-extractor)
  const hasYouTube = loadedExtractors.some(key => 
    key.toLowerCase().includes('youtube') || 
    key.toLowerCase().includes('ytdlp')
  );
  if (hasYouTube) {
    console.log('✅ YouTube extractor confirmed loaded');
  } else {
    console.log('❌ YouTube extractor still not found - this will cause search issues');
  }
}).catch(error => {
  console.error('❌ Error loading extractors:', error);
});

// --- Event Handlers ---
client.on('ready', () => {
  console.log(`✅ ${client.user.tag} is ready with Discord Player!`);
  console.log(`🎵 Discord Player initialized successfully`);
});

client.player.events.on('playerStart', (queue, track) => {
  console.log(`🎵 Started playing: ${track.title} by ${track.author}`);
  
  // LavaPlayer-inspired features
  lavaPlayer.addToHistory(queue.guild.id, track);
  lavaPlayer.updatePerformanceMetrics(queue.guild.id, track);
  
  // Start performance monitoring if not already started
  if (!lavaPlayer.performanceMetrics.has(queue.guild.id)) {
    lavaPlayer.startPerformanceMonitoring(queue.guild.id);
  }
  
  // Dopamine-inspired library management
  dopamine.addToLibrary(queue.guild.id, track);
  
  const channel = client.channels.cache.get(queue.metadata.channel.id);
  if (channel) {
    channel.send(`🎵 Now playing: **${track.title}** by ${track.author}`);
  }
});

client.player.events.on('playerFinish', async (queue, track) => {
  console.log(`🏁 Track finished: ${track.title}`);

  // Check if track finished immediately (less than 5 seconds) - likely an issue
  const trackDuration = track.durationMS || 0;
  const isImmediateFinish = trackDuration > 0 && trackDuration < 5000;

  // Also check if it's a SoundCloud track that finished quickly (common issue)
  const isSoundCloudIssue = track.source === 'soundcloud' && (isImmediateFinish || trackDuration === 0);

  if (isImmediateFinish || isSoundCloudIssue) {
    console.log(`⚠️ Track finished very quickly (${trackDuration}ms) - attempting to find alternative`);

    // Try to find the same song on a different platform
    try {
      const searchQuery = `${track.title} ${track.author}`;
      console.log(`🔍 Searching for alternative: ${searchQuery}`);

      // Search on YouTube specifically (most reliable)
      const searchResult = await queue.player.search(searchQuery, {
        requestedBy: track.requestedBy,
        searchEngine: 'youtube'
      });

      if (searchResult.hasTracks()) {
        const alternativeTrack = searchResult.tracks[0];
        console.log(`✅ Found alternative: ${alternativeTrack.title} by ${alternativeTrack.author} (${alternativeTrack.source})`);

        // Add the alternative track to the queue
        queue.addTrack(alternativeTrack);

        // Notify the channel
        const channel = queue.metadata?.channel;
        if (channel) {
          await channel.send(`🔄 **Auto-replacement:** The previous track failed, found alternative: **${alternativeTrack.title}** by ${alternativeTrack.author}`);
        }
      } else {
        console.log(`❌ No alternative found for: ${track.title}`);
      }
    } catch (error) {
      console.error(`❌ Error searching for alternative:`, error.message);
    }
  }

  // Playify Autoplay Feature
  if (playify.isAutoplayEnabled(queue.guild.id)) {
    console.log(`🔄 Autoplay enabled - finding similar tracks for: ${track.title}`);
    
    try {
      const similarTracks = await playify.getSimilarTracks(track, client);
      
      if (similarTracks.length > 0) {
        // Add the first similar track to the queue
        const similarTrack = similarTracks[0];
        queue.addTrack(similarTrack);
        
        console.log(`✅ Added similar track: ${similarTrack.title} by ${similarTrack.author}`);
        
        // Notify the channel
        const channel = queue.metadata?.channel;
        if (channel) {
          await channel.send(`🔄 **Autoplay:** Added similar track: **${similarTrack.title}** by ${similarTrack.author}`);
        }
      } else {
        console.log(`❌ No similar tracks found for: ${track.title}`);
      }
    } catch (error) {
      console.error(`❌ Error in autoplay:`, error.message);
    }
  }
});

client.player.events.on('playerError', async (queue, error) => {
  console.error(`❌ Player error in ${queue.guild.name}:`, error.message);
  
  // Handle specific error types
  if (error.message && error.message.includes('Could not extract stream')) {
    console.error(`❌ Stream extraction failed - attempting to find alternative`);
    
    // Try to find alternative track if current one failed
    if (queue.currentTrack) {
      try {
        const searchQuery = `${queue.currentTrack.title} ${queue.currentTrack.author}`;
        console.log(`🔍 Searching for alternative due to error: ${searchQuery}`);
        
        // Search on YouTube specifically (most reliable)
        const searchResult = await queue.player.search(searchQuery, {
          requestedBy: queue.currentTrack.requestedBy,
          searchEngine: 'youtube'
        });
        
        if (searchResult.hasTracks()) {
          const alternativeTrack = searchResult.tracks[0];
          console.log(`✅ Found alternative: ${alternativeTrack.title} by ${alternativeTrack.author} (${alternativeTrack.source})`);
          
          // Skip the current track and add the alternative
          queue.node.skip();
          queue.addTrack(alternativeTrack);
          
          // Notify the channel
          const channel = queue.metadata?.channel;
          if (channel) {
            await channel.send(`🔄 **Auto-replacement:** The previous track failed, found alternative: **${alternativeTrack.title}** by ${alternativeTrack.author}`);
          }
          return; // Don't send error message since we found alternative
        }
      } catch (searchError) {
        console.error(`❌ Error searching for alternative:`, searchError.message);
      }
    }
  }
  
  if (error.message && (error.message.includes('ENOTFOUND') || error.message.includes('ECONNRESET'))) {
    console.error(`❌ Network error detected - connection issues`);
  }
  
  const channel = client.channels.cache.get(queue.metadata.channel.id);
  if (channel) {
    let errorMessage = `❌ Track playback failed. Try a different track.`;
    
    // Provide more helpful error messages
    if (error.message && error.message.includes('stream')) {
      if (queue.currentTrack && queue.currentTrack.source === 'soundcloud') {
        errorMessage = `❌ This SoundCloud track is not available for streaming (may have ads or restrictions). Try a different track.`;
      } else {
        errorMessage = `❌ This track is not available for streaming. Try a different track.`;
      }
    } else if (error.message && error.message.includes('network')) {
      errorMessage = `❌ Network error. Please try again.`;
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

// Add meaningful debug logging (only for important events)
client.player.events.on('debug', (message) => {
  // Only log important debug messages, not object spam
  if (typeof message === 'string' && (
    message.includes('error') || 
    message.includes('warning') || 
    message.includes('connection') ||
    message.includes('stream') ||
    message.includes('extractor')
  )) {
    console.log(`[Player Debug] ${message}`);
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

// --- Process Error Handling ---
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit on unhandled rejections for music bots
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  
  // Handle specific errors gracefully
  if (error.message && (
    error.message.includes('Cannot convert "undefined" to int') ||
    error.message.includes('OpusScript') ||
    error.message.includes('opusscript') ||
    error.message.includes('ENOTFOUND') ||
    error.message.includes('ECONNRESET') ||
    error.message.includes('ETIMEDOUT')
  )) {
    console.log('⚠️ Non-critical error detected, continuing...');
    return;
  }
  
  // For critical errors, exit
  console.error('💥 Critical error, shutting down...');
  process.exit(1);
});

// --- Graceful Shutdown ---
process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

// --- Login ---
client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error('❌ Failed to login:', error);
  process.exit(1);
});

// --- Uptime server ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    bot: 'Musty Bot 2025',
    version: '2.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`🌐 Uptime server running on port ${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
});

module.exports = client;
