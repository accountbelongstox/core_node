#!/bin/bash
# VSCode and Cursor Configuration
# Simple configuration for VSCode and Cursor download and installation

# Script identification
CONFIG_VERSION="1.0.0"

# Core Node directory (dynamically detected)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
CORE_NODE_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Source global variables from the resolved project path.
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# Shared download directory
get_shared_download_dir() {
    # Use global definition from gvar_common.sh if available
    if [ -n "$CORE_NODE_SHARED_DOWNLOADS" ]; then
        local shared_dir="$CORE_NODE_SHARED_DOWNLOADS"
    elif [ "$(uname)" = "MINGW"* ] || [ "$(uname)" = "CYGWIN"* ] || [ "$(uname)" = "MSYS"* ]; then
        local public_downloads="C:\\Users\\Public\\Downloads"
        if [ -d "$public_downloads" ]; then
            echo "$public_downloads"
            return 0
        fi
        echo "$HOME/Downloads"
        return 0
    else
        echo "$HOME/Downloads"
        return 0
    fi

    # Ensure the directory exists
    if [ -d "$shared_dir" ] && [ -w "$shared_dir" ]; then
        echo "$shared_dir"
        return 0
    fi

    if [ ! -d "$shared_dir" ]; then
        if sudo mkdir -p "$shared_dir" 2>/dev/null; then
            sudo chmod 777 "$shared_dir" 2>/dev/null || true
            if [ -w "$shared_dir" ]; then
                echo "$shared_dir"
                return 0
            fi
        fi
    fi

    echo "$HOME/Downloads"
}

SHARED_DOWNLOAD_DIR=$(get_shared_download_dir)

# VSCode configuration
VSCODE_NAME="Visual Studio Code"
VSCODE_PATTERN="*code*.deb"
VSCODE_URL="https://code.visualstudio.com/"

# Cursor configuration
CURSOR_NAME="Cursor IDE"
CURSOR_PATTERN="cursor*.deb"
CURSOR_URL="https://cursor.sh/"

# Download timeout (seconds)
DOWNLOAD_TIMEOUT=300

# Simple logging functions
log_info() {
    echo "[INFO] $1"
}

log_success() {
    echo "[SUCCESS] $1"
}

log_error() {
    echo "[ERROR] $1"
}

# Export variables
export -f log_info log_success log_error get_shared_download_dir
