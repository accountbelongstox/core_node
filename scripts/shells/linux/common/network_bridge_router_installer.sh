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

# Network Bridge Router Installer and Manager
# Installs, configures, and manages the Network Bridge Router service

# Variables declaration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NBR_SCRIPT="$SCRIPT_DIR/network_bridge_router.sh"
CONFIG_FILE="/etc/network_bridge_router.conf"
SYSTEMD_SERVICE_FILE="/etc/systemd/system/network-bridge-router.service"
LOG_FILE="/var/log/network_bridge_router_installer.log"

# Default configuration
DEFAULT_INPUT_INTERFACE=""
DEFAULT_OUTPUT_INTERFACE=""
DEFAULT_ROUTER_IP=""
DEFAULT_BRIDGE_IP="192.168.100.1"
DEFAULT_BRIDGE_SUBNET="192.168.100.0/24"
DEFAULT_DHCP_RANGE_START="192.168.100.10"
DEFAULT_DHCP_RANGE_END="192.168.100.100"
DEFAULT_DNS_SERVERS="8.8.8.8,8.8.4.4"
DEFAULT_ENABLE_IPV6="false"
DEFAULT_ENABLE_DHCP="true"
DEFAULT_ENABLE_DNS="true"

# Function to log messages
log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

# Function to check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        echo "Error: This script must be run as root" >&2
        exit 1
    fi
}

# Function to detect network interfaces
detect_interfaces() {
    echo "Available network interfaces:"
    ip link show | grep -E '^[0-9]+:' | awk -F': ' '{print "  " $2}' | sed 's/@.*//'
    echo
}

# Function to validate IP address
validate_ip() {
    local ip="$1"
    if [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        return 0
    else
        return 1
    fi
}

# Function to prompt for configuration
prompt_configuration() {
    echo "Network Bridge Router Configuration"
    echo "=================================="
    echo
    
    detect_interfaces
    
    # Input interface
    while true; do
        read -p "Enter input interface (from Internet): " input_iface
        if [[ -n "$input_iface" ]] && ip link show "$input_iface" >/dev/null 2>&1; then
            DEFAULT_INPUT_INTERFACE="$input_iface"
            break
        else
            echo "Error: Interface '$input_iface' does not exist. Please try again."
        fi
    done
    
    # Output interface
    while true; do
        read -p "Enter output interface (to Router C): " output_iface
        if [[ -n "$output_iface" ]] && ip link show "$output_iface" >/dev/null 2>&1; then
            if [[ "$output_iface" != "$input_iface" ]]; then
                DEFAULT_OUTPUT_INTERFACE="$output_iface"
                break
            else
                echo "Error: Output interface cannot be the same as input interface."
            fi
        else
            echo "Error: Interface '$output_iface' does not exist. Please try again."
        fi
    done
    
    # Router IP
    while true; do
        read -p "Enter Router C IP address: " router_ip
        if validate_ip "$router_ip"; then
            DEFAULT_ROUTER_IP="$router_ip"
            break
        else
            echo "Error: Invalid IP address format. Please try again."
        fi
    done
    
    # Bridge IP (optional)
    read -p "Enter bridge IP address [$DEFAULT_BRIDGE_IP]: " bridge_ip
    if [[ -n "$bridge_ip" ]] && validate_ip "$bridge_ip"; then
        DEFAULT_BRIDGE_IP="$bridge_ip"
    fi
    
    # DNS servers (optional)
    read -p "Enter DNS servers [$DEFAULT_DNS_SERVERS]: " dns_servers
    if [[ -n "$dns_servers" ]]; then
        DEFAULT_DNS_SERVERS="$dns_servers"
    fi
    
    # IPv6 support
    read -p "Enable IPv6 support? [y/N]: " enable_ipv6
    if [[ "$enable_ipv6" =~ ^[Yy]$ ]]; then
        DEFAULT_ENABLE_IPV6="true"
    fi
    
    echo
    echo "Configuration Summary:"
    echo "====================="
    echo "Input Interface: $DEFAULT_INPUT_INTERFACE"
    echo "Output Interface: $DEFAULT_OUTPUT_INTERFACE"
    echo "Router IP: $DEFAULT_ROUTER_IP"
    echo "Bridge IP: $DEFAULT_BRIDGE_IP"
    echo "DNS Servers: $DEFAULT_DNS_SERVERS"
    echo "IPv6 Support: $DEFAULT_ENABLE_IPV6"
    echo
    
    read -p "Is this configuration correct? [Y/n]: " confirm
    if [[ "$confirm" =~ ^[Nn]$ ]]; then
        echo "Configuration cancelled."
        exit 1
    fi
}

# Function to create configuration file
create_config_file() {
    log_message "INFO" "Creating configuration file: $CONFIG_FILE"
    
    cat > "$CONFIG_FILE" << EOF
# Network Bridge Router Configuration
# Generated on $(date)

# Network interfaces
INPUT_INTERFACE="$DEFAULT_INPUT_INTERFACE"
OUTPUT_INTERFACE="$DEFAULT_OUTPUT_INTERFACE"
ROUTER_IP="$DEFAULT_ROUTER_IP"

# Bridge configuration
BRIDGE_IP="$DEFAULT_BRIDGE_IP"
BRIDGE_SUBNET="$DEFAULT_BRIDGE_SUBNET"
DHCP_RANGE_START="$DEFAULT_DHCP_RANGE_START"
DHCP_RANGE_END="$DEFAULT_DHCP_RANGE_END"

# DNS configuration
DNS_SERVERS="$DEFAULT_DNS_SERVERS"

# Feature flags
ENABLE_IPV6="$DEFAULT_ENABLE_IPV6"
ENABLE_DHCP="$DEFAULT_ENABLE_DHCP"
ENABLE_DNS="$DEFAULT_ENABLE_DNS"
EOF
    
    chmod 600 "$CONFIG_FILE"
    log_message "INFO" "Configuration file created successfully"
}

# Function to create systemd service
create_systemd_service() {
    log_message "INFO" "Creating systemd service: $SYSTEMD_SERVICE_FILE"
    
    local service_args=""
    service_args="-i $DEFAULT_INPUT_INTERFACE -o $DEFAULT_OUTPUT_INTERFACE -r $DEFAULT_ROUTER_IP"
    service_args="$service_args --bridge-ip $DEFAULT_BRIDGE_IP"
    service_args="$service_args --dns $DEFAULT_DNS_SERVERS"
    
    if [[ "$DEFAULT_ENABLE_IPV6" == "true" ]]; then
        service_args="$service_args --ipv6"
    fi
    
    if [[ "$DEFAULT_ENABLE_DHCP" == "false" ]]; then
        service_args="$service_args --no-dhcp"
    fi
    
    if [[ "$DEFAULT_ENABLE_DNS" == "false" ]]; then
        service_args="$service_args --no-dns"
    fi
    
    cat > "$SYSTEMD_SERVICE_FILE" << EOF
[Unit]
Description=Network Bridge Router Service
Documentation=file://$NBR_SCRIPT
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
ExecStart=$NBR_SCRIPT $service_args --daemon
ExecStop=/bin/kill -TERM \$MAINPID
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=5
TimeoutStartSec=30
TimeoutStopSec=30

# Resource limits
CPUQuota=50%
MemoryMax=200M
MemoryHigh=160M
TasksMax=50

# Security settings
NoNewPrivileges=false
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log /var/run /tmp /etc

[Install]
WantedBy=multi-user.target
EOF
    
    log_message "INFO" "Systemd service created successfully"
}

# Function to install dependencies
install_dependencies() {
    log_message "INFO" "Installing dependencies"
    
    local packages=("bridge-utils" "iptables" "iproute2" "dnsmasq")
    local missing_packages=()
    
    for package in "${packages[@]}"; do
        if ! dpkg -l | grep -q "^ii  $package "; then
            missing_packages+=("$package")
        fi
    done
    
    if [[ ${#missing_packages[@]} -gt 0 ]]; then
        log_message "INFO" "Installing missing packages: ${missing_packages[*]}"
        apt-get update -qq
        apt-get install -y "${missing_packages[@]}" || {
            log_message "ERROR" "Failed to install dependencies"
            return 1
        }
    else
        log_message "INFO" "All dependencies are already installed"
    fi
    
    return 0
}

# Function to install the service
install_service() {
    log_message "INFO" "Installing Network Bridge Router service"
    
    # Install dependencies
    install_dependencies || return 1
    
    # Prompt for configuration
    prompt_configuration
    
    # Create configuration file
    create_config_file
    
    # Create systemd service
    create_systemd_service
    
    # Make script executable
    chmod +x "$NBR_SCRIPT"
    
    # Reload systemd
    systemctl daemon-reload
    
    # Enable service
    systemctl enable network-bridge-router.service
    
    log_message "INFO" "Service installed successfully"
    echo
    echo "Installation completed successfully!"
    echo
    echo "To start the service:"
    echo "  sudo systemctl start network-bridge-router"
    echo
    echo "To check status:"
    echo "  sudo systemctl status network-bridge-router"
    echo "  sudo $NBR_SCRIPT --status"
    echo
    echo "To view logs:"
    echo "  sudo journalctl -u network-bridge-router -f"
    echo
    
    return 0
}

# Function to uninstall the service
uninstall_service() {
    log_message "INFO" "Uninstalling Network Bridge Router service"
    
    # Stop and disable service
    systemctl stop network-bridge-router.service 2>/dev/null || true
    systemctl disable network-bridge-router.service 2>/dev/null || true
    
    # Remove systemd service file
    rm -f "$SYSTEMD_SERVICE_FILE"
    
    # Remove configuration file
    rm -f "$CONFIG_FILE"
    
    # Reload systemd
    systemctl daemon-reload
    
    log_message "INFO" "Service uninstalled successfully"
    echo "Network Bridge Router service has been uninstalled."
}

# Function to show usage
usage() {
    echo "Network Bridge Router Installer"
    echo "Usage: $0 [install|uninstall|status]"
    echo
    echo "Commands:"
    echo "  install    - Install and configure the service"
    echo "  uninstall  - Remove the service"
    echo "  status     - Show service status"
    echo
}

# Main function
main() {
    check_root
    
    case "${1:-install}" in
        install)
            install_service
            ;;
        uninstall)
            uninstall_service
            ;;
        status)
            if [[ -f "$NBR_SCRIPT" ]]; then
                "$NBR_SCRIPT" --status
            else
                echo "Network Bridge Router is not installed"
                exit 1
            fi
            ;;
        *)
            usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
