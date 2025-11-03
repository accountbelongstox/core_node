#!/bin/bash
# Quick Start Script for File Sync Tool
# Automatically initializes and runs the server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"
INIT_SCRIPT="$SCRIPT_DIR/init_env.py"
MAIN_SCRIPT="$SCRIPT_DIR/file_sync_tool.py"

echo "======================================================================"
echo "File Sync Tool - Quick Start"
echo "======================================================================"

if [ ! -d "$VENV_DIR" ]; then
    echo ""
    echo "Virtual environment not found. Initializing..."
    echo "This is a one-time setup. Please wait..."
    echo ""

    if ! python3 "$INIT_SCRIPT"; then
        echo ""
        echo "Initialization failed. Please check the error above."
        echo "You may need to run manually: python3 init_env.py"
        exit 1
    fi

    echo ""
    echo "Initialization completed!"
else
    echo ""
    echo "Virtual environment found."
fi

echo ""
echo "Starting File Sync Tool Server..."
echo ""

VENV_PYTHON="$VENV_DIR/bin/python"

if [ ! -f "$VENV_PYTHON" ]; then
    echo "Python executable not found in virtual environment."
    echo "Please run: python3 init_env.py"
    exit 1
fi

"$VENV_PYTHON" "$MAIN_SCRIPT" server "$@" || {
    echo ""
    echo "Server stopped or error occurred."
    exit 1
}
