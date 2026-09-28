#!/bin/bash

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
  * Linux:   sudo apt install ./rustdesk-${RUSTDESK_CLIENT_VERSION}-linux-x86_64.deb
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
    local web_base=$(map_web_path "wwwroot")
    if [[ "$RUSTDESK_CLIENTS_DIR" == "$web_base"* ]]; then
        local web_path="${RUSTDESK_CLIENTS_DIR#$web_base}"
        print_info_from_common_functions "Web Download (if web server configured):"
        echo "  * http://your-server$web_path/"
    fi

    return 0
}

