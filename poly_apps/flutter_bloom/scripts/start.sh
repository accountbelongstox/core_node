#!/bin/bash

# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Flutter Bloom Start Script
# Starts flutter_bloom application

# Variables declaration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
PLATFORM="${1:-web}"

echo "[INFO] Starting Flutter Bloom application"

# Change to app directory
cd "$APP_DIR" || {
    echo "[ERROR] Failed to change to app directory: $APP_DIR"
    exit 1
}

# Check if pubspec.yaml exists
if [ ! -f "pubspec.yaml" ]; then
    echo "[ERROR] pubspec.yaml not found in app directory"
    exit 1
fi

# Start the Flutter application based on platform
case "${PLATFORM,,}" in
    "web")
        echo "[INFO] Starting Flutter app for web..."
        flutter run -d web-server --web-port 3000
        ;;
    "linux")
        echo "[INFO] Starting Flutter app for Linux..."
        flutter run -d linux
        ;;
    "android")
        echo "[INFO] Starting Flutter app for Android..."
        flutter run -d android
        ;;
    "ios")
        echo "[INFO] Starting Flutter app for iOS..."
        flutter run -d ios
        ;;
    *)
        echo "[INFO] Starting Flutter app for web (default)..."
        flutter run -d web-server --web-port 3000
        ;;
esac
