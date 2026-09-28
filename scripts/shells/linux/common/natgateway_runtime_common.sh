#!/bin/bash
# NAT gateway install/runtime helpers for 113_natgateway.sh.

NATGW_REQUIRED_COMMANDS="ip:iproute2 nft:nftables dnsmasq:dnsmasq-base sysctl:procps"

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

# Also finds tools in /usr/sbin and /sbin, which a non-root PATH may lack.
command_exists() {
    local cmd="$1"
    local path=""
    command -v "$cmd" >/dev/null 2>&1 && return 0
    for path in "/usr/sbin/$cmd" "/sbin/$cmd"; do
        [ -x "$path" ] && return 0
    done
    return 1
}

# Idempotent: installs only the packages whose command is missing
# (dnsmasq-base ships the binary without a system dnsmasq service on :53).
check_dependencies() {
    local entry=""
    local cmd=""
    local pkg=""
    local -a missing=()

    for entry in $NATGW_REQUIRED_COMMANDS; do
        cmd="${entry%%:*}"
        pkg="${entry#*:}"
        command_exists "$cmd" || missing+=("$pkg")
    done
    [ ${#missing[@]} -eq 0 ] && return 0

    log_info "Installing missing packages: ${missing[*]}"
    $USE_SUDO apt-get update -qq || true
    if ! $USE_SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y "${missing[@]}"; then
        log_error "Failed to install: ${missing[*]}"
        return 1
    fi
    return 0
}

check_permissions() {
    if [[ $EUID -ne 0 ]] && [[ -z "$USE_SUDO" ]]; then
        log_error "This script requires root privileges or sudo"
        return 1
    fi
    return 0
}

# Migration: remove the retired lnxrouter service, script and command link.
cleanup_old_lnxrouter() {
    local old_service_name="ncore-lnxrouter"
    local old_command_link="/usr/local/bin/lnxrouter"
    local old_service_script="/usr/local/bin/lnxrouter-monitor.sh"
    local service_unit_file="/etc/systemd/system/${old_service_name}.service"

    if [ -f "$service_unit_file" ]; then
        log_info "Removing retired service: $old_service_name"
        $USE_SUDO systemctl stop "$old_service_name" 2>/dev/null || true
        $USE_SUDO systemctl disable "$old_service_name" 2>/dev/null || true
        $USE_SUDO rm -f "$service_unit_file"
        $USE_SUDO systemctl daemon-reload 2>/dev/null || true
    fi
    if [ -e "$old_service_script" ]; then
        $USE_SUDO rm -f "$old_service_script"
    fi
    if [ -L "$old_command_link" ] || [ -f "$old_command_link" ]; then
        $USE_SUDO rm -f "$old_command_link"
    fi
    return 0
}
