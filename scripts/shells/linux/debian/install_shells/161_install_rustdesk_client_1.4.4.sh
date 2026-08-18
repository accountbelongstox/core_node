#!/bin/bash
# RustDesk Client Installation Script
#
# Usage:
#   ./125_install_rustdesk_client_1.4.4.sh
#
# This script installs RustDesk Client - a remote desktop application
# Recommended for desktop systems
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
SCRIPT_INDEX="125"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/installation_library.sh"
source "$PARENT_DIR_LEVEL_2/common/get_real_user.sh"

# Initialize global variables
init_global_vars

# Declare variables
INSTALL_MODE=$(get_var "INSTALL_MODE" "base")

# Real user detection
REAL_USER=$(get_real_user)
REAL_USER_HOME=$(get_real_user_home)
REAL_USER_DOWNLOADS=$(get_real_user_downloads)
REAL_USER_GROUP=$(id -gn "$REAL_USER" 2>/dev/null || echo "$REAL_USER")

# RustDesk version configuration
RUSTDESK_VERSION="1.4.4"
RUSTDESK_DEB_URL="https://github.com/rustdesk/rustdesk/releases/download/${RUSTDESK_VERSION}/rustdesk-${RUSTDESK_VERSION}-x86_64.deb"

# Set up directories
APPLICATIONS_DIR=$(map_web_path "compile_dir" "applications")
RUSTDESK_INSTALL_DIR="$APPLICATIONS_DIR/rustdesk"
RUSTDESK_DEB_DIR="$RUSTDESK_INSTALL_DIR/deb"

# Version tracking
APP_VERSIONS_DIR="$GLOBAL_VAR_DIR/app_versions"
RUSTDESK_INSTALLED_FLAG="$APP_VERSIONS_DIR/rustdesk_client.version"

# Ensure sudo is available
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
NC='\033[0m'

# Get installed version
get_installed_version() {
    if [[ -f "$RUSTDESK_INSTALLED_FLAG" ]]; then
        grep "^VERSION=" "$RUSTDESK_INSTALLED_FLAG" 2>/dev/null | cut -d= -f2
    fi
}

# Save installation info
save_installation_info() {
    local version="$1"
    local package_file="$2"

    $USE_SUDO mkdir -p "$APP_VERSIONS_DIR"

    cat <<EOF | $USE_SUDO tee "$RUSTDESK_INSTALLED_FLAG" > /dev/null
DATE=$(date '+%Y-%m-%d %H:%M:%S')
VERSION=$version
PACKAGE=$(basename "$package_file")
PATH=$package_file
EOF
}

# Check if RustDesk Client is already installed
is_rustdesk_installed() {
    if command -v rustdesk >/dev/null 2>&1; then
        return 0
    fi
    if dpkg -l | grep -q "^ii  rustdesk "; then
        return 0
    fi
    return 1
}

# Check .deb integrity
check_deb_integrity() {
    local deb_file="$1"

    print_step_from_common_functions "Checking .deb file integrity..."

    if [[ ! -f "$deb_file" ]]; then
        print_error_from_common_functions ".deb file not found: $deb_file"
        return 1
    fi

    local file_size=$(stat -c%s "$deb_file" 2>/dev/null || echo "0")

    if [[ "$file_size" -lt 10000000 ]]; then
        print_warning_from_common_functions ".deb file too small ($file_size bytes), expected > 10MB"
        return 1
    fi

    if ! dpkg-deb --info "$deb_file" >/dev/null 2>&1; then
        print_warning_from_common_functions ".deb file is corrupted (dpkg-deb check failed)"
        return 1
    fi

    print_success_from_common_functions ".deb file integrity check passed"
    return 0
}

# Install .deb package
install_deb_package() {
    local deb_file="$1"

    print_step_from_common_functions "Installing RustDesk Client from .deb package..."

    if ! check_deb_integrity "$deb_file"; then
        print_error_from_common_functions ".deb file integrity check failed"
        return 1
    fi

    # Create directories
    echo "Creating directory: $RUSTDESK_DEB_DIR"
    $USE_SUDO mkdir -p "$RUSTDESK_DEB_DIR"

    # Copy .deb to installation directory
    print_step_from_common_functions "Copying .deb to $RUSTDESK_DEB_DIR"
    echo "Running: cp $(basename "$deb_file") $RUSTDESK_DEB_DIR/"
    $USE_SUDO cp "$deb_file" "$RUSTDESK_DEB_DIR/"

    local deb_name=$(basename "$deb_file")
    local installed_deb="$RUSTDESK_DEB_DIR/$deb_name"

    # Install the .deb package. Install the local file through apt so that every
    # dependency declared by the package (gstreamer1.0-pipewire, libasound2t64, libva*, ...)
    # is resolved automatically across Debian/Kali/Ubuntu, including t64-renamed libraries.
    # This is the official recommended method and avoids the dpkg "dependency problems" failure.
    print_step_from_common_functions "Installing .deb package (resolving dependencies via apt)..."
    echo "Running: apt-get install -y $installed_deb"
    if $USE_SUDO apt-get install -y "$installed_deb"; then
        print_success_from_common_functions "RustDesk Client .deb package installed successfully"
    else
        print_warning_from_common_functions "apt install failed, falling back to dpkg with dependency fix..."
        echo "Running: dpkg -i $installed_deb"
        $USE_SUDO dpkg -i "$installed_deb" || true
        echo "Running: apt-get install -f -y"
        $USE_SUDO apt-get install -f -y
        echo "Running: dpkg -i $installed_deb (retry)"
        if $USE_SUDO dpkg -i "$installed_deb"; then
            print_success_from_common_functions "RustDesk Client .deb package installed successfully after fixing dependencies"
        else
            print_error_from_common_functions "Failed to install RustDesk Client .deb package"
            return 1
        fi
    fi

    return 0
}

# Install required dependencies
# Only the download tooling is installed here. RustDesk's runtime libraries
# (GTK, libasound2t64, gstreamer1.0-pipewire, libva*, libvdpau1, ...) are declared
# in the .deb control file and resolved automatically by apt during install_deb_package.
# Hardcoding library names is avoided because they differ across releases: the Debian/Ubuntu
# t64 transition renamed e.g. libasound2 -> libasound2t64, which made the old static list
# fail with "Package 'libasound2' has no installation candidate" on Debian 13 / Kali rolling.
install_dependencies() {
    print_step_from_common_functions "Installing required dependencies..."

    echo "Running: apt-get update"
    $USE_SUDO apt-get update

    local tools=("wget" "curl" "ca-certificates")

    for tool in "${tools[@]}"; do
        if ! dpkg -l | grep -q "^ii  $tool "; then
            print_step_from_common_functions "Installing $tool..."
            echo "Running: apt-get install -y $tool"
            $USE_SUDO apt-get install -y "$tool" || true
        fi
    done

    return 0
}

# Main installation function
install_rustdesk() {
    print_header_from_common_functions "Installing RustDesk Client"

    # Install dependencies
    install_dependencies

    print_step_from_common_functions "Searching for RustDesk installer in /home/*/Downloads..."

    local deb_file=$(find_file_in_downloads_from_common_functions "rustdesk*.deb" "newest")

    if [[ -n "$deb_file" ]] && [[ -f "$deb_file" ]]; then
        print_info_from_common_functions "Found RustDesk installer: $(basename "$deb_file")"
    else
        print_warning_from_common_functions "No RustDesk installer detected in any Downloads directories"
        print_step_from_common_functions "Attempting automatic download..."
        print_info_from_common_functions "Download URL: $RUSTDESK_DEB_URL"

        # Use real user's Downloads directory
        local download_dir="$REAL_USER_DOWNLOADS"
        if [[ ! -d "$download_dir" ]]; then
            print_warning_from_common_functions "Real user Downloads not found: $download_dir"
            download_dir=$(find /home -maxdepth 2 -type d -name "Downloads" 2>/dev/null | head -1)
        fi
        if [[ -z "$download_dir" ]] || [[ ! -d "$download_dir" ]]; then
            download_dir="/tmp"
        fi

        print_info_from_common_functions "Download directory: $download_dir"
        print_info_from_common_functions "Downloading as user: $REAL_USER"

        # Download as real user (not root), with proper filename from URL
        local target_filename="$download_dir/rustdesk-${RUSTDESK_VERSION}-x86_64.deb"
        echo "Running: wget --content-disposition -O $target_filename $RUSTDESK_DEB_URL"

        if sudo -u "$REAL_USER" wget --content-disposition -O "$target_filename" "$RUSTDESK_DEB_URL" 2>&1; then
            print_success_from_common_functions "Download successful: $(basename "$target_filename")"
            deb_file="$target_filename"
        else
            print_warning_from_common_functions "Direct download failed, trying alternative method..."

            # Alternative: download to temp file then move
            local temp_file=$(mktemp -u "$download_dir/rustdesk_XXXXXX")
            if sudo -u "$REAL_USER" wget -O "$temp_file" "$RUSTDESK_DEB_URL" 2>&1; then
                # Check if it's a valid deb file
                if file "$temp_file" | grep -q "Debian"; then
                    print_info_from_common_functions "Renaming downloaded file to proper name"
                    sudo -u "$REAL_USER" mv "$temp_file" "$target_filename"
                    deb_file="$target_filename"
                    print_success_from_common_functions "Download successful after rename"
                else
                    rm -f "$temp_file"
                    print_warning_from_common_functions "Downloaded file is not a Debian package"
                fi
            fi
        fi

        # If download still failed, scan for recent files
        if [[ -z "$deb_file" ]] || [[ ! -f "$deb_file" ]]; then
            print_warning_from_common_functions "Download failed, scanning for recent files..."
            sleep 2

            # First try to find .deb files
            local found_deb=$(find_file_in_downloads_from_common_functions "rustdesk*.deb" "newest")
            if [[ -n "$found_deb" ]] && [[ -f "$found_deb" ]]; then
                print_success_from_common_functions "Found downloaded .deb: $(basename "$found_deb")"
                deb_file="$found_deb"
            else
                # Try to find any recently downloaded file (within last 2 minutes) that looks like RustDesk
                print_info_from_common_functions "Looking for recently downloaded files without .deb extension..."
                local recent_file=$(find "$download_dir" -maxdepth 1 -type f -mmin -2 -size +10M 2>/dev/null | head -1)

                if [[ -n "$recent_file" ]] && [[ -f "$recent_file" ]]; then
                    # Check if it's a valid deb file
                    if file "$recent_file" | grep -q "Debian"; then
                        local proper_filename="$download_dir/rustdesk-${RUSTDESK_VERSION}-x86_64.deb"
                        print_info_from_common_functions "Found recent Debian package: $(basename "$recent_file")"
                        print_info_from_common_functions "Renaming to: $(basename "$proper_filename")"
                        sudo -u "$REAL_USER" mv "$recent_file" "$proper_filename"
                        deb_file="$proper_filename"
                        print_success_from_common_functions "Auto-download successful after detection and rename"
                    else
                        print_warning_from_common_functions "Recent file found but not a Debian package"
                    fi
                fi
            fi

            # If still no file found, switch to manual mode
            if [[ -z "$deb_file" ]] || [[ ! -f "$deb_file" ]]; then
                print_warning_from_common_functions "Auto-download failed, switching to manual download mode"
                print_step_from_common_functions "Opening RustDesk download page for manual download..."

                local manual_download_url="https://rustdesk.com/docs/en/client/"
                if command -v xdg-open >/dev/null 2>&1; then
                    xdg-open "$manual_download_url" >/dev/null 2>&1 &
                fi

                deb_file=$(prompt_and_wait_for_download_from_common_functions \
                    "$manual_download_url" \
                    "rustdesk*.deb" \
                    0)

                if [[ -z "$deb_file" ]] || [[ ! -f "$deb_file" ]]; then
                    print_error_from_common_functions "Manual download is required before installation can continue"
                    return 1
                fi
            fi
        fi
    fi

    print_success_from_common_functions "Using RustDesk .deb: $(basename "$deb_file")"

    # Install .deb package
    if ! install_deb_package "$deb_file"; then
        return 1
    fi

    # Save installation info
    print_step_from_common_functions "Saving installation info..."
    save_installation_info "$RUSTDESK_VERSION" "$deb_file"

    print_success_from_common_functions "RustDesk Client installation completed successfully!"
    print_info_from_common_functions "You can now launch RustDesk Client from:"
    print_info_from_common_functions "  - Applications menu"
    print_info_from_common_functions "  - Command: rustdesk"

    return 0
}

# Interactive prompt
prompt_installation() {
    if is_rustdesk_installed; then
        print_warning_from_common_functions "RustDesk Client is already installed"

        local installed_version=$(get_installed_version)
        if [[ -n "$installed_version" ]]; then
            print_info_from_common_functions "Installed version: $installed_version"
            print_info_from_common_functions "Available version: $RUSTDESK_VERSION"

            # Check if upgrade is available
            if [[ "$installed_version" != "$RUSTDESK_VERSION" ]]; then
                echo ""
                print_step_from_common_functions "New version available!"
                echo -n "Do you want to upgrade from $installed_version to $RUSTDESK_VERSION? (Y/n): "
                read -r response

                case "$response" in
                    [nN]|[nN][oO])
                        print_info_from_common_functions "Keeping existing installation"
                        return 1
                        ;;
                    *)
                        print_info_from_common_functions "Proceeding with upgrade..."
                        return 0
                        ;;
                esac
            else
                echo ""
                echo -n "Same version already installed. Reinstall? (y/N): "
                read -r response

                case "$response" in
                    [yY]|[yY][eE][sS])
                        print_info_from_common_functions "Proceeding with reinstallation..."
                        return 0
                        ;;
                    *)
                        print_info_from_common_functions "Keeping existing installation"
                        return 1
                        ;;
                esac
            fi
        else
            echo -n "Do you want to reinstall? (y/N): "
            read -r response

            case "$response" in
                [yY]|[yY][eE][sS])
                    print_info_from_common_functions "Proceeding with reinstallation..."
                    return 0
                    ;;
                *)
                    print_info_from_common_functions "Keeping existing installation"
                    return 1
                    ;;
            esac
        fi
    fi

    # Different prompt based on system type
    if [[ "$HAS_DESKTOP_ENVIRONMENT" == true ]]; then
        # Desktop system - default Y (install)
        echo ""
        echo "RustDesk Client - Remote Desktop Application"
        echo "This is a desktop application for remote access."
        echo ""
        echo -n "Install RustDesk Client? (Y/n): "
        read -r response

        case "$response" in
            [nN]|[nN][oO])
                print_info_from_common_functions "Installation cancelled"
                return 1
                ;;
            *)
                return 0
                ;;
        esac
    else
        # Server system - default N (skip)
        echo ""
        echo "RustDesk Client - Remote Desktop Application"
        echo "WARNING: This is a GUI application designed for desktop systems."
        echo "You appear to be on a server without a desktop environment."
        echo ""
        echo -n "Install RustDesk Client anyway? (N/y): "
        read -r response

        case "$response" in
            [yY]|[yY][eE][sS])
                print_warning_from_common_functions "Installing on server system (not recommended)"
                return 0
                ;;
            *)
                print_info_from_common_functions "Installation skipped (server system)"
                return 1
                ;;
        esac
    fi
}

# Main script execution
main() {
    print_header_from_common_functions "RustDesk Client Installation Script"
    print_info_from_common_functions "Installation Directory: $RUSTDESK_INSTALL_DIR"
    print_info_from_common_functions "Version: $RUSTDESK_VERSION"

    if ! prompt_installation; then
        exit 0
    fi

    install_rustdesk
    exit $?
}

main "$@"
