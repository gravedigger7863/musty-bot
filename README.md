# Musty Bot 2025 🎵

A modern Discord music bot built with Discord.js v14 and Discord Player v7, featuring multi-source music support and robust error handling.

## Features

- **Multi-Source Music Support**: YouTube, SoundCloud, Spotify, Deezer, and local files
- **Queue Management**: Full queue control with skip, pause, resume, and stop functionality
- **Voice Channel Integration**: Automatic voice channel management with smart leave/join
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Health Monitoring**: Built-in health check endpoints for monitoring
- **Graceful Shutdown**: Proper cleanup on bot restart/shutdown

## Commands

### Music Commands
- `/play [query]` - Play music from various sources
- `/queue` - Show the current music queue
- `/pause` - Pause/resume playback
- `/skip` - Skip the current song
- `/stop` - Stop music and clear queue
- `/nowplaying` - Show currently playing track with progress bar
- `/volume [1-100]` - Set volume level
- `/autoplay` - Toggle autoplay for related tracks

### Admin Commands
- `/purge [amount]` - Delete messages (admin only)
- `/status` - Show bot status and statistics

### Fun Commands
- `/ping` - Check bot latency
- `/wordle` - Play Wordle game

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with required variables:
   ```
   DISCORD_TOKEN=your_bot_token
   CLIENT_ID=your_application_id
   ```
4. Deploy commands: `npm run deploy`
5. Start the bot: `npm start`

## Environment Variables

- `DISCORD_TOKEN` - Your Discord bot token (required)
- `CLIENT_ID` - Your Discord application ID (required)
- `PORT` - Port for uptime server (optional, defaults to 3000)

## Health Monitoring

The bot includes health check endpoints:
- `GET /` - Bot status and statistics
- `GET /health` - Simple health check

## Deployment

The bot is configured for deployment on VPS with PM2. Use the included deployment scripts:
- `trigger-deployment.js` - Trigger deployment to VPS
- `check-deployment.js` - Check deployment status

## Version

Current version: 2.0.0

## License

ISC
