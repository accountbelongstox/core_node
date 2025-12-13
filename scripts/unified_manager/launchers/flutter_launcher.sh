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

# Flutter Framework Launcher
# Launches Flutter applications

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

# Check for Flutter files
PUBSPEC_YAML="$APP_PATH/pubspec.yaml"

if [ ! -f "$PUBSPEC_YAML" ]; then
    echo "ERROR: pubspec.yaml not found in: $APP_PATH"
    exit 1
fi

echo "=== Flutter Framework Launcher ==="
echo "App: $APP_NAME"
echo "Path: $APP_PATH"
echo "Action: $ACTION"
echo ""

# Change to app directory
cd "$APP_PATH"

case "$ACTION" in
    "install")
        echo "Installing Flutter dependencies..."
        flutter pub get
        ;;
    "start"|"run")
        echo "Running Flutter application..."

        # Check if Flutter dependencies are installed
        if [ ! -d ".dart_tool" ]; then
            echo "Flutter dependencies not found. Installing..."
            flutter pub get
            if [ $? -ne 0 ]; then
                echo "Failed to install Flutter dependencies"
                exit 1
            fi
        fi

        flutter run
        ;;
    "debug")
        echo "Running Flutter in debug mode..."
        flutter run --debug
        ;;
    "release")
        echo "Running Flutter in release mode..."
        flutter run --release
        ;;
    "build-android")
        echo "Building Android APK..."
        flutter build apk
        ;;
    "build-ios")
        echo "Building iOS app..."
        flutter build ios
        ;;
    "build-web")
        echo "Building web app..."
        flutter build web --web-hostname 0.0.0.0
        ;;
    "web-dev")
        echo "Running Flutter web development server..."
        flutter run -d web-server --web-hostname 0.0.0.0 --web-port 8080

        # Show network addresses after launch attempt
        get_all_ips "8080"
        ;;
    "test")
        echo "Running Flutter tests..."
        flutter test
        ;;
    "analyze")
        echo "Analyzing Flutter code..."
        flutter analyze
        ;;
    "clean")
        echo "Cleaning Flutter project..."
        flutter clean
        flutter pub get
        ;;
    "doctor")
        echo "Running Flutter doctor..."
        flutter doctor
        ;;
    *)
        echo "Unknown action: $ACTION"
        echo "Available actions: install, start, run, debug, release, build-android, build-ios, build-web, web-dev, test, analyze, clean, doctor"
        exit 1
        ;;
esac

echo ""
echo "Flutter launcher finished."