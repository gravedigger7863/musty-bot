#!/usr/bin/env node

/**
 * Live Log Streamer for Musty Bot
 * Streams PM2 logs from VPS to local PC with timestamps
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const VPS_IP = '94.130.97.149';
const VPS_USER = 'root';
const BOT_NAME = 'musty-bot';
const LOG_FILE = 'bot-logs.txt';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = 'white') {
  const timestamp = new Date().toISOString();
  const coloredMessage = `${colors[color]}${message}${colors.reset}`;
  console.log(`[${timestamp}] ${coloredMessage}`);
  
  // Also write to log file
  fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
}

function startLogStreaming() {
  log('🚀 Starting live log stream from VPS...', 'green');
  log(`📡 Connecting to ${VPS_USER}@${VPS_IP}`, 'cyan');
  log(`📋 Streaming logs for: ${BOT_NAME}`, 'cyan');
  log('📄 Logs also saved to: ' + path.resolve(LOG_FILE), 'cyan');
  log('─'.repeat(80), 'dim');

  // SSH command to stream PM2 logs with timestamps
  const sshCommand = `ssh ${VPS_USER}@${VPS_IP} "cd /root/musty-bot && pm2 logs ${BOT_NAME} --timestamp --lines 0"`;
  
  const child = spawn('bash', ['-c', sshCommand], {
    stdio: ['inherit', 'pipe', 'pipe']
  });

  // Handle stdout (log data)
  child.stdout.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(output);
  });

  // Handle stderr (error messages)
  child.stderr.on('data', (data) => {
    const error = data.toString();
    log(`❌ SSH Error: ${error}`, 'red');
  });

  // Handle process exit
  child.on('close', (code) => {
    if (code === 0) {
      log('✅ Log streaming ended normally', 'green');
    } else {
      log(`❌ Log streaming ended with code: ${code}`, 'red');
      log('🔄 Attempting to reconnect in 5 seconds...', 'yellow');
      setTimeout(startLogStreaming, 5000);
    }
  });

  // Handle process errors
  child.on('error', (error) => {
    log(`❌ Process error: ${error.message}`, 'red');
    log('🔄 Attempting to reconnect in 5 seconds...', 'yellow');
    setTimeout(startLogStreaming, 5000);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    log('🛑 Shutting down log streamer...', 'yellow');
    child.kill();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log('🛑 Shutting down log streamer...', 'yellow');
    child.kill();
    process.exit(0);
  });
}

// Create log file if it doesn't exist
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, `# Musty Bot Live Logs\n# Started: ${new Date().toISOString()}\n\n`);
}

// Start streaming
startLogStreaming();
