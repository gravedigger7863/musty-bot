#!/bin/bash

# Simple deployment script for Musty Bot
echo "🚀 Deploying Musty Bot to VPS..."

# Check if we're on the VPS
if [ "$(hostname)" = "vps" ] || [ "$(hostname)" = "musty-bot" ]; then
    echo "✅ Running on VPS"
    
    # Stop the bot if running
    echo "🛑 Stopping existing bot..."
    pm2 stop musty-bot 2>/dev/null || echo "Bot not running"
    
    # Pull latest changes
    echo "📥 Pulling latest changes..."
    git pull origin main
    
    # Install dependencies
    echo "📦 Installing dependencies..."
    npm install --production
    
    # Start the bot
    echo "▶️ Starting bot..."
    pm2 start index.js --name musty-bot --max-memory-restart 512M
    
    # Show status
    echo "📊 Bot status:"
    pm2 status musty-bot
    
    echo "✅ Deployment complete!"
else
    echo "❌ This script should be run on the VPS"
    echo "💡 To deploy:"
    echo "   1. Commit and push your changes"
    echo "   2. SSH into your VPS"
    echo "   3. Run: ./deploy-simple.sh"
fi
