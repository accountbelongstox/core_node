#!/bin/bash

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root"
    exit
fi

# Detect if sudo is available
if command -v sudo >/dev/null 2>&1; then
    USE_SUDO="sudo"
else
    USE_SUDO=""
fi

# Get Linux distribution and version
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
elif [ -f /etc/lsb-release ]; then
    . /etc/lsb-release
    OS=$DISTRIB_ID
    VER=$DISTRIB_RELEASE
else
    OS=$(uname -s)
    VER=$(uname -r)
fi

echo "Detected OS: $OS"
echo "Version: $VER"
echo "This script supports all Linux distributions"

CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BASE_DIR="$CURRENT_DIR"
DEPLOY_DIR=$(dirname "$( dirname "$( dirname "$BASE_DIR")")")
SCRIPT_ROOT_DIR=$(dirname "$(dirname "$DEPLOY_DIR")")
main_script="$SCRIPT_ROOT_DIR/main.py"
python_interpreter=$(${USE_SUDO} cat "/usr/local/.pcore_local/deploy/.PY_VENV_DIR")

execute_scripts() {
    local directory=$1
    if [ -d "$directory" ]; then
        echo "Executing scripts in $directory..."
        for script in $(find "$directory" -maxdepth 1 -name '*.sh' | sort); do
            echo "Running $script..."
            ${USE_SUDO} bash "$script"
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
            ${USE_SUDO} bash "$script"
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
