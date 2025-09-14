@echo off
REM Live Log Streamer for Musty Bot
REM Streams PM2 logs from VPS to local PC with timestamps

set VPS_IP=94.130.97.149
set VPS_USER=root
set BOT_NAME=musty-bot
set LOG_FILE=bot-logs.txt

echo [%date% %time%] 🚀 Starting live log stream from VPS...
echo [%date% %time%] 📡 Connecting to %VPS_USER%@%VPS_IP%
echo [%date% %time%] 📋 Streaming logs for: %BOT_NAME%
echo [%date% %time%] 📄 Logs also saved to: %CD%\%LOG_FILE%
echo.

REM Create log file if it doesn't exist
if not exist "%LOG_FILE%" (
    echo # Musty Bot Live Logs > "%LOG_FILE%"
    echo # Started: %date% %time% >> "%LOG_FILE%"
    echo. >> "%LOG_FILE%"
)

:stream
echo [%date% %time%] 🔄 Connecting to VPS...

REM SSH command to stream PM2 logs with timestamps
ssh %VPS_USER%@%VPS_IP% "cd /root/musty-bot && pm2 logs %BOT_NAME% --timestamp --lines 0" 2>&1 | (
    :log_loop
    set /p line=
    if errorlevel 1 goto reconnect
    echo %line%
    echo [%date% %time%] %line% >> "%LOG_FILE%"
    goto log_loop
)

:reconnect
echo [%date% %time%] ❌ Connection lost
echo [%date% %time%] 🔄 Attempting to reconnect in 5 seconds...
timeout /t 5 /nobreak >nul
goto stream
