#!/bin/bash

# Lavalink startup script for Windows (Git Bash)
echo "🚀 Starting Lavalink server..."

# Check if Java is installed
if ! command -v java &> /dev/null; then
    echo "❌ Java is not installed or not in PATH"
    echo "Please install Java 17 or higher from https://adoptium.net/"
    exit 1
fi

# Check Java version
JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1)
if [ "$JAVA_VERSION" -lt 17 ]; then
    echo "❌ Java version $JAVA_VERSION is too old. Please install Java 17 or higher"
    exit 1
fi

echo "✅ Java version $JAVA_VERSION detected"

# Create logs directory if it doesn't exist
mkdir -p logs

# Download Lavalink if it doesn't exist
if [ ! -f "Lavalink.jar" ]; then
    echo "📥 Downloading Lavalink..."
    curl -L -o Lavalink.jar "https://github.com/lavalink-devs/Lavalink/releases/latest/download/Lavalink.jar"
    if [ $? -ne 0 ]; then
        echo "❌ Failed to download Lavalink"
        exit 1
    fi
    echo "✅ Lavalink downloaded successfully"
fi

# Start Lavalink
echo "🎵 Starting Lavalink server on port 2333..."
java -Xmx1G -jar Lavalink.jar --spring.config.location=file:lavalink-application.yml
