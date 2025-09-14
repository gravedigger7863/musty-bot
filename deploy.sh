#!/bin/bash

echo "🚀 Starting deployment..."

# Pull latest code from repository
echo "📥 Pulling latest code from repository..."
git pull origin main

# Install/update dependencies
echo "📦 Installing dependencies..."
npm install

# Restart the bot process
echo "🔄 Restarting bot process..."
pm2 restart musty-bot

echo "✅ Deployment complete!"
echo "🎵 Bot should now be running with the latest code!"
