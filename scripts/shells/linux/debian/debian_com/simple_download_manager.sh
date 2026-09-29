#!/bin/bash
# Simple VSCode and Cursor Download Manager
# Pure Bash implementation using wget/curl

# Source configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/vscode_cursor_config.sh"

# Download VSCode
download_vscode() {
    log_info "Downloading VSCode... (Note: Manual download recommended)"
    log_info "Please download VSCode from: https://code.visualstudio.com/Download"
    log_info "Or use: wget https://code.visualstudio.com/sha/download?build=stable&os=linux-deb-x64"
    return 1
}

# Download Cursor
download_cursor() {
    log_info "Downloading Cursor... (Note: Manual download recommended)"
    log_info "Please download Cursor from: https://cursor.sh/"
    return 1
}

# Download both
download_both() {
    log_info "Downloading VSCode and Cursor..."
    download_vscode
    download_cursor
    return 1
}

# Find downloaded files in all user Downloads directories
find_vscode_file() {
    local search_dirs=()

    # Add shared download directory first (highest priority)
    if [[ -d "$SHARED_DOWNLOAD_DIR" ]]; then
        search_dirs+=("$SHARED_DOWNLOAD_DIR")
    fi

    # Add current user's Downloads
    if [[ -d "$HOME/Downloads" ]]; then
        search_dirs+=("$HOME/Downloads")
    fi

    # Add all other users' Downloads directories
    if [[ -d "/home" ]]; then
        for user_home in /home/*; do
            if [[ -d "$user_home/Downloads" ]]; then
                search_dirs+=("$user_home/Downloads")
            fi
        done
    fi

    # Search for VSCode .deb files
    for dir in "${search_dirs[@]}"; do
        find "$dir" -maxdepth 1 -name "$VSCODE_PATTERN" -type f -printf '%T@ %p\n' 2>/dev/null
    done | sort -n | tail -1 | cut -d' ' -f2-
}

find_cursor_file() {
    local search_dirs=()

    # Add shared download directory first (highest priority)
    if [[ -d "$SHARED_DOWNLOAD_DIR" ]]; then
        search_dirs+=("$SHARED_DOWNLOAD_DIR")
    fi

    # Add current user's Downloads
    if [[ -d "$HOME/Downloads" ]]; then
        search_dirs+=("$HOME/Downloads")
    fi

    # Add all other users' Downloads directories
    if [[ -d "/home" ]]; then
        for user_home in /home/*; do
            if [[ -d "$user_home/Downloads" ]]; then
                search_dirs+=("$user_home/Downloads")
            fi
        done
    fi

    # Search for Cursor files (both .deb and .AppImage)
    for dir in "${search_dirs[@]}"; do
        # Search for .deb files
        find "$dir" -maxdepth 1 -name "cursor*.deb" -type f -printf '%T@ %p\n' 2>/dev/null
        # Search for .AppImage files (case insensitive)
        find "$dir" -maxdepth 1 -iname "cursor*.AppImage" -type f -printf '%T@ %p\n' 2>/dev/null
    done | sort -n | tail -1 | cut -d' ' -f2-
}

# Export functions
export -f download_vscode download_cursor download_both find_vscode_file find_cursor_file

# Main execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-both}" in
        "vscode")
            download_vscode
            ;;
        "cursor")
            download_cursor
            ;;
        "both"|"")
            download_both
            ;;
        *)
            echo "Usage: $0 [vscode|cursor|both]"
            exit 1
            ;;
    esac
fi
