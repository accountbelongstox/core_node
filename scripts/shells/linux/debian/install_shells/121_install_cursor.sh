#!/bin/bash
# Cursor IDE Installation Script
#
# Usage:
#   ./121_install_cursor.sh                    # Normal installation
#   ./121_install_cursor.sh --force           # Force reinstallation
#   ./121_install_cursor.sh --cleanup         # Remove Cursor installation
#
# This script installs Cursor IDE from AppImage files found in ~/Downloads
# If no AppImage is found, it opens the download page and waits for manual download
#
# Include common functions and centralized configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LINUX_COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
SHELLS_COMMON_DIR="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")/common"
source "$LINUX_COMMON_DIR/common_functions.sh"
source "$SHELLS_COMMON_DIR/app_registry.sh"
source "$SHELLS_COMMON_DIR/install_logic.sh"

# Export legacy configuration for backward compatibility
export_legacy_config "cursor"

# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Script identification and path setup
SCRIPT_INDEX="121"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_1/debian_com/installation_library.sh"

# Declare variables
INSTALL_MODE=$(get_var "INSTALL_MODE" "base")
FORCE_INSTALL=false
CLEANUP_MODE=false
CURSOR_INSTALL_DIR="$(map_web_path "compile_dir")/cursor"
CURSOR_APPIMAGE_DIR="$CURSOR_INSTALL_DIR/appimage"
CURSOR_EXTRACTED_DIR="$CURSOR_INSTALL_DIR/extracted"
CURSOR_BIN_DIR="$CURSOR_INSTALL_DIR/bin"
CURSOR_DESKTOP_FILE="/usr/share/applications/cursor.desktop"
CURSOR_LAUNCHER_SCRIPT="$CURSOR_BIN_DIR/cursor"
CURSOR_INSTALLED_FLAG="$GLOBAL_VAR_DIR/cursor_installed.flag"
# Function to find all Downloads directories
find_all_downloads_dirs() {
    local downloads_dirs=()

    # Add common user Downloads directories
    for home_dir in /home/*; do
        if [[ -d "$home_dir/Downloads" ]]; then
            downloads_dirs+=("$home_dir/Downloads")
        fi
    done

    # Add root Downloads if exists
    if [[ -d "/root/Downloads" ]]; then
        downloads_dirs+=("/root/Downloads")
    fi

    printf '%s\n' "${downloads_dirs[@]}"
}

# Get all Downloads directories
DOWNLOADS_DIRS=($(find_all_downloads_dirs))
CURSOR_DOWNLOAD_URL="https://cursor.com/download"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force)
                FORCE_INSTALL=true
                shift
                ;;
            --cleanup)
                CLEANUP_MODE=true
                shift
                ;;
            *)
                echo "Unknown option: $1"
                echo "Usage: $0 [--force] [--cleanup]"
                exit 1
                ;;
        esac
    done
}

# Check if Cursor is already installed and configured
is_cursor_installed() {
    if [[ -f "$CURSOR_INSTALLED_FLAG" ]] && [[ -f "$CURSOR_LAUNCHER_SCRIPT" ]] && [[ -f "$CURSOR_DESKTOP_FILE" ]]; then
        if [[ -x "$CURSOR_LAUNCHER_SCRIPT" ]]; then
            return 0  # Installed and configured
        fi
    fi
    return 1  # Not installed or not properly configured
}

# Find Cursor AppImage files using centralized logic
find_cursor_appimage() {
    find_files_by_pattern "${APP_CONFIGS[cursor_pattern]}"
}

# Use centralized automated download
cursor_automated_download() {
    print_step_from_common_functions "Attempting automated download via core_node_init..."

    if automated_download "cursor"; then
        local appimage_file=$(find_cursor_appimage)
        if [[ $? -eq 0 ]] && [[ -n "$appimage_file" ]]; then
            print_success_from_common_functions "Found downloaded Cursor AppImage: $(basename "$appimage_file")"
            echo "$appimage_file"
            return 0
        else
            print_warning_from_common_functions "Download completed but file not found"
            return 1
        fi
    else
        print_warning_from_common_functions "Automated download failed"
        return 1
    fi
}

# Manual download fallback using centralized logic
cursor_manual_download() {
    print_step_from_common_functions "Falling back to manual download..."

    local downloaded_file=$(manual_download_fallback "cursor" "${APP_CONFIGS[cursor_name]}" "${APP_CONFIGS[cursor_url]}" "${APP_CONFIGS[cursor_pattern]}")
    if [[ $? -eq 0 ]] && [[ -n "$downloaded_file" ]]; then
        print_success_from_common_functions "Manual download completed: $(basename "$downloaded_file")"
        echo "$downloaded_file"
        return 0
    else
        print_error_from_common_functions "Manual download failed"
        return 1
    fi
}

# Extract AppImage and fix permissions
extract_appimage() {
    local appimage_file="$1"
    
    print_step_from_common_functions "Extracting Cursor AppImage..."
    
    # Create directories
    $USE_SUDO mkdir -p "$CURSOR_APPIMAGE_DIR" "$CURSOR_EXTRACTED_DIR" "$CURSOR_BIN_DIR"
    
    # Copy AppImage to installation directory
    print_step_from_common_functions "Copying AppImage to $CURSOR_APPIMAGE_DIR"
    $USE_SUDO cp "$appimage_file" "$CURSOR_APPIMAGE_DIR/"
    
    local appimage_name=$(basename "$appimage_file")
    local installed_appimage="$CURSOR_APPIMAGE_DIR/$appimage_name"
    
    # Make AppImage executable
    $USE_SUDO chmod +x "$installed_appimage"
    
    # Extract AppImage
    print_step_from_common_functions "Extracting AppImage contents..."
    cd "$CURSOR_EXTRACTED_DIR"
    $USE_SUDO "$installed_appimage" --appimage-extract >/dev/null 2>&1
    
    if [[ ! -d "$CURSOR_EXTRACTED_DIR/squashfs-root" ]]; then
        print_error_from_common_functions "Failed to extract AppImage"
        return 1
    fi
    
    # Fix chrome-sandbox permissions (critical for Cursor to work)
    # Find chrome-sandbox in various possible locations
    local chrome_sandbox=""
    local possible_paths=(
        "$CURSOR_EXTRACTED_DIR/squashfs-root/chrome-sandbox"
        "$CURSOR_EXTRACTED_DIR/squashfs-root/usr/share/cursor/chrome-sandbox"
    )

    for path in "${possible_paths[@]}"; do
        if [[ -f "$path" ]]; then
            chrome_sandbox="$path"
            break
        fi
    done

    if [[ -n "$chrome_sandbox" ]]; then
        print_step_from_common_functions "Fixing chrome-sandbox permissions at: $chrome_sandbox"
        # Use sudo directly for chrome-sandbox permissions (required for security)
        if command -v sudo >/dev/null 2>&1; then
            sudo chmod 4755 "$chrome_sandbox"
            sudo chown root:root "$chrome_sandbox"
        else
            chmod 4755 "$chrome_sandbox"
            chown root:root "$chrome_sandbox"
        fi
    else
        print_warning_from_common_functions "chrome-sandbox not found, Cursor may not work properly"
    fi
    
    return 0
}

# Create launcher script with sudo and --no-sandbox
create_launcher_script() {
    print_step_from_common_functions "Creating Cursor launcher script..."
    
    local launcher_content='#!/bin/bash
# Cursor IDE Launcher Script
# Launches Cursor with --no-sandbox flag (required for root execution)

CURSOR_EXTRACTED_DIR="'"$CURSOR_EXTRACTED_DIR"'"
CURSOR_APPRUN="$CURSOR_EXTRACTED_DIR/squashfs-root/AppRun"

if [[ ! -f "$CURSOR_APPRUN" ]]; then
    echo "Error: Cursor AppRun not found at $CURSOR_APPRUN"
    exit 1
fi

# Check if running as root and add --no-sandbox
if [[ $EUID -eq 0 ]]; then
    # Running as root, must use --no-sandbox
    exec "$CURSOR_APPRUN" --no-sandbox "$@"
else
    # Not running as root, can run normally but still use --no-sandbox for compatibility
    exec "$CURSOR_APPRUN" --no-sandbox "$@"
fi
'
    
    echo "$launcher_content" | $USE_SUDO tee "$CURSOR_LAUNCHER_SCRIPT" > /dev/null
    $USE_SUDO chmod +x "$CURSOR_LAUNCHER_SCRIPT"
    
    # Create super_scripts directory and launcher
    print_step_from_common_functions "Creating super scripts launcher..."
    if command -v sudo >/dev/null 2>&1; then
        sudo mkdir -p "/usr/local/super_scripts"

        # Create the super_scripts launcher
        local super_launcher_content='#!/bin/bash
# Cursor IDE Super Launcher Script
# This script is called from desktop entries and provides enhanced launching

CURSOR_EXTRACTED_DIR="'"$CURSOR_EXTRACTED_DIR"'"
CURSOR_APPRUN="$CURSOR_EXTRACTED_DIR/squashfs-root/AppRun"

if [[ ! -f "$CURSOR_APPRUN" ]]; then
    echo "Error: Cursor AppRun not found at $CURSOR_APPRUN"
    exit 1
fi

# Launch Cursor with --no-sandbox (required for root execution)
exec "$CURSOR_APPRUN" --no-sandbox "$@"
'

        echo "$super_launcher_content" | sudo tee "/usr/local/super_scripts/cursor.sh" > /dev/null
        sudo chmod +x "/usr/local/super_scripts/cursor.sh"

        # Create symlink in /usr/local/bin for global access
        if [[ ! -L "/usr/local/bin/cursor" ]]; then
            sudo ln -sf "/usr/local/super_scripts/cursor.sh" "/usr/local/bin/cursor"
        fi
    else
        mkdir -p "/usr/local/super_scripts"
        echo "$super_launcher_content" | tee "/usr/local/super_scripts/cursor.sh" > /dev/null
        chmod +x "/usr/local/super_scripts/cursor.sh"

        if [[ ! -L "/usr/local/bin/cursor" ]]; then
            ln -sf "/usr/local/super_scripts/cursor.sh" "/usr/local/bin/cursor"
        fi
    fi

    return 0
}

# Create desktop entry
create_desktop_entry() {
    print_step_from_common_functions "Creating desktop entry..."
    
    local icon_path="$CURSOR_EXTRACTED_DIR/squashfs-root/cursor.png"
    if [[ ! -f "$icon_path" ]]; then
        # Try alternative icon locations
        icon_path=$(find "$CURSOR_EXTRACTED_DIR/squashfs-root" -name "*.png" -type f | head -1)
        if [[ -z "$icon_path" ]]; then
            icon_path="cursor"  # Fallback to system icon
        fi
    fi
    
    local desktop_content="[Desktop Entry]
Name=Cursor
Comment=AI-powered code editor
Exec=/usr/local/super_scripts/cursor.sh %U
Icon=$icon_path
Type=Application
Categories=Development;TextEditor;IDE;
MimeType=text/plain;text/x-chdr;text/x-csrc;text/x-c++hdr;text/x-c++src;text/x-java;text/x-dsrc;text/x-pascal;text/x-perl;text/x-python;application/x-php;application/x-httpd-php3;application/x-httpd-php4;application/x-httpd-php5;text/x-sql;text/x-diff;
StartupNotify=true
StartupWMClass=cursor
"
    
    echo "$desktop_content" | $USE_SUDO tee "$CURSOR_DESKTOP_FILE" > /dev/null
    $USE_SUDO chmod 644 "$CURSOR_DESKTOP_FILE"
    
    # Update desktop database
    if command -v update-desktop-database >/dev/null 2>&1; then
        $USE_SUDO update-desktop-database /usr/share/applications/ 2>/dev/null || true
    fi
    
    return 0
}

# Install required dependencies
install_dependencies() {
    print_step_from_common_functions "Installing required dependencies..."

    # Install libfuse2 which is required for AppImage
    if ! dpkg -l | grep -q libfuse2; then
        print_step_from_common_functions "Installing libfuse2..."
        $USE_SUDO apt-get update -qq
        $USE_SUDO apt-get install -y libfuse2
    fi

    return 0
}

# Cleanup Cursor installation
cleanup_cursor() {
    print_header_from_common_functions "Cleaning up Cursor installation"

    # Terminate Cursor processes
    print_step_from_common_functions "Terminating Cursor processes..."
    kill_processes_by_name "cursor" true

    # Remove installation directory using robust removal
    if [[ -d "$CURSOR_INSTALL_DIR" ]]; then
        print_step_from_common_functions "Removing installation directory: $CURSOR_INSTALL_DIR"
        robust_remove_directory "$CURSOR_INSTALL_DIR"
    fi

    # Remove desktop entry
    if [[ -f "$CURSOR_DESKTOP_FILE" ]]; then
        print_step_from_common_functions "Removing desktop entry: $CURSOR_DESKTOP_FILE"
        $USE_SUDO rm -f "$CURSOR_DESKTOP_FILE"
    fi

    # Remove symlink
    if [[ -L "/usr/local/bin/cursor" ]]; then
        print_step_from_common_functions "Removing symlink: /usr/local/bin/cursor"
        $USE_SUDO rm -f "/usr/local/bin/cursor"
    fi

    # Remove installation flag
    if [[ -f "$CURSOR_INSTALLED_FLAG" ]]; then
        print_step_from_common_functions "Removing installation flag: $CURSOR_INSTALLED_FLAG"
        $USE_SUDO rm -f "$CURSOR_INSTALLED_FLAG"
    fi

    # Update desktop database
    if command -v update-desktop-database >/dev/null 2>&1; then
        $USE_SUDO update-desktop-database /usr/share/applications/ 2>/dev/null || true
    fi

    print_success_from_common_functions "Cursor cleanup completed"
    return 0
}

# Main installation function
install_cursor() {
    print_header_from_common_functions "Installing Cursor IDE"

    # Install dependencies
    install_dependencies

    # Use centralized download and install workflow
    print_step_from_common_functions "Starting Cursor download workflow..."
    local appimage_file=$(download_and_install_app "cursor" "$FORCE_INSTALL")
    if [[ $? -ne 0 ]] || [[ -z "$appimage_file" ]]; then
        # Try manual download as final fallback
        appimage_file=$(cursor_manual_download)
        if [[ $? -ne 0 ]] || [[ -z "$appimage_file" ]]; then
            print_error_from_common_functions "Failed to find or download Cursor AppImage"
            return 1
        fi
    fi

    print_success_from_common_functions "Using Cursor AppImage: $(basename "$appimage_file")"

    # Extract AppImage
    if ! extract_appimage "$appimage_file"; then
        print_error_from_common_functions "Failed to extract Cursor AppImage"
        return 1
    fi

    # Create launcher script
    if ! create_launcher_script; then
        print_error_from_common_functions "Failed to create launcher script"
        return 1
    fi

    # Create desktop entry
    if ! create_desktop_entry; then
        print_error_from_common_functions "Failed to create desktop entry"
        return 1
    fi

    # Create installation flag
    print_step_from_common_functions "Creating installation flag..."
    $USE_SUDO mkdir -p "$(dirname "$CURSOR_INSTALLED_FLAG")"
    echo "$(date): Cursor installed successfully" | $USE_SUDO tee "$CURSOR_INSTALLED_FLAG" > /dev/null

    print_success_from_common_functions "Cursor IDE installation completed successfully!"
    print_info_from_common_functions "You can now launch Cursor from:"
    print_info_from_common_functions "  - Applications menu"
    print_info_from_common_functions "  - Command line: cursor"
    print_info_from_common_functions "  - Direct launcher: $CURSOR_LAUNCHER_SCRIPT"

    return 0
}

# Interactive cleanup prompt using centralized logic
prompt_cleanup_reinstall() {
    prompt_cleanup_reinstall "Cursor" "cursor" "$CURSOR_INSTALLED_FLAG" "cleanup_cursor"
}

# Main script execution
main() {
    # Parse arguments
    parse_arguments "$@"

    # Handle cleanup mode
    if [[ "$CLEANUP_MODE" == true ]]; then
        cleanup_cursor
        exit $?
    fi

    # Check if we have a desktop environment (Cursor is a GUI application)
    # Only skip if we're on a pure server without any desktop environment
    if [[ "$HAS_DESKTOP_ENVIRONMENT" != true ]] && [[ "$IS_WSL" != true ]] && [[ "$IS_PRODUCTION" == true ]]; then
        print_info_from_common_functions "[$SCRIPT_INDEX] Skipping Cursor installation (production server without desktop environment)"
        print_info_from_common_functions "[$SCRIPT_INDEX] Cursor requires a desktop environment to run"
        exit 0
    fi

    print_header_from_common_functions "Cursor IDE Installation Script"
    print_info_from_common_functions "Installation Directory: $CURSOR_INSTALL_DIR"

    # Interactive cleanup prompt (unless force install is specified)
    if [[ "$FORCE_INSTALL" != true ]]; then
        if ! prompt_cleanup_reinstall; then
            exit 0
        fi
    fi

    # Run installation
    install_cursor
    exit $?
}

# Run main function with all arguments
main "$@"
