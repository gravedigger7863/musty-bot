/**
 * Live Log Viewer - Stream bot logs from VPS to local PC
 * This script connects to your VPS and streams the bot logs in real-time
 */

const { spawn } = require('child_process');
const chalk = require('chalk');

console.log(chalk.blue('🔍 Starting live log viewer...'));
console.log(chalk.yellow('📡 Connecting to VPS: 94.130.97.149'));
console.log(chalk.green('📋 Streaming musty-bot logs...'));
console.log(chalk.gray('Press Ctrl+C to stop\n'));

// Create SSH connection to stream logs
const ssh = spawn('ssh', [
  'root@94.130.97.149',
  'tail -f /root/.pm2/logs/musty-bot-out.log'
], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Handle SSH output
ssh.stdout.on('data', (data) => {
  const logLine = data.toString();
  
  // Color code different types of logs
  if (logLine.includes('ERROR') || logLine.includes('error')) {
    console.log(chalk.red(logLine));
  } else if (logLine.includes('WARN') || logLine.includes('warn')) {
    console.log(chalk.yellow(logLine));
  } else if (logLine.includes('✅') || logLine.includes('SUCCESS')) {
    console.log(chalk.green(logLine));
  } else if (logLine.includes('🔍') || logLine.includes('search')) {
    console.log(chalk.blue(logLine));
  } else if (logLine.includes('🎵') || logLine.includes('music')) {
    console.log(chalk.magenta(logLine));
  } else if (logLine.includes('📊') || logLine.includes('Performance')) {
    console.log(chalk.cyan(logLine));
  } else {
    console.log(chalk.white(logLine));
  }
});

// Handle SSH errors
ssh.stderr.on('data', (data) => {
  console.error(chalk.red('SSH Error:'), data.toString());
});

// Handle SSH exit
ssh.on('close', (code) => {
  if (code !== 0) {
    console.log(chalk.red(`SSH connection closed with code ${code}`));
  } else {
    console.log(chalk.green('SSH connection closed normally'));
  }
});

// Handle process termination
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n🛑 Stopping log viewer...'));
  ssh.kill();
  process.exit(0);
});

// Handle errors
ssh.on('error', (error) => {
  console.error(chalk.red('Failed to start SSH connection:'), error.message);
  console.log(chalk.yellow('Make sure you have SSH access to the VPS and the bot is running.'));
  process.exit(1);
});
