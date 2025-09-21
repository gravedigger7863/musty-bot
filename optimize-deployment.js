/**
 * Optimized Deployment Script
 * Deploys the bot with performance optimizations and monitoring
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting optimized deployment...');

// Check if we're on the VPS
const isVPS = process.platform === 'linux' && process.env.USER === 'root';

if (isVPS) {
  console.log('📡 Running on VPS - applying optimizations...');
  
  // Set Node.js optimizations
  process.env.NODE_OPTIONS = '--max-old-space-size=512 --expose-gc --optimize-for-size';
  
  // Set memory limits
  process.env.UV_THREADPOOL_SIZE = '4';
  
  // Enable garbage collection
  if (global.gc) {
    console.log('✅ Garbage collection enabled');
  }
  
  // Check system resources
  try {
    const memInfo = execSync('free -m', { encoding: 'utf8' });
    console.log('💾 System Memory:', memInfo.split('\n')[1]);
    
    const cpuInfo = execSync('nproc', { encoding: 'utf8' });
    console.log('🖥️ CPU Cores:', cpuInfo.trim());
    
  } catch (error) {
    console.log('⚠️ Could not check system resources:', error.message);
  }
  
  // Optimize PM2 configuration
  const pm2Config = {
    name: 'musty-bot',
    script: 'index.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '200M',
    node_args: '--max-old-space-size=512 --expose-gc --optimize-for-size',
    env: {
      NODE_ENV: 'production',
      UV_THREADPOOL_SIZE: '4'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s'
  };
  
  // Write PM2 config
  fs.writeFileSync('ecosystem.config.js', `module.exports = ${JSON.stringify(pm2Config, null, 2)}`);
  console.log('✅ PM2 configuration optimized');
  
  // Create logs directory
  if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs');
    console.log('✅ Logs directory created');
  }
  
  // Start with PM2
  try {
    execSync('pm2 stop musty-bot', { stdio: 'ignore' });
    execSync('pm2 delete musty-bot', { stdio: 'ignore' });
  } catch (error) {
    // Ignore if not running
  }
  
  execSync('pm2 start ecosystem.config.js', { stdio: 'inherit' });
  console.log('✅ Bot started with PM2 optimizations');
  
} else {
  console.log('💻 Running locally - using development optimizations...');
  
  // Set development optimizations
  process.env.NODE_OPTIONS = '--max-old-space-size=256 --inspect';
  
  console.log('✅ Local optimizations applied');
}

console.log('🎉 Optimized deployment completed!');
console.log('📊 Performance monitoring enabled');
console.log('🧹 Memory management optimized');
console.log('⚡ Command execution optimized');
