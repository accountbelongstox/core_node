#!/bin/bash
# NAT gateway engine shared by the natgateway CLI/menu (113_natgateway.sh) and
# the monitor daemon (debian_com/natgateway_monitor.sh).
#
# ROUTE_MODE=single: one uplink (a USB network adapter, auto, or a named
# interface) relayed to one, a list, or all onboard wired ports joined into one
# bridge (ncbr0).
# ROUTE_MODE=pairs: every pair maps one USB uplink (auto or named) 1:1 to one
# relay port, each on its own bridge (ncbr<N>), subnet, DHCP/DNS server and
# routing table (policy rule "iif ncbr<N>"). A pair goes live when its USB
# adapter appears and is released when it leaves. One pair USB at most
# (SYSTEM_WAN) keeps its default route in the main table and serves this host;
# the default route of every other pair USB is moved into its pair table, so
# the host never uses it.
# Every link is NATed out of its uplink by one dedicated nftables table and
# reconciled idempotently: only what differs from the applied state changes.
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
NATGW_CONFIG_KEYS="ROUTE_MODE WAN_SELECT LAN_MODE LAN_PORTS PAIRS SYSTEM_WAN LAN_ADDRESS DHCP_ENABLED"
NATGW_APPLIED_KEYS="SIGNATURE WAN ADDRESS UFW DOCKER ROUTED ISOLATED TABLE RPF"

ROUTE_MODE="single"
WAN_SELECT="usb"
LAN_MODE="all"
LAN_PORTS=""
PAIRS=""
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
    natgw_address_valid "$LAN_ADDRESS" || LAN_ADDRESS="$NATGW_DEFAULT_ADDRESS"
    [ "$DHCP_ENABLED" = "no" ] || DHCP_ENABLED="yes"
    natgw_derive_address "$LAN_ADDRESS"
}

natgw_save_config() {
    local tmp_file=""
    mkdir -p "$NATGW_CONFIG_DIR"
    tmp_file="$(mktemp "$NATGW_CONFIG_DIR/.router.conf.XXXXXX")"
    {
        echo "# NAT gateway configuration (natgateway set-mode / set-wan / set-lan / set-pairs / set-system-wan / set-address / set-dhcp)"
        echo "ROUTE_MODE=\"$ROUTE_MODE\""
        echo "WAN_SELECT=\"$WAN_SELECT\""
        echo "LAN_MODE=\"$LAN_MODE\""
        echo "LAN_PORTS=\"$LAN_PORTS\""
        echo "PAIRS=\"$PAIRS\""
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
        iface="$(natgw_resolve_name "$WAN_SELECT")"
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
        iface="$(natgw_resolve_name "$entry")"
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

# Pair specs "<usb>:<lan>" (usb = auto | interface) into NATGW_PAIR_SPECS;
# PAIRS empty = one auto pair per onboard relay port.
natgw_collect_pair_specs() {
    local entry=""
    local -a entries=()
    NATGW_PAIR_SPECS=()
    if [ -z "$PAIRS" ]; then
        natgw_collect_onboard_ports
        for entry in "${NATGW_ONBOARD_PORTS[@]}"; do
            NATGW_PAIR_SPECS+=("auto:$entry")
        done
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

# USB uplinks that can serve a pair now: link, IPv4 and a default route.
natgw_ready_usb_uplinks() {
    local iface=""
    while IFS= read -r iface; do
        natgw_is_usb "$iface" || continue
        natgw_list_contains "$iface" "$@" && continue
        natgw_wan_ready "$iface" || continue
        natgw_find_gateway "$iface" || continue
        echo "$iface"
    done < <(natgw_physical_ifaces)
}

natgw_add_link() {
    NATGW_LINK_BRIDGES+=("$1")
    NATGW_LINK_WANS+=("$2")
    NATGW_LINK_LANS+=("$3")
    NATGW_LINK_ADDRESSES+=("$4")
    NATGW_LINK_ROUTED+=("$5")
    NATGW_LINK_ISOLATED+=("no")
}

# Named USBs are reserved first; an auto pair keeps the uplink it already
# serves while that uplink stays ready, then takes the next free ready USB.
natgw_resolve_pairs() {
    local -a usb_specs=()
    local -a lan_specs=()
    local -a lans=()
    local -a assigned=()
    local -a ready=()
    local -a taken=()
    local -a used_lans=()
    local index=0
    local spec=""
    local usb=""
    local lan=""
    local address=""
    local state=""

    natgw_collect_pair_specs
    for index in "${!NATGW_PAIR_SPECS[@]}"; do
        spec="${NATGW_PAIR_SPECS[$index]}"
        usb_specs[index]="${spec%%:*}"
        lan_specs[index]="${spec#*:}"
        lans[index]="$(natgw_resolve_name "${lan_specs[$index]}")"
        assigned[index]=""
    done
    mapfile -t ready < <(natgw_ready_usb_uplinks "${lans[@]}")

    for index in "${!NATGW_PAIR_SPECS[@]}"; do
        [ "${usb_specs[$index]}" = "auto" ] && continue
        usb="$(natgw_resolve_name "${usb_specs[$index]}")"
        if [ -n "$usb" ] && natgw_list_contains "$usb" "${ready[@]}" && ! natgw_list_contains "$usb" "${taken[@]}"; then
            assigned[index]="$usb"
            taken+=("$usb")
        fi
    done
    for index in "${!NATGW_PAIR_SPECS[@]}"; do
        [ "${usb_specs[$index]}" = "auto" ] || continue
        natgw_load_applied "$NATGW_BRIDGE_PREFIX$index"
        usb="$NATGW_APPLIED_WAN"
        if [ -n "$usb" ] && natgw_list_contains "$usb" "${ready[@]}" && ! natgw_list_contains "$usb" "${taken[@]}"; then
            assigned[index]="$usb"
            taken+=("$usb")
        fi
    done
    for index in "${!NATGW_PAIR_SPECS[@]}"; do
        [ "${usb_specs[$index]}" = "auto" ] && [ -z "${assigned[$index]}" ] || continue
        for usb in "${ready[@]}"; do
            natgw_list_contains "$usb" "${taken[@]}" && continue
            assigned[index]="$usb"
            taken+=("$usb")
            break
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
        elif natgw_list_contains "$lan" "${used_lans[@]}"; then
            state="relay port used by an earlier pair"
        elif [ -z "$address" ]; then
            state="address out of range"
        fi
        NATGW_PAIR_REPORT+=("$NATGW_BRIDGE_PREFIX$index|${usb_specs[$index]}|${lan_specs[$index]}|${usb:--}|$state")
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
            wanted="$(natgw_resolve_name "$SYSTEM_WAN")"
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
# mode a bridge may only leave through its own uplink.
natgw_nft_rules() {
    local index=0
    local bridge=""
    local wan=""
    local -a clamped=()
    echo "table ip $NATGW_NFT_TABLE {"
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
    rules="$(natgw_nft_rules)"
    if natgw_nft_present && [ "$rules" = "$(cat "$NATGW_NFT_RULES_FILE" 2>/dev/null)" ]; then
        return 0
    fi
    printf 'add table ip %s\ndelete table ip %s\n%s\n' "$NATGW_NFT_TABLE" "$NATGW_NFT_TABLE" "$rules" | nft -f -
    printf '%s\n' "$rules" > "$NATGW_NFT_RULES_FILE"
}

natgw_dnsmasq_pid_file() {
    echo "$NATGW_RUN_DIR/dnsmasq.$1.pid"
}

natgw_lease_file() {
    echo "$NATGW_RUN_DIR/dnsmasq.$1.leases"
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
        --pid-file="$(natgw_dnsmasq_pid_file "$bridge")" \
        --user=root \
        "${upstream_args[@]}"
    natgw_log "DHCP/DNS on $bridge: $NATGW_DHCP_START-$NATGW_DHCP_END via $NATGW_GATEWAY_IP${upstream:+ (upstream $upstream@$wan)}"
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
    echo "$wan|${NATGW_LINK_LANS[$index]}|${NATGW_LINK_ADDRESSES[$index]}|$DHCP_ENABLED|$(natgw_ufw_active && echo ufw)|$(natgw_docker_chain_present && echo docker)|${NATGW_LINK_ROUTED[$index]}|${NATGW_LINK_ISOLATED[$index]}|$gateway|$(natgw_wan_dns "$wan")"
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
    natgw_start_dnsmasq "$bridge" "$address" "$upstream" "$wan"

    NATGW_APPLIED_SIGNATURE="$signature"
    NATGW_APPLIED_WAN="$wan"
    NATGW_APPLIED_ADDRESS="$address"
    NATGW_APPLIED_ROUTED="$routed"
    NATGW_APPLIED_ISOLATED="$isolated"
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

natgw_reconcile() {
    local bridge=""
    local index=0
    local signature=""
    local reason=""
    local -a failed=()

    mkdir -p "$NATGW_RUN_DIR"
    natgw_load_config
    natgw_migrate_run_state
    natgw_resolve_links

    while IFS= read -r bridge; do
        natgw_list_contains "$bridge" "${NATGW_LINK_BRIDGES[@]}" && continue
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
    printf '%-18s %-9s %-8s %-8s %-19s %-7s %s\n' "INTERFACE" "BUS" "MEDIA" "LINK" "IPV4" "DEFAULT" "ROLE"
    while IFS= read -r iface; do
        kind="onboard"
        natgw_is_usb "$iface" && kind="usb"
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
        printf '%-18s %-9s %-8s %-8s %-19s %-7s %s\n' \
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
    printf '%-8s %-18s %-18s %-18s %s\n' "BRIDGE" "USB (CONFIG)" "RELAY PORT" "USB (LIVE)" "STATE"
    for line in "${NATGW_PAIR_REPORT[@]}"; do
        IFS='|' read -r -a fields <<< "$line"
        printf '%-8s %-18s %-18s %-18s %s\n' "${fields[@]}"
    done
}

natgw_print_status() {
    local bridge=""
    local lease_file=""
    local active=0
    natgw_load_config
    echo "Config: $NATGW_CONFIG_FILE"
    if [ "$ROUTE_MODE" = "pairs" ]; then
        echo "  Mode:                 pairs (one USB uplink per relay port)"
        echo "  Pairs (PAIRS):        ${PAIRS:-auto (every onboard port, USB auto)}"
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
    for lease_file in "$NATGW_RUN_DIR"/dnsmasq.*.leases; do
        [ -s "$lease_file" ] || continue
        echo ""
        echo "DHCP leases on $(basename "$lease_file" .leases | sed 's/^dnsmasq\.//') (expiry mac ip host):"
        awk '{print "  " $1, $2, $3, $4}' "$lease_file"
    done
}
