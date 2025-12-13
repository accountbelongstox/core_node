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

# dd.sh Unified App Manager >16 - Main Entry Point
# Minimal entry point that loads modular components

# Variable Declarations
SCRIPT_PATH="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_PATH/../.." && pwd)"
NCORE_APPS="$ROOT_DIR/apps"
PYCORE_APPS="$ROOT_DIR/pyapps"
POLY_APPS="$ROOT_DIR/poly_apps"

# Source gvar_common.sh to get CORE_NODE_DATA_DIR
source "$ROOT_DIR/scripts/shells/linux/common/gvar_common.sh"

# Cache directory
CACHE_DIR="$CORE_NODE_DATA_DIR/unified_manager"
CACHE_FILE="$CACHE_DIR/app_cache.json"
TEMP_SCRIPT_DIR="$CACHE_DIR/temp_scripts"

# Global arrays
declare -a APPS_NAME
declare -a APPS_PATH
declare -a APPS_TYPE
declare -a APPS_AVAILABLE_SCRIPTS
declare -a APPS_CURRENT_SCRIPT
declare -a APPS_SCRIPT_INDEX
declare -a APPS_IS_SELECTED
CURRENT_INDEX=0
MAX_APP_NAME_WIDTH=0

# Script files to scan for
SCRIPT_FILES=("start.sh" "install.sh" "deploy.sh")

# Native startup types
NATIVE_STARTUPS=("Ncore/Pycore/Installer" "polyLauncher" "pyStart" "flutterStart" "laravelStart" "nuxtStart" "phpStart" "reactNativeStart" "kotlinMultiPlatformStart" "vueStart" "reactStart")

# Ensure cache directory exists
mkdir -p "$CACHE_DIR"
mkdir -p "$TEMP_SCRIPT_DIR"

# Load modules
MODULES_DIR="$SCRIPT_PATH/modules"
UTILS_DIR="$SCRIPT_PATH/utils"

# Check if modules exist
if [ ! -d "$MODULES_DIR" ]; then
    echo "ERROR: Modules directory not found: $MODULES_DIR"
    exit 1
fi

# Source all modules in order
source "$MODULES_DIR/framework_detection.sh"
source "$MODULES_DIR/app_scanner.sh"
source "$MODULES_DIR/startup_generator.sh"
source "$MODULES_DIR/ui.sh"
source "$MODULES_DIR/launcher.sh"
source "$MODULES_DIR/service_manager.sh"
source "$UTILS_DIR/cache.sh"

# Scan all apps
scan_apps() {
    echo ""
    echo -e "\033[33m=== Starting Application Scan ===\033[0m"
    echo ""

    # Step 1: Scan ncoreApps
    mapfile -t ncore_apps < <(step1_scan_ncore_apps)
    echo ""

    # Step 2: Scan pycoreApps
    mapfile -t pycore_apps < <(step2_scan_pycore_apps)
    echo ""

    # Step 3: Scan poly_apps
    mapfile -t poly_apps < <(step3_scan_poly_apps)
    echo ""

    # Combine apps
    local all_apps=("${ncore_apps[@]}" "${pycore_apps[@]}" "${poly_apps[@]}")

    # Step 4: Generate native startup
    mapfile -t apps_with_native < <(step4_generate_native_startup "${all_apps[@]}")
    echo ""

    # Step 5: Scan scripts directory
    mapfile -t final_apps < <(step5_scan_scripts_directory "${apps_with_native[@]}")
    echo ""

    # Populate global arrays
    APPS_NAME=()
    APPS_PATH=()
    APPS_TYPE=()
    APPS_AVAILABLE_SCRIPTS=()
    APPS_CURRENT_SCRIPT=()
    APPS_SCRIPT_INDEX=()
    APPS_IS_SELECTED=()
    MAX_APP_NAME_WIDTH=0

    for app_data in "${final_apps[@]}"; do
        IFS='|' read -r app_name app_path app_type scripts_str current_script script_index <<< "$app_data"

        APPS_NAME+=("$app_name")
        APPS_PATH+=("$app_path")
        APPS_TYPE+=("$app_type")
        APPS_AVAILABLE_SCRIPTS+=("$scripts_str")
        APPS_CURRENT_SCRIPT+=("$current_script")
        APPS_SCRIPT_INDEX+=("$script_index")
        APPS_IS_SELECTED+=("N")

        # Calculate max width
        local name_len=${#app_name}
        [ $name_len -gt $MAX_APP_NAME_WIDTH ] && MAX_APP_NAME_WIDTH=$name_len
    done

    # Load cache
    load_cache

    echo -e "\033[32m=== Scan Complete ===\033[0m"
    echo ""
}

# Create systemd service for current app
create_service_for_current_app() {
    local app_name="${APPS_NAME[$CURRENT_INDEX]}"
    local app_path="${APPS_PATH[$CURRENT_INDEX]}"
    local app_type="${APPS_TYPE[$CURRENT_INDEX]}"
    local current_script="${APPS_CURRENT_SCRIPT[$CURRENT_INDEX]}"

    if [ -z "$current_script" ] || [ "$current_script" = "None" ]; then
        echo -e "\033[31mNo startup script configured for $app_name\033[0m"
        echo -e "\033[33mPlease select a startup script first using T (toggle script)\033[0m"
        sleep 2
        return 1
    fi

    echo ""
    echo -e "\033[36m=== Service Creation for $app_name ===\033[0m"

    # Get domain input
    echo -ne "\033[33mDomain (e.g., $app_name.local, press Enter for auto): \033[0m"
    read domain_input
    local domain="${domain_input:-$app_name.local}"

    # Get port input
    local default_port=$(get_available_port)
    echo -ne "\033[33mPort (press Enter for auto-assigned port $default_port): \033[0m"
    read port_input
    local port="${port_input:-$default_port}"

    # Auto-detect debug mode
    local debug_mode=$(should_use_debug_mode "$app_path" "$current_script")

    # Create the service
    create_systemd_service "$app_name" "$app_path" "$app_type" "$current_script" "$port" "$domain" "$debug_mode"
    local result=$?

    if [ $result -eq 0 ]; then
        echo ""
        echo -e "\033[32m✓ Service creation completed!\033[0m"
        echo -e "\033[36mService: ${current_script%Start}-$app_name.service\033[0m"
        echo -e "\033[36mDomain: http://$domain\033[0m"
        echo -e "\033[36mPort: $port\033[0m"
        echo ""
        echo -e "\033[33mNext steps:\033[0m"
        echo -e "  1. Start service: sudo systemctl start ${current_script%Start}-$app_name"
        echo -e "  2. Enable on boot: sudo systemctl enable ${current_script%Start}-$app_name"
        echo -e "  3. Check status: sudo systemctl status ${current_script%Start}-$app_name"
        echo -e "  4. View logs: sudo journalctl -u ${current_script%Start}-$app_name -f"
        echo ""
        echo -e "\033[36mAdd '$domain' to your /etc/hosts file to test locally:\033[0m"
        echo -e "\033[90m127.0.0.1 $domain\033[0m"
    else
        echo -e "\033[31m✗ Service creation failed\033[0m"
    fi

    echo ""
    echo -e "\033[33mPress any key to continue...\033[0m"
    read -n 1
}

# Main loop
main() {
    # Always scan apps first
    scan_apps

    # Save terminal settings
    old_settings=$(stty -g)

    while true; do
        show_menu

        # Read user input
        read input

        # Convert to uppercase for command comparison
        input_upper=$(echo "$input" | tr '[:lower:]' '[:upper:]')

        # Handle numeric input (app selection)
        if [[ "$input" =~ ^[0-9]+$ ]]; then
            local app_num=$input
            local app_index=$((app_num - 1))

            if [ $app_index -ge 0 ] && [ $app_index -lt ${#APPS_NAME[@]} ]; then
                CURRENT_INDEX=$app_index
                save_cache
                echo -e "\033[32mSelected app #$app_num: ${APPS_NAME[$app_index]}\033[0m"

                # Show script selection menu
                show_script_menu $app_index
                local menu_result=$?

                if [ $menu_result -eq 2 ]; then
                    # User chose to launch from script menu
                    launch_current_app
                elif [ $menu_result -eq 3 ]; then
                    # User chose to create service from script menu
                    create_service_for_current_app
                fi
                # If menu_result is 0 or 1, just return to main menu
            else
                echo -e "\033[31mInvalid app number: $app_num\033[0m"
                sleep 1
            fi
        # Handle commands
        elif [ "$input_upper" = "L" ]; then
            launch_current_app
        elif [ "$input_upper" = "C" ]; then
            create_service_for_current_app
        elif [ "$input_upper" = "T" ]; then
            toggle_script
        elif [ "$input_upper" = "S" ]; then
            toggle_selection
        elif [ "$input_upper" = "R" ]; then
            scan_apps
            echo -e "\033[32mApplication list updated\033[0m"
            sleep 1
        elif [ "$input_upper" = "Q" ] || [ "$input_upper" = "QUIT" ] || [ "$input_upper" = "EXIT" ]; then
            echo -e "\033[33mExiting program\033[0m"
            save_cache
            stty "$old_settings"
            exit 0
        elif [ -z "$input" ]; then
            # Empty input, launch current app
            launch_current_app
        else
            echo -e "\033[31mUnknown command: $input\033[0m"
            echo -e "\033[33mValid commands: L (launch), C (create service), T (toggle script), S (select), R (rescan), Q (quit)\033[0m"
            echo -e "\033[33mOr enter an app number (1-${#APPS_NAME[@]})\033[0m"
            sleep 2
        fi
    done
}

# Start program
main