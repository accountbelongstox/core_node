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
#
# Linux one-click install: download dd.sh anywhere, then run. Single-file mode shows menu, downloads bootstrap, hands off.
#   Gitee (wget):   wget -O dd.sh https://gitee.com/accountbelongstox/core_node/raw/main/dd.sh && chmod +x dd.sh && bash dd.sh
#   Gitee (curl):   curl -fL https://gitee.com/accountbelongstox/core_node/raw/main/dd.sh -o dd.sh && chmod +x dd.sh && bash dd.sh
#   GitHub (wget):  wget -O dd.sh https://raw.githubusercontent.com/accountbelongstox/core_node/main/dd.sh && chmod +x dd.sh && bash dd.sh
#   GitHub (curl):  curl -fL https://raw.githubusercontent.com/accountbelongstox/core_node/main/dd.sh -o dd.sh && chmod +x dd.sh && bash dd.sh

# =============================================================================
# Variable Declarations
# =============================================================================
# All variables are declared at the beginning of the file for clarity

# Get actual script path and directory (resolve symlinks: if dd.sh is a link, use real file location)
SCRIPT_ACTUAL_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
SCRIPT_ACTUAL_DIR="$(dirname "$SCRIPT_ACTUAL_PATH")"

# Installation mode: do not treat as installed just because some temporary libraries exist.
# Check the resolved (real) path: correct location + project characteristics (scripts/, package.json, main.js).
IS_INSTALLATION_MODE=false
if [ ! -d "$SCRIPT_ACTUAL_DIR/scripts" ] || [ ! -f "$SCRIPT_ACTUAL_DIR/package.json" ] || [ ! -f "$SCRIPT_ACTUAL_DIR/main.js" ]; then
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
old_settings=""
BOOTSTRAP_SELECTED_INDEX=0
DOWNLOAD_READY=false

# URL Constants
GITHUB_BASE_URL="https://raw.githubusercontent.com/accountbelongstox/core_node/refs/heads/main"
GITEE_BASE_URL="https://gitee.com/accountbelongstox/core_node/raw/main"

# File Download Variables (relative paths)
GVAR_COMMON_FILE_RELATIVE="scripts/shells/linux/common/gvar_common.sh"
SETTING_BASE_FILE_RELATIVE="scripts/shells/linux/debian/install_shells/3_setting_base.sh"
PROJECT_VALIDATOR_FILE_RELATIVE="scripts/shells/linux/debian/install_shells/7_project_validator.sh"
PROJECT_INIT_LIB_RELATIVE="scripts/shells/linux/project_init_lib.sh"
BOOTSTRAP_RELATIVE="scripts/shells/linux/install_bootstrap.sh"

# File Download Variables (absolute paths)
GVAR_COMMON_FILE="$COMMON_SHELLS_DIR/gvar_common.sh"
SETTING_BASE_FILE="$SHELLS_DIR/linux/debian/install_shells/3_setting_base.sh"
PROJECT_VALIDATOR_FILE="$SHELLS_DIR/linux/debian/install_shells/7_project_validator.sh"

# Temporary directory for core_node operations
CORE_NODE_TMP_DIR="/var/_core_node/_tmp"

# Common download with progress (used in installation mode and can be reused by bootstrap)
download_with_progress() {
    local url="$1"
    local dest="$2"
    local dir_dest
    dir_dest="$(dirname "$dest")"
    mkdir -p "$dir_dest"
    if command -v curl >/dev/null 2>&1; then
        curl -# -f -L -o "$dest" "$url" || true
    elif command -v wget >/dev/null 2>&1; then
        wget --progress=bar:force -O "$dest" "$url" || true
    fi
    DOWNLOAD_READY=false
    [ -s "$dest" ] && DOWNLOAD_READY=true
}

# Installation mode launcher: show menu, download bootstrap file, hand off to it. dd.sh does nothing else.
select_bootstrap_option() {
    local title="$1"
    local options_name="$2"
    local back_index="$3"
    local -n bootstrap_options="$options_name"
    local option_count="${#bootstrap_options[@]}"
    local selected_index=0
    local old_settings=""
    local char=""
    local sequence=""
    local index=0

    if [ ! -t 0 ] || [ ! -r /dev/tty ]; then
        BOOTSTRAP_SELECTED_INDEX="$back_index"
        return
    fi
    old_settings="$(stty -g < /dev/tty 2>/dev/null)"
    if [ -z "$old_settings" ]; then
        BOOTSTRAP_SELECTED_INDEX="$back_index"
        return
    fi

    while true; do
        {
            printf "\033c"
            echo "=========================================="
            echo "$title"
            echo "=========================================="
            echo "Select an option (Up/Down to move, Enter to select):"
            echo "Press Ctrl+C to go back"
            echo ""
            for index in "${!bootstrap_options[@]}"; do
                if [ "$index" -eq "$selected_index" ]; then
                    printf "\033[47m\033[30m> %-68s\033[0m\n" "${bootstrap_options[$index]}"
                else
                    printf "  %-68s\n" "${bootstrap_options[$index]}"
                fi
            done
        } > /dev/tty

        stty -icanon -echo -isig < /dev/tty 2>/dev/null
        char="$(dd bs=1 count=1 < /dev/tty 2>/dev/null)"
        sequence=""
        if [ "$char" = $'\x1B' ]; then
            read -r -t 0.1 -d '' sequence < /dev/tty
        fi
        stty "$old_settings" < /dev/tty 2>/dev/null
        case "$char" in
            $'\x1B')
                case "$sequence" in
                    '[A') selected_index=$(((selected_index - 1 + option_count) % option_count)) ;;
                    '[B') selected_index=$(((selected_index + 1) % option_count)) ;;
                esac
                ;;
            '') BOOTSTRAP_SELECTED_INDEX="$selected_index"; return 0 ;;
            $'\x03'|q|Q) BOOTSTRAP_SELECTED_INDEX="$back_index"; return 0 ;;
        esac
    done
}

run_installation_mode() {
    local install_options=(
        "Install and repair project (download bootstrap, then hand off)"
        "Exit"
    )
    local region_options=(
        "Global (GitHub)"
        "China (Gitee)"
        "Exit"
    )
    local base_url="$GITHUB_BASE_URL"
    local bootstrap_dest="$SCRIPT_ACTUAL_DIR/install_bootstrap.sh"
    local bootstrap_url=""

    select_bootstrap_option "Install and Repair Project" install_options 1
    if [ "$BOOTSTRAP_SELECTED_INDEX" -eq 1 ]; then
        echo "Exit."
        exit 0
    fi

    select_bootstrap_option "Select Download Region" region_options 2
    if [ "$BOOTSTRAP_SELECTED_INDEX" -eq 2 ]; then
        echo "Exit."
        exit 0
    fi
    [ "$BOOTSTRAP_SELECTED_INDEX" -eq 1 ] && base_url="$GITEE_BASE_URL"
    bootstrap_url="$base_url/$BOOTSTRAP_RELATIVE"
    echo "Downloading bootstrap file..."
    echo "  URL: $bootstrap_url"
    download_with_progress "$bootstrap_url" "$bootstrap_dest"
    if [ "$DOWNLOAD_READY" != true ]; then
        echo "[ERROR] Failed to download bootstrap file. Exiting."
        exit
    fi
    chmod +x "$bootstrap_dest"
    echo "Handing off to bootstrap; dd.sh is no longer responsible for the rest."
REPO_BASE_URL="$base_url"
    exec bash "$bootstrap_dest"
}

if [ "$IS_INSTALLATION_MODE" = true ]; then
    run_installation_mode
    exit
fi

# Menu script paths (called via bash from menu_functions.sh, NOT sourced)
# These scripts are executed when user selects corresponding menu items
SPECIAL_SOFTWARE_ENV_MANAGER_SCRIPT="$SHELLS_DIR/linux/menu_itemshells/special_software_env_manager.sh"
SERVICE_MANAGER_SCRIPT="$SHELLS_DIR/linux/menu_itemshells/service_manager.sh"
INSTALL_TEST_MENU_SCRIPT="$COMMON_SHELLS_DIR/install_test_menu.sh"
SYSTEM_INFO_SCRIPT="$SHELLS_DIR/linux/menu_itemshells/system_info_display.sh"
UNIFIED_MANAGER_SCRIPT="$CORE_NODE_ROOT_DIR/scripts/unified_manager/unified_manager.sh"
GITPUT_UNIFIED_SCRIPT="$CORE_NODE_ROOT_DIR/scripts/git/gitput_unified.sh"
RESOURCE_LIMITER_SCRIPT="$CORE_NODE_ROOT_DIR/scripts/unified_manager/common/resource_limiter.sh"
ROUTER_SCRIPT="$SHELLS_DIR/linux/debian/install_shells/103_lnxrouter.sh"

# DD Helper directory
DD_HELPER_DIR="$SHELLS_DIR/linux/dd_helper"

# Files to be sourced first (before main sourcing loop)
declare -a SOURCE_FIRSTFILES=(
    "$DD_HELPER_DIR/constants.sh"
    "$DD_HELPER_DIR/system_functions.sh"
    "$DD_HELPER_DIR/main_functions.sh"
)

# Files to be sourced (in order, after first files)
declare -a SOURCE_FILES=(
    "$DD_HELPER_DIR/cache_functions.sh"
    "$DD_HELPER_DIR/dev_cache_cleanup.sh"
    "$DD_HELPER_DIR/file_validation.sh"
    "$DD_HELPER_DIR/file_download.sh"
    "$DD_HELPER_DIR/file_processing.sh"
    "$DD_HELPER_DIR/git_functions.sh"
    "$DD_HELPER_DIR/linuxenvs_sync.sh"
    "$DD_HELPER_DIR/linux_management.sh"
    "$DD_HELPER_DIR/management_and_backup.sh"
    "$DD_HELPER_DIR/menu_functions.sh"
    "$DD_HELPER_DIR/menu_display.sh"
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
    if [ -n "${old_settings:-}" ]; then
        stty "$old_settings"
    fi
    exit
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
            return
        fi
    fi
}

# Function to ensure dos2unix and source a file
source_file_with_dos2unix() {
    local file_path="$1"

    if LC_ALL=C grep -q $'\r' "$file_path" 2>/dev/null; then
        if command -v dos2unix >/dev/null 2>&1; then
            if ! $sudo dos2unix "$file_path" >/dev/null 2>&1; then
                $sudo sed -i 's/\r$//' "$file_path" 2>/dev/null
            fi
        else
            $sudo sed -i 's/\r$//' "$file_path" 2>/dev/null
        fi
    fi

    source "$file_path"
}

# Function Definitions

# =============================================================================
# Helper Loading
# =============================================================================

load_dd_helpers() {
    local helper_file=""
    local helper_name=""

    first_file_count=0
    first_file_total=${#SOURCE_FIRSTFILES[@]}
    for helper_file in "${SOURCE_FIRSTFILES[@]}"; do
        first_file_count=$((first_file_count + 1))
        helper_name="$(basename "$helper_file")"
        source_file_with_dos2unix "$helper_file"
        echo "[$first_file_count/$first_file_total] $helper_name - [OK]"
    done

    GLOBAL_VAR_DIR="$(determine_global_var_dir)"
    check_and_install_sudo
    ensure_dos2unix
    check_and_install_git

    file_count=0
    file_total=${#SOURCE_FILES[@]}
    for helper_file in "${SOURCE_FILES[@]}"; do
        file_count=$((file_count + 1))
        helper_name="$(basename "$helper_file")"
        source_file_with_dos2unix "$helper_file"
        echo "[$file_count/$file_total] $helper_name - [OK]"
    done
}

load_dd_helpers

# =============================================================================
# Main Execution
# =============================================================================
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
    check_and_download_files

    # Step 2: Check encrypted secret files
    ensure_secret_keys_ready

    # Clean up expired behavior cache
    cleanup_behavior_cache
    # Clean up orphaned file cache entries
    cleanup_file_cache
    # Clean up expired directory processing cache
    cleanup_directory_processing_cache
    # Remove unwanted system paths (e.g. /usr/local/qcloud) when present
    system_unwanted_paths_cleanup
    # Idempotently cap system log growth (journald + logrotate)
    system_log_limits_apply
    # Prompt to clean oversized developer-tool caches (pip/npm/go/rust) and /var/log
    dev_cache_cleanup_prompt

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
        # Per-directory cache decision, evaluated EXACTLY ONCE here and reused in the
        # processing loop below. check_directory_processing_cache runs a full recursive
        # find+stat (and prints its own CACHE HIT/MISS), so re-calling it per directory
        # in the loop would scan and log every directory twice. This pass also counts
        # total_dirs, replacing the separate counting loop.
        local dir_state=()
        local idx=0

        local all_cached=true
        for dir in "${target_dirs[@]}"; do
            local absolute_dir="$CORE_NODE_ROOT_DIR/$dir"
            if [ -d "$absolute_dir" ]; then
                ((total_dirs++))
                check_directory_processing_cache "$absolute_dir"
                if [ "$DIRECTORY_PROCESSING_CACHE_HIT" = true ]; then
                    dir_state[$idx]="cached"
                else
                    dir_state[$idx]="process"
                    all_cached=false
                fi
            else
                dir_state[$idx]="missing"
            fi
            ((idx++))
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

            idx=0
            for dir in "${target_dirs[@]}"; do
                local absolute_dir="$CORE_NODE_ROOT_DIR/$dir"
                if [ "${dir_state[$idx]}" != "missing" ]; then
                    ((processed_dirs++))
                    echo -e "\033[36m[DIR $processed_dirs/$total_dirs] Processing directory: $dir\033[0m"

                    if [ "${dir_state[$idx]}" = "cached" ]; then
                        # Cache result already determined (and logged) by the single check above
                        ((cached_dirs++))
                    else
                        process_sh_files "$absolute_dir"
                        set_directory_processing_cache "$absolute_dir"
                        echo -e "\033[32m[CACHE SET] Directory '$dir' processing cached\033[0m"
                        ((actually_processed_dirs++))
                    fi
                    echo
                else
                    echo -e "\033[31m[WARNING] Directory '$absolute_dir' not found. Skipping.\033[0m"
                fi
                ((idx++))
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


    echo ""
    echo "Script is executed from: $CORE_NODE_ROOT_DIR"

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

    # Step 5-1: Validate project location using 7_project_validator.sh
    echo ""
    echo -e "\033[36m[PROJECT VALIDATION] Running project validation...\033[0m"
    if [ -s "$PROJECT_VALIDATOR_FILE" ]; then
        SKIP_PROJECT_PERMISSION_REPAIR=true bash "$PROJECT_VALIDATOR_FILE"
        echo -e "\033[32m[PROJECT VALIDATION] Project validation completed\033[0m"
    else
        echo -e "\033[31m[PROJECT VALIDATION] 7_project_validator.sh not found at: $PROJECT_VALIDATOR_FILE\033[0m"
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
        echo -e "\033[32m[BASE SETUP] Base system setup completed\033[0m"

        # Refresh environment variables after disk setup (file already sourced in SOURCE_FILES)
        if [ -n "$CORE_NODE_PROJECT_ROOT" ]; then
            echo -e "\033[36m[BASE SETUP] Environment variables refreshed after disk setup\033[0m"
            echo -e "\033[32m[BASE SETUP] Updated CORE_NODE_PROJECT_ROOT: $CORE_NODE_PROJECT_ROOT\033[0m"
        fi
    else
        if [ "$skip_disk_setup" = false ]; then
            echo -e "\033[31m[BASE SETUP] 3_setting_base.sh not found at: $SETTING_BASE_FILE\033[0m"
        fi
    fi

    # Create symlink to /usr/local/bin/dd.sh and sync linuxenvs; skip all /usr/local/bin links in installation mode
    echo ""
    if [ "$IS_INSTALLATION_MODE" = true ]; then
        echo "[INSTALLATION MODE] Skipping /usr/local/bin symlink - running from temporary location"
    else
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
                if [ -L "$symlink_target" ] && [ "$(readlink -f "$symlink_target")" = "$SCRIPT_ACTUAL_PATH" ]; then
                    echo "Symlink created successfully"
                else
                    echo "Warning: Failed to create symlink (may need sudo privileges)"
                fi
            fi
        fi
        # Sync scripts from scripts/linuxenvs to /usr/local/bin using symlinks
        echo ""
        sync_linuxenvs_to_bin
    fi

    # Step 5-4: Show the Linux Management menu directly (no wrapper menu layer)
    echo ""
    detect_system_version
    if declare -F show_linux_management_submenu >/dev/null 2>&1; then
        show_linux_management_submenu
    else
        initialize_menu_items
        show_interactive_menu
    fi
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
