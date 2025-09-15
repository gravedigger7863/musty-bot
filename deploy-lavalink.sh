#!/bin/bash

# Deployment script for Lavalink setup on VPS
echo "🚀 Deploying Lavalink setup to VPS..."

# VPS connection details
VPS_IP="94.130.97.149"
VPS_USER="root"  # Change this to your VPS username if different

echo "📡 Connecting to VPS: $VPS_USER@$VPS_IP"

# Copy installation script to VPS
echo "📤 Copying installation script to VPS..."
scp install-lavalink-vps.sh $VPS_USER@$VPS_IP:~/

# Copy startup script to VPS
echo "📤 Copying startup script to VPS..."
scp start-lavalink-vps.sh $VPS_USER@$VPS_IP:~/

# Connect to VPS and run installation
echo "🔧 Running Lavalink installation on VPS..."
ssh $VPS_USER@$VPS_IP << 'EOF'
  chmod +x install-lavalink-vps.sh
  chmod +x start-lavalink-vps.sh
  ./install-lavalink-vps.sh
EOF

echo "✅ Lavalink installation completed on VPS!"
echo ""
echo "📋 Next steps:"
echo "1. Start Lavalink: ssh $VPS_USER@$VPS_IP './start-lavalink-vps.sh'"
echo "2. Check status: ssh $VPS_USER@$VPS_IP 'sudo systemctl status lavalink'"
echo "3. Update your bot's .env file with Lavalink settings"
echo "4. Test the connection"
echo ""
echo "🌐 Lavalink will be available at: $VPS_IP:2333"
