#!/usr/bin/env bash
set -euo pipefail

# Define required variables for gvar_common.sh before sourcing
SHELLS_DIR=""
SHELLS_SCRIPTS_DIR=""
CORE_SCRIPTS_DIR=""

SCRIPT_DIR=""
APP_DIR=""
ORIGINAL_WORKING_DIR=""
APP_NAME=""
MODE=""
BASE_PORT=10000
APP_NAMESPACE=""
APP_PORT=""
APP_DISPLAY=""
SYNC_PID=""

declare -A APP_PORTS
declare -A APP_DISPLAY_NAMES

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
ORIGINAL_WORKING_DIR="$(pwd)"

# Source global variable functions for menu caching
GVAR_COMMON_SCRIPT="$SCRIPT_DIR/../../../scripts/shells/linux/common/gvar_common.sh"
if [ -f "$GVAR_COMMON_SCRIPT" ]; then
    source "$GVAR_COMMON_SCRIPT"
fi

APP_NAME="${1:-}"
MODE="${2:-debug}"

cd "$APP_DIR"


get_all_ips() {
    ip addr show 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d'/' -f1 | grep -v '^127\.'
}

show_help() {
    echo ""
    echo "==============================================================================="
    echo "  NUXT MAIN LAUNCHER - HELP"
    echo "==============================================================================="
    echo ""
    echo "Usage:"
    echo "  ./start.sh                    Interactive menu"
    echo "  ./start.sh <app>              Direct launch in debug mode"
    echo "  ./start.sh <app> debug        Direct launch in debug mode (factory sync)"
    echo "  ./start.sh <app> build        Direct launch in build mode"
    echo "  ./start.sh list               List available apps"
    echo "  ./start.sh help               Show this help"
    echo ""
    echo "Available Apps:"
    local index=0
    for app_dir in "$APP_DIR"/app_*_pages; do
        if [ -d "$app_dir" ]; then
            local app_name=$(basename "$app_dir" | sed 's/^app_//' | sed 's/_pages$//')
            local port=$((BASE_PORT + index))
            local display_name=$(echo "$app_name" | sed 's/_/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2));}1')
            echo "  - $app_name ($display_name) - Port $port"
            index=$((index + 1))
        fi
    done
    echo ""
    echo "Examples:"
    echo "  ./start.sh                    Start with interactive menu"
    echo "  ./start.sh pymatrix           Start pyMatrix in debug mode"
    echo "  ./start.sh ittools build      Build ITTools"
    echo ""
    echo "==============================================================================="
    exit 0
}

list_apps() {
    echo ""
    echo "==============================================================================="
    echo "  AVAILABLE APPLICATIONS"
    echo "==============================================================================="
    echo ""
    
    local index=0
    for app_dir in "$APP_DIR"/app_*_pages; do
        if [ -d "$app_dir" ]; then
            local app_name=$(basename "$app_dir" | sed 's/^app_//' | sed 's/_pages$//')
            local port=$((BASE_PORT + index))
            local display_name=$(echo "$app_name" | sed 's/_/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2));}1')
            
            echo "  App Name     : $app_name"
            echo "  Display Name : $display_name"
            echo "  Port         : $port"
            echo "  Dev Command  : dev:$app_name"
            echo "  Build Command: build:$app_name"
            echo ""
            
            index=$((index + 1))
        fi
    done
    
    echo "==============================================================================="
    exit 0
}

show_simple_menu() {
    local apps=()
    local index=0
    
    for app_dir in "$APP_DIR"/app_*_pages; do
        if [ -d "$app_dir" ]; then
            local app_name=$(basename "$app_dir" | sed 's/^app_//' | sed 's/_pages$//')
            apps+=("$app_name")
            
            local port=$((BASE_PORT + index))
            APP_PORTS[$app_name]=$port
            
            local display_name=$(echo "$app_name" | sed 's/_/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2));}1')
            APP_DISPLAY_NAMES[$app_name]=$display_name
            
            index=$((index + 1))
        fi
    done
    
    if [ ${#apps[@]} -eq 0 ]; then
        echo "ERROR: No apps found (app_*_pages directories)"
        exit 1
    fi
    
    echo ""
    echo "==============================================================================="
    echo "  NUXT MAIN APPLICATION LAUNCHER"
    echo "==============================================================================="
    echo ""
    echo "Available Applications:"
    echo ""
    
    for i in "${!apps[@]}"; do
        local app="${apps[$i]}"
        local port="${APP_PORTS[$app]}"
        local display="${APP_DISPLAY_NAMES[$app]}"
        echo "  $((i+1)). $display (Port $port)"
    done
    
    echo ""
    echo "==============================================================================="
    echo ""
    read -p "Select application number (or 'q' to quit): " choice
    
    if [[ "$choice" == "q" ]] || [[ "$choice" == "Q" ]]; then
        echo "Cancelled by user"
        exit 0
    fi
    
    if ! [[ "$choice" =~ ^[0-9]+$ ]]; then
        echo "ERROR: Invalid selection"
        exit 1
    fi
    
    local idx=$((choice - 1))
    if [ $idx -lt 0 ] || [ $idx -ge ${#apps[@]} ]; then
        echo "ERROR: Selection out of range"
        exit 1
    fi
    
    APP_NAME="${apps[$idx]}"
    
    echo ""
    read -p "Select mode (1=debug, 2=build) [default=1]: " mode_choice
    
    if [[ "$mode_choice" == "2" ]]; then
        MODE="build"
    else
        MODE="debug"
    fi
    
    echo ""
    echo "Starting: ${APP_DISPLAY_NAMES[$APP_NAME]}"
    echo "Mode: $MODE"
    echo "Port: ${APP_PORTS[$APP_NAME]}"
    echo ""
}

sync_to_laravel_nginx() {
    local app_name="$1"
    local port="$2"

    clear
    echo ""
    echo "==============================================================================="
    echo "  SYNC TO LARAVEL NGINX"
    echo "==============================================================================="
    echo ""
    echo "App      : $app_name"
    echo "Port     : $port"
    echo ""
    echo "Select service mode:"
    echo "  1) Debug mode   - Dev server with file watcher"
    echo "  2) Build mode   - Production optimized"
    echo ""
    read -p "Enter choice (1 or 2): " mode_choice

    local mode="debug"
    local debug_flag="1"

    if [[ "$mode_choice" == "2" ]]; then
        mode="build"
        debug_flag="0"
    fi

    echo ""
    echo "Selected mode: $mode"
    echo ""

    # Calculate relative path from nuxt_main/scripts to laravel_main
    local laravel_dir="$SCRIPT_DIR/../../laravel_main"

    if [ ! -d "$laravel_dir" ]; then
        echo "[ERROR] Laravel directory not found: $laravel_dir"
        echo "Press any key to continue..."
        read -rsn1
        return 1
    fi

    echo "[INFO] Laravel directory: $laravel_dir"
    echo "[INFO] Calling PHP Artisan command..."
    echo ""

    # Call Laravel Artisan command
    cd "$laravel_dir"

    # Build command with appropriate flags
    local cmd="php artisan servermanager:nuxt add $app_name --port=$port"
    if [[ "$debug_flag" == "1" ]]; then
        cmd="$cmd --debug"
    fi

    echo "[COMMAND] $cmd"
    echo ""

    # Temporarily disable exit on error to capture command result
    set +e
    $cmd
    local exit_code=$?
    set -e

    echo ""
    if [ $exit_code -eq 0 ]; then
        echo "[SUCCESS] Service synced to Laravel Nginx successfully!"
        echo ""
        echo "Service details:"
        echo "  - systemd service: nuxt-${app_name}.service"
        echo "  - Port: $port"
        echo "  - Mode: $mode"
        echo ""
    else
        echo ""
        echo "==============================================================================="
        echo "[ERROR] Failed to sync service to Laravel Nginx (exit code: $exit_code)"
        echo "==============================================================================="
        echo ""
        echo "Please review the error messages above."
        echo ""
    fi

    cd "$APP_DIR"

    echo ""
    echo "Press any key to return to menu..."
    read -rsn1

    return 0
}

show_interactive_menu() {
    if [ ! -t 0 ] || [ ! -t 1 ]; then
        show_simple_menu
        return
    fi

    local apps=()
    local index=0

    for app_dir in "$APP_DIR"/app_*_pages; do
        if [ -d "$app_dir" ]; then
            local app_name=$(basename "$app_dir" | sed 's/^app_//' | sed 's/_pages$//')
            apps+=("$app_name")

            local port=$((BASE_PORT + index))
            APP_PORTS[$app_name]=$port

            local display_name=$(echo "$app_name" | sed 's/_/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2));}1')
            APP_DISPLAY_NAMES[$app_name]=$display_name

            index=$((index + 1))
        fi
    done

    if [ ${#apps[@]} -eq 0 ]; then
        echo "ERROR: No apps found (app_*_pages directories)"
        exit 1
    fi

    local selected=0
    local mode="debug"
    local modes=("debug" "build" "sync")
    local mode_index=0

    # Load cached menu selections
    if command -v get_global_var &> /dev/null; then
        local cached_app=$(get_global_var "NUXT_MENU_SELECTED_APP" "0")
        local cached_mode=$(get_global_var "NUXT_MENU_SELECTED_MODE" "0")

        # Validate and use cached app selection
        if [[ "$cached_app" =~ ^[0-9]+$ ]] && [ "$cached_app" -ge 0 ] && [ "$cached_app" -lt ${#apps[@]} ]; then
            selected=$cached_app
        fi

        # Validate and use cached mode selection
        if [[ "$cached_mode" =~ ^[0-9]+$ ]] && [ "$cached_mode" -ge 0 ] && [ "$cached_mode" -lt ${#modes[@]} ]; then
            mode_index=$cached_mode
            mode="${modes[$mode_index]}"
        fi
    fi

    while true; do
        clear
        echo ""
        echo "=== Nuxt Main Application Launcher ==="
        echo ""
        echo "Use Arrow Keys: Up/Down to select app, Left/Right to cycle action"
        echo "Actions: [debug] → [build] → [sync to Laravel]"
        echo "Press Enter to execute, 'q' to quit"
        echo ""

        for i in "${!apps[@]}"; do
            local app="${apps[$i]}"
            local port="${APP_PORTS[$app]}"
            local display="${APP_DISPLAY_NAMES[$app]}"

            # Get current mode display
            local mode_display="$mode"
            if [ "$mode" = "sync" ]; then
                mode_display="sync→Laravel"
            fi

            if [ $i -eq $selected ]; then
                echo -e "\033[32m\033[7m> $display (Port $port) [$mode_display]\033[0m"
            else
                echo "  $display (Port $port)"
            fi
        done

        echo ""
        local sel_app="${apps[$selected]}"
        local sel_port="${APP_PORTS[$sel_app]}"
        local sel_display="${APP_DISPLAY_NAMES[$sel_app]}"

        # Display action description
        local action_desc=""
        case "$mode" in
            "debug")
                action_desc="Start dev server with file watcher"
                ;;
            "build")
                action_desc="Build production version"
                ;;
            "sync")
                action_desc="Sync to Laravel Nginx & systemd"
                ;;
        esac

        echo -e "\033[33mSelected: $sel_display - Port: $sel_port\033[0m"
        echo -e "\033[36mAction: $action_desc\033[0m"
        echo ""

        IFS= read -rsn1 key

        if [[ $key == $'\x1b' ]]; then
            read -rsn2 -t 0.1 key
            case "$key" in
                '[A')
                    # Up arrow - select previous app
                    selected=$((selected - 1))
                    [ $selected -lt 0 ] && selected=$((${#apps[@]} - 1))
                    ;;
                '[B')
                    # Down arrow - select next app
                    selected=$((selected + 1))
                    [ $selected -ge ${#apps[@]} ] && selected=0
                    ;;
                '[C')
                    # Right arrow - next mode
                    mode_index=$((mode_index + 1))
                    [ $mode_index -ge ${#modes[@]} ] && mode_index=0
                    mode="${modes[$mode_index]}"
                    ;;
                '[D')
                    # Left arrow - previous mode
                    mode_index=$((mode_index - 1))
                    [ $mode_index -lt 0 ] && mode_index=$((${#modes[@]} - 1))
                    mode="${modes[$mode_index]}"
                    ;;
            esac
        elif [[ $key == "" ]]; then
            # Enter key pressed
            # Save selections to cache
            if command -v set_global_var &> /dev/null; then
                set_global_var "NUXT_MENU_SELECTED_APP" "$selected"
                set_global_var "NUXT_MENU_SELECTED_MODE" "$mode_index"
            fi

            if [ "$mode" = "sync" ]; then
                # Execute sync to Laravel (will prompt for debug/build mode)
                sync_to_laravel_nginx "${apps[$selected]}" "${APP_PORTS[${apps[$selected]}]}"
            else
                # Start the app
                APP_NAME="${apps[$selected]}"
                MODE="$mode"
                return 0
            fi
        elif [[ $key == "q" ]] || [[ $key == "Q" ]]; then
            echo "Cancelled by user"
            exit 0
        fi
    done
}

if [ "$APP_NAME" = "help" ] || [ "$APP_NAME" = "-h" ] || [ "$APP_NAME" = "--help" ]; then
    show_help
fi

if [ "$APP_NAME" = "list" ] || [ "$APP_NAME" = "-list" ] || [ "$APP_NAME" = "--list" ]; then
    list_apps
fi

if [ -z "$APP_NAME" ]; then
    show_interactive_menu
fi

if [ -z "$APP_NAME" ]; then
    echo ""
    echo "ERROR: Missing app name"
    echo "Usage: ./start.sh <app> [mode]"
    echo "Use './start.sh help' for more information"
    echo ""
    exit 1
fi

if [ "$MODE" != "debug" ] && [ "$MODE" != "build" ]; then
    echo ""
    echo "ERROR: Invalid mode '$MODE'. Must be 'debug' or 'build'"
    echo ""
    exit 1
fi

APP_NAMESPACE="$APP_NAME"

if [ -z "${APP_PORTS[$APP_NAMESPACE]:-}" ]; then
    local index=0
    for app_dir in "$APP_DIR"/app_*_pages; do
        if [ -d "$app_dir" ]; then
            local app_name=$(basename "$app_dir" | sed 's/^app_//' | sed 's/_pages$//')
            local port=$((BASE_PORT + index))
            APP_PORTS[$app_name]=$port
            local display_name=$(echo "$app_name" | sed 's/_/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2));}1')
            APP_DISPLAY_NAMES[$app_name]=$display_name
            index=$((index + 1))
        fi
    done
fi

APP_PORT="${APP_PORTS[$APP_NAMESPACE]}"
APP_DISPLAY="${APP_DISPLAY_NAMES[$APP_NAMESPACE]}"

echo ""
echo "==============================================================================="
echo "  NUXT MULTI-APP LAUNCHER - APPLICATION STARTUP"
echo "==============================================================================="
echo ""
echo "Selected App     : $APP_DISPLAY"
echo "Namespace        : $APP_NAMESPACE"
echo "Mode             : $MODE"
echo "Port             : $APP_PORT"
echo "Host             : 0.0.0.0 (Network Accessible)"
echo "Source Directory : app_${APP_NAMESPACE}_pages/"
echo "Switch Script    : scripts/switch-app.js"
echo ""

echo "=== Network URLs ===" 
echo "Local URL        : http://127.0.0.1:$APP_PORT"

mapfile -t ips < <(get_all_ips)
for ip in "${ips[@]}"; do
    echo "Network URL      : http://$ip:$APP_PORT"
done

echo ""
echo "==============================================================================="
echo ""

export APP_ENTRY="$APP_NAMESPACE"
export NUXT_HOST="0.0.0.0"
export NUXT_PORT="$APP_PORT"

echo ""
echo "==============================================================================="
echo "  STEP 1: SWITCHING APP PAGES DIRECTORY"
echo "==============================================================================="
echo "[INFO] Target App: $APP_NAMESPACE"
echo "[INFO] Switch Script: $SCRIPT_DIR/switch-app.js"
echo ""

node "$SCRIPT_DIR/switch-app.js" "$APP_NAMESPACE"

if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Failed to switch pages directory"
    echo "==============================================================================="
    exit 1
fi

echo ""
echo "[SUCCESS] Pages directory switched successfully"
echo "==============================================================================="
echo ""

sleep 0.5

echo ""
echo "==============================================================================="
echo "  STEP 2: STARTING FILE SYNC & APPLICATION SERVER"
echo "==============================================================================="
echo ""

if [ "$MODE" = "debug" ]; then
    echo "[INFO] Mode: DEBUG (Factory Sync + File Watcher + Dev Server)"
    echo "[INFO] Port: $APP_PORT"
    echo "[INFO] Host: 0.0.0.0 (Network Accessible)"
    echo ""
    echo "[INFO] Starting factory sync with file watcher and dev server..."
    echo "  - Mirroring to factory directory"
    echo "  - Watching source files for changes"
    echo "  - Auto-sync every 2 seconds"
    echo "  - Dev server will run in factory directory"
    echo ""
    echo "[COMMAND TRACE] Executing:"
    echo "  > node $SCRIPT_DIR/switch-app.js $APP_NAMESPACE --mode dev"
    echo ""
    
    node "$SCRIPT_DIR/switch-app.js" "$APP_NAMESPACE" --mode dev
    
else
    echo "[INFO] Mode: BUILD (Factory Mirror + Production Build)"
    echo "[INFO] Port: $APP_PORT"
    echo ""
    echo "[COMMAND TRACE] Executing Factory Build:"
    echo "  > node $SCRIPT_DIR/switch-app.js $APP_NAMESPACE --mode build"
    echo ""
    echo "[INFO] Building application in factory directory..."
    echo "==============================================================================="
    echo ""
    
    node "$SCRIPT_DIR/switch-app.js" "$APP_NAMESPACE" --mode build
fi

echo ""
echo "==============================================================================="
echo "  RESTORING ORIGINAL WORKING DIRECTORY"
echo "==============================================================================="
echo "Original directory: $ORIGINAL_WORKING_DIR"
echo "Switching back..."

cd "$ORIGINAL_WORKING_DIR"

echo "Restored to: $(pwd)"
echo "==============================================================================="
echo ""
