#!/bin/bash
echo "🔧 Quick fix for VPS deployment issue..."
cd /root/musty-bot
git pull origin main
pm2 restart musty-bot
echo "✅ Done! Bot should now use the correct v7.1 API"
