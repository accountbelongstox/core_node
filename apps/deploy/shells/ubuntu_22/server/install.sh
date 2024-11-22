#!/bin/bash

CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BASE_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
OS_NAME=$(awk -F= '/^ID=/ { print $2 }' /etc/os-release | tr -d '"')
OS_VERSION_ID=$(awk -F= '/^VERSION_ID=/ { print $2 }' /etc/os-release | tr -d '"')

execute_scripts() {
    local directory=$1
    if [ -d "$directory" ]; then
        echo "Executing scripts in $directory..."
        for script in $(find "$directory" -maxdepth 1 -name '*.sh' | sort); do
            echo "Running $script..."
            sudo bash "$script"
        done
    else
        echo "Directory $directory not found."
    fi
}

if [ "$OS_NAME" = "ubuntu" ] && [[ "$OS_VERSION_ID" =~ ^24\. ]]; then
    echo "Running on Ubuntu $OS_VERSION_ID."
    
    before_scripts="${BASE_DIR}/before"
    execute_scripts "$before_scripts"
    
    execute_public_scripts
    
    after_scripts="${BASE_DIR}/after"
    execute_scripts "$after_scripts"
    
    init_scripts="${BASE_DIR}/init"
    execute_scripts "$init_scripts"
    
else
    echo "This script is designed to run on Ubuntu 24.x."
    echo "Current OS: $OS_NAME"
    echo "Current Version: $OS_VERSION_ID"
fi
