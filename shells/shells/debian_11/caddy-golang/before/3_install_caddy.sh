#!/bin/bash

# Get the script root directory from global variables
SCRIPT_ROOT_DIR=$(cat "/usr/script_global_var/SCRIPT_ROOT_DIR")
GLOBAL_VAR_MANAGER="$SCRIPT_ROOT_DIR/conf/shells/common/global_var_manager.sh"

# Source the global variable manager if it exists
if [ -f "$GLOBAL_VAR_MANAGER" ]; then
    source "$GLOBAL_VAR_MANAGER"
else
    echo "Error: Global variable manager not found at $GLOBAL_VAR_MANAGER"
    exit 1
fi

# Check if Caddy is already installed
check_caddy() {
    if command -v caddy &> /dev/null; then
        return 0
    fi
    return 1
}

install_caddy() {
    echo "Installing Caddy..."
    
    # Add Caddy official repository
    if [ ! -f "/usr/share/keyrings/caddy-stable-archive-keyring.gpg" ]; then
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
    fi

    # Update package list and install Caddy
    sudo apt update
    sudo apt install -y caddy

    # Enable and start Caddy service
    sudo systemctl enable caddy
    sudo systemctl start caddy
}

# Main installation logic
if check_caddy; then
    echo "Caddy is already installed: $(caddy version)"
else
    install_caddy
    if ! check_caddy; then
        echo "Error: Caddy installation failed"
        exit 1
    fi
    echo "Caddy installed successfully: $(caddy version)"
fi

# Store Caddy related paths in global variables
CADDY_PATH=$(which caddy)
if [ -n "$CADDY_PATH" ]; then
    set_var "caddy_path" "$CADDY_PATH"
    echo "Caddy path stored in global variables"
fi

# Store Caddy config directory
CADDY_CONFIG_DIR="/etc/caddy"
if [ -d "$CADDY_CONFIG_DIR" ]; then
    set_var "caddy_config_dir" "$CADDY_CONFIG_DIR"
    echo "Caddy config directory stored in global variables"
fi

# Store Caddy data directory
CADDY_DATA_DIR="/var/lib/caddy"
if [ -d "$CADDY_DATA_DIR" ]; then
    set_var "caddy_data_dir" "$CADDY_DATA_DIR"
    echo "Caddy data directory stored in global variables"
fi

# Verify Caddy installation and service status
echo "
Caddy Installation Status:
-------------------------
Version: $(caddy version)
Service Status: $(systemctl is-active caddy)
Config Directory: $CADDY_CONFIG_DIR
Data Directory: $CADDY_DATA_DIR
Binary Path: $CADDY_PATH
"

# Check if service is running
if ! systemctl is-active --quiet caddy; then
    echo "Warning: Caddy service is not running"
    echo "You can start it with: sudo systemctl start caddy"
fi 