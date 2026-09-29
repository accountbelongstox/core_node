#!/bin/bash

# WebLocalAreaNetwork NCore App Start Script
# Hardcoded start script for WebLocalAreaNetwork application

# Variables declaration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$(dirname "$APP_DIR")")"

echo "[INFO] Starting NCore application: WebLocalAreaNetwork"

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

# Start WebLocalAreaNetwork using unified entry point
echo "[INFO] Executing: node ./main.js app=WebLocalAreaNetwork"
node ./main.js app=WebLocalAreaNetwork

exit 0
