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

# Network Bridge Router - Extended Linux Router for Dual Interface Forwarding
# Implements: Internet -> Interface A -> Interface B -> Router C -> Internet
# Based on lnxrouter with enhanced dual-interface bridging capabilities

# Variables declaration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROGNAME="$(basename "$0")"
VERSION="1.0.0"
PID_FILE="/var/run/network_bridge_router.pid"
CONFIG_FILE="/etc/network_bridge_router.conf"
LOG_FILE="/var/log/network_bridge_router.log"
STATUS_FILE="/var/run/network_bridge_router.status"
LOCK_FILE="/var/run/network_bridge_router.lock"

# Network configuration variables
INPUT_INTERFACE=""
OUTPUT_INTERFACE=""
ROUTER_IP=""
BRIDGE_NAME="nbr-bridge"
BRIDGE_IP="192.168.100.1"
BRIDGE_SUBNET="192.168.100.0/24"
DHCP_RANGE_START="192.168.100.10"
DHCP_RANGE_END="192.168.100.100"
DNS_SERVERS="8.8.8.8,8.8.4.4"
ENABLE_IPV6=0
ENABLE_DHCP=1
ENABLE_DNS=1
ENABLE_SERVICE=0

# Service management variables
SERVICE_NAME="network-bridge-router"
SERVICE_DESCRIPTION="Network Bridge Router Service"
DEBIAN_SERVICE_MANAGER="$SCRIPT_DIR/systemd_service_manager.sh"

# Runtime state variables
RUNNING=0
CLEANUP_NEEDED=0
IPTABLES_RULES_ADDED=()
IP_FORWARD_ENABLED=0
BRIDGE_CREATED=0
DNSMASQ_PID=""

# Function to print header
print_header() {
    echo "Network Bridge Router $VERSION"
    echo "Extended Linux Router for Dual Interface Forwarding"
    echo "Released under LGPL, with no warranty. Use on your own risk."
    echo
}

# Function to show usage
usage() {
    print_header
    cat << EOF
Usage: $PROGNAME <options>

Required Options:
    -i, --input <interface>     Input network interface (from Internet)
    -o, --output <interface>    Output network interface (to Router C)
    -r, --router <ip>           Router C IP address

Optional Options:
    -h, --help                  Show this help
    --version                   Print version number
    --bridge-ip <ip>            Bridge IP address (default: $BRIDGE_IP)
    --bridge-subnet <subnet>    Bridge subnet (default: $BRIDGE_SUBNET)
    --dhcp-range <start-end>    DHCP range (default: $DHCP_RANGE_START-$DHCP_RANGE_END)
    --dns <servers>             DNS servers (default: $DNS_SERVERS)
    --no-dhcp                   Disable DHCP server
    --no-dns                    Disable DNS server
    -6, --ipv6                  Enable IPv6 support
    --daemon                    Run as daemon
    --service                   Install as system service
    --status                    Show current status
    --stop                      Stop running instance
    --restart                   Restart service

Examples:
    # Basic setup: eth0 (Internet) -> eth1 (to Router)
    sudo $PROGNAME -i eth0 -o eth1 -r 192.168.1.1

    # With custom bridge configuration
    sudo $PROGNAME -i wlan0 -o eth0 -r 10.0.0.1 --bridge-ip 10.1.1.1 --bridge-subnet 10.1.1.0/24

    # Install as system service
    sudo $PROGNAME -i eth0 -o eth1 -r 192.168.1.1 --service

    # Check status
    $PROGNAME --status
EOF
}

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

# Function to check dependencies
check_dependencies() {
    local missing_deps=()
    local deps=("iptables" "ip" "brctl" "dnsmasq")
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" >/dev/null 2>&1; then
            missing_deps+=("$dep")
        fi
    done
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        echo "Error: Missing dependencies: ${missing_deps[*]}" >&2
        echo "Please install: apt-get install bridge-utils iptables iproute2 dnsmasq" >&2
        exit 1
    fi
}

# Function to validate network interface
validate_interface() {
    local interface="$1"
    local name="$2"
    
    if [[ -z "$interface" ]]; then
        echo "Error: $name interface not specified" >&2
        return 1
    fi
    
    if ! ip link show "$interface" >/dev/null 2>&1; then
        echo "Error: $name interface '$interface' does not exist" >&2
        return 1
    fi
    
    return 0
}

# Function to validate IP address
validate_ip() {
    local ip="$1"
    local name="$2"
    
    if [[ -z "$ip" ]]; then
        echo "Error: $name IP not specified" >&2
        return 1
    fi
    
    if ! [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        echo "Error: Invalid $name IP address format: $ip" >&2
        return 1
    fi
    
    return 0
}

# Function to acquire lock
acquire_lock() {
    if [[ -f "$LOCK_FILE" ]]; then
        local lock_pid=$(cat "$LOCK_FILE" 2>/dev/null)
        if [[ -n "$lock_pid" ]] && kill -0 "$lock_pid" 2>/dev/null; then
            echo "Error: Another instance is already running (PID: $lock_pid)" >&2
            return 1
        else
            rm -f "$LOCK_FILE"
        fi
    fi
    
    echo $$ > "$LOCK_FILE"
    return 0
}

# Function to release lock
release_lock() {
    rm -f "$LOCK_FILE"
}

# Function to save current status
save_status() {
    cat > "$STATUS_FILE" << EOF
RUNNING=$RUNNING
INPUT_INTERFACE=$INPUT_INTERFACE
OUTPUT_INTERFACE=$OUTPUT_INTERFACE
ROUTER_IP=$ROUTER_IP
BRIDGE_NAME=$BRIDGE_NAME
BRIDGE_IP=$BRIDGE_IP
BRIDGE_SUBNET=$BRIDGE_SUBNET
PID=$$
STARTED=$(date '+%Y-%m-%d %H:%M:%S')
EOF
}

# Function to load status
load_status() {
    if [[ -f "$STATUS_FILE" ]]; then
        source "$STATUS_FILE"
        return 0
    fi
    return 1
}

# Function to show status
show_status() {
    if load_status && [[ "$RUNNING" == "1" ]] && kill -0 "$PID" 2>/dev/null; then
        echo "Network Bridge Router Status: RUNNING"
        echo "PID: $PID"
        echo "Started: $STARTED"
        echo "Input Interface: $INPUT_INTERFACE"
        echo "Output Interface: $OUTPUT_INTERFACE"
        echo "Router IP: $ROUTER_IP"
        echo "Bridge: $BRIDGE_NAME ($BRIDGE_IP)"
        echo "Bridge Subnet: $BRIDGE_SUBNET"
        
        # Show bridge status
        if ip link show "$BRIDGE_NAME" >/dev/null 2>&1; then
            echo "Bridge Status: UP"
            echo "Bridge Interfaces:"
            brctl show "$BRIDGE_NAME" 2>/dev/null | tail -n +2
        else
            echo "Bridge Status: DOWN"
        fi
        
        # Show routing status
        echo "Routing Status:"
        if [[ -f "/proc/sys/net/ipv4/ip_forward" ]]; then
            local forward_status=$(cat /proc/sys/net/ipv4/ip_forward)
            echo "  IPv4 Forwarding: $([[ "$forward_status" == "1" ]] && echo "ENABLED" || echo "DISABLED")"
        fi
        
        return 0
    else
        echo "Network Bridge Router Status: STOPPED"
        return 1
    fi
}

# Function to enable IP forwarding
enable_ip_forwarding() {
    log_message "INFO" "Enabling IP forwarding"

    # Enable IPv4 forwarding
    echo 1 > /proc/sys/net/ipv4/ip_forward
    IP_FORWARD_ENABLED=1

    # Enable IPv6 forwarding if requested
    if [[ "$ENABLE_IPV6" == "1" ]]; then
        echo 1 > /proc/sys/net/ipv6/conf/all/forwarding
    fi

    log_message "INFO" "IP forwarding enabled"
}

# Function to create bridge
create_bridge() {
    log_message "INFO" "Creating bridge: $BRIDGE_NAME"

    # Remove existing bridge if it exists
    if ip link show "$BRIDGE_NAME" >/dev/null 2>&1; then
        log_message "WARN" "Bridge $BRIDGE_NAME already exists, removing it"
        ip link set "$BRIDGE_NAME" down 2>/dev/null
        brctl delbr "$BRIDGE_NAME" 2>/dev/null
    fi

    # Create new bridge
    brctl addbr "$BRIDGE_NAME" || {
        log_message "ERROR" "Failed to create bridge $BRIDGE_NAME"
        return 1
    }

    # Set bridge IP
    ip addr add "$BRIDGE_IP/24" dev "$BRIDGE_NAME" || {
        log_message "ERROR" "Failed to set bridge IP $BRIDGE_IP"
        return 1
    }

    # Bring bridge up
    ip link set "$BRIDGE_NAME" up || {
        log_message "ERROR" "Failed to bring bridge up"
        return 1
    }

    BRIDGE_CREATED=1
    log_message "INFO" "Bridge $BRIDGE_NAME created successfully"
    return 0
}

# Function to add interfaces to bridge
add_interfaces_to_bridge() {
    log_message "INFO" "Adding interfaces to bridge"

    # Add input interface to bridge
    brctl addif "$BRIDGE_NAME" "$INPUT_INTERFACE" || {
        log_message "ERROR" "Failed to add $INPUT_INTERFACE to bridge"
        return 1
    }

    # Add output interface to bridge
    brctl addif "$BRIDGE_NAME" "$OUTPUT_INTERFACE" || {
        log_message "ERROR" "Failed to add $OUTPUT_INTERFACE to bridge"
        return 1
    }

    # Bring interfaces up
    ip link set "$INPUT_INTERFACE" up
    ip link set "$OUTPUT_INTERFACE" up

    log_message "INFO" "Interfaces added to bridge successfully"
    return 0
}

# Function to setup iptables rules
setup_iptables() {
    log_message "INFO" "Setting up iptables rules"

    # Clear existing rules for our chain
    iptables -t nat -F "NBR-POSTROUTING" 2>/dev/null
    iptables -t filter -F "NBR-FORWARD" 2>/dev/null
    iptables -t nat -X "NBR-POSTROUTING" 2>/dev/null
    iptables -t filter -X "NBR-FORWARD" 2>/dev/null

    # Create custom chains
    iptables -t nat -N "NBR-POSTROUTING" || true
    iptables -t filter -N "NBR-FORWARD" || true

    # NAT rules for outgoing traffic (A -> B -> C)
    iptables -t nat -A "NBR-POSTROUTING" -s "$BRIDGE_SUBNET" -o "$OUTPUT_INTERFACE" -j MASQUERADE
    IPTABLES_RULES_ADDED+=("nat -D NBR-POSTROUTING -s $BRIDGE_SUBNET -o $OUTPUT_INTERFACE -j MASQUERADE")

    # Forward rules for bidirectional traffic
    iptables -t filter -A "NBR-FORWARD" -i "$INPUT_INTERFACE" -o "$OUTPUT_INTERFACE" -j ACCEPT
    iptables -t filter -A "NBR-FORWARD" -i "$OUTPUT_INTERFACE" -o "$INPUT_INTERFACE" -j ACCEPT
    iptables -t filter -A "NBR-FORWARD" -i "$BRIDGE_NAME" -j ACCEPT
    iptables -t filter -A "NBR-FORWARD" -o "$BRIDGE_NAME" -j ACCEPT

    IPTABLES_RULES_ADDED+=("filter -D NBR-FORWARD -i $INPUT_INTERFACE -o $OUTPUT_INTERFACE -j ACCEPT")
    IPTABLES_RULES_ADDED+=("filter -D NBR-FORWARD -i $OUTPUT_INTERFACE -o $INPUT_INTERFACE -j ACCEPT")
    IPTABLES_RULES_ADDED+=("filter -D NBR-FORWARD -i $BRIDGE_NAME -j ACCEPT")
    IPTABLES_RULES_ADDED+=("filter -D NBR-FORWARD -o $BRIDGE_NAME -j ACCEPT")

    # Insert our chains into main chains
    iptables -t nat -I POSTROUTING -j "NBR-POSTROUTING"
    iptables -t filter -I FORWARD -j "NBR-FORWARD"

    IPTABLES_RULES_ADDED+=("nat -D POSTROUTING -j NBR-POSTROUTING")
    IPTABLES_RULES_ADDED+=("filter -D FORWARD -j NBR-FORWARD")

    # Add route to router C through output interface
    ip route add "$ROUTER_IP/32" dev "$OUTPUT_INTERFACE" 2>/dev/null || true

    log_message "INFO" "Iptables rules configured successfully"
    return 0
}

# Function to start DHCP/DNS server
start_dnsmasq() {
    if [[ "$ENABLE_DHCP" == "0" && "$ENABLE_DNS" == "0" ]]; then
        log_message "INFO" "DHCP and DNS disabled, skipping dnsmasq"
        return 0
    fi

    log_message "INFO" "Starting dnsmasq server"

    local dnsmasq_conf="/tmp/dnsmasq-nbr.conf"

    cat > "$dnsmasq_conf" << EOF
# Network Bridge Router dnsmasq configuration
interface=$BRIDGE_NAME
bind-interfaces
EOF

    if [[ "$ENABLE_DHCP" == "1" ]]; then
        cat >> "$dnsmasq_conf" << EOF
dhcp-range=$DHCP_RANGE_START,$DHCP_RANGE_END,12h
dhcp-option=3,$BRIDGE_IP
dhcp-option=6,$DNS_SERVERS
EOF
    fi

    if [[ "$ENABLE_DNS" == "1" ]]; then
        cat >> "$dnsmasq_conf" << EOF
server=$DNS_SERVERS
EOF
    fi

    # Start dnsmasq
    dnsmasq --conf-file="$dnsmasq_conf" --pid-file="/var/run/dnsmasq-nbr.pid" || {
        log_message "ERROR" "Failed to start dnsmasq"
        return 1
    }

    DNSMASQ_PID=$(cat "/var/run/dnsmasq-nbr.pid" 2>/dev/null)
    log_message "INFO" "Dnsmasq started successfully (PID: $DNSMASQ_PID)"
    return 0
}

# Function to cleanup on exit
cleanup() {
    if [[ "$CLEANUP_NEEDED" == "0" ]]; then
        return 0
    fi

    log_message "INFO" "Starting cleanup process"

    # Stop dnsmasq
    if [[ -n "$DNSMASQ_PID" ]] && kill -0 "$DNSMASQ_PID" 2>/dev/null; then
        log_message "INFO" "Stopping dnsmasq (PID: $DNSMASQ_PID)"
        kill "$DNSMASQ_PID" 2>/dev/null
        rm -f "/var/run/dnsmasq-nbr.pid" "/tmp/dnsmasq-nbr.conf"
    fi

    # Remove iptables rules
    log_message "INFO" "Removing iptables rules"
    for rule in "${IPTABLES_RULES_ADDED[@]}"; do
        iptables -t $rule 2>/dev/null || true
    done

    # Remove custom chains
    iptables -t nat -F "NBR-POSTROUTING" 2>/dev/null || true
    iptables -t filter -F "NBR-FORWARD" 2>/dev/null || true
    iptables -t nat -X "NBR-POSTROUTING" 2>/dev/null || true
    iptables -t filter -X "NBR-FORWARD" 2>/dev/null || true

    # Remove bridge
    if [[ "$BRIDGE_CREATED" == "1" ]] && ip link show "$BRIDGE_NAME" >/dev/null 2>&1; then
        log_message "INFO" "Removing bridge: $BRIDGE_NAME"
        ip link set "$BRIDGE_NAME" down 2>/dev/null || true
        brctl delbr "$BRIDGE_NAME" 2>/dev/null || true
    fi

    # Remove route
    ip route del "$ROUTER_IP/32" dev "$OUTPUT_INTERFACE" 2>/dev/null || true

    # Update status
    RUNNING=0
    save_status

    # Remove PID and status files
    rm -f "$PID_FILE" "$STATUS_FILE"

    # Release lock
    release_lock

    log_message "INFO" "Cleanup completed"
}

# Function to handle signals
signal_handler() {
    local signal="$1"
    log_message "INFO" "Received signal: $signal"
    cleanup
    exit 0
}

# Function to start the bridge router
start_bridge_router() {
    log_message "INFO" "Starting Network Bridge Router"

    # Validate configuration
    validate_interface "$INPUT_INTERFACE" "Input" || return 1
    validate_interface "$OUTPUT_INTERFACE" "Output" || return 1
    validate_ip "$ROUTER_IP" "Router" || return 1

    # Check if interfaces are the same
    if [[ "$INPUT_INTERFACE" == "$OUTPUT_INTERFACE" ]]; then
        log_message "ERROR" "Input and output interfaces cannot be the same"
        return 1
    fi

    # Enable IP forwarding
    enable_ip_forwarding || return 1

    # Create bridge
    create_bridge || return 1

    # Add interfaces to bridge
    add_interfaces_to_bridge || return 1

    # Setup iptables
    setup_iptables || return 1

    # Start DHCP/DNS server
    start_dnsmasq || return 1

    # Mark cleanup as needed
    CLEANUP_NEEDED=1

    # Save PID and status
    echo $$ > "$PID_FILE"
    RUNNING=1
    save_status

    log_message "INFO" "Network Bridge Router started successfully"
    log_message "INFO" "Traffic flow: Internet -> $INPUT_INTERFACE -> $BRIDGE_NAME -> $OUTPUT_INTERFACE -> Router($ROUTER_IP)"

    return 0
}

# Function to stop running instance
stop_bridge_router() {
    if load_status && [[ "$RUNNING" == "1" ]] && kill -0 "$PID" 2>/dev/null; then
        log_message "INFO" "Stopping Network Bridge Router (PID: $PID)"
        kill "$PID" 2>/dev/null

        # Wait for process to exit
        local count=0
        while kill -0 "$PID" 2>/dev/null && [[ $count -lt 10 ]]; do
            sleep 1
            ((count++))
        done

        if kill -0 "$PID" 2>/dev/null; then
            log_message "WARN" "Process did not exit gracefully, forcing termination"
            kill -9 "$PID" 2>/dev/null
        fi

        log_message "INFO" "Network Bridge Router stopped"
        return 0
    else
        log_message "INFO" "Network Bridge Router is not running"
        return 1
    fi
}

# Function to restart service
restart_bridge_router() {
    log_message "INFO" "Restarting Network Bridge Router"
    stop_bridge_router
    sleep 2
    start_bridge_router
}

# Function to install as system service
install_service() {
    if [[ ! -f "$DEBIAN_SERVICE_MANAGER" ]]; then
        log_message "ERROR" "Debian service manager not found: $DEBIAN_SERVICE_MANAGER"
        return 1
    fi

    log_message "INFO" "Installing as system service"

    # Create service script
    local service_script="/usr/local/bin/network-bridge-router-service"
    cat > "$service_script" << EOF
#!/bin/bash
# Network Bridge Router Service Script
exec "$0" -i "$INPUT_INTERFACE" -o "$OUTPUT_INTERFACE" -r "$ROUTER_IP" --daemon
EOF
    chmod +x "$service_script"

    # Install service using systemd_service_manager
    "$DEBIAN_SERVICE_MANAGER" install "$SERVICE_NAME" "$service_script" "$SERVICE_DESCRIPTION" || {
        log_message "ERROR" "Failed to install service"
        return 1
    }

    log_message "INFO" "Service installed successfully"
    log_message "INFO" "Use 'systemctl start $SERVICE_NAME' to start the service"
    return 0
}

# Function to parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                exit 0
                ;;
            --version)
                echo "$VERSION"
                exit 0
                ;;
            -i|--input)
                INPUT_INTERFACE="$2"
                shift 2
                ;;
            -o|--output)
                OUTPUT_INTERFACE="$2"
                shift 2
                ;;
            -r|--router)
                ROUTER_IP="$2"
                shift 2
                ;;
            --bridge-ip)
                BRIDGE_IP="$2"
                shift 2
                ;;
            --bridge-subnet)
                BRIDGE_SUBNET="$2"
                shift 2
                ;;
            --dhcp-range)
                IFS='-' read -r DHCP_RANGE_START DHCP_RANGE_END <<< "$2"
                shift 2
                ;;
            --dns)
                DNS_SERVERS="$2"
                shift 2
                ;;
            --no-dhcp)
                ENABLE_DHCP=0
                shift
                ;;
            --no-dns)
                ENABLE_DNS=0
                shift
                ;;
            -6|--ipv6)
                ENABLE_IPV6=1
                shift
                ;;
            --daemon)
                # Will be handled in main
                shift
                ;;
            --service)
                ENABLE_SERVICE=1
                shift
                ;;
            --status)
                show_status
                exit $?
                ;;
            --stop)
                stop_bridge_router
                exit $?
                ;;
            --restart)
                restart_bridge_router
                exit $?
                ;;
            *)
                echo "Unknown option: $1" >&2
                usage
                exit 1
                ;;
        esac
    done
}

# Main function
main() {
    # Setup signal handlers
    trap 'signal_handler SIGTERM' TERM
    trap 'signal_handler SIGINT' INT
    trap 'signal_handler SIGQUIT' QUIT
    trap 'cleanup' EXIT

    # Check if running as root
    check_root

    # Check dependencies
    check_dependencies

    # Parse arguments
    parse_arguments "$@"

    # Check if service installation was requested
    if [[ "$ENABLE_SERVICE" == "1" ]]; then
        if [[ -z "$INPUT_INTERFACE" || -z "$OUTPUT_INTERFACE" || -z "$ROUTER_IP" ]]; then
            echo "Error: Service installation requires -i, -o, and -r options" >&2
            exit 1
        fi
        install_service
        exit $?
    fi

    # Validate required parameters
    if [[ -z "$INPUT_INTERFACE" || -z "$OUTPUT_INTERFACE" || -z "$ROUTER_IP" ]]; then
        echo "Error: Missing required parameters. Use -h for help." >&2
        exit 1
    fi

    # Acquire lock
    if ! acquire_lock; then
        exit 1
    fi

    # Start the bridge router
    if start_bridge_router; then
        log_message "INFO" "Network Bridge Router is running. Press Ctrl+C to stop."

        # Keep running until interrupted
        while true; do
            sleep 10

            # Check if bridge and interfaces are still up
            if ! ip link show "$BRIDGE_NAME" >/dev/null 2>&1; then
                log_message "ERROR" "Bridge $BRIDGE_NAME is down, attempting to recreate"
                create_bridge
                add_interfaces_to_bridge
            fi
        done
    else
        log_message "ERROR" "Failed to start Network Bridge Router"
        cleanup
        exit 1
    fi
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
