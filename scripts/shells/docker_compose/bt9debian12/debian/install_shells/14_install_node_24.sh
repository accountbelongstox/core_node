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
PARENT_DIR_LEVEL_3="$(dirname "$PARENT_DIR_LEVEL_2")"
PARENT_DIR_LEVEL_4="$(dirname "$PARENT_DIR_LEVEL_3")"
PARENT_DIR_LEVEL_5="$(dirname "$PARENT_DIR_LEVEL_4")"

# Source global variables
source "$PARENT_DIR_LEVEL_5/linux/LGar.sh"
source "$PARENT_DIR_LEVEL_5/linux/common/gvar_common.sh"

# Declare all variables at the beginning
INSTALL_NODE=$(get_var "INSTALL_NODE")
INSTALL_MODE=$(get_var "INSTALL_MODE")
SELECTED_REGION=${SELECTED_REGION:-$(get_var "SELECTED_REGION")}
NODE_VERSION="v24.11.1"
NODE_SHORT_VERSION="24"
NODE_INSTALL_DIR="$COMPILE_DIR/nodejs"
NODE_DOWNLOAD_URL="https://nodejs.org/dist/v24.11.1/node-v24.11.1-linux-x64.tar.xz"
TAR_FILE="/tmp/node-$NODE_VERSION-linux-x64.tar.xz"
EXTRACT_DIR="/tmp/node-$NODE_VERSION-linux-x64"
NODE_BIN_DIR="$NODE_INSTALL_DIR/node-$NODE_VERSION/bin"

if [ "$INSTALL_NODE" = "false" ]; then
    echo "Skipping Node.js installation, INSTALL_NODE: $INSTALL_NODE, INSTALL_MODE: $INSTALL_MODE"
    exit 0
fi

echo "COMPILE_DIR: $COMPILE_DIR"
echo "SELECTED_REGION: $SELECTED_REGION"
echo "NODE_VERSION: $NODE_VERSION"
echo "NODE_INSTALL_DIR: $NODE_INSTALL_DIR"

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
    
    # Set npm global directory to compile directory
    local npm_global_dir="$COMPILE_DIR/npm-global"
    sudo mkdir -p "$npm_global_dir"
    sudo "$npm_bin" config set prefix "$npm_global_dir"
    
    echo "npm configuration completed:"
    sudo "$npm_bin" config list
}

check_node_installation() {
    # Check if Node.js is installed in the target directory
    local node_bin="$NODE_BIN_DIR/node"
    local npm_bin="$NODE_BIN_DIR/npm"
    
    if [ ! -f "$node_bin" ] || [ ! -f "$npm_bin" ]; then
        echo "Node.js not found in $NODE_INSTALL_DIR"
        return 1
    fi
    
    # Check version
    local current_version
    current_version=$("$node_bin" -v 2>/dev/null | sed 's/^v//')
    if [ -z "$current_version" ]; then
        echo "Failed to get Node.js version"
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

install_node() {
    echo "Installing Node.js $NODE_VERSION..."
    echo "Download URL: $NODE_DOWNLOAD_URL"
    
    cleanup_previous
    
    # Check if download already exists
    if ! check_existing_download; then
        echo "Downloading Node.js $NODE_VERSION..."
        if ! wget --show-progress -O "$TAR_FILE" "$NODE_DOWNLOAD_URL"; then
            echo "Failed to download Node.js"
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
    echo "Creating symlinks in /usr/local/bin..."
    
    local node_path="$NODE_BIN_DIR/node"
    local npm_path="$NODE_BIN_DIR/npm"
    local npx_path="$NODE_BIN_DIR/npx"
    
    # Check if binaries exist
    if [ ! -f "$node_path" ] || [ ! -f "$npm_path" ]; then
        echo "Error: Node.js binaries not found in $NODE_BIN_DIR"
        return 1
    fi
    
    # Remove old symlinks if they exist
    sudo rm -f /usr/local/bin/node /usr/local/bin/npm /usr/local/bin/npx 2>/dev/null
    
    # Create new symlinks with 777 permissions
    if ! sudo ln -sf "$node_path" /usr/local/bin/node ||
       ! sudo ln -sf "$npm_path" /usr/local/bin/npm; then
        echo "Error: Failed to create symlinks"
        return 1
    fi
    
    # Create npx symlink if it exists
    if [ -f "$npx_path" ]; then
        sudo ln -sf "$npx_path" /usr/local/bin/npx
    fi

    # SECURITY FIX: Do NOT chmod symlinks - this affects the target files
    # Symlinks inherit permissions from their targets
    echo "Symlinks created successfully (permissions inherited from targets)"
    
    echo "Symlinks created successfully:"
    ls -l /usr/local/bin/node /usr/local/bin/npm /usr/local/bin/npx 2>/dev/null
    return 0
}

setup_environment() {
    echo "Setting up environment variables..."
    
    # Create environment script
    local env_script="/etc/profile.d/nodejs.sh"
    sudo tee "$env_script" > /dev/null << EOF
#!/bin/bash
# Node.js Environment Setup
export NODE_HOME=$NODE_INSTALL_DIR/node-$NODE_VERSION
export PATH=\$NODE_HOME/bin:\$PATH
export NODE_PATH=\$NODE_HOME/lib/node_modules
# Add npm global directory to PATH
export PATH=$COMPILE_DIR/npm-global/bin:\$PATH
# Add COMPILE_DIR to environment
export COMPILE_DIR=$COMPILE_DIR
EOF
    
    sudo chmod 755 "$env_script"
    echo "Environment script created: $env_script"
    
    # Source the environment for current session
    source "$env_script"
    
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

if check_node_installation; then
    echo "Node.js $NODE_VERSION is already installed."
else
    echo "Installing Node.js $NODE_VERSION..."
    if ! install_node; then
        echo "Node.js installation failed"
        exit 1
    fi
fi

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
echo "Node.js installed in: $NODE_INSTALL_DIR"
echo "npm global packages in: $COMPILE_DIR/npm-global"
echo "You may need to restart your shell or run 'source /etc/profile.d/nodejs.sh' to use npm global packages directly."