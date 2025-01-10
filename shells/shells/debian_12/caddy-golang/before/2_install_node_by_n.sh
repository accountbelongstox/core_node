#!/bin/bash

# Get the script root directory and common scripts directory from global variables
if [ ! -f "/usr/core_node/global_var/SCRIPT_ROOT_DIR" ] || [ ! -f "/usr/core_node/global_var/COMMON_SCRIPTS_DIR" ]; then
    echo "Error: Required global variables not found"
    exit 1
fi

SCRIPT_ROOT_DIR=$(cat "/usr/core_node/global_var/SCRIPT_ROOT_DIR")
COMMON_SCRIPTS_DIR=$(cat "/usr/core_node/global_var/COMMON_SCRIPTS_DIR")

# Node.js version and download URL
NODE_VERSION="20.18.1"
NODE_DOWNLOAD_URL="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz"
N_PREFIX="/usr/local"
DOWNLOAD_PATH="/tmp/node-v${NODE_VERSION}-linux-x64.tar.xz"

# Function to set global variable
set_var() {
    local key="$1"
    local val="$2"
    local var_dir="/usr/core_node/global_var"
    
    # Convert key to uppercase
    key=$(echo "$key" | tr '[:lower:]' '[:upper:]')
    
    # Ensure directory exists
    if [ ! -d "$var_dir" ]; then
        sudo mkdir -p "$var_dir"
    fi
    
    # Write or update the value
    echo "$val" | sudo tee "$var_dir/$key" > /dev/null
    
    if [ $? -eq 0 ]; then
        echo "Global variable set: $key = $val"
    else
        echo "Error: Failed to set global variable $key"
        return 1
    fi
}

# Function to store path in global variables
store_path() {
    local name=$1
    local path=$2
    if [ -n "$path" ]; then
        set_var "${name}_path" "$path"
        echo "${name} path stored: $path"
    else
        echo "Warning: Could not find ${name} path"
    fi
}

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo "Node.js not found, proceeding with installation..."
    
    # Remove any partial downloads
    [ -f "$DOWNLOAD_PATH" ] && rm -f "$DOWNLOAD_PATH"
    
    # Download and install Node.js
    curl -L "$NODE_DOWNLOAD_URL" -o "$DOWNLOAD_PATH"
    sudo mkdir -p "$N_PREFIX/n/versions/node"
    sudo tar -xJf "$DOWNLOAD_PATH" -C "$N_PREFIX/n/versions/node"
    sudo mv "$N_PREFIX/n/versions/node/node-v${NODE_VERSION}-linux-x64" "$N_PREFIX/n/versions/node/${NODE_VERSION}"
    
    # Create symbolic links
    sudo ln -sf "$N_PREFIX/n/versions/node/${NODE_VERSION}/bin/node" "$N_PREFIX/bin/node"
    sudo ln -sf "$N_PREFIX/n/versions/node/${NODE_VERSION}/bin/npm" "$N_PREFIX/bin/npm"
    sudo ln -sf "$N_PREFIX/n/versions/node/${NODE_VERSION}/bin/npx" "$N_PREFIX/bin/npx"
    
    rm -f "$DOWNLOAD_PATH"
    echo "Node.js v${NODE_VERSION} installed successfully"
else
    echo "Node.js is already installed: $(node -v)"
fi


# Store Node.js related paths
store_path "node" "$(which node)"
store_path "npm" "$(which npm)"

echo "Installation and Configuration Summary:\n-------------------------------------\nNode.js version: $(node -v)\nnpm version: $(npm -v)\nnpm registry: $(npm config get registry)\n\nInstalled global packages:\n$(npm list -g --depth=0)\n\nGlobal variables have been stored for:\n$(list_vars)\n\nYou can use 'npx n' to install other Node.js versions.\nExample: 'npx n lts' or 'npx n latest'"
