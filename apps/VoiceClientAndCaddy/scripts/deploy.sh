#!/bin/bash

# VoiceClientAndCaddy NCore App Deploy Script
# Hardcoded deploy script for VoiceClientAndCaddy application

# Variables declaration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$(dirname "$APP_DIR")")"

echo "[INFO] Deploying NCore application: VoiceClientAndCaddy"

# Change to project root directory
cd "$PROJECT_ROOT" || {
    echo "[ERROR] Failed to change to project root: $PROJECT_ROOT"
    exit 1
}

# Check if main.js exists
if [ ! -f "main.js" ]; then
    echo "[ERROR] main.js not found in project root"
    exit 1
fi

# Deploy VoiceClientAndCaddy in production mode
echo "[INFO] Starting VoiceClientAndCaddy in production mode..."
NODE_ENV=production
node ./main.js app=VoiceClientAndCaddy

exit 0
