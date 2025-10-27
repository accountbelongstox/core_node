#!/bin/bash
# Visual Studio Code Installation Script
#
# Usage:
#   ./122_install_vscode.sh                    # Normal installation
#   ./122_install_vscode.sh --force           # Force reinstallation
#   ./122_install_vscode.sh --cleanup         # Remove VS Code installation
#
# This script installs Visual Studio Code from .deb files found in ~/Downloads
# If no .deb is found, it opens the download page and waits for manual download
#
# Include common functions and centralized configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LINUX_COMMON_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")/common"
SHELLS_COMMON_DIR="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")/common"
source "$LINUX_COMMON_DIR/common_functions.sh"
source "$SHELLS_COMMON_DIR/app_registry.sh"
source "$SHELLS_COMMON_DIR/install_logic.sh"

# Export legacy configuration for backward compatibility
export_legacy_config "vscode"

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
source "$PARENT_DIR_LEVEL_1/debian_com/installation_library.sh"

# Declare variables
INSTALL_MODE=$(get_var "INSTALL_MODE" "base")
FORCE_INSTALL=false
CLEANUP_MODE=false
VSCODE_INSTALL_DIR="$(map_web_path "compile_dir")/vscode"
VSCODE_DEB_DIR="$VSCODE_INSTALL_DIR/deb"
VSCODE_INSTALLED_FLAG="$GLOBAL_VAR_DIR/vscode_installed.flag"

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
VSCODE_DOWNLOAD_URL="https://code.visualstudio.com/"

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

# Check if VS Code is already installed
is_vscode_installed() {
    if command -v code >/dev/null 2>&1; then
        return 0  # Installed
    fi
    return 1  # Not installed
}

# Find VS Code .deb files using centralized logic
find_vscode_deb() {
    find_files_by_pattern "${APP_CONFIGS[vscode_pattern]}"
}

# Use centralized automated download
vscode_automated_download() {
    print_step_from_common_functions "Attempting automated download via core_node_init..."

    if automated_download "vscode"; then
        local deb_file=$(find_vscode_deb)
        if [[ $? -eq 0 ]] && [[ -n "$deb_file" ]]; then
            print_success_from_common_functions "Found downloaded VS Code .deb: $(basename "$deb_file")"
            echo "$deb_file"
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
vscode_manual_download() {
    print_step_from_common_functions "Falling back to manual download..."

    local downloaded_file=$(manual_download_fallback "vscode" "${APP_CONFIGS[vscode_name]}" "${APP_CONFIGS[vscode_url]}" "${APP_CONFIGS[vscode_pattern]}")
    if [[ $? -eq 0 ]] && [[ -n "$downloaded_file" ]]; then
        print_success_from_common_functions "Manual download completed: $(basename "$downloaded_file")"
        echo "$downloaded_file"
        return 0
    else
        print_error_from_common_functions "Manual download failed"
        return 1
    fi
}

# Install .deb package
install_deb_package() {
    local deb_file="$1"
    
    print_step_from_common_functions "Installing VS Code from .deb package..."
    
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
            return 1
        fi
    fi
    
    return 0
}

# Create super scripts launcher
create_super_scripts_launcher() {
    print_step_from_common_functions "Creating super scripts launcher..."
    
    if command -v sudo >/dev/null 2>&1; then
        sudo mkdir -p "/usr/local/super_scripts"

        # Create the super_scripts launcher
        local super_launcher_content='#!/bin/bash
# VS Code Super Launcher Script
# This script is called from desktop entries and provides enhanced launching

if ! command -v code >/dev/null 2>&1; then
    echo "Error: VS Code (code) not found in PATH"
    exit 1
fi

# Launch VS Code
exec code "$@"
'

        echo "$super_launcher_content" | sudo tee "/usr/local/super_scripts/code.sh" > /dev/null
        sudo chmod +x "/usr/local/super_scripts/code.sh"

        # Create symlink in /usr/local/bin for global access (if not already exists)
        if [[ ! -L "/usr/local/bin/vscode" ]]; then
            sudo ln -sf "/usr/local/super_scripts/code.sh" "/usr/local/bin/vscode"
        fi
    else
        mkdir -p "/usr/local/super_scripts"
        echo "$super_launcher_content" | tee "/usr/local/super_scripts/code.sh" > /dev/null
        chmod +x "/usr/local/super_scripts/code.sh"

        if [[ ! -L "/usr/local/bin/vscode" ]]; then
            ln -sf "/usr/local/super_scripts/code.sh" "/usr/local/bin/vscode"
        fi
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

    # Terminate VS Code processes
    print_step_from_common_functions "Terminating VS Code processes..."
    kill_processes_by_name "code" true

    # Remove VS Code package
    if dpkg -l | grep -q "code"; then
        print_step_from_common_functions "Removing VS Code package..."
        $USE_SUDO apt-get remove --purge -y code
    fi

    # Remove installation directory using robust removal
    if [[ -d "$VSCODE_INSTALL_DIR" ]]; then
        print_step_from_common_functions "Removing installation directory: $VSCODE_INSTALL_DIR"
        robust_remove_directory "$VSCODE_INSTALL_DIR"
    fi

    # Remove super scripts launcher
    if [[ -f "/usr/local/super_scripts/code.sh" ]]; then
        print_step_from_common_functions "Removing super scripts launcher"
        $USE_SUDO rm -f "/usr/local/super_scripts/code.sh"
    fi

    # Remove symlink
    if [[ -L "/usr/local/bin/vscode" ]]; then
        print_step_from_common_functions "Removing symlink: /usr/local/bin/vscode"
        $USE_SUDO rm -f "/usr/local/bin/vscode"
    fi

    # Remove installation flag
    if [[ -f "$VSCODE_INSTALLED_FLAG" ]]; then
        print_step_from_common_functions "Removing installation flag: $VSCODE_INSTALLED_FLAG"
        $USE_SUDO rm -f "$VSCODE_INSTALLED_FLAG"
    fi

    print_success_from_common_functions "VS Code cleanup completed"
    return 0
}

# Main installation function
install_vscode() {
    print_header_from_common_functions "Installing Visual Studio Code"

    # Install dependencies
    install_dependencies

    # Use centralized download and install workflow
    print_step_from_common_functions "Starting VS Code download workflow..."
    local deb_file=$(download_and_install_app "vscode" "$FORCE_INSTALL")
    if [[ $? -ne 0 ]] || [[ -z "$deb_file" ]]; then
        # Try manual download as final fallback
        deb_file=$(vscode_manual_download)
        if [[ $? -ne 0 ]] || [[ -z "$deb_file" ]]; then
            print_error_from_common_functions "Failed to find or download VS Code .deb"
            return 1
        fi
    fi

    print_success_from_common_functions "Using VS Code .deb: $(basename "$deb_file")"

    # Install .deb package
    if ! install_deb_package "$deb_file"; then
        print_error_from_common_functions "Failed to install VS Code .deb package"
        return 1
    fi

    # Create super scripts launcher
    if ! create_super_scripts_launcher; then
        print_error_from_common_functions "Failed to create super scripts launcher"
        return 1
    fi

    # Create installation flag
    print_step_from_common_functions "Creating installation flag..."
    $USE_SUDO mkdir -p "$(dirname "$VSCODE_INSTALLED_FLAG")"
    echo "$(date): VS Code installed successfully" | $USE_SUDO tee "$VSCODE_INSTALLED_FLAG" > /dev/null

    print_success_from_common_functions "Visual Studio Code installation completed successfully!"
    print_info_from_common_functions "You can now launch VS Code from:"
    print_info_from_common_functions "  - Applications menu"
    print_info_from_common_functions "  - Command line: code"
    print_info_from_common_functions "  - Alternative command: vscode"

    return 0
}

# Interactive cleanup prompt using centralized logic
prompt_cleanup_reinstall() {
    if is_vscode_installed; then
        print_warning_from_common_functions "VS Code is already installed"
        echo -n "Do you want to clean up and reinstall? (y/N): "
        read -r response
        case "$response" in
            [yY]|[yY][eE][sS])
                print_info_from_common_functions "Cleaning up existing installation..."
                cleanup_vscode
                return 0  # Proceed with installation
                ;;
            *)
                print_info_from_common_functions "Keeping existing installation"
                return 1  # Skip installation
                ;;
        esac
    fi
    return 0  # No existing installation, proceed
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
