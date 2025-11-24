#!/bin/bash
# Visual Studio Code Installation Script
#
# Usage:
#   ./122_install_vscode.sh                    # Normal installation (root mode with pkexec)
#   ./122_install_vscode.sh --force           # Force reinstallation
#   ./122_install_vscode.sh --cleanup         # Remove VS Code installation
#   ./122_install_vscode.sh --no-root         # Install in normal mode (no pkexec)
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
SCRIPT_INDEX="122"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/installation_library.sh"

# Initialize global variables
init_global_vars

# Declare variables
INSTALL_MODE=$(get_var "INSTALL_MODE" "base")
FORCE_INSTALL=false
CLEANUP_MODE=false
USE_ROOT_MODE=true  # Default to root mode (pkexec)
USE_ROOT_MODE_SPECIFIED=false  # Track if mode was specified via CLI

# Set up VSCode directories using new applications_dir mapping
APPLICATIONS_DIR=$(map_web_path "compile_dir" "applications")
VSCODE_INSTALL_DIR="$APPLICATIONS_DIR/vscode"
VSCODE_DEB_DIR="$VSCODE_INSTALL_DIR/deb"
VSCODE_INSTALLED_FLAG="$VSCODE_INSTALL_DIR/.installed"
VSCODE_DOWNLOAD_URL="https://code.visualstudio.com/Download"
DESKTOP_MANAGER_SCRIPT="$PARENT_DIR_LEVEL_1/debian_com/desktop_entry_manager.sh"
DESKTOP_MANAGER_USER="${SUDO_USER:-$USER}"
DESKTOP_MANAGER_HOME="$(getent passwd "$DESKTOP_MANAGER_USER" | cut -d: -f6)"
if [[ -z "$DESKTOP_MANAGER_HOME" ]] || [[ ! -d "$DESKTOP_MANAGER_HOME" ]]; then
    DESKTOP_MANAGER_HOME="$HOME"
fi
DESKTOP_MANAGER_APPS_DIR="$DESKTOP_MANAGER_HOME/.local/share/applications"
SYSTEM_DESKTOP_FILE="/usr/share/applications/code.desktop"
LAUNCH_DIR="/var/_core_node/scripts_launch_dir"

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
            --no-root)
                USE_ROOT_MODE=false
                USE_ROOT_MODE_SPECIFIED=true
                shift
                ;;
            *)
                echo "Unknown option: $1"
                echo "Usage: $0 [--force] [--cleanup] [--no-root]"
                exit 1
                ;;
        esac
    done
}

# Extract version from filename
extract_version_from_filename() {
    local filename="$1"
    local basename_file=$(basename "$filename")

    # Pattern: code_1.85.0-1234567890_amd64.deb -> 1.85.0
    if [[ "$basename_file" =~ code[_-]([0-9]+\.[0-9]+\.[0-9]+) ]]; then
        echo "${BASH_REMATCH[1]}"
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

    $USE_SUDO mkdir -p "$(dirname "$VSCODE_INSTALLED_FLAG")"
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

# Find VS Code .deb files inside /home/*/Downloads
find_vscode_file() {
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

# Manual download fallback
vscode_manual_download() {
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
                downloaded_file=$(find_vscode_file)
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
        print_step_from_common_functions "Corrupted file left in place: $deb_file"
        print_info_from_common_functions "Please remove it manually from /home/<username>/Downloads"
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
            chown -R "$desktop_manager_user:$desktop_manager_user" "$vscode_userdata_dir" 2>/dev/null || true
        fi
    fi

    # Use --create-app to generate launcher and desktop entry
    # Arguments: name display_name binary icon category description wm_class userdata_dir use_root_mode
    if bash "$DESKTOP_MANAGER_SCRIPT" --create-app vscode "Visual Studio Code" /usr/bin/code "$vscode_icon" Development "Code editor for developers" "Code" "$vscode_userdata_dir" "$USE_ROOT_MODE" 2>&1; then
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

    # Prompt for root mode if not already specified via command line
    if [[ "$FORCE_INSTALL" != true ]] && [[ "${USE_ROOT_MODE_SPECIFIED:-false}" != true ]]; then
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

    local deb_file=$(find_vscode_file)

    if [[ -n "$deb_file" ]] && [[ -f "$deb_file" ]] && [[ "$FORCE_INSTALL" != true ]]; then
        print_info_from_common_functions "Using existing VS Code file: $(basename "$deb_file")"
    else
        if [[ "$FORCE_INSTALL" == true ]]; then
            print_warning_from_common_functions "Force install requested. Waiting for manual confirmation before proceeding"
        else
            print_warning_from_common_functions "No VS Code .deb found under /home/*/Downloads"
        fi

        deb_file=$(vscode_manual_download)
        local manual_result=$?

        if [[ $manual_result -ne 0 ]] || [[ -z "$deb_file" ]] || [[ ! -f "$deb_file" ]]; then
            print_error_from_common_functions "Manual download not completed. Cannot continue installation"
            return 1
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

            if [[ $retry_count -lt $((max_retries - 1)) ]]; then
                print_step_from_common_functions "Removing corrupted backup file..."
                $USE_SUDO rm -f "$VSCODE_DEB_DIR/$(basename "$deb_file")" 2>/dev/null || true

                print_step_from_common_functions "Please download a fresh VS Code .deb file and confirm with 'yes'"
                deb_file=$(vscode_manual_download)
                local manual_retry_result=$?

                if [[ $manual_retry_result -ne 0 ]] || [[ -z "$deb_file" ]] || [[ ! -f "$deb_file" ]]; then
                    print_error_from_common_functions "Manual re-download not completed"
                    return 1
                fi

                print_info_from_common_functions "Using manually re-downloaded file: $(basename "$deb_file")"
            fi

            retry_count=$((retry_count + 1))
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

        local available_file=$(find_vscode_file)
        if [[ -n "$available_file" ]] && [[ -f "$available_file" ]]; then
            print_info_from_common_functions "Detected manual installer: $(basename "$available_file")"
            local available_version=$(extract_version_from_filename "$available_file")

            if [[ -n "$available_version" ]]; then
                print_info_from_common_functions "Manual installer version: $available_version"

                if [[ -n "$installed_version" ]]; then
                    if [[ "$available_version" != "$installed_version" ]]; then
                        print_info_from_common_functions "A different version is available in /home/*/Downloads"
                    else
                        print_info_from_common_functions "Manual installer matches the installed version"
                    fi
                fi
            fi
        else
            print_warning_from_common_functions "No VS Code installer found under /home/*/Downloads"
            print_info_from_common_functions "Download the desired version manually after cleanup"
        fi

        echo -n "Do you want to clean up and reinstall using a manual download? (y/N): "
        read -r response
        case "$response" in
            [yY]|[yY][eE][sS])
                print_info_from_common_functions "Cleaning up existing installation..."
                cleanup_vscode
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
        cleanup_vscode
        exit $?
    fi

    # Check if we have a desktop environment (VS Code is a GUI application)
    # Only skip if we're on a pure server without any desktop environment
    if [[ "$HAS_DESKTOP_ENVIRONMENT" != true ]] && [[ "$IS_WSL" != true ]] && [[ "$IS_PRODUCTION" == true ]]; then
        print_info_from_common_functions "[$SCRIPT_INDEX] Skipping VS Code installation (production server without desktop environment)"
        print_info_from_common_functions "[$SCRIPT_INDEX] VS Code requires a desktop environment to run"
        exit 0
    fi

    print_header_from_common_functions "Visual Studio Code Installation Script"
    print_info_from_common_functions "Installation Directory: $VSCODE_INSTALL_DIR"

    # Interactive cleanup prompt (unless force install is specified)
    if [[ "$FORCE_INSTALL" != true ]]; then
        if ! prompt_cleanup_reinstall; then
            exit 0
        fi
    fi

    # Run installation
    install_vscode
    exit $?
}

# Run main function with all arguments
main "$@"
