#!/bin/bash

CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BASE_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PARENT_DIR="$(dirname "$CURRENT_DIR")"
OS_NAME=$(awk -F= '/^ID=/ { print $2 }' /etc/os-release | tr -d '"')
OS_VERSION_ID=$(awk -F= '/^VERSION_ID=/ { print $2 }' /etc/os-release | tr -d '"')
DEPLOY_DIR=$(dirname "$( dirname "$( dirname "$BASE_DIR")")")
SCRIPT_ROOT_DIR=$(dirname "$(dirname "$DEPLOY_DIR")")

execute_scripts() {
    local directory=$1
    if [ -d "$directory" ]; then
        echo "Executing scripts in $directory..."
        for script in $(find "$directory" -maxdepth 1 -name '*.sh' | sort); do
            echo "Running $script..."
            sudo bash "$script"
        done
    else
        echo "Install bash Directory $directory not found."
    fi
}

execute_public_scripts() {
    local public_dir="${BASE_DIR}/public"
    if [ -d "$public_dir" ]; then
        echo "Executing scripts in public directory..."
        for script in $(find "$public_dir" -maxdepth 1 -name '*.sh' | sort); do
            echo "Running $script..."
            sudo bash "$script"
        done
    else
        echo "Public directory not found."
    fi
}

# Check for /server/install.sh in the parent directory of CURRENT_DIR
INSTALL_SCRIPT_FILE="${PARENT_DIR}/server/install.sh"

# Check if the OS is Ubuntu and execute the scripts
if [ "$OS_NAME" = "ubuntu" ]; then
    echo "Running on Ubuntu $OS_VERSION_ID."
    before_scripts="${BASE_DIR}/before"
    execute_scripts "$before_scripts"
    execute_public_scripts
    after_public_dir="${BASE_DIR}/after"
    execute_scripts "$after_public_dir"
    
    # Check if the install script exists and execute it
    if [ -f "$INSTALL_SCRIPT_FILE" ]; then
        echo "Found server install script at $INSTALL_SCRIPT_FILE. Executing..."
        sudo $INSTALL_SCRIPT_FILE
    else
        echo "Server install script not found at $INSTALL_SCRIPT_FILE."
    fi
else
    echo "This script is designed to run on Ubuntu systems."
    echo "Current OS: $OS_NAME"
    echo "Current Version: $OS_VERSION_ID"
fi
