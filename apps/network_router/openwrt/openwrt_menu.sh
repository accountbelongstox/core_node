#!/bin/sh
# One menu for the OpenWrt mode scripts. Every run makes sure ap_mode.sh and
# router_mode.sh sit next to this script and downloads the missing ones.
# Run on the router:
#   sh openwrt_menu.sh                    interactive menu
#   sh openwrt_menu.sh ap <args>          pass through to ap_mode.sh
#   sh openwrt_menu.sh router <args>      pass through to router_mode.sh
#   sh openwrt_menu.sh update             download both scripts again
# OPENWRT_SCRIPTS_URL overrides the download base URL.

GITHUB_RAW_HOST="https://raw.githubusercontent.com"
GITHUB_OWNER="accountbelongstox"
GITHUB_REPO="core_node"
GITHUB_BRANCH="main"
GITHUB_RAW_BASE_URL="$GITHUB_RAW_HOST/$GITHUB_OWNER/$GITHUB_REPO/$GITHUB_BRANCH"
OPENWRT_SCRIPTS_PATH="apps/network_router/openwrt"
SCRIPTS_URL="${OPENWRT_SCRIPTS_URL:-$GITHUB_RAW_BASE_URL/$OPENWRT_SCRIPTS_PATH}"
FALLBACK_DIR="/root/openwrt-router"
AP_SCRIPT_NAME="ap_mode.sh"
ROUTER_SCRIPT_NAME="router_mode.sh"
MANAGED_SCRIPTS="$AP_SCRIPT_NAME $ROUTER_SCRIPT_NAME"
DEFAULT_AP_ADDRESS="192.168.50.2/24"
DEFAULT_AP_GATEWAY="192.168.50.1"
DEFAULT_LAN_ADDRESS="192.168.60.1/24"
SCRIPT_DIR=""
MENU_INPUT=""

log() {
    echo "[OPENWRT-MENU] $*"
}

# Piped runs (curl ... | sh) have no script file, so they keep the scripts in
# FALLBACK_DIR.
resolve_script_dir() {
    case "$0" in
        */openwrt_menu.sh|openwrt_menu.sh) SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)" ;;
        *) SCRIPT_DIR="$FALLBACK_DIR" ;;
    esac
    mkdir -p "$SCRIPT_DIR"
}

download() {
    local url="$1"
    local target="$2"

    if command -v uclient-fetch >/dev/null 2>&1; then
        uclient-fetch -q -O "$target" "$url"
    elif command -v wget >/dev/null 2>&1; then
        wget -q -O "$target" "$url"
    elif command -v curl >/dev/null 2>&1; then
        curl -fsSL -o "$target" "$url"
    else
        log "No uclient-fetch, wget or curl to download $url"
        return 1
    fi
}

fetch_script() {
    local name="$1"
    local target="$SCRIPT_DIR/$name"
    local partial="$target.part"

    if download "$SCRIPTS_URL/$name" "$partial" && head -n 1 "$partial" | grep -q '^#!'; then
        mv "$partial" "$target"
        chmod +x "$target"
        log "Downloaded $name"
        return 0
    fi
    rm -f "$partial"
    log "Download failed: $SCRIPTS_URL/$name"
    return 1
}

ensure_scripts() {
    local name=""
    local result=0

    for name in $MANAGED_SCRIPTS; do
        [ -s "$SCRIPT_DIR/$name" ] && continue
        fetch_script "$name" || result=1
    done
    return "$result"
}

update_scripts() {
    local name=""

    for name in $MANAGED_SCRIPTS; do
        fetch_script "$name"
    done
}

run_script() {
    local name="$1"
    shift
    if [ ! -s "$SCRIPT_DIR/$name" ]; then
        log "$name is missing; check the network and choose Update scripts"
        return 1
    fi
    sh "$SCRIPT_DIR/$name" "$@"
}

ask() {
    local prompt="$1"
    local fallback="$2"

    printf '%s [%s]: ' "$prompt" "$fallback"
    read -r MENU_INPUT || MENU_INPUT=""
    [ -n "$MENU_INPUT" ] || MENU_INPUT="$fallback"
}

confirm() {
    printf '%s [y/N]: ' "$1"
    read -r MENU_INPUT || MENU_INPUT=""
    case "$MENU_INPUT" in
        y|Y|yes|YES) return 0 ;;
    esac
    return 1
}

pause() {
    printf 'Press Enter to continue...'
    read -r MENU_INPUT || MENU_INPUT=""
}

menu_header() {
    local mode="unknown"

    if [ "$(uci -q get dhcp.lan.ignore)" = "1" ] && [ "$(uci -q get network.wan.proto)" = "none" ]; then
        mode="AP"
    elif [ "$(uci -q get network.wan.proto)" != "none" ] && [ -n "$(uci -q get network.wan.proto)" ]; then
        mode="router"
    fi
    echo "========== OpenWrt mode menu =========="
    echo "Mode: $mode | LAN: $(uci -q get network.lan.ipaddr) | Scripts: $SCRIPT_DIR"
    echo "  1) Switch to AP mode"
    echo "  2) AP mode status"
    echo "  3) Restore from AP mode backup"
    echo "  4) Switch to router mode (DHCP + bandwidth balancer)"
    echo "  5) Router mode and balancer status"
    echo "  6) Restore from router mode backup"
    echo "  7) Update scripts"
    echo "  0) Exit"
}

menu() {
    local address=""
    local gateway=""

    while true; do
        menu_header
        printf 'Choose: '
        read -r MENU_INPUT || return 0
        case "$MENU_INPUT" in
            1)
                ask "AP address/prefix" "$DEFAULT_AP_ADDRESS"
                address="$MENU_INPUT"
                ask "Upstream gateway" "$DEFAULT_AP_GATEWAY"
                gateway="$MENU_INPUT"
                confirm "Switch to AP mode at $address via $gateway?" && run_script "$AP_SCRIPT_NAME" apply "$address" "$gateway"
                ;;
            2) run_script "$AP_SCRIPT_NAME" status ;;
            3) confirm "Restore the newest AP mode backup?" && run_script "$AP_SCRIPT_NAME" restore ;;
            4)
                ask "LAN address/prefix" "$DEFAULT_LAN_ADDRESS"
                address="$MENU_INPUT"
                confirm "Switch to router mode with LAN $address?" && run_script "$ROUTER_SCRIPT_NAME" apply "$address"
                ;;
            5) run_script "$ROUTER_SCRIPT_NAME" status ;;
            6) confirm "Restore the newest router mode backup?" && run_script "$ROUTER_SCRIPT_NAME" restore ;;
            7) update_scripts ;;
            0|q|Q) return 0 ;;
            *) log "Unknown choice: $MENU_INPUT" ;;
        esac
        pause
    done
}

resolve_script_dir
ensure_scripts || log "Some scripts are missing; their menu entries will fail until downloaded"

case "$1" in
    ap) shift; run_script "$AP_SCRIPT_NAME" "$@" ;;
    router) shift; run_script "$ROUTER_SCRIPT_NAME" "$@" ;;
    update) update_scripts ;;
    "") menu ;;
    *) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//' ;;
esac
