#!/bin/bash

# Script to set up Firefox for yt-dlp cookies
# This needs to be run with a display for Firefox to work

echo "🔥 Setting up Firefox for yt-dlp cookies..."

# Create Firefox profile directory
mkdir -p ~/.mozilla/firefox

# Check if Firefox is installed
if ! command -v firefox &> /dev/null; then
    echo "❌ Firefox is not installed. Please install it first."
    exit 1
fi

echo "✅ Firefox is installed"

# Create a new Firefox profile for bot use
echo "🔧 Creating Firefox profile for bot..."
firefox -CreateProfile "bot-profile"

echo "📝 Firefox profile created. Now you need to:"
echo "1. Open Firefox with the new profile"
echo "2. Go to YouTube.com"
echo "3. Log in with your YouTube account"
echo "4. Make sure you're logged in and can access YouTube"
echo "5. Close Firefox"
echo ""
echo "After that, yt-dlp should be able to use Firefox cookies automatically."
echo ""
echo "To test, run: yt-dlp --cookies-from-browser firefox 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'"
