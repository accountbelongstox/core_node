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
#   sh openwrt_menu.sh connect [ip]       find the OpenWrt (ip, gateway, 192.168.50.1, scan), upload the scripts and open the menu there
# Both: sh openwrt_menu.sh update         download the scripts again
#       sh openwrt_menu.sh diagnose [ip]  check addresses, router web UI/SSH, Wi-Fi, Internet
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
DEFAULT_AP_ADDRESS="192.168.50.1/24"
DEFAULT_LAN_ADDRESS="192.168.50.1/24"
WIFI_SETTINGS_FILE="/etc/openwrt-router/wifi.conf"
WIFI_PROMPT_SECONDS=5
SSH_USER="root"
# Routers reuse addresses like 192.168.1.1 and change keys on reflash, so they
# get their own known_hosts instead of failing against the user's.
SSH_KNOWN_HOSTS="$HOST_SCRIPT_DIR/known_hosts"
SSH_OPTIONS="-o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=$SSH_KNOWN_HOSTS -o ConnectTimeout=8"
SSH_SCAN_TIMEOUT=2
ROUTER_CANDIDATES="192.168.50.1 192.168.1.1"
ROUTER_HOST=""
ROUTER_KEY_NAME=""
ROUTER_SSH_OPTIONS=""
PING_TIMEOUT_MS=500
INTERNET_TARGETS="223.5.5.5 8.8.8.8 1.1.1.1"
INTERNET_TIMEOUT_MS=2000
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
    log "Running: sh $SCRIPT_DIR/$name $*"
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

current_mode() {
    if [ "$(uci -q get dhcp.lan.ignore)" = "1" ]; then
        echo "AP"
    else
        echo "router"
    fi
}

wifi_summary() {
    local iface=""

    for iface in $(uci show wireless 2>/dev/null | sed -n "s/^wireless\.\([^.]*\)=wifi-iface$/\1/p"); do
        printf "%s(%s%s) " "$(uci -q get "wireless.$iface.ssid")" "$(uci -q get "wireless.$iface.device")" "$([ "$(uci -q get "wireless.$(uci -q get "wireless.$iface.device").disabled")" = "1" ] && echo ' off')"
    done
}

menu_header() {
    echo "========== OpenWrt mode menu =========="
    echo "Mode: $(current_mode) | LAN: $(uci -q get network.lan.ipaddr) | WAN: $(uci -q get network.wan.proto) | Scripts: $SCRIPT_DIR"
    echo "Wi-Fi: $(wifi_summary)"
    echo "  1) Switch to AP mode (management 192.168.50.1, upstream router serves DHCP)"
    echo "  2) AP mode status"
    echo "  3) Restore from AP mode backup"
    echo "  4) Switch to router mode (LAN 192.168.50.1, DHCP, bandwidth balancer)"
    echo "  5) Router mode and balancer status"
    echo "  6) Restore from router mode backup"
    echo "  7) Update scripts"
    echo "  8) Diagnose network, web UI, Wi-Fi and Internet"
    echo "  9) Set Wi-Fi names (5G / 2.4G) and password"
    echo "  0) Exit"
}

# Both mode scripts carry the same Wi-Fi command; the active mode's runs it.
mode_script() {
    if [ "$(current_mode)" = "AP" ]; then
        echo "$AP_SCRIPT_NAME"
    else
        echo "$ROUTER_SCRIPT_NAME"
    fi
}

wifi_setting() {
    [ -f "$WIFI_SETTINGS_FILE" ] && sed -n "s/^$1='\(.*\)'$/\1/p" "$WIFI_SETTINGS_FILE"
}

wifi_menu() {
    local ssid_5g=""
    local ssid_24=""
    local key=""

    echo "Names: English letters, digits and - _ . only. Empty keeps the current (or default) value."
    ask "5G Wi-Fi name" "$(wifi_setting WIFI_SSID_5G)"
    ssid_5g="$MENU_INPUT"
    ask "2.4G Wi-Fi name" "$(wifi_setting WIFI_SSID_24)"
    ssid_24="$MENU_INPUT"
    ask "Wi-Fi password for both, 8-63 characters" "$(wifi_setting WIFI_KEY)"
    key="$MENU_INPUT"
    run_script "$(mode_script)" wifi "$ssid_5g" "$ssid_24" "$key"
}

# Applies the saved Wi-Fi idempotently, then offers a change that skips itself
# after WIFI_PROMPT_SECONDS.
wifi_startup() {
    log "Checking Wi-Fi (idempotent: only differences change)"
    run_script "$(mode_script)" wifi
    printf 'Change Wi-Fi names/password? [y/N] (skips in %ss): ' "$WIFI_PROMPT_SECONDS"
    if read -t "$WIFI_PROMPT_SECONDS" -r MENU_INPUT 2>/dev/null; then
        case "$MENU_INPUT" in
            y|Y|yes|YES) wifi_menu; return 0 ;;
        esac
    else
        echo
    fi
    log "Wi-Fi settings kept"
}

router_menu() {
    local address=""
    local gateway=""

    while true; do
        menu_header
        printf 'Choose: '
        read -r MENU_INPUT || return 0
        MENU_INPUT="$(printf '%s' "$MENU_INPUT" | tr -cd '0-9qQ')"
        case "$MENU_INPUT" in
            "") continue ;;
            1)
                ask "AP management address/prefix" "$DEFAULT_AP_ADDRESS"
                address="$MENU_INPUT"
                printf 'Static gateway (empty = DHCP from the upstream router + NAT, the default): '
                read -r gateway || gateway=""
                confirm "Switch to AP mode at $address${gateway:+ via $gateway}?" && run_script "$AP_SCRIPT_NAME" apply "$address" "$gateway"
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
            8) router_diagnose ;;
            9) wifi_menu ;;
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
    local timeout_ms="${2:-$PING_TIMEOUT_MS}"

    if is_windows_shell; then
        ping -n 1 -w "$timeout_ms" "$1" >/dev/null 2>&1
    else
        ping -c 1 -W $(((timeout_ms + 999) / 1000)) "$1" >/dev/null 2>&1
    fi
}

# Prints the first public target that answers within INTERNET_TIMEOUT_MS.
internet_target() {
    local target=""

    for target in $INTERNET_TARGETS; do
        if is_openwrt; then
            ping -c 2 -W $((INTERNET_TIMEOUT_MS / 1000)) "$target" >/dev/null 2>&1 && { echo "$target"; return 0; }
        else
            ping_host "$target" "$INTERNET_TIMEOUT_MS" && { echo "$target"; return 0; }
        fi
    done
    return 1
}

report_internet() {
    local target=""

    target="$(internet_target)"
    if [ -n "$target" ]; then
        report OK "Internet: $target reachable"
    else
        report FAIL "Internet: none of $INTERNET_TARGETS reachable"
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

ssh_banner_label() {
    local banner=""

    banner="$(ssh_banner "$1")"
    echo "${banner:-no SSH}"
}

# The wanted address when it runs OpenWrt's Dropbear SSH, else the gateway, the
# usual OpenWrt addresses and finally a LAN scan (addresses move between modes,
# and the upstream router may hold the old one).
find_router() {
    local wanted="$1"
    local candidate=""
    local banner=""
    local seen=" "

    ROUTER_HOST=""
    for candidate in $wanted $(default_gateway) $ROUTER_CANDIDATES; do
        case "$seen" in *" $candidate "*) continue ;; esac
        seen="$seen$candidate "
        banner="$(ssh_banner_label "$candidate")"
        case "$banner" in
            *dropbear*) log "$candidate: $banner (OpenWrt)"; ROUTER_HOST="$candidate"; break ;;
            *) log "$candidate: $banner (not OpenWrt)" ;;
        esac
    done
    if [ -z "$ROUTER_HOST" ]; then
        log "No OpenWrt on the usual addresses; scanning the LAN"
        scan_lan "" >/dev/null && ROUTER_HOST="$(first_candidate)"
    fi
    if [ -n "$wanted" ] && [ -n "$ROUTER_HOST" ] && [ "$ROUTER_HOST" != "$wanted" ]; then
        log "$wanted is not OpenWrt; using $ROUTER_HOST"
    fi
}

# Router host keys are stored per MAC address, so a key follows its router
# across address changes and never clashes with the device that takes the old
# address.
router_ssh_options() {
    local mac=""

    mac="$(lan_neighbors "${1%.*}" | awk -v ip="$1" '$1 == ip {print $2; exit}' | tr -d ':-')"
    ROUTER_KEY_NAME="${mac:+openwrt-$mac}"
    ROUTER_KEY_NAME="${ROUTER_KEY_NAME:-$1}"
    ROUTER_SSH_OPTIONS="$SSH_OPTIONS -o HostKeyAlias=$ROUTER_KEY_NAME"
    log "SSH host key entry: $ROUTER_KEY_NAME"
}

# Only this tool's own known_hosts is touched; a changed key there means the
# router was reflashed or reset.
reset_changed_host_key() {
    if ssh $ROUTER_SSH_OPTIONS -o BatchMode=yes -o PasswordAuthentication=no "$SSH_USER@$1" true 2>&1 | grep -q "HOST IDENTIFICATION HAS CHANGED"; then
        ssh-keygen -R "$ROUTER_KEY_NAME" -f "$SSH_KNOWN_HOSTS" >/dev/null 2>&1
        log "Host key of $ROUTER_KEY_NAME changed (router reflashed or reset); old entry removed from $SSH_KNOWN_HOSTS"
    fi
}

print_remote_steps() {
    local target="$1"

    echo "----------------------------------------------------------------"
    echo "This uploads the scripts to $ROUTER_SCRIPT_DIR on $target and opens the menu there."
    echo "Each SSH step may ask for the router password (empty on a fresh OpenWrt)."
    echo "If an automatic step fails, log in with:  ssh $ROUTER_SSH_OPTIONS $target"
    echo "then run on the router (it needs Internet):"
    echo "  mkdir -p $ROUTER_SCRIPT_DIR && wget -qO $ROUTER_SCRIPT_DIR/$MENU_SCRIPT_NAME $SCRIPTS_URL/$MENU_SCRIPT_NAME && sh $ROUTER_SCRIPT_DIR/$MENU_SCRIPT_NAME"
    echo "Later logins only need:  sh $ROUTER_SCRIPT_DIR/$MENU_SCRIPT_NAME"
    echo "No SSH answer: plug this PC into a router LAN port, or use OpenWrt failsafe (192.168.1.1)."
    echo "----------------------------------------------------------------"
}

connect_host() {
    local target=""

    find_router "$1"
    if [ -z "$ROUTER_HOST" ]; then
        log "No OpenWrt (Dropbear SSH) found: plug this PC into a router LAN port, or use OpenWrt failsafe"
        return 1
    fi
    target="$SSH_USER@$ROUTER_HOST"
    mkdir -p "$HOST_SCRIPT_DIR"
    router_ssh_options "$ROUTER_HOST"
    reset_changed_host_key "$ROUTER_HOST"
    print_remote_steps "$target"
    confirm "Continue with $target?" || return 0
    log "Uploading $MENU_SCRIPT_NAME $MANAGED_SCRIPTS"
    if (cd "$SCRIPT_DIR" && tar -cf - "$MENU_SCRIPT_NAME" $MANAGED_SCRIPTS) | ssh $ROUTER_SSH_OPTIONS "$target" "mkdir -p $ROUTER_SCRIPT_DIR && tar -xf - -C $ROUTER_SCRIPT_DIR"; then
        ssh -t $ROUTER_SSH_OPTIONS "$target" "sh $ROUTER_SCRIPT_DIR/$MENU_SCRIPT_NAME" || log "SSH session ended (a network restart after a mode switch drops it; run connect again to find the new address)"
    else
        log "Upload failed; opening a plain SSH shell (run the commands shown above)"
        ssh $ROUTER_SSH_OPTIONS "$target"
    fi
}

report() {
    printf '  [%s] %s\n' "$1" "$2"
}

local_addresses() {
    if is_windows_shell; then
        ipconfig 2>/dev/null | tr -d '\r' | sed -n 's/.*IPv4[^:]*: *\([0-9.]*\).*/\1/p'
    else
        ip -4 -o addr show 2>/dev/null | awk '{split($4, a, "/"); print a[1]}'
    fi
}

http_probe() {
    if command -v curl >/dev/null 2>&1; then
        curl -s -k -m 4 --noproxy '*' "$1" 2>/dev/null
    else
        wget -q -T 4 -O - "$1" 2>/dev/null
    fi
}

host_diagnose() {
    local target="$1"
    local gateway=""
    local prefix=""
    local mac=""
    local banner=""
    local page=""
    local scheme=""

    gateway="$(default_gateway)"
    [ -n "$target" ] || target="$gateway"
    echo "========== Network diagnosis (this PC) =========="
    report INFO "PC addresses: $(local_addresses | grep -v '^127\.' | tr '\n' ' ')"
    if [ -z "$gateway" ]; then
        report FAIL "No default gateway: check the cable or Wi-Fi link and DHCP"
    else
        report INFO "Default gateway: $gateway"
    fi
    [ -n "$target" ] || return 1
    if local_addresses | grep -qx "$target"; then
        report WARN "$target is this PC's own address, not the router; the router UI is http://$gateway/"
        target="$gateway"
    fi
    prefix="${target%.*}"
    ping_host "$target" && report OK "$target answers ping" || report WARN "$target does not answer ping (a firewall may drop it)"
    mac="$(lan_neighbors "$prefix" | awk -v ip="$target" '$1 == ip {print $2; exit}')"
    if [ -n "$mac" ]; then
        report OK "$target is at MAC $mac"
    else
        report FAIL "$target does not answer ARP: it is not on this network segment"
    fi
    banner="$(ssh_banner "$target")"
    case "$banner" in
        *dropbear*) report OK "SSH: $banner (OpenWrt)" ;;
        "") report WARN "SSH: no answer on port 22" ;;
        *) report INFO "SSH: $banner (not OpenWrt's Dropbear)" ;;
    esac
    for scheme in http https; do
        page="$(http_probe "$scheme://$target/")"
        case "$page" in
            *luci*|*LuCI*) report OK "$scheme://$target/ serves LuCI (OpenWrt web UI)" ;;
            "") report WARN "$scheme://$target/ gives no page" ;;
            *) report INFO "$scheme://$target/ serves a page that is not LuCI" ;;
        esac
    done
    lan_neighbors "$prefix" | awk '{print $2}' | sort | uniq -d | grep -q . && report WARN "One MAC holds several addresses on $prefix.0/24"
    report_internet
    nslookup example.com >/dev/null 2>&1 && report OK "DNS: example.com resolves" || report FAIL "DNS: example.com does not resolve"
}

router_diagnose() {
    local lan_ip=""
    local wan_ip=""
    local service=""
    local radio=""
    local iface=""

    lan_ip="$(uci -q get network.lan.ipaddr)"
    lan_ip="${lan_ip%%/*}"
    wan_ip="$(ifstatus wan 2>/dev/null | jsonfilter -e '@["ipv4-address"][0].address' 2>/dev/null)"
    echo "========== OpenWrt diagnosis =========="
    report INFO "$(sed -n "s/^DISTRIB_DESCRIPTION='\(.*\)'$/\1/p" /etc/openwrt_release)"
    report INFO "LAN: $(uci -q get network.lan.proto) ${lan_ip:-no address} | WAN: $(uci -q get network.wan.proto) ${wan_ip:-no address}"
    if [ -n "$lan_ip" ] && [ -n "$wan_ip" ] && [ "${lan_ip%.*}" = "${wan_ip%.*}" ]; then
        report FAIL "LAN and WAN share ${lan_ip%.*}.0/24: routing breaks; move the LAN (router mode) or bridge the WAN (AP mode)"
    fi
    [ "$(uci -q get dhcp.lan.ignore)" = "1" ] && report INFO "DHCP on LAN: off (AP mode)" || report INFO "DHCP on LAN: on"
    ip -4 route show default 2>/dev/null | grep -q . && report OK "Default route: $(ip -4 route show default | head -n 1)" || report FAIL "No default route"
    for service in uhttpd dropbear dnsmasq odhcpd firewall router-balance; do
        [ -x "/etc/init.d/$service" ] || continue
        if "/etc/init.d/$service" running >/dev/null 2>&1; then
            report OK "Service $service running"
        else
            report WARN "Service $service not running ($("/etc/init.d/$service" enabled && echo enabled || echo disabled))"
        fi
    done
    netstat -ltn 2>/dev/null | grep -qE ':80 ' && report OK "Web UI listens on port 80" || report WARN "Nothing listens on port 80"
    for radio in $(uci show wireless 2>/dev/null | sed -n "s/^wireless\.\([^.]*\)=wifi-device$/\1/p"); do
        [ "$(uci -q get "wireless.$radio.disabled")" = "1" ] && report WARN "Wi-Fi $radio disabled (uci set wireless.$radio.disabled=0; uci commit wireless; wifi reload)" || report OK "Wi-Fi $radio enabled"
    done
    for iface in $(uci show wireless 2>/dev/null | sed -n "s/^wireless\.\([^.]*\)=wifi-iface$/\1/p"); do
        report INFO "SSID $(uci -q get "wireless.$iface.ssid") on $(uci -q get "wireless.$iface.device"): network $(uci -q get "wireless.$iface.network"), encryption $(uci -q get "wireless.$iface.encryption"), disabled $(uci -q get "wireless.$iface.disabled" || echo 0)"
    done
    report_internet
    nslookup example.com 127.0.0.1 >/dev/null 2>&1 && report OK "DNS: local resolver works" || report WARN "DNS: local resolver does not answer"
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
        diagnose) router_diagnose ;;
        "")
            wifi_startup
            network_check
            router_menu
            ;;
        *) sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//' ;;
    esac
else
    ensure_scripts "$MENU_SCRIPT_NAME" $MANAGED_SCRIPTS || log "Some scripts are missing; the upload needs them"
    case "$1" in
        scan) scan_lan "$2" ;;
        connect) connect_host "$2" ;;
        update) update_scripts "$MENU_SCRIPT_NAME" $MANAGED_SCRIPTS ;;
        diagnose) host_diagnose "$2" ;;
        "") host_main ;;
        *) sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//' ;;
    esac
fi
