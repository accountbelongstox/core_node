#!/bin/bash

# Get the script root directory and common scripts directory from global variables
if [ ! -f "/usr/script_global_var/SCRIPT_ROOT_DIR" ] || [ ! -f "/usr/script_global_var/COMMON_SCRIPTS_DIR" ]; then
    echo "Error: Required global variables not found"
    exit 1
fi

SCRIPT_ROOT_DIR=$(cat "/usr/script_global_var/SCRIPT_ROOT_DIR")
COMMON_SCRIPTS_DIR=$(cat "/usr/script_global_var/COMMON_SCRIPTS_DIR")
CHECK_NPMRC_SCRIPT="$COMMON_SCRIPTS_DIR/check_npmrc.js"

# Node.js version and download URL
NODE_VERSION="20.18.1"
NODE_DOWNLOAD_URL="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz"
N_PREFIX="/usr/local"
DOWNLOAD_PATH="/tmp/node-v${NODE_VERSION}-linux-x64.tar.xz"

# Function to set global variable
set_var() {
    local key="$1"
    local val="$2"
    local var_dir="/usr/script_global_var"
    
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


# After Node.js installation and configuration is complete
if [ -f "$CHECK_NPMRC_SCRIPT" ]; then
    echo "Running npmrc check script..."
    node "$CHECK_NPMRC_SCRIPT"
else
    echo "Warning: check_npmrc.js not found at $CHECK_NPMRC_SCRIPT"
fi

if [ -f /etc/npmrc ]; then
    echo -e "\nSystem-wide npmrc:"
    echo "----------------------------------------"
    cat /etc/npmrc
else
    echo -e "\nNo system-wide npmrc file found"
fi

echo "
Installation and Configuration Summary:
-------------------------------------
Node.js version: $(node -v)
npm version: $(npm -v)
npm registry: $(npm config get registry)

Installed global packages:
$(npm list -g --depth=0)

Global variables have been stored for:
$(list_vars)

You can use 'npx n' to install other Node.js versions.
Example: 'npx n lts' or 'npx n latest'
"
