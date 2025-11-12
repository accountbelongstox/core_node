#!/bin/bash
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

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/firewall_manager.sh"

SCRIPT_NAME="[98_install_rustdesk_server]"
INSTALL_SCRIPT_URL="https://raw.githubusercontent.com/techahold/rustdeskinstall/master/install.sh"
INSTALL_SCRIPT_PATH="/tmp/rustdesk_install.sh"
# Get RustDesk installation directory using map_web_path
RUSTDESK_INSTALL_DIR=$(map_web_path "applications_dir" "rustdesk")

print_info() {
    echo -e "\033[0;36m$SCRIPT_NAME $1\033[0m"
}

print_success() {
    echo -e "\033[0;32m$SCRIPT_NAME $1\033[0m"
}

print_warning() {
    echo -e "\033[0;33m$SCRIPT_NAME $1\033[0m"
}

print_error() {
    echo -e "\033[0;31m$SCRIPT_NAME $1\033[0m"
}

configure_firewall() {
    print_info "Configuring firewall for RustDesk..."
    detect_firewall false
    
    firewall_allow_port_range 21114 21119 tcp "RustDesk TCP ports"
    firewall_allow_port 21116 udp "RustDesk UDP port"
    
    print_success "Firewall configuration completed"
}

install_rustdesk_server() {
    print_info "Installing RustDesk server using Techahold installation script..."
    print_info "This will install RustDesk as systemd service (hbbr and hbbs)"
    echo ""
    
    print_info "Installation directory: $RUSTDESK_INSTALL_DIR"
    
    # Ensure installation directory exists
    if [ ! -d "$RUSTDESK_INSTALL_DIR" ]; then
        print_info "Creating installation directory: $RUSTDESK_INSTALL_DIR"
        $USE_SUDO mkdir -p "$RUSTDESK_INSTALL_DIR"
        if [ $? -eq 0 ]; then
            print_success "Installation directory created"
        else
            print_warning "Failed to create installation directory, will use default location"
        fi
    else
        print_success "Installation directory already exists"
    fi
    
    echo ""
    print_info "Downloading installation script from Techahold..."
    wget -q "$INSTALL_SCRIPT_URL" -O "$INSTALL_SCRIPT_PATH"
    
    if [ $? -ne 0 ]; then
        print_error "Failed to download installation script"
        print_info "Please check your network connection and try again"
        return 1
    fi
    
    print_success "Installation script downloaded successfully"
    
    chmod +x "$INSTALL_SCRIPT_PATH"
    
    print_info "Running installation script..."
    print_warning "The script will:"
    print_warning "  - Download and set up relay server (hbbr) and signal server (hbbs)"
    print_warning "  - Generate configuration"
    print_warning "  - Host configuration on a password-protected web page"
    print_warning "  - Display IP/DNS and Key at the end of installation"
    echo ""
    print_info "Installation directory: $RUSTDESK_INSTALL_DIR"
    print_info "Please follow the prompts during installation..."
    echo ""
    
    cd "$RUSTDESK_INSTALL_DIR"
    "$INSTALL_SCRIPT_PATH"
    
    local install_status=$?
    
    if [ $install_status -eq 0 ]; then
        print_success "========================================"
        print_success "  RustDesk Server Installation Complete!"
        print_success "========================================"
        echo ""
        print_info "The installation script should have displayed:"
        print_info "  - Server IP/DNS"
        print_info "  - Server Key (public key from id_ed25519.pub)"
        echo ""
        print_warning "IMPORTANT: Please note these values displayed above!"
        print_warning "You will need them to configure RustDesk clients."
        echo ""
        print_info "For updates, use the update script from Techahold repository:"
        print_info "  https://github.com/techahold/rustdeskinstall"
        
        return 0
    else
        print_error "Installation script failed with exit code: $install_status"
        print_info "Please check the error messages above and try again"
        return 1
    fi
}

get_server_info() {
    print_info "Retrieving server information..."
    
    local server_ip=$(hostname -I | awk '{print $1}')
    local server_dns=""
    if command -v hostname >/dev/null 2>&1; then
        server_dns=$(hostname -f 2>/dev/null)
        if [ -z "$server_dns" ]; then
            server_dns=$(hostname)
        fi
    fi
    local key=""
    local key_file=""
    
    echo ""
    print_success "========================================"
    print_success "  Server Configuration Information"
    print_success "========================================"
    echo ""
    print_info "Server IP: $server_ip"
    print_info "Server DNS: $server_dns"
    echo ""
    
    print_info "Checking for RustDesk key file (id_ed25519.pub)..."
    
    # Note: id_ed25519.pub is automatically generated by hbbs (RustDesk signal server)
    # during first run. Techahold installation script will start hbbs and generate this file.
    # The file location depends on Techahold script configuration, typically:
    # - /usr/local/rustdesk-server/id_ed25519.pub (Techahold default)
    # - Or in the directory where hbbs is configured to run
    local possible_locations=(
        "/usr/local/rustdesk-server/id_ed25519.pub"
        "/opt/rustdesk-server/id_ed25519.pub"
        "$RUSTDESK_INSTALL_DIR/id_ed25519.pub"
        "/root/id_ed25519.pub"
    )
    
    for location in "${possible_locations[@]}"; do
        if [ -f "$location" ]; then
            key_file="$location"
            key=$(cat "$key_file" 2>/dev/null | tr -d '\n\r')
            if [ -n "$key" ]; then
                break
            fi
        fi
    done
    
    # If still not found, search common locations
    if [ -z "$key" ]; then
        key_file=$(find /usr/local /opt /root "$RUSTDESK_INSTALL_DIR" -name "id_ed25519.pub" -type f 2>/dev/null | head -n 1)
        if [ -n "$key_file" ] && [ -f "$key_file" ]; then
            key=$(cat "$key_file" 2>/dev/null | tr -d '\n\r')
        fi
    fi
    
    if [ -n "$key" ]; then
        print_success "Found public key"
        echo ""
        print_success "========================================"
        print_success "  Client Configuration Guide"
        print_success "========================================"
        echo ""
        print_info "Method 1: Manual Configuration"
        print_info "  1. Open RustDesk Client"
        print_info "  2. Click Menu button [ â‹?] next to your ID"
        print_info "  3. Click on 'Network'"
        print_info "  4. Unlock settings using elevated privileges"
        print_info "  5. Configure the following:"
        echo ""
        print_success "  ID Server:"
        print_info "    $server_ip"
        print_info "    or"
        print_info "    $server_dns"
        print_info "    or"
        print_info "    $server_dns:21116"
        echo ""
        print_success "  Key (Public Key):"
        print_info "    $key"
        echo ""
        print_info "  Relay Server:"
        print_info "    (Leave blank, will auto-deduce)"
        echo ""
        print_info "  API Server:"
        print_info "    (Leave blank for default, or specify if using custom port)"
        echo ""
        print_info "Method 2: Export/Import Configuration"
        print_info "  1. Configure on one device using Method 1"
        print_info "  2. Go to Settings > Network > Export Server Config"
        print_info "  3. Copy the config string"
        print_info "  4. On new client: Settings > Network > Import Server Config"
        print_info "  5. Paste and click Apply"
        echo ""
        print_info "Method 3: Command Line"
        print_info "  rustdesk.exe --config <config-string>"
        echo ""
        print_info "Method 4: Automatic Deployment"
        print_info "  Use deployment scripts from RustDesk repository"
        echo ""
        print_warning "Important Notes:"
        print_warning "  - The Key is the public key (id_ed25519.pub), not a license key"
        print_warning "  - Configure both local and remote clients with the same settings"
        print_warning "  - If API Server uses non-default port, specify it explicitly"
        echo ""
    else
        print_warning "Key file (id_ed25519.pub) not found automatically"
        print_info "The key should have been displayed during installation"
        print_info "You can also find it in:"
        print_info "  - $RUSTDESK_INSTALL_DIR/id_ed25519.pub"
        print_info "  - /root/id_ed25519.pub"
        print_info "  - Installation directory used by Techahold script"
        echo ""
        print_info "Client Configuration (without key):"
        print_info "  ID Server: $server_ip or $server_dns"
        print_info "  Key: (Please check installation output or locate id_ed25519.pub file)"
        echo ""
        print_info "To find the key, you can also check the password-protected web page"
        print_info "that was set up during installation."
        echo ""
    fi
}

main() {
    print_info "========================================"
    print_info "  RustDesk Server Installation"
    print_info "========================================"
    echo ""
    
    print_info "RustDesk is an open-source remote desktop software"
    print_info "This script will install the RustDesk relay and signal servers"
    echo ""
    
    print_info "Installation Directory: $RUSTDESK_INSTALL_DIR"
    echo ""
    
    print_info "System Requirements:"
    print_info "  - Low hardware requirements (basic cloud server is sufficient)"
    print_info "  - Network: TCP ports 21114-21119, UDP port 21116"
    print_info "  - Traffic: 30 K/s to 3 M/s (1920x1080 screen)"
    echo ""
    
    print_info "Checking prerequisites..."
    
    configure_firewall
    
    echo ""
    print_info "Starting RustDesk server installation..."
    echo ""
    
    if install_rustdesk_server; then
        echo ""
        print_info "Waiting a moment for services to initialize..."
        sleep 3
        echo ""
        get_server_info
        return 0
    else
        print_error "RustDesk server installation failed"
        return 1
    fi
}

main
exit $?

