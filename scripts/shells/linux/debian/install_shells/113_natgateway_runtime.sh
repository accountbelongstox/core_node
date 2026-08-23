#!/bin/bash

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

