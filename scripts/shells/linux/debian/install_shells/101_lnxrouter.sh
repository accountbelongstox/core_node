#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Dynamic Network Router Setup Script
# Supports keyword-based interface selection and hot-plug detection
# Author: System Administrator
# Version: 2.0

set -e

# Script identification and path setup
SCRIPT_INDEX="101"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables first
source "$PARENT_DIR_LEVEL_2/LGar.sh"

# Source common functions
COMMON_DIR="$PARENT_DIR_LEVEL_2/common"
source "${COMMON_DIR}/gvar_common.sh"

# Configuration files
CONFIG_DIR="/usr/.core_node/lnxrouter"
CONFIG_FILE="$CONFIG_DIR/config"
CACHE_FILE="$CONFIG_DIR/interface_cache.conf"
SERVICE_SCRIPT="/usr/local/bin/lnxrouter-monitor.sh"
SERVICE_NAME="lnxrouter"
SCRIPT_TEMP_DIR="/tmp/lnxrouter_$$"

# Global variables
WAN_KEYWORD=""
LAN_KEYWORD=""
WAN_INTERFACE=""
LAN_INTERFACE=""
declare -a ALL_INTERFACES=()

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Utility functions
log_info() {
    echo -e "${BLUE}[LNXROUTER][INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[LNXROUTER][SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[LNXROUTER][WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[LNXROUTER][ERROR]${NC} $1"
}

log_header() {
    echo -e "${PURPLE}========================================${NC}"
    echo -e "${WHITE} $1${NC}"
    echo -e "${PURPLE}========================================${NC}"
}

# Create configuration directory
create_config_dir() {
    if [[ ! -d "$CONFIG_DIR" ]]; then
        $USE_SUDO mkdir -p "$CONFIG_DIR"
        $USE_SUDO chmod 755 "$CONFIG_DIR"
        log_info "Created configuration directory: $CONFIG_DIR"
    fi
}

# Create temporary directory
create_temp_dir() {
    if [ ! -d "$SCRIPT_TEMP_DIR" ]; then
        $USE_SUDO mkdir -p "$SCRIPT_TEMP_DIR"
        log_info "Created temporary directory: $SCRIPT_TEMP_DIR"
    fi
}

# Scan all network interfaces
scan_interfaces() {
    log_info "Scanning all network interfaces..."

    ALL_INTERFACES=()
    echo -e "${CYAN}Available Network Interfaces:${NC}"
    echo "----------------------------------------"

    while IFS= read -r interface; do
        if [[ "$interface" != "lo" ]]; then
            ALL_INTERFACES+=("$interface")

            # Get interface information
            local ip_addr=$(ip addr show "$interface" 2>/dev/null | grep -oP 'inet \K[\d.]+' | head -1 || echo "No IP")
            local mac_addr=$(ip link show "$interface" 2>/dev/null | grep -oP 'link/ether \K[a-f0-9:]+' || echo "No MAC")
            local state=$(ip link show "$interface" 2>/dev/null | grep -oP 'state \K\w+' || echo "UNKNOWN")
            local carrier=$(cat /sys/class/net/$interface/carrier 2>/dev/null || echo "0")

            # Display interface info
            local status_color="${RED}"
            local status_text="DOWN"
            if [[ "$state" == "UP" && "$carrier" == "1" ]]; then
                status_color="${GREEN}"
                status_text="UP"
            elif [[ "$state" == "UP" ]]; then
                status_color="${YELLOW}"
                status_text="NO-CARRIER"
            fi

            printf "%-15s %s%-12s%s IP:%-15s MAC:%s\n" \
                "$interface" "$status_color" "$status_text" "$NC" "$ip_addr" "$mac_addr"
        fi
    done < <(ls /sys/class/net/)

    echo "----------------------------------------"
    log_success "Found ${#ALL_INTERFACES[@]} network interfaces"
}

# Load cached configuration
load_cache() {
    if [[ -f "$CACHE_FILE" ]]; then
        log_info "Loading cached configuration from: $CACHE_FILE"
        source "$CACHE_FILE"

        if [[ -n "$WAN_KEYWORD" && -n "$LAN_KEYWORD" ]]; then
            log_success "Found cached keywords:"
            log_info "  WAN Keyword: $WAN_KEYWORD"
            log_info "  LAN Keyword: $LAN_KEYWORD"

            # Show current matches for cached keywords
            echo -e "${CYAN}Current matches for cached keywords:${NC}"

            # Check WAN matches
            local wan_matches=($(find_interface_by_keyword "$WAN_KEYWORD"))
            if [[ ${#wan_matches[@]} -gt 0 ]]; then
                echo -e "${GREEN}WAN keyword '$WAN_KEYWORD' matches:${NC}"
                for interface in "${wan_matches[@]}"; do
                    local state=$(cat /sys/class/net/$interface/operstate 2>/dev/null || echo "unknown")
                    local carrier=$(cat /sys/class/net/$interface/carrier 2>/dev/null || echo "0")
                    local status_color="${RED}"
                    local status_text="DOWN"

                    if [[ "$state" == "up" && "$carrier" == "1" ]]; then
                        status_color="${GREEN}"
                        status_text="UP"
                    elif [[ "$state" == "up" ]]; then
                        status_color="${YELLOW}"
                        status_text="NO-CARRIER"
                    fi

                    echo -e "  - $interface (${status_color}${status_text}${NC})"
                done
            else
                echo -e "${RED}WAN keyword '$WAN_KEYWORD' matches: None${NC}"
            fi

            # Check LAN matches
            local lan_matches=($(find_interface_by_keyword "$LAN_KEYWORD"))
            if [[ ${#lan_matches[@]} -gt 0 ]]; then
                echo -e "${GREEN}LAN keyword '$LAN_KEYWORD' matches:${NC}"
                for interface in "${lan_matches[@]}"; do
                    local state=$(cat /sys/class/net/$interface/operstate 2>/dev/null || echo "unknown")
                    local carrier=$(cat /sys/class/net/$interface/carrier 2>/dev/null || echo "0")
                    local status_color="${RED}"
                    local status_text="DOWN"

                    if [[ "$state" == "up" && "$carrier" == "1" ]]; then
                        status_color="${GREEN}"
                        status_text="UP"
                    elif [[ "$state" == "up" ]]; then
                        status_color="${YELLOW}"
                        status_text="NO-CARRIER"
                    fi

                    echo -e "  - $interface (${status_color}${status_text}${NC})"
                done
            else
                echo -e "${RED}LAN keyword '$LAN_KEYWORD' matches: None${NC}"
            fi

            echo -e "${YELLOW}Use cached configuration? (y/n/r for reconfigure):${NC}"
            read -n 1 -r response
            echo

            case "$response" in
                [Yy]* )
                    log_info "Using cached configuration"
                    return 0
                    ;;
                [Rr]* )
                    log_info "Reconfiguring keywords"
                    WAN_KEYWORD=""
                    LAN_KEYWORD=""
                    return 1
                    ;;
                * )
                    log_info "Skipping cached configuration"
                    WAN_KEYWORD=""
                    LAN_KEYWORD=""
                    return 1
                    ;;
            esac
        fi
    fi
    return 1
}

# Save configuration to cache
save_cache() {
    $USE_SUDO tee "$CACHE_FILE" > /dev/null << EOF
# LnxRouter Configuration Cache
WAN_KEYWORD="$WAN_KEYWORD"
LAN_KEYWORD="$LAN_KEYWORD"
WAN_INTERFACE="$WAN_INTERFACE"
LAN_INTERFACE="$LAN_INTERFACE"
EOF
    $USE_SUDO chmod 644 "$CACHE_FILE"
    log_info "Configuration saved to cache: $CACHE_FILE"
}

# Find interface by keyword
find_interface_by_keyword() {
    local keyword="$1"
    local found_interfaces=()

    for interface in "${ALL_INTERFACES[@]}"; do
        if [[ "$interface" == *"$keyword"* ]]; then
            found_interfaces+=("$interface")
        fi
    done

    echo "${found_interfaces[@]}"
}

# Input keywords for interface matching
input_keywords() {
    if [[ -z "$WAN_KEYWORD" ]]; then
        while true; do
            echo -e "${CYAN}Enter keyword for WAN interface (external/internet connection):${NC}"
            echo -e "${YELLOW}Examples: usb, wlan, eth0, enp, wlp${NC}"
            read -p "WAN Keyword: " WAN_KEYWORD

            if [[ -z "$WAN_KEYWORD" ]]; then
                log_error "WAN keyword cannot be empty"
                continue
            fi

            # Check if keyword matches any interface
            local matched_interfaces=($(find_interface_by_keyword "$WAN_KEYWORD"))

            if [[ ${#matched_interfaces[@]} -eq 0 ]]; then
                log_error "No interface found matching keyword: $WAN_KEYWORD"
                echo -e "${YELLOW}Available interfaces: ${ALL_INTERFACES[*]}${NC}"
                WAN_KEYWORD=""
                continue
            fi

            echo -e "${GREEN}Found ${#matched_interfaces[@]} interface(s) matching '$WAN_KEYWORD':${NC}"
            for interface in "${matched_interfaces[@]}"; do
                local state=$(cat /sys/class/net/$interface/operstate 2>/dev/null || echo "unknown")
                local carrier=$(cat /sys/class/net/$interface/carrier 2>/dev/null || echo "0")
                local status_color="${RED}"
                local status_text="DOWN"

                if [[ "$state" == "up" && "$carrier" == "1" ]]; then
                    status_color="${GREEN}"
                    status_text="UP"
                elif [[ "$state" == "up" ]]; then
                    status_color="${YELLOW}"
                    status_text="NO-CARRIER"
                fi

                echo -e "  - $interface (${status_color}${status_text}${NC})"
            done

            echo -e "${YELLOW}Use keyword '$WAN_KEYWORD' for WAN interface? (y/n):${NC}"
            read -n 1 -r confirm
            echo

            if [[ "$confirm" =~ ^[Yy]$ ]]; then
                break
            else
                WAN_KEYWORD=""
            fi
        done
    fi

    if [[ -z "$LAN_KEYWORD" ]]; then
        while true; do
            echo -e "${CYAN}Enter keyword for LAN interface (internal network):${NC}"
            echo -e "${YELLOW}Examples: eth, enp, eno, lan${NC}"
            read -p "LAN Keyword: " LAN_KEYWORD

            if [[ -z "$LAN_KEYWORD" ]]; then
                log_error "LAN keyword cannot be empty"
                continue
            fi

            # Check if keyword matches any interface (excluding WAN matches)
            local matched_interfaces=($(find_interface_by_keyword "$LAN_KEYWORD"))
            local filtered_interfaces=()
            local wan_matched_interfaces=($(find_interface_by_keyword "$WAN_KEYWORD"))

            # Filter out interfaces that are already matched by WAN keyword
            for interface in "${matched_interfaces[@]}"; do
                local is_wan_match=false
                for wan_interface in "${wan_matched_interfaces[@]}"; do
                    if [[ "$interface" == "$wan_interface" ]]; then
                        is_wan_match=true
                        break
                    fi
                done

                if [[ "$is_wan_match" == false ]]; then
                    filtered_interfaces+=("$interface")
                fi
            done

            if [[ ${#filtered_interfaces[@]} -eq 0 ]]; then
                log_error "No interface found matching keyword: $LAN_KEYWORD (excluding WAN matches)"
                echo -e "${YELLOW}Available interfaces: ${ALL_INTERFACES[*]}${NC}"
                echo -e "${YELLOW}WAN keyword '$WAN_KEYWORD' will be excluded from LAN matches${NC}"
                LAN_KEYWORD=""
                continue
            fi

            echo -e "${GREEN}Found ${#filtered_interfaces[@]} interface(s) matching '$LAN_KEYWORD':${NC}"
            for interface in "${filtered_interfaces[@]}"; do
                local state=$(cat /sys/class/net/$interface/operstate 2>/dev/null || echo "unknown")
                local carrier=$(cat /sys/class/net/$interface/carrier 2>/dev/null || echo "0")
                local status_color="${RED}"
                local status_text="DOWN"

                if [[ "$state" == "up" && "$carrier" == "1" ]]; then
                    status_color="${GREEN}"
                    status_text="UP"
                elif [[ "$state" == "up" ]]; then
                    status_color="${YELLOW}"
                    status_text="NO-CARRIER"
                fi

                echo -e "  - $interface (${status_color}${status_text}${NC})"
            done

            echo -e "${YELLOW}Use keyword '$LAN_KEYWORD' for LAN interface? (y/n):${NC}"
            read -n 1 -r confirm
            echo

            if [[ "$confirm" =~ ^[Yy]$ ]]; then
                break
            else
                LAN_KEYWORD=""
            fi
        done
    fi

    log_success "Keywords configured:"
    log_info "  WAN: $WAN_KEYWORD"
    log_info "  LAN: $LAN_KEYWORD"

    return 0
}

# Match interfaces based on keywords
match_interfaces() {
    log_info "Matching interfaces with keywords..."

    WAN_INTERFACE=""
    LAN_INTERFACE=""

    # Find WAN interface
    for interface in "${ALL_INTERFACES[@]}"; do
        if [[ "$interface" == *"$WAN_KEYWORD"* ]]; then
            WAN_INTERFACE="$interface"
            log_success "WAN interface matched: $interface (keyword: $WAN_KEYWORD)"
            break
        fi
    done

    # Find LAN interface
    for interface in "${ALL_INTERFACES[@]}"; do
        if [[ "$interface" == *"$LAN_KEYWORD"* && "$interface" != "$WAN_INTERFACE" ]]; then
            LAN_INTERFACE="$interface"
            log_success "LAN interface matched: $interface (keyword: $LAN_KEYWORD)"
            break
        fi
    done

    # Validate matches
    if [[ -z "$WAN_INTERFACE" ]]; then
        log_error "No interface found matching WAN keyword: $WAN_KEYWORD"
        log_info "Available interfaces: ${ALL_INTERFACES[*]}"
        return 1
    fi

    if [[ -z "$LAN_INTERFACE" ]]; then
        log_error "No interface found matching LAN keyword: $LAN_KEYWORD"
        log_info "Available interfaces: ${ALL_INTERFACES[*]}"
        return 1
    fi

    log_success "Interface matching completed:"
    log_info "  WAN: $WAN_INTERFACE"
    log_info "  LAN: $LAN_INTERFACE"

    # Save configuration
    save_cache

    return 0
}

# Create dynamic router service script
create_service_script() {
    log_info "Creating dynamic router monitoring script..."

    $USE_SUDO cat > "$SERVICE_SCRIPT" << EOF
#!/bin/bash
# Dynamic Linux Router Monitor
# Monitors interface availability and manages routing

# Configuration
WAN_KEYWORD=""
LAN_KEYWORD=""
WAN_INTERFACE=""
LAN_INTERFACE=""
CONFIG_FILE="$CONFIG_FILE"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log_service() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')][LNXROUTER-SERVICE]${NC} $1" | tee -a /var/log/lnxrouter.log
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')][LNXROUTER-ERROR]${NC} $1" | tee -a /var/log/lnxrouter.log
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')][LNXROUTER-SUCCESS]${NC} $1" | tee -a /var/log/lnxrouter.log
}

# Load configuration
load_config() {
    if [[ -f "$CONFIG_FILE" ]]; then
        source "$CONFIG_FILE"
        log_service "Configuration loaded: WAN=\$WAN_KEYWORD, LAN=\$LAN_KEYWORD"
        return 0
    else
        log_error "Configuration file not found: \$CONFIG_FILE"
        return 1
    fi
}

# Check if interface exists and is up
check_interface() {
    local interface="$1"
    if [[ -d "/sys/class/net/$interface" ]]; then
        local state=$(cat /sys/class/net/$interface/operstate 2>/dev/null || echo "down")
        local carrier=$(cat /sys/class/net/$interface/carrier 2>/dev/null || echo "0")

        if [[ "$state" == "up" && "$carrier" == "1" ]]; then
            return 0
        fi
    fi
    return 1
}

# Find interface by keyword
find_interface() {
    local keyword="\$1"
    for interface in /sys/class/net/*; do
        interface=\$(basename "\$interface")
        if [[ "\$interface" != "lo" && "\$interface" == *"\$keyword"* ]]; then
            echo "\$interface"
            return 0
        fi
    done
    return 1
}

# Setup routing rules
setup_routing() {
    local wan_if="\$1"
    local lan_if="\$2"

    log_service "Setting up routing: \$wan_if -> \$lan_if"

    # Enable IP forwarding
    echo 1 > /proc/sys/net/ipv4/ip_forward

    # Clear existing rules
    iptables -F FORWARD 2>/dev/null || true
    iptables -t nat -F POSTROUTING 2>/dev/null || true

    # Setup NAT
    iptables -t nat -A POSTROUTING -o "\$wan_if" -j MASQUERADE

    # Setup forwarding
    iptables -A FORWARD -i "\$lan_if" -o "\$wan_if" -j ACCEPT
    iptables -A FORWARD -i "\$wan_if" -o "\$lan_if" -m state --state RELATED,ESTABLISHED -j ACCEPT

    log_success "Routing rules applied successfully"
}

# Remove routing rules
remove_routing() {
    log_service "Removing routing rules..."

    # Clear NAT rules
    iptables -t nat -F POSTROUTING 2>/dev/null || true
    iptables -F FORWARD 2>/dev/null || true

    log_service "Routing rules removed"
}

# Main monitoring loop
monitor_interfaces() {
    local routing_active=false
    local current_wan=""
    local current_lan=""

    while true; do
        # Find current interfaces
        local wan_if=\$(find_interface "\$WAN_KEYWORD")
        local lan_if=\$(find_interface "\$LAN_KEYWORD")

        # Check if both interfaces are available and up
        if [[ -n "\$wan_if" ]] && [[ -n "\$lan_if" ]] && check_interface "\$wan_if" && check_interface "\$lan_if"; then
            if [[ "\$routing_active" == false ]] || [[ "\$wan_if" != "\$current_wan" ]] || [[ "\$lan_if" != "\$current_lan" ]]; then
                log_success "Interfaces available: WAN=\$wan_if, LAN=\$lan_if"
                setup_routing "\$wan_if" "\$lan_if"
                routing_active=true
                current_wan="\$wan_if"
                current_lan="\$lan_if"
            fi
        else
            if [[ "\$routing_active" == true ]]; then
                log_error "Interface unavailable - WAN: \$wan_if, LAN: \$lan_if"
                remove_routing
                routing_active=false
                current_wan=""
                current_lan=""
            fi
        fi

        sleep 5
    done
}

# Main execution
log_service "Starting LnxRouter monitor..."

# Load configuration
if ! load_config; then
    log_error "Failed to load configuration, exiting..."
    exit 1
fi

# Start monitoring
log_service "Starting interface monitoring..."
monitor_interfaces
EOF

    $USE_SUDO chmod +x "$SERVICE_SCRIPT"
    log_success "Service script created: $SERVICE_SCRIPT"
}

# Create systemd service using debian_service_manager.sh
create_systemd_service() {
    log_info "Creating systemd service using debian_service_manager.sh..."

    local service_manager="$PARENT_DIR_LEVEL_2/common/debian_service_manager.sh"

    if [[ ! -f "$service_manager" ]]; then
        log_error "Service manager not found: $service_manager"
        return 1
    fi

    # Call service manager to create service
    # Syntax: create SCRIPT_PATH [NAME] [DESCRIPTION] [CPU_LIMIT] [MEMORY_LIMIT]
    log_info "Creating service with root privileges..."
    if $USE_SUDO bash "$service_manager" create "$SERVICE_SCRIPT" "$SERVICE_NAME" "Dynamic Linux Router Service" "10%" "100M"; then
        log_success "Service created successfully"

        # The service is automatically enabled by debian_service_manager.sh
        # Start the service (note: debian_service_manager adds 'ncore-' prefix)
        local full_service_name="ncore-$SERVICE_NAME"
        log_info "Starting $full_service_name service..."
        if $USE_SUDO systemctl start "$full_service_name"; then
            log_success "Service started successfully"

            # Show service status
            log_info "Service status:"
            $USE_SUDO systemctl status "$full_service_name" --no-pager -l | head -10
        else
            log_error "Failed to start service"
            return 1
        fi

        return 0
    else
        log_error "Failed to create service"
        return 1
    fi
}













# Main function
main() {
    log_header "Dynamic Linux Router Setup"

    # Create configuration directory
    create_config_dir

    # Create temporary directory
    create_temp_dir

    # Scan all interfaces
    scan_interfaces

    # Try to load cached configuration
    if ! load_cache; then
        # Input keywords if not cached or user chose to reconfigure
        while ! input_keywords; do
            log_warning "Please try again with valid keywords"
        done
    fi

    # Match interfaces with keywords
    while ! match_interfaces; do
        log_warning "Interface matching failed, please reconfigure keywords"
        WAN_KEYWORD=""
        LAN_KEYWORD=""
        while ! input_keywords; do
            log_warning "Please try again with valid keywords"
        done
    done

    # Create service script
    create_service_script

    # Create and install systemd service
    if create_systemd_service; then
        log_success "Dynamic router service installed successfully!"
        log_info "Service name: $SERVICE_NAME"
        log_info "Service script: $SERVICE_SCRIPT"
        log_info "Configuration: $CACHE_FILE"

        echo -e "${CYAN}Service Status:${NC}"
        $USE_SUDO systemctl status "$SERVICE_NAME" --no-pager -l

        echo -e "${YELLOW}The service will monitor interface availability and automatically:"
        echo -e "  - Enable routing when both WAN ($WAN_KEYWORD) and LAN ($LAN_KEYWORD) interfaces are available"
        echo -e "  - Disable routing when interfaces are disconnected"
        echo -e "  - Log activities to /var/log/lnxrouter.log${NC}"

        echo -e "${GREEN}Setup completed successfully!${NC}"
    else
        log_error "Failed to install service"
        exit 1
    fi
}

# Run main function
main "$@"
