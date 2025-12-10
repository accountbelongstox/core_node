#!/bin/bash
# RustDesk Server Installation Script
#
# Usage:
#   ./128_install_rustdesk_server.sh
#
# This script installs RustDesk Server (hbbs and hbbr) for self-hosting
# Recommended for server systems
#
# Enable verbose output - show all executed commands
set -x

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
SCRIPT_INDEX="128"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/installation_library.sh"
source "$PARENT_DIR_LEVEL_2/common/firewall_manager.sh"

# Initialize global variables
init_global_vars

# Declare variables
INSTALL_MODE=$(get_var "INSTALL_MODE" "base")

# RustDesk Server version
RUSTDESK_SERVER_VERSION="1.1.11"
RUSTDESK_SERVER_ARCH="amd64"

# GitHub release URLs
RUSTDESK_HBBS_URL="https://github.com/rustdesk/rustdesk-server/releases/download/${RUSTDESK_SERVER_VERSION}/hbbs-${RUSTDESK_SERVER_ARCH}"
RUSTDESK_HBBR_URL="https://github.com/rustdesk/rustdesk-server/releases/download/${RUSTDESK_SERVER_VERSION}/hbbr-${RUSTDESK_SERVER_ARCH}"

# Set up directories
WWWROOT_DIR=$(map_web_path "wwwroot")
RUSTDESK_BASE_DIR="$WWWROOT_DIR/data/rustdesk-server"
RUSTDESK_BIN_DIR="/usr/local/bin"
RUSTDESK_DATA_DIR="$RUSTDESK_BASE_DIR/data"
RUSTDESK_LOG_DIR="$RUSTDESK_BASE_DIR/log"
RUSTDESK_INSTALLED_FLAG="$RUSTDESK_BASE_DIR/.installed"

# Version tracking
APP_VERSIONS_DIR="$GLOBAL_VAR_DIR/app_versions"
RUSTDESK_SERVER_INSTALLED_FLAG="$APP_VERSIONS_DIR/rustdesk_server.version"

# Service ports
HBBS_PORT="21115"
HBBS_NAT_PORT="21116"
HBBR_PORT="21117"
RELAY_PORT="21119"

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
    if [[ -f "$RUSTDESK_SERVER_INSTALLED_FLAG" ]]; then
        grep "^VERSION=" "$RUSTDESK_SERVER_INSTALLED_FLAG" 2>/dev/null | cut -d= -f2
    fi
}

# Save installation info
save_installation_info() {
    local version="$1"

    $USE_SUDO mkdir -p "$APP_VERSIONS_DIR"
    $USE_SUDO mkdir -p "$(dirname "$RUSTDESK_INSTALLED_FLAG")"

    cat <<EOF | $USE_SUDO tee "$RUSTDESK_SERVER_INSTALLED_FLAG" > /dev/null
DATE=$(date '+%Y-%m-%d %H:%M:%S')
VERSION=$version
HBBS_PORT=$HBBS_PORT
HBBS_NAT_PORT=$HBBS_NAT_PORT
HBBR_PORT=$HBBR_PORT
RELAY_PORT=$RELAY_PORT
DATA_DIR=$RUSTDESK_DATA_DIR
EOF

    cat <<EOF | $USE_SUDO tee "$RUSTDESK_INSTALLED_FLAG" > /dev/null
DATE=$(date '+%Y-%m-%d %H:%M:%S')
VERSION=$version
EOF
}

# Check if RustDesk Server is already installed
is_rustdesk_server_installed() {
    if command -v hbbs >/dev/null 2>&1 && command -v hbbr >/dev/null 2>&1; then
        return 0
    fi
    if [[ -f "$RUSTDESK_BIN_DIR/hbbs" ]] && [[ -f "$RUSTDESK_BIN_DIR/hbbr" ]]; then
        return 0
    fi
    return 1
}

# Detect system architecture
detect_architecture() {
    local arch=$(uname -m)
    case "$arch" in
        x86_64)
            echo "amd64"
            ;;
        aarch64)
            echo "arm64v8"
            ;;
        armv7l)
            echo "armv7"
            ;;
        *)
            print_error_from_common_functions "Unsupported architecture: $arch"
            return 1
            ;;
    esac
}

# Download RustDesk Server binaries
download_rustdesk_server() {
    print_step_from_common_functions "Downloading RustDesk Server binaries..."

    # Detect architecture
    RUSTDESK_SERVER_ARCH=$(detect_architecture)
    if [[ $? -ne 0 ]]; then
        return 1
    fi

    RUSTDESK_HBBS_URL="https://github.com/rustdesk/rustdesk-server/releases/download/${RUSTDESK_SERVER_VERSION}/hbbs-${RUSTDESK_SERVER_ARCH}"
    RUSTDESK_HBBR_URL="https://github.com/rustdesk/rustdesk-server/releases/download/${RUSTDESK_SERVER_VERSION}/hbbr-${RUSTDESK_SERVER_ARCH}"

    local temp_dir="/tmp/rustdesk_server_$$"
    mkdir -p "$temp_dir"

    # Download hbbs
    print_step_from_common_functions "Downloading hbbs (ID/Rendezvous Server)..."
    echo "Running: wget -O $temp_dir/hbbs $RUSTDESK_HBBS_URL"
    if ! wget -O "$temp_dir/hbbs" "$RUSTDESK_HBBS_URL"; then
        print_error_from_common_functions "Failed to download hbbs"
        rm -rf "$temp_dir"
        return 1
    fi

    # Download hbbr
    print_step_from_common_functions "Downloading hbbr (Relay Server)..."
    echo "Running: wget -O $temp_dir/hbbr $RUSTDESK_HBBR_URL"
    if ! wget -O "$temp_dir/hbbr" "$RUSTDESK_HBBR_URL"; then
        print_error_from_common_functions "Failed to download hbbr"
        rm -rf "$temp_dir"
        return 1
    fi

    # Install binaries
    print_step_from_common_functions "Installing binaries to $RUSTDESK_BIN_DIR..."
    echo "Running: install -m 755 $temp_dir/hbbs $RUSTDESK_BIN_DIR/hbbs"
    $USE_SUDO install -m 755 "$temp_dir/hbbs" "$RUSTDESK_BIN_DIR/hbbs"
    echo "Running: install -m 755 $temp_dir/hbbr $RUSTDESK_BIN_DIR/hbbr"
    $USE_SUDO install -m 755 "$temp_dir/hbbr" "$RUSTDESK_BIN_DIR/hbbr"

    # Cleanup
    rm -rf "$temp_dir"

    print_success_from_common_functions "RustDesk Server binaries installed successfully"
    return 0
}

# Create directories
create_directories() {
    print_step_from_common_functions "Creating RustDesk Server directories..."

    $USE_SUDO mkdir -p "$RUSTDESK_BASE_DIR"
    $USE_SUDO mkdir -p "$RUSTDESK_DATA_DIR"
    $USE_SUDO mkdir -p "$RUSTDESK_LOG_DIR"

    $USE_SUDO chmod 755 "$RUSTDESK_BASE_DIR"
    $USE_SUDO chmod 755 "$RUSTDESK_DATA_DIR"
    $USE_SUDO chmod 755 "$RUSTDESK_LOG_DIR"

    print_success_from_common_functions "Directories created at $RUSTDESK_BASE_DIR"
    return 0
}

# Create systemd services
create_systemd_services() {
    print_step_from_common_functions "Creating systemd services..."

    # Create hbbs service
    echo "Creating: /etc/systemd/system/rustdesk-hbbs.service"
    cat <<EOF | $USE_SUDO tee /etc/systemd/system/rustdesk-hbbs.service
[Unit]
Description=RustDesk ID/Rendezvous Server
After=network.target
Wants=network.target

[Service]
Type=simple
WorkingDirectory=$RUSTDESK_DATA_DIR
ExecStart=$RUSTDESK_BIN_DIR/hbbs -p $HBBS_PORT -k _
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # Create hbbr service
    echo "Creating: /etc/systemd/system/rustdesk-hbbr.service"
    cat <<EOF | $USE_SUDO tee /etc/systemd/system/rustdesk-hbbr.service
[Unit]
Description=RustDesk Relay Server
After=network.target
Wants=network.target

[Service]
Type=simple
WorkingDirectory=$RUSTDESK_DATA_DIR
ExecStart=$RUSTDESK_BIN_DIR/hbbr -p $HBBR_PORT -k _
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    echo "Running: systemctl daemon-reload"
    $USE_SUDO systemctl daemon-reload

    print_success_from_common_functions "Systemd services created"
    return 0
}

# Configure firewall
configure_firewall() {
    print_step_from_common_functions "Configuring firewall for RustDesk Server..."

    # Open required ports
    firewall_allow_port "$HBBS_PORT" "tcp" "RustDesk ID Server (TCP)" || true
    firewall_allow_port "$HBBS_NAT_PORT" "tcp" "RustDesk NAT Type Test" || true
    firewall_allow_port "$HBBS_NAT_PORT" "udp" "RustDesk NAT Type Test" || true
    firewall_allow_port "$HBBR_PORT" "tcp" "RustDesk Relay Server" || true
    firewall_allow_port "$RELAY_PORT" "tcp" "RustDesk Relay (TCP)" || true
    firewall_allow_port "$RELAY_PORT" "udp" "RustDesk Relay (UDP)" || true

    print_success_from_common_functions "Firewall configured for RustDesk Server"
    return 0
}

# Start services
start_services() {
    print_step_from_common_functions "Starting RustDesk Server services..."

    # Enable and start hbbs
    echo "Running: systemctl enable rustdesk-hbbs"
    $USE_SUDO systemctl enable rustdesk-hbbs
    echo "Running: systemctl start rustdesk-hbbs"
    $USE_SUDO systemctl start rustdesk-hbbs

    # Enable and start hbbr
    echo "Running: systemctl enable rustdesk-hbbr"
    $USE_SUDO systemctl enable rustdesk-hbbr
    echo "Running: systemctl start rustdesk-hbbr"
    $USE_SUDO systemctl start rustdesk-hbbr

    # Wait for services to start
    sleep 3

    # Check service status
    local hbbs_status=$($USE_SUDO systemctl is-active rustdesk-hbbs)
    local hbbr_status=$($USE_SUDO systemctl is-active rustdesk-hbbr)

    if [[ "$hbbs_status" == "active" ]] && [[ "$hbbr_status" == "active" ]]; then
        print_success_from_common_functions "RustDesk Server services started successfully"
        return 0
    else
        print_error_from_common_functions "Failed to start RustDesk Server services"
        print_info_from_common_functions "hbbs status: $hbbs_status"
        print_info_from_common_functions "hbbr status: $hbbr_status"
        return 1
    fi
}

# Get public key
get_public_key() {
    local key_file="$RUSTDESK_DATA_DIR/id_ed25519.pub"

    if [[ -f "$key_file" ]]; then
        cat "$key_file"
    else
        echo "Key file not found yet. Please wait for server to start."
    fi
}

# Display connection info
display_connection_info() {
    print_header_from_common_functions "RustDesk Server Connection Information"

    echo ""
    print_success_from_common_functions "RustDesk Server is now running!"
    echo ""

    print_info_from_common_functions "Server Configuration:"
    echo "  - ID Server Port: $HBBS_PORT"
    echo "  - Relay Server Port: $HBBR_PORT"
    echo "  - NAT Test Port: $HBBS_NAT_PORT"
    echo "  - Data Directory: $RUSTDESK_DATA_DIR"
    echo ""

    print_info_from_common_functions "Available IP addresses:"
    hostname -I | tr ' ' '\n' | grep -v '^$' | sed 's/^/  /'

    local public_ip=$(curl -s https://api.ipify.org 2>/dev/null || echo "")
    if [[ -n "$public_ip" ]]; then
        echo "  $public_ip (public)"
    fi

    echo ""
    print_info_from_common_functions "Public Key (for RustDesk clients):"

    # Wait a bit for key to be generated
    sleep 2

    local public_key=$(get_public_key)
    if [[ -n "$public_key" ]] && [[ "$public_key" != *"not found"* ]]; then
        echo "  $public_key"
    else
        print_warning_from_common_functions "Public key not generated yet. Check later at:"
        echo "  $RUSTDESK_DATA_DIR/id_ed25519.pub"
    fi

    echo ""
    print_info_from_common_functions "To configure RustDesk Client:"
    echo "  1. Open RustDesk Client"
    echo "  2. Click the menu (three dots) → Settings"
    echo "  3. Go to 'Network' tab"
    echo "  4. Set ID Server to: <server_ip>:$HBBS_PORT"
    echo "  5. Set Relay Server to: <server_ip>:$HBBR_PORT"
    echo "  6. Set Key to: <public_key_above>"
    echo ""

    print_warning_from_common_functions "Important Security Notes:"
    echo "  - Keep your public key secure"
    echo "  - Configure firewall rules for ports $HBBS_PORT, $HBBS_NAT_PORT, $HBBR_PORT"
    echo "  - Consider using encryption for production use"
    echo ""

    print_info_from_common_functions "Service Management:"
    echo "  - Check status: systemctl status rustdesk-hbbs rustdesk-hbbr"
    echo "  - View logs: journalctl -u rustdesk-hbbs -u rustdesk-hbbr -f"
    echo "  - Restart: systemctl restart rustdesk-hbbs rustdesk-hbbr"
    echo ""
}

# Main installation function
install_rustdesk_server() {
    print_header_from_common_functions "Installing RustDesk Server"

    # Download binaries
    if ! download_rustdesk_server; then
        return 1
    fi

    # Create directories
    if ! create_directories; then
        return 1
    fi

    # Create systemd services
    if ! create_systemd_services; then
        return 1
    fi

    # Configure firewall
    configure_firewall

    # Start services
    if ! start_services; then
        return 1
    fi

    # Save installation info
    save_installation_info "$RUSTDESK_SERVER_VERSION"

    print_success_from_common_functions "RustDesk Server installation completed successfully!"

    # Display connection info
    display_connection_info

    return 0
}

# Interactive prompt
prompt_installation() {
    if is_rustdesk_server_installed; then
        print_warning_from_common_functions "RustDesk Server is already installed"

        local installed_version=$(get_installed_version)
        if [[ -n "$installed_version" ]]; then
            print_info_from_common_functions "Installed version: $installed_version"
        fi

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

    # Different prompt based on system type
    if [[ "$HAS_DESKTOP_ENVIRONMENT" != true ]]; then
        # Server system - default Y (install)
        echo ""
        echo "RustDesk Server - Self-hosted Remote Access Server"
        echo "This installs the ID/Rendezvous and Relay servers for RustDesk."
        echo ""
        echo -n "Install RustDesk Server? (Y/n): "
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
        # Desktop system - default N (skip)
        echo ""
        echo "RustDesk Server - Self-hosted Remote Access Server"
        echo "NOTE: RustDesk Server is typically installed on dedicated servers."
        echo "You appear to be on a desktop system."
        echo ""
        echo -n "Install RustDesk Server anyway? (N/y): "
        read -r response

        case "$response" in
            [yY]|[yY][eE][sS])
                print_info_from_common_functions "Installing on desktop system"
                return 0
                ;;
            *)
                print_info_from_common_functions "Installation skipped (desktop system)"
                return 1
                ;;
        esac
    fi
}

# Main script execution
main() {
    print_header_from_common_functions "RustDesk Server Installation Script"
    print_info_from_common_functions "Installation Directory: $RUSTDESK_BASE_DIR"
    print_info_from_common_functions "Version: $RUSTDESK_SERVER_VERSION"

    if ! prompt_installation; then
        exit 0
    fi

    install_rustdesk_server
    exit $?
}

main "$@"
