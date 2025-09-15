#!/bin/bash

# Script to start Lavalink on VPS remotely
VPS_IP="94.130.97.149"
VPS_USER="root"

echo "🚀 Starting Lavalink on VPS remotely..."

# Try to start Lavalink (this will prompt for password)
echo "📡 Connecting to $VPS_USER@$VPS_IP to start Lavalink..."
ssh $VPS_USER@$VPS_IP << 'EOF'
  echo "🔧 Starting Lavalink service..."
  sudo systemctl start lavalink
  
  echo "📊 Checking Lavalink status..."
  sudo systemctl status lavalink --no-pager
  
  echo "🔍 Checking if Lavalink is listening on port 2333..."
  sudo netstat -tlnp | grep 2333 || echo "⚠️ Port 2333 not found in netstat"
  
  echo "📋 Lavalink process check..."
  ps aux | grep -i lavalink | grep -v grep || echo "⚠️ No Lavalink process found"
  
  echo "✅ Commands completed on VPS"
EOF

echo "🌐 Testing connection from local machine..."
node test-lavalink-connection.js
