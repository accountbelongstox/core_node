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

# Detect environment type
IS_WSL=false
IS_PRODUCTION=false
HAS_DESKTOP_ENVIRONMENT=false
DESKTOP_ENVIRONMENT=""
WSL_USERS_PATH="/mnt/c/Users"
WSL_D_DRIVE="/mnt/d/programing/core_node"

# Check if running in WSL
if [ -d "$WSL_USERS_PATH" ] || [ -d "$WSL_D_DRIVE" ]; then
    IS_WSL=true
elif [ -d "/www/wwwroot" ]; then
    IS_PRODUCTION=true
fi

# Function to detect desktop environment
detect_desktop_environment() {
    # Check for X11 session
    if [ -n "$DISPLAY" ] && [ "$DISPLAY" != ":0" ]; then
        HAS_DESKTOP_ENVIRONMENT=true
    fi
    
    # Check for Wayland session
    if [ -n "$WAYLAND_DISPLAY" ]; then
        HAS_DESKTOP_ENVIRONMENT=true
    fi
    
    # Check for common desktop environment variables
    if [ -n "$XDG_CURRENT_DESKTOP" ]; then
        HAS_DESKTOP_ENVIRONMENT=true
        DESKTOP_ENVIRONMENT="$XDG_CURRENT_DESKTOP"
    elif [ -n "$DESKTOP_SESSION" ]; then
        HAS_DESKTOP_ENVIRONMENT=true
        DESKTOP_ENVIRONMENT="$DESKTOP_SESSION"
    fi
    
    # Check for running desktop processes
    if pgrep -x "gnome-session\|kde-session\|xfce4-session\|mate-session\|cinnamon-session\|lxde-session\|lxqt-session\|openbox\|fluxbox\|i3\|awesome\|dwm" >/dev/null 2>&1; then
        HAS_DESKTOP_ENVIRONMENT=true
    fi
    
    # Check for desktop environment directories
    if [ -d "/usr/share/xsessions" ] || [ -d "/usr/share/wayland-sessions" ]; then
        # Additional check: see if we're in a graphical session
        if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; then
            HAS_DESKTOP_ENVIRONMENT=true
        fi
    fi
    
    # Check for WSL with desktop environment
    if [ "$IS_WSL" = true ]; then
        # In WSL, check if X11 forwarding is available or if WSLg is running
        if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ] || pgrep -x "wslg" >/dev/null 2>&1; then
            HAS_DESKTOP_ENVIRONMENT=true
        fi
    fi
}

# Detect desktop environment
detect_desktop_environment

# Determine CORE_NODE_DATA_DIR based on environment
CORE_NODE_DATA_DIR="/usr/.core_node"

# Check if WSL Windows users path exists
if [ -d "$WSL_USERS_PATH" ]; then
    # Loop through each user directory
    for user_dir in "$WSL_USERS_PATH"/*; do
        if [ -d "$user_dir" ]; then
            potential_dir="$user_dir/.core_node"

            # Check if the .core_node directory exists
            if [ -d "$potential_dir" ]; then
                CORE_NODE_DATA_DIR="$potential_dir"
                break
            fi
        fi
    done
fi

GLOBAL_VAR_DIR="$CORE_NODE_DATA_DIR/global_var"

# Function to map Linux paths to appropriate paths based on environment
# In WSL, check if Windows directories exist first; if they exist, use them
# If Windows directories don't exist, use Linux paths (will be created there)
# In Production, use standard Linux paths
map_web_path() {
    local linux_path="$1"
    local mapped_path="$linux_path"

    if [ "$IS_WSL" = true ]; then
        # Map web server paths to Windows directories in WSL
        case "$linux_path" in
            /www/wwwroot*)
                # Check if D:\wwwroot\ exists in WSL (not D:\www\wwwroot\)
                if [ -d "/mnt/d/wwwroot" ]; then
                    mapped_path="/mnt/d/wwwroot${linux_path#/www/wwwroot}"
                else
                    # Use Linux path if Windows directory doesn't exist
                    mapped_path="$linux_path"
                fi
                ;;
            /www/nginxconfig*)
                # Check if D:\nginxconfig\ exists in WSL
                if [ -d "/mnt/d/nginxconfig" ]; then
                    mapped_path="/mnt/d/nginxconfig${linux_path#/www/nginxconfig}"
                else
                    mapped_path="$linux_path"
                fi
                ;;
            /www/shared-data*)
                # Check if D:\shared-data\ exists in WSL
                if [ -d "/mnt/d/shared-data" ]; then
                    mapped_path="/mnt/d/shared-data${linux_path#/www/shared-data}"
                else
                    mapped_path="$linux_path"
                fi
                ;;
            /www/backup*)
                # Check if D:\backup\ exists in WSL
                if [ -d "/mnt/d/backup" ]; then
                    mapped_path="/mnt/d/backup${linux_path#/www/backup}"
                else
                    mapped_path="$linux_path"
                fi
                ;;
            /www/dev_*)
                # Check if D:\www\ parent exists in WSL
                if [ -d "/mnt/d/www" ]; then
                    mapped_path="/mnt/d${linux_path}"
                else
                    mapped_path="$linux_path"
                fi
                ;;
            /etc/nginx*)
                # Keep /etc/nginx in Linux filesystem even in WSL
                # (system configuration should stay in Linux)
                mapped_path="$linux_path"
                ;;
            /etc/php*)
                # Keep /etc/php in Linux filesystem even in WSL
                mapped_path="$linux_path"
                ;;
            /var/log*)
                # Keep logs in Linux filesystem even in WSL
                mapped_path="$linux_path"
                ;;
            *)
                # Default: no mapping
                mapped_path="$linux_path"
                ;;
        esac
    fi

    echo "$mapped_path"
    return 0
}

# Function to ensure directory exists with proper permissions
ensure_web_directory() {
    local linux_path="$1"
    local permissions="${2:-755}"
    local owner="${3:-www-data:www-data}"

    # Map to appropriate path
    local actual_path=$(map_web_path "$linux_path")

    # Create directory if it doesn't exist
    if [ ! -d "$actual_path" ]; then
        echo "Creating directory: $actual_path (mapped from $linux_path)"
        $USE_SUDO mkdir -p "$actual_path"
    fi

    # Set permissions
    $USE_SUDO chmod "$permissions" "$actual_path" 2>/dev/null || true

    # Set owner (only if not in WSL, Windows filesystem doesn't support chown)
    if [ "$IS_WSL" = false ]; then
        $USE_SUDO chown "$owner" "$actual_path" 2>/dev/null || true
    fi

    echo "$actual_path"
    return 0
}

# Function to determine and create COMPILE_DIR based on OS and version
determine_compile_dir() {
    local os_id=""
    local version_id=""
    
    # Try to get OS information from /etc/os-release
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        os_id=$(echo "$ID" | tr '[:upper:]' '[:lower:]')
        version_id=$(echo "$VERSION_ID" | cut -d. -f1)
    fi
    
    # Fallback detection methods
    if [ -z "$os_id" ]; then
        if command -v lsb_release >/dev/null 2>&1; then
            os_id=$(lsb_release -si | tr '[:upper:]' '[:lower:]')
            version_id=$(lsb_release -sr | cut -d. -f1)
        elif [ -f /etc/debian_version ]; then
            os_id="debian"
            version_id=$(cat /etc/debian_version | cut -d. -f1)
        elif [ -f /etc/ubuntu_version ]; then
            os_id="ubuntu"
            version_id=$(cat /etc/ubuntu_version | cut -d. -f1)
        else
            os_id="linux"
            version_id="unknown"
        fi
    fi
    
    # Clean up os_id and version_id
    os_id=$(echo "$os_id" | sed 's/[^a-z0-9]//g')
    version_id=$(echo "$version_id" | sed 's/[^0-9]//g')
    
    # Create compile directory path
    local compile_dir="/www/dev_${os_id}${version_id}"

    # Map to Windows path if in WSL
    compile_dir=$(map_web_path "$compile_dir")

    echo "$compile_dir"
    return 0
}

# Function to ensure COMPILE_DIR exists
ensure_compile_dir() {
    local compile_dir="$1"
    
    if [ ! -d "$compile_dir" ]; then
        echo "Creating COMPILE_DIR: $compile_dir"
        sudo mkdir -p "$compile_dir"
        sudo chmod 755 "$compile_dir"
    fi
    
    echo "COMPILE_DIR: $compile_dir"
    return 0
}

COMPILE_DIR=$(determine_compile_dir)
ensure_compile_dir "$COMPILE_DIR"

# Check and set sudo
if command -v sudo >/dev/null 2>&1; then
    USE_SUDO="sudo"
else
    USE_SUDO=""
fi

# Initialize global temporary directory
GLOBAL_TEMP_DIR="/var/tmp/core_node"

# Ensure global temporary directory exists
if [ ! -d "$GLOBAL_TEMP_DIR" ]; then
    echo "Creating global temporary directory: $GLOBAL_TEMP_DIR"
    $USE_SUDO mkdir -p "$GLOBAL_TEMP_DIR"
    $USE_SUDO chmod 755 "$GLOBAL_TEMP_DIR"
fi
echo "Global temporary directory: $GLOBAL_TEMP_DIR"

# Function to create script-specific temporary directory
create_script_temp_dir() {
    local script_name="$1"
    local script_temp_dir="$GLOBAL_TEMP_DIR/$script_name"
    
    if [ ! -d "$script_temp_dir" ]; then
        $USE_SUDO mkdir -p "$script_temp_dir"
        $USE_SUDO chmod 755 "$script_temp_dir"
    fi
    
    echo "$script_temp_dir"
    return 0
}

# Function to clean up script-specific temporary directory
cleanup_script_temp_dir() {
    local script_name="$1"
    local script_temp_dir="$GLOBAL_TEMP_DIR/$script_name"
    
    if [ -d "$script_temp_dir" ]; then
        echo "Cleaning up temporary directory: $script_temp_dir"
        $USE_SUDO rm -rf "$script_temp_dir"
    fi
}

# Ensure the global variable directory exists
if [ ! -d "$GLOBAL_VAR_DIR" ]; then
    $USE_SUDO mkdir -p "$GLOBAL_VAR_DIR" 2>/dev/null || mkdir -p "$GLOBAL_VAR_DIR" 2>/dev/null || true
    echo "Created global variable directory: $GLOBAL_VAR_DIR"
fi

# Set IS_GLOBAL based on SELECTED_REGION
set_is_global() {
    local selected_region=$(get_global_var "SELECTED_REGION" "Global")
    if [ "$selected_region" = "Global" ]; then
        IS_GLOBAL="true"
    else
        IS_GLOBAL="false"
    fi
}

# Helper function to normalize key and get file path
_get_var_file_path() {
    local key="$1"
    # Convert key to uppercase and remove any special characters
    key=$(echo "$key" | tr '[:lower:]' '[:upper:]' | tr -cd '[:alnum:]_')
    echo "$GLOBAL_VAR_DIR/$key"
}

# Function to store path in global variables
store_path() {
    local name=$1
    local path=$2
    if [[ -n "$path" ]]; then
        set_var "${name}_path" "$path"
        echo "${name} path stored: $path"
    else
        echo "Warning: Could not find ${name} path"
    fi
}

# Function to set global variable in file
set_global_var() {
    local key="$1"
    local val="$2"
    local print="$3"

    # Check if parameters are provided
    if [[ -z "$key" ]] || [[ -z "$val" ]]; then
        echo "Error: Both key and value must be provided"
        echo "Usage: set_global_var <key> <value>"
        return 1
    fi

    # Get normalized file path
    local file_path=$(_get_var_file_path "$key")

    # Write value to file
    echo "$val" | $USE_SUDO tee "$file_path" >/dev/null
    if [[ $? -eq 0 ]]; then
        if [[ "$print" == "false" ]]; then
            echo "Successfully set global variable: $key -> $val"
        fi
        return 0
    else
        echo "Error: Failed to write to $file_path"
        return 1
    fi
}

# Function to get global variable from file
get_global_var() {
    local key="$1"
    local default_value="$2"

    # Check if key is provided
    if [[ -z "$key" ]]; then
        echo "Error: Key must be provided"
        echo "Usage: get_global_var <key> [default_value]"
        return 1
    fi

    # Get normalized file path
    local file_path=$(_get_var_file_path "$key")

    # Check if file exists
    if [[ ! -f "$file_path" ]]; then
        # Return default value if provided, otherwise return empty string
        echo "${default_value:-}"
        return 0
    fi

    # Read and return the value
    local val=$($USE_SUDO cat "$file_path" 2>/dev/null)
    if [[ $? -eq 0 ]]; then
        echo "$val"
        return 0
    else
        # Return default value if read fails
        echo "${default_value:-}"
        return 0
    fi
}

# Alias for get_global_var for backward compatibility
get_var() {
    get_global_var "$@"
}

# Function to clear all global variables
clear_all_global_vars() {
    if [[ ! -d "$GLOBAL_VAR_DIR" ]]; then
        echo "Global variable directory does not exist"
        return 0
    fi

    # Remove all files in the directory
    $USE_SUDO rm -f "$GLOBAL_VAR_DIR"/*
    if [[ $? -eq 0 ]]; then
        echo "Successfully cleared all global variables"
        return 0
    else
        echo "Error: Failed to clear global variables"
        return 1
    fi
}

# Function to set multiple global variables with value 'true'
set_multiple_global_vars() {
    local keys=("$@")
    local success=true

    if [[ ${#keys[@]} -eq 0 ]]; then
        echo "Error: No keys provided"
        echo "Usage: set_multiple_global_vars key1 key2 key3 ..."
        return 1
    fi

    for key in "${keys[@]}"; do
        if ! set_global_var "$key" "true"; then
            echo "Failed to set key: $key"
            success=false
        fi
    done

    if [[ "$success" == "true" ]]; then
        return 0
    else
        return 1
    fi
}

# Function to remove one or more global variables
remove_global_vars() {
    local keys=("$@")
    local success=true

    if [[ ${#keys[@]} -eq 0 ]]; then
        echo "Error: No keys provided"
        echo "Usage: remove_global_vars key1 key2 key3 ..."
        return 1
    fi

    for key in "${keys[@]}"; do
        # Get normalized file path
        local file_path=$(_get_var_file_path "$key")

        if [[ -f "$file_path" ]]; then
            $USE_SUDO rm -f "$file_path"
            if [[ $? -eq 0 ]]; then
                echo "Successfully removed global variable: $key"
            else
                echo "Failed to remove global variable: $key"
                success=false
            fi
        else
            echo "Global variable not found: $key"
        fi
    done

    if [[ "$success" == "true" ]]; then
        return 0
    else
        return 1
    fi
}

# Function to check if system is Debian-based (includes both Debian and Ubuntu)
is_debian_based() {
    if [[ -f /etc/debian_version ]]; then
        return 0
    else
        return 1
    fi
}

# Function to check if system is Debian
is_debian() {
    if is_debian_based && [[ ! -f /etc/lsb-release ]]; then
        return 0
    else
        return 1
    fi
}

# Function to check if system is Ubuntu
is_ubuntu() {
    if [[ -f /etc/lsb-release ]] && grep -qi "ubuntu" /etc/lsb-release; then
        return 0
    else
        return 1
    fi
}

# Function to check if system is CentOS/RHEL based
is_centos() {
    if [[ -f /etc/centos-release ]] || [[ -f /etc/redhat-release ]] ||
        ([[ -f /etc/os-release ]] && grep -qiE "centos|rhel|rocky|almalinux" /etc/os-release); then
        return 0
    else
        return 1
    fi
}

# Alias for set_global_var for backward compatibility
set_var() {
    set_global_var "$@"
}

# Function to set a variable both in global_var and /etc/environment
set_env_and_var() {
    local key="$1"
    local val="$2"
    set_var "$key" "$val"

    # Ensure /etc/environment contains the variable
    if grep -q "^${key}=" /etc/environment; then
        $USE_SUDO sed -i "s|^${key}=.*|${key}=\"${val}\"|g" /etc/environment
    else
        echo "${key}=\"${val}\"" | $USE_SUDO tee -a /etc/environment >/dev/null
    fi
    if [ "$USE_SUDO" = "sudo" ]; then
        sudo bash -c "source /etc/environment"
    else
        source /etc/environment
    fi
}

# Set Puppeteer skip download globally by default
set_env_and_var "PUPPETEER_SKIP_DOWNLOAD" "true"

# Git SSH related URLs - Auto-switch based on region
SELECTED_REGION=$(get_global_var "SELECTED_REGION" "Global" 2>/dev/null || echo "Global")

if [[ "$SELECTED_REGION" == "China" ]]; then
    GIT_SSH_BASE_URL="https://gitee.com/accountbelongstox/core_node/raw/main"
else
    GIT_SSH_BASE_URL="https://raw.githubusercontent.com/accountbelongstox/core_node/main"
fi

GIT_SSH_PUB_URL="$GIT_SSH_BASE_URL/scripts/git/git.ssh.id.ed.pub.js"
GIT_SSH_KEY_URL="$GIT_SSH_BASE_URL/scripts/git/git.ssh.id.ed.js"

# SSH directory configuration
# Always use user's .ssh directory for Git SSH keys
# This ensures Git can find the keys regardless of user privileges
SSH_DIR="$HOME/.ssh"
if [[ "$EUID" -eq 0 ]]; then
    SSH_INSTALLED_FLAG="$GLOBAL_VAR_DIR/SSH_KEYS_INSTALLED_ROOT"
else
    SSH_INSTALLED_FLAG="$GLOBAL_VAR_DIR/SSH_KEYS_INSTALLED_USER"
fi

# Export SSH related variables
export GIT_SSH_BASE_URL
export GIT_SSH_PUB_URL
export GIT_SSH_KEY_URL
export SSH_DIR
export SSH_INSTALLED_FLAG

# Export the GLOBAL_VAR_DIR and GLOBAL_TEMP_DIR
export GLOBAL_VAR_DIR
export GLOBAL_TEMP_DIR
export COMPILE_DIR

# Initialize batch decryption flag
BATCH_DECRYPTION_COMPLETED=false

# Function to detect and return CORE_NODE_DIR dynamically based on gvar_common.sh location
get_core_node_dir() {
    # Calculate CORE_NODE_DIR based on gvar_common.sh location
    # gvar_common.sh is at: core_node/scripts/shells/linux/common/gvar_common.sh
    # So we need to go up 4 levels: common -> linux -> shells -> scripts -> core_node

    local gvar_common_path="${BASH_SOURCE[0]}"

    # Resolve to absolute path if it's a symlink
    if [ -L "$gvar_common_path" ]; then
        gvar_common_path="$(readlink -f "$gvar_common_path")"
    fi

    # Get directory of gvar_common.sh
    local gvar_common_dir="$(cd "$(dirname "$gvar_common_path")" && pwd)"

    # Go up 4 levels to reach core_node root
    # common -> linux -> shells -> scripts -> core_node
    local core_node_dir="$(dirname "$(dirname "$(dirname "$(dirname "$gvar_common_dir")")")")"

    # Verify this is actually core_node directory by checking for markers
    if [ ! -d "$core_node_dir/.secret_keys" ] && [ ! -f "$core_node_dir/package.json" ]; then
        # Fallback: try environment variable
        if [ -n "$CORE_NODE_DIR" ]; then
            core_node_dir="$CORE_NODE_DIR"
        else
            # Fallback: check common paths based on environment
            if [ "$IS_WSL" = true ] && [ -d "/mnt/d/programing/core_node" ]; then
                core_node_dir="/mnt/d/programing/core_node"
            elif [ -d "/www/wwwroot/core_node" ]; then
                core_node_dir="/www/wwwroot/core_node"
            elif [ -d "/opt/core_node" ]; then
                core_node_dir="/opt/core_node"
            else
                # Final fallback
                core_node_dir="/opt/core_node"
            fi
        fi
    fi

    echo "$core_node_dir"
}

# Export CORE_NODE_DIR for use in other scripts
export CORE_NODE_DIR=$(get_core_node_dir)

# Function to get encrypted content by key name (equivalent to Invoke-DisguiseDecryption)
get_secret_content() {
    local key_name="$1"

    if [ -z "$key_name" ]; then
        echo "Error: KeyName parameter is required"
        return 1
    fi

    # Use centralized core_node directory detection
    local core_node_dir=$(get_core_node_dir)

    # Variables declaration
    local scripts_dir="$core_node_dir/scripts"
    local secret_keys_dir="$core_node_dir/.secret_keys"
    local raw_dir="$secret_keys_dir/.secret_ignore"
    local encrypted_dir="$secret_keys_dir/already_encrypted"
    local raw_file="$raw_dir/$key_name"
    local encrypted_file="$encrypted_dir/$key_name.js"
    
    # First check if raw file exists
    if [ -f "$raw_file" ]; then
        local content=$(cat "$raw_file" 2>/dev/null | tr -d '\0' | sed '/^\s*$/d')
        if [ -n "$content" ]; then
            echo "$content"
            return 0
        fi
    fi
    
    # Check if encrypted file exists
    if [ ! -f "$encrypted_file" ]; then
        return 1
    fi
    
    # Check if we need to perform batch decryption
    if [ "$BATCH_DECRYPTION_COMPLETED" = false ]; then
        echo "[DECRYPT] Checking for encrypted files requiring batch decryption..." >&2
        
        # Find all encrypted .js files that don't have corresponding raw files
        local encrypted_files=()
        if [ -d "$encrypted_dir" ]; then
            while IFS= read -r -d '' enc_file; do
                local raw_file_name=$(basename "$enc_file" .js)
                local raw_file_path="$raw_dir/$raw_file_name"
                
                if [ ! -f "$raw_file_path" ]; then
                    encrypted_files+=("$enc_file")
                fi
            done < <(find "$encrypted_dir" -name "*.js" -print0 2>/dev/null)
        fi
        
        if [ ${#encrypted_files[@]} -gt 0 ]; then
            echo "[DECRYPT] Found ${#encrypted_files[@]} encrypted files requiring decryption" >&2
            
            # Find disguise.js
            local disguise_js=""
            if [ -d "$scripts_dir" ]; then
                disguise_js=$(find "$scripts_dir" -name "disguise.js" -type f | head -n 1)
            fi
            
            if [ -n "$disguise_js" ]; then
                echo "[DECRYPT] Found decryption tool: $disguise_js" >&2
                
                # Get password for batch decryption
                echo -n "[DECRYPT] Enter decryption password for all encrypted files: " >&2
                read -s password
                echo "" >&2
                
                if [ -n "$password" ]; then
                    # Ensure raw directory exists
                    if [ ! -d "$raw_dir" ]; then
                        mkdir -p "$raw_dir"
                    fi
                    
                    # Decrypt each file
                    local success_count=0
                    for encrypted_file in "${encrypted_files[@]}"; do
                        local file_name=$(basename "$encrypted_file")
                        echo "[DECRYPT] Decrypting: $file_name" >&2
                        
                        local result
                        result=$(node "$encrypted_file" pwd "$password" "$raw_dir" 2>&1)
                        local exit_code=$?
                        
                        if [ $exit_code -eq 0 ]; then
                            echo "[DECRYPT] SUCCESS: Decrypted $file_name" >&2
                            ((success_count++))
                        else
                            echo "[DECRYPT] WARNING: Failed to decrypt $file_name" >&2
                            echo "[DECRYPT] Error: $result" >&2
                        fi
                    done
                    
                    echo "[DECRYPT] Batch decryption completed: $success_count/${#encrypted_files[@]} files decrypted" >&2
                else
                    echo "[DECRYPT] WARNING: Empty password provided, skipping batch decryption" >&2
                fi
                
                # Clear password from memory
                password=""
            else
                echo "[DECRYPT] WARNING: disguise.js not found in scripts directory" >&2
            fi
        fi
        
        # Mark batch decryption as completed for this session
        BATCH_DECRYPTION_COMPLETED=true
    fi
    
    # Try to read the decrypted file again
    if [ -f "$raw_file" ]; then
        local content=$(cat "$raw_file" 2>/dev/null | tr -d '\0' | sed '/^\s*$/d')
        if [ -n "$content" ]; then
            echo "$content"
            return 0
        fi
    fi
    
    return 1
}


# Alias for set_global_var for backward compatibility  
# Call set_is_global after all functions are defined
set_is_global
