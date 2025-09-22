@echo off
echo 🔍 Starting live log viewer...
echo 📡 Connecting to VPS: 94.130.97.149
echo 📋 Streaming musty-bot logs...
echo Press Ctrl+C to stop
echo.

ssh root@94.130.97.149 "tail -f /root/.pm2/logs/musty-bot-out.log | while read line; do echo \"[$(date '+%%Y-%%m-%%d %%H:%%M:%%S')] $line\"; done"
