#!/bin/bash

CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BASE_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
COMMON_SCRIPT_DIR="$(dirname "$CURRENT_DIR")"
OS_NAME=$(awk -F= '/^ID=/ { print $2 }' /etc/os-release | tr -d '"')
OS_VERSION_ID=$(awk -F= '/^VERSION_ID=/ { print $2 }' /etc/os-release | tr -d '"')
DEPLOY_DIR=$(dirname "$( dirname "$( dirname "$BASE_DIR")")")
SERVER_INSTALL_SCRIPT_FILE="${COMMON_SCRIPT_DIR}/server/install.sh"
SERVER_INSTALL_COMMAND="sudo ${SERVER_INSTALL_SCRIPT_FILE}"

execute_scripts() {
    local directory=$1
    if [ -d "$directory" ]; then
        echo "Executing scripts in $directory..."
        for script in $(sudo find "$directory" -maxdepth 1 -name '*.sh' | sort); do
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
        for script in $(sudo find "$public_dir" -maxdepth 1 -name '*.sh' | sort); do
            echo "Running $script..."
            sudo bash "$script"
        done
    else
        echo "Public directory not found."
    fi
}

before_scripts="${BASE_DIR}/before"
execute_scripts "$before_scripts"
execute_public_scripts
after_public_dir="${BASE_DIR}/after"
execute_scripts "$after_public_dir"
echo $SERVER_INSTALL_COMMAND
sudo $SERVER_INSTALL_COMMAND

