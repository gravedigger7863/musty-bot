require('dotenv').config();

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');
const POTokenProvider = require('./modules/po-token-provider');
const PlayifyFeatures = require('./modules/playify-features');
const LavaPlayerFeatures = require('./modules/lavaplayer-features');
const DopamineFeatures = require('./modules/dopamine-features');
const CacheManager = require('./modules/cache-manager');
const PerformanceMonitor = require('./modules/performance-monitor');
const YtdlpIntegration = require('./modules/ytdlp-integration');
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

// Initialize yt-dlp Integration
const ytdlp = new YtdlpIntegration();

// Initialize Cache Manager
const cacheManager = new CacheManager({
  maxSize: 100, // Reduced from 500 to save memory
  defaultTTL: 180000, // 3 minutes (reduced from 5 minutes)
  cleanupInterval: 30000 // 30 seconds (reduced from 1 minute)
});

// Initialize Performance Monitor
const performanceMonitor = new PerformanceMonitor();

// Store in client for global access
client.cache = cacheManager;
client.performance = performanceMonitor;
client.ytdlp = ytdlp;

// --- Discord Player Setup (Optimized) ---
client.player = new Player(client, {
  ytdlOptions: {
    quality: 'highestaudio',
    highWaterMark: 1 << 20, // Reduced from 1 << 25 (32MB to 1MB) for better memory usage
    filter: 'audioonly',
    format: 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio',
    timeout: 30000, // Reduced from 60000 for faster timeouts
    requestOptions: {
      timeout: 30000, // Reduced from 60000
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
  bufferingTimeout: 15000, // Reduced from 30000 for faster buffering
  connectionTimeout: 15000, // Reduced from 30000 for faster connections
  volume: 50,
  // Performance optimizations
  maxHistorySize: 50, // Limit history size to prevent memory leaks
  maxCacheSize: 100, // Limit cache size
  enableLive: false, // Disable live streaming for better performance
  enableEqualizer: false, // Disable equalizer by default (can be enabled per guild)
  enableVolumeBooster: false, // Disable volume booster by default
  // Memory management
  leaveOnEmptyCooldown: 30000, // 30 seconds cooldown before leaving empty channels
  leaveOnEndCooldown: 30000, // 30 seconds cooldown before leaving after track ends
  // Connection optimizations
  connectionTimeout: 10000, // Faster connection timeout
  bufferingTimeout: 10000, // Faster buffering timeout
  // Resource management
  maxMemoryUsage: 50 * 1024 * 1024, // 50MB max memory usage per player (reduced from 100MB)
  maxQueueSize: 50, // Limit queue size to prevent memory issues (reduced from 100)
  // Performance monitoring
  enableMetrics: true, // Enable performance metrics
  metricsInterval: 30000 // Collect metrics every 30 seconds
});

// Load extractors with better configuration
console.log('🔍 Loading extractors...');

// Load default extractors first
client.player.extractors.loadMulti(DefaultExtractors).then(async () => {
  console.log('✅ Default extractors loaded');
  
  // Initialize PO Token Provider
  await poTokenProvider.initialize();

  // Skip YouTube extractor due to bot detection issues
  console.log('⚠️ Skipping YouTube extractor due to bot detection issues');
  console.log('✅ Bot will use Spotify and SoundCloud for reliable music playback');
  
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

      // Search on Spotify first (most reliable)
      const searchResult = await queue.player.search(searchQuery, {
        requestedBy: track.requestedBy,
        searchEngine: 'spotify'
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

  // Memory cleanup
  if (global.gc && Math.random() < 0.3) { // 30% chance to run GC
    global.gc();
  }
  
  // Track memory usage
  performanceMonitor.trackMemory();
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

// --- Optimized Command Loader ---
const commandsPath = path.join(__dirname, 'commands');
const commandLoadStart = Date.now();

try {
  const folders = fs.readdirSync(commandsPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const folder of folders) {
  const folderPath = path.join(commandsPath, folder);
    const commandFiles = fs.readdirSync(folderPath)
      .filter(f => f.endsWith('.js'))
      .sort(); // Sort for consistent loading order

  for (const file of commandFiles) {
      try {
        const commandPath = path.join(folderPath, file);
        // Clear require cache to ensure fresh loading
        delete require.cache[require.resolve(commandPath)];
        
        const command = require(commandPath);
        
    if (!command.data || !command.execute) {
      console.warn(`⚠️ Skipped invalid command file: ${file}`);
      continue;
    }
        
        // Validate command structure
        if (typeof command.execute !== 'function') {
          console.warn(`⚠️ Command ${command.data.name} has invalid execute function`);
          continue;
        }
        
    client.commands.set(command.data.name, command);
    console.log(`✅ Loaded command: ${command.data.name}`);
      } catch (error) {
        console.error(`❌ Error loading command ${file}:`, error.message);
      }
    }
  }
  
  const commandLoadTime = Date.now() - commandLoadStart;
  console.log(`⚡ Commands loaded in ${commandLoadTime}ms`);
} catch (error) {
  console.error('❌ Error loading commands:', error.message);
}

// --- Optimized Event Loader ---
const eventsPath = path.join(__dirname, 'events');
const eventLoadStart = Date.now();

try {
  const eventFiles = fs.readdirSync(eventsPath)
    .filter(f => f.endsWith('.js'))
    .sort(); // Sort for consistent loading order

  for (const file of eventFiles) {
    try {
      const eventPath = path.join(eventsPath, file);
      // Clear require cache to ensure fresh loading
      delete require.cache[require.resolve(eventPath)];
      
      const event = require(eventPath);
      
      if (!event.name || !event.execute) {
        console.warn(`⚠️ Skipped invalid event file: ${file}`);
        continue;
      }
      
      // Validate event structure
      if (typeof event.execute !== 'function') {
        console.warn(`⚠️ Event ${event.name} has invalid execute function`);
        continue;
      }
  
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
    console.log(`✅ Event loaded (once): ${event.name}`);
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
    console.log(`✅ Event loaded: ${event.name}`);
      }
    } catch (error) {
      console.error(`❌ Error loading event ${file}:`, error.message);
    }
  }
  
  const eventLoadTime = Date.now() - eventLoadStart;
  console.log(`⚡ Events loaded in ${eventLoadTime}ms`);
} catch (error) {
  console.error('❌ Error loading events:', error.message);
}

// --- Enhanced Performance Monitoring ---
// Track command execution for performance monitoring
client.on('interactionCreate', async (interaction) => {
  if (interaction.isCommand()) {
    const startTime = Date.now();
    
    try {
      // Track activity
      performanceMonitor.trackActivity({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id
      });
      
      // Execute command
      const command = client.commands.get(interaction.commandName);
      if (command) {
        await command.execute(interaction, client);
      }
      
      // Track successful command execution
      const executionTime = Date.now() - startTime;
      performanceMonitor.trackCommand(interaction.commandName, executionTime, true);
      
    } catch (error) {
      // Track failed command execution
      const executionTime = Date.now() - startTime;
      performanceMonitor.trackCommand(interaction.commandName, executionTime, false);
      console.error(`❌ Command execution error:`, error);
    }
  }
});


// More aggressive memory cleanup
setInterval(() => {
  const memUsage = process.memoryUsage();
  if (memUsage.heapUsed > 100 * 1024 * 1024) { // 100MB threshold
    if (global.gc) {
      global.gc();
    }
  }
}, 15000); // Every 15 seconds

// --- Process Error Handling ---
process.on('unhandledRejection', (reason, promise) => {
  performanceMonitor.trackCommand('unhandledRejection', 0, false);
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit on unhandled rejections for music bots
});

process.on('uncaughtException', (error) => {
  performanceMonitor.trackCommand('uncaughtException', 0, false);
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

// Graceful shutdown with cleanup
process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  
  // Clean up player resources
  if (client.player) {
    client.player.destroy();
  }
  
  // Clean up cache and performance monitor
  if (cacheManager) {
    cacheManager.destroy();
  }
  if (performanceMonitor) {
    performanceMonitor.stopMonitoring();
  }
  if (ytdlp) {
    ytdlp.cleanupOldDownloads(0); // Clean all downloads
  }
  
  // Log final performance report
  const finalReport = performanceMonitor.getReport();
  console.log('📊 Final Performance Report:', finalReport);
  
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  
  // Clean up player resources
  if (client.player) {
    client.player.destroy();
  }
  
  // Clean up cache and performance monitor
  if (cacheManager) {
    cacheManager.destroy();
  }
  if (performanceMonitor) {
    performanceMonitor.stopMonitoring();
  }
  if (ytdlp) {
    ytdlp.cleanupOldDownloads(0); // Clean all downloads
  }
  
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
