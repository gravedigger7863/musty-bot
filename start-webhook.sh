#!/bin/bash

echo "🚀 Starting auto-deployment webhook server..."

# Set webhook secret (change this to something secure)
export WEBHOOK_SECRET="musty-bot-deploy-secret-2025"

# Start the webhook server
node webhook-deploy.js
