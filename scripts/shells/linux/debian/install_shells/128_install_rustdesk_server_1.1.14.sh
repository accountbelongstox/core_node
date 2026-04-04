#!/bin/bash
# RustDesk Server Installation Script
#
# Usage:
#   ./128_install_rustdesk_server_1.1.14.sh
#
# This script installs RustDesk Server OSS (hbbs and hbbr) for self-hosting.
# OSS has NO Web Console, NO user accounts, NO client login/register; only ID + permanent password.
# For Web Console (port 21114), user management, and client account login use RustDesk Server Pro:
#   https://rustdesk.com/docs/en/self-host/rustdesk-server-pro/installscript/
#   wget -qO- https://raw.githubusercontent.com/rustdesk/rustdesk-server-pro/main/install.sh | bash
#
# Official Documentation: https://rustdesk.com/docs/en/self-host/rustdesk-server-oss/install/
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

# RustDesk Server version (latest stable - Jan 25, 2025)
RUSTDESK_SERVER_VERSION="1.1.14"
RUSTDESK_SERVER_ARCH="amd64"

# GitHub release URLs for Debian packages (recommended)
RUSTDESK_HBBS_DEB_URL="https://github.com/rustdesk/rustdesk-server/releases/download/${RUSTDESK_SERVER_VERSION}/rustdesk-server-hbbs_${RUSTDESK_SERVER_VERSION}_amd64.deb"
RUSTDESK_HBBR_DEB_URL="https://github.com/rustdesk/rustdesk-server/releases/download/${RUSTDESK_SERVER_VERSION}/rustdesk-server-hbbr_${RUSTDESK_SERVER_VERSION}_amd64.deb"

# GitHub release URLs for ZIP package (fallback)
RUSTDESK_ZIP_URL="https://github.com/rustdesk/rustdesk-server/releases/download/${RUSTDESK_SERVER_VERSION}/rustdesk-server-linux-amd64.zip"

# Set up directories using gvar_common.sh map_web_path
APPLICATIONS_DIR=$(map_web_path "applications_dir")
RUSTDESK_BASE_DIR="$APPLICATIONS_DIR/rustdesk-server"
RUSTDESK_BIN_DIR="/usr/local/bin"
RUSTDESK_DATA_DIR="$RUSTDESK_BASE_DIR/data"
RUSTDESK_LOG_DIR="$RUSTDESK_BASE_DIR/logs"
RUSTDESK_INSTALLED_FLAG="$RUSTDESK_BASE_DIR/.installed"

# Server configuration storage (persistent across reinstalls)
RUSTDESK_SERVER_CONFIG_DIR="/var/_core_node/rustdesk_server"
RUSTDESK_SERVER_CONFIG_FILE="$RUSTDESK_SERVER_CONFIG_DIR/server.conf"
RUSTDESK_SERVER_KEY_BACKUP="$RUSTDESK_SERVER_CONFIG_DIR/id_ed25519.pub"

# Client configuration
RUSTDESK_CLIENT_VERSION="1.3.3"  # Latest stable client version
RUSTDESK_CLIENTS_DIR="$APPLICATIONS_DIR/rustdesk-clients"
RUSTDESK_CLIENT_LINUX_URL="https://github.com/rustdesk/rustdesk/releases/download/${RUSTDESK_CLIENT_VERSION}/rustdesk-${RUSTDESK_CLIENT_VERSION}-x86_64.deb"
RUSTDESK_CLIENT_WINDOWS_URL="https://github.com/rustdesk/rustdesk/releases/download/${RUSTDESK_CLIENT_VERSION}/rustdesk-${RUSTDESK_CLIENT_VERSION}-x86_64.exe"

# Version tracking
APP_VERSIONS_DIR="$GLOBAL_VAR_DIR/app_versions"
RUSTDESK_SERVER_INSTALLED_FLAG="$APP_VERSIONS_DIR/rustdesk_server.version"

# Service ports (RustDesk OSS default; Pro uses 21114 for Web Console - not used by OSS)
# Reference: https://rustdesk.com/docs/en/self-host/rustdesk-server-oss/install/
HBBS_PORT="21115"          # hbbs TCP (ID/Rendezvous)
HBBS_NAT_PORT="21116"      # hbbs TCP/UDP (NAT type test)
HBBS_WEB_PORT="21118"      # hbbs TCP/websocket (do not use for our dashboard - port conflict)
HBBR_PORT="21117"          # hbbr TCP (Relay)
RELAY_PORT="21119"         # hbbr TCP (Relay)
RUSTDESK_DASHBOARD_PORT="21120"   # Python dashboard (must differ from 21118 so hbbs can bind)

# Dashboard (Python) under scripts/shells/linux/pytools/rustdesk_dashboard
RUSTDESK_DASHBOARD_APP="$PARENT_DIR_LEVEL_2/pytools/rustdesk_dashboard/app.py"
RUSTDESK_DASHBOARD_SERVICE_NAME="ncore-rustdesk-dashboard"

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
HBBS_WEB_PORT=$HBBS_WEB_PORT
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
    if dpkg -l | grep -q "rustdesk-server-hbbs" && dpkg -l | grep -q "rustdesk-server-hbbr"; then
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
            echo "arm64"
            ;;
        armv7l)
            echo "armhf"
            ;;
        i386|i686)
            echo "i386"
            ;;
        *)
            print_error_from_common_functions "Unsupported architecture: $arch"
            return 1
            ;;
    esac
}

# Check if system is Debian-based
is_debian_based() {
    if [[ -f /etc/debian_version ]] || command -v apt-get >/dev/null 2>&1; then
        return 0
    fi
    return 1
}

# Download and install via Debian packages (recommended)
install_via_deb() {
    print_step_from_common_functions "Installing RustDesk Server via Debian packages..."

    # Detect architecture
    local detected_arch=$(detect_architecture)
    if [[ $? -ne 0 ]]; then
        return 1
    fi

    # Update URLs for detected architecture
    local hbbs_deb_url="https://github.com/rustdesk/rustdesk-server/releases/download/${RUSTDESK_SERVER_VERSION}/rustdesk-server-hbbs_${RUSTDESK_SERVER_VERSION}_${detected_arch}.deb"
    local hbbr_deb_url="https://github.com/rustdesk/rustdesk-server/releases/download/${RUSTDESK_SERVER_VERSION}/rustdesk-server-hbbr_${RUSTDESK_SERVER_VERSION}_${detected_arch}.deb"

    local temp_dir="/tmp/rustdesk_server_$$"
    mkdir -p "$temp_dir"

    # Download hbbs package
    print_step_from_common_functions "Downloading hbbs package..."
    echo "URL: $hbbs_deb_url"
    if ! wget -O "$temp_dir/rustdesk-server-hbbs.deb" "$hbbs_deb_url"; then
        print_error_from_common_functions "Failed to download hbbs package"
        rm -rf "$temp_dir"
        return 1
    fi

    # Download hbbr package
    print_step_from_common_functions "Downloading hbbr package..."
    echo "URL: $hbbr_deb_url"
    if ! wget -O "$temp_dir/rustdesk-server-hbbr.deb" "$hbbr_deb_url"; then
        print_error_from_common_functions "Failed to download hbbr package"
        rm -rf "$temp_dir"
        return 1
    fi

    # Install packages
    print_step_from_common_functions "Installing Debian packages..."
    echo "Installing: rustdesk-server-hbbs.deb"
    if ! $USE_SUDO dpkg -i "$temp_dir/rustdesk-server-hbbs.deb"; then
        print_warning_from_common_functions "dpkg reported errors, attempting to fix dependencies..."
        $USE_SUDO apt-get install -f -y
    fi

    echo "Installing: rustdesk-server-hbbr.deb"
    if ! $USE_SUDO dpkg -i "$temp_dir/rustdesk-server-hbbr.deb"; then
        print_warning_from_common_functions "dpkg reported errors, attempting to fix dependencies..."
        $USE_SUDO apt-get install -f -y
    fi

    # Cleanup
    rm -rf "$temp_dir"

    # Verify installation
    if ! command -v hbbs >/dev/null 2>&1 || ! command -v hbbr >/dev/null 2>&1; then
        print_error_from_common_functions "Installation verification failed"
        return 1
    fi

    print_success_from_common_functions "RustDesk Server installed successfully via Debian packages"
    return 0
}

# Download and install via ZIP package (fallback)
install_via_zip() {
    print_step_from_common_functions "Installing RustDesk Server via ZIP package..."

    # Detect architecture
    local detected_arch=$(detect_architecture)
    if [[ $? -ne 0 ]]; then
        return 1
    fi

    local zip_url="https://github.com/rustdesk/rustdesk-server/releases/download/${RUSTDESK_SERVER_VERSION}/rustdesk-server-linux-${detected_arch}.zip"
    if [[ "$detected_arch" == "arm64" ]]; then
        zip_url="https://github.com/rustdesk/rustdesk-server/releases/download/${RUSTDESK_SERVER_VERSION}/rustdesk-server-linux-arm64v8.zip"
    fi

    local temp_dir="/tmp/rustdesk_server_$$"
    mkdir -p "$temp_dir"

    # Download ZIP package
    print_step_from_common_functions "Downloading RustDesk Server ZIP package..."
    echo "URL: $zip_url"
    if ! wget -O "$temp_dir/rustdesk-server.zip" "$zip_url"; then
        print_error_from_common_functions "Failed to download ZIP package"
        rm -rf "$temp_dir"
        return 1
    fi

    # Extract ZIP
    print_step_from_common_functions "Extracting ZIP package..."
    if ! unzip -q "$temp_dir/rustdesk-server.zip" -d "$temp_dir"; then
        print_error_from_common_functions "Failed to extract ZIP package"
        rm -rf "$temp_dir"
        return 1
    fi

    # Find binaries in extracted files
    local hbbs_bin=$(find "$temp_dir" -name "hbbs" -type f | head -n 1)
    local hbbr_bin=$(find "$temp_dir" -name "hbbr" -type f | head -n 1)

    if [[ -z "$hbbs_bin" ]] || [[ -z "$hbbr_bin" ]]; then
        print_error_from_common_functions "Could not find hbbs or hbbr binaries in extracted files"
        rm -rf "$temp_dir"
        return 1
    fi

    # Install binaries
    print_step_from_common_functions "Installing binaries to $RUSTDESK_BIN_DIR..."
    $USE_SUDO install -m 755 "$hbbs_bin" "$RUSTDESK_BIN_DIR/hbbs"
    $USE_SUDO install -m 755 "$hbbr_bin" "$RUSTDESK_BIN_DIR/hbbr"

    # Cleanup
    rm -rf "$temp_dir"

    print_success_from_common_functions "RustDesk Server installed successfully via ZIP package"
    return 0
}

# Download RustDesk Server
download_rustdesk_server() {
    # Check if unzip is installed (needed for ZIP method)
    if ! command -v unzip >/dev/null 2>&1; then
        print_step_from_common_functions "Installing unzip..."
        $USE_SUDO apt-get update -qq
        $USE_SUDO apt-get install -y unzip
    fi

    # Try Debian package installation first (recommended)
    if is_debian_based; then
        print_info_from_common_functions "Attempting installation via Debian packages (recommended)..."
        if install_via_deb; then
            return 0
        fi
        print_warning_from_common_functions "Debian package installation failed, trying ZIP method..."
    fi

    # Fallback to ZIP installation
    print_info_from_common_functions "Installing via ZIP package..."
    if install_via_zip; then
        return 0
    fi

    print_error_from_common_functions "All installation methods failed"
    return 1
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

    # Check if services already exist from .deb installation
    if systemctl list-unit-files | grep -q "rustdesk-hbbs.service"; then
        print_info_from_common_functions "Systemd service rustdesk-hbbs.service already exists (from package)"
        # Update the service to use our data directory
        $USE_SUDO systemctl stop rustdesk-hbbs 2>/dev/null || true
    fi

    if systemctl list-unit-files | grep -q "rustdesk-hbbr.service"; then
        print_info_from_common_functions "Systemd service rustdesk-hbbr.service already exists (from package)"
        # Update the service to use our data directory
        $USE_SUDO systemctl stop rustdesk-hbbr 2>/dev/null || true
    fi

    # Create or update hbbs service
    echo "Creating/updating: /etc/systemd/system/rustdesk-hbbs.service"
    cat <<EOF | $USE_SUDO tee /etc/systemd/system/rustdesk-hbbs.service
[Unit]
Description=RustDesk ID/Rendezvous Server
After=network.target
Wants=network.target

[Service]
Type=simple
WorkingDirectory=$RUSTDESK_DATA_DIR
ExecStart=$(command -v hbbs || echo "$RUSTDESK_BIN_DIR/hbbs") -r 127.0.0.1:$HBBR_PORT -k _
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # Create or update hbbr service
    echo "Creating/updating: /etc/systemd/system/rustdesk-hbbr.service"
    cat <<EOF | $USE_SUDO tee /etc/systemd/system/rustdesk-hbbr.service
[Unit]
Description=RustDesk Relay Server
After=network.target
Wants=network.target

[Service]
Type=simple
WorkingDirectory=$RUSTDESK_DATA_DIR
ExecStart=$(command -v hbbr || echo "$RUSTDESK_BIN_DIR/hbbr") -p $HBBR_PORT -k _
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    echo "Running: systemctl daemon-reload"
    $USE_SUDO systemctl daemon-reload

    print_success_from_common_functions "Systemd services created/updated"
    return 0
}

# Configure firewall via common firewall_manager.sh (UFW/firewalld/iptables)
configure_firewall() {
    print_step_from_common_functions "Configuring firewall for RustDesk Server (using common firewall_manager)..."

    firewall_allow_port "$HBBS_PORT" "tcp" "RustDesk ID/Rendezvous Server (TCP)" || true
    firewall_allow_port "$HBBS_NAT_PORT" "tcp" "RustDesk NAT Type Test (TCP)" || true
    firewall_allow_port "$HBBS_NAT_PORT" "udp" "RustDesk NAT Type Test (UDP)" || true
    firewall_allow_port "$HBBS_WEB_PORT" "tcp" "RustDesk hbbs websocket (TCP)" || true
    firewall_allow_port "$HBBR_PORT" "tcp" "RustDesk Relay Server (TCP)" || true
    firewall_allow_port "$RELAY_PORT" "tcp" "RustDesk Relay Port (TCP)" || true
    firewall_allow_port "21114" "tcp" "RustDesk Pro Web Console (OSS does not use)" || true

    if command -v ufw >/dev/null 2>&1; then
        print_info_from_common_functions "Ensuring RustDesk ports in UFW (official: 21114:21119/tcp, 21116/udp)..."
        $USE_SUDO ufw allow 21114:21119/tcp 2>/dev/null || true
        $USE_SUDO ufw allow 21116/udp 2>/dev/null || true
    else
        print_warning_from_common_functions "UFW not installed. Install with: apt install ufw, then re-run this script; or open 21114:21119/tcp and 21116/udp in cloud security group."
    fi

    print_success_from_common_functions "Firewall configured for RustDesk Server"
    print_info_from_common_functions "Opened ports: $HBBS_PORT, $HBBS_NAT_PORT (TCP/UDP), $HBBS_WEB_PORT, $HBBR_PORT, $RELAY_PORT, 21114 (Pro only)"
    print_info_from_common_functions "If client still fails to connect (e.g. to $HBBS_NAT_PORT), open 21114:21119/tcp and 21116/udp in cloud security group (e.g. Aliyun/AWS)."
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

        # Show logs for debugging
        echo ""
        echo "=== hbbs service logs ==="
        $USE_SUDO journalctl -u rustdesk-hbbs -n 20 --no-pager
        echo ""
        echo "=== hbbr service logs ==="
        $USE_SUDO journalctl -u rustdesk-hbbr -n 20 --no-pager

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

# Get all network interfaces and IP addresses
get_all_ips() {
    local ips=""

    # Get all IPv4 addresses
    local all_ips=$(hostname -I 2>/dev/null)

    if [[ -n "$all_ips" ]]; then
        ips="$all_ips"
    fi

    # Also get IP from specific interfaces
    if command -v ip >/dev/null 2>&1; then
        local interface_ips=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1')
        if [[ -n "$interface_ips" ]]; then
            ips="$ips $interface_ips"
        fi
    fi

    # Remove duplicates and sort
    echo "$ips" | tr ' ' '\n' | sort -u | grep -v '^$'
}

# Get public IP
get_public_ip() {
    local public_ip=""

    # Try multiple services
    public_ip=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null)
    if [[ -z "$public_ip" ]]; then
        public_ip=$(curl -s --max-time 5 https://ifconfig.me 2>/dev/null)
    fi
    if [[ -z "$public_ip" ]]; then
        public_ip=$(curl -s --max-time 5 https://icanhazip.com 2>/dev/null)
    fi

    echo "$public_ip"
}

# Wait for key generation
wait_for_key_generation() {
    local key_file="$RUSTDESK_DATA_DIR/id_ed25519.pub"
    local max_wait=30
    local waited=0

    print_step_from_common_functions "Waiting for encryption key generation..."

    while [[ $waited -lt $max_wait ]]; do
        if [[ -f "$key_file" ]] && [[ -s "$key_file" ]]; then
            print_success_from_common_functions "Encryption key generated successfully"
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
    done

    print_warning_from_common_functions "Key generation timeout. Key may be generated later."
    return 1
}

# Display connection info
display_connection_info() {
    echo ""
    echo "=============================================================================="
    echo "                    RUSTDESK SERVER CONFIGURATION"
    echo "=============================================================================="
    echo ""
    print_success_from_common_functions "RustDesk Server is now running!"
    echo ""

    # Wait for key generation
    wait_for_key_generation

    # Get encryption key
    local public_key=$(get_public_key)
    local key_file="$RUSTDESK_DATA_DIR/id_ed25519.pub"

    echo "+-----------------------------------------------------------------------------+"
    echo "| ENCRYPTION KEY (REQUIRED FOR CLIENT CONNECTION)                            |"
    echo "+-----------------------------------------------------------------------------+"
    echo ""
    if [[ -n "$public_key" ]] && [[ "$public_key" != *"not found"* ]]; then
        echo -e "  Public Key: ${GREEN}$public_key${NC}"
        echo ""
        echo "  Key Location: $key_file"
    else
        print_warning_from_common_functions "Encryption key not generated yet."
        echo "  Please check later at: $key_file"
        echo "  Or run: cat $key_file"
    fi
    echo ""

    echo "+-----------------------------------------------------------------------------+"
    echo "| NETWORK CONFIGURATION                                                       |"
    echo "+-----------------------------------------------------------------------------+"
    echo ""

    print_info_from_common_functions "Server Listening Ports:"
    echo -e "  * ID/Rendezvous Server (hbbs):   ${GREEN}$HBBS_PORT${NC} (TCP)"
    echo -e "  * NAT Type Test:                  ${GREEN}$HBBS_NAT_PORT${NC} (TCP/UDP)"
    echo -e "  * Web Admin Interface:            ${GREEN}$HBBS_WEB_PORT${NC} (TCP, hbbs websocket)"
    echo -e "  * Dashboard (client IDs):         ${GREEN}$RUSTDESK_DASHBOARD_PORT${NC} (TCP)"
    echo -e "  * Relay Server (hbbr):            ${GREEN}$HBBR_PORT${NC} (TCP)"
    echo -e "  * Relay Port:                     ${GREEN}$RELAY_PORT${NC} (TCP)"
    echo ""

    print_warning_from_common_functions "This is OSS (open source) server: no port 21114, no Web Console, no user accounts. Client has no register button; use ID + permanent password only. For Web Console and user login use RustDesk Server Pro."
    echo ""
    print_info_from_common_functions "Local IP Addresses (Private Network):"
    local all_local_ips=$(get_all_ips)
    if [[ -n "$all_local_ips" ]]; then
        echo "$all_local_ips" | while read -r ip; do
            if [[ -n "$ip" ]]; then
                echo "  * $ip"
            fi
        done
    else
        echo "  * No local IPs detected"
    fi
    echo ""

    print_info_from_common_functions "Public IP Address (Internet):"
    local public_ip=$(get_public_ip)
    if [[ -n "$public_ip" ]]; then
        echo -e "  * ${GREEN}$public_ip${NC} (Use this for remote access)"
    else
        echo "  * Unable to detect public IP"
        echo "  * Try: curl https://api.ipify.org"
    fi
    echo ""

    echo "+-----------------------------------------------------------------------------+"
    echo "| CLIENT CONFIGURATION GUIDE                                                  |"
    echo "+-----------------------------------------------------------------------------+"
    echo ""
    print_info_from_common_functions "For RustDesk Client Configuration:"
    echo ""
    echo -e "  ${BLUE}Step 1:${NC} Open RustDesk client application"
    echo -e "  ${BLUE}Step 2:${NC} Click the menu icon (three dots) * ${GREEN}Settings${NC}"
    echo -e "  ${BLUE}Step 3:${NC} Navigate to the ${GREEN}Network${NC} tab"
    echo -e "  ${BLUE}Step 4:${NC} Enter the following configuration:"
    echo ""
    echo "    +--------------------------------------------------------------+"
    if [[ -n "$public_ip" ]]; then
        echo -e "    | ID Server:    ${GREEN}$public_ip${NC}                                  |"
    else
        echo -e "    | ID Server:    ${YELLOW}<your_server_ip>${NC}                           |"
    fi
    echo -e "    | Relay Server: ${GREEN}<leave empty>${NC}                            |"
    echo -e "    | API Server:   ${GREEN}<leave empty>${NC}                            |"
    if [[ -n "$public_key" ]] && [[ "$public_key" != *"not found"* ]]; then
        echo -e "    | Key:          ${GREEN}$public_key${NC}"
    else
        echo -e "    | Key:          ${YELLOW}<see key above>${NC}                           |"
    fi
    echo "    +--------------------------------------------------------------+"
    echo ""
    print_warning_from_common_functions "Important Notes:"
    echo -e "  * ${RED}DO NOT${NC} add port numbers to ID Server (use IP only)"
    echo -e "  * For ${GREEN}local network${NC} access, use local IP (e.g., 192.168.x.x)"
    echo -e "  * For ${GREEN}internet${NC} access, use public IP"
    echo -e "  * ${YELLOW}Port forwarding${NC} required for internet access (forward ports to this server)"
    echo -e "  * The ${GREEN}Key${NC} field is ${RED}REQUIRED${NC} for secure connection"
    echo ""

    echo "+-----------------------------------------------------------------------------+"
    echo "| FIREWALL & PORT FORWARDING                                                  |"
    echo "+-----------------------------------------------------------------------------+"
    echo ""
    print_info_from_common_functions "Required Firewall Rules (already configured):"
    echo "  * TCP  $HBBS_PORT      - ID/Rendezvous Server"
    echo "  * TCP  $HBBS_NAT_PORT  - NAT Type Test"
    echo "  * UDP  $HBBS_NAT_PORT  - NAT Type Test"
    echo "  * TCP  $HBBS_WEB_PORT  - Web Admin / hbbs websocket"
    echo "  * TCP  $RUSTDESK_DASHBOARD_PORT  - Dashboard (client IDs)"
    echo "  * TCP  $HBBR_PORT      - Relay Server"
    echo "  * TCP  $RELAY_PORT     - Relay Port"
    echo ""
    print_warning_from_common_functions "For Internet Access, Configure Router Port Forwarding:"
    if [[ -n "$public_ip" ]]; then
        echo "  External: $public_ip:$HBBS_PORT -> Internal: <this_server>:$HBBS_PORT"
        echo "  External: $public_ip:$HBBR_PORT -> Internal: <this_server>:$HBBR_PORT"
        echo "  External: $public_ip:$HBBS_NAT_PORT -> Internal: <this_server>:$HBBS_NAT_PORT (TCP/UDP)"
    else
        echo "  External: <public_ip>:$HBBS_PORT -> Internal: <this_server>:$HBBS_PORT"
        echo "  External: <public_ip>:$HBBR_PORT -> Internal: <this_server>:$HBBR_PORT"
        echo "  External: <public_ip>:$HBBS_NAT_PORT -> Internal: <this_server>:$HBBS_NAT_PORT (TCP/UDP)"
    fi
    echo ""

    echo "+-----------------------------------------------------------------------------+"
    echo "| SERVICE MANAGEMENT                                                          |"
    echo "+-----------------------------------------------------------------------------+"
    echo ""
    print_info_from_common_functions "System Service Commands:"
    echo -e "  * Check status:  ${GREEN}systemctl status rustdesk-hbbs rustdesk-hbbr${NC}"
    echo -e "  * View logs:     ${GREEN}journalctl -u rustdesk-hbbs -u rustdesk-hbbr -f${NC}"
    echo -e "  * Restart:       ${GREEN}systemctl restart rustdesk-hbbs rustdesk-hbbr${NC}"
    echo -e "  * Stop:          ${GREEN}systemctl stop rustdesk-hbbs rustdesk-hbbr${NC}"
    echo -e "  * Start:         ${GREEN}systemctl start rustdesk-hbbs rustdesk-hbbr${NC}"
    echo ""
    print_info_from_common_functions "Installation Paths:"
    echo "  * Applications Base:  $APPLICATIONS_DIR"
    echo "  * Install Directory:  $RUSTDESK_BASE_DIR"
    echo "  * Data Directory:     $RUSTDESK_DATA_DIR"
    echo "  * Log Directory:      $RUSTDESK_LOG_DIR"
    echo "  * Binary Directory:   $RUSTDESK_BIN_DIR"
    echo ""
    print_info_from_common_functions "Key Files:"
    echo "  * Public Key File:    $key_file"
    echo "  * Private Key File:   $RUSTDESK_DATA_DIR/id_ed25519"
    echo ""

    echo "+-----------------------------------------------------------------------------+"
    echo "| SECURITY RECOMMENDATIONS                                                    |"
    echo "+-----------------------------------------------------------------------------+"
    echo ""
    print_warning_from_common_functions "Security Best Practices:"
    echo -e "  ${RED}[CRITICAL]${NC} Keep your encryption key (id_ed25519) ${RED}PRIVATE${NC}"
    echo -e "  ${RED}[CRITICAL]${NC} Never share the private key file"
    echo -e "  ${YELLOW}[IMPORTANT]${NC} Only share the public key with trusted clients"
    echo -e "  ${YELLOW}[IMPORTANT]${NC} Use strong passwords for RustDesk accounts"
    echo -e "  ${YELLOW}[IMPORTANT]${NC} Keep RustDesk server updated regularly"
    echo -e "  ${GREEN}[RECOMMENDED]${NC} Enable encrypted-only mode for production"
    echo -e "  ${GREEN}[RECOMMENDED]${NC} Use a firewall to restrict access"
    echo -e "  ${GREEN}[RECOMMENDED]${NC} Monitor server logs regularly"
    echo ""

    echo "+-----------------------------------------------------------------------------+"
    echo "| DOCUMENTATION & SUPPORT                                                     |"
    echo "+-----------------------------------------------------------------------------+"
    echo ""
    echo -e "  Official Documentation: ${BLUE}https://rustdesk.com/docs${NC}"
    echo -e "  Installation Guide:     ${BLUE}https://rustdesk.com/docs/en/self-host/rustdesk-server-oss/install/${NC}"
    echo -e "  Client Configuration:   ${BLUE}https://rustdesk.com/docs/en/self-host/client-configuration/${NC}"
    echo -e "  GitHub Repository:      ${BLUE}https://github.com/rustdesk/rustdesk-server${NC}"
    echo -e "  Latest Release:         ${BLUE}https://github.com/rustdesk/rustdesk-server/releases/tag/${RUSTDESK_SERVER_VERSION}${NC}"
    echo ""
    echo "=============================================================================="
    echo ""
}

# Save server configuration to persistent storage
save_server_config() {
    print_step_from_common_functions "Saving server configuration..."

    # Create config directory
    $USE_SUDO mkdir -p "$RUSTDESK_SERVER_CONFIG_DIR"

    # Get current configuration
    local public_key=$(get_public_key)
    local public_ip=$(get_public_ip)
    local all_local_ips=$(get_all_ips | tr '\n' ',' | sed 's/,$//')

    # Save configuration file
    cat <<EOF | $USE_SUDO tee "$RUSTDESK_SERVER_CONFIG_FILE" > /dev/null
# RustDesk Server Configuration
# Generated: $(date '+%Y-%m-%d %H:%M:%S')
# Version: $RUSTDESK_SERVER_VERSION

# Server Identity
PUBLIC_KEY=$public_key
SERVER_VERSION=$RUSTDESK_SERVER_VERSION

# Network Configuration
PUBLIC_IP=$public_ip
LOCAL_IPS=$all_local_ips

# Port Configuration
HBBS_PORT=$HBBS_PORT
HBBS_NAT_PORT=$HBBS_NAT_PORT
HBBS_WEB_PORT=$HBBS_WEB_PORT
HBBR_PORT=$HBBR_PORT
RELAY_PORT=$RELAY_PORT

# Directory Paths
DATA_DIR=$RUSTDESK_DATA_DIR
LOG_DIR=$RUSTDESK_LOG_DIR
CLIENTS_DIR=$RUSTDESK_CLIENTS_DIR
EOF

    # Backup encryption key
    if [[ -f "$RUSTDESK_DATA_DIR/id_ed25519.pub" ]]; then
        $USE_SUDO cp "$RUSTDESK_DATA_DIR/id_ed25519.pub" "$RUSTDESK_SERVER_KEY_BACKUP"
        print_success_from_common_functions "Encryption key backed up to: $RUSTDESK_SERVER_KEY_BACKUP"
    fi

    $USE_SUDO chmod 644 "$RUSTDESK_SERVER_CONFIG_FILE"
    $USE_SUDO chmod 644 "$RUSTDESK_SERVER_KEY_BACKUP" 2>/dev/null

    print_success_from_common_functions "Configuration saved to: $RUSTDESK_SERVER_CONFIG_FILE"
}

# Load server configuration from persistent storage
load_server_config() {
    if [[ -f "$RUSTDESK_SERVER_CONFIG_FILE" ]]; then
        source "$RUSTDESK_SERVER_CONFIG_FILE"
        return 0
    fi
    return 1
}

# Download and configure RustDesk clients
download_and_configure_clients() {
    print_step_from_common_functions "Downloading and configuring RustDesk clients..."

    # Create clients directory
    $USE_SUDO mkdir -p "$RUSTDESK_CLIENTS_DIR"

    # Load server configuration
    if ! load_server_config; then
        print_error_from_common_functions "Server configuration not found. Cannot configure clients."
        return 1
    fi

    local public_ip=$(get_public_ip)
    local public_key=$(get_public_key)

    if [[ -z "$public_key" ]] || [[ "$public_key" == *"not found"* ]]; then
        print_error_from_common_functions "Public key not available. Cannot configure clients."
        return 1
    fi

    # Download Linux client
    print_step_from_common_functions "Downloading Linux client..."
    local linux_client="$RUSTDESK_CLIENTS_DIR/rustdesk-${RUSTDESK_CLIENT_VERSION}-linux-x86_64.deb"
    if wget -O "$linux_client" "$RUSTDESK_CLIENT_LINUX_URL" 2>/dev/null; then
        print_success_from_common_functions "Linux client downloaded: $(basename $linux_client)"
    else
        print_warning_from_common_functions "Failed to download Linux client"
    fi

    # Download Windows client
    print_step_from_common_functions "Downloading Windows client..."
    local windows_client="$RUSTDESK_CLIENTS_DIR/rustdesk-${RUSTDESK_CLIENT_VERSION}-windows-x86_64.exe"
    if wget -O "$windows_client" "$RUSTDESK_CLIENT_WINDOWS_URL" 2>/dev/null; then
        print_success_from_common_functions "Windows client downloaded: $(basename $windows_client)"
    else
        print_warning_from_common_functions "Failed to download Windows client"
    fi

    # Create configuration readme
    local readme_file="$RUSTDESK_CLIENTS_DIR/CONFIGURATION.txt"
    cat <<EOF | $USE_SUDO tee "$readme_file" > /dev/null
==============================================================================
                   RUSTDESK CLIENT CONFIGURATION GUIDE
==============================================================================

Generated: $(date '+%Y-%m-%d %H:%M:%S')
Server Version: $RUSTDESK_SERVER_VERSION
Client Version: $RUSTDESK_CLIENT_VERSION

------------------------------------------------------------
IMPORTANT: Configuration Required After Installation
------------------------------------------------------------

* RustDesk clients require manual configuration to connect to your server.
* Follow the steps below carefully after installing the client.

------------------------------------------------------------
SERVER CONNECTION DETAILS
------------------------------------------------------------

ID Server:    $public_ip
Relay Server: (leave empty for auto-detect)
Public Key:   $public_key

IMPORTANT: Enter ONLY the IP address in ID Server field (no port number).

------------------------------------------------------------
CONFIGURATION STEPS
------------------------------------------------------------

Step 1: Install the Client
--------------------------
  * Linux:   sudo dpkg -i rustdesk-${RUSTDESK_CLIENT_VERSION}-linux-x86_64.deb
  * Windows: Run rustdesk-${RUSTDESK_CLIENT_VERSION}-windows-x86_64.exe

Step 2: Open Client Settings
----------------------------
  1. Launch RustDesk application
  2. Click the menu icon (three dots)
  3. Select "Settings"
  4. Navigate to "Network" tab

Step 3: Unlock Settings (IMPORTANT)
----------------------------------
  * Click the padlock icon to unlock settings
  * This may require administrator/root privileges

Step 4: Enter Server Configuration
---------------------------------

  Field: ID Server
  Value: $public_ip
  NOTE:  DO NOT add port number, just IP address

  Field: Relay Server
  Value: (leave empty)

  Field: Key
  Value: $public_key

Step 5: Save and Test
--------------------
  1. Click "OK" to save settings
  2. Restart RustDesk client
  3. Your device ID should appear in the main window
  4. Test connection with another device

------------------------------------------------------------
FIREWALL REQUIREMENTS
------------------------------------------------------------

Ensure these ports are open on your server firewall:
  * TCP $HBBS_PORT      (ID/Rendezvous Server)
  * TCP/UDP $HBBS_NAT_PORT (NAT Type Test)
  * TCP $HBBR_PORT      (Relay Server)
  * TCP $RELAY_PORT      (Relay)

------------------------------------------------------------
TROUBLESHOOTING
------------------------------------------------------------

Cannot Connect:
  * Verify firewall ports are open (script uses common firewall_manager.sh)
  * Check server is running: systemctl status rustdesk-hbbs rustdesk-hbbr
  * Restart services: sudo systemctl restart rustdesk-hbbs rustdesk-hbbr ncore-rustdesk-dashboard
  * Ensure public key is entered correctly (no extra spaces)
  * Try using server's public IP address

Settings Won't Save:
  * Ensure you unlocked settings with padlock icon
  * Run client with administrator/root privileges

For More Help:
  * Official Documentation: https://rustdesk.com/docs/
  * GitHub Issues: https://github.com/rustdesk/rustdesk/issues

==============================================================================
EOF

    print_success_from_common_functions "Client configuration guide created: $readme_file"

    # Display download location
    echo ""
    echo "+-----------------------------------------------------------------------------+"
    echo "| CONFIGURED CLIENTS AVAILABLE                                                |" 
    echo "+-----------------------------------------------------------------------------+"
    echo ""
    print_success_from_common_functions "Clients downloaded and ready for distribution:"
    echo ""
    echo "  [dir] Location: $RUSTDESK_CLIENTS_DIR"
    echo ""

    # Show file listing
    if [[ -d "$RUSTDESK_CLIENTS_DIR" ]]; then
        echo "  Available files:"
        ls -lh "$RUSTDESK_CLIENTS_DIR" | grep -v "^total" | awk '{printf "    * %-40s %8s\n", $9, $5}'
    fi

    echo ""
    print_info_from_common_functions "Configuration Instructions:"
    echo "  * See: $readme_file"
    echo "  * Or run: cat $readme_file"
    echo ""

    # Check if directory is web-accessible
    local web_base=$(map_web_path "www_root")
    if [[ "$RUSTDESK_CLIENTS_DIR" == "$web_base"* ]]; then
        local web_path="${RUSTDESK_CLIENTS_DIR#$web_base}"
        print_info_from_common_functions "Web Download (if web server configured):"
        echo "  * http://your-server$web_path/"
    fi

    return 0
}

# Main installation function
install_rustdesk_server() {
    print_header_from_common_functions "Installing RustDesk Server"

    # Download and install
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

    # Save server configuration
    save_server_config

    # Download and configure clients
    echo ""
    download_and_configure_clients

    if prompt_ensure_service; then
        ensure_dashboard_service
    fi

    return 0
}

# Repair/fix existing installation (always run these checks)
repair_installation() {
    print_header_from_common_functions "Checking and Repairing RustDesk Server Configuration"

    print_info_from_common_functions "Step 1/5: Verifying directories..."
    create_directories

    echo ""
    print_info_from_common_functions "Step 2/5: Updating systemd services..."
    create_systemd_services

    echo ""
    print_info_from_common_functions "Step 3/5: Configuring firewall..."
    configure_firewall

    echo ""
    print_info_from_common_functions "Step 4/5: Restarting services..."
    $USE_SUDO systemctl daemon-reload
    $USE_SUDO systemctl restart rustdesk-hbbs rustdesk-hbbr
    if systemctl list-unit-files --type=service 2>/dev/null | grep -q "ncore-rustdesk-dashboard"; then
        $USE_SUDO systemctl restart "$RUSTDESK_DASHBOARD_SERVICE_NAME" 2>/dev/null || true
    fi
    sleep 3

    local hbbs_status=$($USE_SUDO systemctl is-active rustdesk-hbbs)
    local hbbr_status=$($USE_SUDO systemctl is-active rustdesk-hbbr)

    if [[ "$hbbs_status" == "active" ]] && [[ "$hbbr_status" == "active" ]]; then
        print_success_from_common_functions "Services restarted successfully"
    else
        print_warning_from_common_functions "Service status: hbbs=$hbbs_status, hbbr=$hbbr_status"
    fi

    echo ""
    print_info_from_common_functions "Step 5/5: Updating configuration..."
    wait_for_key_generation
    save_installation_info "$RUSTDESK_SERVER_VERSION"
    save_server_config
    download_and_configure_clients

    echo ""
    print_success_from_common_functions "Configuration check and repair completed!"
    echo ""
    display_connection_info
}

# Ensure dashboard is registered as ncore service (optional, run every time when user confirms)
ensure_dashboard_service() {
    if [[ ! -f "$RUSTDESK_DASHBOARD_APP" ]]; then
        print_warning_from_common_functions "Dashboard app not found: $RUSTDESK_DASHBOARD_APP, skip service registration"
        return 0
    fi
    print_step_from_common_functions "Ensuring RustDesk dashboard service (ncore-rustdesk-dashboard)..."
    local dashboard_config_dir="/var/_core_node/rustdesk_dashboard"
    local dashboard_config_file="$dashboard_config_dir/config.json"
    $USE_SUDO systemctl stop "$RUSTDESK_DASHBOARD_SERVICE_NAME" 2>/dev/null || true
    if [[ -f "$dashboard_config_file" ]]; then
        $USE_SUDO python3 -c "
import json
p = '''$dashboard_config_file'''
try:
    with open(p) as f: d = json.load(f)
except (FileNotFoundError, json.JSONDecodeError): d = {}
d['port'] = $RUSTDESK_DASHBOARD_PORT
with open(p, 'w') as f: json.dump(d, f, indent=2)
" 2>/dev/null || true
    fi
    source "$PARENT_DIR_LEVEL_2/common/debian_service_manager.sh"
    if create_ncore_service "$RUSTDESK_DASHBOARD_APP" "rustdesk-dashboard" "RustDesk OSS Dashboard (client IDs)" "20%" "128M"; then
        $USE_SUDO systemctl enable "$RUSTDESK_DASHBOARD_SERVICE_NAME" 2>/dev/null || true
        $USE_SUDO systemctl start "$RUSTDESK_DASHBOARD_SERVICE_NAME" 2>/dev/null || true
        firewall_allow_port "$RUSTDESK_DASHBOARD_PORT" "tcp" "RustDesk Dashboard (TCP)" || true
        print_success_from_common_functions "Dashboard service enabled: http://<server>:$RUSTDESK_DASHBOARD_PORT (default password: rustdesk)"
    else
        print_warning_from_common_functions "Dashboard service creation failed or skipped"
    fi
}

# Ask whether to ensure installation as service (dashboard); default Y
prompt_ensure_service() {
    echo ""
    echo -n "Ensure installation to service (RustDesk dashboard)? (Y/n): "
    read -r response
    case "$response" in
        [nN]|[nN][oO]) return 1 ;;
        *) return 0 ;;
    esac
}

# Interactive prompt
prompt_installation() {
    if is_rustdesk_server_installed; then
        print_warning_from_common_functions "RustDesk Server is already installed"

        local installed_version=$(get_installed_version)
        if [[ -n "$installed_version" ]]; then
            print_info_from_common_functions "Installed version: $installed_version"
            print_info_from_common_functions "Latest version: $RUSTDESK_SERVER_VERSION"
        fi

        echo ""
        print_info_from_common_functions "Automatically checking and repairing configuration..."
        echo ""
        repair_installation

        echo ""
        echo "---------------------------------------------------------------"
        if prompt_ensure_service; then
            ensure_dashboard_service
        fi
        print_info_from_common_functions "Done. Run script again anytime to re-apply all steps."
        return 1
    fi

    # Different prompt based on system type
    if [[ "$HAS_DESKTOP_ENVIRONMENT" != true ]]; then
        # Server system - default Y (install)
        echo ""
        echo "RustDesk Server - Self-hosted Remote Access Server"
        echo "This installs the ID/Rendezvous and Relay servers for RustDesk."
        echo "Version: $RUSTDESK_SERVER_VERSION (Latest)"
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
        echo "Version: $RUSTDESK_SERVER_VERSION (Latest)"
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
    print_info_from_common_functions "Version: $RUSTDESK_SERVER_VERSION (Latest - Jan 25, 2025)"
    print_info_from_common_functions "Applications Base: $APPLICATIONS_DIR"
    print_info_from_common_functions "Installation Directory: $RUSTDESK_BASE_DIR"

    if ! prompt_installation; then
        exit 0
    fi

    install_rustdesk_server
    exit $?
}

main "$@"
