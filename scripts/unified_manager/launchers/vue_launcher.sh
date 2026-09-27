#!/bin/bash

# Vue Framework Launcher
# Launches Vue applications with pnpm support

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

        # Check if node_modules exists, install if not
        if [ ! -d "node_modules" ]; then
            echo "node_modules not found. Installing dependencies..."
            pnpm install
            if [ $? -ne 0 ]; then
                echo "Failed to install dependencies"
                exit 1
            fi
        fi

        # Setup host binding for network access
        setup_host_binding "$APP_PATH"

        # Check for common Vue dev scripts
        if grep -q '"dev"' "$PACKAGE_JSON" 2>/dev/null; then
            echo "Launching with pnpm run dev..."
            HOST=0.0.0.0 pnpm run dev
        elif grep -q '"serve"' "$PACKAGE_JSON" 2>/dev/null; then
            echo "Launching with pnpm run serve..."
            HOST=0.0.0.0 pnpm run serve
        elif grep -q '"start"' "$PACKAGE_JSON" 2>/dev/null; then
            echo "Launching with pnpm start..."
            HOST=0.0.0.0 pnpm start
        else
            echo "No dev, serve, or start script found in package.json"
            echo "Available scripts:"
            pnpm run
        fi

        # Show network addresses after launch attempt
        local port=$(extract_port "$(grep -E '\"(dev|serve|start)\"' "$PACKAGE_JSON")" "8080")
        get_all_ips "$port"
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