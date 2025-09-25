# Musty Bot 2025

A simple, reliable Discord music bot that actually works.

## Features

- 🎵 **Music Playback**: YouTube, SoundCloud, Spotify support
- 🎛️ **Basic Controls**: Play, pause, skip, stop, queue
- ⚡ **Simple & Reliable**: No complex features that break
- 🔧 **Easy Deployment**: One-click deployment to VPS

## Quick Start

1. **Clone and setup**
   ```bash
   git clone https://github.com/yourusername/musty-bot.git
   cd musty-bot
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your bot token
   ```

3. **Deploy commands**
   ```bash
   npm run deploy
   ```

4. **Start the bot**
   ```bash
   npm start
   ```

## Environment Variables

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
PORT=3000
```

## Commands

- `/play <song>` - Play a song
- `/pause` - Pause current track
- `/resume` - Resume paused track
- `/skip` - Skip to next track
- `/stop` - Stop and clear queue
- `/queue` - Show current queue
- `/nowplaying` - Show current track
- `/volume <level>` - Set volume (0-100)

## VPS Deployment

1. **Commit and push your changes**
   ```bash
   git add .
   git commit -m "Update bot"
   git push origin main
   ```

2. **SSH into your VPS**
   ```bash
   ssh user@94.130.97.149
   ```

3. **Deploy**
   ```bash
   cd /path/to/musty-bot
   ./deploy-simple.sh
   ```

## What's Fixed

- ✅ Removed complex, buggy modules
- ✅ Simplified Discord Player configuration
- ✅ Fixed playback errors
- ✅ Clean, working codebase
- ✅ Reliable music streaming

## Troubleshooting

**Bot not playing music?**
- Check bot permissions in Discord
- Ensure bot has "Connect" and "Speak" permissions
- Try a different song

**Deployment issues?**
- Make sure PM2 is installed: `npm install -g pm2`
- Check logs: `pm2 logs musty-bot`

---

**Musty Bot 2025** - Simple music that works! 🎵