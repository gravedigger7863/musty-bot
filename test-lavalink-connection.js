// Test script to verify Lavalink connection
const axios = require('axios');

async function testLavalinkConnection() {
  const lavalinkHost = process.env.LAVALINK_HOST || '94.130.97.149';
  const lavalinkPort = process.env.LAVALINK_PORT || 2333;
  
  console.log(`🔍 Testing Lavalink connection to ${lavalinkHost}:${lavalinkPort}...`);
  
  try {
    // Test basic connectivity
    const response = await axios.get(`http://${lavalinkHost}:${lavalinkPort}/version`, {
      timeout: 5000,
      headers: {
        'Authorization': process.env.LAVALINK_PASSWORD || 'youshallnotpass'
      }
    });
    
    console.log('✅ Lavalink is running!');
    console.log(`📊 Version: ${response.data}`);
    
    // Test stats endpoint
    try {
      const statsResponse = await axios.get(`http://${lavalinkHost}:${lavalinkPort}/stats`, {
        timeout: 5000,
        headers: {
          'Authorization': process.env.LAVALINK_PASSWORD || 'youshallnotpass'
        }
      });
      
      console.log('📈 Lavalink Stats:');
      console.log(`  - Players: ${statsResponse.data.players}`);
      console.log(`  - Playing Players: ${statsResponse.data.playingPlayers}`);
      console.log(`  - Uptime: ${Math.floor(statsResponse.data.uptime / 1000)}s`);
      console.log(`  - Memory: ${Math.round(statsResponse.data.memory.used / 1024 / 1024)}MB used`);
      
    } catch (statsError) {
      console.log('⚠️ Could not fetch stats (this is normal for some versions)');
    }
    
  } catch (error) {
    console.error('❌ Failed to connect to Lavalink:');
    
    if (error.code === 'ECONNREFUSED') {
      console.error('   - Connection refused. Is Lavalink running?');
      console.error('   - Check if port 2333 is open');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('   - Connection timed out');
      console.error('   - Check firewall settings');
    } else if (error.response) {
      console.error(`   - HTTP ${error.response.status}: ${error.response.statusText}`);
      if (error.response.status === 401) {
        console.error('   - Authentication failed. Check password.');
      }
    } else {
      console.error(`   - ${error.message}`);
    }
    
    console.log('');
    console.log('🔧 Troubleshooting steps:');
    console.log('1. Make sure Lavalink is running on your VPS');
    console.log('2. Check firewall settings: sudo ufw allow 2333');
    console.log('3. Verify Lavalink is listening on 0.0.0.0:2333');
    console.log('4. Check Lavalink logs: sudo journalctl -u lavalink -f');
    
    process.exit(1);
  }
}

// Run the test
testLavalinkConnection();
