#!/bin/bash
# NAT gateway engine shared by the natgateway CLI/menu (113_natgateway.sh) and
# the monitor daemon (debian_com/natgateway_monitor.sh).
#
# ROUTE_MODE=single: one uplink (a USB network adapter, auto, or a named
# interface) relayed to one, a list, or all onboard wired ports joined into one
# bridge (ncbr0).
# ROUTE_MODE=pairs: every relay port picks its USB uplink: auto (the pool of
# all USBs, in detection order, LAN1 first), an interface, usb@<port> (the
# physical USB port, stable while a phone renames its interface on every
# reconnect) or a "+" pool of those (first ready wins). Relay ports are named
# LAN1, LAN2...: LAN_MAP maps each name to a port (default: the N-th onboard
# wired port), and PAIRS refers to those names. A USB serves one relay
# port at most (1:1 or many:1). Each pair gets its own bridge (ncbr<N>),
# subnet, DHCP/DNS server and routing table (policy rule "iif ncbr<N>"). A pair
# goes live when its USB adapter appears; when it leaves, the bridge and its
# DHCP leases are held for NATGW_UPLINK_GRACE_SECONDS so a brief USB drop does
# not reset the clients. One pair USB at most (SYSTEM_WAN) keeps its default
# route in the main table and serves this host; the default route of every
# other pair USB is moved into its pair table, so the host never uses it.
# Every link is NATed out of its uplink by one dedicated nftables table and
# reconciled idempotently: only what differs from the applied state changes.
#
# LAN scopes: every relay port has its own settings namespace (its LAN name,
# else its interface name) under NATGW_LAN_SCOPE_DIR/<scope>/, so several
# ports keep separate settings. FAIR_SHARE splits the bandwidth per client
# host (cake dual-dsthost on the port, dual-srchost nat on the uplink), so one
# busy machine cannot stall the others; BANDWIDTH_DOWN/UP (Mbit, 0 = unshaped)
# shape just below the real uplink speed, which makes the split effective when
# the bottleneck is upstream. HOST_CONN_LIMIT caps new uplink connections per
# client host. AUTO_BIND pins every DHCP client of the port to the address it
# got (bindings file, dnsmasq dhcp-hostsfile); a binding keeps its host part
# when the relay network address changes.
#
# References: nftables NAT (wiki.nftables.org "Performing Network Address
# Translation"), Debian nftables default (wiki.debian.org/nftables), ufw route
# rules (ufw(8)), Docker DOCKER-USER (docs.docker.com firewall-iptables),
# NetworkManager runtime "managed" (NetworkManager.conf(5)), dnsmasq(8),
# policy routing (ip-rule(8), lartc.org "Routing for multiple uplinks"),
# rp_filter (kernel ip-sysctl).

if [ "${NATGW_ENGINE_LOADED:-false}" = "true" ]; then
    return
fi
NATGW_ENGINE_LOADED="true"

NATGW_CONFIG_DIR="${NATGW_CONFIG_DIR:-${CORE_NODE_DATA_DIR:-/www/core_node}/natgateway}"
NATGW_CONFIG_FILE="$NATGW_CONFIG_DIR/router.conf"
NATGW_LEGACY_CONFIG_FILE="$NATGW_CONFIG_DIR/interface_cache.conf"
NATGW_RUN_DIR="/run/ncore-natgateway"
NATGW_LEGACY_APPLIED_FILE="$NATGW_RUN_DIR/applied"
NATGW_NFT_RULES_FILE="$NATGW_RUN_DIR/nft.rules"
NATGW_SYSCTL_FILE="/etc/sysctl.d/99-ncore-natgateway.conf"
NATGW_BRIDGE_PREFIX="ncbr"
NATGW_BRIDGE="${NATGW_BRIDGE_PREFIX}0"
NATGW_NFT_TABLE="ncore_natgateway"
NATGW_SERVICE_NAME="ncore-natgateway"
NATGW_UPGRADE_UNIT="ncore-natgateway-upgrade"
NATGW_KEEP_LINKS_MARKER="/run/ncore-natgateway/keep-links-on-stop"
NATGW_UPGRADE_CHECK_SECONDS=60
NATGW_DEFAULT_ADDRESS="192.168.50.1/24"
NATGW_DHCP_FIRST_HOST="100"
NATGW_DHCP_LAST_HOST="200"
NATGW_DHCP_LEASE_TIME="12h"
NATGW_DOCKER_CHAIN="DOCKER-USER"
NATGW_POLL_SECONDS=5
NATGW_MAX_PAIRS=16
NATGW_TABLE_BASE=7300
NATGW_RULE_IIF_BASE=7300
NATGW_RULE_OIF_BASE=7400
NATGW_UNREACHABLE_METRIC=4294967295
NATGW_LOOSE_RP_FILTER=2
NATGW_USB_PORT_PREFIX="usb@"
NATGW_LAN_NAME_PREFIX="LAN"
NATGW_UPLINK_GRACE_SECONDS=90
NATGW_LAN_SCOPE_DIR="$NATGW_CONFIG_DIR/lans"
NATGW_LAN_SETTINGS_FILE_NAME="settings.conf"
NATGW_LAN_BINDINGS_FILE_NAME="bindings"
NATGW_LAN_KEYS="FAIR_SHARE BANDWIDTH_DOWN BANDWIDTH_UP HOST_CONN_LIMIT AUTO_BIND"
NATGW_DEFAULT_HOST_CONN_LIMIT=2048
NATGW_MAX_BANDWIDTH_MBIT=100000
NATGW_MAX_HOST_CONN_LIMIT=1000000
NATGW_CONNLIMIT_SET_SIZE=65535
NATGW_BIND_SOURCE_AUTO="auto"
NATGW_BIND_SOURCE_MANUAL="manual"
NATGW_QDISC_STATE_PREFIX="qdisc."
NATGW_QDISC_KEYS="BRIDGE SPEC KIND"
NATGW_CONFIG_KEYS="ROUTE_MODE WAN_SELECT LAN_MODE LAN_PORTS PAIRS LAN_MAP SYSTEM_WAN LAN_ADDRESS DHCP_ENABLED"
NATGW_APPLIED_KEYS="SIGNATURE WAN ADDRESS UFW DOCKER ROUTED ISOLATED TABLE RPF LOST"

ROUTE_MODE="single"
WAN_SELECT="usb"
LAN_MODE="all"
LAN_PORTS=""
PAIRS=""
LAN_MAP=""
SYSTEM_WAN="auto"
LAN_ADDRESS="$NATGW_DEFAULT_ADDRESS"
DHCP_ENABLED="yes"

NATGW_WAN=""
NATGW_LAN_LIST=()
NATGW_LAN_SKIPPED=()
NATGW_GATEWAY_IP=""
NATGW_DHCP_START=""
NATGW_DHCP_END=""
NATGW_GW=""
NATGW_GW_METRIC=""
NATGW_SYSTEM_WAN_ACTIVE=""
NATGW_ONBOARD_PORTS=()
NATGW_PAIR_SPECS=()

# Desired links (parallel arrays, one entry per live bridge).
NATGW_LINK_BRIDGES=()
NATGW_LINK_WANS=()
NATGW_LINK_LANS=()
NATGW_LINK_ADDRESSES=()
NATGW_LINK_ROUTED=()
NATGW_LINK_ISOLATED=()
# Pair report lines: "bridge|usb spec|lan|uplink|state".
NATGW_PAIR_REPORT=()

NATGW_APPLIED_SIGNATURE=""
NATGW_APPLIED_WAN=""
NATGW_APPLIED_ADDRESS=""
NATGW_APPLIED_UFW=""
NATGW_APPLIED_DOCKER=""
NATGW_APPLIED_ROUTED=""
NATGW_APPLIED_ISOLATED=""
NATGW_APPLIED_TABLE=""
NATGW_APPLIED_RPF=""
NATGW_APPLIED_LOST=""

LAN_FAIR_SHARE="yes"
LAN_BANDWIDTH_DOWN="0"
LAN_BANDWIDTH_UP="0"
LAN_HOST_CONN_LIMIT="$NATGW_DEFAULT_HOST_CONN_LIMIT"
LAN_AUTO_BIND="yes"
NATGW_QDISC_BRIDGE=""
NATGW_QDISC_SPEC=""
NATGW_QDISC_KIND=""
NATGW_CONNLIMIT_UNSUPPORTED="false"
# LAN map entries of the running reconcile (natgw_lan_scope_of).
NATGW_LAN_MAP_CACHE=()

natgw_log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')][NATGATEWAY] $*"
}

# ---------------------------------------------------------------- config ----

# key=value parser (never `source`: the file lives in a shared data dir).
natgw_read_kv_file() {
    local file="$1"
    local keys="$2"
    local prefix="$3"
    local key=""
    local value=""
    while IFS='=' read -r key value; do
        case " $keys " in
            *" $key "*) ;;
            *) continue ;;
        esac
        value="${value%\"}"
        value="${value#\"}"
        printf -v "$prefix$key" '%s' "$value"
    done < "$file"
}

natgw_load_config() {
    local WAN_KEYWORD=""
    local LAN_KEYWORD=""

    ROUTE_MODE="single"
    WAN_SELECT="usb"
    LAN_MODE="all"
    LAN_PORTS=""
    PAIRS=""
    LAN_MAP=""
    SYSTEM_WAN="auto"
    LAN_ADDRESS="$NATGW_DEFAULT_ADDRESS"
    DHCP_ENABLED="yes"

    if [ -f "$NATGW_CONFIG_FILE" ]; then
        natgw_read_kv_file "$NATGW_CONFIG_FILE" "$NATGW_CONFIG_KEYS" ""
    elif [ -f "$NATGW_LEGACY_CONFIG_FILE" ]; then
        # Legacy keyword pair (WAN_KEYWORD/LAN_KEYWORD): keywords resolve as
        # interface-name substrings, so they map onto WAN_SELECT / LAN_PORTS.
        natgw_read_kv_file "$NATGW_LEGACY_CONFIG_FILE" "WAN_KEYWORD LAN_KEYWORD" ""
        [ -n "$WAN_KEYWORD" ] && WAN_SELECT="$WAN_KEYWORD"
        if [ -n "$LAN_KEYWORD" ]; then
            LAN_MODE="list"
            LAN_PORTS="$LAN_KEYWORD"
        fi
    fi
    case "$ROUTE_MODE" in single|pairs) ;; *) ROUTE_MODE="single" ;; esac
    case "$LAN_MODE" in all|one|list) ;; *) LAN_MODE="all" ;; esac
    [ -n "$WAN_SELECT" ] || WAN_SELECT="usb"
    [ -n "$SYSTEM_WAN" ] || SYSTEM_WAN="auto"
    PAIRS="${PAIRS// /}"
    [ "$PAIRS" = "auto" ] && PAIRS=""
    LAN_MAP="${LAN_MAP// /}"
    [ "$LAN_MAP" = "auto" ] && LAN_MAP=""
    natgw_address_valid "$LAN_ADDRESS" || LAN_ADDRESS="$NATGW_DEFAULT_ADDRESS"
    [ "$DHCP_ENABLED" = "no" ] || DHCP_ENABLED="yes"
    natgw_derive_address "$LAN_ADDRESS"
}

natgw_save_config() {
    local tmp_file=""
    mkdir -p "$NATGW_CONFIG_DIR"
    tmp_file="$(mktemp "$NATGW_CONFIG_DIR/.router.conf.XXXXXX")"
    {
        echo "# NAT gateway configuration (natgateway set-mode / set-wan / set-lan / set-pairs / set-lan-map / set-system-wan / set-address / set-dhcp)"
        echo "ROUTE_MODE=\"$ROUTE_MODE\""
        echo "WAN_SELECT=\"$WAN_SELECT\""
        echo "LAN_MODE=\"$LAN_MODE\""
        echo "LAN_PORTS=\"$LAN_PORTS\""
        echo "PAIRS=\"$PAIRS\""
        echo "LAN_MAP=\"$LAN_MAP\""
        echo "SYSTEM_WAN=\"$SYSTEM_WAN\""
        echo "LAN_ADDRESS=\"$LAN_ADDRESS\""
        echo "DHCP_ENABLED=\"$DHCP_ENABLED\""
    } > "$tmp_file"
    chmod 644 "$tmp_file"
    mv -f "$tmp_file" "$NATGW_CONFIG_FILE"
}

# Only /24 gateways: the DHCP pool is .100-.200 of that network.
natgw_address_valid() {
    local address="$1"
    local octet=""
    [[ "$address" =~ ^([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})/24$ ]] || return 1
    for octet in "${BASH_REMATCH[@]:1}"; do
        [ "$octet" -le 255 ] || return 1
    done
    [ "${BASH_REMATCH[4]}" -ge 1 ] && [ "${BASH_REMATCH[4]}" -le 254 ]
}

natgw_derive_address() {
    local address="${1:-$LAN_ADDRESS}"
    local network=""
    NATGW_GATEWAY_IP="${address%/*}"
    network="${NATGW_GATEWAY_IP%.*}"
    NATGW_DHCP_START="$network.$NATGW_DHCP_FIRST_HOST"
    NATGW_DHCP_END="$network.$NATGW_DHCP_LAST_HOST"
}

# Pair N serves the LAN_ADDRESS /24 shifted by N in the third octet.
natgw_pair_address() {
    local index="$1"
    local -a octets=()
    IFS='.' read -r -a octets <<< "${LAN_ADDRESS%/*}"
    [ $((octets[2] + index)) -le 255 ] || return 1
    echo "${octets[0]}.${octets[1]}.$((octets[2] + index)).${octets[3]}/24"
}

# ------------------------------------------------------------- detection ----

natgw_is_physical() {
    local iface="$1"
    [ -e "/sys/class/net/$iface/device" ] || return 1
    [ "$(cat "/sys/class/net/$iface/type" 2>/dev/null)" = "1" ]
}

natgw_is_usb() {
    readlink -f "/sys/class/net/$1/device" 2>/dev/null | grep -q '/usb[0-9]*/'
}

# Physical USB port of an interface (e.g. 3-3 or 3-1.2).
natgw_usb_port_of() {
    local device=""
    device="$(readlink -f "/sys/class/net/$1/device" 2>/dev/null)"
    [[ "$device" == */usb[0-9]*/* ]] || return 1
    device="$(basename "$device")"
    echo "${device%%:*}"
}

natgw_is_wireless() {
    [ -d "/sys/class/net/$1/wireless" ] || [ -e "/sys/class/net/$1/phy80211" ]
}

natgw_has_carrier() {
    [ "$(cat "/sys/class/net/$1/carrier" 2>/dev/null)" = "1" ]
}

natgw_has_ipv4() {
    ip -4 -o addr show dev "$1" 2>/dev/null | grep -q ' inet '
}

natgw_ipv4_of() {
    ip -4 -o addr show dev "$1" 2>/dev/null | awk '{print $4; exit}'
}

natgw_master_of() {
    local master_link=""
    master_link="$(readlink "/sys/class/net/$1/master" 2>/dev/null)"
    [ -n "$master_link" ] && basename "$master_link"
}

natgw_is_own_bridge() {
    [[ "$1" =~ ^${NATGW_BRIDGE_PREFIX}[0-9]+$ ]]
}

natgw_bridge_index() {
    echo "${1#"$NATGW_BRIDGE_PREFIX"}"
}

natgw_default_route_ifaces() {
    ip -4 route show default 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "dev") print $(i + 1)}'
}

natgw_physical_ifaces() {
    local path=""
    local iface=""
    for path in /sys/class/net/*; do
        iface="$(basename "$path")"
        natgw_is_physical "$iface" && echo "$iface"
    done
}

natgw_list_contains() {
    local needle="$1"
    shift
    local item=""
    for item in "$@"; do
        [ "$item" = "$needle" ] && return 0
    done
    return 1
}

# Resolve a name: exact interface first, then the first physical interface
# whose name contains it (legacy keyword behaviour).
natgw_resolve_name() {
    local wanted="$1"
    local iface=""
    if [ -e "/sys/class/net/$wanted" ]; then
        echo "$wanted"
        return
    fi
    while IFS= read -r iface; do
        case "$iface" in
            *"$wanted"*) echo "$iface"; return ;;
        esac
    done < <(natgw_physical_ifaces)
}

# Uplink spec: usb@<port> resolves to the interface on that USB port,
# anything else resolves as a name.
natgw_resolve_uplink() {
    local wanted="$1"
    local iface=""
    local -a ifaces=()
    if [[ "$wanted" != "$NATGW_USB_PORT_PREFIX"* ]]; then
        natgw_resolve_name "$wanted"
        return
    fi
    mapfile -t ifaces < <(natgw_physical_ifaces)
    for iface in "${ifaces[@]}"; do
        [ "$(natgw_usb_port_of "$iface")" = "${wanted#"$NATGW_USB_PORT_PREFIX"}" ] && { echo "$iface"; return; }
    done
}

natgw_wan_ready() {
    local iface="$1"
    [ -n "$iface" ] || return 1
    natgw_is_own_bridge "$iface" && return 1
    natgw_has_carrier "$iface" && natgw_has_ipv4 "$iface"
}

# Default route of an uplink: the main table first, else the pair table it was
# moved into. Sets NATGW_GW ("-" when the route has no gateway) and
# NATGW_GW_METRIC; fails when the uplink has no default route anywhere.
natgw_find_gateway() {
    local iface="$1"
    local line=""
    NATGW_GW=""
    NATGW_GW_METRIC=""
    line="$(ip -4 route show default dev "$iface" 2>/dev/null | head -n 1)"
    [ -n "$line" ] || line="$(ip -4 route show default table all dev "$iface" 2>/dev/null | grep -v '^unreachable' | head -n 1)"
    [ -n "$line" ] || return 1
    NATGW_GW="$(awk '{for (i = 1; i < NF; i++) if ($i == "via") {print $(i + 1); exit}}' <<< "$line")"
    NATGW_GW_METRIC="$(awk '{for (i = 1; i < NF; i++) if ($i == "metric") {print $(i + 1); exit}}' <<< "$line")"
    [ -n "$NATGW_GW" ] || NATGW_GW="-"
    [ -n "$NATGW_GW_METRIC" ] || NATGW_GW_METRIC="0"
}

natgw_route_spec() {
    local wan="$1"
    if [ "$NATGW_GW" = "-" ]; then
        echo "dev $wan"
    else
        echo "via $NATGW_GW dev $wan onlink"
    fi
}

# Upstream DNS of an uplink: NetworkManager's servers, else its gateway (USB
# tethering and LTE modems answer DNS there); empty means the host resolver.
natgw_wan_dns() {
    local wan="$1"
    local -a servers=()
    if natgw_nm_running; then
        mapfile -t servers < <(nmcli -g IP4.DNS device show "$wan" 2>/dev/null | tr '|' '\n' | sed 's/ //g' | grep -E '^[0-9.]+$')
    fi
    if [ ${#servers[@]} -eq 0 ] && natgw_find_gateway "$wan" && [ "$NATGW_GW" != "-" ]; then
        servers=("$NATGW_GW")
    fi
    [ ${#servers[@]} -gt 0 ] && (IFS=','; echo "${servers[*]}")
}

# WAN_SELECT=usb: a USB adapter with link + IPv4, preferring the one holding a
# default route. Otherwise the named interface (or keyword) when it is ready.
natgw_resolve_wan() {
    local iface=""
    local fallback=""
    local -a default_ifaces=()

    NATGW_WAN=""
    if [ "$WAN_SELECT" != "usb" ]; then
        iface="$(natgw_resolve_uplink "$WAN_SELECT")"
        natgw_wan_ready "$iface" && NATGW_WAN="$iface"
        return
    fi
    mapfile -t default_ifaces < <(natgw_default_route_ifaces)
    while IFS= read -r iface; do
        natgw_is_usb "$iface" || continue
        natgw_wan_ready "$iface" || continue
        if natgw_list_contains "$iface" "${default_ifaces[@]}"; then
            NATGW_WAN="$iface"
            return
        fi
        [ -n "$fallback" ] || fallback="$iface"
    done < <(natgw_physical_ifaces)
    NATGW_WAN="$fallback"
}

# A port may relay when it is wired, not an uplink, and not owned by another
# master (bond/bridge other than this gateway's own bridges).
natgw_lan_eligible() {
    local iface="$1"
    shift
    local master=""
    natgw_is_physical "$iface" || return 1
    natgw_is_wireless "$iface" && return 1
    natgw_list_contains "$iface" "$@" && return 1
    master="$(natgw_master_of "$iface")"
    [ -z "$master" ] || natgw_is_own_bridge "$master"
}

# Onboard wired ports that may relay (NATGW_ONBOARD_PORTS), except ports
# carrying this host's own default route (taking them would cut it off).
natgw_collect_onboard_ports() {
    local iface=""
    local -a default_ifaces=()
    NATGW_ONBOARD_PORTS=()
    mapfile -t default_ifaces < <(natgw_default_route_ifaces)
    while IFS= read -r iface; do
        natgw_is_usb "$iface" && continue
        natgw_lan_eligible "$iface" "$@" || continue
        if natgw_list_contains "$iface" "${default_ifaces[@]}" && ! natgw_is_own_bridge "$(natgw_master_of "$iface")"; then
            NATGW_LAN_SKIPPED+=("$iface(default-route)")
            continue
        fi
        NATGW_ONBOARD_PORTS+=("$iface")
    done < <(natgw_physical_ifaces)
}

# all: every onboard port; one/list: the named ports (names or keywords).
natgw_resolve_lan() {
    local iface=""
    local entry=""
    local -a wanted=()

    NATGW_LAN_LIST=()
    NATGW_LAN_SKIPPED=()
    [ -n "$NATGW_WAN" ] || return 0

    if [ "$LAN_MODE" = "all" ]; then
        natgw_collect_onboard_ports "$NATGW_WAN"
        NATGW_LAN_LIST=("${NATGW_ONBOARD_PORTS[@]}")
        return 0
    fi

    IFS=',' read -r -a wanted <<< "${LAN_PORTS// /}"
    for entry in "${wanted[@]}"; do
        [ -n "$entry" ] || continue
        iface="$(natgw_lan_port_of "$entry")"
        [ -z "$iface" ] || iface="$(natgw_resolve_name "$iface")"
        if [ -z "$iface" ] || ! natgw_lan_eligible "$iface" "$NATGW_WAN"; then
            NATGW_LAN_SKIPPED+=("$entry(unavailable)")
            continue
        fi
        natgw_list_contains "$iface" "${NATGW_LAN_LIST[@]}" && continue
        NATGW_LAN_LIST+=("$iface")
        [ "$LAN_MODE" = "one" ] && break
    done
    return 0
}

# Relay port names, one "LAN<N>:<iface>" line each: LAN_MAP, else LAN<N> = the
# N-th onboard wired port (all of them, so the numbering never shifts).
natgw_lan_map_entries() {
    local entry=""
    local iface=""
    local number=0
    local -a entries=()
    if [ -n "$LAN_MAP" ]; then
        IFS=',' read -r -a entries <<< "$LAN_MAP"
        for entry in "${entries[@]}"; do
            [[ "$entry" == "$NATGW_LAN_NAME_PREFIX"*:* ]] && echo "$entry"
        done
        return 0
    fi
    while IFS= read -r iface; do
        natgw_is_usb "$iface" && continue
        natgw_is_wireless "$iface" && continue
        number=$((number + 1))
        echo "$NATGW_LAN_NAME_PREFIX$number:$iface"
    done < <(natgw_physical_ifaces)
}

# LAN<N> resolves through the LAN map; anything else is a port name already.
natgw_lan_port_of() {
    local name="$1"
    local entry=""
    local -a entries=()
    if [[ "$name" =~ ^${NATGW_LAN_NAME_PREFIX}[0-9]+$ ]]; then
        mapfile -t entries < <(natgw_lan_map_entries)
        for entry in "${entries[@]}"; do
            [ "${entry%%:*}" = "$name" ] && { echo "${entry#*:}"; return; }
        done
        return
    fi
    echo "$name"
}

# Pair specs "<usb>:<lan>" (lan = LAN<N> or an interface) into
# NATGW_PAIR_SPECS; PAIRS empty = one auto pair per LAN name, in order.
natgw_collect_pair_specs() {
    local entry=""
    local -a entries=()
    NATGW_PAIR_SPECS=()
    if [ -z "$PAIRS" ]; then
        while IFS= read -r entry; do
            NATGW_PAIR_SPECS+=("auto:${entry%%:*}")
        done < <(natgw_lan_map_entries)
    else
        IFS=',' read -r -a entries <<< "$PAIRS"
        for entry in "${entries[@]}"; do
            [ -n "$entry" ] || continue
            [[ "$entry" == *:* ]] || entry="auto:$entry"
            NATGW_PAIR_SPECS+=("$entry")
        done
    fi
    NATGW_PAIR_SPECS=("${NATGW_PAIR_SPECS[@]:0:$NATGW_MAX_PAIRS}")
}

# USB uplinks that can serve a pair now (link, IPv4 and a default route), in
# detection order (ifindex), so "first USB" means the first one plugged in.
natgw_ready_usb_uplinks() {
    local iface=""
    while IFS= read -r iface; do
        natgw_is_usb "$iface" || continue
        natgw_list_contains "$iface" "$@" && continue
        natgw_wan_ready "$iface" || continue
        natgw_find_gateway "$iface" || continue
        echo "$(cat "/sys/class/net/$iface/ifindex" 2>/dev/null) $iface"
    done < <(natgw_physical_ifaces) | sort -n | awk '{print $2}'
}

natgw_add_link() {
    NATGW_LINK_BRIDGES+=("$1")
    NATGW_LINK_WANS+=("$2")
    NATGW_LINK_LANS+=("$3")
    NATGW_LINK_ADDRESSES+=("$4")
    NATGW_LINK_ROUTED+=("$5")
    NATGW_LINK_ISOLATED+=("no")
}

# Ready candidates of a pair's USB spec: auto = every ready USB (a pool shared
# by all auto pairs); otherwise "<usb>[+<usb>...]" (interfaces or usb@<port>),
# a pool where the first ready one wins.
natgw_pair_candidates() {
    local spec="$1"
    shift
    local -a ready=("$@")
    local -a wanted=()
    local entry=""
    local usb=""
    if [ "$spec" = "auto" ]; then
        printf '%s\n' "${ready[@]}"
        return
    fi
    IFS='+' read -r -a wanted <<< "$spec"
    for entry in "${wanted[@]}"; do
        [ -n "$entry" ] || continue
        usb="$(natgw_resolve_uplink "$entry")"
        [ -n "$usb" ] && natgw_list_contains "$usb" "${ready[@]}" && echo "$usb"
    done
}

# Every USB serves one relay port at most (1:1, or a pool many:1). Pairs with
# named USBs/pools are served first, then auto pairs, each in config order
# (LAN1 first): a pair keeps the uplink it already serves, else takes a free
# candidate no later pair is using, else any free candidate, so when USBs run
# short the earlier ports keep internet.
natgw_resolve_pairs() {
    local -a usb_specs=()
    local -a lan_specs=()
    local -a lans=()
    local -a assigned=()
    local -a sticky=()
    local -a ready=()
    local -a taken=()
    local -a used_lans=()
    local -a free=()
    local index=0
    local pass=""
    local candidate=""
    local usb=""
    local lan=""
    local address=""
    local state=""
    local -a default_ifaces=()

    natgw_collect_pair_specs
    mapfile -t default_ifaces < <(natgw_default_route_ifaces)
    for index in "${!NATGW_PAIR_SPECS[@]}"; do
        usb_specs[index]="${NATGW_PAIR_SPECS[$index]%%:*}"
        lan_specs[index]="${NATGW_PAIR_SPECS[$index]#*:}"
        lans[index]="$(natgw_lan_port_of "${lan_specs[$index]}")"
        [ -z "${lans[$index]}" ] || lans[index]="$(natgw_resolve_name "${lans[$index]}")"
        assigned[index]=""
        natgw_load_applied "$NATGW_BRIDGE_PREFIX$index"
        sticky[index]="$NATGW_APPLIED_WAN"
    done
    mapfile -t ready < <(natgw_ready_usb_uplinks "${lans[@]}")

    for pass in named auto; do
        for index in "${!NATGW_PAIR_SPECS[@]}"; do
            if [ "$pass" = "named" ]; then
                [ "${usb_specs[$index]}" != "auto" ] || continue
            else
                [ "${usb_specs[$index]}" = "auto" ] || continue
            fi
            free=()
            while IFS= read -r candidate; do
                [ -n "$candidate" ] || continue
                natgw_list_contains "$candidate" "${taken[@]}" || free+=("$candidate")
            done < <(natgw_pair_candidates "${usb_specs[$index]}" "${ready[@]}")
            [ ${#free[@]} -gt 0 ] || continue
            usb=""
            if natgw_list_contains "${sticky[$index]}" "${free[@]}"; then
                usb="${sticky[$index]}"
            else
                for candidate in "${free[@]}"; do
                    natgw_list_contains "$candidate" "${sticky[@]:$((index + 1))}" && continue
                    usb="$candidate"
                    break
                done
                [ -n "$usb" ] || usb="${free[0]}"
            fi
            assigned[index]="$usb"
            taken+=("$usb")
        done
    done

    for index in "${!NATGW_PAIR_SPECS[@]}"; do
        usb="${assigned[$index]}"
        lan="${lans[$index]}"
        address="$(natgw_pair_address "$index")"
        state="active"
        if [ -z "$usb" ]; then
            state="waiting for USB uplink"
        elif [ -z "$lan" ] || ! natgw_lan_eligible "$lan" "${taken[@]}"; then
            state="relay port unavailable"
        elif natgw_list_contains "$lan" "${default_ifaces[@]}" && ! natgw_is_own_bridge "$(natgw_master_of "$lan")"; then
            state="relay port carries this host's default route"
        elif natgw_list_contains "$lan" "${used_lans[@]}"; then
            state="relay port used by an earlier pair"
        elif [ -z "$address" ]; then
            state="address out of range"
        fi
        NATGW_PAIR_REPORT+=("$NATGW_BRIDGE_PREFIX$index|${usb_specs[$index]}|${lan_specs[$index]}${lan:+ ($lan)}|${usb:--}|$state")
        [ "$state" = "active" ] || continue
        used_lans+=("$lan")
        natgw_add_link "$NATGW_BRIDGE_PREFIX$index" "$usb" "$lan" "$address" "yes"
    done
}

# auto: keep the pair uplink already serving the host, else the first pair's;
# none: no pair uplink serves the host; <iface>: only that uplink.
natgw_pick_system_wan() {
    local index=0
    local wanted=""
    NATGW_SYSTEM_WAN_ACTIVE=""
    [ ${#NATGW_LINK_WANS[@]} -gt 0 ] || return 0
    case "$SYSTEM_WAN" in
        none) ;;
        auto)
            for index in "${!NATGW_LINK_BRIDGES[@]}"; do
                natgw_load_applied "${NATGW_LINK_BRIDGES[$index]}"
                if [ "$NATGW_APPLIED_ROUTED" = "yes" ] && [ "$NATGW_APPLIED_ISOLATED" = "no" ] && [ "$NATGW_APPLIED_WAN" = "${NATGW_LINK_WANS[$index]}" ]; then
                    NATGW_SYSTEM_WAN_ACTIVE="$NATGW_APPLIED_WAN"
                    break
                fi
            done
            [ -n "$NATGW_SYSTEM_WAN_ACTIVE" ] || NATGW_SYSTEM_WAN_ACTIVE="${NATGW_LINK_WANS[0]}"
            ;;
        *)
            wanted="$(natgw_resolve_uplink "$SYSTEM_WAN")"
            natgw_list_contains "$wanted" "${NATGW_LINK_WANS[@]}" && NATGW_SYSTEM_WAN_ACTIVE="$wanted"
            ;;
    esac
    for index in "${!NATGW_LINK_WANS[@]}"; do
        [ "${NATGW_LINK_WANS[$index]}" = "$NATGW_SYSTEM_WAN_ACTIVE" ] || NATGW_LINK_ISOLATED[index]="yes"
    done
}

natgw_resolve_links() {
    NATGW_LINK_BRIDGES=()
    NATGW_LINK_WANS=()
    NATGW_LINK_LANS=()
    NATGW_LINK_ADDRESSES=()
    NATGW_LINK_ROUTED=()
    NATGW_LINK_ISOLATED=()
    NATGW_PAIR_REPORT=()
    NATGW_LAN_SKIPPED=()
    NATGW_WAN=""
    NATGW_LAN_LIST=()

    if [ "$ROUTE_MODE" = "pairs" ]; then
        natgw_resolve_pairs
        natgw_pick_system_wan
        return 0
    fi
    natgw_resolve_wan
    natgw_resolve_lan
    if [ -n "$NATGW_WAN" ] && [ ${#NATGW_LAN_LIST[@]} -gt 0 ]; then
        natgw_add_link "$NATGW_BRIDGE" "$NATGW_WAN" "$(IFS=','; echo "${NATGW_LAN_LIST[*]}")" "$LAN_ADDRESS" "no"
    fi
}

# ------------------------------------------------------------- firewalls ----

# ufw persists its enabled state in ufw.conf; reading it avoids spawning the
# (python) ufw CLI on every reconcile.
natgw_ufw_active() {
    command -v ufw >/dev/null 2>&1 && grep -qi '^ENABLED=yes' /etc/ufw/ufw.conf 2>/dev/null
}

natgw_docker_chain_present() {
    command -v iptables >/dev/null 2>&1 && iptables -n -L "$NATGW_DOCKER_CHAIN" >/dev/null 2>&1
}

# ufw (default forward policy deny) and Docker (FORWARD policy DROP) both drop
# forwarded packets in their own base chains, which an accept in our nftables
# table cannot override; each needs its documented allow rule.
natgw_firewall_allow() {
    local bridge="$1"
    local wan="$2"
    NATGW_APPLIED_UFW="no"
    NATGW_APPLIED_DOCKER="no"
    if natgw_ufw_active; then
        ufw route allow in on "$bridge" out on "$wan" >/dev/null
        ufw route allow in on "$bridge" out on "$bridge" >/dev/null
        NATGW_APPLIED_UFW="yes"
    fi
    if natgw_docker_chain_present; then
        iptables -C "$NATGW_DOCKER_CHAIN" -i "$bridge" -o "$wan" -j ACCEPT 2>/dev/null \
            || iptables -I "$NATGW_DOCKER_CHAIN" -i "$bridge" -o "$wan" -j ACCEPT
        iptables -C "$NATGW_DOCKER_CHAIN" -i "$wan" -o "$bridge" -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT 2>/dev/null \
            || iptables -I "$NATGW_DOCKER_CHAIN" -i "$wan" -o "$bridge" -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
        iptables -C "$NATGW_DOCKER_CHAIN" -i "$bridge" -o "$bridge" -j ACCEPT 2>/dev/null \
            || iptables -I "$NATGW_DOCKER_CHAIN" -i "$bridge" -o "$bridge" -j ACCEPT
        NATGW_APPLIED_DOCKER="yes"
    fi
}

natgw_firewall_revoke() {
    local bridge="$1"
    local wan="$2"
    local ufw_used="$3"
    local docker_used="$4"
    [ -n "$wan" ] || return 0
    if [ "$ufw_used" = "yes" ] && command -v ufw >/dev/null 2>&1; then
        ufw route delete allow in on "$bridge" out on "$wan" >/dev/null 2>&1 || true
        ufw route delete allow in on "$bridge" out on "$bridge" >/dev/null 2>&1 || true
    fi
    if [ "$docker_used" = "yes" ] && natgw_docker_chain_present; then
        iptables -D "$NATGW_DOCKER_CHAIN" -i "$bridge" -o "$wan" -j ACCEPT 2>/dev/null || true
        iptables -D "$NATGW_DOCKER_CHAIN" -i "$wan" -o "$bridge" -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true
        iptables -D "$NATGW_DOCKER_CHAIN" -i "$bridge" -o "$bridge" -j ACCEPT 2>/dev/null || true
    fi
}

# --------------------------------------------------------------- network ----

natgw_nm_running() {
    command -v nmcli >/dev/null 2>&1 && nmcli -t -f RUNNING general 2>/dev/null | grep -q running
}

# Runtime-only (not persisted): NetworkManager gets the port back after
# release or a reboot, when the daemon re-applies.
natgw_nm_set_managed() {
    local iface="$1"
    local managed="$2"
    natgw_nm_running || return 0
    nmcli device set "$iface" managed "$managed" >/dev/null 2>&1 || true
}

natgw_ensure_ip_forward() {
    [ "$(cat /proc/sys/net/ipv4/ip_forward 2>/dev/null)" = "1" ] && return 0
    sysctl -q -w net.ipv4.ip_forward=1
}

natgw_bridge_members() {
    local bridge="${1:-$NATGW_BRIDGE}"
    local path=""
    for path in /sys/class/net/"$bridge"/brif/*; do
        [ -e "$path" ] && basename "$path"
    done
}

natgw_ensure_bridge() {
    local bridge="$1"
    local lans="$2"
    local address="$3"
    local iface=""
    local -a lan_list=()

    IFS=',' read -r -a lan_list <<< "$lans"
    if [ ! -d "/sys/class/net/$bridge" ]; then
        ip link add name "$bridge" type bridge
        natgw_log "Created bridge $bridge"
    fi
    natgw_nm_set_managed "$bridge" no
    ip link set "$bridge" up

    while IFS= read -r iface; do
        natgw_list_contains "$iface" "${lan_list[@]}" && continue
        natgw_release_port "$iface"
    done < <(natgw_bridge_members "$bridge")

    for iface in "${lan_list[@]}"; do
        [ "$(natgw_master_of "$iface")" = "$bridge" ] && continue
        natgw_nm_set_managed "$iface" no
        ip -4 addr flush dev "$iface" 2>/dev/null || true
        ip link set "$iface" master "$bridge"
        ip link set "$iface" up
        natgw_log "Relay port joined $bridge: $iface"
    done

    if [ -n "$NATGW_APPLIED_ADDRESS" ] && [ "$NATGW_APPLIED_ADDRESS" != "$address" ]; then
        ip addr del "$NATGW_APPLIED_ADDRESS" dev "$bridge" 2>/dev/null || true
    fi
    ip addr replace "$address" dev "$bridge"
}

natgw_release_port() {
    local iface="$1"
    ip link set "$iface" nomaster 2>/dev/null || true
    natgw_nm_set_managed "$iface" yes
    natgw_log "Relay port released: $iface"
}

natgw_rule_present() {
    local priority="$1"
    local match="$2"
    ip -4 rule show priority "$priority" 2>/dev/null | grep -q "$match"
}

natgw_rule_delete() {
    local priority="$1"
    while ip -4 rule del priority "$priority" 2>/dev/null; do
        :
    done
}

natgw_main_default_present() {
    [ -n "$(ip -4 route show default dev "$1" 2>/dev/null)" ]
}

natgw_table_default_present() {
    [ -n "$(ip -4 route show default table "$2" dev "$1" 2>/dev/null)" ]
}

# Moves the uplink's default route back into the main table (same gateway and
# metric) when it was taken out for an isolated pair.
natgw_restore_main_default() {
    local wan="$1"
    local table="$2"
    local line=""
    local gw=""
    local metric=""
    [ -e "/sys/class/net/$wan" ] || return 0
    natgw_main_default_present "$wan" && return 0
    line="$(ip -4 route show default table "$table" dev "$wan" 2>/dev/null | head -n 1)"
    [ -n "$line" ] || return 0
    gw="$(awk '{for (i = 1; i < NF; i++) if ($i == "via") {print $(i + 1); exit}}' <<< "$line")"
    metric="$(awk '{for (i = 1; i < NF; i++) if ($i == "metric") {print $(i + 1); exit}}' <<< "$line")"
    if [ -n "$gw" ]; then
        ip -4 route replace default via "$gw" dev "$wan" onlink metric "${metric:-0}" 2>/dev/null || true
    else
        ip -4 route replace default dev "$wan" metric "${metric:-0}" 2>/dev/null || true
    fi
    natgw_log "Default route of $wan returned to the main table"
}

natgw_set_rp_filter() {
    local wan="$1"
    local value="$2"
    local path="/proc/sys/net/ipv4/conf/$wan/rp_filter"
    [ -n "$value" ] && [ -w "$path" ] || return 0
    [ "$(cat "$path" 2>/dev/null)" = "$value" ] || echo "$value" > "$path"
}

# Pair routing: table <N> holds the uplink default (plus an unreachable
# fallback, so a pair never leaks through the main table); rules send traffic
# entering the bridge, and sockets bound to the uplink (dnsmasq upstream), to
# that table. An isolated uplink loses its main-table default route; loose
# rp_filter accepts its replies while the host default points elsewhere.
natgw_apply_routing() {
    local bridge="$1"
    local wan="$2"
    local isolated="$3"
    local index=""
    local table=""
    local spec=""

    index="$(natgw_bridge_index "$bridge")"
    table=$((NATGW_TABLE_BASE + index))
    natgw_find_gateway "$wan" || return 1
    spec="$(natgw_route_spec "$wan")"

    ip -4 route flush table "$table" 2>/dev/null || true
    ip -4 route add unreachable default metric "$NATGW_UNREACHABLE_METRIC" table "$table"
    # shellcheck disable=SC2086
    ip -4 route replace default $spec metric "$NATGW_GW_METRIC" table "$table"
    if [ "$isolated" = "yes" ]; then
        while ip -4 route del default dev "$wan" 2>/dev/null; do
            :
        done
    else
        natgw_restore_main_default "$wan" "$table"
    fi

    natgw_rule_delete $((NATGW_RULE_IIF_BASE + index))
    natgw_rule_delete $((NATGW_RULE_OIF_BASE + index))
    ip -4 rule add iif "$bridge" lookup "$table" priority $((NATGW_RULE_IIF_BASE + index))
    ip -4 rule add oif "$wan" lookup "$table" priority $((NATGW_RULE_OIF_BASE + index))

    [ -n "$NATGW_APPLIED_RPF" ] || NATGW_APPLIED_RPF="$(cat "/proc/sys/net/ipv4/conf/$wan/rp_filter" 2>/dev/null)"
    natgw_set_rp_filter "$wan" "$NATGW_LOOSE_RP_FILTER"
    NATGW_APPLIED_TABLE="$table"
    return 0
}

natgw_clear_routing() {
    local bridge="$1"
    local wan="$2"
    local isolated="$3"
    local table="$4"
    local rp_filter="$5"
    local index=""
    [ -n "$table" ] || return 0
    index="$(natgw_bridge_index "$bridge")"
    [ "$isolated" = "yes" ] && natgw_restore_main_default "$wan" "$table"
    natgw_rule_delete $((NATGW_RULE_IIF_BASE + index))
    natgw_rule_delete $((NATGW_RULE_OIF_BASE + index))
    ip -4 route flush table "$table" 2>/dev/null || true
    natgw_set_rp_filter "$wan" "$rp_filter"
}

# One nftables table for every live link, replaced atomically (add + delete +
# define in one nft run) and only when the generated rules change. In pairs
# mode a bridge may only leave through its own uplink. With connlimit "yes",
# a client host past its LAN scope HOST_CONN_LIMIT gets new uplink
# connections rejected.
natgw_nft_rules() {
    local connlimit="$1"
    local index=0
    local bridge=""
    local wan=""
    local limit=""
    local -a clamped=()
    local -a limits=()
    echo "table ip $NATGW_NFT_TABLE {"
    for index in "${!NATGW_LINK_BRIDGES[@]}"; do
        limits[index]=0
        [ "$connlimit" = "yes" ] || continue
        limits[index]="$(natgw_link_conn_limit "$index")"
        [ "${limits[$index]}" -gt 0 ] || continue
        echo "    set hostconn_${NATGW_LINK_BRIDGES[$index]} {"
        echo "        type ipv4_addr; size $NATGW_CONNLIMIT_SET_SIZE; flags dynamic;"
        echo "    }"
    done
    echo "    chain forward {"
    echo "        type filter hook forward priority filter; policy accept;"
    for index in "${!NATGW_LINK_BRIDGES[@]}"; do
        wan="${NATGW_LINK_WANS[$index]}"
        natgw_list_contains "$wan" "${clamped[@]}" && continue
        clamped+=("$wan")
        echo "        oifname \"$wan\" tcp flags syn tcp option maxseg size set rt mtu"
    done
    for index in "${!NATGW_LINK_BRIDGES[@]}"; do
        bridge="${NATGW_LINK_BRIDGES[$index]}"
        wan="${NATGW_LINK_WANS[$index]}"
        limit="${limits[$index]}"
        if [ "$limit" -gt 0 ]; then
            echo "        iifname \"$bridge\" oifname \"$wan\" ct state new add @hostconn_$bridge { ip saddr ct count over $limit } counter reject"
        fi
        echo "        iifname \"$bridge\" oifname \"$wan\" accept"
        echo "        iifname \"$wan\" oifname \"$bridge\" ct state established,related accept"
        if [ "${NATGW_LINK_ROUTED[$index]}" = "yes" ]; then
            echo "        iifname \"$bridge\" oifname \"$bridge\" accept"
            echo "        iifname \"$bridge\" drop"
        fi
    done
    echo "    }"
    echo "    chain postrouting {"
    echo "        type nat hook postrouting priority srcnat; policy accept;"
    for index in "${!NATGW_LINK_BRIDGES[@]}"; do
        echo "        iifname \"${NATGW_LINK_BRIDGES[$index]}\" oifname \"${NATGW_LINK_WANS[$index]}\" masquerade"
    done
    echo "    }"
    echo "}"
}

natgw_nft_present() {
    nft list table ip "$NATGW_NFT_TABLE" >/dev/null 2>&1
}

natgw_sync_nft() {
    local rules=""
    if [ ${#NATGW_LINK_BRIDGES[@]} -eq 0 ]; then
        nft delete table ip "$NATGW_NFT_TABLE" 2>/dev/null || true
        rm -f "$NATGW_NFT_RULES_FILE"
        return 0
    fi
    rules="$(natgw_nft_rules "$([ "$NATGW_CONNLIMIT_UNSUPPORTED" = "true" ] && echo no || echo yes)")"
    if natgw_nft_present && [ "$rules" = "$(cat "$NATGW_NFT_RULES_FILE" 2>/dev/null)" ]; then
        return 0
    fi
    if ! natgw_nft_load "$rules" && [ "$NATGW_CONNLIMIT_UNSUPPORTED" != "true" ]; then
        NATGW_CONNLIMIT_UNSUPPORTED="true"
        natgw_log "nftables rejected the per-host connection limit: applied without it"
        rules="$(natgw_nft_rules no)"
        natgw_nft_load "$rules"
    fi
    printf '%s\n' "$rules" > "$NATGW_NFT_RULES_FILE"
}

natgw_nft_load() {
    printf 'add table ip %s\ndelete table ip %s\n%s\n' "$NATGW_NFT_TABLE" "$NATGW_NFT_TABLE" "$1" | nft -f -
}

natgw_dnsmasq_pid_file() {
    echo "$NATGW_RUN_DIR/dnsmasq.$1.pid"
}

natgw_lease_file() {
    echo "$NATGW_RUN_DIR/dnsmasq.$1.leases"
}

natgw_dhcp_hosts_file() {
    echo "$NATGW_RUN_DIR/dnsmasq.$1.hosts"
}

natgw_dnsmasq_alive() {
    local pid=""
    pid="$(cat "$(natgw_dnsmasq_pid_file "$1")" 2>/dev/null)"
    [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

natgw_stop_dnsmasq() {
    local pid_file=""
    local pid=""
    pid_file="$(natgw_dnsmasq_pid_file "$1")"
    pid="$(cat "$pid_file" 2>/dev/null)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"
}

# DHCP + DNS on the bridge address only (bind-interfaces, loopback excluded),
# so it never clashes with systemd-resolved or another dnsmasq. A routed pair
# resolves through its own uplink (server=<dns>@<uplink>).
natgw_start_dnsmasq() {
    local bridge="$1"
    local address="$2"
    local upstream="$3"
    local wan="$4"
    local server=""
    local -a servers=()
    local -a upstream_args=()

    natgw_stop_dnsmasq "$bridge"
    [ "$DHCP_ENABLED" = "yes" ] || return 0
    natgw_derive_address "$address"
    if [ -n "$upstream" ]; then
        IFS=',' read -r -a servers <<< "$upstream"
        upstream_args+=("--no-resolv")
        for server in "${servers[@]}"; do
            upstream_args+=("--server=$server@$wan")
        done
    fi
    dnsmasq \
        --conf-file=/dev/null \
        --bind-interfaces \
        --interface="$bridge" \
        --except-interface=lo \
        --dhcp-authoritative \
        --dhcp-range="$NATGW_DHCP_START,$NATGW_DHCP_END,255.255.255.0,$NATGW_DHCP_LEASE_TIME" \
        --dhcp-option=option:router,"$NATGW_GATEWAY_IP" \
        --dhcp-option=option:dns-server,"$NATGW_GATEWAY_IP" \
        --dhcp-leasefile="$(natgw_lease_file "$bridge")" \
        --dhcp-hostsfile="$(natgw_dhcp_hosts_file "$bridge")" \
        --pid-file="$(natgw_dnsmasq_pid_file "$bridge")" \
        --user=root \
        "${upstream_args[@]}"
    natgw_log "DHCP/DNS on $bridge: $NATGW_DHCP_START-$NATGW_DHCP_END via $NATGW_GATEWAY_IP${upstream:+ (upstream $upstream@$wan)}"
}

# ------------------------------------------------------------ lan scopes ----

natgw_valid_scope_name() {
    [[ "$1" =~ ^[A-Za-z0-9_.:-]{1,15}$ ]]
}

natgw_valid_mac() {
    [[ "$1" =~ ^([0-9a-f]{2}:){5}[0-9a-f]{2}$ ]]
}

natgw_valid_ipv4() {
    local octet=""
    [[ "$1" =~ ^([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$ ]] || return 1
    for octet in "${BASH_REMATCH[@]:1}"; do
        [ "$octet" -le 255 ] || return 1
    done
}

natgw_lan_scope_dir() {
    echo "$NATGW_LAN_SCOPE_DIR/$1"
}

natgw_lan_bindings_file() {
    echo "$NATGW_LAN_SCOPE_DIR/$1/$NATGW_LAN_BINDINGS_FILE_NAME"
}

# Settings namespace of a relay port: its LAN name, else the interface name.
natgw_lan_scope_of() {
    local iface="$1"
    local entry=""
    local -a entries=("${NATGW_LAN_MAP_CACHE[@]}")
    [ ${#entries[@]} -gt 0 ] || mapfile -t entries < <(natgw_lan_map_entries)
    for entry in "${entries[@]}"; do
        [ "${entry#*:}" = "$iface" ] && { echo "${entry%%:*}"; return; }
    done
    echo "$iface"
}

# Scopes with saved settings or bindings, plus the LAN names of this host.
natgw_lan_scopes() {
    local path=""
    {
        natgw_lan_map_entries | cut -d: -f1
        for path in "$NATGW_LAN_SCOPE_DIR"/*/; do
            [ -d "$path" ] && basename "$path"
        done
    } | awk 'NF && !seen[$0]++'
}

# LAN_FAIR_SHARE, LAN_BANDWIDTH_DOWN/UP, LAN_HOST_CONN_LIMIT and LAN_AUTO_BIND
# of one scope (defaults for anything not saved).
natgw_load_lan_scope() {
    local file=""
    file="$(natgw_lan_scope_dir "$1")/$NATGW_LAN_SETTINGS_FILE_NAME"
    LAN_FAIR_SHARE="yes"
    LAN_BANDWIDTH_DOWN="0"
    LAN_BANDWIDTH_UP="0"
    LAN_HOST_CONN_LIMIT="$NATGW_DEFAULT_HOST_CONN_LIMIT"
    LAN_AUTO_BIND="yes"
    [ -f "$file" ] && natgw_read_kv_file "$file" "$NATGW_LAN_KEYS" "LAN_"
    [ "$LAN_FAIR_SHARE" = "no" ] || LAN_FAIR_SHARE="yes"
    [ "$LAN_AUTO_BIND" = "no" ] || LAN_AUTO_BIND="yes"
    [[ "$LAN_BANDWIDTH_DOWN" =~ ^[0-9]{1,6}$ ]] && [ "$LAN_BANDWIDTH_DOWN" -le "$NATGW_MAX_BANDWIDTH_MBIT" ] || LAN_BANDWIDTH_DOWN="0"
    [[ "$LAN_BANDWIDTH_UP" =~ ^[0-9]{1,6}$ ]] && [ "$LAN_BANDWIDTH_UP" -le "$NATGW_MAX_BANDWIDTH_MBIT" ] || LAN_BANDWIDTH_UP="0"
    [[ "$LAN_HOST_CONN_LIMIT" =~ ^[0-9]{1,7}$ ]] && [ "$LAN_HOST_CONN_LIMIT" -le "$NATGW_MAX_HOST_CONN_LIMIT" ] || LAN_HOST_CONN_LIMIT="$NATGW_DEFAULT_HOST_CONN_LIMIT"
    LAN_BANDWIDTH_DOWN=$((10#$LAN_BANDWIDTH_DOWN))
    LAN_BANDWIDTH_UP=$((10#$LAN_BANDWIDTH_UP))
    LAN_HOST_CONN_LIMIT=$((10#$LAN_HOST_CONN_LIMIT))
}

natgw_save_lan_scope() {
    local scope="$1"
    local dir=""
    local tmp_file=""
    local key=""
    local name=""
    dir="$(natgw_lan_scope_dir "$scope")"
    mkdir -p "$dir"
    tmp_file="$(mktemp "$dir/.$NATGW_LAN_SETTINGS_FILE_NAME.XXXXXX")"
    {
        echo "# NAT gateway settings of relay port scope $scope (natgateway set-lan-option)"
        for key in $NATGW_LAN_KEYS; do
            name="LAN_$key"
            echo "$key=\"${!name}\""
        done
    } > "$tmp_file"
    chmod 644 "$tmp_file"
    mv -f "$tmp_file" "$dir/$NATGW_LAN_SETTINGS_FILE_NAME"
}

# Valid binding lines of a scope: "<mac> <ip> <host> <bound-at> <source>".
natgw_lan_bindings() {
    local file=""
    local mac=""
    local ip=""
    local host=""
    local bound_at=""
    local source=""
    file="$(natgw_lan_bindings_file "$1")"
    [ -f "$file" ] || return 0
    while read -r mac ip host bound_at source _; do
        natgw_valid_mac "$mac" && natgw_valid_ipv4 "$ip" || continue
        echo "$mac $ip ${host:-*} ${bound_at:-0} ${source:-$NATGW_BIND_SOURCE_MANUAL}"
    done < "$file"
}

# Replaces the binding of a MAC (or adds it) in a scope; an IP already bound
# to another MAC of the scope fails.
natgw_lan_bind() {
    local scope="$1"
    local mac="$2"
    local ip="$3"
    local host="${4:-*}"
    local source="${5:-$NATGW_BIND_SOURCE_MANUAL}"
    local file=""
    local tmp_file=""
    local line=""
    local -a fields=()
    local -a kept=()
    file="$(natgw_lan_bindings_file "$scope")"
    while IFS= read -r line; do
        read -r -a fields <<< "$line"
        [ "${fields[0]}" = "$mac" ] && continue
        [ "${fields[1]##*.}" = "${ip##*.}" ] && return 1
        kept+=("$line")
    done < <(natgw_lan_bindings "$scope")
    mkdir -p "$(dirname "$file")"
    tmp_file="$(mktemp "$(dirname "$file")/.$NATGW_LAN_BINDINGS_FILE_NAME.XXXXXX")"
    {
        echo "# <mac> <ip> <host> <bound-at> <source> (natgateway bind / unbind; auto = AUTO_BIND)"
        [ ${#kept[@]} -gt 0 ] && printf '%s\n' "${kept[@]}"
        echo "$mac $ip ${host// /_} $(date +%s) $source"
    } > "$tmp_file"
    chmod 644 "$tmp_file"
    mv -f "$tmp_file" "$file"
}

# Removes bindings of a scope matching a MAC, an IP or "all"; fails when none
# matched.
natgw_lan_unbind() {
    local scope="$1"
    local match="$2"
    local file=""
    local tmp_file=""
    local line=""
    local removed=0
    local -a fields=()
    local -a kept=()
    file="$(natgw_lan_bindings_file "$scope")"
    [ -f "$file" ] || return 1
    while IFS= read -r line; do
        read -r -a fields <<< "$line"
        if [ "$match" = "all" ] || [ "${fields[0]}" = "$match" ] || [ "${fields[1]}" = "$match" ]; then
            removed=$((removed + 1))
            continue
        fi
        kept+=("$line")
    done < <(natgw_lan_bindings "$scope")
    [ "$removed" -gt 0 ] || return 1
    tmp_file="$(mktemp "$(dirname "$file")/.$NATGW_LAN_BINDINGS_FILE_NAME.XXXXXX")"
    {
        echo "# <mac> <ip> <host> <bound-at> <source> (natgateway bind / unbind; auto = AUTO_BIND)"
        [ ${#kept[@]} -gt 0 ] && printf '%s\n' "${kept[@]}"
    } > "$tmp_file"
    chmod 644 "$tmp_file"
    mv -f "$tmp_file" "$file"
}

natgw_link_ports() {
    local -a lans=()
    IFS=',' read -r -a lans <<< "${NATGW_LINK_LANS[$1]}"
    printf '%s\n' "${lans[@]}"
}

# Strictest connection limit of the link's scopes (0 = no limit).
natgw_link_conn_limit() {
    local port=""
    local limit=0
    while IFS= read -r port; do
        [ -n "$port" ] || continue
        natgw_load_lan_scope "$(natgw_lan_scope_of "$port")"
        [ "$LAN_HOST_CONN_LIMIT" -gt 0 ] || continue
        if [ "$limit" -eq 0 ] || [ "$LAN_HOST_CONN_LIMIT" -lt "$limit" ]; then
            limit="$LAN_HOST_CONN_LIMIT"
        fi
    done < <(natgw_link_ports "$1")
    echo "$limit"
}

# dnsmasq dhcp-hostsfile of a link from the bindings of its ports' scopes,
# each keeping its host part inside the link network (first MAC / IP wins);
# succeeds only when the file content changed.
natgw_write_dhcp_hosts() {
    local index="$1"
    local bridge="${NATGW_LINK_BRIDGES[$index]}"
    local address="${NATGW_LINK_ADDRESSES[$index]}"
    local network="${address%.*}"
    local gateway_host=""
    local file=""
    local content=""
    local port=""
    local line=""
    local host_part=""
    local -a fields=()
    local -a macs=()
    local -a hosts=()
    local -a lines=()
    gateway_host="${address%/*}"
    gateway_host="${gateway_host##*.}"
    file="$(natgw_dhcp_hosts_file "$bridge")"
    while IFS= read -r port; do
        [ -n "$port" ] || continue
        while IFS= read -r line; do
            read -r -a fields <<< "$line"
            host_part="${fields[1]##*.}"
            [ "$host_part" -ge 1 ] && [ "$host_part" -le 254 ] && [ "$host_part" != "$gateway_host" ] || continue
            natgw_list_contains "${fields[0]}" "${macs[@]}" && continue
            natgw_list_contains "$host_part" "${hosts[@]}" && continue
            macs+=("${fields[0]}")
            hosts+=("$host_part")
            lines+=("${fields[0]},$network.$host_part")
        done < <(natgw_lan_bindings "$(natgw_lan_scope_of "$port")")
    done < <(natgw_link_ports "$index")
    [ ${#lines[@]} -gt 0 ] && content="$(printf '%s\n' "${lines[@]}")"
    [ -f "$file" ] && [ "$content" = "$(cat "$file")" ] && return 1
    mkdir -p "$NATGW_RUN_DIR"
    printf '%s' "$content${content:+$'\n'}" > "$file"
    return 0
}

# Relay port a client MAC sits behind (bridge forwarding database), else the
# link's first port.
natgw_port_of_mac() {
    local index="$1"
    local mac="$2"
    local port=""
    port="$(bridge fdb show br "${NATGW_LINK_BRIDGES[$index]}" 2>/dev/null \
        | awk -v mac="$mac" -v bridge="${NATGW_LINK_BRIDGES[$index]}" '$1 == mac && $2 == "dev" && $3 != bridge && !/permanent/ {print $3; exit}')"
    [ -n "$port" ] || port="$(natgw_link_ports "$index" | head -n 1)"
    echo "$port"
}

# AUTO_BIND: every leased client without a binding in its port's scope gets
# one for the address it holds.
natgw_auto_bind_link() {
    local index="$1"
    local bridge="${NATGW_LINK_BRIDGES[$index]}"
    local lease_file=""
    local expiry=""
    local mac=""
    local ip=""
    local host=""
    local scope=""
    lease_file="$(natgw_lease_file "$bridge")"
    [ -s "$lease_file" ] || return 0
    while read -r expiry mac ip host _; do
        natgw_valid_mac "$mac" && natgw_valid_ipv4 "$ip" || continue
        scope="$(natgw_lan_scope_of "$(natgw_port_of_mac "$index" "$mac")")"
        natgw_valid_scope_name "$scope" || continue
        natgw_load_lan_scope "$scope"
        [ "$LAN_AUTO_BIND" = "yes" ] || continue
        natgw_lan_bindings "$scope" | awk -v mac="$mac" '$1 == mac {found = 1} END {exit !found}' && continue
        if natgw_lan_bind "$scope" "$mac" "$ip" "$host" "$NATGW_BIND_SOURCE_AUTO"; then
            natgw_log "Bound $mac ($host) to $ip in scope $scope"
        fi
    done < "$lease_file"
}

natgw_qdisc_state_file() {
    echo "$NATGW_RUN_DIR/$NATGW_QDISC_STATE_PREFIX$1"
}

natgw_load_qdisc_state() {
    NATGW_QDISC_BRIDGE=""
    NATGW_QDISC_SPEC=""
    NATGW_QDISC_KIND=""
    [ -f "$(natgw_qdisc_state_file "$1")" ] || return 1
    natgw_read_kv_file "$(natgw_qdisc_state_file "$1")" "$NATGW_QDISC_KEYS" "NATGW_QDISC_"
}

natgw_root_qdisc_kind() {
    tc qdisc show dev "$1" root 2>/dev/null | awk '{print $2; exit}'
}

# Root qdisc "<cake args>" of a device owned by a bridge; cake missing falls
# back to fq_codel (per-flow fairness only). Applied only when it differs.
natgw_apply_qdisc() {
    local dev="$1"
    local bridge="$2"
    local spec="$3"
    local kind="cake"
    [ -e "/sys/class/net/$dev" ] || return 0
    if natgw_load_qdisc_state "$dev" && [ "$NATGW_QDISC_SPEC" = "$spec" ] && [ "$(natgw_root_qdisc_kind "$dev")" = "$NATGW_QDISC_KIND" ]; then
        return 0
    fi
    # shellcheck disable=SC2086
    if ! tc qdisc replace dev "$dev" root cake $spec 2>/dev/null; then
        kind="fq_codel"
        tc qdisc replace dev "$dev" root fq_codel 2>/dev/null || return 0
        natgw_log "cake unavailable on $dev: fq_codel (per-flow fairness, no shaping)"
    fi
    mkdir -p "$NATGW_RUN_DIR"
    printf 'BRIDGE="%s"\nSPEC="%s"\nKIND="%s"\n' "$bridge" "$spec" "$kind" > "$(natgw_qdisc_state_file "$dev")"
    natgw_log "Fair share on $dev ($bridge): $kind $spec"
}

natgw_clear_qdisc() {
    local dev="$1"
    if [ -e "/sys/class/net/$dev" ]; then
        tc qdisc del dev "$dev" root 2>/dev/null || true
        natgw_log "Fair share removed from $dev"
    fi
    rm -f "$(natgw_qdisc_state_file "$dev")"
}

# Qdiscs this gateway owns: of one bridge, or (no bridge) every one whose
# device is not in the remaining arguments.
natgw_clear_qdiscs() {
    local bridge="$1"
    shift
    local path=""
    local dev=""
    for path in "$NATGW_RUN_DIR/$NATGW_QDISC_STATE_PREFIX"*; do
        [ -e "$path" ] || continue
        dev="${path##*/"$NATGW_QDISC_STATE_PREFIX"}"
        natgw_load_qdisc_state "$dev"
        if [ -n "$bridge" ]; then
            [ "$NATGW_QDISC_BRIDGE" = "$bridge" ] || continue
        else
            natgw_list_contains "$dev" "$@" && continue
        fi
        natgw_clear_qdisc "$dev"
    done
}

natgw_cake_bandwidth() {
    if [ "$1" -gt 0 ]; then
        echo "bandwidth ${1}mbit"
    else
        echo "unlimited"
    fi
}

# Download: each relay port shapes toward its clients per destination host.
# Upload: the uplink shapes per (pre-NAT) source host at the sum of its ports'
# upload rates (unshaped when any port has none). FAIR_SHARE off with a rate
# still shapes, without the per-host split.
natgw_link_qdiscs() {
    local index="$1"
    local bridge="${NATGW_LINK_BRIDGES[$index]}"
    local wan="${NATGW_LINK_WANS[$index]}"
    local port=""
    local up_total=0
    local up_shaped="yes"
    local up_fair="no"
    local isolation=""
    while IFS= read -r port; do
        [ -n "$port" ] || continue
        natgw_load_lan_scope "$(natgw_lan_scope_of "$port")"
        [ "$LAN_FAIR_SHARE" = "yes" ] && up_fair="yes"
        if [ "$LAN_BANDWIDTH_UP" -gt 0 ]; then
            up_total=$((up_total + LAN_BANDWIDTH_UP))
        else
            up_shaped="no"
        fi
        if [ "$LAN_FAIR_SHARE" = "yes" ]; then
            isolation="dual-dsthost"
        elif [ "$LAN_BANDWIDTH_DOWN" -gt 0 ]; then
            isolation="flows"
        else
            continue
        fi
        echo "$port $(natgw_cake_bandwidth "$LAN_BANDWIDTH_DOWN") $isolation"
    done < <(natgw_link_ports "$index")
    [ "$up_shaped" = "yes" ] || up_total=0
    if [ "$up_fair" = "yes" ]; then
        echo "$wan $(natgw_cake_bandwidth "$up_total") nat dual-srchost"
    elif [ "$up_total" -gt 0 ]; then
        echo "$wan $(natgw_cake_bandwidth "$up_total") nat flows"
    fi
}

# Per reconcile: auto-binding, dhcp-hostsfile (dnsmasq re-reads it on SIGHUP,
# no client loses its lease) and the fair-share qdiscs of every live link.
natgw_sync_lan_scopes() {
    local index=0
    local bridge=""
    local line=""
    local pid=""
    local -a desired=()
    mapfile -t NATGW_LAN_MAP_CACHE < <(natgw_lan_map_entries)
    for index in "${!NATGW_LINK_BRIDGES[@]}"; do
        bridge="${NATGW_LINK_BRIDGES[$index]}"
        if [ "$DHCP_ENABLED" = "yes" ]; then
            natgw_auto_bind_link "$index"
            if natgw_write_dhcp_hosts "$index" && natgw_dnsmasq_alive "$bridge"; then
                pid="$(cat "$(natgw_dnsmasq_pid_file "$bridge")" 2>/dev/null)"
                [ -n "$pid" ] && kill -HUP "$pid" 2>/dev/null
                natgw_log "DHCP bindings reloaded on $bridge"
            fi
        fi
        while IFS= read -r line; do
            desired+=("${line%% *}")
            natgw_apply_qdisc "${line%% *}" "$bridge" "${line#* }"
        done < <(natgw_link_qdiscs "$index")
    done
    natgw_clear_qdiscs "" "${desired[@]}"
}

# ----------------------------------------------------------- reconcile ------

natgw_applied_file() {
    echo "$NATGW_RUN_DIR/applied.$1"
}

# Runtime state of a version with one fixed bridge: positional applied file
# and bridge-less dnsmasq files become the ncbr0 link state.
natgw_migrate_run_state() {
    local -a lines=()
    [ -f "$NATGW_LEGACY_APPLIED_FILE" ] && [ -w "$NATGW_RUN_DIR" ] || return 0
    mapfile -t lines < "$NATGW_LEGACY_APPLIED_FILE"
    NATGW_APPLIED_SIGNATURE="legacy"
    NATGW_APPLIED_WAN="${lines[1]:-}"
    NATGW_APPLIED_ADDRESS="${lines[2]:-}"
    NATGW_APPLIED_UFW="${lines[3]:-}"
    NATGW_APPLIED_DOCKER="${lines[4]:-}"
    NATGW_APPLIED_ROUTED="no"
    NATGW_APPLIED_ISOLATED="no"
    NATGW_APPLIED_TABLE=""
    NATGW_APPLIED_RPF=""
    natgw_save_applied "$NATGW_BRIDGE"
    [ -f "$NATGW_RUN_DIR/dnsmasq.pid" ] && mv -f "$NATGW_RUN_DIR/dnsmasq.pid" "$(natgw_dnsmasq_pid_file "$NATGW_BRIDGE")"
    [ -f "$NATGW_RUN_DIR/dnsmasq.leases" ] && mv -f "$NATGW_RUN_DIR/dnsmasq.leases" "$(natgw_lease_file "$NATGW_BRIDGE")"
    rm -f "$NATGW_LEGACY_APPLIED_FILE"
}

natgw_load_applied() {
    local file=""
    local key=""
    file="$(natgw_applied_file "$1")"
    for key in $NATGW_APPLIED_KEYS; do
        printf -v "NATGW_APPLIED_$key" '%s' ""
    done
    [ -f "$file" ] || return 0
    natgw_read_kv_file "$file" "$NATGW_APPLIED_KEYS" "NATGW_APPLIED_"
}

natgw_save_applied() {
    local key=""
    local name=""
    mkdir -p "$NATGW_RUN_DIR"
    {
        for key in $NATGW_APPLIED_KEYS; do
            name="NATGW_APPLIED_$key"
            echo "$key=\"${!name}\""
        done
    } > "$(natgw_applied_file "$1")"
}

# Bridges this gateway may own: applied state files plus live ncbr<N> links.
natgw_known_bridges() {
    local path=""
    local name=""
    {
        for path in "$NATGW_RUN_DIR"/applied.*; do
            [ -e "$path" ] && echo "${path##*/applied.}"
        done
        for path in /sys/class/net/"$NATGW_BRIDGE_PREFIX"*; do
            name="$(basename "$path")"
            [ -d "$path/bridge" ] && natgw_is_own_bridge "$name" && echo "$name"
        done
    } | sort -u
}

natgw_link_signature() {
    local index="$1"
    local wan="${NATGW_LINK_WANS[$index]}"
    local gateway=""
    if [ "${NATGW_LINK_ROUTED[$index]}" = "yes" ] && natgw_find_gateway "$wan"; then
        gateway="$NATGW_GW/$NATGW_GW_METRIC"
    fi
    echo "$wan|${NATGW_LINK_LANS[$index]}|${NATGW_LINK_ADDRESSES[$index]}|$DHCP_ENABLED|$(natgw_ufw_active && echo ufw)|$(natgw_docker_chain_present && echo docker)|${NATGW_LINK_ROUTED[$index]}|${NATGW_LINK_ISOLATED[$index]}|$gateway|$(natgw_wan_dns "$wan")|$(natgw_dhcp_hosts_file "${NATGW_LINK_BRIDGES[$index]}")"
}

natgw_link_healthy() {
    local index="$1"
    local bridge="${NATGW_LINK_BRIDGES[$index]}"
    local wan="${NATGW_LINK_WANS[$index]}"
    local table=""
    local slot=""
    local -a members=()
    local -a lans=()

    [ -d "/sys/class/net/$bridge" ] || return 1
    if [ "$DHCP_ENABLED" = "yes" ]; then
        natgw_dnsmasq_alive "$bridge" || return 1
    fi
    mapfile -t members < <(natgw_bridge_members "$bridge")
    IFS=',' read -r -a lans <<< "${NATGW_LINK_LANS[$index]}"
    [ "$(printf '%s\n' "${members[@]}" | sort)" = "$(printf '%s\n' "${lans[@]}" | sort)" ] || return 1
    [ "${NATGW_LINK_ROUTED[$index]}" = "yes" ] || return 0
    slot="$(natgw_bridge_index "$bridge")"
    table=$((NATGW_TABLE_BASE + slot))
    natgw_rule_present $((NATGW_RULE_IIF_BASE + slot)) "iif $bridge lookup $table" || return 1
    natgw_rule_present $((NATGW_RULE_OIF_BASE + slot)) "oif $wan lookup $table" || return 1
    natgw_table_default_present "$wan" "$table" || return 1
    if [ "${NATGW_LINK_ISOLATED[$index]}" = "yes" ]; then
        natgw_main_default_present "$wan" && return 1
    else
        natgw_main_default_present "$wan" || return 1
    fi
    return 0
}

natgw_apply_link() {
    local index="$1"
    local signature="$2"
    local bridge="${NATGW_LINK_BRIDGES[$index]}"
    local wan="${NATGW_LINK_WANS[$index]}"
    local lans="${NATGW_LINK_LANS[$index]}"
    local address="${NATGW_LINK_ADDRESSES[$index]}"
    local routed="${NATGW_LINK_ROUTED[$index]}"
    local isolated="${NATGW_LINK_ISOLATED[$index]}"
    local upstream=""

    natgw_load_applied "$bridge"
    if [ -n "$NATGW_APPLIED_WAN" ] && [ "$NATGW_APPLIED_WAN" != "$wan" ]; then
        natgw_firewall_revoke "$bridge" "$NATGW_APPLIED_WAN" "$NATGW_APPLIED_UFW" "$NATGW_APPLIED_DOCKER"
        natgw_clear_routing "$bridge" "$NATGW_APPLIED_WAN" "$NATGW_APPLIED_ISOLATED" "$NATGW_APPLIED_TABLE" "$NATGW_APPLIED_RPF"
        NATGW_APPLIED_TABLE=""
        NATGW_APPLIED_RPF=""
    fi
    if [ "$routed" != "yes" ] && [ -n "$NATGW_APPLIED_TABLE" ]; then
        natgw_clear_routing "$bridge" "$wan" "$NATGW_APPLIED_ISOLATED" "$NATGW_APPLIED_TABLE" "$NATGW_APPLIED_RPF"
        NATGW_APPLIED_TABLE=""
        NATGW_APPLIED_RPF=""
    fi

    natgw_ensure_ip_forward
    natgw_ensure_bridge "$bridge" "$lans" "$address"
    if [ "$routed" = "yes" ]; then
        if ! natgw_apply_routing "$bridge" "$wan" "$isolated"; then
            natgw_log "Waiting for a default route on $wan ($bridge)"
            return 1
        fi
        upstream="$(natgw_wan_dns "$wan")"
    fi
    natgw_firewall_allow "$bridge" "$wan"
    natgw_write_dhcp_hosts "$index" || true
    natgw_start_dnsmasq "$bridge" "$address" "$upstream" "$wan"

    NATGW_APPLIED_SIGNATURE="$signature"
    NATGW_APPLIED_WAN="$wan"
    NATGW_APPLIED_ADDRESS="$address"
    NATGW_APPLIED_ROUTED="$routed"
    NATGW_APPLIED_ISOLATED="$isolated"
    NATGW_APPLIED_LOST=""
    natgw_save_applied "$bridge"
    if [ "$routed" = "yes" ]; then
        natgw_log "Active $bridge: uplink $wan ($([ "$isolated" = "yes" ] && echo "relay only" || echo "also serves this host")) -> relay ${lans//,/ } ($address)"
    else
        natgw_log "Active $bridge: uplink $wan -> relay ${lans//,/ } ($address)"
    fi
}

natgw_teardown_link() {
    local bridge="$1"
    local reason="$2"
    local iface=""
    natgw_load_applied "$bridge"
    natgw_stop_dnsmasq "$bridge"
    rm -f "$(natgw_dhcp_hosts_file "$bridge")"
    natgw_clear_qdiscs "$bridge"
    natgw_firewall_revoke "$bridge" "$NATGW_APPLIED_WAN" "$NATGW_APPLIED_UFW" "$NATGW_APPLIED_DOCKER"
    natgw_clear_routing "$bridge" "$NATGW_APPLIED_WAN" "$NATGW_APPLIED_ISOLATED" "$NATGW_APPLIED_TABLE" "$NATGW_APPLIED_RPF"
    if [ -d "/sys/class/net/$bridge" ]; then
        while IFS= read -r iface; do
            natgw_release_port "$iface"
        done < <(natgw_bridge_members "$bridge")
        ip link del "$bridge" 2>/dev/null || true
    fi
    if [ -f "$(natgw_applied_file "$bridge")" ]; then
        natgw_log "Inactive $bridge: $reason"
    fi
    rm -f "$(natgw_applied_file "$bridge")"
}

natgw_teardown() {
    local reason="$1"
    local bridge=""
    natgw_migrate_run_state
    while IFS= read -r bridge; do
        natgw_teardown_link "$bridge" "$reason"
    done < <(natgw_known_bridges)
    natgw_clear_qdiscs ""
    nft delete table ip "$NATGW_NFT_TABLE" 2>/dev/null || true
    rm -f "$NATGW_NFT_RULES_FILE"
}

natgw_idle_reason() {
    local bridge="$1"
    local line=""
    if [ "$ROUTE_MODE" = "pairs" ]; then
        for line in "${NATGW_PAIR_REPORT[@]}"; do
            [ "${line%%|*}" = "$bridge" ] && { echo "${line##*|}"; return; }
        done
        echo "not a configured pair"
    elif [ ${#NATGW_LINK_BRIDGES[@]} -gt 0 ]; then
        echo "not used in single mode"
    elif [ -z "$NATGW_WAN" ]; then
        echo "no uplink (WAN_SELECT=$WAN_SELECT)"
    else
        echo "no relay port available (${NATGW_LAN_SKIPPED[*]:-none})"
    fi
}

# A bridge whose uplink interface vanished keeps its relay ports and DHCP
# server for NATGW_UPLINK_GRACE_SECONDS: a USB that re-enumerates (often under
# a new name) re-applies onto the same bridge without resetting the clients.
natgw_hold_link() {
    local bridge="$1"
    local now=""
    natgw_load_applied "$bridge"
    [ -n "$NATGW_APPLIED_WAN" ] && [ ! -e "/sys/class/net/$NATGW_APPLIED_WAN" ] || return 1
    now="$(date +%s)"
    if [ -z "$NATGW_APPLIED_LOST" ]; then
        NATGW_APPLIED_LOST="$now"
        natgw_save_applied "$bridge"
        natgw_log "Uplink $NATGW_APPLIED_WAN left $bridge: relay ports held for ${NATGW_UPLINK_GRACE_SECONDS}s"
        return 0
    fi
    [ $((now - NATGW_APPLIED_LOST)) -lt "$NATGW_UPLINK_GRACE_SECONDS" ]
}

natgw_reconcile() {
    local bridge=""
    local index=0
    local signature=""
    local reason=""
    local -a failed=()

    mkdir -p "$NATGW_RUN_DIR"
    NATGW_LAN_MAP_CACHE=()
    natgw_load_config
    natgw_migrate_run_state
    natgw_resolve_links

    while IFS= read -r bridge; do
        natgw_list_contains "$bridge" "${NATGW_LINK_BRIDGES[@]}" && continue
        natgw_hold_link "$bridge" && continue
        reason="$(natgw_idle_reason "$bridge")"
        natgw_teardown_link "$bridge" "$reason"
    done < <(natgw_known_bridges)

    for index in "${!NATGW_LINK_BRIDGES[@]}"; do
        signature="$(natgw_link_signature "$index")"
        natgw_load_applied "${NATGW_LINK_BRIDGES[$index]}"
        if [ "$signature" = "$NATGW_APPLIED_SIGNATURE" ] && natgw_link_healthy "$index"; then
            continue
        fi
        natgw_apply_link "$index" "$signature" || failed+=("$index")
    done
    for index in "${failed[@]}"; do
        natgw_teardown_link "${NATGW_LINK_BRIDGES[$index]}" "no default route on ${NATGW_LINK_WANS[$index]}"
        unset 'NATGW_LINK_BRIDGES[index]' 'NATGW_LINK_WANS[index]' 'NATGW_LINK_LANS[index]' \
            'NATGW_LINK_ADDRESSES[index]' 'NATGW_LINK_ROUTED[index]' 'NATGW_LINK_ISOLATED[index]'
    done
    natgw_sync_lan_scopes
    natgw_sync_nft
}

# ------------------------------------------------------------- reporting ----

natgw_print_ports() {
    local iface=""
    local kind=""
    local role=""
    local index=0
    local -a default_ifaces=()
    local -a lans=()

    natgw_load_config
    natgw_resolve_links
    mapfile -t default_ifaces < <(natgw_default_route_ifaces)
    printf '%-18s %-11s %-8s %-8s %-19s %-7s %s\n' "INTERFACE" "BUS" "MEDIA" "LINK" "IPV4" "DEFAULT" "ROLE"
    while IFS= read -r iface; do
        kind="onboard"
        natgw_is_usb "$iface" && kind="$NATGW_USB_PORT_PREFIX$(natgw_usb_port_of "$iface")"
        role="-"
        for index in "${!NATGW_LINK_BRIDGES[@]}"; do
            IFS=',' read -r -a lans <<< "${NATGW_LINK_LANS[$index]}"
            if [ "$iface" = "${NATGW_LINK_WANS[$index]}" ]; then
                role="uplink ${NATGW_LINK_BRIDGES[$index]}"
                [ "${NATGW_LINK_ROUTED[$index]}" = "yes" ] && role="$role, $([ "${NATGW_LINK_ISOLATED[$index]}" = "yes" ] && echo "relay only" || echo "host internet")"
            elif natgw_list_contains "$iface" "${lans[@]}"; then
                role="relay ${NATGW_LINK_BRIDGES[$index]}"
            fi
        done
        printf '%-18s %-11s %-8s %-8s %-19s %-7s %s\n' \
            "$iface" "$kind" "$(natgw_is_wireless "$iface" && echo wifi || echo wired)" \
            "$(natgw_has_carrier "$iface" && echo up || echo down)" \
            "$(natgw_ipv4_of "$iface")" \
            "$(natgw_list_contains "$iface" "${default_ifaces[@]}" && echo yes || echo -)" \
            "$role"
    done < <(natgw_physical_ifaces)
    [ "${#NATGW_LAN_SKIPPED[@]}" -gt 0 ] && echo "Skipped: ${NATGW_LAN_SKIPPED[*]}"
    return 0
}

natgw_print_pairs() {
    local line=""
    local -a fields=()
    [ ${#NATGW_PAIR_REPORT[@]} -gt 0 ] || { echo "Pairs: none (no relay port)"; return 0; }
    printf '%-8s %-22s %-18s %-18s %s\n' "BRIDGE" "USB (CONFIG)" "RELAY PORT" "USB (LIVE)" "STATE"
    for line in "${NATGW_PAIR_REPORT[@]}"; do
        IFS='|' read -r -a fields <<< "$line"
        printf '%-8s %-22s %-18s %-18s %s\n' "${fields[@]}"
    done
}

# Settings and bindings of every scope, or of one.
natgw_print_lan_scopes() {
    local wanted="$1"
    local scope=""
    local line=""
    local port=""
    local -a fields=()
    while IFS= read -r scope; do
        [ -z "$wanted" ] || [ "$scope" = "$wanted" ] || continue
        port="$(natgw_lan_port_of "$scope")"
        natgw_load_lan_scope "$scope"
        echo "Scope $scope${port:+ (port $port)}: fair-share=$LAN_FAIR_SHARE bandwidth-down=$([ "$LAN_BANDWIDTH_DOWN" -gt 0 ] && echo "${LAN_BANDWIDTH_DOWN}Mbit" || echo unshaped) bandwidth-up=$([ "$LAN_BANDWIDTH_UP" -gt 0 ] && echo "${LAN_BANDWIDTH_UP}Mbit" || echo unshaped) conn-limit=$([ "$LAN_HOST_CONN_LIMIT" -gt 0 ] && echo "$LAN_HOST_CONN_LIMIT" || echo off) auto-bind=$LAN_AUTO_BIND"
        while IFS= read -r line; do
            read -r -a fields <<< "$line"
            printf '  %-17s %-15s %-20s %-6s %s\n' "${fields[0]}" "${fields[1]}" "${fields[2]}" "${fields[4]}" "$(date -d "@${fields[3]}" '+%Y-%m-%d %H:%M' 2>/dev/null)"
        done < <(natgw_lan_bindings "$scope")
    done < <({ natgw_lan_scopes; [ -n "$wanted" ] && echo "$wanted"; } | awk 'NF && !seen[$0]++')
}

natgw_print_status() {
    local bridge=""
    local lease_file=""
    local active=0
    natgw_load_config
    echo "Config: $NATGW_CONFIG_FILE"
    if [ "$ROUTE_MODE" = "pairs" ]; then
        echo "  Mode:                 pairs (each relay port picks its USB uplink)"
        echo "  Pairs (PAIRS):        ${PAIRS:-auto (every LAN name, USBs in plug-in order)}"
        echo "  LAN names (LAN_MAP):  $(natgw_lan_map_entries | tr '\n' ' ')$([ -n "$LAN_MAP" ] || echo "(default)")"
        echo "  Host uplink (SYSTEM_WAN): $SYSTEM_WAN"
        echo "  Gateway addresses:    $LAN_ADDRESS, next /24 per pair (DHCP: $DHCP_ENABLED)"
    else
        echo "  Mode:                 single (one uplink for every relay port)"
        echo "  Uplink (WAN_SELECT):  $WAN_SELECT"
        echo "  Relay mode (LAN_MODE): $LAN_MODE${LAN_PORTS:+ ($LAN_PORTS)}"
        echo "  Gateway address:      $LAN_ADDRESS (DHCP: $DHCP_ENABLED, pool $NATGW_DHCP_START-$NATGW_DHCP_END)"
    fi
    echo "Service: $NATGW_SERVICE_NAME $(systemctl is-active "$NATGW_SERVICE_NAME" 2>/dev/null) / $(systemctl is-enabled "$NATGW_SERVICE_NAME" 2>/dev/null)"
    echo "IP forwarding: $(cat /proc/sys/net/ipv4/ip_forward 2>/dev/null)"
    natgw_migrate_run_state
    while IFS= read -r bridge; do
        natgw_load_applied "$bridge"
        [ -n "$NATGW_APPLIED_WAN" ] || continue
        if [ -n "$NATGW_APPLIED_LOST" ]; then
            echo "State: HOLD $bridge uplink=$NATGW_APPLIED_WAN gone since $(date -d "@$NATGW_APPLIED_LOST" '+%H:%M:%S') relay=[$(natgw_bridge_members "$bridge" | tr '\n' ' ')] (released after ${NATGW_UPLINK_GRACE_SECONDS}s)"
            active=$((active + 1))
            continue
        fi
        echo "State: ACTIVE $bridge uplink=$NATGW_APPLIED_WAN relay=[$(natgw_bridge_members "$bridge" | tr '\n' ' ')] address=$NATGW_APPLIED_ADDRESS${NATGW_APPLIED_TABLE:+ table=$NATGW_APPLIED_TABLE host-uplink=$([ "$NATGW_APPLIED_ISOLATED" = "yes" ] && echo no || echo yes)} ufw=$NATGW_APPLIED_UFW docker=$NATGW_APPLIED_DOCKER"
        active=$((active + 1))
    done < <(natgw_known_bridges)
    [ "$active" -gt 0 ] || echo "State: IDLE (waiting for an uplink and a relay port)"
    echo ""
    natgw_print_ports
    if [ "$ROUTE_MODE" = "pairs" ]; then
        echo ""
        natgw_print_pairs
    fi
    echo ""
    natgw_print_lan_scopes ""
    for lease_file in "$NATGW_RUN_DIR"/dnsmasq.*.leases; do
        [ -s "$lease_file" ] || continue
        echo ""
        echo "DHCP leases on $(basename "$lease_file" .leases | sed 's/^dnsmasq\.//') (expiry mac ip host):"
        awk '{print "  " $1, $2, $3, $4}' "$lease_file"
    done
}
