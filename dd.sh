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

# =============================================================================
# Variable Declarations
# =============================================================================
# All variables are declared at the beginning of the file for clarity

# Get actual script path and directory
SCRIPT_ACTUAL_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
SCRIPT_ACTUAL_DIR="$(dirname "$SCRIPT_ACTUAL_PATH")"

# Determine if running in installation mode
# Initial installation may run from system temporary directories (/usr/tmp or /tmp)
# Once installed, dd.sh runs from project directory
IS_INSTALLATION_MODE=false
if [[ "$SCRIPT_ACTUAL_DIR" == /usr/tmp* ]] || [[ "$SCRIPT_ACTUAL_DIR" == /tmp* ]]; then
    IS_INSTALLATION_MODE=true
fi

# Set CORE_NODE_ROOT_DIR (same in both installation and normal mode)
CORE_NODE_ROOT_DIR="$SCRIPT_ACTUAL_DIR"

# Directory Path Variables
SCRIPT_DIR="$CORE_NODE_ROOT_DIR/scripts"
SHELLS_DIR="$SCRIPT_DIR/shells"
INSTALL_DIR="$CORE_NODE_ROOT_DIR/install"
COMMON_SHELLS_DIR="$SHELLS_DIR/linux/common"
COMMON_SCRIPTS_DIR="$SHELLS_DIR/scripts"

# Global Variable Directory (will be set after function definition)
GLOBAL_VAR_DIR=""

# Counter Variables
first_file_count=0
first_file_total=0
file_count=0
file_total=0
basename_file=""

# Array Variables
target_dirs=("apps" "ncore" "scripts")

# System Variables
sudo=""
SYSTEM_VERSION=""
SYSTEM_NAME=""

# URL Constants
GITHUB_BASE_URL="https://raw.githubusercontent.com/accountbelongstox/core_node/refs/heads/main"
GITEE_BASE_URL="https://gitee.com/accountbelongstox/core_node/raw/main"

# File Download Variables
GVAR_COMMON_FILE="$COMMON_SHELLS_DIR/gvar_common.sh"
SETTING_BASE_FILE="$SHELLS_DIR/linux/debian/install_shells/2_setting_base.sh"
PROJECT_VALIDATOR_FILE="$SHELLS_DIR/linux/debian/install_shells/8_project_validator.sh"

# Menu script paths (called via bash from menu_functions.sh, NOT sourced)
# These scripts are executed when user selects corresponding menu items
SPECIAL_SOFTWARE_ENV_MANAGER_SCRIPT="$SHELLS_DIR/linux/menu_itemshells/special_software_env_manager.sh"
SERVICE_MANAGER_SCRIPT="$SHELLS_DIR/linux/menu_itemshells/service_manager.sh"
INSTALL_TEST_MENU_SCRIPT="$COMMON_SHELLS_DIR/install_test_menu.sh"
SYSTEM_INFO_SCRIPT="$SHELLS_DIR/linux/menu_itemshells/system_info_display.sh"
UNIFIED_MANAGER_SCRIPT="$CORE_NODE_ROOT_DIR/scripts/unified_manager/unified_manager.sh"
GITPUT_UNIFIED_SCRIPT="$CORE_NODE_ROOT_DIR/scripts/git/gitput_unified.sh"
RESOURCE_LIMITER_SCRIPT="$CORE_NODE_ROOT_DIR/scripts/unified_manager/common/resource_limiter.sh"
ROUTER_SCRIPT="$SHELLS_DIR/linux/debian/install_shells/101_lnxrouter.sh"

# DD Helper directory
DD_HELPER_DIR="$SHELLS_DIR/linux/dd_helper"

# Files to be sourced first (before main sourcing loop)
declare -a SOURCE_FIRSTFILES=(
    "$DD_HELPER_DIR/constants.sh"
    "$DD_HELPER_DIR/system_functions.sh"
)

# Files to be sourced (in order, after first files)
declare -a SOURCE_FILES=(
    "$DD_HELPER_DIR/cache_functions.sh"
    "$DD_HELPER_DIR/file_validation.sh"
    "$DD_HELPER_DIR/file_download.sh"
    "$DD_HELPER_DIR/file_processing.sh"
    "$DD_HELPER_DIR/git_functions.sh"
    "$DD_HELPER_DIR/linuxenvs_sync.sh"
    "$DD_HELPER_DIR/linux_management.sh"
    "$DD_HELPER_DIR/menu_functions.sh"
    "$DD_HELPER_DIR/menu_display.sh"
    "$DD_HELPER_DIR/main_functions.sh"
    "$DD_HELPER_DIR/secret_functions.sh"
    "$DD_HELPER_DIR/main_execution.sh"
    "$GVAR_COMMON_FILE"
    "$DD_HELPER_DIR/smart_permissions.sh"
)


# Menu Configuration Variables
declare -A menu_items
declare -a menu_order

# Signal handler for Ctrl+C
cleanup_and_exit() {
    printf "\033c"  # Clear screen
    echo "Script terminated by user (Ctrl+C)"
    # Restore terminal settings
    if [ -n "$old_settings" ]; then
        stty "$old_settings"
    fi
    exit 1
}

# Set up signal trap
trap cleanup_and_exit SIGINT

# Function to ensure dos2unix is installed
ensure_dos2unix() {
    if ! command -v dos2unix >/dev/null 2>&1; then
        if command -v apt-get >/dev/null 2>&1; then
            $sudo apt-get update -qq && $sudo apt-get install -y dos2unix
        elif command -v yum >/dev/null 2>&1; then
            $sudo yum install -y dos2unix
        elif command -v apk >/dev/null 2>&1; then
            $sudo apk add dos2unix
        else
            echo "[ERROR] Failed to install dos2unix (unsupported package manager). Using sed fallback."
            return 1
        fi
    fi
    return 0
}

# Function to ensure dos2unix and source a file
source_file_with_dos2unix() {
    local file_path="$1"
    
        if command -v dos2unix >/dev/null 2>&1; then
        $sudo dos2unix "$file_path" >/dev/null 2>&1
        if [ $? -ne 0 ]; then
            $sudo sed -i 's/\r$//' "$file_path" 2>/dev/null
            fi
        else
        $sudo sed -i 's/\r$//' "$file_path" 2>/dev/null
    fi
    
    source "$file_path" 2>/dev/null
    return $?
}

# Function Definitions

# System functions moved to system_functions.sh

# Cache and file processing functions moved to cache_functions.sh and file_processing.sh

# Menu Functions

# Functions moved to dd_helper directory:
# - sync_linuxenvs_to_bin -> linuxenvs_sync.sh
# - show_special_software_env_menu, show_service_manager, load_saved_values, handle_menu_action -> menu_functions.sh

# read_secret_input and ensure_secret_keys_ready moved to main_functions.sh

# show_service_manager function moved to menu_functions.sh

# initialize_menu_items and show_interactive_menu moved to menu_display.sh

# determine_global_var_dir moved to main_functions.sh
# check_and_install_sudo moved to system_functions.sh

# Source first files (constants.sh and system_functions.sh) to get check_and_install_sudo
# (needed before ensure_dos2unix which requires $sudo)
first_file_count=0
first_file_total=${#SOURCE_FIRSTFILES[@]}
for source_file in "${SOURCE_FIRSTFILES[@]}"; do
    ((first_file_count++))
    basename_file="$(basename "$source_file")"
    sed -i 's/\r$//' "$source_file" 2>/dev/null
    source "$source_file" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "[$first_file_count/$first_file_total] $basename_file - [OK]"
    else
        echo "[$first_file_count/$first_file_total] $basename_file - [FAILED]"
    fi
done

# Ensure sudo is available before ensure_dos2unix
check_and_install_sudo

# Ensure dos2unix and git are installed before loading files
ensure_dos2unix
check_and_install_git

# Source all required files (with dos2unix processing)
file_count=0
file_total=${#SOURCE_FILES[@]}
for source_file in "${SOURCE_FILES[@]}"; do
    ((file_count++))
    basename_file="$(basename "$source_file")"
    source_file_with_dos2unix "$source_file"
    if [ $? -eq 0 ]; then
        echo "[$file_count/$file_total] $basename_file - [OK]"
    else
        echo "[$file_count/$file_total] $basename_file - [FAILED]"
    fi
done

# Set GLOBAL_VAR_DIR using the determine_global_var_dir function (after source main_functions.sh)
GLOBAL_VAR_DIR=$(determine_global_var_dir)

# Main Execution
main() {
    # Display initial information
    echo "CORE_NODE_ROOT_DIR: $CORE_NODE_ROOT_DIR"
    echo "SHELLS_DIR:         $SHELLS_DIR"
    echo ""

    # Step 1: Check and download required files
    echo -e "\033[36m[FILE CHECK] Checking for required files...\033[0m"

    # Check if required files exist, if not show region selection menu
    if [ ! -s "$GVAR_COMMON_FILE" ] || [ ! -s "$SETTING_BASE_FILE" ] || [ ! -s "$PROJECT_VALIDATOR_FILE" ]; then
        show_region_selection_menu
    fi

    # Download missing files
    if ! check_and_download_files; then
        echo -e "\033[31m[ERROR] Failed to download required files. Exiting.\033[0m"
        exit 1
    fi

    # Step 2: Check encrypted secret files
    ensure_secret_keys_ready

    # Clean up expired behavior cache
    cleanup_behavior_cache
    # Clean up orphaned file cache entries
    cleanup_file_cache
    # Clean up expired directory processing cache
    cleanup_directory_processing_cache

    # Step 3: Process shell files (dos2unix conversion and set +x permissions with cache)
    echo ""
    echo -e "\033[36m[FILE PROCESSING] Starting scan and conversion of .sh files\033[0m"

    # Use IS_INSTALLATION_MODE variable instead of checking path again
    if [ "$IS_INSTALLATION_MODE" = true ]; then
        echo -e "\033[33m[INFO] Installation mode detected (running from: $CORE_NODE_ROOT_DIR)\033[0m"
        echo -e "\033[33m[INFO] Skipping project directories scan (apps/ncore/scripts not yet installed)\033[0m"
        echo -e "\033[32m[SKIPPED] Directory scanning skipped in installation mode\033[0m"
    else
        local total_dirs=0
        local processed_dirs=0
        local cached_dirs=0
        local actually_processed_dirs=0
        local overall_start_time=$(date +%s.%N)

        for dir in "${target_dirs[@]}"; do
            local absolute_dir="$CORE_NODE_ROOT_DIR/$dir"
            if [ -d "$absolute_dir" ]; then
                ((total_dirs++))
            fi
        done

        local all_cached=true
        for dir in "${target_dirs[@]}"; do
            local absolute_dir="$CORE_NODE_ROOT_DIR/$dir"
            if [ -d "$absolute_dir" ] && ! check_directory_processing_cache "$absolute_dir"; then
                all_cached=false
                break
            fi
        done

        local skip_scan=false
        if [ "$all_cached" = true ] && [ "$total_dirs" -gt 0 ]; then
            echo -e "\033[32m[CACHE INFO] All directories ($total_dirs) have been processed recently (cache valid for 24h)\033[0m"
            echo -e "\033[33m[SMART CACHE] Cache will auto-check file modification times (only reprocess modified files)\033[0m"
            echo -e "\033[33m[SCAN OPTION] Skip directory scan? (recommended for faster startup)\033[0m"
            read -p "Skip scan? [Y/n]: " -n 1 -r scan_choice
            echo
            if [[ ! $scan_choice =~ ^[Nn]$ ]]; then
                echo -e "\033[32m[SKIPPED] Directory scanning skipped (using smart cache)\033[0m"
                skip_scan=true
            else
                echo -e "\033[33m[FORCED SCAN] Force scanning all directories (will check file modifications)...\033[0m"
            fi
        fi

        if [ "$skip_scan" = false ]; then
            echo -e "\033[33m[INFO] Found $total_dirs directories to scan: ${target_dirs[*]}\033[0m"
            echo -e "\033[33m[SCAN] Directories to be scanned:\033[0m"
            for dir in "${target_dirs[@]}"; do
                local absolute_dir_preview="$CORE_NODE_ROOT_DIR/$dir"
                if [ -d "$absolute_dir_preview" ]; then
                    echo -e "\033[33m  - $absolute_dir_preview\033[0m"
                else
                    echo -e "\033[31m  - $absolute_dir_preview (NOT FOUND)\033[0m"
                fi
            done
            echo

            for dir in "${target_dirs[@]}"; do
                local absolute_dir="$CORE_NODE_ROOT_DIR/$dir"
                if [ -d "$absolute_dir" ]; then
                    ((processed_dirs++))
                    echo -e "\033[36m[DIR $processed_dirs/$total_dirs] Processing directory: $dir\033[0m"

                    if check_directory_processing_cache "$absolute_dir"; then
                        # Cache hit message is now printed by check_directory_processing_cache
                        ((cached_dirs++))
                    else
                        # Cache miss message is now printed by check_directory_processing_cache
                        process_sh_files "$absolute_dir"
                        set_directory_processing_cache "$absolute_dir"
                        echo -e "\033[32m[CACHE SET] Directory '$dir' processing cached\033[0m"
                        ((actually_processed_dirs++))
                    fi
                    echo
                else
                    echo -e "\033[31m[WARNING] Directory '$absolute_dir' not found. Skipping.\033[0m"
                fi
            done

            local overall_end_time=$(date +%s.%N)
            local overall_duration
            if command -v bc >/dev/null 2>&1; then
                overall_duration=$(echo "$overall_end_time - $overall_start_time" | bc -l)
            else
                overall_duration=$(awk "BEGIN {printf \"%.2f\", $overall_end_time - $overall_start_time}")
            fi

            echo -e "\033[32m[COMPLETE] All .sh files processed!\033[0m"
            echo -e "\033[32m  - Directories checked: $processed_dirs/$total_dirs\033[0m"
            echo -e "\033[32m  - Cache hits (skipped): $cached_dirs\033[0m"
            echo -e "\033[32m  - Actually processed: $actually_processed_dirs\033[0m"
            echo -e "\033[32m  - Total processing time: ${overall_duration}s\033[0m"
        fi
    fi


    # Make shell files executable (root level)
    echo ""
    echo "Script is executed from: $CORE_NODE_ROOT_DIR"
    make_sh_executable

    # Step 3.5: Smart Permissions & Environment Setup
    echo ""
    echo -e "\033[36m[SMART SETUP] Configuring permissions and environment...\033[0m"
    if smart_permissions_fix "$CORE_NODE_ROOT_DIR"; then
        echo -e "\033[32m[SMART SETUP] All permissions and environment configured successfully\033[0m"
    else
        echo -e "\033[33m[SMART SETUP] Setup completed with warnings\033[0m"
    fi

    # Step 4: Create and initialize global variable directory
    echo ""
    if [ ! -d "$GLOBAL_VAR_DIR" ]; then
        $sudo mkdir -p "$GLOBAL_VAR_DIR"
        echo "Created global variable directory: $GLOBAL_VAR_DIR"
    fi

    # Store paths in global variables
    echo "$CORE_NODE_ROOT_DIR" | $sudo tee "$GLOBAL_VAR_DIR/SCRIPT_ROOT_DIR" >/dev/null
    echo "Stored script root directory path in global variables"

    if [ -d "$COMMON_SHELLS_DIR" ]; then
        echo "$COMMON_SHELLS_DIR" | $sudo tee "$GLOBAL_VAR_DIR/COMMON_SHELLS_DIR" >/dev/null
        echo "Stored common shells directory path in global variables"
    else
        echo "Warning: Common shells directory not found at $COMMON_SHELLS_DIR"
    fi

    if [ -d "$COMMON_SCRIPTS_DIR" ]; then
        echo "$COMMON_SCRIPTS_DIR" | $sudo tee "$GLOBAL_VAR_DIR/COMMON_SCRIPTS_DIR" >/dev/null
        echo "Stored common scripts directory path in global variables"
    else
        echo "Warning: Common scripts directory not found at $COMMON_SCRIPTS_DIR"
    fi

    # Step 5-1: Validate project location using 8_project_validator.sh
    echo ""
    echo -e "\033[36m[PROJECT VALIDATION] Running project validation...\033[0m"
    if [ -s "$PROJECT_VALIDATOR_FILE" ]; then
        bash "$PROJECT_VALIDATOR_FILE"
        if [ $? -eq 0 ]; then
            echo -e "\033[32m[PROJECT VALIDATION] Project validation completed successfully\033[0m"
        else
            echo -e "\033[33m[PROJECT VALIDATION] Project validation completed with warnings\033[0m"
        fi
    else
        echo -e "\033[31m[PROJECT VALIDATION] 8_project_validator.sh not found at: $PROJECT_VALIDATOR_FILE\033[0m"
    fi

    # Step 5-2: Check encrypted secret files (already done in step 2, no action needed here)

    # Step 5-3: Run base system setup (disk detection and mount management based on wsl/server/desktop)
    echo ""
    echo -e "\033[36m[BASE SETUP] Checking if base system setup is needed...\033[0m"

    local disk_setup_flag="$GLOBAL_VAR_DIR/DISK_SETUP_COMPLETED"
    local skip_disk_setup=false

    # Check if running in WSL environment (skip disk setup in WSL)
    if [ "$IS_WSL" = true ]; then
        echo -e "\033[33m[BASE SETUP] WSL environment detected - skipping disk setup\033[0m"
        echo -e "\033[33m[BASE SETUP] WSL manages disk mounts automatically via /mnt/c, /mnt/d, etc.\033[0m"
        skip_disk_setup=true
    else
        if [ -s "$disk_setup_flag" ]; then
            local setup_time=$(cat "$disk_setup_flag" 2>/dev/null)
            echo -e "\033[33m[BASE SETUP] Disk setup already completed at: $setup_time\033[0m"
            echo -e "\033[33m[BASE SETUP] Skipping disk detection to avoid redundant operations\033[0m"
            skip_disk_setup=true
        fi
    fi

    if [ "$skip_disk_setup" = false ] && [ -s "$SETTING_BASE_FILE" ]; then
        echo -e "\033[36m[BASE SETUP] Running base system setup...\033[0m"
        bash "$SETTING_BASE_FILE"
        local base_setup_exit_code=$?

        if [ $base_setup_exit_code -eq 0 ]; then
            echo -e "\033[32m[BASE SETUP] Base system setup completed successfully\033[0m"
        else
            echo -e "\033[33m[BASE SETUP] Base system setup completed with warnings\033[0m"
        fi

        # Refresh environment variables after disk setup (file already sourced in SOURCE_FILES)
        if [ -n "$CORE_NODE_PROJECT_ROOT" ]; then
            echo -e "\033[36m[BASE SETUP] Environment variables refreshed after disk setup\033[0m"
            echo -e "\033[32m[BASE SETUP] Updated CORE_NODE_PROJECT_ROOT: $CORE_NODE_PROJECT_ROOT\033[0m"
        fi
    else
        if [ "$skip_disk_setup" = false ]; then
            echo -e "\033[31m[BASE SETUP] 2_setting_base.sh not found at: $SETTING_BASE_FILE\033[0m"
        fi
    fi

    # After successful project validation, check if we need to switch to cloned version
    if [ "$IS_INSTALLATION_MODE" = true ]; then
        echo -e "\033[36m[INITIAL DEPLOYMENT] Running from temporary location: $CORE_NODE_ROOT_DIR\033[0m"
        # File already sourced in SOURCE_FILES, just check if variable is set
        if [ -n "$CORE_NODE_PROJECT_ROOT" ]; then
            if [ -d "$CORE_NODE_PROJECT_ROOT" ] && [ -s "$CORE_NODE_PROJECT_ROOT/dd.sh" ]; then
                echo -e "\033[32m[INITIAL DEPLOYMENT] Project successfully cloned to: $CORE_NODE_PROJECT_ROOT\033[0m"
                echo -e "\033[36m[INITIAL DEPLOYMENT] Switching to cloned version...\033[0m"
                chmod +x "$CORE_NODE_PROJECT_ROOT/dd.sh"
                echo -e "\033[32m[INITIAL DEPLOYMENT] Set execute permission on $CORE_NODE_PROJECT_ROOT/dd.sh\033[0m"
                cd "$CORE_NODE_PROJECT_ROOT"
                echo -e "\033[32m[INITIAL DEPLOYMENT] Switched to directory: $CORE_NODE_PROJECT_ROOT\033[0m"
                echo -e "\033[36m[INITIAL DEPLOYMENT] Executing cloned dd.sh...\033[0m"
                echo ""
                exec bash "$CORE_NODE_PROJECT_ROOT/dd.sh"
            else
                echo -e "\033[33m[INITIAL DEPLOYMENT] Project not yet cloned to $CORE_NODE_PROJECT_ROOT, continuing with tmp version\033[0m"
            fi
        else
            echo -e "\033[33m[INITIAL DEPLOYMENT] gvar_common.sh not found, continuing with tmp version\033[0m"
        fi
    fi

    # Create symlink to /usr/local/bin/dd.sh if not in installation mode
    echo ""
    if [ "$IS_INSTALLATION_MODE" = false ]; then
        local symlink_target="/usr/local/bin/dd.sh"
        if [ -L "$symlink_target" ]; then
            local current_target=$(readlink -f "$symlink_target")
            if [ "$current_target" != "$SCRIPT_ACTUAL_PATH" ]; then
                echo "Updating symlink: $symlink_target -> $SCRIPT_ACTUAL_PATH"
                $sudo rm -f "$symlink_target"
                $sudo ln -sf "$SCRIPT_ACTUAL_PATH" "$symlink_target"
                echo "Symlink updated successfully"
            else
                echo "Symlink already correct: $symlink_target -> $SCRIPT_ACTUAL_PATH"
            fi
        else
            if [ -e "$symlink_target" ]; then
            echo "Warning: $symlink_target exists but is not a symlink"
            echo "Removing and creating symlink..."
            $sudo rm -f "$symlink_target"
            $sudo ln -sf "$SCRIPT_ACTUAL_PATH" "$symlink_target"
            echo "Symlink created: $symlink_target -> $SCRIPT_ACTUAL_PATH"
        else
            echo "Creating symlink: $symlink_target -> $SCRIPT_ACTUAL_PATH"
            $sudo ln -sf "$SCRIPT_ACTUAL_PATH" "$symlink_target"
            if [ $? -eq 0 ]; then
                echo "Symlink created successfully"
            else
                echo "Warning: Failed to create symlink (may need sudo privileges)"
                fi
            fi
        fi
    else
        echo "[INSTALLATION MODE] Skipping symlink creation - running from temporary location"
    fi

    # Sync scripts from scripts/linuxenvs to /usr/local/bin using symlinks
    echo ""
    sync_linuxenvs_to_bin

    # Step 5-4: Initialize and show interactive menu
    echo ""
    detect_system_version
    initialize_menu_items
    show_interactive_menu
}

# print_color, handle_arguments, show_cli_help moved to main_execution.sh

# Check for help argument
if [ "$1" = "--help" ] || [ "$1" = "-h" ] || [ "$1" = "help" ]; then
    show_cli_help
    exit 0
fi

# Execute main function or handle arguments
if [ $# -eq 0 ]; then
    main
else
    handle_arguments "$@"
fi
# sudo apt update && sudo apt install dos2unix && sudo dos2unix ./dd.sh && sudo chmod +x ./dd.sh  
