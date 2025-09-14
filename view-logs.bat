@echo off
REM Clickable script to connect to VPS and view live logs with timestamps

echo 🚀 Connecting to VPS and viewing live logs...
echo 📡 Connecting to root@94.130.97.149
echo 📋 Viewing logs for: musty-bot
echo.

REM Connect to VPS and run the log command
echo Testing SSH connection first...
ssh -o ConnectTimeout=10 root@94.130.97.149 "echo 'SSH connection successful'"

if %errorlevel% neq 0 (
    echo ❌ SSH connection failed!
    echo Please check your SSH key setup or try connecting manually first
    echo.
    echo Manual commands:
    echo   ssh root@94.130.97.149
    echo   cd /root/musty-bot
    echo   pm2 logs musty-bot --timestamp
    echo.
    pause
    exit /b 1
)

echo ✅ SSH connection successful, now viewing logs...
echo.
ssh root@94.130.97.149 "cd /root/musty-bot && pm2 logs musty-bot --timestamp"

echo.
echo Press any key to exit...
pause >nul
