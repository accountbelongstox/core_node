#!/bin/bash

CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR=$(dirname "$(dirname "$(dirname "$(dirname "$CURRENT_DIR")")")")
SCRIPT_ROOT_DIR=$(dirname "$(dirname "$DEPLOY_DIR")")
PYTHON_BIN="/usr/local/bin/python3.9"
PIP_BIN="/usr/local/bin/pip3.9"
SERVER_DIR=$(dirname "$CURRENT_DIR")
MONITOR_DIR="$SERVER_DIR/monitor"

# Get OS details
OS_NAME=$(awk -F= '/^ID=/ { print $2 }' /etc/os-release | tr -d '"')
OS_VERSION=$(awk -F= '/^VERSION_ID=/ { print $2 }' /etc/os-release | tr -d '"')

# Set virtual environment directory
PYTHON_VENV_DIR="venv_linux_${OS_NAME}_${OS_VERSION}"
VENV_DIR="$SCRIPT_ROOT_DIR/$PYTHON_VENV_DIR"
python_interpreter="$VENV_DIR/bin/python3"
main_script="$SCRIPT_ROOT_DIR/main.py"

# Check if the script is already running
if pgrep -f "$main_script deploy monitor" >/dev/null; then
    echo "Script is already running. Restarting..."
    sudo pkill -f "$main_script deploy monitor"
fi

# Scan MONITOR_DIR for files and execute command for each file
if [ -d "$MONITOR_DIR" ]; then
    for file_item in "$MONITOR_DIR"/*; do
        if [ -f "$file_item" ]; then
            echo "Executing command for file: $file_item"
            "$python_interpreter" "$main_script" deploy create_service "$file_item"
        fi
    done
else
    echo "MONITOR_DIR not found or is not a directory."
fi
