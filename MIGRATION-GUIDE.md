# Migration from Discord Player to Lavalink

## Overview
This guide will help you migrate your Discord music bot from Discord Player to Lavalink for better stability and performance.

## Why Lavalink?
- ✅ More reliable queue management
- ✅ Better extractor support (YouTube, SoundCloud, Spotify)
- ✅ Lower memory usage
- ✅ Better audio quality
- ✅ More stable voice connections
- ✅ No Opus encoder issues

## Server Setup (VPS)

### 1. Connect to your VPS
```bash
ssh root@94.130.97.149
```

### 2. Install Lavalink
```bash
# Make the script executable
chmod +x install-lavalink-vps.sh

# Run the installation
./install-lavalink-vps.sh
```

### 3. Start Lavalink
```bash
# Start the service
sudo systemctl start lavalink

# Check status
sudo systemctl status lavalink

# View logs
sudo journalctl -u lavalink -f
```

### 4. Configure Firewall (if needed)
```bash
# Allow Lavalink port
sudo ufw allow 2333
```

## Bot Configuration

### 1. Environment Variables
Add to your `.env` file:
```env
LAVALINK_HOST=94.130.97.149
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass
```

### 2. Use the new index file
Replace your current `index.js` with `index-lavalink.js`:
```bash
# Backup current index.js
mv index.js index-discord-player.js

# Use Lavalink version
mv index-lavalink.js index.js
```

### 3. Update Music Commands
The music commands need to be updated to work with erela.js instead of discord-player.

## Key Differences

### Discord Player vs erela.js

| Feature | Discord Player | erela.js (Lavalink) |
|---------|----------------|-------------------|
| Queue Management | Built-in | Built-in |
| Extractors | Plugin system | Server-side |
| Voice Connection | Direct | Via Lavalink |
| Audio Quality | Variable | Consistent |
| Memory Usage | Higher | Lower |
| Stability | Issues with extractors | Very stable |

### Command Changes Needed

1. **Play Command**: Update to use `client.manager.search()` and `player.play()`
2. **Queue Command**: Use `player.queue` instead of `queue.tracks`
3. **Skip Command**: Use `player.skip()` instead of `queue.node.skip()`
4. **Stop Command**: Use `player.destroy()` instead of `queue.destroy()`

## Testing

### 1. Test Lavalink Connection
```bash
# Check if Lavalink is running
curl http://94.130.97.149:2333/version
```

### 2. Test Bot Connection
Start your bot and check logs for:
```
🔗 Lavalink node "94.130.97.149:2333" connected
```

### 3. Test Music Commands
Try playing a song to ensure everything works.

## Troubleshooting

### Lavalink Won't Start
```bash
# Check Java version
java -version

# Check logs
sudo journalctl -u lavalink -f

# Restart service
sudo systemctl restart lavalink
```

### Bot Can't Connect to Lavalink
1. Check firewall settings
2. Verify IP address in bot config
3. Check Lavalink logs for errors
4. Ensure Lavalink is running on port 2333

### Music Not Playing
1. Check voice channel permissions
2. Verify Lavalink connection
3. Check bot logs for errors
4. Test with different audio sources

## Benefits After Migration

- 🎵 More reliable music playback
- 🔄 Better queue management
- 🌐 Support for more audio sources
- 💾 Lower memory usage
- 🚀 Better performance
- 🛠️ Easier troubleshooting

## Next Steps

1. Install Lavalink on VPS
2. Update bot configuration
3. Migrate music commands
4. Test thoroughly
5. Deploy to production

Need help? Check the logs and ensure all services are running properly.
