#!/bin/sh
# One menu for the OpenWrt mode scripts. Every run makes sure ap_mode.sh and
# router_mode.sh sit next to this script and downloads the missing ones.
# On OpenWrt (run as root):
#   sh openwrt_menu.sh                    interactive menu
#   sh openwrt_menu.sh ap <args>          pass through to ap_mode.sh
#   sh openwrt_menu.sh router <args>      pass through to router_mode.sh
# On a PC (Linux, or Git Bash on Windows):
#   sh openwrt_menu.sh                    scan the LAN, pick a router, upload the scripts over SSH and open the menu there
#   sh openwrt_menu.sh scan [a.b.c]       list LAN hosts (default: the gateway's /24)
#   sh openwrt_menu.sh connect <ip>       upload the scripts to <ip> and open the menu there
# Both: sh openwrt_menu.sh update         download the scripts again
# OPENWRT_SCRIPTS_URL overrides the download base URL.

GITHUB_RAW_HOST="https://raw.githubusercontent.com"
GITHUB_OWNER="accountbelongstox"
GITHUB_REPO="core_node"
GITHUB_BRANCH="main"
GITHUB_RAW_BASE_URL="$GITHUB_RAW_HOST/$GITHUB_OWNER/$GITHUB_REPO/$GITHUB_BRANCH"
OPENWRT_SCRIPTS_PATH="apps/network_router/openwrt"
SCRIPTS_URL="${OPENWRT_SCRIPTS_URL:-$GITHUB_RAW_BASE_URL/$OPENWRT_SCRIPTS_PATH}"
ROUTER_SCRIPT_DIR="/root/openwrt-router"
HOST_SCRIPT_DIR="$HOME/openwrt-router"
MENU_SCRIPT_NAME="openwrt_menu.sh"
AP_SCRIPT_NAME="ap_mode.sh"
ROUTER_SCRIPT_NAME="router_mode.sh"
MANAGED_SCRIPTS="$AP_SCRIPT_NAME $ROUTER_SCRIPT_NAME"
DEFAULT_AP_ADDRESS="192.168.50.2/24"
DEFAULT_AP_GATEWAY="192.168.50.1"
DEFAULT_LAN_ADDRESS="192.168.60.1/24"
SSH_USER="root"
SSH_OPTIONS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=8"
SSH_SCAN_TIMEOUT=2
PING_TIMEOUT_MS=500
SCAN_BATCH=64
SCRIPT_DIR=""
MENU_INPUT=""
SCAN_FILE=""
PICKED_HOST=""

log() {
    echo "[OPENWRT-MENU] $*"
}

is_openwrt() {
    [ -f /etc/openwrt_release ]
}

is_windows_shell() {
    case "$(uname -s)" in
        MINGW*|MSYS*|CYGWIN*) return 0 ;;
    esac
    return 1
}

# Piped runs (curl ... | sh) have no script file, so they keep the scripts in
# the router or host script directory.
resolve_script_dir() {
    case "$0" in
        */$MENU_SCRIPT_NAME|$MENU_SCRIPT_NAME) SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)" ;;
        *) is_openwrt && SCRIPT_DIR="$ROUTER_SCRIPT_DIR" || SCRIPT_DIR="$HOST_SCRIPT_DIR" ;;
    esac
    mkdir -p "$SCRIPT_DIR"
    SCAN_FILE="${TMPDIR:-/tmp}/openwrt_menu.scan"
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

    for name in "$@"; do
        [ -s "$SCRIPT_DIR/$name" ] && continue
        fetch_script "$name" || result=1
    done
    return "$result"
}

update_scripts() {
    local name=""

    for name in "$@"; do
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

router_menu() {
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
            7) update_scripts $MANAGED_SCRIPTS ;;
            0|q|Q) return 0 ;;
            *) log "Unknown choice: $MENU_INPUT" ;;
        esac
        pause
    done
}

default_gateway() {
    if is_windows_shell; then
        route print -4 0.0.0.0 2>/dev/null | tr -d '\r' | awk '$1 == "0.0.0.0" && $2 == "0.0.0.0" {print $3; exit}'
    else
        ip -4 route show default 2>/dev/null | awk '{print $3; exit}'
    fi
}

ping_host() {
    if is_windows_shell; then
        ping -n 1 -w "$PING_TIMEOUT_MS" "$1" >/dev/null 2>&1
    else
        ping -c 1 -W 1 "$1" >/dev/null 2>&1
    fi
}

# Pinging fills the neighbor table; routers that drop ping still answer ARP.
sweep_subnet() {
    local prefix="$1"
    local host=1

    while [ "$host" -le 254 ]; do
        ping_host "$prefix.$host" &
        [ $((host % SCAN_BATCH)) -eq 0 ] && wait
        host=$((host + 1))
    done
    wait
}

lan_neighbors() {
    {
        if ! is_windows_shell && command -v ip >/dev/null 2>&1; then
            ip -4 neigh show 2>/dev/null
        else
            arp -a 2>/dev/null
        fi
    } | tr -d '\r()' | awk -v prefix="$1." '
        {
            address = ""; mac = ""
            for (i = 1; i <= NF; i++) {
                if (index($i, prefix) == 1) address = $i
                if (length($i) == 17 && $i ~ /^[0-9a-fA-F][0-9a-fA-F][-:][0-9a-fA-F][0-9a-fA-F][-:]/) mac = tolower($i)
            }
            if (address == "" || mac == "" || address ~ /\.255$/) next
            if (mac == "ff-ff-ff-ff-ff-ff" || mac == "ff:ff:ff:ff:ff:ff" || mac ~ /^01[-:]00[-:]5e/) next
            print address, mac
        }' | sort -u -t . -k 4,4n
}

ssh_banner() {
    command -v ssh-keyscan >/dev/null 2>&1 || return 0
    ssh-keyscan -T "$SSH_SCAN_TIMEOUT" "$1" 2>&1 | tr -d '\r' | sed -n 's/^# [^ ]* \(SSH-[^ ]*\).*/\1/p' | head -n 1
}

scan_lan() {
    local prefix="$1"
    local address=""
    local mac=""
    local banner=""
    local index=0
    local label=""

    [ -n "$prefix" ] || prefix="$(default_gateway | sed 's/\.[0-9]*$//')"
    [ -n "$prefix" ] || { log "No default gateway; pass the subnet: scan a.b.c"; return 1; }
    log "Scanning $prefix.1-254 (about 10-30s)"
    sweep_subnet "$prefix"
    : > "$SCAN_FILE"
    lan_neighbors "$prefix" | while read -r address mac; do
        banner="$(ssh_banner "$address")"
        echo "$address $mac ${banner:-none}" >> "$SCAN_FILE"
    done
    [ -s "$SCAN_FILE" ] || { log "No hosts found on $prefix.0/24"; return 1; }
    while read -r address mac banner; do
        index=$((index + 1))
        case "$banner" in
            *dropbear*) label="OpenWrt candidate" ;;
            none) label="no SSH (firewall, or no SSH server)" ;;
            *) label="SSH" ;;
        esac
        printf '  %2d) %-15s %s  ssh=%s  %s\n' "$index" "$address" "$mac" "$banner" "$label"
    done < "$SCAN_FILE"
}

first_candidate() {
    awk '$3 ~ /dropbear/ {print $1; exit}' "$SCAN_FILE"
}

pick_host() {
    local fallback=""

    PICKED_HOST=""
    fallback="$(first_candidate)"
    ask "Router number or IP (empty to quit)" "$fallback"
    case "$MENU_INPUT" in
        *.*) PICKED_HOST="$MENU_INPUT" ;;
        ''|*[!0-9]*) ;;
        *) PICKED_HOST="$(sed -n "${MENU_INPUT}p" "$SCAN_FILE" | awk '{print $1}')" ;;
    esac
}

print_remote_steps() {
    local target="$1"

    echo "----------------------------------------------------------------"
    echo "This uploads the scripts to $ROUTER_SCRIPT_DIR on $target and opens the menu there."
    echo "Each SSH step may ask for the router password (empty on a fresh OpenWrt)."
    echo "If an automatic step fails, log in with:  ssh $target"
    echo "then run on the router (it needs Internet):"
    echo "  mkdir -p $ROUTER_SCRIPT_DIR && wget -qO $ROUTER_SCRIPT_DIR/$MENU_SCRIPT_NAME $SCRIPTS_URL/$MENU_SCRIPT_NAME && sh $ROUTER_SCRIPT_DIR/$MENU_SCRIPT_NAME"
    echo "Later logins only need:  sh $ROUTER_SCRIPT_DIR/$MENU_SCRIPT_NAME"
    echo "No SSH answer: plug this PC into a router LAN port, or use OpenWrt failsafe (192.168.1.1)."
    echo "----------------------------------------------------------------"
}

connect_host() {
    local target="$SSH_USER@$1"

    print_remote_steps "$target"
    confirm "Continue with $target?" || return 0
    log "Uploading $MENU_SCRIPT_NAME $MANAGED_SCRIPTS"
    if (cd "$SCRIPT_DIR" && tar -cf - "$MENU_SCRIPT_NAME" $MANAGED_SCRIPTS) | ssh $SSH_OPTIONS "$target" "mkdir -p $ROUTER_SCRIPT_DIR && tar -xf - -C $ROUTER_SCRIPT_DIR"; then
        ssh -t $SSH_OPTIONS "$target" "sh $ROUTER_SCRIPT_DIR/$MENU_SCRIPT_NAME"
    else
        log "Upload failed; opening a plain SSH shell (run the commands shown above)"
        ssh $SSH_OPTIONS "$target"
    fi
}

host_main() {
    command -v ssh >/dev/null 2>&1 || { log "ssh is missing on this PC"; return 1; }
    scan_lan "$1" || return 1
    pick_host
    [ -n "$PICKED_HOST" ] || return 0
    connect_host "$PICKED_HOST"
}

resolve_script_dir
if is_openwrt; then
    ensure_scripts $MANAGED_SCRIPTS || log "Some scripts are missing; their menu entries will fail until downloaded"
    case "$1" in
        ap) shift; run_script "$AP_SCRIPT_NAME" "$@" ;;
        router) shift; run_script "$ROUTER_SCRIPT_NAME" "$@" ;;
        update) update_scripts $MANAGED_SCRIPTS ;;
        "") router_menu ;;
        *) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//' ;;
    esac
else
    ensure_scripts "$MENU_SCRIPT_NAME" $MANAGED_SCRIPTS || log "Some scripts are missing; the upload needs them"
    case "$1" in
        scan) scan_lan "$2" ;;
        connect) [ -n "$2" ] && connect_host "$2" || log "Usage: sh $MENU_SCRIPT_NAME connect <ip>" ;;
        update) update_scripts "$MENU_SCRIPT_NAME" $MANAGED_SCRIPTS ;;
        "") host_main ;;
        *) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//' ;;
    esac
fi
