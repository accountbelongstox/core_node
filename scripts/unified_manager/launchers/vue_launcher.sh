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

# Vue Framework Launcher
# Launches Vue applications with pnpm support

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

# Check for package.json
PACKAGE_JSON="$APP_PATH/package.json"
if [ ! -f "$PACKAGE_JSON" ]; then
    echo "ERROR: package.json not found in: $APP_PATH"
    exit 1
fi

echo "=== Vue Framework Launcher ==="
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
        ;;
    "start"|"dev")
        echo "Starting Vue application..."
        # Check for common Vue dev scripts
        if grep -q '"dev"' "$PACKAGE_JSON" 2>/dev/null; then
            pnpm run dev
        elif grep -q '"serve"' "$PACKAGE_JSON" 2>/dev/null; then
            pnpm run serve
        elif grep -q '"start"' "$PACKAGE_JSON" 2>/dev/null; then
            pnpm start
        else
            echo "No dev, serve, or start script found in package.json"
            echo "Available scripts:"
            pnpm run
        fi
        ;;
    "build")
        echo "Building Vue application..."
        pnpm run build
        ;;
    "test")
        echo "Running tests..."
        if grep -q '"test"' "$PACKAGE_JSON" 2>/dev/null; then
            pnpm test
        else
            echo "No test script found in package.json"
        fi
        ;;
    "clean")
        echo "Cleaning node_modules and installing fresh dependencies..."
        rm -rf node_modules package-lock.json
        pnpm install
        ;;
    *)
        echo "Unknown action: $ACTION"
        echo "Available actions: install, start, dev, build, test, clean"
        exit 1
        ;;
esac

echo ""
echo "Vue launcher finished."