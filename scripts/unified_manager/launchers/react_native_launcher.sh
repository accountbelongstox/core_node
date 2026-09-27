#!/bin/bash

# React Native Framework Launcher
# Launches React Native applications with pnpm support

# Variable Declarations
APP_PATH="$1"
APP_NAME="$2"
ACTION="${3:-start}"

# Load network utils
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
source "$SCRIPT_DIR/../utils/network_utils.sh"

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

        # Check if node_modules exists, install if not
        if [ ! -d "node_modules" ]; then
            echo "node_modules not found. Installing dependencies..."
            pnpm install
            if [ $? -ne 0 ]; then
                echo "Failed to install dependencies"
                exit 1
            fi
        fi

        echo "Launching Metro bundler with pnpm start..."
        pnpm start

        # Show network addresses after launch attempt
        local port=$(extract_port "$(grep -E '\"start\"' "$PACKAGE_JSON")" "8081")
        get_all_ips "$port"
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