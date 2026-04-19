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

# URL Constants
GITHUB_BASE_URL="https://raw.githubusercontent.com/accountbelongstox/core_node/refs/heads/main"
GITEE_BASE_URL="https://gitee.com/accountbelongstox/core_node/raw/main"

# File Download Variables (relative paths)
GVAR_COMMON_FILE_RELATIVE="scripts/shells/linux/common/gvar_common.sh"
SETTING_BASE_FILE_RELATIVE="scripts/shells/linux/debian/install_shells/2_setting_base.sh"
PROJECT_VALIDATOR_FILE_RELATIVE="scripts/shells/linux/debian/install_shells/8_project_validator.sh"
PROJECT_INIT_LIB_RELATIVE="scripts/shells/linux/project_init_lib.sh"
BOOTSTRAP_RELATIVE="scripts/shells/linux/install_bootstrap.sh"

# File Download Variables (absolute paths)
GVAR_COMMON_FILE="$COMMON_SHELLS_DIR/gvar_common.sh"
SETTING_BASE_FILE="$SHELLS_DIR/linux/debian/install_shells/2_setting_base.sh"
PROJECT_VALIDATOR_FILE="$SHELLS_DIR/linux/debian/install_shells/8_project_validator.sh"

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
        curl -# -f -L -o "$dest" "$url" && [ -s "$dest" ] && return 0
    fi
    if command -v wget >/dev/null 2>&1; then
        wget --progress=bar:force -O "$dest" "$url" && [ -s "$dest" ] && return 0
    fi
    return 1
}

# Installation mode launcher: show menu, download bootstrap file, hand off to it. dd.sh does nothing else.
run_installation_mode() {
    echo ""
    echo "=========================================="
    echo "  Install and repair project"
    echo "=========================================="
    echo "  1) Install and repair project (download bootstrap, then hand off)"
    echo "  2) Exit"
    echo "=========================================="
    echo -n "Choice (1 or 2): "
    read -r choice
    if [ "$choice" != "1" ]; then
        echo "Exit."
        exit 0
    fi
    echo ""
    echo "Select download region:"
    echo "  1) Global (GitHub)"
    echo "  2) China (Gitee)"
    echo -n "Choice (1 or 2) [1]: "
    read -r region_choice
    local base_url="$GITHUB_BASE_URL"
    [ "$region_choice" = "2" ] && base_url="$GITEE_BASE_URL"
    local bootstrap_dest="$SCRIPT_ACTUAL_DIR/install_bootstrap.sh"
    local bootstrap_url="$base_url/$BOOTSTRAP_RELATIVE"
    echo "Downloading bootstrap file..."
    echo "  URL: $bootstrap_url"
    if ! download_with_progress "$bootstrap_url" "$bootstrap_dest"; then
        echo "[ERROR] Failed to download bootstrap file. Exiting."
        exit 1
    fi
    chmod +x "$bootstrap_dest"
    echo "Handing off to bootstrap; dd.sh is no longer responsible for the rest."
REPO_BASE_URL="$base_url"
    exec bash "$bootstrap_dest"
}

if [ "$IS_INSTALLATION_MODE" = true ]; then
    run_installation_mode
    exit $?
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

# =============================================================================
# Essential Functions for Standalone Operation
# =============================================================================

# Detect WSL environment
IS_WSL=false
if [ -s /proc/version ] && grep -qi microsoft /proc/version; then
    IS_WSL=true
fi

# System detection
detect_system_version() {
    if [ -s /.dockerenv ]; then
        echo "Running inside Docker container"
        SYSTEM_VERSION="Docker"
        SYSTEM_NAME="Docker"
        set_global_var "CURRENT_SYSTEM" "DOCKER" "false"
        return
    fi

    if [ ! -s /etc/os-release ]; then
        echo "Error: Cannot detect operating system (missing /etc/os-release)"
        exit 1
    fi

    . /etc/os-release
    case "$ID" in
        ubuntu)
            SYSTEM_VERSION="ubuntu_$(echo $VERSION_ID | cut -d. -f1)"
            SYSTEM_NAME="debian"
            echo -e "\033[32mUbuntu $(echo $VERSION_ID) detected - using Debian-compatible scripts\033[0m"
            set_global_var "CURRENT_SYSTEM" "UBUNTU_$(echo $VERSION_ID | cut -d. -f1)" "false"
            ;;
        debian)
            SYSTEM_VERSION="debian_$(echo $VERSION_ID | cut -d. -f1)"
            SYSTEM_NAME="debian"
            echo -e "\033[32mDebian $(echo $VERSION_ID) detected\033[0m"
            set_global_var "CURRENT_SYSTEM" "DEBIAN_$(echo $VERSION_ID | cut -d. -f1)" "false"
            ;;
        *)
            echo "Error: This script only supports Debian and Ubuntu systems"
            exit 1
            ;;
    esac
}

# Install package helper
install_package() {
    local package_name="$1"
    echo "Attempting to install $package_name..."
    if ! command -v apt-get &>/dev/null; then
        echo "Error: apt-get not found. This script only supports Debian-based systems."
        return 1
    fi
    $sudo apt-get update && $sudo apt-get install -y "$package_name"
    return $?
}

# Check and install sudo
check_and_install_sudo() {
    if [ "$EUID" -eq 0 ]; then
        sudo=""
        USE_SUDO=""
        echo "Running as root. sudo not needed."
        return
    fi

    if ! command -v sudo >/dev/null 2>&1; then
        echo "sudo not found. Attempting to install..."
        if install_package "sudo"; then
            echo "sudo installed successfully."
        else
            echo "Failed to install sudo. Commands will be run without sudo."
            sudo=""
            USE_SUDO=""
            return
        fi
    fi

    if command -v sudo >/dev/null 2>&1; then
        sudo="sudo"
        USE_SUDO="sudo"
        echo "sudo is available and will be used."
    else
        sudo=""
        USE_SUDO=""
        echo "sudo is not available. Commands will be run without sudo."
    fi
}

# Check and install git
check_and_install_git() {
    if ! command -v git &>/dev/null; then
        echo "git is not installed, attempting to install..."
        if install_package "git"; then
            echo "git installed successfully."
        else
            echo "Failed to install git. Please install it manually and try again."
            return 1
        fi
    fi
    return 0
}

# Determine global variable directory
determine_global_var_dir() {
    local default_dir="/usr/core_node/global_var"
    local wsl_users_path="/mnt/c/Users"
    
    [ -d "$wsl_users_path" ] && {
        for user_dir in "$wsl_users_path"/*; do
            [ -d "$user_dir" ] && {
                local potential_dir="$user_dir/.core_node/global_var"
                [ -d "$potential_dir" ] && {
                    echo "$potential_dir"
                    return 0
                }
            }
        done
    }
    
    echo "$default_dir"
    return 0
}

# Helper function to normalize key and get file path
_get_var_file_path() {
    local key="$1"
    # Convert key to uppercase and remove any special characters
    key=$(echo "$key" | tr '[:lower:]' '[:upper:]' | tr -cd '[:alnum:]_')
    echo "$GLOBAL_VAR_DIR/$key"
}

# Set global variable
set_global_var() {
    local key="$1"
    local val="$2"
    local print="${3:-}"

    if [[ -z "$key" ]] || [[ -z "$val" ]]; then
        echo "Error: Both key and value must be provided"
        return 1
    fi

    local file_path=$(_get_var_file_path "$key")
    
    if [ ! -d "$GLOBAL_VAR_DIR" ]; then
        $sudo mkdir -p "$GLOBAL_VAR_DIR"
    fi

    echo "$val" | $sudo tee "$file_path" >/dev/null
    if [[ $? -eq 0 ]]; then
        if [[ "$print" != "false" ]]; then
            echo "Successfully set global variable: $key -> $val"
        fi
        return 0
    else
        echo "Error: Failed to write to $file_path"
        return 1
    fi
}

# Get global variable
get_global_var() {
    local key="$1"
    local default_value="$2"

    if [[ -z "$key" ]]; then
        echo "Error: Key must be provided"
        return 1
    fi

    local file_path=$(_get_var_file_path "$key")

    if [[ -f "$file_path" ]]; then
        cat "$file_path" 2>/dev/null
        return 0
    else
        if [[ -n "$default_value" ]]; then
            echo "$default_value"
            return 0
        else
            return 1
        fi
    fi
}

# File validation
is_file_valid() {
    local file_path="$1"

    if [ ! -r "$file_path" ]; then
        echo "[WARNING] File is not readable: $file_path"
        return 1
    fi

    if [ ! -s "$file_path" ]; then
        echo "[WARNING] File is empty: $file_path"
        return 1
    fi

    local first_line=$(head -n 1 "$file_path" 2>/dev/null)
    if [[ ! "$first_line" =~ ^#! ]]; then
        echo "[WARNING] File does not start with shebang: $file_path"
        return 1
    fi

    return 0
}

# Download file
download_file() {
    local file_path="$1"
    local relative_path="$2"
    local selected_region=$(get_global_var "SELECTED_REGION" "Global")

    local base_url=""
    case "$selected_region" in
        "Global")
            base_url="$GITHUB_BASE_URL"
            ;;
        "China")
            base_url="$GITEE_BASE_URL"
            ;;
        *)
            base_url="$GITHUB_BASE_URL"
            ;;
    esac

    local download_url="$base_url/$relative_path"

    if [ ! -d "$CORE_NODE_TMP_DIR" ]; then
        $sudo mkdir -p "$CORE_NODE_TMP_DIR"
    fi

    local temp_file="$CORE_NODE_TMP_DIR/core_node_download_$(basename "$file_path").$$"

    echo "Downloading $relative_path..."
    echo "Source URL: $download_url"
    echo "Target file: $file_path"

    local download_success=false
    local download_method=""

    if command -v wget >/dev/null 2>&1; then
        echo "Attempting download with wget..."
        if wget -q -O "$temp_file" "$download_url" 2>&1; then
            if [ -s "$temp_file" ]; then
                echo "Download successful using wget"
                download_success=true
                download_method="wget"
            else
                echo "wget completed but file is empty"
                rm -f "$temp_file" 2>/dev/null
            fi
        else
            echo "wget download failed"
            rm -f "$temp_file" 2>/dev/null
        fi
    fi

    if [ "$download_success" = false ] && command -v curl >/dev/null 2>&1; then
        echo "Attempting download with curl..."
        if curl -f -s -L -o "$temp_file" "$download_url" 2>&1; then
            if [ -s "$temp_file" ]; then
                echo "Download successful using curl"
                download_success=true
                download_method="curl"
            else
                echo "curl completed but file is empty"
                rm -f "$temp_file" 2>/dev/null
            fi
        else
            echo "curl download failed"
            rm -f "$temp_file" 2>/dev/null
        fi
    fi

    if [ "$download_success" = false ]; then
        echo "[ERROR] All download methods failed"
        echo "  URL: $download_url"
        echo "  Target: $file_path"
        rm -f "$temp_file" 2>/dev/null
        return 1
    fi

    local file_size=$(stat -c%s "$temp_file" 2>/dev/null)
    echo "Downloaded successfully using $download_method ($file_size bytes)"

    local file_dir=$(dirname "$file_path")
    if [ ! -d "$file_dir" ]; then
        echo "Creating directory: $file_dir"
        if ! $sudo mkdir -p "$file_dir"; then
            echo "[ERROR] Failed to create directory: $file_dir"
            rm -f "$temp_file" 2>/dev/null
            return 1
        fi
    fi

    echo "Installing file to: $file_path"

    if $sudo mv "$temp_file" "$file_path"; then
        $sudo chmod +x "$file_path"
        echo "[SUCCESS] File installed: $file_path"
        return 0
    else
        echo "[ERROR] Failed to move file to target location"
        rm -f "$temp_file" 2>/dev/null
        return 1
    fi
}

# Show region selection menu
show_region_selection_menu() {
    echo ""
    echo "=========================================="
    echo "Select Download Region:"
    echo "=========================================="
    echo "1) Global (GitHub)"
    echo "2) China (Gitee)"
    echo "=========================================="
    echo -n "Enter your choice (1-2): "
    
    read -r choice
    case "$choice" in
        1)
            set_global_var "SELECTED_REGION" "Global" "false"
            echo "Selected region: Global (GitHub)"
            ;;
        2)
            set_global_var "SELECTED_REGION" "China" "false"
            echo "Selected region: China (Gitee)"
            ;;
        *)
            echo "Invalid choice, defaulting to Global"
            set_global_var "SELECTED_REGION" "Global" "false"
            ;;
    esac
}

# Check and download required files
check_and_download_files() {
    echo "Checking for required files..."

    local gvar_common_file="$CORE_NODE_ROOT_DIR/$GVAR_COMMON_FILE_RELATIVE"
    local setting_base_file="$CORE_NODE_ROOT_DIR/$SETTING_BASE_FILE_RELATIVE"
    local project_validator_file="$CORE_NODE_ROOT_DIR/$PROJECT_VALIDATOR_FILE_RELATIVE"

    local force_update=false
    if [ "$IS_INSTALLATION_MODE" = true ]; then
        force_update=true
        echo -e "\033[33m[INFO] Installation mode detected - will update all temporary scripts\033[0m"
    fi

    if [ "$force_update" = true ] || ! is_file_valid "$gvar_common_file"; then
        if [ "$force_update" = true ]; then
            echo "Updating gvar_common.sh to latest version..."
        else
            echo "gvar_common.sh not found or invalid, downloading..."
        fi
        if download_file "$gvar_common_file" "scripts/shells/linux/common/gvar_common.sh"; then
            echo "gvar_common.sh downloaded successfully"
        else
            echo "Failed to download gvar_common.sh"
            return 1
        fi
    else
        echo "gvar_common.sh already exists and is valid"
    fi

    if [ "$force_update" = true ] || ! is_file_valid "$setting_base_file"; then
        if [ "$force_update" = true ]; then
            echo "Updating 2_setting_base.sh to latest version..."
        else
            echo "2_setting_base.sh not found or invalid, downloading..."
        fi
        if download_file "$setting_base_file" "scripts/shells/linux/debian/install_shells/2_setting_base.sh"; then
            echo "2_setting_base.sh downloaded successfully"
        else
            echo "Failed to download 2_setting_base.sh"
            return 1
        fi
    else
        echo "2_setting_base.sh already exists and is valid"
    fi

    if [ "$force_update" = true ] || ! is_file_valid "$project_validator_file"; then
        if [ "$force_update" = true ]; then
            echo "Updating 8_project_validator.sh to latest version..."
        else
            echo "8_project_validator.sh not found or invalid, downloading..."
        fi
        if download_file "$project_validator_file" "scripts/shells/linux/debian/install_shells/8_project_validator.sh"; then
            echo "8_project_validator.sh downloaded successfully"
        else
            echo "Failed to download 8_project_validator.sh"
            return 1
        fi
    else
        echo "8_project_validator.sh already exists and is valid"
    fi

    if [ "$force_update" = true ]; then
        echo -e "\033[32mAll required files updated to latest version\033[0m"
    else
        echo "All required files are available and valid"
    fi
    return 0
}

# Placeholder functions (will be overridden if source files are available)
ensure_secret_keys_ready() { return 0; }
cleanup_behavior_cache() { return 0; }
cleanup_file_cache() { return 0; }
cleanup_directory_processing_cache() { return 0; }
process_sh_files() { return 0; }
check_directory_processing_cache() { return 1; }
set_directory_processing_cache() { return 0; }
make_sh_executable() { return 0; }
smart_permissions_fix() { return 0; }
sync_linuxenvs_to_bin() { return 0; }
initialize_menu_items() { return 0; }
show_interactive_menu() { echo "Menu system not available. Please download required files first."; return 0; }
handle_arguments() { echo "Command line mode not available. Please download required files first."; return 0; }
show_cli_help() { echo "Help not available. Please download required files first."; return 0; }

# Set GLOBAL_VAR_DIR early (before sourcing other files)
GLOBAL_VAR_DIR=$(determine_global_var_dir)

# Ensure sudo is available before ensure_dos2unix
check_and_install_sudo

# Ensure dos2unix and git are installed before loading files
ensure_dos2unix
check_and_install_git

# Source first files (constants.sh and system_functions.sh) if available
first_file_count=0
first_file_total=${#SOURCE_FIRSTFILES[@]}
for source_file in "${SOURCE_FIRSTFILES[@]}"; do
    ((first_file_count++))
    basename_file="$(basename "$source_file")"
    if [ -f "$source_file" ]; then
        sed -i 's/\r$//' "$source_file" 2>/dev/null
        source "$source_file" 2>/dev/null
        if [ $? -eq 0 ]; then
            echo "[$first_file_count/$first_file_total] $basename_file - [OK]"
        else
            echo "[$first_file_count/$first_file_total] $basename_file - [FAILED]"
        fi
    else
        echo "[$first_file_count/$first_file_total] $basename_file - [SKIPPED - not found]"
    fi
done

# Source all required files (with dos2unix processing) if available
file_count=0
file_total=${#SOURCE_FILES[@]}
for source_file in "${SOURCE_FILES[@]}"; do
    ((file_count++))
    basename_file="$(basename "$source_file")"
    if [ -f "$source_file" ]; then
        source_file_with_dos2unix "$source_file"
        if [ $? -eq 0 ]; then
            echo "[$file_count/$file_total] $basename_file - [OK]"
        else
            echo "[$file_count/$file_total] $basename_file - [FAILED]"
        fi
    else
        echo "[$file_count/$file_total] $basename_file - [SKIPPED - not found]"
    fi
done

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
                if [ $? -eq 0 ]; then
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
