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
# This ensures relative paths work correctly when script is run via /usr/local/bin/lnxrouter
REAL_SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "$REAL_SCRIPT_PATH")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables first
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# Source common functions
COMMON_DIR="$PARENT_DIR_LEVEL_2/common"

# Configuration files
CORE_NODE_DATA_DIR="${CORE_NODE_DATA_DIR:-/var/_core_node}"
CONFIG_DIR="${CORE_NODE_DATA_DIR}/lnxrouter"
CONFIG_FILE="$CONFIG_DIR/config"
CACHE_FILE="$CONFIG_DIR/interface_cache.conf"
LNXROUTER_LINK="/usr/local/bin/lnxrouter"
SERVICE_SCRIPT="/usr/local/bin/lnxrouter-monitor.sh"
SERVICE_NAME="lnxrouter"
SCRIPT_TEMP_DIR="/tmp/lnxrouter_$$"

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

# Check system dependencies
check_dependencies() {
    local missing_deps=()
    local required_commands=("ip" "iptables" "systemctl" "awk" "grep")

    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            missing_deps+=("$cmd")
        fi
    done

    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_error "Missing required commands: ${missing_deps[*]}"
        log_error "Please install required packages:"
        log_error "  Ubuntu/Debian: sudo apt install iproute2 iptables systemd gawk grep"
        return 1
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
    if [ -f "$LNXROUTER_LINK" ] && [ -L "$LNXROUTER_LINK" ]; then
        local link_target=$(readlink -f "$LNXROUTER_LINK")
        local current_script=$(readlink -f "${BASH_SOURCE[0]}")

        if [ "$link_target" = "$current_script" ]; then
            IS_INSTALLED=true
            log_success "LnxRouter is already installed"
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
    if [ ! -d "$SCRIPT_TEMP_DIR" ]; then
        if ! $USE_SUDO mkdir -p "$SCRIPT_TEMP_DIR" 2>/dev/null; then
            log_error "Failed to create temporary directory: $SCRIPT_TEMP_DIR"
            return 1
        fi
        log_info "Created temporary directory: $SCRIPT_TEMP_DIR"
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

    # NOTE: We keep the lnxrouter command link even on failure
    # So users can run 'lnxrouter' to reconfigure later
    if [ -L "$LNXROUTER_LINK" ]; then
        log_info "Keeping lnxrouter command link for future use..."
        log_info "You can run 'lnxrouter' later to complete setup"
    fi

    # Clean temporary directory
    if [ -d "$SCRIPT_TEMP_DIR" ]; then
        log_info "Cleaning temporary directory..."
        $USE_SUDO rm -rf "$SCRIPT_TEMP_DIR" 2>/dev/null || true
    fi

    log_warning "Cleanup completed"
    log_info "The 'lnxrouter' command is still available - run it to retry setup"
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

            # Try to get carrier status
            carrier="0"
            if [ -f "/sys/class/net/$interface/carrier" ]; then
                carrier=$(cat /sys/class/net/$interface/carrier 2>/dev/null || echo "0")
            fi

            # Display interface info
            status_color="${RED}"
            status_text="DOWN"
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
    done < <(ip link show 2>/dev/null)

    echo "----------------------------------------"
    log_success "Found ${#ALL_INTERFACES[@]} network interfaces"

    if [ ${#ALL_INTERFACES[@]} -eq 0 ]; then
        log_error "No network interfaces found!"
        log_warning "This system may not have any network interfaces configured."
        log_warning "LnxRouter requires at least 2 network interfaces (WAN and LAN)."
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

            return 0
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

# Create /usr/local/bin/lnxrouter command link
create_lnxrouter_command() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${WHITE} Creating lnxrouter Command${NC}"
    echo -e "${CYAN}========================================${NC}"

    current_script=$(readlink -f "${BASH_SOURCE[0]}")

    # Set script to executable with 777 permissions
    $USE_SUDO chmod 777 "$current_script"
    log_success "Script permissions set to 777"
    log_info "  Source: $current_script"

    if [ -L "$LNXROUTER_LINK" ]; then
        existing_target=$(readlink -f "$LNXROUTER_LINK")
        if [ "$existing_target" != "$current_script" ]; then
            log_info "Updating existing symlink..."
            $USE_SUDO rm -f "$LNXROUTER_LINK"
            $USE_SUDO ln -s "$current_script" "$LNXROUTER_LINK"
            log_success "Command symlink updated: $LNXROUTER_LINK -> $current_script"
        else
            log_success "Command symlink already exists and is correct"
        fi
    else
        $USE_SUDO ln -s "$current_script" "$LNXROUTER_LINK"
        log_success "Command symlink created: $LNXROUTER_LINK -> $current_script"
    fi

    # Verify the symlink
    if [ -L "$LNXROUTER_LINK" ]; then
        local link_target=$(readlink -f "$LNXROUTER_LINK")
        log_info "  Symlink verification:"
        log_info "    Link: $LNXROUTER_LINK"
        log_info "    Target: $link_target"

        if [ "$link_target" = "$current_script" ]; then
            log_success "  Symlink is correctly pointing to the script"
        else
            log_warning "  Symlink target mismatch!"
        fi
    fi

    echo ""
    echo -e "${GREEN}✓ 'lnxrouter' command is now available${NC}"
    echo -e "${YELLOW}  You can run 'lnxrouter' from anywhere to:${NC}"
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
    log_header "LnxRouter Status"

    # Load configuration
    if [ -f "$CACHE_FILE" ]; then
        source "$CACHE_FILE"

        echo -e "${CYAN}Configuration:${NC}"
        echo "  WAN Keyword: $WAN_KEYWORD"
        echo "  LAN Keyword: $LAN_KEYWORD"

        # Display system sharing with detailed explanation
        if [ "$SYSTEM_SHARING" = "yes" ]; then
            echo -e "  System Sharing: ${GREEN}$SYSTEM_SHARING${NC} ${GREEN}✓${NC}"
            echo -e "    ${WHITE}→ System CAN use WAN for internet access${NC}"
        else
            echo -e "  System Sharing: ${YELLOW}$SYSTEM_SHARING${NC} ${RED}✗${NC}"
            echo -e "    ${WHITE}→ System CANNOT use WAN (only LAN forwarding)${NC}"
        fi
        echo ""

        # Scan interfaces
        scan_interfaces

        # Check current matches
        echo -e "${CYAN}Current Interface Matches:${NC}"

        local wan_matches=($(find_interface_by_keyword "$WAN_KEYWORD"))
        if [[ ${#wan_matches[@]} -gt 0 ]]; then
            for interface in "${wan_matches[@]}"; do
                local state=$(cat /sys/class/net/$interface/operstate 2>/dev/null || echo "unknown")
                local carrier=$(cat /sys/class/net/$interface/carrier 2>/dev/null || echo "0")
                local status_color="${RED}"
                local status_text="OFFLINE"

                if [[ "$state" == "up" && "$carrier" == "1" ]]; then
                    status_color="${GREEN}"
                    status_text="ONLINE"
                elif [[ "$state" == "up" ]]; then
                    status_color="${YELLOW}"
                    status_text="NO-CARRIER"
                fi

                echo -e "  WAN: $interface (${status_color}${status_text}${NC})"
            done
        else
            echo -e "  WAN: ${RED}No matching interface${NC}"
        fi

        local lan_matches=($(find_interface_by_keyword "$LAN_KEYWORD"))
        if [[ ${#lan_matches[@]} -gt 0 ]]; then
            for interface in "${lan_matches[@]}"; do
                local state=$(cat /sys/class/net/$interface/operstate 2>/dev/null || echo "unknown")
                local carrier=$(cat /sys/class/net/$interface/carrier 2>/dev/null || echo "0")
                local status_color="${RED}"
                local status_text="OFFLINE"

                if [[ "$state" == "up" && "$carrier" == "1" ]]; then
                    status_color="${GREEN}"
                    status_text="ONLINE"
                elif [[ "$state" == "up" ]]; then
                    status_color="${YELLOW}"
                    status_text="NO-CARRIER"
                fi

                echo -e "  LAN: $interface (${status_color}${status_text}${NC})"
            done
        else
            echo -e "  LAN: ${RED}No matching interface${NC}"
        fi

        # Check service status
        echo ""
        echo -e "${CYAN}Service Status:${NC}"
        local full_service_name="ncore-$SERVICE_NAME"
        if systemctl is-active --quiet "$full_service_name" 2>/dev/null; then
            echo -e "  ${GREEN}Service is running${NC}"
        else
            echo -e "  ${RED}Service is not running${NC}"
        fi
    else
        log_warning "No configuration found. Please run setup first."
    fi
}

# Interactive menu when command is run
show_interactive_menu() {
    while true; do
        log_header "LnxRouter Interactive Menu"
        echo "1. Show Status"
        echo "2. Modify WAN Keyword"
        echo "3. Modify LAN Keyword"
        echo "4. Toggle System Sharing"
        echo "5. Restart Service"
        echo "6. Stop Service"
        echo "7. View Logs"
        echo "0. Exit"
        echo ""
        read -p "Select option: " option

        case "$option" in
            1)
                show_status
                echo ""
                read -p "Press Enter to continue..."
                ;;
            2)
                scan_interfaces
                WAN_KEYWORD=""
                input_keywords
                save_cache
                log_success "Configuration updated. Please restart the service for changes to take effect."
                echo ""
                read -p "Press Enter to continue..."
                ;;
            3)
                scan_interfaces
                LAN_KEYWORD=""
                input_keywords
                save_cache
                log_success "Configuration updated. Please restart the service for changes to take effect."
                echo ""
                read -p "Press Enter to continue..."
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
                        echo -e "  ${GREEN}✓ ENABLED${NC} - The system (this machine) CAN use WAN for internet"
                        echo -e "    - System traffic goes through WAN interface"
                        echo -e "    - Default route set via WAN gateway"
                        echo -e "    - Both system and LAN clients share WAN internet"
                        echo ""
                        echo -e "${YELLOW}Do you want to DISABLE system sharing?${NC}"
                        echo -e "  If disabled, only LAN clients can use WAN (not this system)"
                    else
                        echo -e "  ${RED}✗ DISABLED${NC} - The system (this machine) CANNOT use WAN for internet"
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
                        log_success "Configuration updated. Please restart the service for changes to take effect."
                    else
                        log_info "System sharing unchanged: $SYSTEM_SHARING"
                    fi
                fi
                echo ""
                read -p "Press Enter to continue..."
                ;;
            5)
                local full_service_name="ncore-$SERVICE_NAME"
                log_info "Restarting service..."
                $USE_SUDO systemctl restart "$full_service_name"
                log_success "Service restarted"
                echo ""
                read -p "Press Enter to continue..."
                ;;
            6)
                local full_service_name="ncore-$SERVICE_NAME"
                log_info "Stopping service..."
                $USE_SUDO systemctl stop "$full_service_name"
                log_success "Service stopped"
                echo ""
                read -p "Press Enter to continue..."
                ;;
            7)
                local full_service_name="ncore-$SERVICE_NAME"
                echo -e "${CYAN}Recent logs (Ctrl+C to exit):${NC}"
                $USE_SUDO journalctl -u "$full_service_name" -n 50 --no-pager
                echo ""
                read -p "Press Enter to continue..."
                ;;
            0)
                log_info "Exiting..."
                exit 0
                ;;
            *)
                log_error "Invalid option"
                echo ""
                read -p "Press Enter to continue..."
                ;;
        esac
    done
}

# Create dynamic router service script
create_service_script() {
    log_info "Creating dynamic router monitoring script..."

    # Use tee to properly handle sudo permissions for file creation
    $USE_SUDO tee "$SERVICE_SCRIPT" > /dev/null << 'EOF'
#!/bin/bash
# Dynamic Linux Router Monitor
# Monitors interface availability and manages routing

# Configuration
WAN_KEYWORD=""
LAN_KEYWORD=""
WAN_INTERFACE=""
LAN_INTERFACE=""
SYSTEM_SHARING="no"
CORE_NODE_DATA_DIR="/var/_core_node"
CONFIG_FILE="\${CORE_NODE_DATA_DIR}/lnxrouter/interface_cache.conf"

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
        log_service "Configuration loaded: WAN=$WAN_KEYWORD, LAN=$LAN_KEYWORD, Sharing=$SYSTEM_SHARING"
        return 0
    else
        log_error "Configuration file not found: $CONFIG_FILE"
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
    local keyword="$1"
    for interface in /sys/class/net/*; do
        interface=$(basename "$interface")
        if [[ "$interface" != "lo" && "$interface" == *"$keyword"* ]]; then
            echo "$interface"
            return 0
        fi
    done
    return 1
}

# Setup routing rules
setup_routing() {
    local wan_if="$1"
    local lan_if="$2"

    log_service "Setting up routing: $wan_if -> $lan_if (System Sharing: $SYSTEM_SHARING)"

    # Enable IP forwarding
    echo 1 > /proc/sys/net/ipv4/ip_forward

    # Clear existing rules
    iptables -F FORWARD 2>/dev/null || true
    iptables -t nat -F POSTROUTING 2>/dev/null || true

    # Setup NAT
    iptables -t nat -A POSTROUTING -o "$wan_if" -j MASQUERADE

    # Setup forwarding
    iptables -A FORWARD -i "$lan_if" -o "$wan_if" -j ACCEPT
    iptables -A FORWARD -i "$wan_if" -o "$lan_if" -m state --state RELATED,ESTABLISHED -j ACCEPT

    # Handle system sharing configuration
    if [[ "$SYSTEM_SHARING" == "yes" ]]; then
        log_service "Enabling system sharing - system will use WAN for internet access"

        # Get WAN interface IP and gateway
        local wan_ip=$(ip addr show "$wan_if" 2>/dev/null | grep -oP 'inet \K[\d.]+' | head -1)
        local wan_gateway=$(ip route show dev "$wan_if" 2>/dev/null | grep -oP 'via \K[\d.]+' | head -1)

        # If no gateway found via ip route, try to detect from DHCP or default route
        if [[ -z "$wan_gateway" ]]; then
            wan_gateway=$(ip route | grep "default.*$wan_if" | grep -oP 'via \K[\d.]+' | head -1)
        fi

        # If still no gateway, try to guess from IP (typically .1 or .254)
        if [[ -z "$wan_gateway" ]] && [[ -n "$wan_ip" ]]; then
            local subnet=$(echo "$wan_ip" | cut -d. -f1-3)
            # Try common gateway IPs
            for gw in "${subnet}.1" "${subnet}.254"; do
                if ping -c 1 -W 1 "$gw" >/dev/null 2>&1; then
                    wan_gateway="$gw"
                    log_service "Detected gateway: $wan_gateway"
                    break
                fi
            done
        fi

        if [[ -n "$wan_gateway" ]]; then
            # Check if default route already exists for WAN
            if ! ip route | grep -q "default.*$wan_if"; then
                log_service "Setting default route via $wan_gateway on $wan_if"
                ip route add default via "$wan_gateway" dev "$wan_if" metric 100 2>/dev/null || {
                    log_error "Failed to add default route, may already exist"
                }
            else
                log_service "Default route via $wan_if already exists"
            fi

            # Set DNS if available (try to use WAN's DNS)
            local wan_dns=$(resolvectl status "$wan_if" 2>/dev/null | grep -oP 'DNS Servers: \K[\d.]+' | head -1)
            if [[ -n "$wan_dns" ]]; then
                log_service "Using DNS from WAN interface: $wan_dns"
            fi

            log_success "System sharing enabled - system can now use WAN ($wan_if) for internet"
        else
            log_error "Cannot enable system sharing - no gateway found for $wan_if"
            log_service "WAN IP: ${wan_ip:-NOT FOUND}"
            log_service "Only forwarding will work (LAN -> WAN)"
        fi
    else
        log_service "System sharing disabled - only forwarding traffic (LAN -> WAN)"
        log_service "System will NOT use WAN for its own internet access"

        # Ensure no default route is set via WAN (remove if exists)
        if ip route | grep -q "default.*$wan_if"; then
            log_service "Removing default route via $wan_if (system sharing disabled)"
            ip route del default dev "$wan_if" 2>/dev/null || true
        fi
    fi

    log_success "Routing rules applied successfully"
}

# Remove routing rules
remove_routing() {
    local wan_if="$1"

    log_service "Removing routing rules..."

    # If system sharing was enabled, remove default route via WAN
    if [[ -n "$wan_if" ]] && [[ "$SYSTEM_SHARING" == "yes" ]]; then
        log_service "Removing system sharing route via $wan_if"
        ip route del default dev "$wan_if" 2>/dev/null || true
    fi

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
        # Reload config every iteration to catch changes
        load_config

        # Find current interfaces
        local wan_if=$(find_interface "$WAN_KEYWORD")
        local lan_if=$(find_interface "$LAN_KEYWORD")

        # Check if both interfaces are available and up
        if [[ -n "$wan_if" ]] && [[ -n "$lan_if" ]] && check_interface "$wan_if" && check_interface "$lan_if"; then
            if [[ "$routing_active" == false ]] || [[ "$wan_if" != "$current_wan" ]] || [[ "$lan_if" != "$current_lan" ]]; then
                log_success "Interfaces available: WAN=$wan_if, LAN=$lan_if"
                setup_routing "$wan_if" "$lan_if"
                routing_active=true
                current_wan="$wan_if"
                current_lan="$lan_if"
            fi
        else
            if [[ "$routing_active" == true ]]; then
                log_error "Interface unavailable - WAN: $wan_if, LAN: $lan_if"
                remove_routing "$current_wan"
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
    log_info "  Permissions: 777 (full access)"
    log_info "  Size: $(stat -c%s "$SERVICE_SCRIPT" 2>/dev/null || echo "unknown") bytes"

    return 0
}

# Create systemd service using debian_service_manager.sh
create_systemd_service() {
    log_info "Creating systemd service using debian_service_manager.sh..."

    local service_manager="$COMMON_DIR/debian_service_manager.sh"

    if [[ ! -f "$service_manager" ]]; then
        log_error "Service manager not found: $service_manager"
        return 1
    fi

    # Call service manager to create service
    log_info "Creating service with root privileges..."
    if $USE_SUDO bash "$service_manager" create "$SERVICE_SCRIPT" "$SERVICE_NAME" "Dynamic Linux Router Service" "10%" "100M"; then
        log_success "Service created successfully"

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

# Main installation function
install_lnxrouter() {
    log_header "Dynamic Linux Router Installation"

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

    # CREATE LNXROUTER COMMAND FIRST - so it's available immediately
    if ! create_lnxrouter_command; then
        log_error "Failed to create lnxrouter command"
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
        log_success "Dynamic router service installed successfully!"
        echo ""
        echo -e "${CYAN}Installation Summary:${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        log_info "Command: lnxrouter (access anytime)"
        log_info "Service name: ncore-$SERVICE_NAME"
        log_info "Service script: $SERVICE_SCRIPT"
        log_info "Configuration: $CACHE_FILE"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""

        echo -e "${CYAN}Available Commands:${NC}"
        echo "  ${YELLOW}lnxrouter${NC}                           - Open interactive menu"
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

        echo -e "${YELLOW}The service will monitor interface availability and automatically:${NC}"
        echo -e "  ${GREEN}✓${NC} Enable routing when both WAN ($WAN_KEYWORD) and LAN ($LAN_KEYWORD) interfaces are available"
        echo -e "  ${GREEN}✓${NC} Disable routing when interfaces are disconnected"
        echo -e "  ${GREEN}✓${NC} Check every 5 seconds for interface changes"
        echo -e "  ${GREEN}✓${NC} Log activities to /var/log/lnxrouter.log"
        echo ""

        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}Setup completed successfully!${NC}"
        echo -e "${YELLOW}Run 'lnxrouter' to access the interactive menu${NC}"
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
    # Check if already installed
    if check_installation; then
        # If installed, show status first
        log_header "LnxRouter Status"
        log_success "LnxRouter is already installed and configured"
        echo ""

        # Show installation info
        echo -e "${CYAN}Installation Information:${NC}"
        echo "  Command link: $LNXROUTER_LINK"
        echo "  Script location: $(readlink -f "$LNXROUTER_LINK")"
        echo "  Configuration: $CACHE_FILE"
        echo "  Service: ncore-$SERVICE_NAME"
        echo ""

        # Check service status
        full_service_name="ncore-$SERVICE_NAME"
        echo -e "${CYAN}Service Status:${NC}"
        if systemctl is-active --quiet "$full_service_name" 2>/dev/null; then
            echo -e "  ${GREEN}Service is running${NC}"
        else
            echo -e "  ${RED}Service is not running${NC}"
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
            wan_matches=($(find_interface_by_keyword "$WAN_KEYWORD"))
            if [[ ${#wan_matches[@]} -gt 0 ]]; then
                for interface in "${wan_matches[@]}"; do
                    state=$(cat /sys/class/net/$interface/operstate 2>/dev/null || echo "unknown")
                    carrier=$(cat /sys/class/net/$interface/carrier 2>/dev/null || echo "0")
                    status_color="${RED}"
                    status_text="OFFLINE"

                    if [[ "$state" == "up" && "$carrier" == "1" ]]; then
                        status_color="${GREEN}"
                        status_text="ONLINE"
                    elif [[ "$state" == "up" ]]; then
                        status_color="${YELLOW}"
                        status_text="NO-CARRIER"
                    fi

                    echo -e "  WAN: $interface (${status_color}${status_text}${NC})"
                done
            else
                echo -e "  WAN: ${RED}No matching interface found${NC}"
            fi

            lan_matches=($(find_interface_by_keyword "$LAN_KEYWORD"))
            if [[ ${#lan_matches[@]} -gt 0 ]]; then
                for interface in "${lan_matches[@]}"; do
                    state=$(cat /sys/class/net/$interface/operstate 2>/dev/null || echo "unknown")
                    carrier=$(cat /sys/class/net/$interface/carrier 2>/dev/null || echo "0")
                    status_color="${RED}"
                    status_text="OFFLINE"

                    if [[ "$state" == "up" && "$carrier" == "1" ]]; then
                        status_color="${GREEN}"
                        status_text="ONLINE"
                    elif [[ "$state" == "up" ]]; then
                        status_color="${YELLOW}"
                        status_text="NO-CARRIER"
                    fi

                    echo -e "  LAN: $interface (${status_color}${status_text}${NC})"
                done
            else
                echo -e "  LAN: ${RED}No matching interface found${NC}"
            fi
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
                log_info "Reinstalling LnxRouter..."
                install_lnxrouter
                ;;
            * )
                log_info "Exiting..."
                exit 0
                ;;
        esac
    else
        # If not installed, prompt for installation
        log_header "LnxRouter Installation"
        log_info "LnxRouter is not installed yet."
        echo ""
        echo -e "${CYAN}LnxRouter - Dynamic Linux Router${NC}"
        echo -e "${WHITE}This tool will help you set up network routing between interfaces.${NC}"
        echo ""
        echo -e "${CYAN}Features:${NC}"
        echo -e "  ${GREEN}✓${NC} Keyword-based interface matching (dynamic hot-plug support)"
        echo -e "  ${GREEN}✓${NC} Automatic routing when interfaces are available"
        echo -e "  ${GREEN}✓${NC} Service monitoring every 5 seconds"
        echo -e "  ${GREEN}✓${NC} Interactive menu for configuration management"
        echo -e "  ${GREEN}✓${NC} System integration via systemd service"
        echo ""
        echo -e "${YELLOW}Installation Process:${NC}"
        echo -e "  1. Create 'lnxrouter' command (available immediately)"
        echo -e "  2. Scan and configure network interfaces"
        echo -e "  3. Install systemd service"
        echo -e "  4. Start monitoring service"
        echo ""
        echo -e "${CYAN}Do you want to install LnxRouter? (y/yes to continue)${NC}"
        read -p "Install? " install_response

        if [[ "$install_response" =~ ^[Yy]([Ee][Ss])?$ ]]; then
            echo ""
            log_success "Starting installation process..."
            echo -e "${YELLOW}Note: 'lnxrouter' command will be created first, even if setup is interrupted${NC}"
            echo ""
            install_lnxrouter
        else
            log_warning "Installation cancelled."
            exit 0
        fi
    fi
}

# Run main function
main "$@"
