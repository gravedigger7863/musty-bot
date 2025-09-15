#!/bin/bash

# Lavalink installation script for VPS (Ubuntu/Debian)
echo "🚀 Installing Lavalink on VPS..."

# Update package list
echo "📦 Updating package list..."
sudo apt update

# Install Java 17 if not already installed
echo "☕ Installing Java 17..."
if ! command -v java &> /dev/null; then
    sudo apt install -y openjdk-17-jdk
else
    echo "✅ Java already installed"
fi

# Verify Java version
JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1)
echo "✅ Java version: $JAVA_VERSION"

# Create lavalink directory
echo "📁 Creating Lavalink directory..."
mkdir -p ~/lavalink
cd ~/lavalink

# Download Lavalink
echo "📥 Downloading Lavalink..."
if [ ! -f "Lavalink.jar" ]; then
    wget -O Lavalink.jar "https://github.com/lavalink-devs/Lavalink/releases/latest/download/Lavalink.jar"
    echo "✅ Lavalink downloaded"
else
    echo "✅ Lavalink already exists"
fi

# Create application.yml configuration
echo "⚙️ Creating Lavalink configuration..."
cat > application.yml << 'EOF'
server:
  port: 2333
  address: 0.0.0.0

lavalink:
  plugins:
    - dependency: "com.github.topi314:lavasrc-plugin:4.1.0"
      repository: "https://maven.topi.wtf/releases"
  server:
    password: "youshallnotpass"
    sources:
      youtube: true
      bandcamp: true
      soundcloud: true
      twitch: true
      vimeo: true
      http: true
      local: false
    filters:
      volume: true
      equalizer: true
      karaoke: true
      timescale: true
      tremolo: true
      vibrato: true
      distortion: true
      rotation: true
      channelMix: true
      lowPass: true
    bufferDurationMs: 400
    frameBufferDurationMs: 5000
    opusEncodingQuality: 10
    resamplingQuality: LOW
    trackStuckThresholdMs: 10000
    useSeekGhosting: true
    youtubePlaylistLoadLimit: 6
    playerUpdateInterval: 2500
    youtubeSearchEnabled: true
    soundcloudSearchEnabled: true
    gc-warnings: true

metrics:
  prometheus:
    enabled: false
    endpoint: /metrics

logging:
  file:
    path: ./logs/
  level:
    root: INFO
    lavalink: INFO

  request:
    enabled: true
    includeClientInfo: true
    includeHeaders: false
    includeQueryString: true
    includePayload: true
    maxPayloadLength: 10000

  logback:
    rollingpolicy:
      max-file-size: 25MB
      max-history: 30
      total-size-cap: 1GB
EOF

# Create logs directory
mkdir -p logs

# Create systemd service for Lavalink
echo "🔧 Creating systemd service..."
sudo tee /etc/systemd/system/lavalink.service > /dev/null << EOF
[Unit]
Description=Lavalink Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME/lavalink
ExecStart=/usr/bin/java -Xmx1G -jar Lavalink.jar
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable lavalink

echo "✅ Lavalink installation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Start Lavalink: sudo systemctl start lavalink"
echo "2. Check status: sudo systemctl status lavalink"
echo "3. View logs: sudo journalctl -u lavalink -f"
echo ""
echo "🔧 Configuration:"
echo "- Lavalink will run on port 2333"
echo "- Password: youshallnotpass"
echo "- Configuration file: ~/lavalink/application.yml"
echo ""
echo "🌐 Your bot should connect to: 94.130.97.149:2333"
