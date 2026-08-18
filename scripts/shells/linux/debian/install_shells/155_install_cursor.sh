#!/bin/bash
# Cursor IDE Installation Script
#
# Usage:
#   ./155_install_cursor.sh   # Interactive install (no arguments)
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
SCRIPT_INDEX="122"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/installation_library.sh"
source "$PARENT_DIR_LEVEL_2/common/desktop_shortcut_manager.sh"
source "$PARENT_DIR_LEVEL_2/common/app_resource_limit.sh"
source "$PARENT_DIR_LEVEL_2/common/desktop_electron_ime_compat.sh"

# Declare variables
INSTALL_MODE=$(get_var "INSTALL_MODE" "base")
USE_ROOT_MODE=true  # Default to root mode (pkexec)
# Bounded restart counter for the corrupt-download recovery. EXPORTED so it survives the
# `exec "$0"` self-restart (a plain local counter resets to 0 each exec -> infinite loop).
CURSOR_RESTART_COUNT="${CURSOR_RESTART_COUNT:-0}"
CURSOR_MAX_RESTARTS="${CURSOR_MAX_RESTARTS:-2}"

# Cursor API configuration (follow redirects for latest)
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

# No script arguments. Everything is interactive prompts.

# Resolve a stable download directory for this run
resolve_cursor_download_dir() {
    local download_dir="$PRIMARY_DOWNLOAD_DIR"
    if [[ -z "$download_dir" ]] || [[ ! -d "$download_dir" ]]; then
        download_dir=$(find /home -maxdepth 2 -type d -name "Downloads" 2>/dev/null | head -1)
    fi
    if [[ -z "$download_dir" ]] || [[ ! -d "$download_dir" ]]; then
        download_dir="/tmp"
    fi
    echo "$download_dir"
}

# Find newest Cursor installer file in a single directory (no cross-user scanning here)
# Returns full path on stdout, or empty string if not found
find_newest_cursor_installer_in_dir() {
    local dir="$1"
    if [[ -z "$dir" ]] || [[ ! -d "$dir" ]]; then
        echo ""
        return 1
    fi

    # Match dynamic filenames (Cursor-*.AppImage, cursor-*.deb, etc.)
    # Use -iname to be case-insensitive and allow any prefix that contains "cursor".
    local newest=""
    newest=$(find "$dir" -maxdepth 1 -type f \( -iname "*cursor*.AppImage" -o -iname "*cursor*.deb" \) \
        -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)

    if [[ -n "$newest" ]] && [[ -f "$newest" ]]; then
        echo "$newest"
        return 0
    fi

    echo ""
    return 1
}

# Verify installer file by file signals (no exit-code trust)
verify_cursor_installer_file() {
    local file="$1"
    if [[ -z "$file" ]] || [[ ! -f "$file" ]]; then
        return 1
    fi

    # Size threshold to reject partial downloads / HTML pages
    local size_bytes
    size_bytes=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null || echo "0")
    if [[ "$size_bytes" -lt 52428800 ]]; then
        return 1
    fi

    return 0
}

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

    # Try wget first (bounded so the idempotent version check never hangs)
    if command -v wget >/dev/null 2>&1; then
        final_url=$(wget --spider --server-response \
            --user-agent="$user_agent" \
            --max-redirect=10 --timeout=15 --tries=1 \
            "$api_url" 2>&1 | grep -i "Location:" | tail -1 | awk '{print $2}' | tr -d '\r')
    fi

    # Try curl if wget failed (bounded with connect/total timeouts)
    if [[ -z "$final_url" ]] && command -v curl >/dev/null 2>&1; then
        final_url=$(curl -sIL \
            -A "$user_agent" \
            --max-redirs 10 --connect-timeout 10 --max-time 25 \
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

    # Extract AppImage. Output is streamed LIVE (no suppression) so progress/errors
    # are visible; success is decided by the squashfs-root dir below (file signal),
    # NOT by the exit code -- per "no return-value/exit-code-only checks".
    print_step_from_common_functions "Extracting AppImage contents..."
    cd "$CURSOR_EXTRACTED_DIR"
    $USE_SUDO "$installed_appimage" --appimage-extract || true

    if [[ ! -d "$CURSOR_EXTRACTED_DIR/squashfs-root" ]]; then
        print_error_from_common_functions "Failed to extract AppImage (squashfs-root missing; file may be corrupted)"
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
        # Fix chrome-sandbox permissions (required for security)
        $USE_SUDO chmod 4755 "$chrome_sandbox"
        $USE_SUDO chown root:root "$chrome_sandbox"
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
    print_step_from_common_functions "Creating Cursor launcher + system-wide desktop entry"

    # Detect desktop user
    local desktop_user_info="$(detect_cursor_desktop_user)"
    local desktop_manager_user="${desktop_user_info%%:*}"
    local desktop_manager_home="${desktop_user_info##*:}"

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

    # --- Self-elevating, --no-sandbox launcher (single source of truth) --------------
    # Cursor is an Electron app: started as root the Chromium sandbox refuses to run
    # unless --no-sandbox is passed -- without it Cursor aborts and documents cannot be
    # saved. The wrapper runs Cursor as ROOT (re-execing via pkexec when launched from
    # a normal desktop session, forwarding the X display) so it can also write
    # root-owned project files, then adds --no-sandbox.
    local cursor_real_binary="$CURSOR_BINARY"
    local cursor_wrapper="$CURSOR_BIN_DIR/cursor"
    local cursor_im_pkexec_env
    local cursor_flags_file="$desktop_manager_home/.config/cursor-flags.conf"
    cursor_im_pkexec_env="$(deic_pkexec_env_string)"
    $USE_SUDO mkdir -p "$CURSOR_BIN_DIR"
    $USE_SUDO tee "$cursor_wrapper" >/dev/null <<EOF
#!/bin/bash
# Cursor launcher (generated by 155_install_cursor.sh -- do not edit).
# Runs Cursor as root with --no-sandbox (both REQUIRED to launch Electron as root and
# save files). Re-execs via pkexec, forwarding the X session, for non-root callers.
# IME env vars are forwarded for Wubi/CJK input (see 131 + desktop_electron_ime_compat.sh).
CURSOR_REAL_BINARY="$cursor_real_binary"
if [ "\$(id -u)" -ne 0 ]; then
    if command -v pkexec >/dev/null 2>&1; then
        exec pkexec env DISPLAY="\${DISPLAY:-:0}" XAUTHORITY="\${XAUTHORITY:-\$HOME/.Xauthority}" \
            XDG_RUNTIME_DIR="\${XDG_RUNTIME_DIR}" DBUS_SESSION_BUS_ADDRESS="\${DBUS_SESSION_BUS_ADDRESS}" \
            $cursor_im_pkexec_env "\$0" "\$@"
    else
        exec sudo -E "\$0" "\$@"
    fi
fi
# IME bridge (Electron/Chromium; idempotent with 173_install_chinese_wubi.sh)
$(deic_launcher_env_exports)
# Chromium/Electron flags for Wayland IME (desktop user's cursor-flags.conf).
CURSOR_FLAGS_FILE="$cursor_flags_file"
CURSOR_EXTRA_FLAGS=()
if [ -f "\$CURSOR_FLAGS_FILE" ]; then
    while IFS= read -r _deic_line || [ -n "\$_deic_line" ]; do
        case "\$_deic_line" in
            ''|'#'*) continue ;;
            *) CURSOR_EXTRA_FLAGS+=("\$_deic_line") ;;
        esac
    done < "\$CURSOR_FLAGS_FILE"
fi
# Prefer the resource-limited launcher (cgroup-v2 --system scope; we are root here
# post-elevation). Falls back to a direct launch if the wrapper is missing.
if [ -x /usr/local/bin/cursor-rlimit ]; then
    exec /usr/local/bin/cursor-rlimit --no-sandbox "\${CURSOR_EXTRA_FLAGS[@]}" "\$@"
fi
exec "\$CURSOR_REAL_BINARY" --no-sandbox "\${CURSOR_EXTRA_FLAGS[@]}" "\$@"
EOF
    $USE_SUDO chmod +x "$cursor_wrapper"
    $USE_SUDO ln -sf "$cursor_wrapper" /usr/local/bin/cursor 2>/dev/null || true
    CURSOR_BINARY="$cursor_wrapper"
    print_info_from_common_functions "Launcher (root + --no-sandbox): $cursor_wrapper -> $cursor_real_binary"

    # Resource limit: cap the whole Cursor (Electron) tree in one machine-relative
    # cgroup-v2 --system scope. Cursor self-elevates to root, so --user would not
    # govern it; --root makes the wrapper use a --system scope. The launcher above
    # execs /usr/local/bin/cursor-rlimit (created here). Idempotent; never double-wraps.
    apply_app_resource_limit --id cursor --exec "$cursor_real_binary" --root

    # Build user data directory path for Cursor
    CURSOR_USERDATA_DIR="$desktop_manager_home/.config/Cursor"
    print_info_from_common_functions "Cursor user data directory: $CURSOR_USERDATA_DIR"

    # Create user data directory if it doesn't exist
    if [[ ! -d "$CURSOR_USERDATA_DIR" ]]; then
        mkdir -p "$CURSOR_USERDATA_DIR" 2>/dev/null || true
        # Set ownership to desktop user if running as root
        if [[ "$USER" == "root" ]] && [[ -d "$CURSOR_USERDATA_DIR" ]]; then
            safe_chown_R "$desktop_manager_user:$desktop_manager_user" "$CURSOR_USERDATA_DIR"
        fi
    fi

    # --- System-wide desktop entry (covers ALL desktop environments & ALL users) -----
    # A single /usr/share/applications entry is read by GNOME, KDE, XFCE, Cinnamon,
    # MATE, LXQt, Budgie, etc. The icon goes to /usr/share/pixmaps so every theme can
    # resolve it. Exec points at the self-elevating --no-sandbox wrapper above.
    local sys_icon="/usr/share/pixmaps/cursor.png"
    local desktop_icon="cursor"
    if [[ -f "$CURSOR_ICON" ]]; then
        if $USE_SUDO cp -f "$CURSOR_ICON" "$sys_icon" 2>/dev/null; then
            desktop_icon="$sys_icon"
        fi
    fi

    # Menu entry via the shared library: it writes <id>.desktop to
    # /usr/share/applications (read by every DE, covers all users), runs
    # update-desktop-database, and is idempotent.
    create_desktop_shortcut_from_desktop_shortcut_manager \
        --id cursor \
        --name "Cursor" \
        --generic "Code Editor" \
        --comment "The AI Code Editor" \
        --exec "/usr/local/bin/cursor %F" \
        --icon "$desktop_icon" \
        --categories "Development;IDE;TextEditor;" \
        --keywords "cursor;editor;ide;ai;code;" \
        --mimetype "text/plain;inode/directory;" \
        --startup-wmclass "Cursor" \
        --extra "StartupNotify=true"
    print_success_from_common_functions "System-wide desktop entry created: $DSM_APPLICATIONS_DIR/cursor.desktop"

    # GTK + Wayland IME bridge for Wubi/CJK input (idempotent with 131).
    print_step_from_common_functions "Ensuring Cursor IME compatibility (Wubi/CJK input)..."
    deic_ensure_electron_ime_compat "$desktop_manager_user" "$desktop_manager_home"
    print_success_from_common_functions "Cursor IME config: cursor-flags.conf + GTK im-module for $desktop_manager_user"

    # Refresh icon caches (best-effort; covers all DEs).
    if command -v gtk-update-icon-cache >/dev/null 2>&1; then
        for icon_theme in /usr/share/icons/hicolor /usr/share/icons/Yaru; do
            [[ -d "$icon_theme" ]] && $USE_SUDO gtk-update-icon-cache -f -t "$icon_theme" 2>/dev/null || true
        done
    fi

    return 0
}

# Install required dependencies (Debian / Ubuntu / Kali).
install_dependencies() {
    local fuse_pkg cand
    print_step_from_common_functions "Checking dependencies..."

    # FUSE is OPTIONAL here: this installer EXTRACTS the AppImage (--appimage-extract) and
    # runs the unpacked squashfs-root/AppRun, so neither installing nor running Cursor needs
    # libfuse. We still install the FUSE-2 runtime best-effort (so a user can also launch the
    # raw .AppImage), but ANY failure is non-fatal. The package name differs by distro:
    # Debian 13 / Kali / Ubuntu 24.04+ ship libfuse2t64 (the 64-bit time_t rename); older
    # Debian/Ubuntu ship libfuse2. Kali in particular has NO `libfuse2` candidate, which is
    # why the old hard `apt-get install -y libfuse2` errored.
    if dpkg -l 2>/dev/null | grep -qE '^ii[[:space:]]+libfuse2(t64)?[[:space:]]'; then
        print_info_from_common_functions "FUSE-2 runtime already present (optional; extraction does not need it)."
        return 0
    fi
    if ! command -v apt-get >/dev/null 2>&1; then
        print_info_from_common_functions "apt-get not found; skipping optional FUSE-2 (extraction does not need it)."
        return 0
    fi
    $USE_SUDO apt-get update -qq 2>/dev/null || true
    fuse_pkg=""
    # Pick whichever FUSE-2 package this distro actually publishes (t64 first).
    for cand in libfuse2t64 libfuse2; do
        if apt-cache policy "$cand" 2>/dev/null | grep -qE 'Candidate: [^(]'; then
            fuse_pkg="$cand"; break
        fi
    done
    if [ -n "$fuse_pkg" ]; then
        print_step_from_common_functions "Installing optional FUSE-2 runtime ($fuse_pkg)..."
        $USE_SUDO apt-get install -y "$fuse_pkg" \
            || print_info_from_common_functions "$fuse_pkg install failed (non-fatal; Cursor runs from the extracted AppImage)."
    else
        print_info_from_common_functions "No libfuse2/libfuse2t64 candidate (Kali/Debian 13/Ubuntu 24.04+) - skipping; extraction does not need FUSE."
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
    local launcher_script="$CORE_NODE_DATA_DIR/scripts_launch_dir/cursor_launcher.sh"
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

    # Remove the launcher symlink + system icon created by create_desktop_entry().
    if [[ -L /usr/local/bin/cursor ]] || [[ -e /usr/local/bin/cursor ]]; then
        print_step_from_common_functions "Removing launcher symlink: /usr/local/bin/cursor"
        $USE_SUDO rm -f /usr/local/bin/cursor
    fi
    $USE_SUDO rm -f /usr/share/pixmaps/cursor.png 2>/dev/null || true

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

# Ensure Cursor Agent (CLI) is installed. Idempotent: runs every time; skips only when `agent` is already in PATH.
# Must run regardless of Cursor IDE install state (desktop and headless). See https://cursor.com/cli
ensure_cursor_agent_installed() {
    # Check if agent command exists (any user's PATH or common locations)
    if command -v agent >/dev/null 2>&1; then
        local agent_path=$(command -v agent)
        print_info_from_common_functions "Cursor Agent already installed: $agent_path"
        echo "$agent_path"
        return 0
    fi

    print_step_from_common_functions "Cursor Agent not found, installing..."
    
    # Ensure curl is installed
    if ! command -v curl >/dev/null 2>&1; then
        print_step_from_common_functions "Installing curl..."
        $USE_SUDO apt-get update -qq
        $USE_SUDO apt-get install -y curl
    fi

    # Detect actual user for agent installation (works in root mode)
    local agent_user="${SUDO_USER:-$USER}"
    if [[ "$agent_user" == "root" ]] || [[ -z "$agent_user" ]]; then
        agent_user=$(detect_system_user)
    fi
    local agent_home=$(getent passwd "$agent_user" 2>/dev/null | cut -d: -f6)
    if [[ -z "$agent_home" ]] || [[ ! -d "$agent_home" ]]; then
        agent_home="$HOME"
        agent_user="$USER"
    fi

    print_info_from_common_functions "Installing Cursor Agent for user: $agent_user ($agent_home)"

    # Official install: https://cursor.com/cli — run as target user when we are root so agent goes to ~/.local/bin
    local install_ok=0
    if [[ "$(id -u)" -eq 0 ]] && [[ "$agent_user" != "root" ]]; then
        if $USE_SUDO -u "$agent_user" env HOME="$agent_home" bash -c 'curl -fsS https://cursor.com/install | bash'; then
            install_ok=1
        fi
    else
        if curl -fsS https://cursor.com/install | bash; then
            install_ok=1
        fi
    fi

    if [[ "$install_ok" -eq 1 ]]; then
        print_success_from_common_functions "Cursor Agent installed successfully"
    else
        print_warning_from_common_functions "Cursor Agent installation may have failed"
    fi

    # Add ~/.local/bin to PATH for the detected user
    local local_bin_dir="$agent_home/.local/bin"
    if [[ -d "$local_bin_dir" ]]; then
        # Add to user's .bashrc
        local bashrc_file="$agent_home/.bashrc"
        if [[ -f "$bashrc_file" ]] && ! grep -q "export PATH=.*$local_bin_dir" "$bashrc_file" 2>/dev/null; then
            echo "" >> "$bashrc_file"
            echo "# Added by Cursor installer" >> "$bashrc_file"
            echo "export PATH=\"$local_bin_dir:\$PATH\"" >> "$bashrc_file"
        fi

        # Add to /etc/environment for system-wide access (works in root mode)
        if ! grep -q "PATH.*$local_bin_dir" /etc/environment 2>/dev/null; then
            local current_path=$(grep "^PATH=" /etc/environment 2>/dev/null | cut -d= -f2 | tr -d '"')
            [ -z "$current_path" ] && current_path="${PATH:-/usr/local/bin:/usr/bin:/bin}"
            $USE_SUDO sed -i '/^PATH=/d' /etc/environment 2>/dev/null || true
            echo "PATH=\"$local_bin_dir:$current_path\"" | $USE_SUDO tee -a /etc/environment > /dev/null
        fi

        # Refresh environment variables
        set -a
        source /etc/environment 2>/dev/null || true
        set +a
        export PATH="$local_bin_dir:$PATH"
    fi

    # Find agent binary
    local agent_path=""
    if [[ -f "$local_bin_dir/agent" ]]; then
        agent_path="$local_bin_dir/agent"
    elif command -v agent >/dev/null 2>&1; then
        agent_path=$(command -v agent)
    else
        # Search in common locations
        for search_dir in "$agent_home/.local/bin" "/usr/local/bin" "/usr/bin"; do
            if [[ -f "$search_dir/agent" ]]; then
                agent_path="$search_dir/agent"
                break
            fi
        done
    fi

    if [[ -n "$agent_path" ]] && [[ -f "$agent_path" ]]; then
        print_success_from_common_functions "Cursor Agent installed at: $agent_path"
        echo "$agent_path"
        return 0
    else
        print_warning_from_common_functions "Cursor Agent installation completed but binary not found"
        return 1
    fi
}

# Idempotent config refresh: re-assert the launcher + desktop entry + IME bridge
# WITHOUT downloading/reinstalling. Backs the `refresh` subcommand, which
# 173_install_chinese_wubi.sh calls after a Wubi framework switch so the Cursor
# launcher's baked-in IME env vars track the active framework (Cursor is the only
# Electron app here that bakes IME env into its wrapper; VS Code/Chrome read
# flags/GTK dynamically). No-op when Cursor is not installed; no prompts.
refresh_cursor_config() {
    print_header_from_common_functions "Refreshing Cursor config (launcher + IME)"
    if ! is_cursor_installed; then
        print_info_from_common_functions "Cursor not installed; nothing to refresh."
        return 0
    fi
    create_desktop_entry || true
    print_success_from_common_functions "Cursor config refreshed (no reinstall)."
    return 0
}

# Main installation function. Cursor Agent (CLI) is always ensured first and is idempotent; skipping IDE install does not skip CLI.
install_cursor() {
    print_header_from_common_functions "Installing Cursor IDE"

    # Ensure Cursor Agent (CLI) every run — idempotent; required for both desktop and headless Linux.
    print_step_from_common_functions "Ensuring Cursor Agent (CLI) is installed..."
    local agent_path=$(ensure_cursor_agent_installed)
    if [[ -n "$agent_path" ]]; then
        print_info_from_common_functions "Cursor Agent: $agent_path"
    fi
    echo ""

    # Track if this is an upgrade operation
    local is_upgrade_operation=false

    # Non-interactive: always install in root mode. The desktop launcher elevates via
    # pkexec and runs Cursor with --no-sandbox so the Electron/Chromium runtime can
    # start as root (without --no-sandbox it aborts as root and documents cannot be saved).
    USE_ROOT_MODE=true
    print_info_from_common_functions "Installing in root mode (pkexec launcher + --no-sandbox)"
    echo ""

    # Idempotent: if Cursor is already installed, REFRESH the launcher + desktop entry +
    # IME bridge first (mirrors 157_install_vscode.sh), then ASK before reinstalling.
    # Never auto-reinstall: a newer remote version only triggers an interactive [y/N]
    # prompt (default N); an offline/unknown remote keeps the working install untouched.
    if is_cursor_installed; then
        local installed_version=$(get_installed_version)
        local remote_version=$(get_remote_cursor_version 2>/dev/null)
        print_info_from_common_functions "Cursor already installed: ${installed_version:-unknown} (latest: ${remote_version:-unknown}, type: $(get_installed_type))"

        # Refresh FIRST so a re-run keeps config current even when reinstall is declined.
        create_desktop_entry || true

        # Only a KNOWN, newer remote version is grounds to ask. Empty input / EOF
        # (non-interactive) -> keep (N default), so unattended runs never reinstall.
        local do_reinstall=false
        if [[ -n "$remote_version" ]] && [[ "$installed_version" != "$remote_version" ]]; then
            print_warning_from_common_functions "Newer Cursor available: ${installed_version:-unknown} -> ${remote_version}"
            echo -n "Reinstall/upgrade Cursor now? [y/N]: "
            local reinstall_response=""
            read -r reinstall_response
            case "$reinstall_response" in
                [yY]|[yY][eE][sS])
                    do_reinstall=true
                    print_info_from_common_functions "Proceeding with reinstall/upgrade..."
                    ;;
                *)
                    print_info_from_common_functions "Keeping existing Cursor install (refresh only)."
                    ;;
            esac
        elif [[ -z "$remote_version" ]]; then
            print_warning_from_common_functions "Could not determine the latest Cursor version (offline?); keeping the existing install."
        else
            print_success_from_common_functions "Cursor $installed_version is already up to date (idempotent)."
        fi

        if [[ "$do_reinstall" != true ]]; then
            return 0
        fi

        print_step_from_common_functions "Reinstalling Cursor (${installed_version:-unknown} -> ${remote_version}); removing old install..."
        cleanup_cursor
        is_upgrade_operation=true
    fi

    # Install dependencies
    install_dependencies

    print_step_from_common_functions "Scanning /home/*/Downloads for Cursor installer..."

    # Latest version for cache-freshness comparison (may already be known from the
    # installed-version check above; fetch once otherwise).
    if [[ -z "${remote_version:-}" ]]; then
        remote_version=$(get_remote_cursor_version 2>/dev/null || true)
    fi

    # Find available Cursor files using global function
    local appimage_file=$(find_file_in_downloads_from_common_functions "cursor*.AppImage" "newest")
    local deb_file=$(find_file_in_downloads_from_common_functions "cursor*.deb" "newest")

    local cursor_file=""
    local install_type=""
    local installed_type=$(get_installed_type)
    local existing_file_version=""

    if [[ -n "$appimage_file" ]] && [[ -n "$deb_file" ]]; then
        # Both found: non-interactive default = AppImage (portable, extract-based, no
        # apt deps; works uniformly across Debian 11-13 / Ubuntu 18-26 / Kali).
        cursor_file="$appimage_file"
        install_type="appimage"
        print_info_from_common_functions "Found AppImage and .deb; using AppImage (default)"

    elif [[ -n "$appimage_file" ]]; then
        cursor_file="$appimage_file"
        install_type="appimage"
        print_info_from_common_functions "Found AppImage installer: $(basename "$cursor_file")"

    elif [[ -n "$deb_file" ]]; then
        cursor_file="$deb_file"
        install_type="deb"
        print_info_from_common_functions "Found .deb installer: $(basename "$cursor_file")"
    fi

    # Idempotent cache reuse: reuse a previously downloaded installer ONLY when it is
    # the latest version (and valid). If it is an OLDER version and a newer one is
    # known, it is "too old" -> discard and re-download fresh. If the latest is unknown
    # (offline), keep whatever valid cached file exists (never block on an unknown
    # remote). This avoids re-downloading on every run while still staying current.
    if [[ -n "$cursor_file" ]]; then
        existing_file_version=$(extract_version_from_filename "$cursor_file" 2>/dev/null || true)
        if [[ -n "$remote_version" ]] && [[ -n "$existing_file_version" ]] && \
           [[ "$existing_file_version" != "$remote_version" ]]; then
            print_warning_from_common_functions "Cached installer is older ($existing_file_version != latest $remote_version); will re-download fresh."
            cursor_file=""
            install_type=""
        elif ! verify_cursor_installer_file "$cursor_file"; then
            print_warning_from_common_functions "Cached installer looks corrupt/too small; will re-download fresh."
            rm -f "$cursor_file" 2>/dev/null || true
            cursor_file=""
            install_type=""
        else
            print_success_from_common_functions "Reusing cached installer (matches latest $existing_file_version): $(basename "$cursor_file")"
            # Check for installation type conflict
            if [[ -n "$installed_type" ]] && [[ "$installed_type" != "$install_type" ]]; then
                print_warning_from_common_functions "Installation type conflict detected!"
                print_warning_from_common_functions "  Currently installed: $installed_type"
                print_warning_from_common_functions "  About to install: $install_type"
                print_step_from_common_functions "Cleaning up old installation to prevent conflicts..."
                cleanup_cursor
            fi
        fi
    fi

    # If no usable cached file, download fresh (streamed LIVE -- do not capture stdout
    # or branch on the return code; the download function prints progress to stdout
    # which a $(...) would swallow). Locate the result by scanning the directory
    # afterward (file signal), not by the function's echoed path or exit code.
    if [[ -z "$cursor_file" ]]; then
        print_step_from_common_functions "Attempting automatic download from Cursor API..."
        print_info_from_common_functions "API URL: $CURSOR_API_URL"

        local download_dir
        download_dir=$(resolve_cursor_download_dir)
        print_info_from_common_functions "Download directory: $download_dir"

        # Stream the download live (no command substitution, no exit-code branching).
        download_with_browser_headers_from_common_functions "$CURSOR_API_URL" "$download_dir" 3 || true

        # Locate the result by scanning the directory (newest valid Cursor installer).
        print_info_from_common_functions "Scanning download directory for latest installer..."
        local located_file
        located_file=$(find_newest_cursor_installer_in_dir "$download_dir")
        if verify_cursor_installer_file "$located_file"; then
            print_success_from_common_functions "Using downloaded installer: $(basename "$located_file")"
            cursor_file="$located_file"
        else
            print_error_from_common_functions "Download did not produce a valid Cursor installer"
        fi

        if [[ -n "$cursor_file" ]]; then
            local file_ext="${cursor_file##*.}"
            if [[ "$file_ext" == "AppImage" ]]; then
                install_type="appimage"
            elif [[ "$file_ext" == "deb" ]]; then
                install_type="deb"
            fi
        fi
    fi
    # Final check: cursor_file must exist
    if [[ -z "$cursor_file" ]] || [[ ! -f "$cursor_file" ]]; then
        print_error_from_common_functions "No valid Cursor installer found"
        print_info_from_common_functions "Please download Cursor installer manually and save it to any /home/*/Downloads directory"
        return 1
    fi

    print_success_from_common_functions "Using Cursor file: $(basename "$cursor_file")"
    print_info_from_common_functions "Installation type: $install_type"

    # Install based on type
    local file_extension="${cursor_file##*.}"

    if [[ "$file_extension" == "deb" ]]; then
        print_info_from_common_functions "Detected .deb package, using dpkg installation..."

        # Install .deb; on a CORRUPT download, restart the script to re-fetch — BOUNDED by
        # the exported CURSOR_RESTART_COUNT (survives the exec; a local counter would reset
        # to 0 on every exec and loop forever).
        local install_result
        install_deb_package "$cursor_file"
        install_result=$?
        if [[ $install_result -eq 2 ]]; then
            print_error_from_common_functions "File corruption detected: $cursor_file"
            if [[ "$CURSOR_RESTART_COUNT" -ge "$CURSOR_MAX_RESTARTS" ]]; then
                print_error_from_common_functions "Still corrupted after $CURSOR_RESTART_COUNT restart(s); giving up."
                print_info_from_common_functions "Download Cursor manually into ~/Downloads (https://www.cursor.com/downloads) and re-run."
                return 1
            fi
            rm -f "$cursor_file" 2>/dev/null || true
            $USE_SUDO rm -f "$CURSOR_PACKAGE_DIR/$(basename "$cursor_file")" 2>/dev/null || true
            sleep 2
            export CURSOR_RESTART_COUNT=$((CURSOR_RESTART_COUNT + 1))
            print_step_from_common_functions "Removing corrupted file and restarting installation (attempt $CURSOR_RESTART_COUNT/$CURSOR_MAX_RESTARTS)..."
            print_info_from_common_functions "Restarting script: $0 $@"
            exec "$0" "$@"
        elif [[ $install_result -ne 0 ]]; then
            print_error_from_common_functions "Failed to install Cursor .deb package"
            return 1
        fi

    elif [[ "$file_extension" == "AppImage" ]]; then
        print_info_from_common_functions "Detected AppImage, using extraction method..."

        extract_appimage "$cursor_file"
        local extract_result=$?

        if [[ $extract_result -eq 2 ]]; then
            # File corruption detected. Restart to re-fetch — BOUNDED by the exported
            # CURSOR_RESTART_COUNT so a persistently-bad download can't loop forever.
            print_error_from_common_functions "File corruption detected: $cursor_file"
            if [[ "$CURSOR_RESTART_COUNT" -ge "$CURSOR_MAX_RESTARTS" ]]; then
                print_error_from_common_functions "Still corrupted after $CURSOR_RESTART_COUNT restart(s); giving up."
                print_info_from_common_functions "Download Cursor manually into ~/Downloads (https://www.cursor.com/downloads) and re-run."
                return 1
            fi

            # Remove corrupted file
            rm -f "$cursor_file" 2>/dev/null || true
            $USE_SUDO rm -f "$CURSOR_PACKAGE_DIR/$(basename "$cursor_file")" 2>/dev/null || true
            $USE_SUDO rm -rf "$CURSOR_EXTRACTED_DIR/squashfs-root" 2>/dev/null || true

            # Wait a moment
            sleep 2

            # Restart the script with the same arguments (bounded by CURSOR_RESTART_COUNT)
            export CURSOR_RESTART_COUNT=$((CURSOR_RESTART_COUNT + 1))
            print_step_from_common_functions "Removing corrupted file and restarting installation (attempt $CURSOR_RESTART_COUNT/$CURSOR_MAX_RESTARTS)..."
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
    else
        save_installation_info "unknown" "$cursor_file" "$install_type"
    fi

    print_success_from_common_functions "Cursor IDE installation completed successfully!"
    print_info_from_common_functions "Installation details:"
    print_info_from_common_functions "  - Type: $install_type ($file_extension)"
    print_info_from_common_functions "  - Binary: ${CURSOR_BINARY:-unknown}"
    print_info_from_common_functions "  - Icon: ${CURSOR_ICON:-unknown}"
    print_info_from_common_functions "  - User data: ${CURSOR_USERDATA_DIR:-unknown}"
    print_info_from_common_functions ""
    print_info_from_common_functions "You can now launch Cursor from:"
    print_info_from_common_functions "  - Applications menu (Cursor icon)"
    print_info_from_common_functions "  - Desktop entry will launch with pkexec (root with user data directory)"
    print_info_from_common_functions "  - Wubi/CJK IME: run 173_install_chinese_wubi.sh first, or re-run 122 to refresh IME config"

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
    # Subcommands: cleanup (uninstall) or refresh (re-assert launcher + IME without
    # reinstalling; used by 173_install_chinese_wubi.sh). Default (no arg) = idempotent
    # install that refreshes first and asks [y/N] before any reinstall.
    case "${1:-}" in
        cleanup|--cleanup|remove|--remove|uninstall|--uninstall)
            cleanup_cursor
            exit $?
            ;;
        refresh|--refresh|reload|--reload)
            refresh_cursor_config
            exit $?
            ;;
    esac

    # Check if we have a desktop environment (Cursor is a GUI application)
    # Only skip IDE when pure server without desktop; always install Cursor Agent (CLI) on Linux.
    if [[ "$HAS_DESKTOP_ENVIRONMENT" != true ]] && [[ "$IS_WSL" != true ]] && [[ "$IS_PRODUCTION" == true ]]; then
        print_info_from_common_functions "[$SCRIPT_INDEX] Skipping Cursor IDE (production server without desktop environment)"
        print_info_from_common_functions "[$SCRIPT_INDEX] Installing Cursor Agent (CLI) only - required for both desktop and headless."
        ensure_cursor_agent_installed
        exit 0
    fi

    print_header_from_common_functions "Cursor IDE Installation Script"
    print_info_from_common_functions "Installation Directory: $CURSOR_INSTALL_DIR"

    # Run installation (will prompt for upgrade/reinstall inside install_cursor)
    install_cursor
    exit $?
}

# Run main function. Optional arg: cleanup|remove|uninstall (otherwise idempotent install).
main "$@"
