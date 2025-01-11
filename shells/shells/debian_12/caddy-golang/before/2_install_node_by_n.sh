#!/bin/bash

# Get the script root directory and common scripts directory from global variables
if [ ! -f "/usr/core_node/global_var/SCRIPT_ROOT_DIR" ] || [ ! -f "/usr/core_node/global_var/COMMON_SCRIPTS_DIR" ]; then
    echo "Error: Required global variables not found"
    exit 1
fi

SCRIPT_ROOT_DIR=$(cat "/usr/core_node/global_var/SCRIPT_ROOT_DIR")
COMMON_SCRIPTS_DIR=$(cat "/usr/core_node/global_var/COMMON_SCRIPTS_DIR")

clean_invalid_node_links=$COMMON_SCRIPTS_DIR/clean_invalid_node_links.py
echo python3 $clean_invalid_node_links
python3 $clean_invalid_node_links
check_and_install_sudo() {
    if ! command -v sudo > /dev/null 2>&1; then
        echo "sudo not found. Attempting to install..."
        if install_package "sudo"; then
            echo "sudo installed successfully."
        else
            echo "Failed to install sudo. Commands will be run without sudo."
            sudo=""
            return
        fi
    fi

    if command -v sudo > /dev/null 2>&1; then
        sudo="sudo"
        echo "sudo is available and will be used."
    else
        sudo=""
        echo "sudo is not available. Commands will be run without sudo."
    fi
}

check_and_install_sudo

$sudo curl -L https://bit.ly/n-install | bash

$sudo n install 20.18.1

$sudo n use 20.18.1

$sudo npm install -g pnpm

$sudo npm install -g yarn

$sudo npm install -g pm2