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

# Variables declaration
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
PARENT_DIR_LEVEL_3="$(dirname "$PARENT_DIR_LEVEL_2")"
PARENT_DIR_LEVEL_4="$(dirname "$PARENT_DIR_LEVEL_3")"
PARENT_DIR_LEVEL_5="$(dirname "$PARENT_DIR_LEVEL_4")"
PROJECT_ROOT="$PARENT_DIR_LEVEL_5"
STEP_NUMBER=17
SSH_PORT=22
SSH_CONFIG_FILE="/etc/ssh/sshd_config"
SSHD_SERVICE_NAME="sshd"
SCRIPT_TEMP_DIR=""
SSH_SETUP_FLAG=""
CURRENT_USER=""
SYSTEM_IPS=""
CONNECTION_COMMANDS=""
FIREWALL_TYPE=""
HAS_UFW=false
HAS_FIREWALLD=false
HAS_IPTABLES=false
DEBIAN_FRONTEND="noninteractive"

# Use global temporary directory structure
SCRIPT_TEMP_DIR=$(mktemp -d -t setup_ssh_remote_XXXXXX)
SSH_SETUP_FLAG="$SCRIPT_TEMP_DIR/ssh_configured_step17.flag"

# Source common functions and variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Get current user
CURRENT_USER=${USER:-$(whoami)}

# Function to detect system type and environment
detect_system_type() {
    print_step_from_common_functions "Detecting system type and environment..."

    if [ -f /etc/os-release ]; then
        source /etc/os-release
        print_success_from_common_functions "System: $NAME $VERSION"
    else
        print_warning_from_common_functions "Cannot detect system type, assuming Debian/Ubuntu"
    fi

    local env_type="Unknown"
    if [ "${IS_WSL:-false}" = "true" ]; then
        env_type="WSL (Windows Subsystem for Linux)"
    elif [ "${IS_PRODUCTION:-false}" = "true" ]; then
        env_type="Production Server"
    elif [ "${HAS_DESKTOP_ENVIRONMENT:-false}" = "true" ]; then
        env_type="Desktop Environment"
    fi

    print_success_from_common_functions "Environment Type: $env_type"
}

# Function to check if SSH server is installed
check_ssh_installed() {
    print_step_from_common_functions "Checking SSH server installation status..."

    if command -v sshd >/dev/null 2>&1; then
        print_success_from_common_functions "SSH server is already installed"
        return 0
    elif systemctl list-unit-files | grep -q "ssh.service\|sshd.service"; then
        print_success_from_common_functions "SSH service exists"
        return 0
    else
        print_warning_from_common_functions "SSH server not found"
        return 1
    fi
}

# Function to install SSH server
install_ssh_server() {
    print_step_from_common_functions "Installing OpenSSH server..."

    if check_ssh_installed; then
        print_success_from_common_functions "SSH server already installed, skipping installation"
        return 0
    fi

    print_step_from_common_functions "Updating package lists..."
    if ! $USE_SUDO apt-get update -qq; then
        print_error_from_common_functions "Failed to update package lists"
        return 1
    fi

    print_step_from_common_functions "Installing openssh-server package..."
    if $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y openssh-server; then
        print_success_from_common_functions "OpenSSH server installed successfully"
        return 0
    else
        print_error_from_common_functions "Failed to install OpenSSH server"
        return 1
    fi
}

# Function to detect which service name to use
detect_ssh_service_name() {
    if systemctl list-unit-files | grep -q "^sshd.service"; then
        SSHD_SERVICE_NAME="sshd"
    elif systemctl list-unit-files | grep -q "^ssh.service"; then
        SSHD_SERVICE_NAME="ssh"
    else
        SSHD_SERVICE_NAME="ssh"
    fi
    print_step_from_common_functions "Detected SSH service name: $SSHD_SERVICE_NAME"
}

# Function to configure SSH server
configure_ssh_server() {
    print_step_from_common_functions "Configuring SSH server..."

    if [ ! -f "$SSH_CONFIG_FILE" ]; then
        print_error_from_common_functions "SSH config file not found: $SSH_CONFIG_FILE"
        return 1
    fi

    print_step_from_common_functions "Backing up SSH config file..."
    if ! $USE_SUDO cp "$SSH_CONFIG_FILE" "${SSH_CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"; then
        print_error_from_common_functions "Failed to backup SSH config"
        return 1
    fi

    print_step_from_common_functions "Configuring SSH settings for remote access..."

    $USE_SUDO sed -i 's/^#*Port .*/Port '"$SSH_PORT"'/' "$SSH_CONFIG_FILE"

    $USE_SUDO sed -i 's/^#*PermitRootLogin .*/PermitRootLogin yes/' "$SSH_CONFIG_FILE"

    $USE_SUDO sed -i 's/^#*PubkeyAuthentication .*/PubkeyAuthentication yes/' "$SSH_CONFIG_FILE"

    $USE_SUDO sed -i 's/^#*PasswordAuthentication .*/PasswordAuthentication yes/' "$SSH_CONFIG_FILE"

    if ! grep -q "^Port $SSH_PORT" "$SSH_CONFIG_FILE"; then
        echo "Port $SSH_PORT" | $USE_SUDO tee -a "$SSH_CONFIG_FILE" > /dev/null
    fi

    if ! grep -q "^PermitRootLogin yes" "$SSH_CONFIG_FILE"; then
        echo "PermitRootLogin yes" | $USE_SUDO tee -a "$SSH_CONFIG_FILE" > /dev/null
    fi

    print_success_from_common_functions "SSH server configured successfully"
    return 0
}

# Function to start and enable SSH service
start_ssh_service() {
    print_step_from_common_functions "Starting SSH service..."

    detect_ssh_service_name

    if $USE_SUDO systemctl start "$SSHD_SERVICE_NAME" 2>/dev/null; then
        print_success_from_common_functions "SSH service started successfully"
    else
        print_warning_from_common_functions "Failed to start SSH service via systemctl"
        if $USE_SUDO service "$SSHD_SERVICE_NAME" start 2>/dev/null; then
            print_success_from_common_functions "SSH service started via service command"
        else
            print_error_from_common_functions "Failed to start SSH service"
            return 1
        fi
    fi

    print_step_from_common_functions "Enabling SSH service to start on boot..."
    if $USE_SUDO systemctl enable "$SSHD_SERVICE_NAME" 2>/dev/null; then
        print_success_from_common_functions "SSH service enabled for auto-start"
    else
        print_warning_from_common_functions "Failed to enable SSH service via systemctl"
    fi

    return 0
}

# Function to restart SSH service
restart_ssh_service() {
    print_step_from_common_functions "Restarting SSH service to apply changes..."

    detect_ssh_service_name

    if $USE_SUDO systemctl restart "$SSHD_SERVICE_NAME" 2>/dev/null; then
        print_success_from_common_functions "SSH service restarted successfully"
        return 0
    else
        print_warning_from_common_functions "Failed to restart via systemctl, trying service command..."
        if $USE_SUDO service "$SSHD_SERVICE_NAME" restart 2>/dev/null; then
            print_success_from_common_functions "SSH service restarted via service command"
            return 0
        else
            print_error_from_common_functions "Failed to restart SSH service"
            return 1
        fi
    fi
}

# Function to detect firewall type
detect_firewall() {
    print_step_from_common_functions "Detecting firewall configuration..."

    HAS_UFW=false
    HAS_FIREWALLD=false
    HAS_IPTABLES=false

    if command -v ufw >/dev/null 2>&1; then
        if $USE_SUDO ufw status 2>/dev/null | grep -q "Status: active"; then
            HAS_UFW=true
            FIREWALL_TYPE="ufw"
            print_success_from_common_functions "Detected active UFW firewall"
        fi
    fi

    if command -v firewall-cmd >/dev/null 2>&1; then
        if systemctl is-active --quiet firewalld 2>/dev/null; then
            HAS_FIREWALLD=true
            FIREWALL_TYPE="firewalld"
            print_success_from_common_functions "Detected active firewalld"
        fi
    fi

    if command -v iptables >/dev/null 2>&1; then
        local rule_count=$($USE_SUDO iptables -L -n 2>/dev/null | grep -c "^Chain\|^target" || echo "0")
        if [ "$rule_count" -gt 10 ]; then
            HAS_IPTABLES=true
            if [ -z "$FIREWALL_TYPE" ]; then
                FIREWALL_TYPE="iptables"
            fi
            print_success_from_common_functions "Detected iptables rules (count: $rule_count)"
        fi
    fi

    if [ -z "$FIREWALL_TYPE" ]; then
        print_warning_from_common_functions "No active firewall detected"
        FIREWALL_TYPE="none"
    fi
}

# Function to configure UFW firewall
configure_ufw_firewall() {
    print_step_from_common_functions "Configuring UFW firewall for SSH..."

    if ! command -v ufw >/dev/null 2>&1; then
        print_warning_from_common_functions "UFW is not installed"
        return 1
    fi

    print_step_from_common_functions "Allowing SSH port $SSH_PORT in UFW..."
    if $USE_SUDO ufw allow "$SSH_PORT/tcp" comment 'SSH Remote Access' 2>/dev/null; then
        print_success_from_common_functions "SSH port allowed in UFW"
    else
        print_warning_from_common_functions "Failed to add UFW rule for SSH"
    fi

    if ! $USE_SUDO ufw status 2>/dev/null | grep -q "Status: active"; then
        print_step_from_common_functions "UFW is not active, enabling..."
        if echo "y" | $USE_SUDO ufw enable 2>/dev/null; then
            print_success_from_common_functions "UFW enabled successfully"
        else
            print_warning_from_common_functions "Failed to enable UFW"
        fi
    fi

    print_step_from_common_functions "Current UFW status:"
    $USE_SUDO ufw status numbered 2>/dev/null || print_warning_from_common_functions "Cannot show UFW status"

    return 0
}

# Function to configure firewalld
configure_firewalld() {
    print_step_from_common_functions "Configuring firewalld for SSH..."

    if ! systemctl is-active --quiet firewalld; then
        print_step_from_common_functions "Starting firewalld service..."
        if ! $USE_SUDO systemctl start firewalld; then
            print_error_from_common_functions "Failed to start firewalld"
            return 1
        fi
    fi

    print_step_from_common_functions "Allowing SSH port $SSH_PORT in firewalld..."
    if $USE_SUDO firewall-cmd --permanent --add-port="${SSH_PORT}/tcp" 2>/dev/null; then
        print_success_from_common_functions "SSH port added to firewalld"
    else
        print_warning_from_common_functions "Failed to add firewalld rule"
    fi

    if $USE_SUDO firewall-cmd --permanent --add-service=ssh 2>/dev/null; then
        print_success_from_common_functions "SSH service added to firewalld"
    fi

    if $USE_SUDO firewall-cmd --reload 2>/dev/null; then
        print_success_from_common_functions "Firewalld rules reloaded"
    else
        print_warning_from_common_functions "Failed to reload firewalld"
    fi

    print_step_from_common_functions "Current firewalld rules:"
    $USE_SUDO firewall-cmd --list-all 2>/dev/null || print_warning_from_common_functions "Cannot show firewalld rules"

    return 0
}

# Function to install iptables if needed
install_iptables() {
    print_step_from_common_functions "Installing iptables..."

    if ! command -v iptables >/dev/null 2>&1; then
        if $USE_SUDO apt-get install -y iptables iptables-persistent 2>/dev/null; then
            print_success_from_common_functions "iptables installed successfully"
            return 0
        else
            print_error_from_common_functions "Failed to install iptables"
            return 1
        fi
    else
        print_success_from_common_functions "iptables is already installed"
        return 0
    fi
}

# Function to configure iptables
configure_iptables() {
    print_step_from_common_functions "Configuring iptables for SSH..."

    if ! command -v iptables >/dev/null 2>&1; then
        print_warning_from_common_functions "iptables is not installed"
        return 1
    fi

    local rule_exists=$($USE_SUDO iptables -L INPUT -n 2>/dev/null | grep -c "dpt:$SSH_PORT" || echo "0")

    if [ "$rule_exists" -eq 0 ]; then
        print_step_from_common_functions "Adding iptables rule for SSH port $SSH_PORT..."
        if $USE_SUDO iptables -A INPUT -p tcp --dport "$SSH_PORT" -j ACCEPT 2>/dev/null; then
            print_success_from_common_functions "iptables rule added successfully"
        else
            print_warning_from_common_functions "Failed to add iptables rule"
        fi

        if command -v iptables-save >/dev/null 2>&1; then
            print_step_from_common_functions "Saving iptables rules..."
            if [ -d /etc/iptables ]; then
                if $USE_SUDO sh -c "iptables-save > /etc/iptables/rules.v4" 2>/dev/null; then
                    print_success_from_common_functions "iptables rules saved to /etc/iptables/rules.v4"
                fi
            fi
            if $USE_SUDO iptables-save | $USE_SUDO tee /etc/iptables.rules > /dev/null 2>&1; then
                print_success_from_common_functions "iptables rules saved to /etc/iptables.rules"
            else
                print_warning_from_common_functions "Could not save iptables rules permanently"
                print_warning_from_common_functions "You may need to install iptables-persistent package"
            fi
        fi
    else
        print_success_from_common_functions "iptables rule for SSH already exists"
    fi

    print_step_from_common_functions "Current iptables INPUT rules:"
    $USE_SUDO iptables -L INPUT -n --line-numbers 2>/dev/null | grep -E "^Chain|dpt:$SSH_PORT|^num" || print_warning_from_common_functions "Cannot show iptables rules"

    return 0
}

# Function to configure firewall rules
configure_firewall() {
    print_step_from_common_functions "Configuring firewall rules for SSH access..."

    detect_firewall

    case "$FIREWALL_TYPE" in
        ufw)
            configure_ufw_firewall
            ;;
        firewalld)
            configure_firewalld
            ;;
        iptables)
            configure_iptables
            ;;
        none)
            print_warning_from_common_functions "No active firewall detected"

            if [ "${IS_WSL:-false}" = "true" ]; then
                print_warning_from_common_functions "WSL environment detected - firewall configuration not required"
                print_warning_from_common_functions "Windows firewall will handle network security"
                return 0
            fi

            if [ "${HAS_DESKTOP_ENVIRONMENT:-false}" = "true" ]; then
                print_warning_from_common_functions "Desktop environment detected - firewall may not be necessary"
                print_warning_from_common_functions "Skipping firewall installation for desktop systems"
                return 0
            fi

            echo ""
            echo "=========================================="
            echo "FIREWALL INSTALLATION OPTION"
            echo "=========================================="
            echo ""
            echo "No firewall is currently active on this system."
            echo ""
            echo "For production servers, it is recommended to have a firewall."
            echo "This script can install and configure iptables for you."
            echo ""
            read -p "Do you want to install and configure iptables? (y/N): " install_firewall

            if [[ "$install_firewall" =~ ^[Yy]$ ]]; then
                print_step_from_common_functions "Installing iptables..."
                if install_iptables; then
                    configure_iptables
                else
                    print_warning_from_common_functions "Failed to install iptables, continuing without firewall"
                fi
            else
                print_warning_from_common_functions "Skipping firewall installation"
                print_warning_from_common_functions "SSH will be accessible without firewall protection"
                print_warning_from_common_functions "You can manually configure firewall later if needed"
            fi
            ;;
        *)
            print_warning_from_common_functions "Unknown firewall type: $FIREWALL_TYPE"
            print_warning_from_common_functions "Skipping firewall configuration"
            ;;
    esac

    return 0
}

# Function to detect system IP addresses
detect_system_ips() {
    print_step_from_common_functions "Detecting system IP addresses..."

    local ip_addresses=()

    if command -v ip >/dev/null 2>&1; then
        while IFS= read -r ip_line; do
            if [ -n "$ip_line" ]; then
                ip_addresses+=("$ip_line")
            fi
        done < <(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1')
    elif command -v ifconfig >/dev/null 2>&1; then
        while IFS= read -r ip_line; do
            if [ -n "$ip_line" ]; then
                ip_addresses+=("$ip_line")
            fi
        done < <(ifconfig | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1')
    fi

    if command -v hostname >/dev/null 2>&1; then
        local hostname_ip=$(hostname -I 2>/dev/null | awk '{print $1}')
        if [ -n "$hostname_ip" ] && [ "$hostname_ip" != "127.0.0.1" ]; then
            ip_addresses+=("$hostname_ip")
        fi
    fi

    ip_addresses=($(printf '%s\n' "${ip_addresses[@]}" | sort -u))

    if [ ${#ip_addresses[@]} -eq 0 ]; then
        print_warning_from_common_functions "No external IP addresses detected"
        ip_addresses=("YOUR_SERVER_IP")
    fi

    SYSTEM_IPS="${ip_addresses[@]}"

    print_success_from_common_functions "Detected IP addresses: $SYSTEM_IPS"
    return 0
}

# Function to generate connection commands
generate_connection_commands() {
    print_step_from_common_functions "Generating SSH connection commands..."

    detect_system_ips

    CONNECTION_COMMANDS=""

    local username="$CURRENT_USER"
    if [ "$username" = "root" ]; then
        username="root"
    fi

    print_header_from_common_functions "SSH Connection Information"
    echo ""
    echo "=========================================="
    echo "SSH REMOTE ACCESS CONFIGURED"
    echo "=========================================="
    echo ""
    echo "SSH Port: $SSH_PORT"
    echo "Current User: $username"
    echo ""
    echo "Available Connection Commands:"
    echo "------------------------------------------"

    local ip_array=($SYSTEM_IPS)
    for ip in "${ip_array[@]}"; do
        local cmd="ssh ${username}@${ip}"
        if [ "$SSH_PORT" != "22" ]; then
            cmd="ssh -p $SSH_PORT ${username}@${ip}"
        fi
        echo ""
        echo "IP Address: $ip"
        echo "Connection Command:"
        echo "  $cmd"
        echo ""
        echo "Copy and paste the command above to connect from another machine."
        echo "------------------------------------------"

        CONNECTION_COMMANDS="$CONNECTION_COMMANDS$cmd\n"
    done

    echo ""
    echo "Additional Information:"
    echo "  - Password authentication is enabled"
    echo "  - Public key authentication is enabled"
    echo "  - Root login is permitted"
    echo ""
    echo "Firewall Configuration:"
    echo "  - Firewall Type: $FIREWALL_TYPE"
    echo "  - SSH Port $SSH_PORT is allowed"
    echo ""

    if [ "$FIREWALL_TYPE" = "ufw" ]; then
        echo "UFW Status:"
        $USE_SUDO ufw status numbered 2>/dev/null | head -20 || echo "  Cannot display UFW status"
    elif [ "$FIREWALL_TYPE" = "firewalld" ]; then
        echo "Firewalld Rules:"
        $USE_SUDO firewall-cmd --list-all 2>/dev/null | head -20 || echo "  Cannot display firewalld rules"
    elif [ "$FIREWALL_TYPE" = "iptables" ]; then
        echo "iptables Rules:"
        $USE_SUDO iptables -L INPUT -n --line-numbers 2>/dev/null | grep -E "Chain INPUT|dpt:$SSH_PORT" | head -10 || echo "  Cannot display iptables rules"
    fi

    echo ""
    echo "=========================================="

    return 0
}

# Function to verify SSH service status
verify_ssh_status() {
    print_step_from_common_functions "Verifying SSH service status..."

    detect_ssh_service_name

    if systemctl is-active --quiet "$SSHD_SERVICE_NAME" 2>/dev/null; then
        print_success_from_common_functions "SSH service is running"
    elif $USE_SUDO service "$SSHD_SERVICE_NAME" status 2>/dev/null | grep -q "running\|active"; then
        print_success_from_common_functions "SSH service is running (via service command)"
    else
        print_error_from_common_functions "SSH service is not running!"
        return 1
    fi

    if systemctl is-enabled --quiet "$SSHD_SERVICE_NAME" 2>/dev/null; then
        print_success_from_common_functions "SSH service is enabled for auto-start"
    fi

    if $USE_SUDO netstat -tuln 2>/dev/null | grep -q ":$SSH_PORT "; then
        print_success_from_common_functions "SSH is listening on port $SSH_PORT"
    elif $USE_SUDO ss -tuln 2>/dev/null | grep -q ":$SSH_PORT "; then
        print_success_from_common_functions "SSH is listening on port $SSH_PORT (via ss)"
    else
        print_warning_from_common_functions "Cannot verify if SSH is listening on port $SSH_PORT"
    fi

    return 0
}

# Function to create flag file
create_setup_flag() {
    print_step_from_common_functions "Creating setup completion flag..."

    if ! $USE_SUDO touch "$SSH_SETUP_FLAG"; then
        print_error_from_common_functions "Failed to create setup flag file"
        return 1
    fi

    echo "SSH_PORT=$SSH_PORT" | $USE_SUDO tee "$SSH_SETUP_FLAG" > /dev/null
    echo "SETUP_DATE=$(date '+%Y-%m-%d %H:%M:%S')" | $USE_SUDO tee -a "$SSH_SETUP_FLAG" > /dev/null
    echo "FIREWALL_TYPE=$FIREWALL_TYPE" | $USE_SUDO tee -a "$SSH_SETUP_FLAG" > /dev/null

    print_success_from_common_functions "Setup flag created: $SSH_SETUP_FLAG"
    return 0
}

# Main function for Step 17: Setup SSH Remote Access
step17_setup_ssh_remote() {
    print_header_from_common_functions "Step 17: Setup SSH Remote Access"
    print_step_from_common_functions "This step will configure SSH server for remote access."

    detect_system_type

    if [ -f "$SSH_SETUP_FLAG" ]; then
        print_success_from_common_functions "SSH remote access already configured."
        print_step_from_common_functions "Showing connection information..."
        generate_connection_commands
        return 0
    fi

    if ! install_ssh_server; then
        print_error_from_common_functions "Failed to install SSH server"
        return 1
    fi

    if ! configure_ssh_server; then
        print_error_from_common_functions "Failed to configure SSH server"
        return 1
    fi

    if ! start_ssh_service; then
        print_error_from_common_functions "Failed to start SSH service"
        return 1
    fi

    if ! restart_ssh_service; then
        print_error_from_common_functions "Failed to restart SSH service"
        return 1
    fi

    if ! configure_firewall; then
        print_warning_from_common_functions "Firewall configuration encountered issues, but continuing..."
    fi

    if ! verify_ssh_status; then
        print_error_from_common_functions "SSH service verification failed"
        return 1
    fi

    if ! create_setup_flag; then
        print_warning_from_common_functions "Failed to create setup flag, but SSH is configured"
    fi

    generate_connection_commands

    print_success_from_common_functions "SSH remote access setup completed successfully!"
    print_step_from_common_functions "You can now connect to this machine using the commands shown above."

    return 0
}

# Execute main function
step17_setup_ssh_remote

# Exit with the return code from main function
exit $?
