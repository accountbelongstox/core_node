#!/bin/bash
# VSCode and Cursor Configuration
# Simple configuration for VSCode and Cursor download and installation

# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY FORBIDDEN
# ### AI SPECIAL ATTENTION RULES END ###

# Script identification
CONFIG_VERSION="1.0.0"

# Core Node directory (dynamically detected)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
CORE_NODE_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Source global variables (relative path)
if [ -f "$PARENT_DIR_LEVEL_2/common/gvar_common.sh" ]; then
    source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
fi

# Shared download directory
get_shared_download_dir() {
    if [ "$(uname)" = "Linux" ]; then
        local shared_dir="${CORE_NODE_DATA_DIR}/shared_downloads"

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
    elif [ "$(uname)" = "MINGW"* ] || [ "$(uname)" = "CYGWIN"* ] || [ "$(uname)" = "MSYS"* ]; then
        local public_downloads="C:\\Users\\Public\\Downloads"
        if [ -d "$public_downloads" ]; then
            echo "$public_downloads"
            return 0
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
export VSCODE_NAME VSCODE_PATTERN VSCODE_URL
export CURSOR_NAME CURSOR_PATTERN CURSOR_URL
export CORE_NODE_DIR DOWNLOAD_TIMEOUT SHARED_DOWNLOAD_DIR
export -f log_info log_success log_error get_shared_download_dir