#!/bin/bash

# VoiceClientAndCaddy NCore App Start Script
# Hardcoded start script for VoiceClientAndCaddy application

# Variables declaration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$(dirname "$APP_DIR")")"

echo "[INFO] Starting NCore application: VoiceClientAndCaddy"

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

# Start VoiceClientAndCaddy using unified entry point
echo "[INFO] Executing: node ./main.js app=VoiceClientAndCaddy"
node ./main.js app=VoiceClientAndCaddy

exit 0
