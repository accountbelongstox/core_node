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
FLUTTER_PORT_RANGE_START=6800
FLUTTER_PORT_RANGE_END=6899
APP_NAME=""
APP_INDEX=0
ASSIGNED_PORT=6800

# Function to check if a port is available
check_port_available() {
    local port=$1
    if command -v ss &> /dev/null; then
        if ss -tuln | grep -q ":$port "; then
            return 1
        fi
    elif command -v netstat &> /dev/null; then
        if netstat -tuln | grep -q ":$port "; then
            return 1
        fi
    fi
    return 0
}

# Function to get app index based on app name
get_app_index() {
    local app_name=$1
    local lib_apps_dir="$APP_DIR/lib/apps"
    
    # Define app index mapping (aligned with PowerShell script)
    case "$app_name" in
        "app_main")
            echo 0
            return
            ;;
        "app_achat")
            echo 1
            return
            ;;
        "app_bank")
            echo 2
            return
            ;;
        "app_example")
            echo 3
            return
            ;;
        "app_wuy")
            echo 4
            return
            ;;
    esac
    
    # For unknown apps, scan lib/apps directory to find index
    if [ -d "$lib_apps_dir" ]; then
        local index=0
        local found=0
        
        # app_main always gets index 0
        if [ -d "$lib_apps_dir/app_main" ]; then
            if [ "$app_name" = "app_main" ]; then
                echo 0
                return
            fi
            index=1
        fi
        
        # Other apps get indices based on alphabetical order
        for app_dir in "$lib_apps_dir"/app_*; do
            if [ ! -d "$app_dir" ]; then
                continue
            fi
            
            local dir_name=$(basename "$app_dir")
            if [ "$dir_name" = "app_main" ]; then
                continue
            fi
            
            if [ "$dir_name" = "$app_name" ]; then
                found=1
                break
            fi
            
            index=$((index + 1))
        done
        
        if [ $found -eq 1 ]; then
            echo $index
            return
        fi
    fi
    
    # Fallback: use hash-based index
    local hash=$(echo -n "$app_name" | cksum | awk '{print $1}')
    echo $((hash % 100))
}

# Function to get assigned port for an app
get_app_port() {
    local app_name=$1
    local app_index
    
    app_index=$(get_app_index "$app_name")
    local port=$((FLUTTER_PORT_RANGE_START + app_index))
    
    # Ensure port is within range
    if [ $port -gt $FLUTTER_PORT_RANGE_END ]; then
        local range_size=$((FLUTTER_PORT_RANGE_END - FLUTTER_PORT_RANGE_START + 1))
        port=$((FLUTTER_PORT_RANGE_START + (app_index % range_size)))
    fi
    
    echo $port
}

# Function to get available port with fallback
get_app_port_with_fallback() {
    local app_name=$1
    local preferred_port
    
    preferred_port=$(get_app_port "$app_name")
    
    if check_port_available "$preferred_port"; then
        echo $preferred_port
        return
    fi
    
    # Find alternative port
    local port=$FLUTTER_PORT_RANGE_START
    while [ $port -le $FLUTTER_PORT_RANGE_END ]; do
        if check_port_available "$port"; then
            echo "[WARNING] Preferred port $preferred_port for $app_name is not available, using $port" >&2
            echo $port
            return
        fi
        port=$((port + 1))
    done
    
    # Fallback to preferred port if all are used
    echo "[WARNING] No available ports found in range, using preferred port $preferred_port" >&2
    echo $preferred_port
}

# Function to detect app name from current directory or lib/apps
detect_app_name() {
    local lib_apps_dir="$APP_DIR/lib/apps"
    
    # Try to detect from lib/apps directory structure
    if [ -d "$lib_apps_dir" ]; then
        # Check if there's only one app (common case)
        local app_count=0
        local detected_app=""
        
        for app_dir in "$lib_apps_dir"/app_*; do
            if [ -d "$app_dir" ]; then
                app_count=$((app_count + 1))
                detected_app=$(basename "$app_dir")
            fi
        done
        
        if [ $app_count -eq 1 ]; then
            echo "$detected_app"
            return
        fi
        
        # If multiple apps, prefer app_main
        if [ -d "$lib_apps_dir/app_main" ]; then
            echo "app_main"
            return
        fi
        
        # Otherwise, get the first app alphabetically
        for app_dir in "$lib_apps_dir"/app_*; do
            if [ -d "$app_dir" ]; then
                echo "$(basename "$app_dir")"
                return
            fi
        done
    fi
    
    # Fallback to app_main
    echo "app_main"
}

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

# Detect app name if not provided
APP_NAME=$(detect_app_name)
ASSIGNED_PORT=$(get_app_port_with_fallback "$APP_NAME")

echo "[INFO] Detected app: $APP_NAME"
echo "[INFO] Assigned port: $ASSIGNED_PORT"

# Start the Flutter application based on platform
case "${PLATFORM,,}" in
    "web")
        echo "[INFO] Starting Flutter app for web on port $ASSIGNED_PORT..."
        flutter run -d web-server --web-port "$ASSIGNED_PORT"
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
        echo "[INFO] Starting Flutter app for web (default) on port $ASSIGNED_PORT..."
        flutter run -d web-server --web-port "$ASSIGNED_PORT"
        ;;
esac
