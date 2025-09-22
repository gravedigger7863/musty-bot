@echo off
echo 🔍 Viewing recent bot logs with timestamps...
echo 📡 Connecting to VPS: 94.130.97.149
echo 📋 Showing last 50 log entries with timestamps...
echo.

ssh root@94.130.97.149 "tail -50 /root/.pm2/logs/musty-bot-out.log | while IFS= read -r line; do echo \"[$(date '+%%Y-%%m-%%d %%H:%%M:%%S')] $line\"; done"
