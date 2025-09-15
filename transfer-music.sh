#!/bin/bash

# Music Transfer Script
# Transfers music files from E:/MUSIC to VPS at 94.130.97.149

echo "🎵 Starting music transfer to VPS..."
echo "Source: E:/MUSIC"
echo "Destination: root@94.130.97.149:/home/music"
echo ""

# Create a compressed archive of the music directory
echo "📦 Creating compressed archive..."
cd /e/MUSIC
tar -czf /tmp/music-backup.tar.gz .

# Transfer the archive to the VPS
echo "🚀 Transferring archive to VPS..."
scp /tmp/music-backup.tar.gz root@94.130.97.149:/home/music/

# Extract the archive on the VPS
echo "📂 Extracting files on VPS..."
ssh root@94.130.97.149 "cd /home/music && tar -xzf music-backup.tar.gz && rm music-backup.tar.gz && chmod -R 755 ."

# Clean up local archive
echo "🧹 Cleaning up local archive..."
rm /tmp/music-backup.tar.gz

echo "✅ Music transfer completed!"
echo "📊 Checking transferred files..."
ssh root@94.130.97.149 "ls -la /home/music && du -sh /home/music"
