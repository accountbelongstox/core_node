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
# Source simple download manager
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEBIAN_COM_DIR="$(dirname "$SCRIPT_DIR")/debian_com"
source "$DEBIAN_COM_DIR/simple_download_manager.sh"


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
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_1/debian_com/installation_library.sh"

# Declare variables
INSTALL_MODE=$(get_var "INSTALL_MODE" "base")
FORCE_INSTALL=false
CLEANUP_MODE=false

# Cursor installation directories using map_web_path
APPLICATIONS_DIR=$(map_web_path "compile_dir" "applications")
CURSOR_INSTALL_DIR="$APPLICATIONS_DIR/cursor"
CURSOR_APPIMAGE_DIR="$CURSOR_INSTALL_DIR/appimage"
CURSOR_EXTRACTED_DIR="$CURSOR_INSTALL_DIR/extracted"
CURSOR_BIN_DIR="$CURSOR_INSTALL_DIR/bin"
CURSOR_INSTALLED_FLAG="$CURSOR_INSTALL_DIR/.installed"
CURSOR_LAUNCHER_SCRIPT="/usr/local/super_scripts/cursor.sh"
CURSOR_DESKTOP_FILE="/usr/share/applications/cursor.desktop"

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

# Extract version from filename
extract_version_from_filename() {
    local filename="$1"
    local basename_file=$(basename "$filename")

    # Extract version pattern: cursor_1.7.54_amd64.deb -> 1.7.54
    if [[ "$basename_file" =~ cursor[_-]([0-9]+\.[0-9]+\.[0-9]+) ]]; then
        echo "${BASH_REMATCH[1]}"
        return 0
    fi

    # Extract version pattern: cursor-0.42.4x86_64.AppImage -> 0.42.4
    if [[ "$basename_file" =~ cursor[_-]([0-9]+\.[0-9]+\.[0-9]+) ]]; then
        echo "${BASH_REMATCH[1]}"
        return 0
    fi

    return 1
}

# Get installed version
get_installed_version() {
    if [[ -f "$CURSOR_INSTALLED_FLAG" ]]; then
        grep "^VERSION=" "$CURSOR_INSTALLED_FLAG" 2>/dev/null | cut -d= -f2
    fi
}

# Save installation info
save_installation_info() {
    local version="$1"
    local package_file="$2"

    $USE_SUDO mkdir -p "$(dirname "$CURSOR_INSTALLED_FLAG")"
    cat <<EOF | $USE_SUDO tee "$CURSOR_INSTALLED_FLAG" > /dev/null
DATE=$(date '+%Y-%m-%d %H:%M:%S')
VERSION=$version
PACKAGE=$(basename "$package_file")
PATH=$package_file
EOF
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

# Find Cursor files in all user Downloads directories
find_cursor_file() {
    local search_dirs=()

    # Add global shared download directory first (highest priority)
    if [ -n "$CORE_NODE_SHARED_DOWNLOADS" ] && [ -d "$CORE_NODE_SHARED_DOWNLOADS" ]; then
        search_dirs+=("$CORE_NODE_SHARED_DOWNLOADS")
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

    # Add root's Downloads
    if [ -d "/root/Downloads" ]; then
        search_dirs+=("/root/Downloads")
    fi

    # Search for .deb files first (sort by modification time, newest first)
    for dir in "${search_dirs[@]}"; do
        local deb_file=$(find "$dir" -maxdepth 1 -name "cursor*.deb" -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)
        if [[ -n "$deb_file" ]]; then
            echo "$deb_file"
            return 0
        fi
    done

    # Search for .AppImage files (sort by modification time, newest first)
    for dir in "${search_dirs[@]}"; do
        local appimage_file=$(find "$dir" -maxdepth 1 -name "cursor*.AppImage" -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)
        if [[ -n "$appimage_file" ]]; then
            echo "$appimage_file"
            return 0
        fi
    done

    return 1
}

find_cursor_appimage() {
    find_cursor_file
}

# Smart automated download - checks if already downloaded, skips if exists
cursor_automated_download() {
    print_step_from_common_functions "Checking for existing downloads..."
    
    # Check if both files already exist
    local vscode_file=$(find_vscode_file)
    local cursor_file=$(find_cursor_file)
    
    if [[ -n "$vscode_file" ]] && [[ -f "$vscode_file" ]] && [[ -n "$cursor_file" ]] && [[ -f "$cursor_file" ]]; then
        print_success_from_common_functions "Both VSCode and Cursor already downloaded, skipping download"
        print_info_from_common_functions "Using existing Cursor: $(basename "$cursor_file")"
        echo "$cursor_file"
        return 0
    fi
    
    # If not both exist, download both
    print_step_from_common_functions "Downloading VSCode and Cursor via core_node_init..."
    if download_both; then
        local cursor_file=$(find_cursor_file)
        if [[ -n "$cursor_file" ]] && [[ -f "$cursor_file" ]]; then
            print_success_from_common_functions "Found downloaded Cursor: $(basename "$cursor_file")"
            echo "$cursor_file"
            return 0
        fi
    fi
    
    print_warning_from_common_functions "Cursor download failed"
    return 1
}

# Safe process kill function
safe_kill_processes() {
    local process_name="$1"
    local use_sudo="${2:-false}"

    local pids=$(pgrep -f "$process_name" 2>/dev/null)

    if [[ -z "$pids" ]]; then
        print_info_from_common_functions "No $process_name processes found"
        return 0
    fi

    print_info_from_common_functions "Found $process_name processes: $pids"

    # Try graceful termination first (SIGTERM)
    for pid in $pids; do
        if [[ "$use_sudo" == "true" ]]; then
            $USE_SUDO kill -15 "$pid" 2>/dev/null || true
        else
            kill -15 "$pid" 2>/dev/null || true
        fi
    done

    # Wait up to 5 seconds for processes to terminate
    local waited=0
    while [[ $waited -lt 5 ]]; do
        pids=$(pgrep -f "$process_name" 2>/dev/null)
        if [[ -z "$pids" ]]; then
            print_success_from_common_functions "$process_name processes terminated gracefully"
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
    done

    # Force kill if still running (SIGKILL)
    pids=$(pgrep -f "$process_name" 2>/dev/null)
    if [[ -n "$pids" ]]; then
        print_warning_from_common_functions "Force killing remaining $process_name processes: $pids"
        for pid in $pids; do
            if [[ "$use_sudo" == "true" ]]; then
                $USE_SUDO kill -9 "$pid" 2>/dev/null || true
            else
                kill -9 "$pid" 2>/dev/null || true
            fi
        done
        sleep 1
    fi

    # Verify all processes are gone
    pids=$(pgrep -f "$process_name" 2>/dev/null)
    if [[ -z "$pids" ]]; then
        print_success_from_common_functions "All $process_name processes terminated"
        return 0
    else
        print_error_from_common_functions "Failed to terminate some $process_name processes: $pids"
        return 1
    fi
}

# Manual download fallback
cursor_manual_download() {
    print_step_from_common_functions "Falling back to manual download..."

    # Open Cursor download page
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "https://cursor.sh/" >/dev/null 2>&1 &
    fi

    print_info_from_common_functions "Please download Cursor .deb file to Downloads directory"
    print_info_from_common_functions "Waiting for download to complete..."

    # Wait for file to appear
    local downloaded_file=$(find_cursor_appimage)
    if [[ -n "$downloaded_file" ]] && [[ -f "$downloaded_file" ]]; then
        print_success_from_common_functions "Found Cursor file: $(basename "$downloaded_file")"
        echo "$downloaded_file"
        return 0
    else
        print_error_from_common_functions "Timeout waiting for Cursor file download"
        return 1
    fi
}

# Check .deb file integrity
check_deb_integrity() {
    local deb_file="$1"

    print_step_from_common_functions "Checking .deb file integrity..."

    if [[ ! -f "$deb_file" ]]; then
        print_error_from_common_functions ".deb file not found: $deb_file"
        return 1
    fi

    local file_size=$(stat -c%s "$deb_file" 2>/dev/null || echo "0")

    if [[ "$file_size" -lt 50000000 ]]; then
        print_warning_from_common_functions ".deb file too small ($file_size bytes), expected > 50MB"
        return 1
    fi

    if ! dpkg-deb --info "$deb_file" >/dev/null 2>&1; then
        print_warning_from_common_functions ".deb file is corrupted (dpkg-deb check failed)"
        return 1
    fi

    if ! ar t "$deb_file" >/dev/null 2>&1; then
        print_warning_from_common_functions ".deb file is corrupted (ar archive check failed)"
        return 1
    fi

    print_success_from_common_functions ".deb file integrity check passed"
    return 0
}

# Install Cursor from .deb package
install_deb_package() {
    local deb_file="$1"

    print_step_from_common_functions "Installing Cursor from .deb package..."

    if ! check_deb_integrity "$deb_file"; then
        print_error_from_common_functions ".deb file integrity check failed"
        print_step_from_common_functions "Removing corrupted file: $deb_file"
        rm -f "$deb_file"
        return 2
    fi

    # Create directories for tracking
    $USE_SUDO mkdir -p "$CURSOR_APPIMAGE_DIR" "$CURSOR_BIN_DIR"

    # Copy deb file to installation directory for backup
    print_step_from_common_functions "Backing up .deb file to $CURSOR_APPIMAGE_DIR"
    $USE_SUDO cp "$deb_file" "$CURSOR_APPIMAGE_DIR/"

    # Install the .deb package
    print_step_from_common_functions "Installing Cursor via dpkg..."
    if $USE_SUDO dpkg -i "$deb_file"; then
        print_success_from_common_functions "Cursor .deb package installed successfully"
    else
        print_warning_from_common_functions "dpkg installation had issues, attempting to fix dependencies..."
        $USE_SUDO apt-get install -f -y
    fi

    # Verify installation
    if ! dpkg -l | grep -q "^ii.*cursor"; then
        print_error_from_common_functions "Cursor package installation failed"
        print_step_from_common_functions "Removing corrupted backup file..."
        $USE_SUDO rm -f "$CURSOR_APPIMAGE_DIR/$(basename "$deb_file")" 2>/dev/null || true
        return 1
    fi

    print_success_from_common_functions "Cursor installed successfully via dpkg"
    return 0
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

# Create launcher script for .deb installation
create_launcher_script_deb() {
    print_step_from_common_functions "Creating Cursor launcher script for .deb installation..."

    # For .deb installation, cursor is installed at /usr/bin/cursor
    local super_launcher_content='#!/bin/bash
# Cursor IDE Super Launcher Script (DEB Installation)
# This script calls the system-installed cursor with --no-sandbox flag

CURSOR_BIN="/usr/bin/cursor"

if [[ ! -f "$CURSOR_BIN" ]]; then
    echo "Error: Cursor not found at $CURSOR_BIN"
    echo "Please reinstall Cursor"
    exit 1
fi

# Launch Cursor with --no-sandbox (required for root execution)
exec "$CURSOR_BIN" --no-sandbox "$@"
'

    if command -v sudo >/dev/null 2>&1; then
        sudo mkdir -p "/usr/local/super_scripts"
        echo "$super_launcher_content" | sudo tee "/usr/local/super_scripts/cursor.sh" > /dev/null
        sudo chmod +x "/usr/local/super_scripts/cursor.sh"

        # Remove old symlink if exists and create new one
        sudo rm -f "/usr/local/bin/cursor"
        sudo ln -sf "/usr/local/super_scripts/cursor.sh" "/usr/local/bin/cursor"
    else
        mkdir -p "/usr/local/super_scripts"
        echo "$super_launcher_content" | tee "/usr/local/super_scripts/cursor.sh" > /dev/null
        chmod +x "/usr/local/super_scripts/cursor.sh"

        rm -f "/usr/local/bin/cursor"
        ln -sf "/usr/local/super_scripts/cursor.sh" "/usr/local/bin/cursor"
    fi

    return 0
}

# Create launcher script for AppImage installation
create_launcher_script_appimage() {
    print_step_from_common_functions "Creating Cursor launcher script for AppImage installation..."

    local super_launcher_content='#!/bin/bash
# Cursor IDE Super Launcher Script (AppImage Installation)
# This script calls the extracted AppImage AppRun with --no-sandbox flag

CURSOR_EXTRACTED_DIR="'"$CURSOR_EXTRACTED_DIR"'"
CURSOR_APPRUN="$CURSOR_EXTRACTED_DIR/squashfs-root/AppRun"

if [[ ! -f "$CURSOR_APPRUN" ]]; then
    echo "Error: Cursor AppRun not found at $CURSOR_APPRUN"
    echo "Please reinstall Cursor"
    exit 1
fi

# Launch Cursor with --no-sandbox (required for root execution)
exec "$CURSOR_APPRUN" --no-sandbox "$@"
'

    if command -v sudo >/dev/null 2>&1; then
        sudo mkdir -p "/usr/local/super_scripts"
        echo "$super_launcher_content" | sudo tee "/usr/local/super_scripts/cursor.sh" > /dev/null
        sudo chmod +x "/usr/local/super_scripts/cursor.sh"

        # Remove old symlink if exists and create new one
        sudo rm -f "/usr/local/bin/cursor"
        sudo ln -sf "/usr/local/super_scripts/cursor.sh" "/usr/local/bin/cursor"
    else
        mkdir -p "/usr/local/super_scripts"
        echo "$super_launcher_content" | tee "/usr/local/super_scripts/cursor.sh" > /dev/null
        chmod +x "/usr/local/super_scripts/cursor.sh"

        rm -f "/usr/local/bin/cursor"
        ln -sf "/usr/local/super_scripts/cursor.sh" "/usr/local/bin/cursor"
    fi

    return 0
}

# Create launcher script with sudo and --no-sandbox (backwards compatibility wrapper)
create_launcher_script() {
    create_launcher_script_appimage
}

# Create desktop entry
create_desktop_entry() {
    print_step_from_common_functions "Configuring desktop entry..."

    # Check if desktop file already exists (from .deb installation)
    if [[ -f "$CURSOR_DESKTOP_FILE" ]] && dpkg -l | grep -q "^ii.*cursor"; then
        # .deb installation: modify existing desktop file to use wrapper script
        print_info_from_common_functions "Modifying existing desktop file for wrapper script..."

        # Backup original
        $USE_SUDO cp "$CURSOR_DESKTOP_FILE" "${CURSOR_DESKTOP_FILE}.backup" 2>/dev/null || true

        # Replace Exec lines to use wrapper script
        $USE_SUDO sed -i 's|^Exec=/usr/share/cursor/cursor|Exec=/usr/local/super_scripts/cursor.sh|g' "$CURSOR_DESKTOP_FILE"

        print_success_from_common_functions "Desktop entry updated to use wrapper script"
    else
        # AppImage installation: create complete desktop file
        print_info_from_common_functions "Creating desktop file for AppImage installation..."

        local icon_path="$CURSOR_EXTRACTED_DIR/squashfs-root/cursor.png"
        if [[ ! -f "$icon_path" ]]; then
            icon_path=$(find "$CURSOR_EXTRACTED_DIR/squashfs-root" -name "*.png" -type f 2>/dev/null | head -1)
            if [[ -z "$icon_path" ]]; then
                icon_path="cursor"
            fi
        fi

        local desktop_content="[Desktop Entry]
Name=Cursor
Comment=The AI Code Editor.
GenericName=Text Editor
Exec=/usr/local/super_scripts/cursor.sh %F
Icon=$icon_path
Type=Application
Categories=TextEditor;Development;IDE;
MimeType=application/x-cursor-workspace;text/plain;text/x-chdr;text/x-csrc;text/x-c++hdr;text/x-c++src;text/x-java;text/x-dsrc;text/x-pascal;text/x-perl;text/x-python;application/x-php;application/x-httpd-php3;application/x-httpd-php4;application/x-httpd-php5;text/x-sql;text/x-diff;
Actions=new-empty-window;
StartupNotify=false
StartupWMClass=Cursor
Keywords=cursor;

[Desktop Action new-empty-window]
Name=New Empty Window
Exec=/usr/local/super_scripts/cursor.sh --new-window %F
Icon=$icon_path
"

        echo "$desktop_content" | $USE_SUDO tee "$CURSOR_DESKTOP_FILE" > /dev/null
        $USE_SUDO chmod 644 "$CURSOR_DESKTOP_FILE"

        print_success_from_common_functions "Desktop entry created"
    fi

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

    # Terminate Cursor processes using safe method
    print_step_from_common_functions "Terminating Cursor processes..."
    safe_kill_processes "cursor" true

    # Check if Cursor is installed via dpkg and remove it
    if dpkg -l | grep -q "^ii.*cursor"; then
        print_step_from_common_functions "Removing Cursor .deb package..."
        $USE_SUDO dpkg --purge cursor 2>/dev/null || true
        $USE_SUDO apt-get remove --purge -y cursor 2>/dev/null || true
    fi

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

    # Remove launcher script
    if [[ -f "/usr/local/super_scripts/cursor.sh" ]]; then
        print_step_from_common_functions "Removing launcher script: /usr/local/super_scripts/cursor.sh"
        $USE_SUDO rm -f "/usr/local/super_scripts/cursor.sh"
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

    # Use simple download manager workflow
    print_step_from_common_functions "Starting Cursor download workflow..."

    # Check if already downloaded
    local cursor_file=$(find_cursor_file)

    if [[ -z "$cursor_file" ]] || [[ ! -f "$cursor_file" ]] || [[ "$FORCE_INSTALL" == true ]]; then
        print_step_from_common_functions "Downloading Cursor via core_node_init..."

        # Download using core_node_init
        if download_cursor; then
            print_success_from_common_functions "Download completed"

            # Find the downloaded file
            sleep 2  # Wait for file to be fully written
            cursor_file=$(find_cursor_file)
        else
            print_warning_from_common_functions "Automated download failed"
        fi
    else
        print_info_from_common_functions "Found existing Cursor file: $(basename "$cursor_file")"
    fi

    # Validate the result
    if [[ -z "$cursor_file" ]] || [[ ! -f "$cursor_file" ]]; then
        print_warning_from_common_functions "Download failed, trying manual download..."

        # Try manual download as final fallback
        cursor_file=$(cursor_manual_download)
        local manual_result=$?

        if [[ $manual_result -ne 0 ]] || [[ -z "$cursor_file" ]] || [[ ! -f "$cursor_file" ]]; then
            print_error_from_common_functions "Failed to find or download Cursor file"
            return 1
        fi
    fi

    print_success_from_common_functions "Using Cursor file: $(basename "$cursor_file")"

    # Detect file type and install accordingly
    local file_extension="${cursor_file##*.}"

    if [[ "$file_extension" == "deb" ]]; then
        print_info_from_common_functions "Detected .deb package, using dpkg installation..."

        # Install .deb package with automatic retry on corruption
        local install_result
        local max_retries=2
        local retry_count=0

        while [[ $retry_count -lt $max_retries ]]; do
            install_deb_package "$cursor_file"
            install_result=$?

            if [[ $install_result -eq 0 ]]; then
                break
            elif [[ $install_result -eq 2 ]]; then
                print_warning_from_common_functions "Corrupted .deb detected (attempt $((retry_count + 1))/$max_retries)"

                if [[ $retry_count -lt $((max_retries - 1)) ]]; then
                    print_step_from_common_functions "Removing corrupted backup file..."
                    $USE_SUDO rm -f "$CURSOR_APPIMAGE_DIR/$(basename "$cursor_file")" 2>/dev/null || true

                    print_step_from_common_functions "Re-downloading Cursor..."

                    if download_cursor; then
                        sleep 2  # Wait for file to be fully written
                        cursor_file=$(find_cursor_file)

                        if [[ -z "$cursor_file" ]] || [[ ! -f "$cursor_file" ]]; then
                            print_error_from_common_functions "Re-download failed - file not found"
                            return 1
                        fi

                        print_info_from_common_functions "Using re-downloaded file: $(basename "$cursor_file")"
                    else
                        print_error_from_common_functions "Re-download failed"
                        return 1
                    fi
                fi

                retry_count=$((retry_count + 1))
            else
                print_error_from_common_functions "Failed to install Cursor .deb package"
                return 1
            fi
        done

        if [[ $install_result -ne 0 ]]; then
            print_error_from_common_functions "Failed to install Cursor after $max_retries attempts"
            return 1
        fi

        # Create launcher script for .deb installation
        if ! create_launcher_script_deb; then
            print_error_from_common_functions "Failed to create launcher script"
            return 1
        fi

    elif [[ "$file_extension" == "AppImage" ]]; then
        print_info_from_common_functions "Detected AppImage, using extraction method..."

        # Extract AppImage
        if ! extract_appimage "$cursor_file"; then
            print_error_from_common_functions "Failed to extract Cursor AppImage"
            return 1
        fi

        # Create launcher script for AppImage installation
        if ! create_launcher_script_appimage; then
            print_error_from_common_functions "Failed to create launcher script"
            return 1
        fi

    else
        print_error_from_common_functions "Unknown file type: $file_extension"
        print_error_from_common_functions "Expected .deb or .AppImage"
        return 1
    fi

    # Create desktop entry
    if ! create_desktop_entry; then
        print_error_from_common_functions "Failed to create desktop entry"
        return 1
    fi

    # Save installation info with version
    print_step_from_common_functions "Saving installation info..."
    local installed_version=$(extract_version_from_filename "$cursor_file")
    if [[ -n "$installed_version" ]]; then
        save_installation_info "$installed_version" "$cursor_file"
        print_info_from_common_functions "Installed version: $installed_version"
    else
        # Fallback if version extraction fails
        $USE_SUDO mkdir -p "$(dirname "$CURSOR_INSTALLED_FLAG")"
        echo "$(date): Cursor installed successfully from $file_extension" | $USE_SUDO tee "$CURSOR_INSTALLED_FLAG" > /dev/null
    fi

    print_success_from_common_functions "Cursor IDE installation completed successfully!"
    print_info_from_common_functions "You can now launch Cursor from:"
    print_info_from_common_functions "  - Applications menu"
    print_info_from_common_functions "  - Command line: cursor"
    print_info_from_common_functions "  - Direct launcher: /usr/local/super_scripts/cursor.sh"

    return 0
}

# Interactive cleanup prompt with version check
prompt_cleanup_reinstall() {
    if is_cursor_installed; then
        print_warning_from_common_functions "Cursor is already installed"

        local installed_version=$(get_installed_version)
        if [[ -n "$installed_version" ]]; then
            print_info_from_common_functions "Installed version: $installed_version"
        else
            print_info_from_common_functions "No version metadata found for current installation"
        fi

        print_step_from_common_functions "Downloading latest version to check for updates..."

        if download_cursor; then
            sleep 2

            local available_file=$(find_cursor_file)
            if [[ -n "$available_file" ]] && [[ -f "$available_file" ]]; then
                local available_version=$(extract_version_from_filename "$available_file")
                print_info_from_common_functions "Downloaded: $(basename "$available_file")"

                if [[ -n "$available_version" ]]; then
                    print_info_from_common_functions "Downloaded version: $available_version"

                    if [[ -z "$installed_version" ]]; then
                        print_info_from_common_functions "No version metadata, proceeding with upgrade..."
                        cleanup_cursor
                        return 0
                    elif [[ "$available_version" != "$installed_version" ]]; then
                        echo -n "Upgrade to version $available_version? (Y/n): "
                        read -r response
                        case "$response" in
                            [nN]|[nN][oO])
                                print_info_from_common_functions "Keeping current installation"
                                return 1
                                ;;
                            *)
                                print_info_from_common_functions "Upgrading Cursor..."
                                cleanup_cursor
                                return 0
                                ;;
                        esac
                    else
                        print_info_from_common_functions "Downloaded version matches installed version"
                        print_info_from_common_functions "You can update to the latest build or fix potential issues"
                        echo -n "Update Cursor? (y/N): "
                        read -r response
                        case "$response" in
                            [yY]|[yY][eE][sS])
                                print_info_from_common_functions "Updating Cursor..."
                                cleanup_cursor
                                return 0
                                ;;
                            *)
                                print_info_from_common_functions "Keeping existing installation"
                                return 1
                                ;;
                        esac
                    fi
                fi
            fi
        else
            print_warning_from_common_functions "Failed to download latest version"
        fi

        local available_file=$(find_cursor_file)
        if [[ -n "$available_file" ]] && [[ -f "$available_file" ]]; then
            print_info_from_common_functions "Found existing download: $(basename "$available_file")"
            local available_version=$(extract_version_from_filename "$available_file")

            if [[ -n "$available_version" ]] && [[ -n "$installed_version" ]]; then
                if [[ "$available_version" != "$installed_version" ]]; then
                    echo -n "Upgrade to version $available_version? (Y/n): "
                    read -r response
                    case "$response" in
                        [nN]|[nN][oO])
                            print_info_from_common_functions "Keeping current installation"
                            return 1
                            ;;
                        *)
                            print_info_from_common_functions "Upgrading Cursor..."
                            cleanup_cursor
                            return 0
                            ;;
                    esac
                else
                    echo -n "Update Cursor? (y/N): "
                    read -r response
                    case "$response" in
                        [yY]|[yY][eE][sS])
                            print_info_from_common_functions "Updating Cursor..."
                            cleanup_cursor
                            return 0
                            ;;
                        *)
                            print_info_from_common_functions "Keeping existing installation"
                            return 1
                            ;;
                    esac
                fi
            fi
        fi

        print_info_from_common_functions "Current installation: $CURSOR_INSTALL_DIR"
        echo -n "Clean up and update? (y/N): "
        read -r response
        case "$response" in
            [yY]|[yY][eE][sS])
                print_info_from_common_functions "Cleaning up existing installation..."
                cleanup_cursor
                return 0
                ;;
            *)
                print_info_from_common_functions "Keeping existing installation"
                return 1
                ;;
        esac
    fi
    return 0
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
