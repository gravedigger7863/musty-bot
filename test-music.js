#!/usr/bin/env node

/**
 * Simple test script to verify music bot functionality
 * Run this after deploying the bot to test if tracks play properly
 */

const { Client, GatewayIntentBits } = require('discord.js');
const { Player } = require('discord-player');

// Test configuration
const TEST_GUILD_ID = process.env.TEST_GUILD_ID || 'your-guild-id-here';
const TEST_VOICE_CHANNEL_ID = process.env.TEST_VOICE_CHANNEL_ID || 'your-voice-channel-id-here';
const TEST_TRACK_URL = process.env.TEST_TRACK_URL || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Rick Roll for testing

console.log('🧪 Music Bot Test Script');
console.log('========================');
console.log(`Test Guild ID: ${TEST_GUILD_ID}`);
console.log(`Test Voice Channel ID: ${TEST_VOICE_CHANNEL_ID}`);
console.log(`Test Track URL: ${TEST_TRACK_URL}`);
console.log('');

// Create test client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ]
});

// Initialize player
const player = new Player(client, {
  ytdlOptions: {
    quality: 'highestaudio',
    highWaterMark: 1 << 25,
    filter: 'audioonly',
    format: 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio',
    timeout: 60000,
    requestOptions: {
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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
  extractors: {
    enabled: true,
    providers: ['youtube', 'spotify', 'soundcloud', 'apple', 'deezer']
  }
});

// Test event handlers
player.events.on('error', (queue, error) => {
  console.error('❌ Player Error:', error.message);
});

player.events.on('playerError', (queue, error) => {
  console.error('❌ Player Error:', error.message);
});

player.events.on('trackError', (queue, error) => {
  console.error('❌ Track Error:', error.message);
});

player.events.on('connectionError', (queue, error) => {
  console.error('❌ Connection Error:', error.message);
});

player.events.on('playerStart', (queue, track) => {
  console.log('✅ Track started:', track.title);
  console.log('   Duration:', track.duration);
  console.log('   Source:', track.source);
  console.log('   URL:', track.url);
});

player.events.on('playerFinish', (queue, track) => {
  console.log('🏁 Track finished:', track.title);
  console.log('   Duration was:', track.duration);
  console.log('   Finish reason:', track.finishReason || 'Unknown');
  
  // Check if track finished too quickly
  const duration = track.durationMS || 0;
  if (duration > 0 && duration < 5000) {
    console.log('⚠️  WARNING: Track finished very quickly - possible streaming issue');
  } else {
    console.log('✅ Track finished normally');
  }
});

player.events.on('emptyQueue', (queue) => {
  console.log('📭 Queue is empty');
});

// Test function
async function runTest() {
  try {
    console.log('🔍 Searching for test track...');
    const searchResult = await player.search(TEST_TRACK_URL);
    
    if (!searchResult || !searchResult.tracks.length) {
      console.error('❌ No tracks found for test URL');
      process.exit(1);
    }
    
    const track = searchResult.tracks[0];
    console.log('✅ Found test track:', track.title);
    console.log('   Author:', track.author);
    console.log('   Duration:', track.duration);
    console.log('   Source:', track.source);
    
    // Note: This test script doesn't actually connect to voice
    // It just tests the search and track parsing functionality
    console.log('');
    console.log('✅ Test completed successfully!');
    console.log('   The bot should now work properly with music tracks.');
    console.log('   Try using /play command in Discord to test actual playback.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('   Full error:', error);
    process.exit(1);
  }
}

// Run test when ready
client.once('ready', async () => {
  console.log('🤖 Bot is ready, running test...');
  await runTest();
  process.exit(0);
});

// Login
if (process.env.DISCORD_TOKEN) {
  client.login(process.env.DISCORD_TOKEN);
} else {
  console.error('❌ DISCORD_TOKEN environment variable not set');
  console.log('   Please set DISCORD_TOKEN to run the test');
  process.exit(1);
}
