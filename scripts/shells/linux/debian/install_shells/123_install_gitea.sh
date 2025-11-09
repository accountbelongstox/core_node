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
source "$PARENT_DIR_LEVEL_2/common/firewall_manager.sh"

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
WWWROOT_DIR=$(map_web_path "wwwroot")
GITEA_BASE_DIR="$WWWROOT_DIR/data/gitea"
GITEA_BINARY="/usr/local/bin/gitea"
GITEA_DATA_DIR="$GITEA_BASE_DIR/data"
GITEA_CONFIG_DIR="$GITEA_BASE_DIR/config"
GITEA_CUSTOM_DIR="$GITEA_BASE_DIR/custom"
GITEA_LOG_DIR="$GITEA_BASE_DIR/log"
GITEA_INSTALLED_FLAG="$GITEA_BASE_DIR/.installed"
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
    print_step_from_common_functions "Checking Gitea binary..."

    # Detect architecture
    GITEA_ARCH=$(detect_architecture)
    if [[ $? -ne 0 ]]; then
        return 1
    fi

    GITEA_BINARY_URL="https://dl.gitea.com/gitea/${GITEA_VERSION}/gitea-${GITEA_VERSION}-${GITEA_ARCH}"

    # Check if binary already exists and matches target version
    if [[ -f "$GITEA_BINARY" ]]; then
        local current_version=$($GITEA_BINARY --version 2>/dev/null | grep -oP 'version \K[0-9.]+' | head -n1 || echo "")
        print_info_from_common_functions "DEBUG: Existing binary found, version: $current_version"
        print_info_from_common_functions "DEBUG: Target version: $GITEA_VERSION"

        if [[ "$current_version" == "$GITEA_VERSION" ]]; then
            print_success_from_common_functions "Gitea binary already exists with correct version ($GITEA_VERSION)"
            print_info_from_common_functions "DEBUG: Skipping download, using existing binary at $GITEA_BINARY"
            return 0
        else
            print_warning_from_common_functions "Existing binary version ($current_version) differs from target ($GITEA_VERSION)"
            print_info_from_common_functions "DEBUG: Will download new version..."
        fi
    else
        print_info_from_common_functions "DEBUG: Binary not found at $GITEA_BINARY, will download..."
    fi

    # Download binary
    print_step_from_common_functions "Downloading Gitea ${GITEA_VERSION}..."
    print_info_from_common_functions "DEBUG: Download URL: $GITEA_BINARY_URL"

    # Create temp download directory
    local temp_dir=$(mktemp -d)
    local temp_binary="$temp_dir/gitea"
    print_info_from_common_functions "DEBUG: Temp directory: $temp_dir"

    if wget -O "$temp_binary" "$GITEA_BINARY_URL"; then
        print_success_from_common_functions "Gitea binary downloaded"

        # Verify binary
        if [[ ! -s "$temp_binary" ]]; then
            print_error_from_common_functions "Downloaded binary is empty"
            rm -rf "$temp_dir"
            return 1
        fi

        local binary_size=$(stat -c%s "$temp_binary" 2>/dev/null || stat -f%z "$temp_binary" 2>/dev/null)
        print_info_from_common_functions "DEBUG: Downloaded binary size: $binary_size bytes"

        # Install binary
        print_info_from_common_functions "DEBUG: Installing binary to $GITEA_BINARY"
        $USE_SUDO mv "$temp_binary" "$GITEA_BINARY"
        $USE_SUDO chmod +x "$GITEA_BINARY"

        # Cleanup
        rm -rf "$temp_dir"
        print_info_from_common_functions "DEBUG: Cleaned up temp directory"

        print_success_from_common_functions "Gitea binary installed to $GITEA_BINARY"
        return 0
    else
        print_error_from_common_functions "Failed to download Gitea binary"
        print_error_from_common_functions "DEBUG: wget failed for URL: $GITEA_BINARY_URL"
        rm -rf "$temp_dir"
        return 1
    fi
}

# Create directories
create_directories() {
    print_step_from_common_functions "Creating Gitea directories..."
    print_info_from_common_functions "DEBUG: Base directory: $GITEA_BASE_DIR"
    print_info_from_common_functions "DEBUG: Data directory: $GITEA_DATA_DIR"
    print_info_from_common_functions "DEBUG: Config directory: $GITEA_CONFIG_DIR"
    print_info_from_common_functions "DEBUG: Custom directory: $GITEA_CUSTOM_DIR"
    print_info_from_common_functions "DEBUG: Log directory: $GITEA_LOG_DIR"

    # Create base directory structure
    $USE_SUDO mkdir -p "$GITEA_BASE_DIR"
    $USE_SUDO mkdir -p "$GITEA_DATA_DIR"
    $USE_SUDO mkdir -p "$GITEA_CONFIG_DIR"
    $USE_SUDO mkdir -p "$GITEA_CUSTOM_DIR"
    $USE_SUDO mkdir -p "$GITEA_LOG_DIR"
    print_info_from_common_functions "DEBUG: All directories created successfully"

    # Set ownership and permissions
    print_info_from_common_functions "DEBUG: Setting ownership to $GITEA_USER:$GITEA_USER"
    $USE_SUDO chown -R $GITEA_USER:$GITEA_USER "$GITEA_BASE_DIR"
    $USE_SUDO chmod -R 750 "$GITEA_BASE_DIR"
    $USE_SUDO chmod 770 "$GITEA_CONFIG_DIR"
    print_info_from_common_functions "DEBUG: Ownership and permissions set"

    print_success_from_common_functions "Gitea directories created at $GITEA_BASE_DIR"
    return 0
}

# Create Gitea configuration file
create_gitea_config() {
    print_step_from_common_functions "Creating Gitea configuration..."

    local config_file="$GITEA_CONFIG_DIR/app.ini"

    # Check if configuration already exists
    if [[ -f "$config_file" ]]; then
        print_info_from_common_functions "Configuration file already exists, updating paths only..."

        # Update directory paths in existing config (idempotent)
        $USE_SUDO sed -i "s|^HTTP_PORT.*=.*|HTTP_PORT = $GITEA_PORT|" "$config_file" 2>/dev/null || true
        $USE_SUDO sed -i "s|^PATH.*=.*gitea\.db|PATH = $GITEA_DATA_DIR/gitea.db|" "$config_file" 2>/dev/null || true
        $USE_SUDO sed -i "s|^ROOT.*=.*repositories|ROOT = $GITEA_DATA_DIR/repositories|" "$config_file" 2>/dev/null || true
        $USE_SUDO sed -i "s|^ROOT_PATH.*=.*|ROOT_PATH = $GITEA_LOG_DIR|" "$config_file" 2>/dev/null || true
        $USE_SUDO sed -i "s|^AVATAR_UPLOAD_PATH.*=.*|AVATAR_UPLOAD_PATH = $GITEA_DATA_DIR/avatars|" "$config_file" 2>/dev/null || true
        $USE_SUDO sed -i "s|^REPOSITORY_AVATAR_UPLOAD_PATH.*=.*|REPOSITORY_AVATAR_UPLOAD_PATH = $GITEA_DATA_DIR/repo-avatars|" "$config_file" 2>/dev/null || true
        $USE_SUDO sed -i "s|^PATH.*=.*attachments|PATH = $GITEA_DATA_DIR/attachments|" "$config_file" 2>/dev/null || true
        $USE_SUDO sed -i "s|^PROVIDER_CONFIG.*=.*|PROVIDER_CONFIG = $GITEA_DATA_DIR/sessions|" "$config_file" 2>/dev/null || true

        print_success_from_common_functions "Gitea configuration updated with current paths"
        return 0
    fi

    # Generate SECRET_KEY only once
    local secret_key=$(openssl rand -base64 32 2>/dev/null || echo "CHANGE_THIS_SECRET_KEY_$(date +%s)")

    # Create new configuration file
    cat <<EOF | $USE_SUDO tee "$config_file" > /dev/null
[server]
HTTP_PORT = $GITEA_PORT
ROOT_URL = http://localhost:$GITEA_PORT/
DOMAIN = localhost

[database]
DB_TYPE = sqlite3
PATH = $GITEA_DATA_DIR/gitea.db

[repository]
ROOT = $GITEA_DATA_DIR/repositories

[log]
ROOT_PATH = $GITEA_LOG_DIR
MODE = console, file
LEVEL = info

[security]
INSTALL_LOCK = false
SECRET_KEY = $secret_key

[service]
DISABLE_REGISTRATION = false
REQUIRE_SIGNIN_VIEW = false

[picture]
AVATAR_UPLOAD_PATH = $GITEA_DATA_DIR/avatars
REPOSITORY_AVATAR_UPLOAD_PATH = $GITEA_DATA_DIR/repo-avatars

[attachment]
PATH = $GITEA_DATA_DIR/attachments

[session]
PROVIDER = file
PROVIDER_CONFIG = $GITEA_DATA_DIR/sessions
EOF

    # Set ownership and permissions
    $USE_SUDO chown $GITEA_USER:$GITEA_USER "$config_file"
    $USE_SUDO chmod 640 "$config_file"

    print_success_from_common_functions "Gitea configuration created"
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
ExecStart=$GITEA_BINARY web --config $GITEA_CONFIG_DIR/app.ini --work-path $GITEA_DATA_DIR --custom-path $GITEA_CUSTOM_DIR
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

# Configure firewall for Gitea
configure_firewall() {
    print_step_from_common_functions "Configuring firewall for Gitea..."
    print_info_from_common_functions "DEBUG: Port to open: $GITEA_PORT/tcp"
    print_info_from_common_functions "DEBUG: Calling firewall_allow_port from firewall_manager.sh"

    # Use firewall_manager.sh library to handle firewall configuration
    # This automatically detects and configures UFW, firewalld, or iptables
    # If no firewall is active, it does nothing (never installs a firewall)
    if firewall_allow_port "$GITEA_PORT" "tcp" "Gitea Web Service"; then
        print_success_from_common_functions "Firewall configured successfully for port $GITEA_PORT/tcp"
        print_info_from_common_functions "DEBUG: Firewall rule added successfully"
    else
        print_warning_from_common_functions "Firewall configuration may have issues, but port may still be accessible"
        print_info_from_common_functions "DEBUG: Firewall configuration returned error or no firewall detected"
    fi

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
    echo "  - Base directory: $GITEA_BASE_DIR"
    echo "  - Data directory: $GITEA_DATA_DIR"
    echo "  - Config file: $GITEA_CONFIG_DIR/app.ini"
    echo "  - Log directory: $GITEA_LOG_DIR"
    echo ""
    print_info_from_common_functions "First-time setup:"
    echo "  1. Open any of the URLs above in your browser"
    echo "  2. Complete the initial configuration wizard"
    echo "  3. Create your administrator account"
    echo ""
    print_warning_from_common_functions "Important notes:"
    echo "  - Ensure firewall allows port $GITEA_PORT"
    echo "  - Configuration is stored in: $GITEA_CONFIG_DIR/app.ini"
    echo "  - All data is stored under: $GITEA_BASE_DIR"
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

    # Remove firewall rule using firewall_manager.sh
    print_step_from_common_functions "Removing firewall rule..."
    firewall_remove_port "$GITEA_PORT" "tcp" 2>/dev/null || true

    # Remove base directory (contains data, config, custom, and log)
    if [[ -d "$GITEA_BASE_DIR" ]]; then
        print_step_from_common_functions "Removing Gitea base directory: $GITEA_BASE_DIR"
        $USE_SUDO rm -rf "$GITEA_BASE_DIR"
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

    # Create Gitea configuration
    if ! create_gitea_config; then
        return 1
    fi

    # Create systemd service
    if ! create_systemd_service; then
        return 1
    fi

    # Configure firewall
    configure_firewall

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
# Repair Gitea configuration without removing data
repair_gitea_configuration() {
    print_header_from_common_functions "Repairing Gitea Configuration"
    print_info_from_common_functions "This will update configuration and service files without touching your data"
    echo ""

    # Download/update binary if version mismatch
    local current_binary_version=""
    if [[ -f "$GITEA_BINARY" ]]; then
        current_binary_version=$($GITEA_BINARY --version 2>/dev/null | grep -oP 'version \K[0-9.]+' | head -n1 || echo "")
    fi

    if [[ "$current_binary_version" != "$GITEA_VERSION" ]]; then
        print_step_from_common_functions "Updating Gitea binary from $current_binary_version to $GITEA_VERSION..."
        if ! download_gitea; then
            print_warning_from_common_functions "Failed to update binary, keeping current version"
        fi
    else
        print_info_from_common_functions "Gitea binary is already up-to-date (version $GITEA_VERSION)"
    fi

    # Ensure directories exist with correct permissions
    print_step_from_common_functions "Verifying directory structure..."
    create_directories

    # Update configuration file (preserves existing config, only updates paths)
    print_step_from_common_functions "Updating configuration file..."
    create_gitea_config

    # Recreate systemd service (idempotent)
    print_step_from_common_functions "Updating systemd service..."
    create_systemd_service

    # Ensure firewall rules are in place
    print_step_from_common_functions "Verifying firewall rules..."
    configure_firewall

    # Restart service to apply changes
    print_step_from_common_functions "Restarting Gitea service..."
    $USE_SUDO systemctl restart gitea 2>/dev/null || start_gitea_service

    # Update installation info
    save_installation_info "$GITEA_VERSION"

    print_success_from_common_functions "Gitea configuration repaired successfully!"
    print_info_from_common_functions "All your repositories and data are preserved"
    echo ""

    # Display access info
    display_web_access_info

    return 0
}

prompt_cleanup_reinstall() {
    if is_gitea_installed; then
        print_warning_from_common_functions "Gitea is already installed"

        local installed_version=$(get_installed_version)
        if [[ -n "$installed_version" ]]; then
            print_info_from_common_functions "Installed version: $installed_version"
            print_info_from_common_functions "Target version: $GITEA_VERSION"
        else
            print_info_from_common_functions "No version metadata found for current installation"
        fi

        echo ""
        print_info_from_common_functions "Available actions:"
        echo "  1) Repair configuration (recommended - preserves all data)"
        echo "  2) Full reinstall (WARNING: deletes all repositories and data)"
        echo "  3) Keep current installation and exit"
        echo ""
        echo -n "Select action (1/2/3) [1]: "
        read -r response

        case "$response" in
            2)
                print_warning_from_common_functions "Full reinstall will DELETE all repositories and data!"
                echo -n "Are you sure? Type 'yes' to confirm: "
                read -r confirm
                if [[ "$confirm" == "yes" ]]; then
                    print_info_from_common_functions "Performing full reinstall..."
                    cleanup_gitea
                    return 0
                else
                    print_info_from_common_functions "Reinstall cancelled"
                    return 1
                fi
                ;;
            3|[nN]|[nN][oO])
                print_info_from_common_functions "Keeping current installation"
                return 1
                ;;
            1|""|[yY]|[yY][eE][sS])
                print_info_from_common_functions "Repairing configuration..."
                repair_gitea_configuration
                return 1
                ;;
            *)
                print_info_from_common_functions "Invalid choice, exiting"
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
