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

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Declare all variables at the beginning
INSTALL_NODE=$(get_var "INSTALL_NODE")
INSTALL_MODE=$(get_var "INSTALL_MODE")
SELECTED_REGION=${SELECTED_REGION:-$(get_var "SELECTED_REGION")}
# NODE_VERSION, NODE_SHORT_VERSION, NODE_INSTALL_DIR are already defined in gvar_common.sh
# Use them directly instead of redefining
if [ "$SELECTED_REGION" = "China" ]; then
    NODE_DOWNLOAD_URLS=(
        "https://repo.huaweicloud.com/nodejs/v22.19.0/node-v22.19.0-linux-x64.tar.xz"
        "https://mirrors.tuna.tsinghua.edu.cn/nodejs-release/v22.19.0/node-v22.19.0-linux-x64.tar.xz"
        "https://mirrors.aliyun.com/nodejs-release/v22.19.0/node-v22.19.0-linux-x64.tar.xz"
        "https://nodejs.org/dist/v22.19.0/node-v22.19.0-linux-x64.tar.xz"
    )
else
    NODE_DOWNLOAD_URLS=(
        "https://nodejs.org/dist/v22.19.0/node-v22.19.0-linux-x64.tar.xz"
        "https://repo.huaweicloud.com/nodejs/v22.19.0/node-v22.19.0-linux-x64.tar.xz"
    )
fi
# Use global temporary directory structure
SCRIPT_TEMP_DIR=$(create_script_temp_dir "14_install_node_22")
TAR_FILE="$SCRIPT_TEMP_DIR/node-$NODE_VERSION-linux-x64.tar.xz"
EXTRACT_DIR="$SCRIPT_TEMP_DIR/node-$NODE_VERSION-linux-x64"
NODE_BIN_DIR="$NODE_INSTALL_DIR/node-$NODE_VERSION/bin"

if [ "$INSTALL_NODE" = "false" ]; then
    echo "Skipping Node.js installation, INSTALL_NODE: $INSTALL_NODE, INSTALL_MODE: $INSTALL_MODE"
    exit 0
fi

echo "COMPILE_DIR: $COMPILE_DIR"
echo "SELECTED_REGION: $SELECTED_REGION"
echo "NODE_VERSION: $NODE_VERSION"
echo "NODE_INSTALL_DIR: $NODE_INSTALL_DIR"

# Function to detect and fix previous installation issues
detect_and_fix_previous_issues() {
    echo "Detecting and fixing previous installation issues..."
    
    # 1. Fix broken environment variables from previous runs
    echo "Checking /etc/environment for broken entries..."
    if [ -f /etc/environment ]; then
        # Remove invalid NODE-V* entries
        if grep -q "NODE-V.*_HOME=" /etc/environment; then
            echo "Found broken NODE-V*_HOME entries, removing..."
            sudo sed -i '/NODE-V.*_HOME=/d' /etc/environment
        fi
        
        # Remove invalid entries that don't follow KEY="VALUE" format
        if grep -q "^[^=]*=[^\"]*$" /etc/environment | grep -v "^PATH="; then
            echo "Found entries without proper quoting, fixing..."
            sudo sed -i 's/^\([^=]*\)=\([^"]*\)$/\1="\2"/' /etc/environment
        fi
        
        # Remove duplicate NODE_HOME entries
        if [ $(grep -c "^NODE_HOME=" /etc/environment) -gt 1 ]; then
            echo "Found duplicate NODE_HOME entries, removing duplicates..."
            sudo sed -i '/^NODE_HOME=/d' /etc/environment
        fi
        
        # Remove duplicate NODE_PATH entries
        if [ $(grep -c "^NODE_PATH=" /etc/environment) -gt 1 ]; then
            echo "Found duplicate NODE_PATH entries, removing duplicates..."
            sudo sed -i '/^NODE_PATH=/d' /etc/environment
        fi
    fi
    
    # 2. Fix broken symlinks
    echo "Checking for broken symlinks in /usr/local/bin..."
    for binary in node npm npx; do
        local link_path="/usr/local/bin/$binary"
        if [ -L "$link_path" ] && [ ! -e "$link_path" ]; then
            echo "Found broken symlink: $link_path, removing..."
            sudo rm -f "$link_path"
        fi
    done
    
    # 3. Clean up old Node.js installations in wrong locations
    echo "Checking for Node.js installations in wrong locations..."
    local wrong_locations=(
        "/usr/local/node"
        "/opt/node"
        "/var/node"
        "$(map_web_path "www" "node")"
    )
    
    for wrong_location in "${wrong_locations[@]}"; do
        if [ -d "$wrong_location" ] && [ "$wrong_location" != "$NODE_INSTALL_DIR" ]; then
            echo "Found old Node.js installation in wrong location: $wrong_location"
            read -p "Remove old installation at $wrong_location? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                sudo rm -rf "$wrong_location"
                echo "Removed: $wrong_location"
            fi
        fi
    done
    
    # 4. Fix npm global directory permissions
    if [ -d "$COMPILE_DIR/npm-global" ]; then
        echo "Fixing npm global directory permissions..."
        sudo chown -R $(whoami):$(whoami) "$COMPILE_DIR/npm-global" 2>/dev/null || true
        sudo chmod -R 755 "$COMPILE_DIR/npm-global"
    fi
    
    echo "Previous issues detection and fixing completed."
    return 0
}

# Function to configure npm mirror and global settings
configure_npm_settings() {
    local npm_bin="$NODE_BIN_DIR/npm"
    
    if [ "$SELECTED_REGION" = "China" ]; then
        echo "Region is set to China, configuring npm to use China mirror..."
        sudo "$npm_bin" config set registry https://repo.huaweicloud.com/repository/npm/
    else
        echo "Region is Global, resetting npm to default registry..."
        sudo "$npm_bin" config set registry https://registry.npmjs.org/
    fi
    
    # Use Node.js installation directory for npm globals (standard practice)
    local npm_global_dir="$NODE_INSTALL_DIR/node-$NODE_VERSION"
    echo "Setting npm global directory to: $npm_global_dir"
    "$npm_bin" config set prefix "$npm_global_dir"
    
    echo "npm configuration completed:"
    sudo "$npm_bin" config list
}

check_node_installation() {
    echo "Checking Node.js installation..."
    
    # First check if binaries exist in expected location
    local node_bin="$NODE_BIN_DIR/node"
    local npm_bin="$NODE_BIN_DIR/npm"
    
    if [ ! -f "$node_bin" ] || [ ! -f "$npm_bin" ]; then
        echo "Node.js not found in expected location: $NODE_INSTALL_DIR"
        
        # Try to find Node.js in system locations
        echo "Searching for existing Node.js installations..."
        local system_node=$(which node 2>/dev/null)
        local system_npm=$(which npm 2>/dev/null)
        
        if [ -n "$system_node" ] && [ -n "$system_npm" ]; then
            echo "Found system Node.js at: $system_node"
            local system_version=$("$system_node" -v 2>/dev/null | sed 's/^v//')
            local system_major=$(echo "$system_version" | cut -d. -f1)
            
            if [ "$system_major" = "$NODE_SHORT_VERSION" ]; then
                echo "System Node.js version $system_version matches required version $NODE_SHORT_VERSION"
                echo "Will create proper symlinks and configuration..."
                return 2  # Special return code for system installation found
            else
                echo "System Node.js version $system_version does not match required version $NODE_SHORT_VERSION"
            fi
        fi
        
        return 1
    fi
    
    # Check version in target directory
    local current_version
    current_version=$("$node_bin" -v 2>/dev/null | sed 's/^v//')
    if [ -z "$current_version" ]; then
        echo "Failed to get Node.js version from $node_bin"
        return 1
    fi
    
    local major_version
    major_version=$(echo "$current_version" | cut -d. -f1)
    
    if [ "$major_version" = "$NODE_SHORT_VERSION" ]; then
        echo "Found Node.js $current_version in $NODE_INSTALL_DIR (matches required version $NODE_SHORT_VERSION)"
        return 0
    else
        echo "Node.js version mismatch. Found: $current_version, Required: $NODE_SHORT_VERSION.x"
        return 1
    fi
}

check_existing_download() {
    if [ -f "$TAR_FILE" ]; then
        echo "Found existing download file: $TAR_FILE"
        # Check if file size is reasonable (> 20MB)
        local file_size=$(stat -c%s "$TAR_FILE" 2>/dev/null || echo "0")
        if [ "$file_size" -gt 20971520 ]; then
            echo "Existing file size looks good ($file_size bytes), skipping download"
            return 0
        else
            echo "Existing file size too small ($file_size bytes), will re-download"
            sudo rm -f "$TAR_FILE"
            return 1
        fi
    fi
    return 1
}

cleanup_previous() {
    echo "Cleaning up previous installation attempts..."
    sudo rm -rf "$EXTRACT_DIR" 2>/dev/null
}

download_with_fallback() {
    local downloaded=false
    
    for url in "${NODE_DOWNLOAD_URLS[@]}"; do
        echo "Attempting to download from: $url"
        
        # Try with different wget options
        local wget_options=(
            "--timeout=30 --tries=3 --show-progress"
            "--timeout=60 --tries=2 --no-check-certificate"
            "--timeout=120 --tries=1 --no-dns-cache"
        )
        
        for options in "${wget_options[@]}"; do
            echo "Using wget options: $options"
            if eval "wget $options -O \"$TAR_FILE\" \"$url\""; then
                echo "Successfully downloaded from: $url"
                downloaded=true
                break 2
            else
                echo "Failed with options: $options"
                sudo rm -f "$TAR_FILE" 2>/dev/null
            fi
        done
        
        echo "All wget attempts failed for: $url"
    done
    
    if [ "$downloaded" = "false" ]; then
        echo "All download sources failed. Checking if curl is available..."
        if command -v curl >/dev/null 2>&1; then
            echo "Trying with curl as fallback..."
            for url in "${NODE_DOWNLOAD_URLS[@]}"; do
                echo "Attempting curl download from: $url"
                if curl -L --connect-timeout 30 --max-time 300 -o "$TAR_FILE" "$url"; then
                    echo "Successfully downloaded with curl from: $url"
                    downloaded=true
                    break
                else
                    echo "Curl failed for: $url"
                    sudo rm -f "$TAR_FILE" 2>/dev/null
                fi
            done
        fi
    fi
    
    if [ "$downloaded" = "false" ]; then
        echo "ERROR: All download methods failed"
        echo "Please check your network connectivity or try manually downloading:"
        for url in "${NODE_DOWNLOAD_URLS[@]}"; do
            echo "  $url"
        done
        return 1
    fi
    
    return 0
}

install_node() {
    echo "Installing Node.js $NODE_VERSION..."
    echo "Available download URLs:"
    for url in "${NODE_DOWNLOAD_URLS[@]}"; do
        echo "  - $url"
    done
    
    cleanup_previous
    
    # Check if download already exists
    if ! check_existing_download; then
        echo "Downloading Node.js $NODE_VERSION..."
        if ! download_with_fallback; then
            echo "Failed to download Node.js from any source"
            return 1
        fi
    fi
    
    echo "Extracting Node.js..."
    if ! sudo mkdir -p "$EXTRACT_DIR" || ! sudo tar -xf "$TAR_FILE" -C "$EXTRACT_DIR" --strip-components=1; then
        echo "Failed to extract Node.js"
        return 1
    fi
    
    echo "Installing Node.js to $NODE_INSTALL_DIR..."
    sudo mkdir -p "$NODE_INSTALL_DIR"
    if ! sudo mv "$EXTRACT_DIR" "$NODE_INSTALL_DIR/node-$NODE_VERSION"; then
        echo "Failed to install Node.js"
        return 1
    fi
    
    # Set proper permissions
    sudo chown -R root:root "$NODE_INSTALL_DIR/node-$NODE_VERSION"
    sudo chmod -R 755 "$NODE_INSTALL_DIR/node-$NODE_VERSION"
    
    cleanup_previous
    return 0
}

create_symlinks() {
    echo "Creating and verifying symlinks..."
    
    local node_path="$NODE_BIN_DIR/node"
    local npm_path="$NODE_BIN_DIR/npm"
    local npx_path="$NODE_BIN_DIR/npx"
    
    # Check if binaries exist
    if [ ! -f "$node_path" ] || [ ! -f "$npm_path" ]; then
        echo "Error: Node.js binaries not found in $NODE_BIN_DIR"
        
        # Try to find system installation and use it
        local system_node=$(which node 2>/dev/null)
        local system_npm=$(which npm 2>/dev/null)
        
        if [ -n "$system_node" ] && [ -n "$system_npm" ]; then
            echo "Using system Node.js installation for symlinks..."
            node_path="$system_node"
            npm_path="$system_npm"
            npx_path=$(which npx 2>/dev/null)
        else
            return 1
        fi
    fi
    
    # Remove any existing broken symlinks first
    for binary in node npm npx; do
        local link_path="/usr/local/bin/$binary"
        if [ -L "$link_path" ] && [ ! -e "$link_path" ]; then
            echo "Removing broken symlink: $link_path"
            sudo rm -f "$link_path"
        fi
    done
    
    # Create symlinks for node binaries to /usr/local/bin
    if sudo ln -sf "$node_path" /usr/local/bin/node; then
        echo "Created symlink: /usr/local/bin/node -> $node_path"
    else
        echo "Failed to create symlink for node"
        return 1
    fi
    
    if sudo ln -sf "$npm_path" /usr/local/bin/npm; then
        echo "Created symlink: /usr/local/bin/npm -> $npm_path"
    else
        echo "Failed to create symlink for npm"
        return 1
    fi
    
    if [ -n "$npx_path" ] && [ -f "$npx_path" ]; then
        if sudo ln -sf "$npx_path" /usr/local/bin/npx; then
            echo "Created symlink: /usr/local/bin/npx -> $npx_path"
        else
            echo "Failed to create symlink for npx"
        fi
    fi
    
    # Verify symlinks work
    echo "Verifying symlinks..."
    if /usr/local/bin/node --version >/dev/null 2>&1; then
        echo "[OK] Node.js symlink working: $(/usr/local/bin/node --version)"
    else
        echo "[ERROR] Node.js symlink not working"
    fi

    if /usr/local/bin/npm --version >/dev/null 2>&1; then
        echo "[OK] npm symlink working: $(/usr/local/bin/npm --version)"
    else
        echo "[ERROR] npm symlink not working"
    fi
    
    echo "Symlinks created successfully:"
    ls -l /usr/local/bin/node /usr/local/bin/npm /usr/local/bin/npx 2>/dev/null
    return 0
}

setup_environment() {
    echo "Setting up Node.js environment variables..."
    
    # Clean up any previous broken environment variables first
    if [ -f /etc/environment ]; then
        echo "Cleaning up previous broken environment variables..."
        sudo sed -i '/NODE-V.*_HOME=/d' /etc/environment
        sudo sed -i '/^NODE_HOME=/d' /etc/environment
        sudo sed -i '/^NODE_PATH=/d' /etc/environment
        sudo sed -i '/^NPM_CONFIG_PREFIX=/d' /etc/environment
    fi
    
    # Determine the actual Node.js installation path
    local actual_node_home=""
    local actual_node_path=""
    
    if [ -f "$NODE_BIN_DIR/node" ]; then
        # Use our installed version
        actual_node_home="$NODE_INSTALL_DIR/node-$NODE_VERSION"
        actual_node_path="$NODE_INSTALL_DIR/node-$NODE_VERSION/lib/node_modules"
    else
        # Try to find system installation
        local system_node=$(which node 2>/dev/null)
        if [ -n "$system_node" ]; then
            # Get the actual installation directory from the binary path
            actual_node_home=$(dirname $(dirname "$system_node"))
            actual_node_path="$actual_node_home/lib/node_modules"
            echo "Using system Node.js installation at: $actual_node_home"
        else
            echo "Warning: No Node.js installation found, using target directory"
            actual_node_home="$NODE_INSTALL_DIR/node-$NODE_VERSION"
            actual_node_path="$NODE_INSTALL_DIR/node-$NODE_VERSION/lib/node_modules"
        fi
    fi
    
    # Set environment variables using the proper function from gvar_common.sh
    set_env_and_var "NODE_HOME" "$actual_node_home"
    set_env_and_var "NODE_PATH" "$actual_node_path"
    set_env_and_var "NPM_CONFIG_PREFIX" "$actual_node_home"
    
    # Use Node.js installation directory for npm globals (npm-global not needed)
    echo "NPM will use default global directory within Node.js installation: $actual_node_home"
    
    # Update PATH to include npm global bin directory (Node.js bin directory)
    local current_path=$(grep "^PATH=" /etc/environment 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "$PATH")
    local npm_global_bin="$actual_node_home/bin"
    
    # Clean up PATH - remove any old npm-global entries
    current_path=$(echo "$current_path" | sed "s|$COMPILE_DIR/npm-global/bin:||g")
    current_path=$(echo "$current_path" | sed "s|:$COMPILE_DIR/npm-global/bin||g")
    
    # Add Node.js bin to PATH if not already there
    if [[ "$current_path" != *"$npm_global_bin"* ]]; then
        set_env_and_var "PATH" "$npm_global_bin:$current_path"
        echo "Added npm global directory to PATH"
    else
        echo "npm global directory already in PATH"
    fi
    
    echo "Environment variables configured:"
    echo "  NODE_HOME: $actual_node_home"
    echo "  NODE_PATH: $actual_node_path"
    echo "  NPM_CONFIG_PREFIX: $actual_node_home"
    echo "  Updated PATH with: $npm_global_bin"
    
    return 0
}

verify_installation() {
    echo "Verifying installation..."
    
    # Check binaries in install directory
    local node_bin="$NODE_BIN_DIR/node"
    local npm_bin="$NODE_BIN_DIR/npm"
    
    if [ ! -f "$node_bin" ] || [ ! -f "$npm_bin" ]; then
        echo "Error: Node.js binaries not found in installation directory"
        return 1
    fi
    
    # Check symlinks
    if [ ! -L /usr/local/bin/node ] || [ ! -L /usr/local/bin/npm ]; then
        echo "Error: Symlinks verification failed"
        return 1
    fi
    
    echo "Node.js version: $($node_bin -v)"
    echo "npm version: $($npm_bin -v)"
    if [ -f "$NODE_BIN_DIR/npx" ]; then
        echo "npx version: $($NODE_BIN_DIR/npx -v)"
    fi
    
    # Configure npm settings
    configure_npm_settings
    
    return 0
}

# Main execution
echo "Node.js Installation Script"
echo "Target version: $NODE_VERSION"
echo "Installation directory: $NODE_INSTALL_DIR"

# First, detect and fix any previous installation issues
detect_and_fix_previous_issues

# Check installation status
installation_status=$(check_node_installation)
installation_result=$?

case $installation_result in
    0)
        echo "Node.js $NODE_VERSION is already installed in target directory."
        ;;
    2)
        echo "Found compatible system Node.js installation."
        echo "Will configure symlinks and environment for existing installation."
        ;;
    1)
        echo "Installing Node.js $NODE_VERSION..."
        if ! install_node; then
            echo "Node.js installation failed"
            exit 1
        fi
        ;;
esac

if ! create_symlinks; then
    echo "Failed to create symlinks"
    exit 1
fi

if ! setup_environment; then
    echo "Failed to setup environment"
    exit 1
fi

if ! verify_installation; then
    echo "Installation verification failed"
    exit 1
fi

echo "Node.js installation completed successfully!"
echo "COMPILE_DIR: $COMPILE_DIR"
echo "Node.js installed in: $NODE_INSTALL_DIR/node-$NODE_VERSION"
echo "npm global packages in: $NODE_INSTALL_DIR/node-$NODE_VERSION"
echo "Node.js binaries linked to: /usr/local/bin/"
echo "To use updated environment variables, restart your shell or run 'source /etc/environment'"
