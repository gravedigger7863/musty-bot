// Simple script to check what code is actually running
const fs = require('fs');
const path = require('path');

console.log('🔍 Checking deployment status...');

// Check if the play.js file exists and read line 74
const playFile = path.join(__dirname, 'commands', 'music', 'play.js');

if (fs.existsSync(playFile)) {
  const content = fs.readFileSync(playFile, 'utf8');
  const lines = content.split('\n');
  
  console.log(`📄 Play command file exists`);
  console.log(`📏 Total lines: ${lines.length}`);
  
  if (lines[73]) { // Line 74 (0-indexed)
    console.log(`📝 Line 74: ${lines[73].trim()}`);
    
    if (lines[73].includes('isConnected')) {
      console.log('❌ OLD CODE: Still using deprecated isConnected() method');
    } else if (lines[73].includes('queue.node.connection')) {
      console.log('✅ NEW CODE: Using correct v7.1 API');
    } else {
      console.log('❓ UNKNOWN: Line 74 content is unclear');
    }
  } else {
    console.log('❌ Line 74 does not exist');
  }
} else {
  console.log('❌ Play command file not found');
}

// Check git status
const { exec } = require('child_process');
exec('git log --oneline -1', (error, stdout, stderr) => {
  if (error) {
    console.log('❌ Git error:', error.message);
    return;
  }
  console.log(`📋 Latest commit: ${stdout.trim()}`);
});

console.log('🎯 Run this script on your VPS to check deployment status');
