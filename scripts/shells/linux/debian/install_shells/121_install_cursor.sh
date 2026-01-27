#!/bin/bash
# Cursor IDE Installation Script
#
# Usage:
#   ./121_install_cursor.sh   # Normal installation (no arguments)
#
# This script installs Cursor IDE using installer files stored in ~/Downloads or /home/*/Downloads
# If no installer is found, it opens the Cursor download page and waits for the user to download manually
#
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
source "$PARENT_DIR_LEVEL_2/common/installation_library.sh"

# Declare variables
INSTALL_MODE=$(get_var "INSTALL_MODE" "base")
USE_ROOT_MODE=true  # Default to root mode (pkexec)

# Cursor API configuration
# NOTE: Do NOT hardcode a specific version here.
# The API endpoint will redirect to the latest available Cursor build,
# and the actual version is detected dynamically via redirects.
CURSOR_API_URL="https://api2.cursor.sh/updates/download/golden/linux-x64/cursor/"

# Cursor installation directories using map_web_path
APPLICATIONS_DIR=$(map_web_path "compile_dir" "applications")
CURSOR_INSTALL_DIR="$APPLICATIONS_DIR/cursor"
CURSOR_PACKAGE_DIR="$CURSOR_INSTALL_DIR/packages"
CURSOR_EXTRACTED_DIR="$CURSOR_INSTALL_DIR/extracted"
CURSOR_BIN_DIR="$CURSOR_INSTALL_DIR/bin"

# Version tracking using GLOBAL_VAR_DIR
APP_VERSIONS_DIR="$GLOBAL_VAR_DIR/app_versions"
CURSOR_INSTALLED_FLAG="$APP_VERSIONS_DIR/cursor.version"
CURSOR_DOWNLOAD_URL="https://cursor.com/download"
MANUAL_DOWNLOAD_PROMPT_INTERVAL=5
PRIMARY_DOWNLOAD_DIR="$HOME/Downloads"
CURRENT_SCRIPT_PID=$$
PARENT_SCRIPT_PID=$PPID
SCRIPT_BASHPID=${BASHPID:-$$}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# No arguments supported (removed parameter parsing)

# Extract version from filename (use full filename without extension as version)
# Example: "Cursor-2.1.41-x86_64.AppImage" -> "Cursor-2.1.41-x86_64"
extract_version_from_filename() {
    local filename="$1"
    local basename_file=$(basename "$filename")

    # Remove file extension (.AppImage, .deb, etc.)
    local version_string="${basename_file%.*}"

    if [[ -n "$version_string" ]]; then
        echo "$version_string"
        return 0
    fi

    return 1
}

# Get remote version from Cursor API by following redirects
# Returns: Version string (e.g., "Cursor-2.1.41-x86_64") or empty string if not found
get_remote_cursor_version() {
    local api_url="$CURSOR_API_URL"
    local user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    local final_url=""

    # Try wget first
    if command -v wget >/dev/null 2>&1; then
        final_url=$(wget --spider --server-response \
            --user-agent="$user_agent" \
            --max-redirect=10 \
            "$api_url" 2>&1 | grep -i "Location:" | tail -1 | awk '{print $2}' | tr -d '\r')
    fi

    # Try curl if wget failed
    if [[ -z "$final_url" ]] && command -v curl >/dev/null 2>&1; then
        final_url=$(curl -sIL \
            -A "$user_agent" \
            --max-redirs 10 \
            "$api_url" | grep -i "^location:" | tail -1 | awk '{print $2}' | tr -d '\r')
    fi

    if [[ -z "$final_url" ]]; then
        return 1
    fi

    # Extract filename from URL and remove extension
    local filename=$(basename "$final_url")
    filename="${filename%%\?*}"  # Remove query parameters
    local version_string="${filename%.*}"  # Remove extension

    if [[ -n "$version_string" ]]; then
        echo "$version_string"
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

# Get installed type
get_installed_type() {
    if [[ -f "$CURSOR_INSTALLED_FLAG" ]]; then
        grep "^TYPE=" "$CURSOR_INSTALLED_FLAG" 2>/dev/null | cut -d= -f2
    fi
}

# Save installation info
save_installation_info() {
    local version="$1"
    local package_file="$2"
    local install_type="$3"

    # Create app versions directory if it doesn't exist
    $USE_SUDO mkdir -p "$APP_VERSIONS_DIR"

    # Save version info to GLOBAL_VAR_DIR
    cat <<EOF | $USE_SUDO tee "$CURSOR_INSTALLED_FLAG" > /dev/null
DATE=$(date '+%Y-%m-%d %H:%M:%S')
VERSION=$version
TYPE=$install_type
PACKAGE=$(basename "$package_file")
PATH=$package_file
EOF
}

# Check if Cursor is already installed and configured
is_cursor_installed() {
    if [[ -f "$CURSOR_INSTALLED_FLAG" ]]; then
        return 0  # Installed
    fi
    return 1  # Not installed
}

# DEPRECATED: This function is no longer used
# Use find_file_in_downloads_from_common_functions() instead
# Find Cursor files in all user Downloads directories
# Returns: "appimage:<path>" or "deb:<path>" or "both:<appimage_path>:<deb_path>"
find_cursor_files_deprecated() {
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

    # Search for both AppImage and .deb files
    local appimage_file=""
    local deb_file=""

    # Search for .AppImage files (sort by modification time, newest first)
    for dir in "${search_dirs[@]}"; do
        local found_appimage=$(find "$dir" -maxdepth 1 -iname "cursor*.AppImage" -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)
        if [[ -n "$found_appimage" ]]; then
            appimage_file="$found_appimage"
            break
        fi
    done

    # Search for .deb files (sort by modification time, newest first)
    for dir in "${search_dirs[@]}"; do
        local found_deb=$(find "$dir" -maxdepth 1 -iname "cursor*.deb" -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)
        if [[ -n "$found_deb" ]]; then
            deb_file="$found_deb"
            break
        fi
    done

    # Return results based on what was found
    if [[ -n "$appimage_file" ]] && [[ -n "$deb_file" ]]; then
        echo "both:$appimage_file:$deb_file"
        return 0
    elif [[ -n "$appimage_file" ]]; then
        echo "appimage:$appimage_file"
        return 0
    elif [[ -n "$deb_file" ]]; then
        echo "deb:$deb_file"
        return 0
    fi

    return 1
}

# Remove old installer files from Downloads directories
find_and_remove_old_installers() {
    local pattern="$1"
    local search_dirs=()

    # Add global shared download directory first
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

    # Find and remove matching files
    local files_removed=0
    for dir in "${search_dirs[@]}"; do
        while IFS= read -r -d '' file; do
            print_info_from_common_functions "  Removing: $(basename "$file")"
            rm -f "$file" 2>/dev/null || true
            files_removed=$((files_removed + 1))
        done < <(find "$dir" -maxdepth 1 -iname "$pattern" -type f -print0 2>/dev/null)
    done

    if [[ $files_removed -gt 0 ]]; then
        print_success_from_common_functions "Removed $files_removed old installer file(s)"
    else
        print_info_from_common_functions "No old installer files found to remove"
    fi

    return 0
}

# Filter out installer-related PIDs when terminating processes
should_skip_pid() {
    local pid="$1"

    if [[ -z "$pid" ]]; then
        return 0
    fi

    if [[ -n "$CURRENT_SCRIPT_PID" ]] && [[ "$pid" == "$CURRENT_SCRIPT_PID" ]]; then
        return 0
    fi

    if [[ -n "$PARENT_SCRIPT_PID" ]] && [[ "$pid" == "$PARENT_SCRIPT_PID" ]]; then
        return 0
    fi

    if [[ -n "$SCRIPT_BASHPID" ]] && [[ "$pid" == "$SCRIPT_BASHPID" ]]; then
        return 0
    fi

    if [[ -n "$BASHPID" ]] && [[ "$pid" == "$BASHPID" ]]; then
        return 0
    fi

    return 1
}

get_filtered_process_pids() {
    local process_name="$1"
    local raw_pids
    local filtered_pids=""

    raw_pids=$(pgrep -f "$process_name" 2>/dev/null)

    for pid in $raw_pids; do
        if should_skip_pid "$pid"; then
            continue
        fi

        if [[ -z "$filtered_pids" ]]; then
            filtered_pids="$pid"
        else
            filtered_pids="$filtered_pids $pid"
        fi
    done

    echo "$filtered_pids"
}

# Safe process kill function
safe_kill_processes() {
    local process_name="$1"
    local use_sudo="${2:-false}"

    local pids=$(get_filtered_process_pids "$process_name")

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
        pids=$(get_filtered_process_pids "$process_name")
        if [[ -z "$pids" ]]; then
            print_success_from_common_functions "$process_name processes terminated gracefully"
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
    done

    # Force kill if still running (SIGKILL)
    pids=$(get_filtered_process_pids "$process_name")
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
    pids=$(get_filtered_process_pids "$process_name")
    if [[ -z "$pids" ]]; then
        print_success_from_common_functions "All $process_name processes terminated"
        return 0
    else
        print_error_from_common_functions "Failed to terminate some $process_name processes: $pids"
        return 1
    fi
}

# Helper to open Cursor download page
open_cursor_download_page() {
    local download_url="${1:-$CURSOR_DOWNLOAD_URL}"

    print_info_from_common_functions "Cursor download page: $download_url"

    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$download_url" >/dev/null 2>&1 &
        print_info_from_common_functions "Opened $download_url in default browser"
    else
        print_info_from_common_functions "Please open $download_url manually in your browser"
    fi
}

print_manual_download_instructions() {
    print_info_from_common_functions "Download the latest Cursor .AppImage or .deb installer."
    print_info_from_common_functions "Note: AppImage is preferred over .deb"

    if [[ -n "$PRIMARY_DOWNLOAD_DIR" ]]; then
        print_info_from_common_functions "Save the file to $PRIMARY_DOWNLOAD_DIR (any /home/*/Downloads directory from any user is scanned automatically)."
    else
        print_info_from_common_functions "Save the file to any /home/*/Downloads directory (all users are scanned automatically)."
    fi
}

# DEPRECATED: This function is no longer used
# Use prompt_and_wait_for_download_from_common_functions() instead
# Manual download fallback
cursor_manual_download_deprecated() {
    local skip_initial_open="${1:-false}"
    print_step_from_common_functions "Manual download required"
    print_manual_download_instructions

    if [[ "$skip_initial_open" != "true" ]]; then
        open_cursor_download_page "$CURSOR_DOWNLOAD_URL"
    else
        print_info_from_common_functions "Re-using previously opened download page."
    fi

    local response=""
    local downloaded_file=""
    local download_hint="$PRIMARY_DOWNLOAD_DIR"
    local wait_counter=0

    if [[ -z "$download_hint" ]]; then
        download_hint="any /home/*/Downloads directory"
    fi

    print_info_from_common_functions "All /home/*/Downloads directories (including other users) are scanned continuously."

    while true; do
        downloaded_file=$(find_file_in_downloads_from_common_functions "cursor*.AppImage" "newest")

        if [[ -n "$downloaded_file" ]] && [[ -f "$downloaded_file" ]]; then
            print_success_from_common_functions "Detected Cursor installer: $(basename "$downloaded_file")"

            while true; do
                echo -n "Use $(basename "$downloaded_file") for installation? (yes/no/open/quit): "
                read -r response

                case "$response" in
                    [yY]|[yY][eE][sS])
                        echo "$downloaded_file"
                        return 0
                        ;;
                    [nN]|[nN][oO])
                        print_warning_from_common_functions "Waiting for a new download saved to $download_hint."
                        downloaded_file=""
                        break
                        ;;
                    [oO]|[oO][pP][eE][nN])
                        open_cursor_download_page "$CURSOR_DOWNLOAD_URL"
                        ;;
                    [qQ]|[qQ][uU][iI][tT])
                        print_error_from_common_functions "Manual download cancelled by user"
                        return 1
                        ;;
                    *)
                        print_info_from_common_functions "Type 'yes' to continue, 'no' to wait for another file, 'open' to reopen the page, or 'quit' to exit."
                        ;;
                esac
            done

            continue
        fi

        wait_counter=$((wait_counter + 1))
        print_info_from_common_functions "Waiting for Cursor installer... (check #$wait_counter)"
        echo -n "Type 'open' to reopen the download page, 'quit' to cancel, or press Enter to rescan: "

        if read -r -t "$MANUAL_DOWNLOAD_PROMPT_INTERVAL" response; then
            case "$response" in
                [oO]|[oO][pP][eE][nN])
                    open_cursor_download_page "$CURSOR_DOWNLOAD_URL"
                    ;;
                [qQ]|[qQ][uU][iI][tT])
                    print_error_from_common_functions "Manual download cancelled by user"
                    return 1
                    ;;
                *)
                    print_info_from_common_functions "Rescanning Downloads directories..."
                    ;;
            esac
        fi
    done
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
    $USE_SUDO mkdir -p "$CURSOR_PACKAGE_DIR" "$CURSOR_BIN_DIR"

    # Copy deb file to installation directory for backup
    print_step_from_common_functions "Backing up .deb file to $CURSOR_PACKAGE_DIR"
    $USE_SUDO cp "$deb_file" "$CURSOR_PACKAGE_DIR/"

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
        $USE_SUDO rm -f "$CURSOR_PACKAGE_DIR/$(basename "$deb_file")" 2>/dev/null || true
        return 1
    fi

    print_success_from_common_functions "Cursor installed successfully via dpkg"
    return 0
}

# Extract AppImage and fix permissions
extract_appimage() {
    local appimage_file="$1"

    print_step_from_common_functions "Extracting Cursor AppImage..."

    # Check file integrity before extraction
    if [[ ! -f "$appimage_file" ]]; then
        print_error_from_common_functions "AppImage file not found: $appimage_file"
        return 2
    fi

    local file_size=$(stat -c%s "$appimage_file" 2>/dev/null || echo "0")
    if [[ "$file_size" -lt 50000000 ]]; then
        print_error_from_common_functions "AppImage file too small ($file_size bytes), expected > 50MB"
        print_error_from_common_functions "File appears to be corrupted"
        return 2
    fi

    # Create directories
    $USE_SUDO mkdir -p "$CURSOR_PACKAGE_DIR" "$CURSOR_EXTRACTED_DIR" "$CURSOR_BIN_DIR"

    # Copy AppImage to installation directory
    print_step_from_common_functions "Copying AppImage to $CURSOR_PACKAGE_DIR"
    if ! $USE_SUDO cp "$appimage_file" "$CURSOR_PACKAGE_DIR/"; then
        print_error_from_common_functions "Failed to copy AppImage file (file may be corrupted)"
        return 2
    fi

    local appimage_name=$(basename "$appimage_file")
    local installed_appimage="$CURSOR_PACKAGE_DIR/$appimage_name"

    # Make AppImage executable
    $USE_SUDO chmod +x "$installed_appimage"

    # Extract AppImage
    print_step_from_common_functions "Extracting AppImage contents..."
    cd "$CURSOR_EXTRACTED_DIR"
    if ! $USE_SUDO "$installed_appimage" --appimage-extract >/dev/null 2>&1; then
        print_error_from_common_functions "Failed to extract AppImage (file may be corrupted)"
        return 2
    fi

    if [[ ! -d "$CURSOR_EXTRACTED_DIR/squashfs-root" ]]; then
        print_error_from_common_functions "Failed to extract AppImage (extraction incomplete)"
        return 2
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

# Note: Launcher scripts are now created by desktop_entry_manager.sh
# Old create_launcher_script_deb() and create_launcher_script_appimage() functions removed

# Detect desktop user for userdata directory
detect_cursor_desktop_user() {
    local detected_user=""
    local detected_home=""

    # Try SUDO_USER first (if running with sudo)
    if [[ -n "${SUDO_USER:-}" ]] && [[ "$SUDO_USER" != "root" ]]; then
        detected_user="$SUDO_USER"
        detected_home="$(getent passwd "$detected_user" 2>/dev/null | cut -d: -f6)"
        if [[ -n "$detected_home" ]] && [[ -d "$detected_home" ]]; then
            echo "$detected_user:$detected_home"
            return 0
        fi
    fi

    # Try finding user with active desktop session
    for user_home in /home/*; do
        if [[ -d "$user_home" ]]; then
            detected_user="$(basename "$user_home")"

            # Check for desktop session indicators
            if [[ -n "$(pgrep -u "$detected_user" 2>/dev/null)" ]] && \
               [[ -d "$user_home/.config" ]]; then
                echo "$detected_user:$user_home"
                return 0
            fi
        fi
    done

    # Fallback: first non-root user in /home with UID >= 1000
    for user_home in /home/*; do
        if [[ -d "$user_home" ]]; then
            detected_user="$(basename "$user_home")"
            local user_uid="$(id -u "$detected_user" 2>/dev/null || echo 0)"
            if [[ $user_uid -ge 1000 ]] && [[ $user_uid -lt 60000 ]]; then
                echo "$detected_user:$user_home"
                return 0
            fi
        fi
    done

    # Last resort: current user
    echo "$USER:$HOME"
}

# Create desktop entry via desktop_entry_manager
create_desktop_entry() {
    local desktop_manager_script="$PARENT_DIR_LEVEL_1/debian_com/desktop_entry_manager.sh"

    if [[ ! -x "$desktop_manager_script" ]]; then
        print_warning_from_common_functions "desktop_entry_manager.sh not found or not executable"
        return 0
    fi

    print_step_from_common_functions "Creating desktop entry via desktop_entry_manager.sh"

    # Detect desktop user
    local desktop_user_info="$(detect_cursor_desktop_user)"
    local desktop_manager_user="${desktop_user_info%%:*}"
    local desktop_manager_home="${desktop_user_info##*:}"
    local desktop_manager_apps_dir="$desktop_manager_home/.local/share/applications"

    print_info_from_common_functions "Detected desktop user: $desktop_manager_user ($desktop_manager_home)"

    # Determine binary and icon based on installation type
    # Use global variables so they're accessible in install_cursor()
    CURSOR_BINARY=""
    CURSOR_ICON=""

    if [[ -f "/usr/bin/cursor" ]] && dpkg -l | grep -q "^ii.*cursor"; then
        # .deb installation
        CURSOR_BINARY="/usr/bin/cursor"
        local icon_candidates=(
            "/usr/share/pixmaps/cursor.png"
            "/usr/share/icons/hicolor/128x128/apps/cursor.png"
            "/usr/share/icons/hicolor/256x256/apps/cursor.png"
            "/usr/share/icons/hicolor/512x512/apps/cursor.png"
        )
        CURSOR_ICON="cursor"
        for icon_path in "${icon_candidates[@]}"; do
            if [[ -f "$icon_path" ]]; then
                CURSOR_ICON="$icon_path"
                break
            fi
        done
    else
        # AppImage installation - prioritize co.anysphere.cursor.png
        CURSOR_BINARY="$CURSOR_EXTRACTED_DIR/squashfs-root/AppRun"
        local icon_candidates=(
            "$CURSOR_EXTRACTED_DIR/squashfs-root/co.anysphere.cursor.png"
            "$CURSOR_EXTRACTED_DIR/squashfs-root/cursor.png"
            "$CURSOR_EXTRACTED_DIR/squashfs-root/code.png"
        )
        CURSOR_ICON="cursor"
        for icon_path in "${icon_candidates[@]}"; do
            if [[ -f "$icon_path" ]]; then
                CURSOR_ICON="$icon_path"
                break
            fi
        done
    fi

    if [[ ! -x "$CURSOR_BINARY" ]]; then
        print_error_from_common_functions "Cursor binary not found at: $CURSOR_BINARY"
        print_error_from_common_functions "Installation may have failed"
        return 1
    fi

    print_step_from_common_functions "Using Cursor binary: $CURSOR_BINARY"
    print_step_from_common_functions "Using Cursor icon: $CURSOR_ICON"

    # Build user data directory path for Cursor
    CURSOR_USERDATA_DIR="$desktop_manager_home/.config/Cursor"
    print_info_from_common_functions "Cursor user data directory: $CURSOR_USERDATA_DIR"

    # Create user data directory if it doesn't exist
    if [[ ! -d "$CURSOR_USERDATA_DIR" ]]; then
        mkdir -p "$CURSOR_USERDATA_DIR" 2>/dev/null || true
        # Set ownership to desktop user if running as root
        if [[ "$USER" == "root" ]] && [[ -d "$CURSOR_USERDATA_DIR" ]]; then
            chown -R "$desktop_manager_user:$desktop_manager_user" "$CURSOR_USERDATA_DIR" 2>/dev/null || true
        fi
    fi

    # Use --create-app to generate launcher and desktop entry
    # desktop_entry_manager.sh will handle user detection and permissions automatically
    # Arguments: name display_name binary icon category description wm_class userdata_dir use_root_mode
    if bash "$desktop_manager_script" --create-app cursor "Cursor" "$CURSOR_BINARY" "$CURSOR_ICON" "Development;IDE" "The AI Code Editor" "Cursor" "$CURSOR_USERDATA_DIR" "$USE_ROOT_MODE" 2>&1; then
        local expected_entry="$desktop_manager_apps_dir/core_node_cursor.desktop"
        if [[ -f "$expected_entry" ]]; then
            print_success_from_common_functions "Desktop entry created for Cursor"

            # Disable system desktop entry if it exists (from .deb installation)
            local system_desktop="/usr/share/applications/cursor.desktop"
            if [[ -f "$system_desktop" ]]; then
                $USE_SUDO mv "$system_desktop" "${system_desktop}.disabled" 2>/dev/null || true
                print_info_from_common_functions "System desktop entry disabled to avoid duplicates"
            fi

            # Update desktop and icon cache
            print_step_from_common_functions "Updating desktop and icon caches..."
            if command -v update-desktop-database >/dev/null 2>&1; then
                update-desktop-database "$desktop_manager_apps_dir" 2>/dev/null || true
            fi

            # Clear icon cache
            if command -v gtk-update-icon-cache >/dev/null 2>&1; then
                for icon_theme in /usr/share/icons/hicolor /usr/share/icons/Yaru; do
                    if [[ -d "$icon_theme" ]]; then
                        $USE_SUDO gtk-update-icon-cache -f -t "$icon_theme" 2>/dev/null || true
                    fi
                done
            fi

            # Notify user about icon refresh
            if pgrep -x gnome-shell >/dev/null 2>&1; then
                print_info_from_common_functions "To refresh icons immediately:"
                print_info_from_common_functions "  Press Alt+F2, type 'r', press Enter (restarts GNOME Shell)"
                print_info_from_common_functions "  Or log out and log back in"
            fi
        else
            print_warning_from_common_functions "Desktop entry not found after creation: $expected_entry"
        fi
    else
        print_warning_from_common_functions "desktop_entry_manager.sh --create-app encountered an error"
    fi

    return 0
}

# Install required dependencies
install_dependencies() {
    print_step_from_common_functions "Checking dependencies..."

    # Note: libfuse2 is NOT installed on Ubuntu 24.04+ as it may cause system issues
    # AppImage is extracted and run directly from the extracted directory

    # Check Ubuntu version
    local ubuntu_version=$(lsb_release -rs 2>/dev/null || echo "unknown")
    if [[ "$ubuntu_version" == "24."* ]]; then
        print_info_from_common_functions "Ubuntu 24.04+ detected - using extracted AppImage (no libfuse2 needed)"
    elif [[ "$ubuntu_version" != "unknown" ]] && ! dpkg -l | grep -q libfuse2; then
        print_step_from_common_functions "Installing libfuse2 for Ubuntu < 24.04..."
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

    # Remove entire installation directory (includes packages, extracted files, and bin)
    if [[ -d "$CURSOR_INSTALL_DIR" ]]; then
        print_step_from_common_functions "Removing installation directory: $CURSOR_INSTALL_DIR"
        $USE_SUDO rm -rf "$CURSOR_INSTALL_DIR"
    fi

    # Remove launcher script (auto-generated by desktop_entry_manager)
    local desktop_manager_user="${SUDO_USER:-$USER}"
    local desktop_manager_home="$(getent passwd "$desktop_manager_user" | cut -d: -f6)"
    if [[ -z "$desktop_manager_home" ]] || [[ ! -d "$desktop_manager_home" ]]; then
        desktop_manager_home="$HOME"
    fi
    local launcher_script="/var/_core_node/scripts_launch_dir/cursor_launcher.sh"
    if [[ -e "$launcher_script" ]] || [[ -L "$launcher_script" ]]; then
        print_step_from_common_functions "Removing launcher script: $launcher_script"
        $USE_SUDO rm -f "$launcher_script"
    fi

    # Remove desktop entry (auto-generated by desktop_entry_manager)
    local desktop_entry="$desktop_manager_home/.local/share/applications/core_node_cursor.desktop"
    if [[ -f "$desktop_entry" ]]; then
        print_step_from_common_functions "Removing desktop entry: $desktop_entry"
        rm -f "$desktop_entry"
    fi

    # Remove installation flag
    if [[ -f "$CURSOR_INSTALLED_FLAG" ]]; then
        print_step_from_common_functions "Removing installation flag: $CURSOR_INSTALLED_FLAG"
        $USE_SUDO rm -f "$CURSOR_INSTALLED_FLAG"
    fi

    # Clean up ALL cursor desktop entries (including old ones)
    print_step_from_common_functions "Removing all Cursor desktop entries..."
    find "$desktop_manager_home/.local/share/applications" -name "*cursor*.desktop" -type f -delete 2>/dev/null || true

    # Remove system desktop entry (both enabled and disabled)
    local system_desktop="/usr/share/applications/cursor.desktop"
    if [[ -f "$system_desktop" ]]; then
        print_step_from_common_functions "Removing system desktop entry: $system_desktop"
        $USE_SUDO rm -f "$system_desktop"
    fi
    if [[ -f "${system_desktop}.disabled" ]]; then
        print_step_from_common_functions "Removing disabled system desktop entry: ${system_desktop}.disabled"
        $USE_SUDO rm -f "${system_desktop}.disabled"
    fi

    # Update desktop database and clear icon caches
    print_step_from_common_functions "Updating desktop databases and clearing icon caches..."
    if command -v update-desktop-database >/dev/null 2>&1; then
        update-desktop-database "$desktop_manager_home/.local/share/applications" 2>/dev/null || true
        $USE_SUDO update-desktop-database /usr/share/applications 2>/dev/null || true
    fi

    # Clear GTK icon cache
    if command -v gtk-update-icon-cache >/dev/null 2>&1; then
        print_step_from_common_functions "Clearing GTK icon caches..."
        # Update icon cache for common icon themes
        for icon_theme in /usr/share/icons/hicolor /usr/share/icons/Yaru; do
            if [[ -d "$icon_theme" ]]; then
                $USE_SUDO gtk-update-icon-cache -f -t "$icon_theme" 2>/dev/null || true
            fi
        done

        # Update user icon cache if exists
        if [[ -d "$desktop_manager_home/.local/share/icons" ]]; then
            for icon_theme in "$desktop_manager_home/.local/share/icons"/*; do
                if [[ -d "$icon_theme" ]]; then
                    gtk-update-icon-cache -f -t "$icon_theme" 2>/dev/null || true
                fi
            done
        fi
    fi

    # Clear MIME cache
    if command -v update-mime-database >/dev/null 2>&1; then
        update-mime-database "$desktop_manager_home/.local/share/applications" 2>/dev/null || true
    fi

    # Notify about GNOME Shell restart
    if pgrep -x gnome-shell >/dev/null 2>&1; then
        print_info_from_common_functions "GNOME Shell detected - restart it to refresh icons:"
        print_info_from_common_functions "  Press Alt+F2, type 'r', press Enter"
    fi

    print_success_from_common_functions "Cursor cleanup completed"
    return 0
}

# Main installation function
install_cursor() {
    print_header_from_common_functions "Installing Cursor IDE"

    # Track if this is an upgrade operation
    local is_upgrade_operation=false
    local remote_version=""

    # Always get remote version from API (for both first install and upgrade)
    print_step_from_common_functions "Checking for latest version from Cursor API..."
    remote_version=$(get_remote_cursor_version)

    if [[ -n "$remote_version" ]]; then
        print_info_from_common_functions "Latest version available: $remote_version"
    else
        print_warning_from_common_functions "Unable to retrieve remote version from API"
        print_info_from_common_functions "Will proceed with version detection from installer files"
        remote_version=""
    fi

    # Prompt for root mode
    if true; then
        echo ""
        echo -n "Do you want to install Cursor with root privileges (pkexec)? (Y/n): "
        read -r response
        case "$response" in
            [nN]|[nN][oO])
                USE_ROOT_MODE=false
                print_info_from_common_functions "Installing in normal mode (no root)"
                ;;
            *)
                USE_ROOT_MODE=true
                print_info_from_common_functions "Installing in root mode (with pkexec)"
                ;;
        esac
        echo ""
    fi

    # Check if already installed and prompt for upgrade/reinstall
    if is_cursor_installed; then
        print_warning_from_common_functions "Cursor is already installed"

        local installed_version=$(get_installed_version)
        local installed_type=$(get_installed_type)

        if [[ -n "$installed_version" ]]; then
            print_info_from_common_functions "Installed version: $installed_version"
        else
            print_info_from_common_functions "No version metadata found for current installation"
        fi

        if [[ -n "$installed_type" ]]; then
            print_info_from_common_functions "Installation type: $installed_type"
        fi

        # Compare versions (remote_version already fetched above)
        if [[ -n "$remote_version" ]] && [[ -n "$installed_version" ]] && [[ "$installed_version" == "$remote_version" ]]; then
            print_success_from_common_functions "Cursor is already up to date (version $installed_version)"
            print_info_from_common_functions "No upgrade needed"
            return 0
        fi

        # Compare versions and prompt for upgrade
        local prompt_message=""
        if [[ -n "$installed_version" ]] && [[ -n "$remote_version" ]] && [[ "$installed_version" != "$remote_version" ]]; then
            prompt_message="Cursor $installed_version is installed. Upgrade to $remote_version? (Y/n): "
        else
            prompt_message="Do you want to remove the existing installation and reinstall? (y/N): "
        fi

        echo -n "$prompt_message"
        read -r response

        # Handle upgrade prompt (Y is default for upgrade, N is default for reinstall)
        local should_proceed=false
        if [[ -n "$installed_version" ]] && [[ -n "$remote_version" ]] && [[ "$installed_version" != "$remote_version" ]]; then
            # Upgrade prompt - Y is default
            case "$response" in
                [nN]|[nN][oO])
                    print_info_from_common_functions "Upgrade cancelled - keeping existing installation"
                    return 0
                    ;;
                *)
                    should_proceed=true
                    print_info_from_common_functions "Proceeding with upgrade to $remote_version..."
                    ;;
            esac
        else
            # Reinstall prompt - N is default
            case "$response" in
                [yY]|[yY][eE][sS])
                    should_proceed=true
                    print_info_from_common_functions "Proceeding with reinstallation..."
                    ;;
                *)
                    print_info_from_common_functions "Installation cancelled - keeping existing installation"
                    return 0
                    ;;
            esac
        fi

        if [[ "$should_proceed" == true ]]; then
            print_info_from_common_functions "Cleaning up existing installation..."
            cleanup_cursor

            # Mark as upgrade operation
            is_upgrade_operation=true

            # NOTE: Do NOT delete old installer files yet!
            # Keep them as fallback in case download fails
            print_info_from_common_functions "Old installer files in Downloads will be kept as fallback"

            # For upgrades, open download page immediately to prepare user
            if [[ -n "$remote_version" ]]; then
                print_step_from_common_functions "Opening Cursor download page..."
                print_info_from_common_functions "Please download Cursor version $remote_version"
                open_cursor_download_page "$CURSOR_DOWNLOAD_URL"
                print_info_from_common_functions "The script will try to auto-download, but manual download may be needed"
                sleep 2  # Give browser time to open
            fi
        fi
    fi

    # Install dependencies
    install_dependencies

    print_step_from_common_functions "Scanning /home/*/Downloads for Cursor installer..."

    # Find available Cursor files using global function
    local appimage_file=$(find_file_in_downloads_from_common_functions "cursor*.AppImage" "newest")
    local deb_file=$(find_file_in_downloads_from_common_functions "cursor*.deb" "newest")

    local cursor_file=""
    local install_type=""
    local installed_type=$(get_installed_type)
    local existing_file_version=""

    if [[ -n "$appimage_file" ]] && [[ -n "$deb_file" ]]; then
        # Both AppImage and .deb found
        print_info_from_common_functions "Found both AppImage and .deb installers:"
        print_info_from_common_functions "  AppImage: $(basename "$appimage_file")"
        print_info_from_common_functions "  .deb: $(basename "$deb_file")"
        echo ""
        echo "Which installer would you like to use?"
        echo "  1) AppImage (recommended, portable)"
        echo "  2) .deb (system package)"
        echo -n "Enter choice [1]: "
        read -r choice

        case "$choice" in
            2)
                cursor_file="$deb_file"
                install_type="deb"
                print_info_from_common_functions "Selected .deb installer"
                ;;
            *)
                cursor_file="$appimage_file"
                install_type="appimage"
                print_info_from_common_functions "Selected AppImage installer (default)"
                ;;
        esac

    elif [[ -n "$appimage_file" ]]; then
        cursor_file="$appimage_file"
        install_type="appimage"
        print_info_from_common_functions "Found AppImage installer: $(basename "$cursor_file")"

    elif [[ -n "$deb_file" ]]; then
        cursor_file="$deb_file"
        install_type="deb"
        print_info_from_common_functions "Found .deb installer: $(basename "$cursor_file")"
    fi

    # If we found an existing file, check its version
    if [[ -n "$cursor_file" ]]; then
        existing_file_version=$(extract_version_from_filename "$cursor_file")
        print_info_from_common_functions "Found installer version: $existing_file_version"

        # Check if existing file matches the target version
        if [[ -n "$remote_version" ]] && [[ "$existing_file_version" == "$remote_version" ]]; then
            print_success_from_common_functions "Found installer already matches target version: $remote_version"
            print_info_from_common_functions "No download needed - using existing file"
        elif [[ -n "$remote_version" ]] && [[ "$existing_file_version" != "$remote_version" ]]; then
            print_warning_from_common_functions "Found installer version ($existing_file_version) differs from target ($remote_version)"
            print_info_from_common_functions "Will attempt to download newer version..."

            # Keep the old file path for fallback
            local fallback_file="$cursor_file"
            local fallback_type="$install_type"

            # Clear cursor_file to trigger download attempt
            cursor_file=""
            install_type=""
        fi

        # Check for installation type conflict
        if [[ -n "$cursor_file" ]] && [[ -n "$installed_type" ]] && [[ "$installed_type" != "$install_type" ]]; then
            print_warning_from_common_functions "Installation type conflict detected!"
            print_warning_from_common_functions "  Currently installed: $installed_type"
            print_warning_from_common_functions "  About to install: $install_type"
            print_step_from_common_functions "Cleaning up old installation to prevent conflicts..."
            cleanup_cursor
        fi
    fi

    # If no matching file found, try to download
    if [[ -z "$cursor_file" ]]; then
        print_step_from_common_functions "Attempting automatic download from Cursor API..."
        print_info_from_common_functions "API URL: $CURSOR_API_URL"

        # Try auto-download using enhanced function with browser headers
        local download_dir="$PRIMARY_DOWNLOAD_DIR"
        if [[ ! -d "$download_dir" ]]; then
            download_dir=$(find /home -maxdepth 2 -type d -name "Downloads" 2>/dev/null | head -1)
        fi
        if [[ -z "$download_dir" ]] || [[ ! -d "$download_dir" ]]; then
            download_dir="/tmp"
        fi

        print_info_from_common_functions "Download directory: $download_dir"

        local downloaded_file=$(download_with_browser_headers_from_common_functions "$CURSOR_API_URL" "$download_dir" 3)

        # If function returned a path, verify it exists
        if [[ -n "$downloaded_file" ]] && [[ -f "$downloaded_file" ]]; then
            print_success_from_common_functions "Auto-download successful: $(basename "$downloaded_file")"
            cursor_file="$downloaded_file"

            # Detect type from downloaded file
            local file_ext="${cursor_file##*.}"
            if [[ "$file_ext" == "AppImage" ]]; then
                install_type="appimage"
            elif [[ "$file_ext" == "deb" ]]; then
                install_type="deb"
            fi

            # Download succeeded - now safe to remove old files if they exist
            if [[ -n "$fallback_file" ]] && [[ "$fallback_file" != "$cursor_file" ]]; then
                print_step_from_common_functions "Removing outdated installer files..."
                rm -f "$fallback_file" 2>/dev/null || true
                print_success_from_common_functions "Removed old version: $(basename "$fallback_file")"
            fi
        else
            # Function failed to return path, try scanning Downloads directory
            print_warning_from_common_functions "Download function did not return file path, scanning Downloads..."

            sleep 2  # Wait for file system to sync

            local appimage_file=$(find_file_in_downloads_from_common_functions "cursor*.AppImage" "newest")
            if [[ -n "$appimage_file" ]] && [[ -f "$appimage_file" ]]; then
                local scanned_version=$(extract_version_from_filename "$appimage_file")

                # Check if this is a newly downloaded file (matches target version)
                if [[ -n "$remote_version" ]] && [[ "$scanned_version" == "$remote_version" ]]; then
                    print_success_from_common_functions "Found downloaded AppImage: $(basename "$appimage_file")"
                    cursor_file="$appimage_file"
                    install_type="appimage"

                    # Download succeeded - remove old files
                    if [[ -n "$fallback_file" ]] && [[ "$fallback_file" != "$cursor_file" ]]; then
                        print_step_from_common_functions "Removing outdated installer files..."
                        rm -f "$fallback_file" 2>/dev/null || true
                        print_success_from_common_functions "Removed old version: $(basename "$fallback_file")"
                    fi
                else
                    # This is the old file, download failed
                    print_warning_from_common_functions "Auto-download failed"

                    # Check if we have a fallback file
                    if [[ -n "$fallback_file" ]] && [[ -f "$fallback_file" ]]; then
                        print_warning_from_common_functions "Download of version $remote_version failed"
                        print_info_from_common_functions "Fallback option available: $(basename "$fallback_file") (version: $existing_file_version)"

                        if [[ "$is_upgrade_operation" == true ]]; then
                            echo ""
                            echo -n "Download failed. Use older version from Downloads? (y/N): "
                            read -r use_fallback

                            case "$use_fallback" in
                                [yY]|[yY][eE][sS])
                                    print_info_from_common_functions "Using fallback file: $(basename "$fallback_file")"
                                    cursor_file="$fallback_file"
                                    install_type="$fallback_type"
                                    ;;
                                *)
                                    print_info_from_common_functions "Fallback declined, switching to manual download..."
                                    cursor_file=""
                                    ;;
                            esac
                        else
                            # First-time install - use fallback automatically
                            print_info_from_common_functions "Using available installer: $(basename "$fallback_file")"
                            cursor_file="$fallback_file"
                            install_type="$fallback_type"
                        fi
                    fi

                    # If still no file, try manual download
                    if [[ -z "$cursor_file" ]]; then
                        print_warning_from_common_functions "Switching to manual download mode"
                        print_step_from_common_functions "Opening Cursor download page for manual download..."
                        open_cursor_download_page "$CURSOR_DOWNLOAD_URL"

                        # Use global function for manual download prompt
                        cursor_file=$(prompt_and_wait_for_download_from_common_functions \
                            "$CURSOR_DOWNLOAD_URL" \
                            "cursor*.AppImage" \
                            0)

                        if [[ -z "$cursor_file" ]] || [[ ! -f "$cursor_file" ]]; then
                            print_error_from_common_functions "Manual download is required before installation can continue"
                            return 1
                        fi

                        # Detect type from manual download
                        local file_ext="${cursor_file##*.}"
                        if [[ "$file_ext" == "AppImage" ]]; then
                            install_type="appimage"
                        elif [[ "$file_ext" == "deb" ]]; then
                            install_type="deb"
                        fi
                    fi
                fi
            else
                # No files found at all - check for fallback
                if [[ -n "$fallback_file" ]] && [[ -f "$fallback_file" ]]; then
                    print_warning_from_common_functions "Download failed, but fallback file is available"
                    print_info_from_common_functions "Fallback: $(basename "$fallback_file") (version: $existing_file_version)"

                    if [[ "$is_upgrade_operation" == true ]]; then
                        echo ""
                        echo -n "Download failed. Use older version from Downloads? (y/N): "
                        read -r use_fallback

                        case "$use_fallback" in
                            [yY]|[yY][eE][sS])
                                print_info_from_common_functions "Using fallback file: $(basename "$fallback_file")"
                                cursor_file="$fallback_file"
                                install_type="$fallback_type"
                                ;;
                            *)
                                print_info_from_common_functions "Fallback declined"
                                cursor_file=""
                                ;;
                        esac
                    else
                        # First-time install - use fallback automatically
                        print_info_from_common_functions "Using available installer: $(basename "$fallback_file")"
                        cursor_file="$fallback_file"
                        install_type="$fallback_type"
                    fi
                fi

                # If still no file, manual download required
                if [[ -z "$cursor_file" ]]; then
                    print_warning_from_common_functions "Auto-download failed, switching to manual download mode"
                    print_step_from_common_functions "Opening Cursor download page for manual download..."
                    open_cursor_download_page "$CURSOR_DOWNLOAD_URL"

                    # Use global function for manual download prompt
                    cursor_file=$(prompt_and_wait_for_download_from_common_functions \
                        "$CURSOR_DOWNLOAD_URL" \
                        "cursor*.AppImage" \
                        0)

                    if [[ -z "$cursor_file" ]] || [[ ! -f "$cursor_file" ]]; then
                        print_error_from_common_functions "Manual download is required before installation can continue"
                        return 1
                    fi

                    # Detect type from manual download
                    local file_ext="${cursor_file##*.}"
                    if [[ "$file_ext" == "AppImage" ]]; then
                        install_type="appimage"
                    elif [[ "$file_ext" == "deb" ]]; then
                        install_type="deb"
                    fi
                fi
            fi
        fi
    fi

    print_success_from_common_functions "Using Cursor file: $(basename "$cursor_file")"
    print_info_from_common_functions "Installation type: $install_type"

    # Install based on type
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
                print_error_from_common_functions "File corruption detected: $cursor_file"
                print_step_from_common_functions "Removing corrupted file and restarting installation..."

                # Remove corrupted file
                rm -f "$cursor_file" 2>/dev/null || true
                $USE_SUDO rm -f "$CURSOR_PACKAGE_DIR/$(basename "$cursor_file")" 2>/dev/null || true

                # Wait a moment
                sleep 2

                # Restart the script with the same arguments
                print_info_from_common_functions "Restarting script: $0 $@"
                exec "$0" "$@"
            else
                print_error_from_common_functions "Failed to install Cursor .deb package"
                return 1
            fi
        done

        if [[ $install_result -ne 0 ]]; then
            print_error_from_common_functions "Failed to install Cursor after $max_retries attempts"
            return 1
        fi

    elif [[ "$file_extension" == "AppImage" ]]; then
        print_info_from_common_functions "Detected AppImage, using extraction method..."

        extract_appimage "$cursor_file"
        local extract_result=$?

        if [[ $extract_result -eq 2 ]]; then
            # File corruption detected
            print_error_from_common_functions "File corruption detected: $cursor_file"
            print_step_from_common_functions "Removing corrupted file and restarting installation..."

            # Remove corrupted file
            rm -f "$cursor_file" 2>/dev/null || true
            $USE_SUDO rm -f "$CURSOR_PACKAGE_DIR/$(basename "$cursor_file")" 2>/dev/null || true
            $USE_SUDO rm -rf "$CURSOR_EXTRACTED_DIR/squashfs-root" 2>/dev/null || true

            # Wait a moment
            sleep 2

            # Restart the script with the same arguments
            print_info_from_common_functions "Restarting script: $0 $@"
            exec "$0" "$@"
        elif [[ $extract_result -ne 0 ]]; then
            print_error_from_common_functions "Failed to extract Cursor AppImage"
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

    # Save installation info with version and type
    print_step_from_common_functions "Saving installation info..."
    local installed_version=$(extract_version_from_filename "$cursor_file")
    if [[ -n "$installed_version" ]]; then
        save_installation_info "$installed_version" "$cursor_file" "$install_type"
        print_info_from_common_functions "Installed version: $installed_version"
    else
        # Fallback if version extraction fails
        save_installation_info "unknown" "$cursor_file" "$install_type"
    fi

    print_success_from_common_functions "Cursor IDE installation completed successfully!"
    print_info_from_common_functions "Installation details:"
    print_info_from_common_functions "  - Type: $install_type ($file_extension)"
    print_info_from_common_functions "  - Version: ${installed_version:-unknown}"
    print_info_from_common_functions "  - Binary: ${CURSOR_BINARY:-unknown}"
    print_info_from_common_functions "  - Icon: ${CURSOR_ICON:-unknown}"
    print_info_from_common_functions "  - User data: ${CURSOR_USERDATA_DIR:-unknown}"
    print_info_from_common_functions ""
    print_info_from_common_functions "You can now launch Cursor from:"
    print_info_from_common_functions "  - Applications menu (Cursor icon)"
    print_info_from_common_functions "  - Desktop entry will launch with pkexec (root with user data directory)"

    return 0
}

# Interactive cleanup prompt (deprecated - now handled in install_cursor)
prompt_cleanup_reinstall() {
    # This function is kept for backward compatibility but is no longer used
    # The cleanup prompt is now handled directly in install_cursor()
    return 0
}

# Main script execution
main() {
    # Check if we have a desktop environment (Cursor is a GUI application)
    # Only skip if we're on a pure server without any desktop environment
    if [[ "$HAS_DESKTOP_ENVIRONMENT" != true ]] && [[ "$IS_WSL" != true ]] && [[ "$IS_PRODUCTION" == true ]]; then
        print_info_from_common_functions "[$SCRIPT_INDEX] Skipping Cursor installation (production server without desktop environment)"
        print_info_from_common_functions "[$SCRIPT_INDEX] Cursor requires a desktop environment to run"
        exit 0
    fi

    print_header_from_common_functions "Cursor IDE Installation Script"
    print_info_from_common_functions "Installation Directory: $CURSOR_INSTALL_DIR"

    # Run installation (will prompt for cleanup if already installed)
    install_cursor
    exit $?
}

# Run main function (no arguments supported)
main
