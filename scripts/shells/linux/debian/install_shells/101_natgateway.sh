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

# Dynamic Network Router Setup Script
# Supports keyword-based interface selection and hot-plug detection
# Optimized for Ubuntu 22.04 and 24.04
# Author: System Administrator
# Version: 3.0

set -e

# Trap to clean up on error
trap 'log_error "Script interrupted or failed at line $LINENO"' ERR

# Script identification and path setup
SCRIPT_INDEX="101"
# IMPORTANT: Resolve symlink to get the real script path
# This ensures relative paths work correctly when script is run via /usr/local/bin/natgateway
REAL_SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "$REAL_SCRIPT_PATH")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables first
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# Source common functions
COMMON_DIR="$PARENT_DIR_LEVEL_2/common"
DEBIAN_COM_DIR="$PARENT_DIR_LEVEL_1/debian_com"

# Configuration files
CORE_NODE_DATA_DIR="${CORE_NODE_DATA_DIR:-/var/_core_node}"
CONFIG_DIR="${CORE_NODE_DATA_DIR}/natgateway"
CONFIG_FILE="$CONFIG_DIR/config"
CACHE_FILE="$CONFIG_DIR/interface_cache.conf"
NATGATEWAY_LINK="/usr/local/bin/natgateway"
SERVICE_SCRIPT="/usr/local/bin/natgateway-monitor.sh"
SERVICE_NAME="natgateway"
SCRIPT_TEMP_DIR="${CORE_NODE_DATA_DIR}/tmp/natgateway_$$"

# Global variables
WAN_KEYWORD=""
LAN_KEYWORD=""
WAN_INTERFACE=""
LAN_INTERFACE=""
SYSTEM_SHARING="no"
IS_WSL_MODE=false
IS_INSTALLED=false
declare -a ALL_INTERFACES=()

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Function-specific variables (declared here for clarity, used in functions below)
link_target=""
current_script=""
interface_count=0
ip_addr=""
mac_addr=""
state=""
carrier=""
status_color=""
status_text=""
wan_matches=""
lan_matches=""
matched_interfaces=""
filtered_interfaces=""
wan_matched_interfaces=""
is_wan_match=""
confirm=""
sharing_response=""
response=""
install_response=""
option=""
keyword=""
found_interfaces=""
existing_target=""
full_service_name=""
service_manager=""
wan_if=""
lan_if=""
routing_active=false
current_wan=""
current_lan=""
interface=""
wan_interface=""

# =============================================================================
# Utility Functions
# =============================================================================
log_info() {
    echo -e "${BLUE}[NATGATEWAY][INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[NATGATEWAY][SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[NATGATEWAY][WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[NATGATEWAY][ERROR]${NC} $1"
}

log_header() {
    echo -e "${PURPLE}========================================${NC}"
    echo -e "${WHITE} $1${NC}"
    echo -e "${PURPLE}========================================${NC}"
}

# Check if WSL
check_wsl_mode() {
    if [ "$IS_WSL" = true ]; then
        IS_WSL_MODE=true
        log_warning "Running in WSL Test Mode"
        log_info "This is a test environment, but installation will continue"
        return 0
    fi
    IS_WSL_MODE=false
    return 0
}

# Check if a command exists (including in /usr/sbin/)
command_exists() {
    local cmd="$1"
    # First try command -v (checks PATH)
    if command -v "$cmd" >/dev/null 2>&1; then
        return 0
    fi
    # Also check common system paths that might not be in PATH
    local system_paths=("/usr/sbin/$cmd" "/sbin/$cmd" "/usr/bin/$cmd" "/bin/$cmd")
    for path in "${system_paths[@]}"; do
        if [ -x "$path" ]; then
            return 0
        fi
    done
    return 1
}

# Check system dependencies
check_dependencies() {
    local missing_deps=()
    local required_commands=("ip" "iptables" "systemctl" "awk" "grep")
    
    # Map commands to their package names
    declare -A cmd_to_pkg=(
        ["ip"]="iproute2"
        ["iptables"]="iptables"
        ["systemctl"]="systemd"
        ["awk"]="gawk"
        ["grep"]="grep"
    )
    
    # Check which commands are missing
    local missing_packages=()
    for cmd in "${required_commands[@]}"; do
        if ! command_exists "$cmd"; then
            missing_deps+=("$cmd")
            missing_packages+=("${cmd_to_pkg[$cmd]}")
        fi
    done

    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_warning "Missing required commands: ${missing_deps[*]}"
        log_info "Attempting to install required packages: ${missing_packages[*]}"
        
        # Check if we have apt package manager (Ubuntu/Debian)
        if ! command -v apt >/dev/null 2>&1 && ! command -v apt-get >/dev/null 2>&1; then
            log_error "Cannot auto-install: apt/apt-get not found"
            log_error "Please install required packages manually:"
            log_error "  Ubuntu/Debian: sudo apt install ${missing_packages[*]}"
            return 1
        fi
        
        # Check if we have root privileges or sudo
        local install_prefix=""
        local install_cmd_display=""
        if [[ $EUID -ne 0 ]]; then
            if ! command -v sudo >/dev/null 2>&1; then
                log_error "Cannot auto-install: root privileges or sudo required"
                log_error "Please install required packages manually:"
                log_error "  sudo apt install ${missing_packages[*]}"
                return 1
            fi
            install_prefix="sudo "
            install_cmd_display="sudo apt-get"
        else
            install_cmd_display="apt-get"
        fi
        
        # Update package list
        log_info "Updating package list..."
        if ! ${install_prefix}apt-get update -qq >/dev/null 2>&1; then
            log_error "Failed to update package list"
            log_error "Please run manually: $install_cmd_display update"
            return 1
        fi
        
        # Install missing packages
        log_info "Installing packages: ${missing_packages[*]}"
        if ! ${install_prefix}apt-get install -y ${missing_packages[*]} >/dev/null 2>&1; then
            log_error "Failed to install packages"
            log_error "Please install manually: $install_cmd_display install -y ${missing_packages[*]}"
            return 1
        fi
        
        # Verify installation
        log_info "Verifying installation..."
        local still_missing=()
        for cmd in "${missing_deps[@]}"; do
            if ! command_exists "$cmd"; then
                still_missing+=("$cmd")
            fi
        done
        
        if [ ${#still_missing[@]} -gt 0 ]; then
            log_error "Some commands are still missing after installation: ${still_missing[*]}"
            log_error "Please install manually: $install_cmd_display install -y ${missing_packages[*]}"
            return 1
        fi
        
        log_success "All dependencies installed successfully"
        return 0
    fi

    return 0
}

# Check root/sudo permissions
check_permissions() {
    if [[ $EUID -ne 0 ]] && [[ -z "$USE_SUDO" ]]; then
        log_error "This script requires root privileges or sudo"
        log_error "Please run with: sudo bash $0"
        return 1
    fi
    return 0
}

# Check if already installed
check_installation() {
    if [ -f "$NATGATEWAY_LINK" ] && [ -L "$NATGATEWAY_LINK" ]; then
        local link_target=$(readlink -f "$NATGATEWAY_LINK")
        local current_script=$(readlink -f "${BASH_SOURCE[0]}")

        if [ "$link_target" = "$current_script" ]; then
            IS_INSTALLED=true
            log_success "NAT Gateway is already installed"
            return 0
        fi
    fi
    IS_INSTALLED=false
    return 1
}

# Validate configuration file
validate_config_file() {
    if [[ ! -f "$CACHE_FILE" ]]; then
        return 1
    fi

    local required_vars=("WAN_KEYWORD" "LAN_KEYWORD" "SYSTEM_SHARING")
    local missing_vars=()

    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$CACHE_FILE" 2>/dev/null; then
            missing_vars+=("$var")
        fi
    done

    if [ ${#missing_vars[@]} -gt 0 ]; then
        log_warning "Configuration file is incomplete or corrupted"
        log_warning "Missing variables: ${missing_vars[*]}"
        return 1
    fi

    return 0
}

# Create configuration directory
create_config_dir() {
    if [[ ! -d "$CONFIG_DIR" ]]; then
        if ! $USE_SUDO mkdir -p "$CONFIG_DIR" 2>/dev/null; then
            log_error "Failed to create configuration directory: $CONFIG_DIR"
            log_error "Please check permissions and disk space"
            return 1
        fi
        $USE_SUDO chmod 755 "$CONFIG_DIR"
        log_info "Created configuration directory: $CONFIG_DIR"
    fi

    if [[ ! -w "$CONFIG_DIR" ]] && [[ -z "$USE_SUDO" ]]; then
        log_error "Configuration directory is not writable: $CONFIG_DIR"
        return 1
    fi

    return 0
}

# Create temporary directory
create_temp_dir() {
    local temp_base_dir="${CORE_NODE_DATA_DIR}/tmp"
    
    # Ensure base temp directory exists
    if [ ! -d "$temp_base_dir" ]; then
        if ! $USE_SUDO mkdir -p "$temp_base_dir" 2>/dev/null; then
            log_error "Failed to create base temporary directory: $temp_base_dir"
            return 1
        fi
        $USE_SUDO chmod 755 "$temp_base_dir"
    fi
    
    # Create script-specific temp directory
    if [ ! -d "$SCRIPT_TEMP_DIR" ]; then
        if ! $USE_SUDO mkdir -p "$SCRIPT_TEMP_DIR" 2>/dev/null; then
            log_error "Failed to create temporary directory: $SCRIPT_TEMP_DIR"
            return 1
        fi
        $USE_SUDO chmod 700 "$SCRIPT_TEMP_DIR"
        log_info "Created temporary directory: $SCRIPT_TEMP_DIR"
    fi
    return 0
}

# Cleanup old lnxrouter installation (migration from old version)
cleanup_old_lnxrouter() {
    log_info "Checking for old lnxrouter installation..."
    
    local old_service_name="ncore-lnxrouter"
    local old_command_link="/usr/local/bin/lnxrouter"
    local old_service_script="/usr/local/bin/lnxrouter-monitor.sh"
    local found_old_installation=false
    
    # Check and remove old service
    if systemctl list-units --full --all 2>/dev/null | grep -q "$old_service_name"; then
        found_old_installation=true
        log_info "Found old service: $old_service_name"
        log_info "Stopping old service..."
        $USE_SUDO systemctl stop "$old_service_name" 2>/dev/null || true
        sleep 1
        
        log_info "Disabling old service..."
        $USE_SUDO systemctl disable "$old_service_name" 2>/dev/null || true
        
        # Remove service unit file
        local service_unit_file="/etc/systemd/system/${old_service_name}.service"
        if [ -f "$service_unit_file" ]; then
            log_info "Removing old service unit file: $service_unit_file"
            $USE_SUDO rm -f "$service_unit_file" 2>/dev/null || true
        fi
        
        # Reload systemd
        $USE_SUDO systemctl daemon-reload 2>/dev/null || true
        
        log_success "Old service removed: $old_service_name"
    fi
    
    # Check and remove old service script
    if [ -f "$old_service_script" ]; then
        found_old_installation=true
        log_info "Found old service script: $old_service_script"
        log_info "Removing old service script..."
        $USE_SUDO rm -f "$old_service_script" 2>/dev/null || true
        log_success "Old service script removed"
    fi
    
    # Check and remove old command link
    if [ -L "$old_command_link" ] || [ -f "$old_command_link" ]; then
        found_old_installation=true
        log_info "Found old command link: $old_command_link"
        log_info "Removing old command link..."
        $USE_SUDO rm -f "$old_command_link" 2>/dev/null || true
        log_success "Old command link removed"
    fi
    
    # Check for old log file (optional - keep or remove)
    local old_log_file="/var/log/lnxrouter.log"
    if [ -f "$old_log_file" ]; then
        log_info "Found old log file: $old_log_file"
        log_info "Archiving old log file (keeping for reference)..."
        # Optionally move to archive location or remove
        # $USE_SUDO mv "$old_log_file" "${old_log_file}.old" 2>/dev/null || true
    fi
    
    if [ "$found_old_installation" == true ]; then
        log_success "Old lnxrouter installation cleaned up successfully"
        log_info "Migration from lnxrouter to natgateway completed"
    else
        log_info "No old lnxrouter installation found"
    fi
    
    return 0
}

# Cleanup function for installation rollback
cleanup_on_failure() {
    log_warning "Installation failed, cleaning up..."

    # Stop and remove service if it was created
    local full_service_name="ncore-$SERVICE_NAME"
    if systemctl list-units --full --all | grep -q "$full_service_name"; then
        log_info "Stopping and removing service..."
        $USE_SUDO systemctl stop "$full_service_name" 2>/dev/null || true
        $USE_SUDO systemctl disable "$full_service_name" 2>/dev/null || true
    fi

    # Remove service script
    if [ -f "$SERVICE_SCRIPT" ]; then
        log_info "Removing service script..."
        $USE_SUDO rm -f "$SERVICE_SCRIPT" 2>/dev/null || true
    fi

    # NOTE: We keep the natgateway command link even on failure
    # So users can run 'natgateway' to reconfigure later
    if [ -L "$NATGATEWAY_LINK" ]; then
        log_info "Keeping natgateway command link for future use..."
        log_info "You can run 'natgateway' later to complete setup"
    fi

    # Clean temporary directory
    if [ -d "$SCRIPT_TEMP_DIR" ]; then
        log_info "Cleaning temporary directory..."
        $USE_SUDO rm -rf "$SCRIPT_TEMP_DIR" 2>/dev/null || true
    fi

    log_warning "Cleanup completed"
    log_info "The 'natgateway' command is still available - run it to retry setup"
}

# Scan all network interfaces
scan_interfaces() {
    log_info "Scanning all network interfaces..."

    ALL_INTERFACES=()
    echo -e "${CYAN}Available Network Interfaces:${NC}"
    echo "----------------------------------------"

    interface_count=0

    # Use ip command to get all interfaces (most reliable method)
    while IFS= read -r line; do
        # Extract interface name from lines like "2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP>"
        interface=$(echo "$line" | awk -F': ' '{print $2}')

        if [[ -n "$interface" && "$interface" != "lo" ]]; then
            ALL_INTERFACES+=("$interface")
            interface_count=$((interface_count + 1))

            # Get interface information
            ip_addr=$(ip addr show "$interface" 2>/dev/null | grep -oP 'inet \K[\d.]+' | head -1 || echo "No IP")
            mac_addr=$(echo "$line" | grep -oP 'link/ether \K[a-f0-9:]+' || ip link show "$interface" 2>/dev/null | grep -oP 'link/ether \K[a-f0-9:]+' || echo "No MAC")
            state=$(echo "$line" | grep -oP 'state \K\w+' || echo "UNKNOWN")

            # Get interface status using the same logic as get_interface_status()
            status_result=$(get_interface_status "$interface")
            status_color=$(echo "$status_result" | cut -d'|' -f1)
            status_text=$(echo "$status_result" | cut -d'|' -f2)

            printf "%-15s ${status_color}%-12s${NC} IP:%-15s MAC:%s\n" \
                "$interface" "$status_text" "$ip_addr" "$mac_addr"
        fi
    done < <(ip link show 2>/dev/null)

    echo "----------------------------------------"
    log_success "Found ${#ALL_INTERFACES[@]} network interfaces"

    if [ ${#ALL_INTERFACES[@]} -eq 0 ]; then
        log_error "No network interfaces found!"
        log_warning "This system may not have any network interfaces configured."
        log_warning "NAT Gateway requires at least 2 network interfaces (WAN and LAN)."
        echo ""
        echo "Press Enter to exit..."
        read
        exit 1
    fi
}

# Load cached configuration
load_cache() {
    if [[ -f "$CACHE_FILE" ]]; then
        log_info "Loading cached configuration from: $CACHE_FILE"

        if ! validate_config_file; then
            log_error "Configuration file validation failed"
            return 1
        fi

        if ! source "$CACHE_FILE" 2>/dev/null; then
            log_error "Failed to load configuration file: $CACHE_FILE"
            log_error "File may be corrupted"
            return 1
        fi

        if [[ -n "$WAN_KEYWORD" && -n "$LAN_KEYWORD" ]]; then
            log_success "Found cached keywords:"
            log_info "  WAN Keyword: $WAN_KEYWORD"
            log_info "  LAN Keyword: $LAN_KEYWORD"
            log_info "  System Sharing: $SYSTEM_SHARING"

            echo -e "${CYAN}Current matches for cached keywords:${NC}"

            # Check WAN matches
            local wan_matches=($(find_interface_by_keyword "$WAN_KEYWORD"))
            if [[ ${#wan_matches[@]} -gt 0 ]]; then
                echo -e "${GREEN}WAN keyword '$WAN_KEYWORD' matches:${NC}"
                for interface in "${wan_matches[@]}"; do
                    status_result=$(get_interface_status "$interface")
                    status_color=$(echo "$status_result" | cut -d'|' -f1)
                    status_text=$(echo "$status_result" | cut -d'|' -f2)
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
                    status_result=$(get_interface_status "$interface")
                    status_color=$(echo "$status_result" | cut -d'|' -f1)
                    status_text=$(echo "$status_result" | cut -d'|' -f2)
                    echo -e "  - $interface (${status_color}${status_text}${NC})"
                done
            else
                echo -e "${RED}LAN keyword '$LAN_KEYWORD' matches: None${NC}"
            fi

            return 0
        fi
    fi
    return 1
}

# Save configuration to cache
save_cache() {
    $USE_SUDO tee "$CACHE_FILE" > /dev/null << EOF
# NAT Gateway Configuration Cache
WAN_KEYWORD="$WAN_KEYWORD"
LAN_KEYWORD="$LAN_KEYWORD"
WAN_INTERFACE="$WAN_INTERFACE"
LAN_INTERFACE="$LAN_INTERFACE"
SYSTEM_SHARING="$SYSTEM_SHARING"
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

# Get interface status (returns status_color and status_text)
get_interface_status() {
    local interface="$1"
    local state=""
    local carrier=""
    local ip_link_state=""
    local has_ip="no"
    local status_color="${RED}"
    local status_text="OFFLINE"
    
    if [[ -n "$interface" ]]; then
        state=$(cat /sys/class/net/$interface/operstate 2>/dev/null || echo "unknown")
        carrier=$(cat /sys/class/net/$interface/carrier 2>/dev/null || echo "0")
        
        # Check if interface has IP address (more reliable indicator)
        if ip addr show "$interface" 2>/dev/null | grep -q "inet "; then
            has_ip="yes"
        fi
        
        # Check ip link show output for UP flag (more reliable than operstate for USB/virtual interfaces)
        ip_link_state=$(ip link show "$interface" 2>/dev/null | grep -oE "<[^>]*>" | head -1)
        
        # Interface is considered ONLINE if:
        # 1. operstate is "up" AND carrier is "1", OR
        # 2. ip link shows UP flag AND (carrier is "1" OR has IP address), OR
        # 3. has IP address AND carrier is "1" (for USB/virtual interfaces with unknown operstate)
        if [[ "$state" == "up" && "$carrier" == "1" ]]; then
            status_color="${GREEN}"
            status_text="ONLINE"
        elif [[ "$ip_link_state" == *"UP"* ]] && ([[ "$carrier" == "1" ]] || [[ "$has_ip" == "yes" ]]); then
            status_color="${GREEN}"
            status_text="ONLINE"
        elif [[ "$has_ip" == "yes" && "$carrier" == "1" ]]; then
            status_color="${GREEN}"
            status_text="ONLINE"
        elif [[ "$state" == "up" ]] || [[ "$ip_link_state" == *"UP"* ]] || [[ "$has_ip" == "yes" ]]; then
            status_color="${YELLOW}"
            status_text="NO-CARRIER"
        fi
    fi
    
    echo "$status_color|$status_text"
}

# Display interface status with label
display_interface_status() {
    local label="$1"
    local interface="$2"
    
    if [[ -z "$interface" ]]; then
        echo -e "  ${label}: ${RED}No matching interface${NC}"
        return
    fi
    
    local status_result=$(get_interface_status "$interface")
    local status_color=$(echo "$status_result" | cut -d'|' -f1)
    local status_text=$(echo "$status_result" | cut -d'|' -f2)
    
    echo -e "  ${label}: $interface (${status_color}${status_text}${NC})"
}

# Display multiple interface matches
display_interface_matches() {
    local label="$1"
    local keyword="$2"
    local matches=($(find_interface_by_keyword "$keyword"))
    
    if [[ ${#matches[@]} -gt 0 ]]; then
        for interface in "${matches[@]}"; do
            local status_result=$(get_interface_status "$interface")
            local status_color=$(echo "$status_result" | cut -d'|' -f1)
            local status_text=$(echo "$status_result" | cut -d'|' -f2)
            
            # Get IP address if available
            local ip_addr=$(ip addr show "$interface" 2>/dev/null | grep -oP 'inet \K[\d.]+' | head -1 || echo "")
            if [[ -n "$ip_addr" ]]; then
                echo -e "  ${label}: $interface (${status_color}${status_text}${NC}) IP: $ip_addr"
            else
                echo -e "  ${label}: $interface (${status_color}${status_text}${NC})"
            fi
        done
    else
        echo -e "  ${label}: ${RED}No matching interface${NC}"
    fi
}

# Get routing statistics from iptables or /proc/net/dev
get_routing_statistics() {
    local wan_if="$1"
    local lan_if="$2"
    
    if [[ -z "$wan_if" ]] || [[ -z "$lan_if" ]]; then
        echo "0|0"
        return
    fi
    
    # Try to get from iptables FORWARD chain first (most accurate for forwarded traffic)
    local forward_out_bytes=0
    local forward_in_bytes=0
    
    # Get forwarded bytes from iptables FORWARD chain
    # iptables -L FORWARD -v -n -x output: pkts bytes target prot opt in out
    local forward_rule=$(iptables -L FORWARD -v -n -x 2>/dev/null | grep -E "${lan_if}.*${wan_if}" | head -1)
    if [[ -n "$forward_rule" ]]; then
        forward_out_bytes=$(echo "$forward_rule" | awk '{print $2}')
    fi
    
    local reverse_rule=$(iptables -L FORWARD -v -n -x 2>/dev/null | grep -E "${wan_if}.*${lan_if}" | head -1)
    if [[ -n "$reverse_rule" ]]; then
        forward_in_bytes=$(echo "$reverse_rule" | awk '{print $2}')
    fi
    
    # Fallback to /proc/net/dev if iptables stats are not available
    # /proc/net/dev format: interface rx_bytes rx_packets ... tx_bytes tx_packets
    # Fields: rx_bytes(2), tx_bytes(10)
    if [[ "$forward_out_bytes" == "0" ]] || [[ -z "$forward_out_bytes" ]]; then
        if [[ -f /proc/net/dev ]]; then
            # Get transmitted bytes from LAN (outgoing) and received bytes from WAN (incoming)
            local lan_tx=$(grep "^[[:space:]]*${lan_if}:" /proc/net/dev | awk '{print $10}')
            local wan_rx=$(grep "^[[:space:]]*${wan_if}:" /proc/net/dev | awk '{print $2}')
            
            if [[ -n "$lan_tx" ]] && [[ "$lan_tx" =~ ^[0-9]+$ ]]; then
                forward_out_bytes="$lan_tx"
            fi
            if [[ -n "$wan_rx" ]] && [[ "$wan_rx" =~ ^[0-9]+$ ]]; then
                # For incoming, we estimate forwarded traffic from WAN received bytes
                # This is an approximation since WAN receives both forwarded and system traffic
                forward_in_bytes="$wan_rx"
            fi
        fi
    fi
    
    # Ensure we have numeric values
    forward_out_bytes=${forward_out_bytes:-0}
    forward_in_bytes=${forward_in_bytes:-0}
    
    echo "${forward_out_bytes}|${forward_in_bytes}"
}

# Format bytes to human readable (KB, MB, GB)
format_bytes() {
    local bytes="$1"
    if [[ -z "$bytes" ]] || [[ "$bytes" == "0" ]]; then
        echo "0 B"
        return
    fi
    
    if [[ $bytes -lt 1024 ]]; then
        echo "${bytes} B"
    elif [[ $bytes -lt 1048576 ]]; then
        local kb=$((bytes / 1024))
        echo "${kb} KB"
    elif [[ $bytes -lt 1073741824 ]]; then
        local mb=$((bytes / 1048576))
        echo "${mb} MB"
    else
        local gb=$(awk "BEGIN {printf \"%.2f\", $bytes/1073741824}")
        echo "${gb} GB"
    fi
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
                status_result=$(get_interface_status "$interface")
                status_color=$(echo "$status_result" | cut -d'|' -f1)
                status_text=$(echo "$status_result" | cut -d'|' -f2)
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
                status_result=$(get_interface_status "$interface")
                status_color=$(echo "$status_result" | cut -d'|' -f1)
                status_text=$(echo "$status_result" | cut -d'|' -f2)
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

    # Ask about system sharing
    echo -e "${CYAN}Do you want to enable system-level network sharing for matched interfaces?${NC}"
    echo -e "${YELLOW}If 'no', interfaces will only be used for forwarding without system sharing.${NC}"
    read -p "Enable system sharing? (y/n) [no]: " sharing_response
    if [[ "$sharing_response" =~ ^[Yy]([Ee][Ss])?$ ]]; then
        SYSTEM_SHARING="yes"
    else
        SYSTEM_SHARING="no"
    fi

    log_success "Keywords configured:"
    log_info "  WAN: $WAN_KEYWORD"
    log_info "  LAN: $LAN_KEYWORD"
    log_info "  System Sharing: $SYSTEM_SHARING"

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

# Create /usr/local/bin/natgateway command link
create_natgateway_command() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
        echo -e "${WHITE} Creating natgateway Command${NC}"
    echo -e "${CYAN}========================================${NC}"

    current_script=$(readlink -f "${BASH_SOURCE[0]}")

    # Set script to executable with 777 permissions
    $USE_SUDO chmod 777 "$current_script"
    log_success "Script permissions set to 777"
    log_info "  Source: $current_script"

    if [ -L "$NATGATEWAY_LINK" ]; then
        existing_target=$(readlink -f "$NATGATEWAY_LINK")
        if [ "$existing_target" != "$current_script" ]; then
            log_info "Updating existing symlink..."
            $USE_SUDO rm -f "$NATGATEWAY_LINK"
            $USE_SUDO ln -s "$current_script" "$NATGATEWAY_LINK"
            log_success "Command symlink updated: $NATGATEWAY_LINK -> $current_script"
        else
            log_success "Command symlink already exists and is correct"
        fi
    else
        $USE_SUDO ln -s "$current_script" "$NATGATEWAY_LINK"
        log_success "Command symlink created: $NATGATEWAY_LINK -> $current_script"
    fi

    # Verify the symlink
    if [ -L "$NATGATEWAY_LINK" ]; then
        local link_target=$(readlink -f "$NATGATEWAY_LINK")
        log_info "  Symlink verification:"
        log_info "    Link: $NATGATEWAY_LINK"
        log_info "    Target: $link_target"

        if [ "$link_target" = "$current_script" ]; then
            log_success "  Symlink is correctly pointing to the script"
        else
            log_warning "  Symlink target mismatch!"
        fi
    fi

    echo ""
    echo -e "${GREEN}�?'natgateway' command is now available${NC}"
    echo -e "${YELLOW}  You can run 'natgateway' from anywhere to:${NC}"
    echo -e "    - View router status"
    echo -e "    - Modify configuration"
    echo -e "    - Manage the routing service"
    echo -e "    - View system logs"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    return 0
}

# Show interactive status
show_status() {
        log_header "NAT Gateway Status"

    # Load configuration
    if [ -f "$CACHE_FILE" ]; then
        source "$CACHE_FILE"

        echo -e "${CYAN}Configuration:${NC}"
        echo "  WAN Keyword: $WAN_KEYWORD"
        echo "  LAN Keyword: $LAN_KEYWORD"

        # Display system sharing with detailed explanation
        if [ "$SYSTEM_SHARING" = "yes" ]; then
            echo -e "  System Sharing: ${GREEN}$SYSTEM_SHARING${NC} ${GREEN}�?{NC}"
            echo -e "    ${WHITE}�?System CAN use WAN for internet access${NC}"
        else
            echo -e "  System Sharing: ${YELLOW}$SYSTEM_SHARING${NC} ${RED}�?{NC}"
            echo -e "    ${WHITE}�?System CANNOT use WAN (only LAN forwarding)${NC}"
        fi
        echo ""

        # Scan interfaces
        scan_interfaces

        # Check current matches
        echo -e "${CYAN}Current Interface Matches:${NC}"
        display_interface_matches "WAN" "$WAN_KEYWORD"
        display_interface_matches "LAN" "$LAN_KEYWORD"
        
        # Show NAT Gateway status and statistics
        echo ""
        echo -e "${CYAN}NAT Gateway Status:${NC}"
        local ip_forward=$(cat /proc/sys/net/ipv4/ip_forward 2>/dev/null || echo "0")
        if [[ "$ip_forward" == "1" ]]; then
            echo -e "  IP Forwarding: ${GREEN}Enabled${NC} (packets can be forwarded between interfaces)"
            
            # Get current matched interfaces for statistics
            local wan_matches=($(find_interface_by_keyword "$WAN_KEYWORD"))
            local lan_matches=($(find_interface_by_keyword "$LAN_KEYWORD"))
            
            if [[ ${#wan_matches[@]} -gt 0 ]] && [[ ${#lan_matches[@]} -gt 0 ]]; then
                local current_wan="${wan_matches[0]}"
                local current_lan="${lan_matches[0]}"
                
                # Check if routing is actually active (iptables rules exist)
                # Use iptables -C for reliable checking (same method as service script)
                # Need to find iptables command and use sudo if needed
                local iptables_cmd=""
                if command_exists iptables; then
                    iptables_cmd="iptables"
                elif [ -x /usr/sbin/iptables ]; then
                    iptables_cmd="/usr/sbin/iptables"
                elif [ -x /sbin/iptables ]; then
                    iptables_cmd="/sbin/iptables"
                fi
                
                local nat_rule_exists=false
                local fwd_rule_exists=false
                
                # Check NAT rule using iptables -C (most reliable)
                # Use sudo if available and not running as root
                if [[ -n "$iptables_cmd" ]]; then
                    if [[ $EUID -eq 0 ]]; then
                        # Running as root, no sudo needed
                        if $iptables_cmd -t nat -C POSTROUTING -o "$current_wan" -j MASQUERADE 2>/dev/null; then
                            nat_rule_exists=true
                        fi
                        
                        # Check FORWARD rules (both directions)
                        if $iptables_cmd -C FORWARD -i "$current_lan" -o "$current_wan" -j ACCEPT 2>/dev/null && \
                           $iptables_cmd -C FORWARD -i "$current_wan" -o "$current_lan" -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null; then
                            fwd_rule_exists=true
                        fi
                    elif [[ -n "$USE_SUDO" ]]; then
                        # Use sudo for iptables check
                        if $USE_SUDO $iptables_cmd -t nat -C POSTROUTING -o "$current_wan" -j MASQUERADE 2>/dev/null; then
                            nat_rule_exists=true
                        fi
                        
                        # Check FORWARD rules (both directions)
                        if $USE_SUDO $iptables_cmd -C FORWARD -i "$current_lan" -o "$current_wan" -j ACCEPT 2>/dev/null && \
                           $USE_SUDO $iptables_cmd -C FORWARD -i "$current_wan" -o "$current_lan" -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null; then
                            fwd_rule_exists=true
                        fi
                    else
                        # Try without sudo (may work if user has CAP_NET_ADMIN capability)
                        if $iptables_cmd -t nat -C POSTROUTING -o "$current_wan" -j MASQUERADE 2>/dev/null; then
                            nat_rule_exists=true
                        fi
                        
                        # Check FORWARD rules (both directions)
                        if $iptables_cmd -C FORWARD -i "$current_lan" -o "$current_wan" -j ACCEPT 2>/dev/null && \
                           $iptables_cmd -C FORWARD -i "$current_wan" -o "$current_lan" -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null; then
                            fwd_rule_exists=true
                        fi
                    fi
                fi
                
                if [[ "$nat_rule_exists" == true ]] && [[ "$fwd_rule_exists" == true ]]; then
                    echo -e "  NAT Gateway: ${GREEN}Active${NC}"
                    echo -e "    WAN Interface: $current_wan"
                    echo -e "    LAN Interface: $current_lan"
                    
                    # Get LAN gateway IP for display
                    local lan_ip=$(ip addr show "$current_lan" 2>/dev/null | grep -oP 'inet \K[\d.]+' | head -1)
                    if [[ -n "$lan_ip" ]]; then
                        echo -e "    LAN Gateway IP: ${GREEN}$lan_ip${NC}"
                    fi
                    
                    # Get traffic statistics
                    local stats=$(get_routing_statistics "$current_wan" "$current_lan")
                    local tx_bytes=$(echo "$stats" | cut -d'|' -f1)
                    local rx_bytes=$(echo "$stats" | cut -d'|' -f2)
                    
                    local tx_formatted=$(format_bytes "$tx_bytes")
                    local rx_formatted=$(format_bytes "$rx_bytes")
                    
                    echo -e "  NAT Forwarded Traffic:"
                    echo -e "    ${CYAN}Outbound (LAN→WAN):${NC} $tx_formatted"
                    echo -e "    ${CYAN}Inbound (WAN→LAN):${NC} $rx_formatted"
                    
                    # Display router configuration instructions
                    if [[ -n "$lan_ip" ]]; then
                        local lan_cidr=$(ip addr show "$current_lan" 2>/dev/null | grep -oP 'inet \K[\d.]+/\d+' | head -1 | cut -d'/' -f2)
                        local lan_subnet=$(echo "$lan_ip" | cut -d. -f1-3)
                        echo ""
                        echo -e "  ${CYAN}Connected Router Configuration:${NC}"
                        echo -e "    Gateway: ${GREEN}$lan_ip${NC}"
                        echo -e "    Subnet: ${GREEN}${lan_subnet}.0/$lan_cidr${NC}"
                        echo -e "    DNS: ${GREEN}8.8.8.8${NC} or ${GREEN}1.1.1.1${NC}"
                    fi
                else
                    echo -e "  NAT Gateway: ${YELLOW}Not Active${NC} (waiting for interfaces to be ready)"
                    echo -e "    ${YELLOW}Service will automatically configure when both interfaces are available${NC}"
                fi
            else
                echo -e "  NAT Gateway: ${YELLOW}Not Active${NC} (interfaces not matched)"
            fi
        else
            echo -e "  IP Forwarding: ${RED}Disabled${NC}"
            echo -e "  ${YELLOW}NAT Gateway requires IP forwarding to be enabled${NC}"
        fi

        # Check service status with detailed information
        echo ""
        echo -e "${CYAN}Service Status:${NC}"
        local full_service_name="ncore-$SERVICE_NAME"
        
        # Check if service unit exists
        if ! service_exists "$full_service_name"; then
            echo -e "  ${YELLOW}Service unit file does not exist${NC}"
            echo -e "  ${YELLOW}(Use option 5 to create and start the service)${NC}"
        else
            # Get detailed service status
            local service_status=""
            if $USE_SUDO systemctl is-active --quiet "$full_service_name" 2>/dev/null; then
                echo -e "  ${GREEN}Service is running${NC}"
                # Get PID to verify it's actually running
                local service_pid=$($USE_SUDO systemctl show -p MainPID --value "$full_service_name" 2>/dev/null)
                if [ -n "$service_pid" ] && [ "$service_pid" != "0" ]; then
                    if ps -p "$service_pid" > /dev/null 2>&1; then
                        echo -e "  ${GREEN}Process ID: $service_pid${NC}"
                    else
                        echo -e "  ${YELLOW}Warning: Process $service_pid not found (service may be restarting)${NC}"
                    fi
                fi
            elif $USE_SUDO systemctl is-failed --quiet "$full_service_name" 2>/dev/null; then
                echo -e "  ${RED}Service has failed${NC}"
                echo -e "  ${YELLOW}Check logs: journalctl -u $full_service_name -n 50${NC}"
            else
                echo -e "  ${RED}Service is not running${NC}"
                # Check if it's enabled but not started
                if $USE_SUDO systemctl is-enabled --quiet "$full_service_name" 2>/dev/null; then
                    echo -e "  ${YELLOW}(Service is enabled but not active - use option 5 to start)${NC}"
                fi
            fi
        fi
        
        # Show service logs
        echo ""
        echo -e "${CYAN}Service Logs (Last 20 entries):${NC}"
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        if service_exists "$full_service_name"; then
            # Show recent logs, but only if service exists
            if $USE_SUDO journalctl -u "$full_service_name" -n 20 --no-pager 2>/dev/null | head -30; then
                echo ""
            else
                echo -e "  ${YELLOW}No logs available yet${NC}"
            fi
        else
            echo -e "  ${YELLOW}Service not created yet - no logs available${NC}"
        fi
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    else
        log_warning "No configuration found. Please run setup first."
    fi
}

# Helper function to wait for user input
wait_for_continue() {
    echo ""
    read -p "Press Enter to continue..."
}

# Interactive menu when command is run
show_interactive_menu() {
    while true; do
        log_header "NAT Gateway Interactive Menu"
        echo -e "${CYAN}Configuration Management:${NC}"
        echo "  1. Show Status"
        echo "  2. Modify WAN Keyword"
        echo "  3. Modify LAN Keyword"
        echo "  4. Toggle System Sharing"
        echo ""
        echo -e "${CYAN}Service Management:${NC}"
        echo "  5. Start/Restart Service"
        echo "  6. Stop Service"
        echo "  7. View Logs"
        echo ""
        echo "  0. Exit"
        echo ""
        read -p "Select option: " option

        case "$option" in
            1)
                show_status
                wait_for_continue
                ;;
            2)
                scan_interfaces
                WAN_KEYWORD=""
                input_keywords
                save_cache
                log_success "Configuration updated. Please restart the service for changes to take effect."
                wait_for_continue
                ;;
            3)
                scan_interfaces
                LAN_KEYWORD=""
                input_keywords
                save_cache
                log_success "Configuration updated. Please restart the service for changes to take effect."
                wait_for_continue
                ;;
            4)
                if [ -f "$CACHE_FILE" ]; then
                    source "$CACHE_FILE"

                    echo ""
                    echo -e "${CYAN}System Sharing Configuration${NC}"
                    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
                    echo -e "Current status: ${GREEN}$SYSTEM_SHARING${NC}"
                    echo ""
                    echo -e "${WHITE}What is System Sharing?${NC}"
                    if [ "$SYSTEM_SHARING" = "yes" ]; then
                        echo -e "  ${GREEN}�?ENABLED${NC} - The system (this machine) CAN use WAN for internet"
                        echo -e "    - System traffic goes through WAN interface"
                        echo -e "    - Default route set via WAN gateway"
                        echo -e "    - Both system and LAN clients share WAN internet"
                        echo ""
                        echo -e "${YELLOW}Do you want to DISABLE system sharing?${NC}"
                        echo -e "  If disabled, only LAN clients can use WAN (not this system)"
                    else
                        echo -e "  ${RED}�?DISABLED${NC} - The system (this machine) CANNOT use WAN for internet"
                        echo -e "    - System traffic does NOT go through WAN"
                        echo -e "    - Only LAN -> WAN forwarding works"
                        echo -e "    - Only LAN clients can access internet via WAN"
                        echo ""
                        echo -e "${YELLOW}Do you want to ENABLE system sharing?${NC}"
                        echo -e "  If enabled, this system can also use WAN for internet"
                    fi
                    echo ""
                    read -p "Toggle system sharing? (y/n): " -n 1 -r toggle_response
                    echo ""

                    if [[ "$toggle_response" =~ ^[Yy]$ ]]; then
                        local old_sharing="$SYSTEM_SHARING"
                        if [ "$SYSTEM_SHARING" = "yes" ]; then
                            SYSTEM_SHARING="no"
                            log_info "System sharing disabled"
                            echo -e "${YELLOW}System will NOT use WAN for internet (only forwarding LAN -> WAN)${NC}"
                        else
                            SYSTEM_SHARING="yes"
                            log_info "System sharing enabled"
                            echo -e "${GREEN}System will use WAN for internet access${NC}"
                        fi
                        save_cache
                        log_success "Configuration updated."
                        
                        # Check if service exists and is running
                        local full_service_name="ncore-$SERVICE_NAME"
                        if service_exists "$full_service_name" && $USE_SUDO systemctl is-active --quiet "$full_service_name" 2>/dev/null; then
                            echo ""
                            echo -e "${CYAN}Restarting service to apply changes immediately...${NC}"
                            if $USE_SUDO systemctl restart "$full_service_name" 2>/dev/null; then
                                # Wait a moment for service to restart
                                sleep 2
                                
                                # Verify service is running
                                if $USE_SUDO systemctl is-active --quiet "$full_service_name" 2>/dev/null; then
                                    log_success "Service restarted successfully. Changes are now active."
                                    
                                    # If enabling sharing (no -> yes), verify default route exists
                                    if [[ "$old_sharing" == "no" ]] && [[ "$SYSTEM_SHARING" == "yes" ]]; then
                                        echo ""
                                        echo -e "${CYAN}Verifying system sharing is active...${NC}"
                                        local wan_matches=($(find_interface_by_keyword "$WAN_KEYWORD"))
                                        if [[ ${#wan_matches[@]} -gt 0 ]]; then
                                            local current_wan="${wan_matches[0]}"
                                            local default_route=$(ip route | grep "default.*$current_wan" | head -1)
                                            if [[ -n "$default_route" ]]; then
                                                echo -e "  ${GREEN}�?Default route via $current_wan: OK${NC}"
                                                echo -e "  ${GREEN}�?System can now access internet via WAN${NC}"
                                            else
                                                echo -e "  ${YELLOW}�?Default route not found yet, checking service logs...${NC}"
                                                echo -e "  ${YELLOW}  Service may need a few seconds to detect WAN gateway${NC}"
                                            fi
                                        fi
                                    fi
                                else
                                    log_warning "Service restarted but may not be running. Check status manually."
                                fi
                            else
                                log_error "Failed to restart service. Please restart manually with option 5."
                            fi
                        else
                            log_warning "Service is not running. Please start it with option 5 for changes to take effect."
                        fi
                    else
                        log_info "System sharing unchanged: $SYSTEM_SHARING"
                    fi
                fi
                wait_for_continue
                ;;
            5)
                local full_service_name="ncore-$SERVICE_NAME"
                # Ensure service exists before trying to start/restart
                if ! ensure_service_exists; then
                    log_error "Cannot start/restart service - service creation failed"
                    echo ""
                    read -p "Press Enter to continue..."
                else
                    # Check if service is running
                    if $USE_SUDO systemctl is-active --quiet "$full_service_name" 2>/dev/null; then
                        log_info "Service is running, restarting..."
                        if $USE_SUDO systemctl restart "$full_service_name"; then
                            log_success "Service restarted successfully"
                        else
                            log_error "Failed to restart service"
                        fi
                    else
                        log_info "Service is not running, starting..."
                        if $USE_SUDO systemctl start "$full_service_name"; then
                            log_success "Service started successfully"
                        else
                            log_error "Failed to start service"
                        fi
                    fi
                    wait_for_continue
                fi
                ;;
            6)
                local full_service_name="ncore-$SERVICE_NAME"
                # Check if service exists before trying to stop
                if ! service_exists "$full_service_name"; then
                    log_warning "Service does not exist, nothing to stop"
                    wait_for_continue
                else
                    log_info "Stopping service..."
                    if $USE_SUDO systemctl stop "$full_service_name"; then
                        log_success "Service stopped"
                        log_info "Disabling service from auto-start..."
                        if $USE_SUDO systemctl disable "$full_service_name"; then
                            log_success "Service disabled from auto-start"
                        else
                            log_error "Failed to disable service"
                        fi
                    else
                        log_error "Failed to stop service"
                    fi
                    wait_for_continue
                fi
                ;;
            7)
                local full_service_name="ncore-$SERVICE_NAME"
                if ! service_exists "$full_service_name"; then
                    log_warning "Service does not exist, no logs to view"
                    wait_for_continue
                else
                    echo -e "${CYAN}Recent logs (Ctrl+C to exit):${NC}"
                    $USE_SUDO journalctl -u "$full_service_name" -n 50 --no-pager
                    wait_for_continue
                fi
                ;;
            0)
                log_info "Exiting..."
                exit 0
                ;;
            *)
                log_error "Invalid option"
                wait_for_continue
                ;;
        esac
    done
}

# Create NAT Gateway service script
create_service_script() {
    log_info "Creating NAT Gateway monitoring script..."

    # Source script location in debian_com directory
    local source_script="$DEBIAN_COM_DIR/natgateway_monitor.sh"
    
    # Check if source script exists
    if [[ ! -f "$source_script" ]]; then
        log_error "Source service script not found: $source_script"
        log_error "Please ensure natgateway_monitor.sh exists in debian_com directory"
        return 1
    fi

    # Copy the script to service location
    log_info "Copying service script from: $source_script"
    if ! $USE_SUDO cp "$source_script" "$SERVICE_SCRIPT"; then
        log_error "Failed to copy service script"
        return 1
    fi

    # Verify the script was created
    if [ ! -f "$SERVICE_SCRIPT" ]; then
        log_error "Failed to create service script: $SERVICE_SCRIPT"
        return 1
    fi

    # Set executable permissions (777 for full access)
    $USE_SUDO chmod 777 "$SERVICE_SCRIPT"
    if [ $? -ne 0 ]; then
        log_error "Failed to set permissions on service script"
        return 1
    fi

    log_success "Service script created: $SERVICE_SCRIPT"
    log_info "  Source: $source_script"
    log_info "  Target: $SERVICE_SCRIPT"
    log_info "  Permissions: 777 (full access)"
    log_info "  Size: $(stat -c%s "$SERVICE_SCRIPT" 2>/dev/null || echo "unknown") bytes"

    return 0
}

# Check if service exists
service_exists() {
    local service_name="$1"
    $USE_SUDO systemctl list-unit-files | grep -q "^${service_name}.service"
}

# Ensure service exists and is ready
ensure_service_exists() {
    local full_service_name="ncore-$SERVICE_NAME"
    
    # Check if service script exists
    if [[ ! -f "$SERVICE_SCRIPT" ]]; then
        log_warning "Service script not found, creating it..."
        if ! create_service_script; then
            log_error "Failed to create service script"
            return 1
        fi
    fi
    
    # Check if service unit file exists
    if ! service_exists "$full_service_name"; then
        log_warning "Service not found, creating it..."
        if ! create_systemd_service_internal; then
            log_error "Failed to create service"
            return 1
        fi
    fi
    
    return 0
}

# Internal function to create systemd service (without auto-start)
create_systemd_service_internal() {
    local service_manager="$COMMON_DIR/debian_service_manager.sh"

    if [[ ! -f "$service_manager" ]]; then
        log_error "Service manager not found: $service_manager"
        return 1
    fi

    # Call service manager to create service
    log_info "Creating service with root privileges..."
    if $USE_SUDO bash "$service_manager" create "$SERVICE_SCRIPT" "$SERVICE_NAME" "NAT Gateway Service" "10%" "100M"; then
        log_success "Service created successfully"
        return 0
    else
        log_error "Failed to create service"
        return 1
    fi
}

# Create systemd service using debian_service_manager.sh
create_systemd_service() {
    log_info "Creating systemd service using debian_service_manager.sh..."

    if ! create_systemd_service_internal; then
        return 1
    fi

    local full_service_name="ncore-$SERVICE_NAME"
    log_info "Starting $full_service_name service..."
    if $USE_SUDO systemctl start "$full_service_name"; then
        # Wait a moment for service to start and check actual status
        sleep 1
        local retry_count=0
        local max_retries=5
        while [ $retry_count -lt $max_retries ]; do
            if $USE_SUDO systemctl is-active --quiet "$full_service_name" 2>/dev/null; then
                log_success "Service started and is running"
                
                # Show service status
                log_info "Service status:"
                $USE_SUDO systemctl status "$full_service_name" --no-pager -l | head -10
                return 0
            fi
            retry_count=$((retry_count + 1))
            sleep 1
        done
        
        # If we get here, service started but may have failed
        log_warning "Service start command succeeded, but service may not be running"
        log_info "Checking service status..."
        $USE_SUDO systemctl status "$full_service_name" --no-pager -l | head -15
        
        # Check if service exists and what its state is
        if $USE_SUDO systemctl is-failed --quiet "$full_service_name" 2>/dev/null; then
            log_error "Service has failed - check logs with: journalctl -u $full_service_name -n 50"
            return 1
        fi
        
        # Service might be starting or in a transition state
        log_info "Service is in transition state - it may start shortly"
        return 0
    else
        log_error "Failed to start service"
        return 1
    fi
}

# Main installation function
install_natgateway() {
    log_header "NAT Gateway Installation"

    # Cleanup old lnxrouter installation first
    cleanup_old_lnxrouter

    # Check dependencies
    if ! check_dependencies; then
        log_error "Dependency check failed"
        return 1
    fi

    # Check permissions
    if ! check_permissions; then
        log_error "Permission check failed"
        return 1
    fi

    # Check WSL mode
    check_wsl_mode

    # Create configuration directory
    if ! create_config_dir; then
        log_error "Failed to create configuration directory"
        return 1
    fi

    # Create temporary directory
    if ! create_temp_dir; then
        log_error "Failed to create temporary directory"
        return 1
    fi

    # CREATE NATGATEWAY COMMAND FIRST - so it's available immediately
    if ! create_natgateway_command; then
        log_error "Failed to create natgateway command"
        cleanup_on_failure
        return 1
    fi

    # Scan all interfaces
    scan_interfaces

    # Try to load cached configuration
    if load_cache; then
        echo -e "${YELLOW}Use cached configuration? (y/n/r for reconfigure):${NC}"
        read -n 1 -r response
        echo

        case "$response" in
            [Yy]* )
                log_info "Using cached configuration"
                ;;
            [Rr]* )
                log_info "Reconfiguring keywords"
                WAN_KEYWORD=""
                LAN_KEYWORD=""
                while ! input_keywords; do
                    log_warning "Please try again with valid keywords"
                done
                ;;
            * )
                log_info "Skipping cached configuration"
                WAN_KEYWORD=""
                LAN_KEYWORD=""
                while ! input_keywords; do
                    log_warning "Please try again with valid keywords"
                done
                ;;
        esac
    else
        # Input keywords if not cached
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
    if ! create_service_script; then
        log_error "Failed to create service script"
        cleanup_on_failure
        return 1
    fi

    # Create and install systemd service
    if create_systemd_service; then
        log_success "NAT Gateway service installed successfully!"
        echo ""
        echo -e "${CYAN}Installation Summary:${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        log_info "Command: natgateway (access anytime)"
        log_info "Service name: ncore-$SERVICE_NAME"
        log_info "Service script: $SERVICE_SCRIPT"
        log_info "Configuration: $CACHE_FILE"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""

        echo -e "${CYAN}Available Commands:${NC}"
        echo "  ${YELLOW}natgateway${NC}                           - Open interactive menu"
        echo "  ${YELLOW}systemctl status ncore-$SERVICE_NAME${NC}  - Check service status"
        echo "  ${YELLOW}systemctl restart ncore-$SERVICE_NAME${NC} - Restart service"
        echo "  ${YELLOW}systemctl stop ncore-$SERVICE_NAME${NC}    - Stop service"
        echo "  ${YELLOW}journalctl -u ncore-$SERVICE_NAME -f${NC}  - View live logs"
        echo ""

        echo -e "${CYAN}Service Configuration:${NC}"
        echo "  WAN Keyword: ${GREEN}$WAN_KEYWORD${NC}"
        echo "  LAN Keyword: ${GREEN}$LAN_KEYWORD${NC}"
        echo "  System Sharing: ${GREEN}$SYSTEM_SHARING${NC}"
        echo ""

        echo -e "${YELLOW}NAT Gateway Service Features:${NC}"
        echo -e "  ${GREEN}�?{NC} Enable NAT Gateway when both WAN ($WAN_KEYWORD) and LAN ($LAN_KEYWORD) are available"
        echo -e "  ${GREEN}�?{NC} Auto-configure LAN interface as gateway (IP: 192.168.2.1/24)"
        echo -e "  ${GREEN}�?{NC} Disable NAT Gateway when interfaces are disconnected"
        echo -e "  ${GREEN}�?{NC} Hot-plug support: Automatically detects interface changes (checks every 5 seconds)"
        echo -e "  ${GREEN}�?{NC} Traffic statistics: Monitor forwarded data (LAN↔WAN)"
        echo -e "  ${GREEN}�?{NC} Service logs: /var/log/natgateway.log"
        echo ""
        echo -e "${CYAN}Connected Router/Device Configuration:${NC}"
        echo -e "  When connecting a router or device to LAN interface ($LAN_KEYWORD):"
        echo -e "  ${YELLOW}�?Gateway IP:${NC} 192.168.2.1"
        echo -e "  ${YELLOW}�?Subnet:${NC} 192.168.2.0/24"
        echo -e "  ${YELLOW}�?DNS:${NC} 8.8.8.8 or 1.1.1.1"
        echo ""

        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}Setup completed successfully!${NC}"
        echo -e "${YELLOW}Run 'natgateway' to access the interactive menu${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        return 0
    else
        log_error "Failed to install service"
        cleanup_on_failure
        return 1
    fi
}

# Main entry point
main() {
    # Check if running on production server
    if [ "$IS_PRODUCTION" = true ]; then
        log_header "NAT Gateway - Production Server Detected"
        log_info "Production server environment detected"
        log_warning "NAT Gateway is not applicable for production servers"
        log_info "This tool is designed for systems with multiple network interfaces"
        log_info "and is typically used for development or routing scenarios"
        echo ""
        log_info "Skipping installation automatically"
        return 0
    fi

    # Check if already installed
    if check_installation; then
        # If installed, show status first
        log_header "NAT Gateway Status"
        log_success "NAT Gateway is already installed and configured"
        echo ""

        # Show installation info
        echo -e "${CYAN}Installation Information:${NC}"
        echo "  Command link: $NATGATEWAY_LINK"
        echo "  Script location: $(readlink -f "$NATGATEWAY_LINK")"
        echo "  Configuration: $CACHE_FILE"
        echo "  Service: ncore-$SERVICE_NAME"
        echo ""

        # Check service status
        full_service_name="ncore-$SERVICE_NAME"
        echo -e "${CYAN}Service Status:${NC}"
        if ! service_exists "$full_service_name"; then
            echo -e "  ${YELLOW}Service unit file does not exist${NC}"
            echo -e "  ${YELLOW}(Service may not have been created yet)${NC}"
        elif $USE_SUDO systemctl is-active --quiet "$full_service_name" 2>/dev/null; then
            echo -e "  ${GREEN}Service is running${NC}"
        elif $USE_SUDO systemctl is-failed --quiet "$full_service_name" 2>/dev/null; then
            echo -e "  ${RED}Service has failed${NC}"
            echo -e "  ${YELLOW}Check logs with: journalctl -u $full_service_name -n 50${NC}"
        else
            echo -e "  ${RED}Service is not running${NC}"
            # Check if service is enabled but not started
            if $USE_SUDO systemctl is-enabled --quiet "$full_service_name" 2>/dev/null; then
                echo -e "  ${YELLOW}(Service is enabled but not active - use option 5 to start)${NC}"
            fi
        fi
        echo ""

        # Load and show configuration
        if [ -f "$CACHE_FILE" ]; then
            source "$CACHE_FILE"
            echo -e "${CYAN}Configuration:${NC}"
            echo "  WAN Keyword: $WAN_KEYWORD"
            echo "  LAN Keyword: $LAN_KEYWORD"
            echo "  System Sharing: $SYSTEM_SHARING"
            echo ""

            # Scan and show current interface status
            echo -e "${CYAN}Current Network Interfaces:${NC}"
            scan_interfaces
            echo ""

            # Check current matches
            echo -e "${CYAN}Configured Interface Matches:${NC}"
            display_interface_matches "WAN" "$WAN_KEYWORD"
            display_interface_matches "LAN" "$LAN_KEYWORD"
        fi

        echo ""
        echo -e "${YELLOW}Options:${NC}"
        echo "  Type 'm' to open interactive menu"
        echo "  Type 'r' to reinstall/reconfigure"
        echo "  Press Enter to exit"
        read -n 1 -r action_choice
        echo ""

        case "$action_choice" in
            [Mm]* )
                show_interactive_menu
                ;;
            [Rr]* )
                log_info "Reinstalling NAT Gateway..."
                install_natgateway
                ;;
            * )
                log_info "Exiting..."
                exit 0
                ;;
        esac
    else
        # If not installed, prompt for installation
        log_header "NAT Gateway Installation"
        log_info "NAT Gateway is not installed yet."
        echo ""
        echo -e "${CYAN}NAT Gateway for Linux${NC}"
        echo -e "${WHITE}This tool sets up a NAT Gateway, allowing LAN devices to access internet through WAN interface.${NC}"
        echo ""
        echo -e "${CYAN}Features:${NC}"
        echo -e "  ${GREEN}�?{NC} NAT Gateway: Share WAN internet connection with LAN devices"
        echo -e "  ${GREEN}�?{NC} Keyword-based interface matching (hot-plug support)"
        echo -e "  ${GREEN}�?{NC} Automatic NAT Gateway setup when interfaces are available"
        echo -e "  ${GREEN}�?{NC} Auto-configure LAN interface as gateway (default: 192.168.2.1/24)"
        echo -e "  ${GREEN}�?{NC} Real-time monitoring (checks every 5 seconds)"
        echo -e "  ${GREEN}�?{NC} Interactive menu for configuration management"
        echo -e "  ${GREEN}�?{NC} Systemd service for automatic startup"
        echo ""
        echo -e "${YELLOW}Installation Process:${NC}"
        echo -e "  1. Create 'natgateway' command (available immediately)"
        echo -e "  2. Scan and configure WAN/LAN network interfaces"
        echo -e "  3. Configure LAN interface as gateway (auto-assign IP if needed)"
        echo -e "  4. Install systemd service for NAT Gateway monitoring"
        echo -e "  5. Start NAT Gateway service"
        echo ""
        echo -e "${CYAN}Do you want to install NAT Gateway? (y/yes to continue)${NC}"
        read -p "Install? " install_response

        if [[ "$install_response" =~ ^[Yy]([Ee][Ss])?$ ]]; then
            echo ""
            log_success "Starting installation process..."
            echo -e "${YELLOW}Note: 'natgateway' command will be created first, even if setup is interrupted${NC}"
            echo ""
            install_natgateway
        else
            log_warning "Installation cancelled."
            exit 0
        fi
    fi
}

# Run main function
main "$@"
