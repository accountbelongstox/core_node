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

# React Native Framework Launcher
# Launches React Native applications with pnpm support

# Variable Declarations
APP_PATH="$1"
APP_NAME="$2"
ACTION="${3:-start}"

# Check parameters
if [ -z "$APP_PATH" ] || [ -z "$APP_NAME" ]; then
    echo "Usage: $0 <app_path> <app_name> [action]"
    exit 1
fi

# Check if app directory exists
if [ ! -d "$APP_PATH" ]; then
    echo "ERROR: App directory not found: $APP_PATH"
    exit 1
fi

# Check for React Native files
PACKAGE_JSON="$APP_PATH/package.json"
ANDROID_DIR="$APP_PATH/android"
IOS_DIR="$APP_PATH/ios"

if [ ! -f "$PACKAGE_JSON" ]; then
    echo "ERROR: package.json not found in: $APP_PATH"
    exit 1
fi

# Verify it's a React Native project
if ! grep -q "react-native" "$PACKAGE_JSON" 2>/dev/null; then
    echo "ERROR: This doesn't appear to be a React Native project"
    exit 1
fi

echo "=== React Native Framework Launcher ==="
echo "App: $APP_NAME"
echo "Path: $APP_PATH"
echo "Action: $ACTION"
echo ""

# Change to app directory
cd "$APP_PATH"

case "$ACTION" in
    "install")
        echo "Installing dependencies with pnpm..."
        pnpm install
        # Install iOS pods if iOS directory exists
        if [ -d "$IOS_DIR" ]; then
            echo "Installing iOS pods..."
            cd ios && pod install && cd ..
        fi
        ;;
    "start"|"dev")
        echo "Starting React Native Metro bundler..."
        pnpm start
        ;;
    "android")
        echo "Running on Android..."
        if [ ! -d "$ANDROID_DIR" ]; then
            echo "ERROR: Android directory not found"
            exit 1
        fi
        pnpm run android
        ;;
    "ios")
        echo "Running on iOS..."
        if [ ! -d "$IOS_DIR" ]; then
            echo "ERROR: iOS directory not found"
            exit 1
        fi
        pnpm run ios
        ;;
    "build-android")
        echo "Building Android APK..."
        cd android && ./gradlew assembleRelease && cd ..
        ;;
    "build-ios")
        echo "Building iOS app..."
        if [ -d "$IOS_DIR" ]; then
            cd ios && xcodebuild -workspace *.xcworkspace -scheme * archive && cd ..
        else
            echo "ERROR: iOS directory not found"
            exit 1
        fi
        ;;
    "clean")
        echo "Cleaning React Native project..."
        rm -rf node_modules
        if [ -d "$ANDROID_DIR" ]; then
            cd android && ./gradlew clean && cd ..
        fi
        if [ -d "$IOS_DIR" ]; then
            cd ios && xcodebuild clean && rm -rf build && cd ..
        fi
        pnpm install
        ;;
    "reset")
        echo "Resetting React Native cache..."
        pnpm start --reset-cache
        ;;
    *)
        echo "Unknown action: $ACTION"
        echo "Available actions: install, start, dev, android, ios, build-android, build-ios, clean, reset"
        exit 1
        ;;
esac

echo ""
echo "React Native launcher finished."