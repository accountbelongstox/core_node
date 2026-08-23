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
# Supports Debian, Ubuntu, and Kali Linux
# Author: System Administrator
# Version: 3.0

set -e

# Trap to clean up on error
trap 'log_error "Script interrupted or failed at line $LINENO"' ERR

# Script identification and path setup
SCRIPT_INDEX="102"
# IMPORTANT: Resolve symlink to get the real script path
# This ensures relative paths work correctly when script is run via /usr/local/bin/natgateway
REAL_SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "$REAL_SCRIPT_PATH")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
NATGATEWAY_RUNTIME_MODULE="$SCRIPT_CURRENT_DIR/113_natgateway_runtime.sh"
NATGATEWAY_INTERFACE_MODULE="$SCRIPT_CURRENT_DIR/113_natgateway_interfaces.sh"
NATGATEWAY_MENU_MODULE="$SCRIPT_CURRENT_DIR/113_natgateway_menu.sh"

# Source global variables first
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/arrow_menu.sh"
source "$PARENT_DIR_LEVEL_2/common/systemd_service_manager.sh"
source "$NATGATEWAY_RUNTIME_MODULE"
source "$NATGATEWAY_INTERFACE_MODULE"
source "$NATGATEWAY_MENU_MODULE"

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
        create_ncore_service "$SERVICE_SCRIPT" "$SERVICE_NAME" "NAT Gateway Service" "10%" "100M"
    fi
    
    return 0
}

# Create and start the canonical Core Node systemd service.
create_natgateway_systemd_service() {
    local full_service_name="ncore-$SERVICE_NAME"

    create_ncore_service "$SERVICE_SCRIPT" "$SERVICE_NAME" "NAT Gateway Service" "10%" "100M"
    log_info "Starting $full_service_name service..."
    $USE_SUDO systemctl start "$full_service_name"
    sleep 1
    if $USE_SUDO systemctl is-active --quiet "$full_service_name" 2>/dev/null; then
        log_success "Service started and is running"
        $USE_SUDO systemctl status "$full_service_name" --no-pager -l | head -10
    else
        log_warning "Service is not active yet"
        $USE_SUDO systemctl status "$full_service_name" --no-pager -l | head -15
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
    create_natgateway_systemd_service
    if $USE_SUDO systemctl is-active --quiet "ncore-$SERVICE_NAME" 2>/dev/null; then
        log_success "NAT Gateway service installed successfully!"
        echo ""
        echo -e "${CYAN}Installation Summary:${NC}"
        echo -e "${GREEN}----------------------------------------${NC}"
        log_info "Command: natgateway (access anytime)"
        log_info "Service name: ncore-$SERVICE_NAME"
        log_info "Service script: $SERVICE_SCRIPT"
        log_info "Configuration: $CACHE_FILE"
        echo -e "${GREEN}----------------------------------------${NC}"
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
        echo -e "  ${GREEN}{NC} Enable NAT Gateway when both WAN ($WAN_KEYWORD) and LAN ($LAN_KEYWORD) are available"
        echo -e "  ${GREEN}{NC} Auto-configure LAN interface as gateway (IP: 192.168.2.1/24)"
        echo -e "  ${GREEN}{NC} Disable NAT Gateway when interfaces are disconnected"
        echo -e "  ${GREEN}{NC} Hot-plug support: Automatically detects interface changes (checks every 5 seconds)"
        echo -e "  ${GREEN}{NC} Traffic statistics: Monitor forwarded data (LAN<->WAN)"
        echo -e "  ${GREEN}{NC} Service logs: /var/log/natgateway.log"
        echo ""
        echo -e "${CYAN}Connected Router/Device Configuration:${NC}"
        echo -e "  When connecting a router or device to LAN interface ($LAN_KEYWORD):"
        echo -e "  ${YELLOW}Gateway IP:${NC} 192.168.2.1"
        echo -e "  ${YELLOW}Subnet:${NC} 192.168.2.0/24"
        echo -e "  ${YELLOW}DNS:${NC} 8.8.8.8 or 1.1.1.1"
        echo ""

        echo -e "${GREEN}----------------------------------------${NC}"
        echo -e "${GREEN}Setup completed successfully!${NC}"
        echo -e "${YELLOW}Run 'natgateway' to access the interactive menu${NC}"
        echo -e "${GREEN}----------------------------------------${NC}"
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

    # Check if non-desktop system - skip directly
    if [ "$HAS_DESKTOP_ENVIRONMENT" = false ]; then
        log_header "NAT Gateway - Non-Desktop System Detected"
        log_info "Non-desktop system detected - NAT Gateway is typically not needed on server systems"
        log_info "This tool is designed for systems with multiple network interfaces"
        log_info "and is typically used for desktop/routing scenarios"
        echo ""
        log_success "Skipping installation automatically"
        return 0
    fi

    # Check if already installed
    if check_installation; then
        # If installed, ask if user wants to skip
        log_header "NAT Gateway Status"
        log_success "NAT Gateway is already installed and configured"
        echo ""

        echo -e "${YELLOW}Do you want to skip this script? (Y/n, default: Yes)${NC}"
        read -p "Skip? [Y/n]: " skip_response

        # Default to Yes (skip)
        if [[ -z "$skip_response" ]]; then
            skip_response="y"
        fi

        if [[ "$skip_response" =~ ^[Yy]([Ee][Ss])?$ ]]; then
            log_success "Skipping NAT Gateway configuration"
            return 0
        fi

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
                echo -e "  ${YELLOW}(Service is enabled but not active - use Start/Restart Service)${NC}"
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
        # If not installed, check system type and handle accordingly
        if [ "$HAS_DESKTOP_ENVIRONMENT" = true ]; then
            # Desktop system: prompt with N/y (default No)
            log_header "NAT Gateway Installation"
            log_info "NAT Gateway is not installed yet."
            log_info "Desktop system detected - NAT Gateway is typically not needed on desktop systems"
            echo ""
            echo -e "${CYAN}NAT Gateway for Linux${NC}"
            echo -e "${WHITE}This tool sets up a NAT Gateway, allowing LAN devices to access internet through WAN interface.${NC}"
            echo ""
            echo -e "${CYAN}Features:${NC}"
            echo -e "  ${GREEN}{NC} NAT Gateway: Share WAN internet connection with LAN devices"
            echo -e "  ${GREEN}{NC} Keyword-based interface matching (hot-plug support)"
            echo -e "  ${GREEN}{NC} Automatic NAT Gateway setup when interfaces are available"
            echo -e "  ${GREEN}{NC} Auto-configure LAN interface as gateway (default: 192.168.2.1/24)"
            echo -e "  ${GREEN}{NC} Real-time monitoring (checks every 5 seconds)"
            echo -e "  ${GREEN}{NC} Interactive menu for configuration management"
            echo -e "  ${GREEN}{NC} Systemd service for automatic startup"
            echo ""
            echo -e "${YELLOW}Installation Process:${NC}"
            echo -e "  1. Create 'natgateway' command (available immediately)"
            echo -e "  2. Scan and configure WAN/LAN network interfaces"
            echo -e "  3. Configure LAN interface as gateway (auto-assign IP if needed)"
            echo -e "  4. Install systemd service for NAT Gateway monitoring"
            echo -e "  5. Start NAT Gateway service"
            echo ""
            echo -e "${CYAN}Do you want to install NAT Gateway? (N/y, default: No)${NC}"
            read -p "Install? [N/y]: " install_response

            # Default to No for desktop systems
            if [[ -z "$install_response" ]]; then
                install_response="n"
            fi

            if [[ "$install_response" =~ ^[Yy]([Ee][Ss])?$ ]]; then
                echo ""
                log_success "Starting installation process..."
                echo -e "${YELLOW}Note: 'natgateway' command will be created first, even if setup is interrupted${NC}"
                echo ""
                install_natgateway
            else
                log_info "Installation skipped on desktop system."
                exit 0
            fi
        fi
    fi
}

# Run main function
main "$@"
