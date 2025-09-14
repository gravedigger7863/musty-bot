#!/bin/bash

# Live Log Streamer for Musty Bot
# Streams PM2 logs from VPS to local PC with timestamps

VPS_IP="94.130.97.149"
VPS_USER="root"
BOT_NAME="musty-bot"
LOG_FILE="bot-logs.txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log() {
    local message="$1"
    local color="${2:-$NC}"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${color}[${timestamp}] ${message}${NC}"
    echo "[${timestamp}] ${message}" >> "$LOG_FILE"
}

# Create log file if it doesn't exist
if [ ! -f "$LOG_FILE" ]; then
    echo "# Musty Bot Live Logs" > "$LOG_FILE"
    echo "# Started: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
fi

log "🚀 Starting live log stream from VPS..." "$GREEN"
log "📡 Connecting to ${VPS_USER}@${VPS_IP}" "$CYAN"
log "📋 Streaming logs for: ${BOT_NAME}" "$CYAN"
log "📄 Logs also saved to: $(pwd)/${LOG_FILE}" "$CYAN"
log "────────────────────────────────────────────────────────────────────────────────" "$BLUE"

# Function to handle reconnection
stream_logs() {
    while true; do
        log "🔄 Connecting to VPS..." "$YELLOW"
        
        # SSH command to stream PM2 logs with timestamps
        ssh "${VPS_USER}@${VPS_IP}" "cd /root/musty-bot && pm2 logs ${BOT_NAME} --timestamp --lines 0" 2>&1 | while IFS= read -r line; do
            echo "$line"
            echo "$(date '+%Y-%m-%d %H:%M:%S') $line" >> "$LOG_FILE"
        done
        
        local exit_code=$?
        if [ $exit_code -eq 0 ]; then
            log "✅ Log streaming ended normally" "$GREEN"
            break
        else
            log "❌ Connection lost (exit code: $exit_code)" "$RED"
            log "🔄 Attempting to reconnect in 5 seconds..." "$YELLOW"
            sleep 5
        fi
    done
}

# Handle Ctrl+C gracefully
trap 'log "🛑 Shutting down log streamer..." "$YELLOW"; exit 0' INT TERM

# Start streaming
stream_logs
