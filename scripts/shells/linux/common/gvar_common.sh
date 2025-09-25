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

GLOBAL_VAR_DIR=$(determine_global_var_dir)

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

# Function to determine and create global temporary directory
determine_temp_dir() {
    local temp_base_dir="/www/wwwroot/.tmp"
    echo "$temp_base_dir"
    return 0
}

# Function to ensure global temporary directory exists
ensure_temp_dir() {
    local temp_dir="$1"
    
    if [ ! -d "$temp_dir" ]; then
        echo "Creating global temporary directory: $temp_dir"
        $USE_SUDO mkdir -p "$temp_dir"
        $USE_SUDO chmod 755 "$temp_dir"
    fi
    
    echo "Global temporary directory: $temp_dir"
    return 0
}

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

# Initialize global temporary directory
GLOBAL_TEMP_DIR=$(determine_temp_dir)
ensure_temp_dir "$GLOBAL_TEMP_DIR"

check_and_install_sudo() {
    if command -v sudo >/dev/null 2>&1; then
        USE_SUDO="sudo"
    else
        USE_SUDO=""
    fi
}
check_and_install_sudo

# Set IS_GLOBAL based on SELECTED_REGION (moved after function definitions)
set_is_global() {
    # Ensure directory exists before trying to read from it
    if [ ! -d "$GLOBAL_VAR_DIR" ]; then
        local sudo_cmd=""
        if command -v sudo >/dev/null 2>&1; then
            sudo_cmd="sudo"
        fi
        $sudo_cmd mkdir -p "$GLOBAL_VAR_DIR" 2>/dev/null || mkdir -p "$GLOBAL_VAR_DIR" 2>/dev/null || true
    fi
    
    local selected_region=$(get_global_var "SELECTED_REGION" "Global")
    if [ "$selected_region" = "Global" ]; then
        IS_GLOBAL="true"
    else
        IS_GLOBAL="false"
    fi
}

# Ensure the global variable directory exists
ensure_dir() {
    if [ ! -d "$GLOBAL_VAR_DIR" ]; then
        $USE_SUDO mkdir -p "$GLOBAL_VAR_DIR"
        echo "Created global variable directory: $GLOBAL_VAR_DIR"
    fi
}

# Function to set global variable
set_var() {
    local key="$1"
    local val="$2"

    # Convert key to uppercase
    key=$(echo "$key" | tr '[:lower:]' '[:upper:]')

    # Ensure directory exists
    if [[ ! -d "$GLOBAL_VAR_DIR" ]]; then
        $USE_SUDO mkdir -p "$GLOBAL_VAR_DIR"
    fi

    # Write or update the value
    echo "$val" | $USE_SUDO tee "$GLOBAL_VAR_DIR/$key" >/dev/null
}

# Function to get global variable
get_var() {
    local key="$1"
    local default_value="$2"

    # Convert key to uppercase
    key=$(echo "$key" | tr '[:lower:]' '[:upper:]')

    if [[ -f "$GLOBAL_VAR_DIR/$key" ]]; then
        cat "$GLOBAL_VAR_DIR/$key" 2>/dev/null || echo "${default_value:-}"
    else
        echo "${default_value:-}"
    fi
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

    # Ensure global var directory exists
    if [[ ! -d "$GLOBAL_VAR_DIR" ]]; then
        $USE_SUDO mkdir -p "$GLOBAL_VAR_DIR"
        if [[ $? -ne 0 ]]; then
            echo "Error: Failed to create directory $GLOBAL_VAR_DIR"
            return 1
        fi
    fi

    # Convert key to uppercase and remove any special characters
    key=$(echo "$key" | tr '[:lower:]' '[:upper:]' | tr -cd '[:alnum:]_')
    local file_path="$GLOBAL_VAR_DIR/$key"

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

    # Convert key to uppercase and remove any special characters
    key=$(echo "$key" | tr '[:lower:]' '[:upper:]' | tr -cd '[:alnum:]_')
    local file_path="$GLOBAL_VAR_DIR/$key"

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
        # Convert key to uppercase and remove special characters
        key=$(echo "$key" | tr '[:lower:]' '[:upper:]' | tr -cd '[:alnum:]_')
        local file_path="$GLOBAL_VAR_DIR/$key"

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
get_git_ssh_base_url() {
    # Ensure directory exists before trying to read from it
    if [ ! -d "$GLOBAL_VAR_DIR" ]; then
        local sudo_cmd=""
        if command -v sudo >/dev/null 2>&1; then
            sudo_cmd="sudo"
        fi
        $sudo_cmd mkdir -p "$GLOBAL_VAR_DIR" 2>/dev/null || mkdir -p "$GLOBAL_VAR_DIR" 2>/dev/null || true
    fi
    
    local selected_region=$(get_global_var "SELECTED_REGION" "Global" 2>/dev/null || echo "Global")

    if [[ "$selected_region" == "China" ]]; then
        echo "https://gitee.com/accountbelongstox/core_node/raw/main"
    else
        echo "https://raw.githubusercontent.com/accountbelongstox/core_node/main"
    fi
}

# Git SSH URLs
GIT_SSH_BASE_URL=$(get_git_ssh_base_url)
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

ensure_dir
# Export the GLOBAL_VAR_DIR and GLOBAL_TEMP_DIR
export GLOBAL_VAR_DIR
export GLOBAL_TEMP_DIR
export COMPILE_DIR

# Initialize batch decryption flag
BATCH_DECRYPTION_COMPLETED=false

# Function to get encrypted content by key name (equivalent to Invoke-DisguiseDecryption)
get_secret_content() {
    local key_name="$1"
    
    if [ -z "$key_name" ]; then
        echo "Error: KeyName parameter is required"
        return 1
    fi
    
    # Find CORE_NODE_DIR by walking up from current script directory
    local script_dir="$(dirname "$(readlink -f "$0")")"
    local core_node_dir=""
    
    # Try to find core_node directory
    local current_dir="$script_dir"
    while [ "$current_dir" != "/" ] && [ "$current_dir" != "." ]; do
        if [ -d "$current_dir/.secret_keys" ] || [ -f "$current_dir/package.json" ]; then
            core_node_dir="$current_dir"
            break
        fi
        current_dir="$(dirname "$current_dir")"
    done
    
    # Fallback to environment variable or default
    if [ -z "$core_node_dir" ]; then
        if [ -n "$CORE_NODE_DIR" ]; then
            core_node_dir="$CORE_NODE_DIR"
        else
            # Default fallback
            core_node_dir="/opt/core_node"
        fi
    fi
    
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

# Alias for get_global_var for backward compatibility
get_var() {
    get_global_var "$@"
}

# Alias for set_global_var for backward compatibility  
set_var() {
    set_global_var "$@"
}

# Call set_is_global after all functions are defined
set_is_global
