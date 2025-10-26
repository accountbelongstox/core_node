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

# Directory Path Variables
CORE_NODE_ROOT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
SCRIPT_DIR="$CORE_NODE_ROOT_DIR/scripts"
SHELLS_DIR="$SCRIPT_DIR/shells"
INSTALL_DIR="$CORE_NODE_ROOT_DIR/install"
COMMON_SHELLS_DIR="$SHELLS_DIR/linux/common" 
COMMON_SCRIPTS_DIR="$SHELLS_DIR/scripts"

# Global Variable Directory (will be set after function definition)
GLOBAL_VAR_DIR=""

# Script Path Variables
script_symlink_path="/usr/local/bin/dd.sh"
script_path="$(readlink -f "$0")"

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
PROJECT_VALIDATOR_FILE="$SHELLS_DIR/linux/debian/install_shells/8_project_validator.sh"


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

# Function Definitions

# System and Environment Functions
detect_system_version() {
    if [ -f /.dockerenv ]; then
        echo "Running inside Docker container"
        SYSTEM_VERSION="Docker"
        SYSTEM_NAME="Docker"
        set_global_var "CURRENT_SYSTEM" "DOCKER"
        return
    fi

    if [ ! -f /etc/os-release ]; then
        echo "Error: Cannot detect operating system (missing /etc/os-release)"
        exit 1
    fi

    . /etc/os-release
    case "$ID" in
        ubuntu)
            SYSTEM_VERSION="ubuntu_$(echo $VERSION_ID | cut -d. -f1)"
            SYSTEM_NAME="debian"
            echo -e "\033[32mUbuntu $(echo $VERSION_ID) detected - using Debian-compatible scripts\033[0m"
            set_global_var "CURRENT_SYSTEM" "UBUNTU_$(echo $VERSION_ID | cut -d. -f1)"
            ;;
        debian)
            SYSTEM_VERSION="debian_$(echo $VERSION_ID | cut -d. -f1)"
            SYSTEM_NAME="debian"
            echo -e "\033[32mDebian $(echo $VERSION_ID) detected\033[0m"
            set_global_var "CURRENT_SYSTEM" "DEBIAN_$(echo $VERSION_ID | cut -d. -f1)"
            ;;
        *)
            echo "Error: This script only supports Debian and Ubuntu systems"
            exit 1
            ;;
    esac
}

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

check_and_install_sudo() {
    if ! command -v sudo >/dev/null 2>&1; then
        echo "sudo not found. Attempting to install..."
        if install_package "sudo"; then
            echo "sudo installed successfully."
        else
            echo "Failed to install sudo. Commands will be run without sudo."
            sudo=""
            return
        fi
    fi

    if command -v sudo >/dev/null 2>&1; then
        sudo="sudo"
        echo "sudo is available and will be used."
    else
        sudo=""
        echo "sudo is not available. Commands will be run without sudo."
    fi
}

check_and_install_dos2unix() {
    if ! command -v dos2unix &>/dev/null; then
        echo "dos2unix is not installed, attempting to install..."
        if install_package "dos2unix"; then
            echo "dos2unix installed successfully."
        else
            echo "Failed to install dos2unix. Please install it manually and try again."
            return 1
        fi
    fi
    return 0
}

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

# File-based Cache Functions
check_file_cache() {
    local file_path="$1"
    local cache_dir="$GLOBAL_VAR_DIR/file_cache"
    
    # Ensure cache directory exists
    if [ ! -d "$cache_dir" ]; then
        $sudo mkdir -p "$cache_dir"
        return 1  # No cache exists
    fi

    # Create cache key using SHA256 hash of file path to avoid conflicts
    local cache_key=$(echo "$file_path" | sha256sum | cut -d' ' -f1)
    local cache_file="$cache_dir/${cache_key}.mtime"

    if [ -f "$cache_file" ]; then
        local cached_mtime=$(cat "$cache_file" 2>/dev/null || echo "0")
        local current_mtime=$(stat -c %Y "$file_path" 2>/dev/null || echo "0")
        
        if [ "$cached_mtime" = "$current_mtime" ]; then
            return 0  # Cache hit - file hasn't changed
        else
            return 1  # Cache miss - file has changed
        fi
    fi

    return 1  # No cache
}

set_file_cache() {
    local file_path="$1"
    local cache_dir="$GLOBAL_VAR_DIR/file_cache"
    
    # Ensure cache directory exists
    if [ ! -d "$cache_dir" ]; then
        $sudo mkdir -p "$cache_dir"
    fi

    # Create cache key using SHA256 hash of file path to avoid conflicts
    local cache_key=$(echo "$file_path" | sha256sum | cut -d' ' -f1)
    local cache_file="$cache_dir/${cache_key}.mtime"
    local current_mtime=$(stat -c %Y "$file_path" 2>/dev/null || echo "0")
    
    echo "$current_mtime" | $sudo tee "$cache_file" >/dev/null 2>&1 || true
}

# Legacy behavior-based cache functions (kept for compatibility)
check_behavior_cache() {
    local behavior_name="$1"
    local cache_dir="$GLOBAL_VAR_DIR/behavior_cache"
    local cache_expiry_seconds=300  # 5 minutes
    local current_time=$(date +%s)

    # Ensure cache directory exists
    if [ ! -d "$cache_dir" ]; then
        $sudo mkdir -p "$cache_dir"
        return 1  # No cache exists
    fi

    local cache_file="$cache_dir/${behavior_name}.timestamp"

    if [ -f "$cache_file" ]; then
        local cache_timestamp=$(cat "$cache_file" 2>/dev/null || echo "0")
        local cache_age=$((current_time - cache_timestamp))

        if [ "$cache_age" -le "$cache_expiry_seconds" ]; then
            echo -e "\033[32m[CACHE HIT] Behavior '$behavior_name' cached ${cache_age}s ago, skipping execution\033[0m"
            return 0  # Cache hit
        else
            echo -e "\033[33m[CACHE EXPIRED] Behavior '$behavior_name' cache expired (${cache_age}s old)\033[0m"
            return 1  # Cache expired
        fi
    fi

    return 1  # No cache
}

set_behavior_cache() {
    local behavior_name="$1"
    local cache_dir="$GLOBAL_VAR_DIR/behavior_cache"
    local current_time=$(date +%s)

    # Ensure cache directory exists
    if [ ! -d "$cache_dir" ]; then
        $sudo mkdir -p "$cache_dir"
    fi

    local cache_file="$cache_dir/${behavior_name}.timestamp"
    echo "$current_time" | $sudo tee "$cache_file" >/dev/null 2>&1 || true
    echo -e "\033[32m[CACHE SET] Behavior '$behavior_name' cached for 5 minutes\033[0m"
}

cleanup_behavior_cache() {
    local cache_dir="$GLOBAL_VAR_DIR/behavior_cache"
    local cache_expiry_seconds=300
    local current_time=$(date +%s)
    local cleaned_files=0

    if [ ! -d "$cache_dir" ]; then
        return 0
    fi

    # Clean up expired cache files
    for cache_file in "$cache_dir"/*.timestamp; do
        if [ -f "$cache_file" ]; then
            local cache_timestamp=$(cat "$cache_file" 2>/dev/null || echo "0")
            local cache_age=$((current_time - cache_timestamp))

            if [ "$cache_age" -gt "$cache_expiry_seconds" ]; then
                $sudo rm -f "$cache_file" 2>/dev/null || true
                ((cleaned_files++))
            fi
        fi
    done

    if [ "$cleaned_files" -gt 0 ]; then
        echo -e "\033[33m[CACHE CLEANUP] Removed $cleaned_files expired behavior cache entries\033[0m"
    fi
}

cleanup_file_cache() {
    local cache_dir="$GLOBAL_VAR_DIR/file_cache"
    local cleaned_files=0

    if [ ! -d "$cache_dir" ]; then
        return 0
    fi

    # Clean up file cache entries for files that no longer exist
    # Note: With SHA256-based cache keys, we can't easily reverse the path
    # So we'll just clean up very old cache files (older than 30 days)
    local current_time=$(date +%s)
    local max_age=2592000  # 30 days in seconds

    for cache_file in "$cache_dir"/*.mtime; do
        if [ -f "$cache_file" ]; then
            local file_age=$((current_time - $(stat -c %Y "$cache_file" 2>/dev/null || echo "0")))
            
            if [ "$file_age" -gt "$max_age" ]; then
                $sudo rm -f "$cache_file" 2>/dev/null || true
                ((cleaned_files++))
            fi
        fi
    done

    if [ "$cleaned_files" -gt 0 ]; then
        echo -e "\033[33m[FILE CACHE CLEANUP] Removed $cleaned_files old file cache entries (older than 30 days)\033[0m"
    fi
}

process_sh_files() {
    local dir="$1"
    local dir_name=$(basename "$dir")

    # Start timing
    local start_time=$(date +%s.%N)

    echo -e "\033[36m[SCAN] Starting to scan directory: $dir\033[0m"
    echo -e "\033[33m[INFO] Scanning for .sh files that need conversion...\033[0m"

    # Count and collect files
    local total_files=0
    local converted_files=0
    local skipped_files=0
    local files_to_convert=()
    local files_to_skip=()

    # Find all .sh files and check cache
    while IFS= read -r -d '' file; do
        ((total_files++))
        
        # Check if file needs conversion based on cache
        if check_file_cache "$file"; then
            files_to_skip+=("$file")
            ((skipped_files++))
        else
            files_to_convert+=("$file")
        fi
    done < <(find "$dir" -type f -name "*.sh" -print0)

    local files_need_conversion=${#files_to_convert[@]}

    # Display scan results
    echo -e "\033[32m[SCAN COMPLETE] Found $total_files .sh files total\033[0m"
    echo -e "\033[33m[CONVERSION] $files_need_conversion files need conversion\033[0m"
    echo -e "\033[33m[CACHE] $skipped_files files skipped (already converted)\033[0m"

    if [ $files_need_conversion -eq 0 ]; then
        local end_time=$(date +%s.%N)
        local duration
        if command -v bc >/dev/null 2>&1; then
            duration=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
        else
            duration=$(awk "BEGIN {printf \"%.2f\", $end_time - $start_time}" 2>/dev/null || echo "0")
        fi
        echo -e "\033[32m[COMPLETE] All files are up to date! Scan completed in ${duration}s\033[0m"
        return 0
    fi

    echo -e "\033[36m[PROCESSING] Converting $files_need_conversion files...\033[0m"

    # Convert files that need conversion
    for file in "${files_to_convert[@]}"; do
        # Show progress on single line with real-time updates
        ((converted_files++))
        printf "\r\033[33m[%d/%d]\033[0m Converting: \033[35m%s\033[0m" "$converted_files" "$files_need_conversion" "$(basename "$file")"

        # Perform conversion
        local conversion_status=""
        if command -v dos2unix >/dev/null 2>&1; then
            if $sudo dos2unix "$file" >/dev/null 2>&1; then
                conversion_status="[OK] dos2unix"
            else
                $sudo sed -i 's/\r$//' "$file"
                conversion_status="[OK] sed fallback"
            fi
        else
            $sudo sed -i 's/\r$//' "$file"
            conversion_status="[OK] sed"
        fi

        # Set executable permission
        local exec_status=""
        if $sudo chmod +x "$file"; then
            exec_status="[OK] exec"
        else
            exec_status="[FAIL] exec"
        fi

        # Update the same line with final status
        printf "\r\033[33m[%d/%d]\033[0m \033[35m%s\033[0m - %s, %s" "$converted_files" "$files_need_conversion" "$(basename "$file")" "$conversion_status" "$exec_status"
        
        # Set cache for this file after successful conversion
        set_file_cache "$file"
    done

    # Add newline at the end to move to next line
    echo ""

    # Calculate and display timing
    local end_time=$(date +%s.%N)
    local duration
    if command -v bc >/dev/null 2>&1; then
        duration=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "unknown")
    else
        # Fallback calculation without bc
        duration=$(awk "BEGIN {printf \"%.2f\", $end_time - $start_time}" 2>/dev/null || echo "unknown")
    fi

    echo -e "\033[32m[COMPLETE] Conversion finished! \033[0m"
    echo -e "\033[32m  - Total files scanned: $total_files\033[0m"
    echo -e "\033[32m  - Files converted: $converted_files\033[0m"
    echo -e "\033[32m  - Files skipped (cached): $skipped_files\033[0m"
    echo -e "\033[32m  - Time taken: ${duration}s\033[0m"
}

make_sh_executable() {
    if [ -z "$CORE_NODE_ROOT_DIR" ]; then
        echo "CORE_NODE_ROOT_DIR is not specified."
        return 1
    fi
    find "$CORE_NODE_ROOT_DIR" -maxdepth 1 -type f -name "*.sh" -exec chmod +x {} \;
    if [ -d "$SCRIPT_DIR" ]; then
        find "$SCRIPT_DIR" -type f -name "*.sh" -exec chmod +x {} \;
    else
        echo "Directory $SCRIPT_DIR does not exist."
    fi
}

# File Download Functions
download_file() {
    local file_path="$1"
    local relative_path="$2"
    local selected_region=$(get_global_var "SELECTED_REGION" "Global")
    
    # Determine base URL based on region
    local base_url=""
    case "$selected_region" in
        "Global")
            base_url="$GITHUB_BASE_URL"
            ;;
        "China")
            base_url="$GITEE_BASE_URL"
            ;;
        *)
            base_url="$GITHUB_BASE_URL"  # Default to GitHub
            ;;
    esac
    
    local download_url="$base_url/$relative_path"
    local temp_file="/tmp/$(basename "$file_path")"
    
    echo "Downloading $relative_path from $base_url..."
    
    # Try to download using curl or wget
    if command -v curl >/dev/null 2>&1; then
        if curl -s -L -o "$temp_file" "$download_url"; then
            echo "Download successful using curl"
        else
            echo "Download failed using curl"
            return 1
        fi
    elif command -v wget >/dev/null 2>&1; then
        if wget -q -O "$temp_file" "$download_url"; then
            echo "Download successful using wget"
        else
            echo "Download failed using wget"
            return 1
        fi
    else
        echo "Error: Neither curl nor wget is available for downloading"
        return 1
    fi
    
    # Create directory if it doesn't exist
    local file_dir=$(dirname "$file_path")
    if [ ! -d "$file_dir" ]; then
        $sudo mkdir -p "$file_dir"
    fi
    
    # Move downloaded file to target location
    if $sudo mv "$temp_file" "$file_path"; then
        echo "File saved to: $file_path"
        chmod +x "$file_path"
        return 0
    else
        echo "Error: Failed to move downloaded file to $file_path"
        return 1
    fi
}

check_and_download_files() {
    echo "Checking for required files..."
    
    # Check gvar_common.sh
    if [ ! -f "$GVAR_COMMON_FILE" ]; then
        echo "gvar_common.sh not found, downloading..."
        if download_file "$GVAR_COMMON_FILE" "scripts/shells/linux/common/gvar_common.sh"; then
            echo "gvar_common.sh downloaded successfully"
        else
            echo "Failed to download gvar_common.sh"
            return 1
        fi
    else
        echo "gvar_common.sh already exists"
    fi
    
    # Check 8_project_validator.sh
    if [ ! -f "$PROJECT_VALIDATOR_FILE" ]; then
        echo "8_project_validator.sh not found, downloading..."
        if download_file "$PROJECT_VALIDATOR_FILE" "scripts/shells/linux/debian/install_shells/8_project_validator.sh"; then
            echo "8_project_validator.sh downloaded successfully"
        else
            echo "Failed to download 8_project_validator.sh"
            return 1
        fi
    else
        echo "8_project_validator.sh already exists"
    fi
    
    echo "All required files are available"
    return 0
}

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
            set_global_var "SELECTED_REGION" "Global"
            echo "Selected region: Global (GitHub)"
            ;;
        2)
            set_global_var "SELECTED_REGION" "China"
            echo "Selected region: China (Gitee)"
            ;;
        *)
            echo "Invalid choice, defaulting to Global"
            set_global_var "SELECTED_REGION" "Global"
            ;;
    esac
}

# Git and PM2 Functions
get_git() {
    echo "Starting SAFE git pull operation..."
    local unified_git_script="$SCRIPT_DIR/git/gitput_unified.sh"
    
    if [ -f "$unified_git_script" ]; then
        echo "Using unified git script for safe pull: $unified_git_script"
        
        # Determine target remote based on region setting
        local selected_region=$(get_global_var "SELECTED_REGION")
        local target_remote="gitee"  # default
        if [ "$selected_region" = "Global" ]; then
            target_remote="github"
        fi
        
        echo "Target remote: $target_remote (based on region: $selected_region)"
        
        # Execute safe pull using unified script
        cd "$CORE_NODE_ROOT_DIR"
        bash "$unified_git_script" --pull "$target_remote"
        
        if [ $? -eq 0 ]; then
            echo "Safe git pull operation completed successfully!"
            make_sh_executable
        else
            echo "Safe git pull operation failed. Please check the output above for resolution options."
        fi
    else
        echo "Error: Unified git script not found: $unified_git_script"
        echo "Please ensure the git scripts are properly installed"
    fi
}

restart_pm2() {
    $sudo docker exec -it pm2_nginx pm2_nginx list
    while true; do
        echo "Select an option:"
        echo "1. Show PM2 logs"
        echo "2. Restart PM2 processes"
        echo "3. Real-time pm2 DEBUG information"
        echo "4. Restart pm2 docker"
        echo "0. Exit"
        read -p "Enter your choice: " choice
        case $choice in
        1)
            while true; do
                $sudo docker exec -it pm2_nginx pm2_nginx list
                read -p "Enter the number ID to log (press Enter to skip, 0 to exit): " pm2_id
                if [ -z "$pm2_id" ]; then
                    break
                elif [ "$pm2_id" = "0" ]; then
                    echo "Exiting without logs."
                    exit 0
                else
                    $sudo docker exec -it pm2_nginx pm2_nginx logs "$pm2_id"
                fi
            done
            ;;
        2)
            while true; do
                $sudo docker exec -it pm2_nginx pm2_nginx list
                read -p "Enter the number ID to restart (press Enter to skip, 0 to exit): " pm2_id
                if [ -z "$pm2_id" ]; then
                    break
                elif [ "$pm2_id" = "0" ]; then
                    echo "Exiting without restarting."
                    exit 0
                else
                    $sudo docker exec -it pm2_nginx pm2_nginx restart "$pm2_id"
                    $sudo docker exec -it pm2_nginx pm2_nginx logs
                fi
            done
            ;;
        3)
            $sudo docker exec -it pm2_nginx pm2_nginx logs
            ;;
        4)
            $sudo docker restart pm2_nginx
            $sudo docker exec -it pm2_nginx pm2_nginx list
            ;;
        0)
            echo "Exiting."
            exit 0
            ;;
        *)
            echo "Invalid option. Please try again."
            ;;
        esac
    done
}

# Installation Functions
run_install_script() {
    local SCRIPT_NAME="$1"

    if [[ -z "$SCRIPT_NAME" ]]; then
        echo "Error: No script name provided."
        return
    fi

    if [[ -f /etc/os-release ]]; then
        . /etc/os-release

        echo "Linux Distribution $ID"

        INSTALL_SCRIPT="$SHELLS_DIR/$SYSTEM_NAME/$SCRIPT_NAME"

        if [[ -f "$INSTALL_SCRIPT" ]]; then
            echo "Running install script: $INSTALL_SCRIPT"
            bash "$INSTALL_SCRIPT"
        else
            echo "Error: Install script not found for $SCRIPT_VERSION: $SCRIPT_NAME ( $INSTALL_SCRIPT )."
        fi
    elif [[ -f /etc/redhat-release ]]; then
        if grep -q "CentOS" /etc/redhat-release; then
            VERSION=$(awk '{print $3}' /etc/redhat-release | cut -d. -f1)
            SCRIPT_VERSION="centos_$VERSION"
            CORE_NODE_ROOT_DIR="$PWD/apps/deploy/shells"
            INSTALL_SCRIPT="$CORE_NODE_ROOT_DIR/$SYSTEM_VERSION/$SCRIPT_NAME"

            if [[ -f "$INSTALL_SCRIPT" ]]; then
                echo "Running install script: $INSTALL_SCRIPT"
                bash "$INSTALL_SCRIPT"
            else
                echo "Error: Install script not found for $SCRIPT_VERSION: $SCRIPT_NAME."
            fi
        fi
    elif [[ -f /etc/lsb-release ]]; then
        . /etc/lsb-release
        VERSION=$(echo "$DISTRIB_RELEASE" | cut -d. -f1)
        SCRIPT_VERSION="ubuntu_$VERSION"
        CORE_NODE_ROOT_DIR="$PWD/apps/deploy/shells"
        INSTALL_SCRIPT="$CORE_NODE_ROOT_DIR/$SYSTEM_VERSION/$SCRIPT_NAME"

        if [[ -f "$INSTALL_SCRIPT" ]]; then
            echo "Running install script: $INSTALL_SCRIPT"
            bash "$INSTALL_SCRIPT"
        else
            echo "Error: Install script not found for $SCRIPT_VERSION: $SCRIPT_NAME."
        fi
    else
        echo "Unsupported or unknown Linux distribution."
    fi
}

# Global Variable Functions
get_global_var() {
    local key="$1"
    local file_path="$GLOBAL_VAR_DIR/$key"
    if [ -f "$file_path" ]; then
        # Convert file to UTF-8 and remove any null bytes or invalid characters
        local value
        value=$(iconv -f utf-8 -t utf-8 -c "$file_path" 2>/dev/null | tr -d '\0' | head -n 1)
        if [ -n "$value" ]; then
            echo "$value"
        fi
    fi
}

set_global_var() {
    local key="$1"
    local value="$2"
    if [ ! -d "$GLOBAL_VAR_DIR" ]; then
        $sudo mkdir -p "$GLOBAL_VAR_DIR"
    fi
    # Ensure UTF-8 encoding and remove any null bytes when writing
    echo "$value" | iconv -f utf-8 -t utf-8 -c | tr -d '\0' | $sudo tee "$GLOBAL_VAR_DIR/$key" >/dev/null
}

# Menu Functions
show_special_software_env_menu() {
    local special_env_manager_script="$SHELLS_DIR/linux/menu_itemshells/special_software_env_manager.sh"

    if [ -f "$special_env_manager_script" ]; then
        echo "Launching Special Software Environment Variables Manager..."
        # Source the script to allow it to modify the current environment
        . "$special_env_manager_script"
    else
        echo "Error: special_software_env_manager.sh script not found at: $special_env_manager_script"
        echo "Please check if the special software environment manager is properly installed"
        echo "Press Enter to continue..."
        read
    fi
}

initialize_menu_items() {
    menu_items["Install and Test Environment"]="text=Install and Test Environment;values=default;current=0;key=INSTALL_TEST_MENU;action=show_install_test_menu"
    menu_order+=("Install and Test Environment")

    menu_items["Enable Router Forwarding"]="text=Enable Router Forwarding;values=default;current=0;key=ROUTER_FORWARD_MENU;action=enable_router_forwarding"
    menu_order+=("Enable Router Forwarding")

    menu_items["Get the latest git version"]="text=Get the latest git version;values=default;current=0;key=GIT_UPDATE_TYPE;action=get_git"
    menu_order+=("Get the latest git version")

    menu_items["System Information & Variables"]="text=System Information & Variables;values=default;current=0;key=SYSTEM_INFO_MENU;action=show_system_info_menu"
    menu_order+=("System Information & Variables")

    menu_items["Unified App Manager"]="text=Unified App Manager;values=default;current=0;key=UNIFIED_MANAGER_TYPE;action=unified_manager"
    menu_order+=("Unified App Manager")

    menu_items["Set Special Software Environment Variables (like AI)"]="text=Set Special Software Environment Variables (like AI);values=default;current=0;key=SPECIAL_ENV_MENU;action=show_special_software_env_menu"
    menu_order+=("Set Special Software Environment Variables (like AI)")

    menu_items["Push to git"]="text=Push to git;values=all,gitee,github,local;current=0;key=GIT_PUSH_TARGET;action=push_git"
    menu_order+=("Push to git")

    menu_items["Exit"]="text=Exit;values=default;current=0;key=EXIT_TYPE;action=exit_script"
    menu_order+=("Exit")

    load_saved_values
}

load_saved_values() {
    for key in "${menu_order[@]}"; do
        local item="${menu_items[$key]}"
        local var_key=$(echo "$item" | grep -o 'key=[^;]*' | cut -d= -f2)
        local saved_value=$(get_global_var "$var_key")
        if [ -n "$saved_value" ]; then
            local values=($(echo "$item" | grep -o 'values=[^;]*' | cut -d= -f2 | tr ',' ' '))
            for i in "${!values[@]}"; do
                if [ "${values[$i]}" = "$saved_value" ]; then
                    menu_items[$key]=$(echo "$item" | sed "s/current=[0-9]*/current=$i/")
                    break
                fi
            done
        fi
    done
}

handle_menu_action() {
    local action="$1"
    local value="$2"
    local key="$3"

    set_global_var "$key" "$value"

    case "$action" in
        "enable_router_forwarding")
            echo "Enabling router forwarding mode..."
            local router_script="$SHELLS_DIR/linux/debian/install_shells/101_lnxrouter.sh"
            if [ -f "$router_script" ]; then
                bash "$router_script"
            else
                echo "Error: Router forwarding script not found at $router_script"
                echo "Please ensure the script exists and try again."
            fi
            ;;
        "show_install_test_menu")
            echo "Opening Install and Test Environment menu..."
            local install_test_menu_script="$COMMON_SHELLS_DIR/install_test_menu.sh"
            if [ -f "$install_test_menu_script" ]; then
                bash "$install_test_menu_script"
            else
                echo "Error: install_test_menu.sh script not found at $install_test_menu_script"
                echo "Please ensure the script exists and try again."
            fi
            ;;
        "get_git")
            get_git
            ;;
        "show_system_info_menu")
            echo "Opening System Information & Variables menu..."
            local system_info_script="$SHELLS_DIR/linux/menu_itemshells/system_info_display.sh"
            if [ -f "$system_info_script" ]; then
                bash "$system_info_script"
            else
                echo "Error: system_info_display.sh script not found at $system_info_script"
                echo "Please ensure the script exists and try again."
            fi
            ;;
        "show_special_software_env_menu")
            show_special_software_env_menu
            ;;
        "unified_manager")
            local unified_manager_script="$SCRIPT_DIR/unified_manager/unified_manager.sh"
            if [ -x "$unified_manager_script" ]; then
                bash "$unified_manager_script"
            else
                echo "Error: unified_manager.sh script not found at $unified_manager_script"
                echo "Please ensure the Unified Manager script is properly installed"
            fi
            echo ""
            echo "Press Enter to continue..."
            read
            ;;
        "push_git")
            echo "Starting Git Push Operations..."
            echo "Target: $value"

            local git_script="$SCRIPT_DIR/git/gitput_unified.sh"
            if [ -f "$git_script" ]; then
                echo "Using unified git push script: $git_script"
                cd "$CORE_NODE_ROOT_DIR"
                if [ "$value" = "all" ]; then
                    bash "$git_script"
                else
                    bash "$git_script" "$value"
                fi

                if [ $? -eq 0 ]; then
                    echo "Git push operations completed successfully"
                else
                    echo "Git push operations failed"
                fi
            else
                echo "Error: Unified git script not found: $git_script"
                echo "Please ensure the git scripts are properly installed"
            fi
            echo ""
            echo "Press Enter to continue..."
            read
            ;;
        "exit_script")
            echo "Exiting the script."
            exit 0
        ;;
    esac
}

show_interactive_menu() {
    local selected=0
    local total=${#menu_order[@]}
    
    # Save current terminal settings
    local old_settings=$(stty -g)
    # Configure terminal for single character input while preserving formatting
    stty -icanon -echo

    # Ensure terminal settings are restored on any exit
    trap 'stty "$old_settings"; exit' EXIT
    
    while true; do
        # Clear screen and show header
        printf "\033c"  # Clear screen more reliably
        local current_sys=$(get_global_var "CURRENT_SYSTEM" "$SYSTEM_VERSION")
        printf "Current system: %s\n" "$current_sys"
        printf "Select an option (Up/Down to move, Left/Right to change value, Enter to select):\n"
        printf "Press Ctrl+C to exit\n\n"

        # Display menu items with proper alignment
        for i in "${!menu_order[@]}"; do
            local key="${menu_order[$i]}"
            local item="${menu_items[$key]}"
            local text=$(echo "$item" | grep -o 'text=[^;]*' | cut -d= -f2)
            local values=($(echo "$item" | grep -o 'values=[^;]*' | cut -d= -f2 | tr ',' ' '))
            local current=$(echo "$item" | grep -o 'current=[0-9]*' | cut -d= -f2)
            
            # Only show [value] if there's more than one option or if the only option is not "default"
            local value_display=""
            if [ ${#values[@]} -gt 1 ] || [ "${values[$current]}" != "default" ]; then
                value_display=" [${values[$current]}]"
            fi
            
            if [ "$i" -eq "$selected" ]; then
                printf "\033[47m\033[30m>%-40s%s\033[0m\n" " $text" "$value_display"
            else
                printf " %-40s%s\n" " $text" "$value_display"
            fi
        done

        # Read a single character
        local char
        char=$(dd bs=1 count=1 2>/dev/null)

        case "$char" in
            $'\x1B')  # ESC sequence
                read -r -t 0.1 -d '' seq
                case "$seq" in
                    '[A')  # Up arrow
                        ((selected--))
                        [ "$selected" -lt 0 ] && selected=$((total - 1))
                        ;;
                    '[B')  # Down arrow
                        ((selected++))
                        [ "$selected" -ge "$total" ] && selected=0
                        ;;
                    '[C'|'[D')  # Right/Left arrow
                        local key="${menu_order[$selected]}"
                        local item="${menu_items[$key]}"
                        local values=($(echo "$item" | grep -o 'values=[^;]*' | cut -d= -f2 | tr ',' ' '))
                        local current=$(echo "$item" | grep -o 'current=[0-9]*' | cut -d= -f2)
                        local total_values=${#values[@]}
                        local var_key=$(echo "$item" | grep -o 'key=[^;]*' | cut -d= -f2)
                        local action=$(echo "$item" | grep -o 'action=[^;]*' | cut -d= -f2)
                        
                        if [ "$seq" = '[C' ]; then  # Right arrow
                            ((current++))
                            [ "$current" -ge "$total_values" ] && current=0
                        else  # Left arrow
                            ((current--))
                            [ "$current" -lt 0 ] && current=$((total_values - 1))
                        fi
                        
                        # Update menu item with new current value
                        menu_items[$key]=$(echo "$item" | sed "s/current=[0-9]*/current=$current/")
                        
                        # Immediately save the new value to global variable
                        set_global_var "$var_key" "${values[$current]}"
                        
                        # Execute the action immediately if needed
                        case "$action" in
                            "set_region")
                                # Special handling for region change
                                echo "Region changed to: ${values[$current]}"
                                ;;
                            "set_cloud_provider")
                                echo "Cloud Provider changed to: ${values[$current]}"
                                ;;
                            *)
                                # Other actions can be added here if needed
                                ;;
                        esac
                        ;;
                esac
                ;;
            '')  # Enter key
                local key="${menu_order[$selected]}"
                local item="${menu_items[$key]}"
                local values=($(echo "$item" | grep -o 'values=[^;]*' | cut -d= -f2 | tr ',' ' '))
                local current=$(echo "$item" | grep -o 'current=[0-9]*' | cut -d= -f2)
                local action=$(echo "$item" | grep -o 'action=[^;]*' | cut -d= -f2)
                local var_key=$(echo "$item" | grep -o 'key=[^;]*' | cut -d= -f2)

                # Restore terminal settings before executing action
                stty "$old_settings"
                printf "\033c"

                handle_menu_action "$action" "${values[$current]}" "$var_key"

                echo
                echo "Press 'q' to quit, any other key to continue..."
                read -n 1 key
                if [ "$key" = "q" ]; then
                    exit 0
                fi

                # Restore terminal settings for menu navigation
                stty -icanon -echo
                ;;
        esac
    done
}

# Function to determine global variable directory
determine_global_var_dir() {
    local default_dir="/usr/core_node/global_var"
    local wsl_users_path="/mnt/c/Users"
    
    # Check if WSL Windows users path exists
    if [ -d "$wsl_users_path" ]; then
        # Loop through each user directory
        for user_dir in "$wsl_users_path"/*; do
            if [ -d "$user_dir" ]; then
                local potential_dir="$user_dir/.core_node/global_var"
                
                # Check if the .core_node/global_var directory exists
                if [ -d "$potential_dir" ]; then
                    echo "$potential_dir"
                    return 0
                fi
            fi
        done
    fi
    
    # Fallback to default directory
    echo "$default_dir"
    return 0
}

# Set GLOBAL_VAR_DIR using the determine_global_var_dir function
GLOBAL_VAR_DIR=$(determine_global_var_dir)

# Main Execution
main() {
    # Display initial information
    echo "CORE_NODE_ROOT_DIR:" $CORE_NODE_ROOT_DIR
    echo "SHELLS_DIR:        " $SHELLS_DIR

    # Initialize system
    check_and_install_sudo
    ensure_dos2unix

    # Check and download required files
    echo -e "\033[36m[FILE CHECK] Checking for required files...\033[0m"
    
    # Check if required files exist, if not show region selection menu
    if [ ! -f "$GVAR_COMMON_FILE" ] || [ ! -f "$PROJECT_VALIDATOR_FILE" ]; then
        show_region_selection_menu
    fi
    
    # Download missing files
    if ! check_and_download_files; then
        echo -e "\033[31m[ERROR] Failed to download required files. Exiting.\033[0m"
        exit 1
    fi

    # Clean up expired behavior cache
    cleanup_behavior_cache
    # Clean up orphaned file cache entries
    cleanup_file_cache

    # Process shell files
    echo -e "\033[36m[FILE PROCESSING] Starting scan and conversion of .sh files\033[0m"
    
    local total_dirs=0
    local processed_dirs=0
    local overall_start_time=$(date +%s.%N)
    
    # Count total directories to process
    for dir in "${target_dirs[@]}"; do
        local absolute_dir="$CORE_NODE_ROOT_DIR/$dir"
        if [ -d "$absolute_dir" ]; then
            ((total_dirs++))
        fi
    done
    
    echo -e "\033[33m[INFO] Found $total_dirs directories to scan: ${target_dirs[*]}\033[0m"
    echo
    
    for dir in "${target_dirs[@]}"; do
        # Convert to absolute path by joining with CORE_NODE_ROOT_DIR
        local absolute_dir="$CORE_NODE_ROOT_DIR/$dir"
        if [ -d "$absolute_dir" ]; then
            ((processed_dirs++))
            echo -e "\033[36m[DIR $processed_dirs/$total_dirs] Processing directory: $dir\033[0m"
            process_sh_files "$absolute_dir"
            echo
        else
            echo -e "\033[31m[WARNING] Directory '$absolute_dir' not found. Skipping.\033[0m"
        fi
    done
    
    # Calculate overall timing
    local overall_end_time=$(date +%s.%N)
    local overall_duration
    if command -v bc >/dev/null 2>&1; then
        overall_duration=$(echo "$overall_end_time - $overall_start_time" | bc -l)
    else
        # Fallback calculation without bc
        overall_duration=$(awk "BEGIN {printf \"%.2f\", $overall_end_time - $overall_start_time}")
    fi
    
    echo -e "\033[32m[COMPLETE] All .sh files processed!\033[0m"
    echo -e "\033[32m  - Directories processed: $processed_dirs/$total_dirs\033[0m"
    echo -e "\033[32m  - Total processing time: ${overall_duration}s\033[0m"

    # Create and initialize global variable directory
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

    # Make shell files executable
    echo "Script is executed from: $CORE_NODE_ROOT_DIR"
    make_sh_executable

    # Validate project location using 8_project_validator.sh
    echo -e "\033[36m[PROJECT VALIDATION] Running project validation...\033[0m"
    if [ -f "$PROJECT_VALIDATOR_FILE" ]; then
        bash "$PROJECT_VALIDATOR_FILE"
        if [ $? -eq 0 ]; then
            echo -e "\033[32m[PROJECT VALIDATION] Project validation completed successfully\033[0m"
        else
            echo -e "\033[33m[PROJECT VALIDATION] Project validation completed with warnings\033[0m"
        fi
    else
        echo -e "\033[31m[PROJECT VALIDATION] 8_project_validator.sh not found at: $PROJECT_VALIDATOR_FILE\033[0m"
    fi

    # Update CORE_NODE_ROOT_DIR if running from symlink
    if [ -L "$0" ] && [ "$0" -ef "$script_symlink_path" ]; then
        original_source="$(readlink -f "$script_path")"
        CORE_NODE_ROOT_DIR="$(dirname "$original_source")"
        echo "Updating CORE_NODE_ROOT_DIR to: $CORE_NODE_ROOT_DIR"
    fi

    # Ensure dos2unix is installed
    if ! command -v dos2unix &>/dev/null; then
        check_and_install_dos2unix
    fi

    # Create symlink if needed (skip if running from /usr/tmp)
    if [[ "$script_path" != "/usr/tmp/dd.sh" ]]; then
        if [ -e "$script_symlink_path" ]; then
            if [ ! -L "$script_symlink_path" ] || [ "$(readlink -f "$script_symlink_path")" != "$script_path" ]; then
                echo "Removing existing $script_symlink_path as it is not a symlink to the current script."
                $sudo rm -f "$script_symlink_path"
            fi
        fi

        if [ ! -e "$script_symlink_path" ]; then
            $sudo ln -s "$script_path" "$script_symlink_path"
            echo "Symbolic link created: $script_symlink_path -> $script_path"
            chmod +x "$script_symlink_path"
        fi
    else
        echo "Skipping symlink creation - running from temporary location: $script_path"
    fi

    # Initialize and show menu
    detect_system_version
    initialize_menu_items
    show_interactive_menu
}

# Print colored text: $1=color (yellow/red/green), $2=message
print_color() {
    local color="$1"
    local message="$2"
    local code=""
    case "$color" in
        yellow) code='\033[33m' ;;
        red)    code='\033[31m' ;;
        green)  code='\033[32m' ;;
        *)      code='' ;;
    esac
    echo -e "${code}${message}\033[0m"
}

# Function to handle command line arguments
handle_arguments() {
    local resource_limiter="$SCRIPT_DIR/unified_manager/common/resource_limiter.sh"

    if [ $# -eq 0 ]; then
        # No arguments, run interactive menu
        main
        return
    fi

    echo "[INFO] DD.sh Command Line Mode"
    echo "[INFO] Arguments: $*"
    echo ""

    # Check if resource limiter is available
    if [ ! -f "$resource_limiter" ]; then
        echo "[ERROR] Resource limiter not found: $resource_limiter"
        echo "[INFO] Running commands without resource limits"
        resource_limiter=""
    else
        echo "[INFO] Resource limiter available: $resource_limiter"
        # Source the resource limiter functions
        source "$resource_limiter"
        # Show detected method
        local detected_method=$(detect_resource_method)
        echo "[INFO] Resource limiting method: $detected_method"
    fi

    # Process each argument as a command
    local command_count=0
    for arg in "$@"; do
        command_count=$((command_count + 1))
        echo ""
        echo "=========================================="
        echo "[INFO] Executing command $command_count: $arg"
        echo "=========================================="

        if [ -n "$resource_limiter" ]; then
            # Run with resource limits (20% CPU, calculated memory)
            echo "[INFO] Running with resource limits (CPU: 20%, Memory: calculated based on system)"
            run_with_limits "20" "" "$arg"
            local exit_code=$?
        else
            # Run without resource limits
            echo "[WARNING] Running without resource limits"
            eval "$arg"
            local exit_code=$?
        fi

        if [ $exit_code -eq 0 ]; then
            echo "[SUCCESS] Command $command_count completed successfully"
        else
            echo "[ERROR] Command $command_count failed with exit code: $exit_code"
        fi
    done

    echo ""
    echo "=========================================="
    echo "[INFO] All commands processed"
    echo "=========================================="
}

# Function to show command line help
show_cli_help() {
    cat << 'EOF'
DD.sh - Core Node Development Environment Manager

Usage:
  dd.sh                    # Interactive menu mode
  dd.sh COMMAND [ARGS...]  # Command line mode with resource limits
  dd.sh --help            # Show this help

Command Line Mode:
  - Each argument is treated as a separate command
  - Commands are executed sequentially with resource limits
  - Resource limits: CPU 20%, Memory calculated (200M-1G based on system RAM)
  - Uses systemd-run for resource control

Examples:
  dd.sh "node app.js"
  dd.sh "python script.py" "node server.js"
  dd.sh "bash /path/to/script.sh arg1 arg2"

Interactive Mode:
  - Run without arguments to access the full menu system
  - Provides access to all DD.sh features and tools

Resource Management:
  - Commands are automatically limited to 20% CPU and calculated memory
  - Memory limits: 200M (≤2GB RAM), 300M (2-4GB), 500M (4-8GB), 1G (>8GB)
  - Auto-detects best resource limiting method available
  - Supported methods: systemd-run, cgroup, cpulimit, ulimit
  - Generates temporary scripts in /tmp/.core_node/dd_scripts/
  - Automatic dependency installation and cleanup

EOF
}

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
