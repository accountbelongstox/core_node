#!/bin/bash
# Visual Studio Code Installation Script
#
# Usage:
#   ./124_install_vscode.sh   # Normal installation (no arguments)
#
# This script installs Visual Studio Code from .deb files found in /home/<username>/Downloads
# If no .deb is found, it opens the download page and waits for manual download confirmation
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
SCRIPT_INDEX="123"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/installation_library.sh"
source "$PARENT_DIR_LEVEL_2/common/app_resource_limit.sh"

# Initialize global variables
init_global_vars

# Declare variables
INSTALL_MODE=$(get_var "INSTALL_MODE" "base")
USE_ROOT_MODE=true  # Default to root mode (pkexec)

# VSCode version configuration
VSCODE_VERSION="stable"
VSCODE_API_URL="https://code.visualstudio.com/sha/download?build=stable&os=linux-deb-x64"

# Set up VSCode directories using new applications_dir mapping
APPLICATIONS_DIR=$(map_web_path "compile_dir" "applications")
VSCODE_INSTALL_DIR="$APPLICATIONS_DIR/vscode"
VSCODE_DEB_DIR="$VSCODE_INSTALL_DIR/deb"

# Version tracking using GLOBAL_VAR_DIR
APP_VERSIONS_DIR="$GLOBAL_VAR_DIR/app_versions"
VSCODE_INSTALLED_FLAG="$APP_VERSIONS_DIR/vscode.version"
VSCODE_DOWNLOAD_URL="https://code.visualstudio.com/Download"
PRIMARY_DOWNLOAD_DIR="$HOME/Downloads"
DESKTOP_MANAGER_SCRIPT="$PARENT_DIR_LEVEL_1/debian_com/desktop_entry_manager.sh"
DESKTOP_MANAGER_USER="${SUDO_USER:-$USER}"
DESKTOP_MANAGER_HOME="$(getent passwd "$DESKTOP_MANAGER_USER" | cut -d: -f6)"
if [[ -z "$DESKTOP_MANAGER_HOME" ]] || [[ ! -d "$DESKTOP_MANAGER_HOME" ]]; then
    DESKTOP_MANAGER_HOME="$HOME"
fi
DESKTOP_MANAGER_APPS_DIR="$DESKTOP_MANAGER_HOME/.local/share/applications"
SYSTEM_DESKTOP_FILE="/usr/share/applications/code.desktop"
LAUNCH_DIR="$CORE_NODE_DATA_DIR/scripts_launch_dir"

# Ensure sudo is available and set USE_SUDO
if command -v sudo >/dev/null 2>&1; then
    USE_SUDO="sudo"
else
    USE_SUDO=""
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detect desktop user for userdata directory
detect_vscode_desktop_user() {
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

    # Last resort fallback
    echo "$USER:$HOME"
}

# No arguments supported (removed parameter parsing)

# Extract version from filename (use full filename without extension as version)
# Example: "code_1.85.0-1234567890_amd64.deb" -> "code_1.85.0-1234567890_amd64"
extract_version_from_filename() {
    local filename="$1"
    local basename_file=$(basename "$filename")

    # Remove file extension (.deb, .tar.gz, etc.)
    local version_string="${basename_file%.*}"

    if [[ -n "$version_string" ]]; then
        echo "$version_string"
        return 0
    fi

    return 1
}

# Get remote version from VSCode API by following redirects
# Returns: Version string (e.g., "code_1.85.0-1234567890_amd64") or empty string if not found
get_remote_vscode_version() {
    local api_url="$VSCODE_API_URL"
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
    if [[ -f "$VSCODE_INSTALLED_FLAG" ]]; then
        grep "^VERSION=" "$VSCODE_INSTALLED_FLAG" 2>/dev/null | cut -d= -f2
    fi
}

# Save installation info
save_installation_info() {
    local version="$1"
    local package_file="$2"

    # Create app versions directory if it doesn't exist
    $USE_SUDO mkdir -p "$APP_VERSIONS_DIR"

    # Save version info to GLOBAL_VAR_DIR
    cat <<EOF | $USE_SUDO tee "$VSCODE_INSTALLED_FLAG" > /dev/null
DATE=$(date '+%Y-%m-%d %H:%M:%S')
VERSION=$version
PACKAGE=$(basename "$package_file")
PATH=$package_file
EOF
}

# Check if VS Code is already installed
is_vscode_installed() {
    if command -v code >/dev/null 2>&1; then
        return 0  # Installed
    fi
    return 1  # Not installed
}

# DEPRECATED: This function is no longer used
# Use find_file_in_downloads_from_common_functions() instead
# Find VS Code .deb files inside /home/*/Downloads
find_vscode_file_deprecated() {
    local search_dirs=()
    local latest_file=""
    local latest_mtime=0

    if [[ -d "/home" ]]; then
        for user_home in /home/*; do
            [[ -d "$user_home" ]] || continue
            if [[ -d "$user_home/Downloads" ]]; then
                search_dirs+=("$user_home/Downloads")
            fi
        done
    fi

    for dir in "${search_dirs[@]}"; do
        while IFS= read -r -d '' candidate; do
            local basename_file=$(basename "$candidate")

            local file_mtime=$(stat -c %Y "$candidate" 2>/dev/null || echo 0)
            if (( file_mtime > latest_mtime )); then
                latest_mtime=$file_mtime
                latest_file="$candidate"
            fi
        done < <(find "$dir" -maxdepth 1 -type f -iname "code*.deb" -print0 2>/dev/null)
    done

    if [[ -n "$latest_file" ]]; then
        echo "$latest_file"
        return 0
    fi

    return 1
}

filter_self_processes() {
    local pids_list="$1"
    local filtered=()
    local script_pid=$$
    local shell_pid=${BASHPID:-$script_pid}
    local parent_pid=$PPID

    for pid in $pids_list; do
        [[ -z "$pid" ]] && continue
        if [[ "$pid" == "$script_pid" ]] || [[ "$pid" == "$shell_pid" ]] || [[ "$pid" == "$parent_pid" ]]; then
            continue
        fi
        filtered+=("$pid")
    done

    echo "${filtered[*]}"
}

# Safe process kill function
safe_kill_processes() {
    local process_name="$1"
    local use_sudo="${2:-false}"

    local pids=$(pgrep -f "$process_name" 2>/dev/null)
    pids=$(filter_self_processes "$pids")

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
        pids=$(filter_self_processes "$pids")
        if [[ -z "$pids" ]]; then
            print_success_from_common_functions "$process_name processes terminated gracefully"
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
    done

    # Force kill if still running (SIGKILL)
    pids=$(pgrep -f "$process_name" 2>/dev/null)
    pids=$(filter_self_processes "$pids")
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
    pids=$(filter_self_processes "$pids")
    if [[ -z "$pids" ]]; then
        print_success_from_common_functions "All $process_name processes terminated"
        return 0
    else
        print_error_from_common_functions "Failed to terminate some $process_name processes: $pids"
        return 1
    fi
}

# DEPRECATED: This function is no longer used
# Use prompt_and_wait_for_download_from_common_functions() instead
# Manual download fallback
vscode_manual_download_deprecated() {
    local confirmation=""
    local downloaded_file=""

    print_step_from_common_functions "Manual VS Code download required"
    print_info_from_common_functions "Place the VS Code .deb file under /home/<username>/Downloads (any user)"
    print_info_from_common_functions "Download page: $VSCODE_DOWNLOAD_URL"

    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$VSCODE_DOWNLOAD_URL" >/dev/null 2>&1 &
    else
        print_warning_from_common_functions "xdg-open not available. Please open $VSCODE_DOWNLOAD_URL manually"
    fi

    while true; do
        echo -n "Type 'yes' after the VS Code .deb is in /home/<username>/Downloads (any user, or 'quit' to stop): "
        read -r confirmation

        case "$confirmation" in
            [yY]|[yY][eE][sS])
                downloaded_file=$(find_file_in_downloads_from_common_functions "code*.deb" "newest")
                if [[ -n "$downloaded_file" ]] && [[ -f "$downloaded_file" ]]; then
                    print_success_from_common_functions "Found VS Code installer: $(basename "$downloaded_file")"
                    echo "$downloaded_file"
                    return 0
                fi
                print_warning_from_common_functions "No VS Code .deb detected yet in /home/*/Downloads"
                ;;
            [qQ]|[qQ][uU][iI][tT])
                print_warning_from_common_functions "Manual download aborted by user"
                return 1
                ;;
            *)
                print_info_from_common_functions "Waiting for manual confirmation..."
                ;;
        esac
    done
}

# Install .deb package
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

install_deb_package() {
    local deb_file="$1"

    print_step_from_common_functions "Installing VS Code from .deb package..."

    if ! check_deb_integrity "$deb_file"; then
        print_error_from_common_functions ".deb file integrity check failed"
        print_step_from_common_functions "Removing corrupted file: $deb_file"
        rm -f "$deb_file"
        return 2
    fi

    # Create directories
    $USE_SUDO mkdir -p "$VSCODE_DEB_DIR"

    # Copy .deb to installation directory
    print_step_from_common_functions "Copying .deb to $VSCODE_DEB_DIR"
    $USE_SUDO cp "$deb_file" "$VSCODE_DEB_DIR/"

    local deb_name=$(basename "$deb_file")
    local installed_deb="$VSCODE_DEB_DIR/$deb_name"

    # Install the .deb package
    print_step_from_common_functions "Installing .deb package..."
    if $USE_SUDO dpkg -i "$installed_deb"; then
        print_success_from_common_functions "VS Code .deb package installed successfully"
    else
        print_warning_from_common_functions "dpkg installation had issues, trying to fix dependencies..."
        $USE_SUDO apt-get install -f -y
        if $USE_SUDO dpkg -i "$installed_deb"; then
            print_success_from_common_functions "VS Code .deb package installed successfully after fixing dependencies"
        else
            print_error_from_common_functions "Failed to install VS Code .deb package"
            print_step_from_common_functions "Removing corrupted installed file: $installed_deb"
            $USE_SUDO rm -f "$installed_deb"
            return 1
        fi
    fi

    return 0
}

# Remove system desktop entries to avoid duplicates
remove_system_desktop_entries() {
    print_step_from_common_functions "Removing system desktop entries to avoid duplicates..."

    if [[ -f "$SYSTEM_DESKTOP_FILE" ]]; then
        $USE_SUDO mv "$SYSTEM_DESKTOP_FILE" "${SYSTEM_DESKTOP_FILE}.disabled" 2>/dev/null || true
        print_success_from_common_functions "System desktop entry disabled"
    fi

    return 0
}


# Create desktop entry via desktop_entry_manager
create_vscode_desktop_shortcut() {
    if [[ ! -x "$DESKTOP_MANAGER_SCRIPT" ]]; then
        print_warning_from_common_functions "desktop_entry_manager.sh not found or not executable"
        return 0
    fi

    print_step_from_common_functions "Creating desktop entry via desktop_entry_manager.sh"

    # Detect desktop user
    local desktop_user_info="$(detect_vscode_desktop_user)"
    local desktop_manager_user="${desktop_user_info%%:*}"
    local desktop_manager_home="${desktop_user_info##*:}"
    local desktop_manager_apps_dir="$desktop_manager_home/.local/share/applications"

    print_info_from_common_functions "Detected desktop user: $desktop_manager_user ($desktop_manager_home)"

    # Detect icon path (fallback to app name if not found)
    local vscode_icon="/usr/share/pixmaps/vscode.png"
    if [[ ! -f "$vscode_icon" ]]; then
        print_step_from_common_functions "VSCode icon not found at $vscode_icon, will use intelligent search"
        vscode_icon="vscode"  # Let desktop_entry_manager.sh search for it
    fi

    # Build user data directory path for VSCode
    local vscode_userdata_dir="$desktop_manager_home/.config/Code"
    print_info_from_common_functions "VSCode user data directory: $vscode_userdata_dir"

    # Create user data directory if it doesn't exist
    if [[ ! -d "$vscode_userdata_dir" ]]; then
        mkdir -p "$vscode_userdata_dir" 2>/dev/null || true
        # Set ownership to desktop user if running as root
        if [[ "$EUID" -eq 0 ]] && [[ "$desktop_manager_user" != "root" ]] && [[ -d "$vscode_userdata_dir" ]]; then
            safe_chown_R "$desktop_manager_user:$desktop_manager_user" "$vscode_userdata_dir"
        fi
    fi

    # Resource limit: create a machine-relative cgroup-v2 wrapper for VS Code and
    # launch THROUGH it. Root mode (pkexec) -> --system scope (a --user scope would
    # not govern the root-re-execed app); normal mode -> --user. The wrapper is
    # passed to --create-app as the binary; desktop_entry_manager's
    # extract_original_binary leaves it untouched (no DEM marker) -> no recursion.
    local vscode_launch_bin="/usr/bin/code"
    local arl_root_flag=""
    [[ "$USE_ROOT_MODE" == "true" ]] && arl_root_flag="--root"
    if apply_app_resource_limit --id vscode --exec /usr/bin/code $arl_root_flag \
        && [[ -x /usr/local/bin/vscode-rlimit ]]; then
        vscode_launch_bin="/usr/local/bin/vscode-rlimit"
    fi

    # Use --create-app to generate launcher and desktop entry
    # Arguments: name display_name binary icon category description wm_class userdata_dir use_root_mode
    if bash "$DESKTOP_MANAGER_SCRIPT" --create-app vscode "Visual Studio Code" "$vscode_launch_bin" "$vscode_icon" Development "Code editor for developers" "Code" "$vscode_userdata_dir" "$USE_ROOT_MODE" 2>&1; then
        local expected_entry="$desktop_manager_apps_dir/core_node_vscode.desktop"
        if [[ -f "$expected_entry" ]]; then
            print_success_from_common_functions "Desktop entry created for VS Code"
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
    print_step_from_common_functions "Installing required dependencies..."

    # Update package list
    $USE_SUDO apt-get update -qq

    # Install dependencies for .deb packages
    local deps=("wget" "gpg" "software-properties-common" "apt-transport-https")

    for dep in "${deps[@]}"; do
        if ! dpkg -l | grep -q "^ii  $dep "; then
            print_step_from_common_functions "Installing $dep..."
            $USE_SUDO apt-get install -y "$dep"
        fi
    done

    return 0
}

# Cleanup VS Code installation
cleanup_vscode() {
    print_header_from_common_functions "Cleaning up VS Code installation"

    # Terminate VS Code processes using safe method
    print_step_from_common_functions "Terminating VS Code processes..."
    safe_kill_processes "vscode" true

    # Remove VS Code packages
    if dpkg -l | grep -q "code"; then
        print_step_from_common_functions "Removing VS Code package..."
        $USE_SUDO apt-get remove --purge -y code
    fi

    # Remove installation directory
    if [[ -d "$VSCODE_INSTALL_DIR" ]]; then
        print_step_from_common_functions "Removing installation directory: $VSCODE_INSTALL_DIR"
        $USE_SUDO rm -rf "$VSCODE_INSTALL_DIR"
    fi

    # Remove installation flag
    if [[ -f "$VSCODE_INSTALLED_FLAG" ]]; then
        print_step_from_common_functions "Removing installation flag: $VSCODE_INSTALLED_FLAG"
        $USE_SUDO rm -f "$VSCODE_INSTALLED_FLAG"
    fi

    # Remove launcher script (auto-generated by desktop_entry_manager)
    local launcher_script="$LAUNCH_DIR/vscode_launcher.sh"
    if [[ -e "$launcher_script" ]] || [[ -L "$launcher_script" ]]; then
        print_step_from_common_functions "Removing launcher script: $launcher_script"
        $USE_SUDO rm -f "$launcher_script"
    fi

    # Remove desktop entry (auto-generated by desktop_entry_manager)
    local desktop_entry="$DESKTOP_MANAGER_APPS_DIR/core_node_vscode.desktop"
    if [[ -f "$desktop_entry" ]]; then
        print_step_from_common_functions "Removing desktop entry: $desktop_entry"
        rm -f "$desktop_entry"
    fi

    # Restore system desktop entry
    if [[ -f "${SYSTEM_DESKTOP_FILE}.disabled" ]]; then
        print_step_from_common_functions "Restoring system desktop entry"
        $USE_SUDO mv "${SYSTEM_DESKTOP_FILE}.disabled" "$SYSTEM_DESKTOP_FILE" 2>/dev/null || true
    fi

    print_success_from_common_functions "VS Code cleanup completed"
    return 0
}

# Main installation function
install_vscode() {
    print_header_from_common_functions "Installing Visual Studio Code"

    # Prompt for root mode
    if true; then
        echo ""
        echo -n "Do you want to install VS Code with root privileges (pkexec)? (Y/n): "
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

    # Install dependencies
    install_dependencies

    print_step_from_common_functions "Searching for VS Code installer in /home/*/Downloads..."

    local deb_file=$(find_file_in_downloads_from_common_functions "code*.deb" "newest")

    if [[ -n "$deb_file" ]] && [[ -f "$deb_file" ]]; then
        print_info_from_common_functions "Found VS Code installer: $(basename "$deb_file")"
    else
        print_warning_from_common_functions "No VS Code installer detected in any Downloads directories"
        print_step_from_common_functions "Attempting automatic download from VS Code API..."
        print_info_from_common_functions "API URL: $VSCODE_API_URL"

        # Try auto-download using enhanced function with browser headers
        local download_dir="$PRIMARY_DOWNLOAD_DIR"
        if [[ ! -d "$download_dir" ]]; then
            download_dir=$(find /home -maxdepth 2 -type d -name "Downloads" 2>/dev/null | head -1)
        fi
        if [[ -z "$download_dir" ]] || [[ ! -d "$download_dir" ]]; then
            download_dir="/tmp"
        fi

        print_info_from_common_functions "Download directory: $download_dir"

        local downloaded_file=$(download_with_browser_headers_from_common_functions "$VSCODE_API_URL" "$download_dir" 3)

        # If function returned a path, verify it exists
        if [[ -n "$downloaded_file" ]] && [[ -f "$downloaded_file" ]]; then
            print_success_from_common_functions "Auto-download successful: $(basename "$downloaded_file")"
            deb_file="$downloaded_file"
        else
            # Function failed to return path, try scanning Downloads directory
            print_warning_from_common_functions "Download function did not return file path, scanning Downloads..."

            sleep 2  # Wait for file system to sync

            local found_deb=$(find_file_in_downloads_from_common_functions "code*.deb" "newest")
            if [[ -n "$found_deb" ]] && [[ -f "$found_deb" ]]; then
                print_success_from_common_functions "Found downloaded .deb: $(basename "$found_deb")"
                deb_file="$found_deb"
            else
                # Auto-download failed, fallback to manual download
                print_warning_from_common_functions "Auto-download failed, switching to manual download mode"
                print_step_from_common_functions "Opening VS Code download page for manual download..."

                if command -v xdg-open >/dev/null 2>&1; then
                    xdg-open "$VSCODE_DOWNLOAD_URL" >/dev/null 2>&1 &
                fi

                # Use global function for manual download prompt
                deb_file=$(prompt_and_wait_for_download_from_common_functions \
                    "$VSCODE_DOWNLOAD_URL" \
                    "code*.deb" \
                    0)

                if [[ -z "$deb_file" ]] || [[ ! -f "$deb_file" ]]; then
                    print_error_from_common_functions "Manual download is required before installation can continue"
                    return 1
                fi
            fi
        fi
    fi

    print_success_from_common_functions "Using VS Code .deb: $(basename "$deb_file")"

    # Install .deb package with automatic retry on corruption
    local install_result
    local max_retries=2
    local retry_count=0

    while [[ $retry_count -lt $max_retries ]]; do
        install_deb_package "$deb_file"
        install_result=$?

        if [[ $install_result -eq 0 ]]; then
            break
        elif [[ $install_result -eq 2 ]]; then
            print_warning_from_common_functions "Corrupted .deb detected (attempt $((retry_count + 1))/$max_retries)"
            print_error_from_common_functions "File corruption detected: $deb_file"
            print_step_from_common_functions "Removing corrupted file and restarting installation..."

            # Remove corrupted file
            rm -f "$deb_file" 2>/dev/null || true
            $USE_SUDO rm -f "$VSCODE_DEB_DIR/$(basename "$deb_file")" 2>/dev/null || true

            # Wait a moment
            sleep 2

            # Restart the script with the same arguments
            print_info_from_common_functions "Restarting script: $0 $@"
            exec "$0" "$@"
        else
            print_error_from_common_functions "Failed to install VS Code .deb package"
            return 1
        fi
    done

    if [[ $install_result -ne 0 ]]; then
        print_error_from_common_functions "Failed to install VS Code after $max_retries attempts"
        return 1
    fi

    # Remove system desktop entry and create custom one via desktop_entry_manager
    remove_system_desktop_entries
    create_vscode_desktop_shortcut

    # Save installation info with version
    print_step_from_common_functions "Saving installation info..."
    local installed_version=$(extract_version_from_filename "$deb_file")
    if [[ -n "$installed_version" ]]; then
        save_installation_info "$installed_version" "$deb_file"
        print_info_from_common_functions "Installed version: $installed_version"
    else
        $USE_SUDO mkdir -p "$(dirname "$VSCODE_INSTALLED_FLAG")"
        echo "$(date): VS Code installed successfully" | $USE_SUDO tee "$VSCODE_INSTALLED_FLAG" > /dev/null
    fi

    # Display post-install artifacts for verification
    local launcher_script="$LAUNCH_DIR/vscode_launcher.sh"
    local desktop_entry="$DESKTOP_MANAGER_APPS_DIR/core_node_vscode.desktop"
    show_post_install_artifacts_from_common_functions "$launcher_script" "$desktop_entry" "${SYSTEM_DESKTOP_FILE}.disabled"

    print_success_from_common_functions "Visual Studio Code installation completed successfully!"
    print_info_from_common_functions "You can now launch VS Code from:"
    print_info_from_common_functions "  - Applications menu (Visual Studio Code (Core Node))"
    print_info_from_common_functions "  - This will launch VS Code with sudo and --no-sandbox automatically"

    return 0
}

# Interactive cleanup prompt with version check
prompt_cleanup_reinstall() {
    if is_vscode_installed; then
        print_warning_from_common_functions "VS Code is already installed"

        local installed_version=$(get_installed_version)
        if [[ -n "$installed_version" ]]; then
            print_info_from_common_functions "Installed version: $installed_version"
        else
            print_info_from_common_functions "No version metadata found for current installation"
        fi

        # Get remote version from API
        print_step_from_common_functions "Checking for updates from VS Code API..."
        local remote_version=$(get_remote_vscode_version)

        if [[ -n "$remote_version" ]]; then
            print_info_from_common_functions "Latest version available: $remote_version"

            # Compare versions
            if [[ -n "$installed_version" ]] && [[ "$installed_version" == "$remote_version" ]]; then
                print_success_from_common_functions "VS Code is already up to date (version $installed_version)"
                print_info_from_common_functions "No upgrade needed"
                return 1
            fi
        else
            print_warning_from_common_functions "Unable to retrieve remote version from API"
            print_info_from_common_functions "Will proceed with manual version check"
        fi

        # Check for available installer in Downloads
        local available_file=$(find_file_in_downloads_from_common_functions "code*.deb" "newest")
        local available_version=""
        if [[ -n "$available_file" ]] && [[ -f "$available_file" ]]; then
            print_info_from_common_functions "Detected manual installer: $(basename "$available_file")"
            available_version=$(extract_version_from_filename "$available_file")

            if [[ -n "$available_version" ]]; then
                print_info_from_common_functions "Manual installer version: $available_version"
            fi
        fi

        # Determine prompt message
        local prompt_message=""
        if [[ -n "$installed_version" ]] && [[ -n "$remote_version" ]] && [[ "$installed_version" != "$remote_version" ]]; then
            # Remote version available and different
            prompt_message="VS Code $installed_version is installed. Upgrade to $remote_version? (Y/n): "
        elif [[ -n "$available_version" ]] && [[ -n "$installed_version" ]] && [[ "$available_version" != "$installed_version" ]]; then
            # Manual installer available and different
            prompt_message="VS Code $installed_version is installed. Upgrade to $available_version? (Y/n): "
        else
            # No version info or same version
            prompt_message="Do you want to clean up and reinstall? (y/N): "
        fi

        echo -n "$prompt_message"
        read -r response

        # Handle upgrade prompt
        local should_proceed=false
        if [[ "$prompt_message" == *"Upgrade"* ]]; then
            # Upgrade prompt - Y is default
            case "$response" in
                [nN]|[nN][oO])
                    print_info_from_common_functions "Upgrade cancelled - keeping existing installation"
                    return 1
                    ;;
                *)
                    should_proceed=true
                    print_info_from_common_functions "Proceeding with upgrade..."
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
                    print_info_from_common_functions "Keeping existing installation"
                    return 1
                    ;;
            esac
        fi

        if [[ "$should_proceed" == true ]]; then
            print_info_from_common_functions "Cleaning up existing installation..."
            cleanup_vscode
            return 0
        fi
    fi
    return 0
}

# Main script execution
main() {
    # Check if we have a desktop environment (VS Code is a GUI application)
    # Only skip if we're on a pure server without any desktop environment
    if [[ "$HAS_DESKTOP_ENVIRONMENT" != true ]] && [[ "$IS_WSL" != true ]] && [[ "$IS_PRODUCTION" == true ]]; then
        print_info_from_common_functions "[$SCRIPT_INDEX] Skipping VS Code installation (production server without desktop environment)"
        print_info_from_common_functions "[$SCRIPT_INDEX] VS Code requires a desktop environment to run"
        exit 0
    fi

    print_header_from_common_functions "Visual Studio Code Installation Script"
    print_info_from_common_functions "Installation Directory: $VSCODE_INSTALL_DIR"

    # Idempotent limit refresh: when VS Code is already installed, always re-apply the
    # resource limit + desktop entry FIRST so a re-run picks up updated caps even if the
    # user declines the reinstall/upgrade prompt below (which exits before the limit step).
    # No download/reinstall here. Preserve the scope mode baked in the existing wrapper so
    # a refresh never flips --user<->--system (root-mode install keeps --system).
    if is_vscode_installed; then
        if [[ -f /usr/local/bin/vscode-rlimit ]]; then
            grep -q '^ARL_SCOPE_MODE="system"' /usr/local/bin/vscode-rlimit && USE_ROOT_MODE=true
            grep -q '^ARL_SCOPE_MODE="user"'   /usr/local/bin/vscode-rlimit && USE_ROOT_MODE=false
        fi
        create_vscode_desktop_shortcut || true
    fi

    # Interactive cleanup prompt
    if ! prompt_cleanup_reinstall; then
        exit 0
    fi

    # Run installation
    install_vscode
    exit $?
}

# Run main function (no arguments supported)
main
