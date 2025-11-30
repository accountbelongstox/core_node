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

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_warning "Root user detected, recommend using regular user"
        read -p "Continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_warning "User cancelled installation due to root user detection, but continuing..."
        fi
    fi
}

check_system() {
    log_info "Checking system type..."
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    else
        log_error "Cannot detect system type"
        log_warning "System check failed, but continuing..."
        return
    fi
    log_info "Detected system: $OS $VER"
    if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
        log_success "System compatibility check passed"
    else
        log_warning "Current system may not be fully compatible, but will continue"
    fi
}

update_system() {
    log_info "Updating system packages..."
    sudo apt update
    log_success "System packages updated"
}

install_system_dependencies() {
    log_info "Installing base dependencies..."
    sudo apt install -y curl wget git build-essential ffmpeg nodejs npm
    log_success "Base dependencies installed"
}

check_and_install_nodejs() {
    if ! command -v node &> /dev/null; then
        log_info "Installing Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    if command -v node &> /dev/null; then
        log_success "Node.js installation verified"
    else
        log_error "Node.js installation may have failed"
        exit 1
    fi
}

check_and_install_pnpm() {
    if ! command -v pnpm &> /dev/null; then
        log_info "Installing pnpm..."
        if command -v npm &> /dev/null; then
            npm install -g pnpm
        else
            log_error "npm not found, cannot install pnpm"
            exit 1
        fi
    fi
    
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm installation failed"
        exit 1
    else
        log_success "pnpm installation verified"
    fi
}

install_project_dependencies() {
    log_info "Installing project dependencies..."
    pnpm install
    if [[ $? -eq 0 ]]; then
        log_success "Project dependencies installed"
    else
        log_error "Project dependencies installation failed"
        exit 1
    fi
}

build_project() {
    log_info "Building project..."
    pnpm build
    if [[ $? -eq 0 ]]; then
        log_success "Project built successfully"
    else
        log_error "Project build failed"
        exit 1
    fi
}

get_local_ips() {
    IPS=()
    while IFS= read -r line; do
        if [[ $line =~ inet[[:space:]]+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+) ]]; then
            ip="${BASH_REMATCH[1]}"
            if [[ $ip != "127.0.0.1" ]]; then
                IPS+=("$ip")
            fi
        fi
    done < <(ip addr show)
    
    if [[ ${#IPS[@]} -eq 0 ]]; then
        hostname_ip=$(hostname -I 2>/dev/null | awk '{print $1}')
        if [[ -n $hostname_ip ]]; then
            IPS+=("$hostname_ip")
        fi
    fi
    
    if [[ ${#IPS[@]} -eq 0 ]]; then
        IPS=("0.0.0.0")
    fi
}

check_port_available() {
    local port=$1
    if command -v netstat &> /dev/null; then
        if netstat -tuln | grep -q ":$port "; then
            return 1
        fi
    elif command -v ss &> /dev/null; then
        if ss -tuln | grep -q ":$port "; then
            return 1
        fi
    fi
    return 0
}

find_available_port() {
    local port=8088
    while ! check_port_available $port; do
        log_warning "Port $port is occupied, trying next port"
        port=$((port + 1))
        if [[ $port -gt 8099 ]]; then
            log_error "Cannot find available port"
            return 1
        fi
    done
    echo $port
}

start_service() {
    local port=$(find_available_port)
    if [[ $? -ne 0 ]]; then
        log_error "Failed to find available port, using default port 8088"
        port=8088
    fi
    
    get_local_ips

    echo
    log_success "Service started successfully!"
    echo "Local access:"
    echo "  http://localhost:$port"
    echo
    echo "Network access:"
    for ip in "${IPS[@]}"; do
        echo "  http://$ip:$port"
    done
    echo
    echo "Video compression integrated into main server"
    echo "Press Ctrl+C to stop service"
    echo
    pnpm preview --port $port --host 0.0.0.0
}

quick_start_mode() {
    log_info "Running in Quick Start mode..."
    check_and_install_nodejs
    check_and_install_pnpm
    install_project_dependencies
    build_project
    start_service
}

deploy_mode() {
    log_info "Running in Deploy mode..."
    check_root
    check_system
    update_system
    install_system_dependencies
    check_and_install_nodejs
    check_and_install_pnpm
    install_project_dependencies
    build_project
    start_service
}

# Main menu
echo "Please choose a mode to run:"
echo "1) Quick Start (for local development)"
echo "2) Deploy (for production setup)"
read -p "Enter your choice (1 or 2): " choice

case $choice in
    1)
        quick_start_mode
        ;;
    2)
        deploy_mode
        ;;
    *)
        log_error "Invalid choice. Exiting."
        exit 1
        ;;
esac
