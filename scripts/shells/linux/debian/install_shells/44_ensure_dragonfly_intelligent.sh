#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Do not modify these rules
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Script: 44_ensure_dragonfly_intelligent.sh
# Description: Idempotent DragonflyDB installation for Debian/Ubuntu (incl. Ubuntu 24+).
#              Uses official native packages from packages.dragonflydb.io.
# Author: System Administrator
# Design: Same style as 31_ensure_php85_intelligent.sh and 45_install_redis.sh

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_INDEX="[44_DRAGONFLY]"

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

DRAGONFLY_KEYRING="/usr/share/keyrings/dragonfly-keyring.public"
DRAGONFLY_SOURCES="/etc/apt/sources.list.d/dragonfly.sources"
DRAGONFLY_REPO_KEY_URL="https://packages.dragonflydb.io/pgp-key.public"
DRAGONFLY_SOURCES_URL="https://packages.dragonflydb.io/dragonfly.sources"

START_DRAGONFLY=$(get_global_var "START_DRAGONFLY" "false")
DRAGONFLY_DATA_DIR=$(map_web_path "compile_dir" "dragonfly/data")
DRAGONFLY_LOG_DIR=$(map_web_path "compile_dir" "dragonfly/logs")

echo -e "${CYAN}$SCRIPT_INDEX START_DRAGONFLY: $START_DRAGONFLY${NC}"

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

is_debian_or_ubuntu() {
    if [ -f /etc/os-release ]; then
        local id
        id=$(awk -F= '/^ID=/ { print $2 }' /etc/os-release | tr -d '"' | tr '[:upper:]' '[:lower:]')
        case "$id" in
            debian|ubuntu) return 0 ;;
        esac
    fi
    return 1
}

check_network_connectivity() {
    if curl -sSf --connect-timeout 5 -o /dev/null "https://packages.dragonflydb.io/" 2>/dev/null; then
        return 0
    fi
    if wget -q --spider --timeout=5 "https://packages.dragonflydb.io/" 2>/dev/null; then
        return 0
    fi
    echo -e "${YELLOW}$SCRIPT_INDEX Network check to packages.dragonflydb.io failed (optional)${NC}"
    return 1
}

check_dragonfly_installed() {
    if command_exists dragonfly; then
        return 0
    fi
    if dpkg -l | grep -q '^ii.*dragonfly[[:space:]]'; then
        return 0
    fi
    return 1
}

setup_dragonfly_repository() {
    echo -e "${BLUE}$SCRIPT_INDEX [STEP] Setting up Dragonfly repository (idempotent)...${NC}"

    if ! is_debian_or_ubuntu; then
        echo -e "${RED}$SCRIPT_INDEX Unsupported OS: only Debian/Ubuntu are supported for native packages${NC}"
        return 1
    fi

    $USE_SUDO apt update -qq 2>/dev/null || $USE_SUDO apt update

    if [ ! -f "$DRAGONFLY_KEYRING" ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX Adding Dragonfly GPG key...${NC}"
        if ! $USE_SUDO curl -sSLf -o "$DRAGONFLY_KEYRING" "$DRAGONFLY_REPO_KEY_URL"; then
            echo -e "${RED}$SCRIPT_INDEX Failed to download Dragonfly GPG key${NC}"
            return 1
        fi
        echo -e "${GREEN}$SCRIPT_INDEX Dragonfly GPG key added${NC}"
    else
        echo -e "${CYAN}$SCRIPT_INDEX Dragonfly GPG key already present${NC}"
    fi

    if [ ! -f "$DRAGONFLY_SOURCES" ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX Adding Dragonfly APT sources...${NC}"
        if ! $USE_SUDO curl -sSLf -o "$DRAGONFLY_SOURCES" "$DRAGONFLY_SOURCES_URL"; then
            echo -e "${RED}$SCRIPT_INDEX Failed to download Dragonfly sources${NC}"
            return 1
        fi
        echo -e "${GREEN}$SCRIPT_INDEX Dragonfly APT sources added${NC}"
    else
        echo -e "${CYAN}$SCRIPT_INDEX Dragonfly APT sources already present${NC}"
    fi

    $USE_SUDO apt update
    return 0
}

install_dragonfly_package() {
    echo -e "${BLUE}$SCRIPT_INDEX [STEP] Installing Dragonfly package (idempotent)...${NC}"

    if ! setup_dragonfly_repository; then
        return 1
    fi

    if $USE_SUDO apt install -y dragonfly; then
        echo -e "${GREEN}$SCRIPT_INDEX Dragonfly package installed/updated${NC}"
        return 0
    fi
    echo -e "${RED}$SCRIPT_INDEX Failed to install Dragonfly${NC}"
    return 1
}

configure_dragonfly_service_startup() {
    local start_service="$1"
    echo -e "${BLUE}$SCRIPT_INDEX [STEP] Configuring Dragonfly service startup...${NC}"

    if [ "$start_service" = "true" ]; then
        $USE_SUDO systemctl enable dragonfly 2>/dev/null || true
        $USE_SUDO systemctl start dragonfly 2>/dev/null || true
        echo -e "${GREEN}$SCRIPT_INDEX Dragonfly service enabled and started${NC}"
    else
        $USE_SUDO systemctl stop dragonfly 2>/dev/null || true
        $USE_SUDO systemctl disable dragonfly 2>/dev/null || true
        echo -e "${CYAN}$SCRIPT_INDEX Dragonfly service stopped and disabled${NC}"
    fi
    return 0
}

create_dragonfly_symlinks() {
    echo -e "${BLUE}$SCRIPT_INDEX [STEP] Creating Dragonfly symlinks...${NC}"
    local bin_path
    bin_path=$(which dragonfly 2>/dev/null)
    if [ -n "$bin_path" ] && [ -x "$bin_path" ]; then
        local symlink_path="/usr/local/bin/dragonfly"
        if [ ! -x "$symlink_path" ] || [ "$(readlink -f "$symlink_path" 2>/dev/null)" != "$(readlink -f "$bin_path" 2>/dev/null)" ]; then
            $USE_SUDO ln -sf "$bin_path" "$symlink_path"
            echo -e "${GREEN}$SCRIPT_INDEX Symlink: $symlink_path -> $bin_path${NC}"
        fi
    fi
    return 0
}

verify_dragonfly() {
    if ! systemctl is-active --quiet dragonfly 2>/dev/null; then
        return 0
    fi
    if timeout 5 redis-cli -p 6379 PING 2>/dev/null | grep -q PONG; then
        echo -e "${GREEN}$SCRIPT_INDEX Dragonfly RESP check: PONG${NC}"
        return 0
    fi
    echo -e "${YELLOW}$SCRIPT_INDEX Dragonfly service running but redis-cli PING not checked${NC}"
    return 0
}

store_dragonfly_info() {
    set_var "DRAGONFLY_BIN" "$(which dragonfly 2>/dev/null || echo '')"
    if command_exists dragonfly; then
        local ver
        ver=$(dragonfly --version 2>/dev/null | head -1 || echo "unknown")
        set_var "DRAGONFLY_VERSION" "$ver"
    fi
    set_var "DRAGONFLY_DATA_DIR" "$DRAGONFLY_DATA_DIR"
    set_var "DRAGONFLY_LOG_DIR" "$DRAGONFLY_LOG_DIR"
}

display_final_status() {
    echo -e "${CYAN}========================================================================${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX Dragonfly installation summary${NC}"
    echo -e "${CYAN}========================================================================${NC}"
    if check_dragonfly_installed; then
        echo -e "${GREEN}$SCRIPT_INDEX Binary: $(which dragonfly 2>/dev/null || echo 'N/A')${NC}"
        if command_exists dragonfly; then
            dragonfly --version 2>/dev/null | head -3 || true
        fi
        echo -e "${CYAN}$SCRIPT_INDEX Service: systemctl {start|stop|status} dragonfly${NC}"
        echo -e "${CYAN}$SCRIPT_INDEX Connect: redis-cli -p 6379 PING${NC}"
        if systemctl is-active --quiet dragonfly 2>/dev/null; then
            echo -e "${GREEN}$SCRIPT_INDEX Status: RUNNING${NC}"
        else
            echo -e "${YELLOW}$SCRIPT_INDEX Status: STOPPED${NC}"
        fi
    else
        echo -e "${YELLOW}$SCRIPT_INDEX Dragonfly not installed${NC}"
    fi
    echo -e "${CYAN}========================================================================${NC}"
}

execute_installation() {
    echo -e "${CYAN}$SCRIPT_INDEX [EXECUTION] Running full installation/repair (idempotent)...${NC}"

    if ! check_network_connectivity; then
        echo -e "${YELLOW}$SCRIPT_INDEX Proceeding without network check${NC}"
    fi

    if ! install_dragonfly_package; then
        echo -e "${RED}$SCRIPT_INDEX Installation failed${NC}"
        return 1
    fi

    create_dragonfly_symlinks
    configure_dragonfly_service_startup "$START_DRAGONFLY"
    verify_dragonfly
    store_dragonfly_info
    echo -e "${GREEN}$SCRIPT_INDEX Dragonfly installation/repair completed${NC}"
    return 0
}

main() {
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX DragonflyDB installation (Debian/Ubuntu, idempotent)${NC}"
    echo -e "${CYAN}============================================================================${NC}"

    if [ "$EUID" -eq 0 ]; then
        echo -e "${GREEN}$SCRIPT_INDEX Running as root${NC}"
    elif sudo -n true 2>/dev/null; then
        echo -e "${GREEN}$SCRIPT_INDEX Sudo access confirmed${NC}"
    else
        echo -e "${RED}$SCRIPT_INDEX This script requires root or sudo${NC}"
        exit 1
    fi

    if ! is_debian_or_ubuntu; then
        echo -e "${RED}$SCRIPT_INDEX This script supports only Debian and Ubuntu (including Ubuntu 24+)${NC}"
        exit 1
    fi

    echo -e "${BLUE}$SCRIPT_INDEX [STEP 1/2] Running full installation/repair (idempotent)...${NC}"
    execute_installation || exit 1

    echo -e "${BLUE}$SCRIPT_INDEX [STEP 2/2] Final status${NC}"
    display_final_status
}

main "$@"
exit_code=$?

echo -e "${CYAN}============================================================================${NC}"
if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}$SCRIPT_INDEX Dragonfly installation completed successfully${NC}"
else
    echo -e "${RED}$SCRIPT_INDEX Dragonfly installation failed with exit code: $exit_code${NC}"
fi
echo -e "${CYAN}============================================================================${NC}"

exit $exit_code
