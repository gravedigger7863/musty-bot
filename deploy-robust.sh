#!/bin/bash

echo "🚀 Starting robust deployment..."

# Change to the bot directory
cd /root/musty-bot || {
  echo "❌ Failed to change to /root/musty-bot directory"
  exit 1
}

# Check git status
echo "📋 Checking git status..."
git status --porcelain

# Stash any local changes to avoid conflicts
echo "💾 Stashing any local changes..."
git stash push -m "Auto-stash before deployment $(date)" || {
  echo "⚠️ No changes to stash or stash failed, continuing..."
}

# Reset any uncommitted changes that might cause issues
echo "🔄 Resetting any uncommitted changes..."
git reset --hard HEAD

# Pull latest code from repository
echo "📥 Pulling latest code from repository..."
git pull origin main || {
  echo "❌ Git pull failed, trying to reset and pull again..."
  git fetch origin main
  git reset --hard origin/main
}

# Install/update dependencies
echo "📦 Installing dependencies..."
npm install || {
  echo "❌ npm install failed"
  exit 1
}

# Restart the bot process
echo "🔄 Restarting bot process..."
pm2 restart musty-bot || {
  echo "❌ PM2 restart failed"
  exit 1
}

# Check if bot is running
echo "🔍 Checking bot status..."
pm2 status musty-bot

echo "✅ Deployment complete!"
echo "🎵 Bot should now be running with the latest code!"
