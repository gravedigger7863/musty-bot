#!/bin/bash

# Start Lavalink on VPS
echo "🚀 Starting Lavalink on VPS..."

# Check if Lavalink service exists
if sudo systemctl list-unit-files | grep -q lavalink.service; then
    echo "📡 Starting Lavalink service..."
    sudo systemctl start lavalink
    
    echo "⏳ Waiting for Lavalink to start..."
    sleep 5
    
    echo "📊 Checking Lavalink status..."
    sudo systemctl status lavalink --no-pager
    
    echo ""
    echo "📋 Useful commands:"
    echo "- View logs: sudo journalctl -u lavalink -f"
    echo "- Stop Lavalink: sudo systemctl stop lavalink"
    echo "- Restart Lavalink: sudo systemctl restart lavalink"
    echo "- Check status: sudo systemctl status lavalink"
    
else
    echo "❌ Lavalink service not found. Please run install-lavalink-vps.sh first"
    exit 1
fi
