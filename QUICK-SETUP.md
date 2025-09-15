# Quick Lavalink Setup Guide

## 🚀 For Your VPS (94.130.97.149)

### Step 1: Connect to your VPS
```bash
ssh root@94.130.97.149
```

### Step 2: Install Lavalink
```bash
# Make scripts executable
chmod +x install-lavalink-vps.sh
chmod +x start-lavalink-vps.sh

# Install Lavalink
./install-lavalink-vps.sh
```

### Step 3: Start Lavalink
```bash
# Start the service
./start-lavalink-vps.sh

# Or manually:
sudo systemctl start lavalink
sudo systemctl status lavalink
```

### Step 4: Check if it's working
```bash
# Test connection
curl http://localhost:2333/version

# Check logs
sudo journalctl -u lavalink -f
```

## 🤖 For Your Bot

### Step 1: Update .env file
Add these lines to your `.env`:
```env
LAVALINK_HOST=94.130.97.149
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass
```

### Step 2: Switch to Lavalink version
```bash
# Backup current bot
cp index.js index-discord-player-backup.js

# Use Lavalink version
cp index-lavalink.js index.js
```

### Step 3: Test connection
```bash
node test-lavalink-connection.js
```

### Step 4: Start your bot
```bash
npm start
```

## ✅ What to Expect

### Successful Lavalink Connection:
```
🔗 Lavalink node "94.130.97.149:2333" connected
✅ musty-bot#1234 is ready with Lavalink!
🎵 Connected to 1 Lavalink node(s)
```

### Successful Test:
```
✅ Lavalink is running!
📊 Version: 4.0.0
📈 Lavalink Stats:
  - Players: 0
  - Playing Players: 0
  - Uptime: 120s
  - Memory: 256MB used
```

## 🔧 Troubleshooting

### Lavalink won't start:
```bash
# Check Java
java -version  # Should be 17+

# Check logs
sudo journalctl -u lavalink -f

# Restart
sudo systemctl restart lavalink
```

### Bot can't connect:
1. Check firewall: `sudo ufw allow 2333`
2. Test from VPS: `curl http://localhost:2333/version`
3. Test from bot: `node test-lavalink-connection.js`

### Music not playing:
1. Check bot logs for Lavalink connection
2. Verify voice channel permissions
3. Test with simple YouTube URL

## 📋 Commands to Update

You'll need to update these commands to work with Lavalink:
- `/play` → Use `play-lavalink.js` as reference
- `/queue` → Use `queue-lavalink.js` as reference
- `/skip` → Update to use `player.skip()`
- `/stop` → Update to use `player.destroy()`
- `/pause` → Update to use `player.pause()`
- `/resume` → Update to use `player.resume()`

## 🎯 Benefits

- ✅ No more extractor issues
- ✅ Better queue management
- ✅ More stable voice connections
- ✅ Lower memory usage
- ✅ Better audio quality
- ✅ Support for more sources (YouTube, SoundCloud, Spotify, etc.)

Ready to migrate? Follow the steps above! 🚀
