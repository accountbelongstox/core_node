#!/bin/bash
# Gitea Installation Script
#
# Prerequisites:
#   - Git must be installed (run 19_install_git_ssh.sh first)
#   - SQLite3 (automatically installed)
#   - wget/curl (automatically installed)
#
# Usage:
#   ./123_install_gitea.sh                    # Normal installation
#   ./123_install_gitea.sh --force           # Force reinstallation
#   ./123_install_gitea.sh --cleanup         # Remove Gitea installation
#
# This script installs Gitea - a self-hosted Git service
# After installation, it will detect all IPs and display available web addresses
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
source "$PARENT_DIR_LEVEL_1/debian_com/installation_library.sh"

# Initialize global variables
init_global_vars

# Declare variables
INSTALL_MODE=$(get_var "INSTALL_MODE" "base")
FORCE_INSTALL=false
CLEANUP_MODE=false

# Gitea version and configuration
GITEA_VERSION="1.21.5"
GITEA_ARCH="linux-amd64"
GITEA_BINARY_URL="https://dl.gitea.com/gitea/${GITEA_VERSION}/gitea-${GITEA_VERSION}-${GITEA_ARCH}"

# Set up Gitea directories
APPLICATIONS_DIR=$(map_web_path "compile_dir" "applications")
GITEA_INSTALL_DIR="$APPLICATIONS_DIR/gitea"
GITEA_BINARY="/usr/local/bin/gitea"
GITEA_DATA_DIR="/var/lib/gitea"
GITEA_CONFIG_DIR="/etc/gitea"
GITEA_INSTALLED_FLAG="$GITEA_INSTALL_DIR/.installed"
GITEA_USER="git"
GITEA_PORT="3000"

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

# Get installed version
get_installed_version() {
    if [[ -f "$GITEA_INSTALLED_FLAG" ]]; then
        grep "^VERSION=" "$GITEA_INSTALLED_FLAG" 2>/dev/null | cut -d= -f2
    fi
}

# Save installation info
save_installation_info() {
    local version="$1"

    $USE_SUDO mkdir -p "$(dirname "$GITEA_INSTALLED_FLAG")"
    cat <<EOF | $USE_SUDO tee "$GITEA_INSTALLED_FLAG" > /dev/null
DATE=$(date '+%Y-%m-%d %H:%M:%S')
VERSION=$version
BINARY=$GITEA_BINARY
DATA_DIR=$GITEA_DATA_DIR
CONFIG_DIR=$GITEA_CONFIG_DIR
PORT=$GITEA_PORT
EOF
}

# Check if Gitea is already installed
is_gitea_installed() {
    if command -v gitea >/dev/null 2>&1; then
        return 0  # Installed
    fi
    return 1  # Not installed
}

# Detect system architecture
detect_architecture() {
    local arch=$(uname -m)
    case "$arch" in
        x86_64)
            echo "linux-amd64"
            ;;
        aarch64)
            echo "linux-arm64"
            ;;
        armv7l)
            echo "linux-arm-7"
            ;;
        *)
            print_error_from_common_functions "Unsupported architecture: $arch"
            return 1
            ;;
    esac
}

# Check if Git is installed
check_git_installation() {
    print_step_from_common_functions "Checking Git installation..."

    if command -v git >/dev/null 2>&1; then
        local git_version=$(git --version 2>/dev/null | awk '{print $3}')
        print_success_from_common_functions "Git is installed (version: $git_version)"
        return 0
    else
        print_warning_from_common_functions "Git is not installed"
        print_info_from_common_functions "Git is required for Gitea to function"
        print_info_from_common_functions "Please run script 19_install_git_ssh.sh first, or install Git manually"

        echo -n "Do you want to install Git now? (Y/n): "
        read -r response
        case "$response" in
            [nN]|[nN][oO])
                print_error_from_common_functions "Cannot proceed without Git"
                return 1
                ;;
            *)
                print_step_from_common_functions "Installing Git..."
                if $USE_SUDO apt-get update && $USE_SUDO apt-get install -y git; then
                    local git_version=$(git --version 2>/dev/null | awk '{print $3}')
                    print_success_from_common_functions "Git installed successfully (version: $git_version)"
                    return 0
                else
                    print_error_from_common_functions "Failed to install Git"
                    return 1
                fi
                ;;
        esac
    fi
}

# Install required dependencies
install_dependencies() {
    print_step_from_common_functions "Installing required dependencies..."

    # Update package list
    $USE_SUDO apt-get update -qq

    # Essential dependencies for Gitea
    local deps=(
        "wget"          # For downloading Gitea binary
        "curl"          # For API calls and version checks
        "sqlite3"       # SQLite database support (default database)
        "ca-certificates" # SSL/TLS certificates
        "gnupg"         # GPG support for commit signing
    )

    for dep in "${deps[@]}"; do
        # Extract package name (remove comments)
        local pkg=$(echo "$dep" | awk '{print $1}')

        if ! dpkg -l | grep -q "^ii  $pkg "; then
            print_step_from_common_functions "Installing $pkg..."
            $USE_SUDO apt-get install -y "$pkg"
        else
            print_info_from_common_functions "$pkg is already installed"
        fi
    done

    print_success_from_common_functions "All dependencies installed"
    return 0
}

# Create Gitea user
create_gitea_user() {
    print_step_from_common_functions "Creating Gitea user..."

    if id "$GITEA_USER" &>/dev/null; then
        print_info_from_common_functions "User $GITEA_USER already exists"
        return 0
    fi

    $USE_SUDO useradd --system --shell /bin/bash --comment 'Git Version Control' --create-home --home-dir /home/$GITEA_USER $GITEA_USER
    print_success_from_common_functions "User $GITEA_USER created"

    return 0
}

# Download Gitea binary
download_gitea() {
    print_step_from_common_functions "Downloading Gitea ${GITEA_VERSION}..."

    # Detect architecture
    GITEA_ARCH=$(detect_architecture)
    if [[ $? -ne 0 ]]; then
        return 1
    fi

    GITEA_BINARY_URL="https://dl.gitea.com/gitea/${GITEA_VERSION}/gitea-${GITEA_VERSION}-${GITEA_ARCH}"

    # Create temp download directory
    local temp_dir=$(mktemp -d)
    local temp_binary="$temp_dir/gitea"

    # Download binary
    if wget -O "$temp_binary" "$GITEA_BINARY_URL"; then
        print_success_from_common_functions "Gitea binary downloaded"

        # Verify binary
        if [[ ! -s "$temp_binary" ]]; then
            print_error_from_common_functions "Downloaded binary is empty"
            rm -rf "$temp_dir"
            return 1
        fi

        # Install binary
        $USE_SUDO mv "$temp_binary" "$GITEA_BINARY"
        $USE_SUDO chmod +x "$GITEA_BINARY"

        # Cleanup
        rm -rf "$temp_dir"

        print_success_from_common_functions "Gitea binary installed to $GITEA_BINARY"
        return 0
    else
        print_error_from_common_functions "Failed to download Gitea binary"
        rm -rf "$temp_dir"
        return 1
    fi
}

# Create directories
create_directories() {
    print_step_from_common_functions "Creating Gitea directories..."

    # Create directories
    $USE_SUDO mkdir -p "$GITEA_INSTALL_DIR"
    $USE_SUDO mkdir -p "$GITEA_DATA_DIR"/{custom,data,log}
    $USE_SUDO mkdir -p "$GITEA_CONFIG_DIR"

    # Set ownership
    $USE_SUDO chown -R $GITEA_USER:$GITEA_USER "$GITEA_DATA_DIR"
    $USE_SUDO chown -R root:$GITEA_USER "$GITEA_CONFIG_DIR"
    $USE_SUDO chmod -R 750 "$GITEA_DATA_DIR"
    $USE_SUDO chmod 770 "$GITEA_CONFIG_DIR"

    print_success_from_common_functions "Gitea directories created"
    return 0
}

# Create systemd service
create_systemd_service() {
    print_step_from_common_functions "Creating systemd service..."

    local service_file="/etc/systemd/system/gitea.service"

    cat <<EOF | $USE_SUDO tee "$service_file" > /dev/null
[Unit]
Description=Gitea (Git with a cup of tea)
After=network.target
Wants=network.target

[Service]
Type=simple
User=$GITEA_USER
Group=$GITEA_USER
WorkingDirectory=$GITEA_DATA_DIR
ExecStart=$GITEA_BINARY web --config $GITEA_CONFIG_DIR/app.ini
Restart=always
Environment=USER=$GITEA_USER HOME=/home/$GITEA_USER GITEA_WORK_DIR=$GITEA_DATA_DIR

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd
    $USE_SUDO systemctl daemon-reload

    print_success_from_common_functions "Systemd service created"
    return 0
}

# Detect all IP addresses
detect_ip_addresses() {
    print_step_from_common_functions "Detecting IP addresses..."

    local ips=()

    # Get all IPv4 addresses
    while IFS= read -r ip; do
        if [[ -n "$ip" ]] && [[ "$ip" != "127.0.0.1" ]]; then
            ips+=("$ip")
        fi
    done < <(hostname -I 2>/dev/null | tr ' ' '\n')

    # Add localhost
    ips+=("127.0.0.1")
    ips+=("localhost")

    # Get public IP
    local public_ip=$(curl -s https://api.ipify.org 2>/dev/null || echo "")
    if [[ -n "$public_ip" ]] && [[ "$public_ip" != "127.0.0.1" ]]; then
        ips+=("$public_ip (public)")
    fi

    echo "${ips[@]}"
}

# Display web access information
display_web_access_info() {
    print_header_from_common_functions "Gitea Web Access Information"

    local ips=($(detect_ip_addresses))

    print_success_from_common_functions "Gitea is now accessible at the following addresses:"
    echo ""

    for ip in "${ips[@]}"; do
        echo -e "${GREEN}  http://${ip}:${GITEA_PORT}${NC}"
    done

    echo ""
    print_info_from_common_functions "Default configuration:"
    echo "  - Port: $GITEA_PORT"
    echo "  - Data directory: $GITEA_DATA_DIR"
    echo "  - Config directory: $GITEA_CONFIG_DIR"
    echo ""
    print_info_from_common_functions "First-time setup:"
    echo "  1. Open any of the URLs above in your browser"
    echo "  2. Complete the initial configuration wizard"
    echo "  3. Create your administrator account"
    echo ""
}

# Start Gitea service
start_gitea_service() {
    print_step_from_common_functions "Starting Gitea service..."

    # Enable service
    $USE_SUDO systemctl enable gitea

    # Start service
    $USE_SUDO systemctl start gitea

    # Wait for service to start
    sleep 3

    # Check service status
    if $USE_SUDO systemctl is-active --quiet gitea; then
        print_success_from_common_functions "Gitea service started successfully"
        return 0
    else
        print_error_from_common_functions "Failed to start Gitea service"
        $USE_SUDO systemctl status gitea --no-pager
        return 1
    fi
}

# Cleanup Gitea installation
cleanup_gitea() {
    print_header_from_common_functions "Cleaning up Gitea installation"

    # Stop and disable service
    if $USE_SUDO systemctl is-active --quiet gitea 2>/dev/null; then
        print_step_from_common_functions "Stopping Gitea service..."
        $USE_SUDO systemctl stop gitea
    fi

    if $USE_SUDO systemctl is-enabled --quiet gitea 2>/dev/null; then
        print_step_from_common_functions "Disabling Gitea service..."
        $USE_SUDO systemctl disable gitea
    fi

    # Remove systemd service
    if [[ -f "/etc/systemd/system/gitea.service" ]]; then
        print_step_from_common_functions "Removing systemd service..."
        $USE_SUDO rm -f "/etc/systemd/system/gitea.service"
        $USE_SUDO systemctl daemon-reload
    fi

    # Remove binary
    if [[ -f "$GITEA_BINARY" ]]; then
        print_step_from_common_functions "Removing Gitea binary..."
        $USE_SUDO rm -f "$GITEA_BINARY"
    fi

    # Remove directories
    if [[ -d "$GITEA_DATA_DIR" ]]; then
        print_step_from_common_functions "Removing data directory: $GITEA_DATA_DIR"
        $USE_SUDO rm -rf "$GITEA_DATA_DIR"
    fi

    if [[ -d "$GITEA_CONFIG_DIR" ]]; then
        print_step_from_common_functions "Removing config directory: $GITEA_CONFIG_DIR"
        $USE_SUDO rm -rf "$GITEA_CONFIG_DIR"
    fi

    if [[ -d "$GITEA_INSTALL_DIR" ]]; then
        print_step_from_common_functions "Removing installation directory: $GITEA_INSTALL_DIR"
        robust_remove_directory "$GITEA_INSTALL_DIR"
    fi

    # Remove installation flag
    if [[ -f "$GITEA_INSTALLED_FLAG" ]]; then
        print_step_from_common_functions "Removing installation flag: $GITEA_INSTALLED_FLAG"
        $USE_SUDO rm -f "$GITEA_INSTALLED_FLAG"
    fi

    # Note: We don't remove the git user as it may be used by other services

    print_success_from_common_functions "Gitea cleanup completed"
    return 0
}

# Main installation function
install_gitea() {
    print_header_from_common_functions "Installing Gitea"

    # Check Git installation (CRITICAL DEPENDENCY)
    if ! check_git_installation; then
        print_error_from_common_functions "Git is required but not installed"
        print_info_from_common_functions "Please install Git first by running: ./19_install_git_ssh.sh"
        return 1
    fi

    # Install dependencies
    if ! install_dependencies; then
        return 1
    fi

    # Create Gitea user
    if ! create_gitea_user; then
        return 1
    fi

    # Download Gitea
    if ! download_gitea; then
        return 1
    fi

    # Create directories
    if ! create_directories; then
        return 1
    fi

    # Create systemd service
    if ! create_systemd_service; then
        return 1
    fi

    # Start service
    if ! start_gitea_service; then
        return 1
    fi

    # Save installation info
    save_installation_info "$GITEA_VERSION"

    print_success_from_common_functions "Gitea installation completed successfully!"

    # Display web access information
    display_web_access_info

    return 0
}

# Interactive cleanup prompt with version check
prompt_cleanup_reinstall() {
    if is_gitea_installed; then
        print_warning_from_common_functions "Gitea is already installed"

        local installed_version=$(get_installed_version)
        if [[ -n "$installed_version" ]]; then
            print_info_from_common_functions "Installed version: $installed_version"
        else
            print_info_from_common_functions "No version metadata found for current installation"
        fi

        if [[ -n "$installed_version" ]] && [[ "$installed_version" != "$GITEA_VERSION" ]]; then
            echo -n "Upgrade to version $GITEA_VERSION? (Y/n): "
            read -r response
            case "$response" in
                [nN]|[nN][oO])
                    print_info_from_common_functions "Keeping current installation"
                    return 1
                    ;;
                *)
                    print_info_from_common_functions "Upgrading Gitea..."
                    cleanup_gitea
                    return 0
                    ;;
            esac
        else
            echo -n "Reinstall Gitea? (y/N): "
            read -r response
            case "$response" in
                [yY]|[yY][eE][sS])
                    print_info_from_common_functions "Reinstalling Gitea..."
                    cleanup_gitea
                    return 0
                    ;;
                *)
                    print_info_from_common_functions "Keeping existing installation"
                    return 1
                    ;;
            esac
        fi
    fi
    return 0
}

# Main script execution
main() {
    # Parse arguments
    parse_arguments "$@"

    # Handle cleanup mode
    if [[ "$CLEANUP_MODE" == true ]]; then
        cleanup_gitea
        exit $?
    fi

    print_header_from_common_functions "Gitea Installation Script"
    print_info_from_common_functions "Installation Directory: $GITEA_INSTALL_DIR"
    print_info_from_common_functions "Version: $GITEA_VERSION"

    # Interactive cleanup prompt (unless force install is specified)
    if [[ "$FORCE_INSTALL" != true ]]; then
        if ! prompt_cleanup_reinstall; then
            exit 0
        fi
    fi

    # Run installation
    install_gitea
    exit $?
}

# Run main function with all arguments
main "$@"
