@echo off
echo 🔍 Starting live log viewer...
echo 📡 Connecting to VPS: 94.130.97.149
echo 📋 Streaming musty-bot logs...
echo Press Ctrl+C to stop
echo.

ssh root@94.130.97.149 "pm2 logs musty-bot --raw --timestamp"
