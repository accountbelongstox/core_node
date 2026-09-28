#!/bin/bash
# NAT gateway engine shared by the natgateway CLI/menu (113_natgateway.sh) and
# the monitor daemon (debian_com/natgateway_monitor.sh).
#
# Uplink (WAN): a USB network adapter (auto) or a named interface.
# Relay ports (LAN): one, a list, or all onboard wired ports, joined into one
# bridge that serves DHCP/DNS (dnsmasq) and is NATed out of the uplink with a
# dedicated nftables table. Every step is idempotent: natgw_reconcile compares
# the desired state with the applied one and only changes what differs.
#
# References: nftables NAT (wiki.nftables.org "Performing Network Address
# Translation"), Debian nftables default (wiki.debian.org/nftables), ufw route
# rules (ufw(8)), Docker DOCKER-USER (docs.docker.com firewall-iptables),
# NetworkManager runtime "managed" (NetworkManager.conf(5)), dnsmasq(8).

if [ "${NATGW_ENGINE_LOADED:-false}" = "true" ]; then
    return
fi
NATGW_ENGINE_LOADED="true"

NATGW_CONFIG_DIR="${NATGW_CONFIG_DIR:-${CORE_NODE_DATA_DIR:-/www/core_node}/natgateway}"
NATGW_CONFIG_FILE="$NATGW_CONFIG_DIR/router.conf"
NATGW_LEGACY_CONFIG_FILE="$NATGW_CONFIG_DIR/interface_cache.conf"
NATGW_RUN_DIR="/run/ncore-natgateway"
NATGW_APPLIED_FILE="$NATGW_RUN_DIR/applied"
NATGW_DNSMASQ_PID_FILE="$NATGW_RUN_DIR/dnsmasq.pid"
NATGW_LEASE_FILE="$NATGW_RUN_DIR/dnsmasq.leases"
NATGW_SYSCTL_FILE="/etc/sysctl.d/99-ncore-natgateway.conf"
NATGW_BRIDGE="ncbr0"
NATGW_NFT_TABLE="ncore_natgateway"
NATGW_SERVICE_NAME="ncore-natgateway"
NATGW_DEFAULT_ADDRESS="192.168.50.1/24"
NATGW_DHCP_FIRST_HOST="100"
NATGW_DHCP_LAST_HOST="200"
NATGW_DHCP_LEASE_TIME="12h"
NATGW_DOCKER_CHAIN="DOCKER-USER"
NATGW_POLL_SECONDS=5
NATGW_CONFIG_KEYS="WAN_SELECT LAN_MODE LAN_PORTS LAN_ADDRESS DHCP_ENABLED"

WAN_SELECT="usb"
LAN_MODE="all"
LAN_PORTS=""
LAN_ADDRESS="$NATGW_DEFAULT_ADDRESS"
DHCP_ENABLED="yes"

NATGW_WAN=""
NATGW_LAN_LIST=()
NATGW_LAN_SKIPPED=()
NATGW_GATEWAY_IP=""
NATGW_DHCP_START=""
NATGW_DHCP_END=""
NATGW_APPLIED_SIGNATURE=""
NATGW_APPLIED_WAN=""
NATGW_APPLIED_ADDRESS=""
NATGW_APPLIED_UFW=""
NATGW_APPLIED_DOCKER=""

natgw_log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')][NATGATEWAY] $*"
}

# ---------------------------------------------------------------- config ----

# key=value parser (never `source`: the file lives in a shared data dir).
natgw_read_kv_file() {
    local file="$1"
    local key=""
    local value=""
    while IFS='=' read -r key value; do
        case " $NATGW_CONFIG_KEYS WAN_KEYWORD LAN_KEYWORD " in
            *" $key "*) ;;
            *) continue ;;
        esac
        value="${value%\"}"
        value="${value#\"}"
        printf -v "$key" '%s' "$value"
    done < "$file"
}

natgw_load_config() {
    local WAN_KEYWORD=""
    local LAN_KEYWORD=""

    WAN_SELECT="usb"
    LAN_MODE="all"
    LAN_PORTS=""
    LAN_ADDRESS="$NATGW_DEFAULT_ADDRESS"
    DHCP_ENABLED="yes"

    if [ -f "$NATGW_CONFIG_FILE" ]; then
        natgw_read_kv_file "$NATGW_CONFIG_FILE"
    elif [ -f "$NATGW_LEGACY_CONFIG_FILE" ]; then
        # Legacy keyword pair (WAN_KEYWORD/LAN_KEYWORD): keywords resolve as
        # interface-name substrings, so they map onto WAN_SELECT / LAN_PORTS.
        natgw_read_kv_file "$NATGW_LEGACY_CONFIG_FILE"
        [ -n "$WAN_KEYWORD" ] && WAN_SELECT="$WAN_KEYWORD"
        if [ -n "$LAN_KEYWORD" ]; then
            LAN_MODE="list"
            LAN_PORTS="$LAN_KEYWORD"
        fi
    fi
    case "$LAN_MODE" in all|one|list) ;; *) LAN_MODE="all" ;; esac
    [ -n "$WAN_SELECT" ] || WAN_SELECT="usb"
    natgw_address_valid "$LAN_ADDRESS" || LAN_ADDRESS="$NATGW_DEFAULT_ADDRESS"
    [ "$DHCP_ENABLED" = "no" ] || DHCP_ENABLED="yes"
    natgw_derive_address
}

natgw_save_config() {
    local tmp_file=""
    mkdir -p "$NATGW_CONFIG_DIR"
    tmp_file="$(mktemp "$NATGW_CONFIG_DIR/.router.conf.XXXXXX")"
    {
        echo "# NAT gateway configuration (natgateway set-wan / set-lan / set-address / set-dhcp)"
        echo "WAN_SELECT=\"$WAN_SELECT\""
        echo "LAN_MODE=\"$LAN_MODE\""
        echo "LAN_PORTS=\"$LAN_PORTS\""
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
    local network=""
    NATGW_GATEWAY_IP="${LAN_ADDRESS%/*}"
    network="${NATGW_GATEWAY_IP%.*}"
    NATGW_DHCP_START="$network.$NATGW_DHCP_FIRST_HOST"
    NATGW_DHCP_END="$network.$NATGW_DHCP_LAST_HOST"
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
    [ "$iface" != "$NATGW_BRIDGE" ] || return 1
    natgw_has_carrier "$iface" && natgw_has_ipv4 "$iface"
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

# A port may join the bridge when it is wired, not the uplink, and not owned
# by another master (bond/bridge).
natgw_lan_eligible() {
    local iface="$1"
    local master=""
    natgw_is_physical "$iface" || return 1
    natgw_is_wireless "$iface" && return 1
    [ "$iface" != "$NATGW_WAN" ] || return 1
    master="$(natgw_master_of "$iface")"
    [ -z "$master" ] || [ "$master" = "$NATGW_BRIDGE" ]
}

# all: every onboard (non-USB) wired port, except ports that carry this host's
# own default route (taking them would cut the machine off).
# one/list: the named ports (names or keywords), in order.
natgw_resolve_lan() {
    local iface=""
    local entry=""
    local -a default_ifaces=()
    local -a wanted=()

    NATGW_LAN_LIST=()
    NATGW_LAN_SKIPPED=()
    [ -n "$NATGW_WAN" ] || return 0
    mapfile -t default_ifaces < <(natgw_default_route_ifaces)

    if [ "$LAN_MODE" = "all" ]; then
        while IFS= read -r iface; do
            natgw_lan_eligible "$iface" || continue
            natgw_is_usb "$iface" && continue
            if natgw_list_contains "$iface" "${default_ifaces[@]}" && [ "$(natgw_master_of "$iface")" != "$NATGW_BRIDGE" ]; then
                NATGW_LAN_SKIPPED+=("$iface(default-route)")
                continue
            fi
            NATGW_LAN_LIST+=("$iface")
        done < <(natgw_physical_ifaces)
        return 0
    fi

    IFS=',' read -r -a wanted <<< "${LAN_PORTS// /}"
    for entry in "${wanted[@]}"; do
        [ -n "$entry" ] || continue
        iface="$(natgw_resolve_name "$entry")"
        if [ -z "$iface" ] || ! natgw_lan_eligible "$iface"; then
            NATGW_LAN_SKIPPED+=("$entry(unavailable)")
            continue
        fi
        natgw_list_contains "$iface" "${NATGW_LAN_LIST[@]}" && continue
        NATGW_LAN_LIST+=("$iface")
        [ "$LAN_MODE" = "one" ] && break
    done
    return 0
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
    local wan="$1"
    NATGW_APPLIED_UFW="no"
    NATGW_APPLIED_DOCKER="no"
    if natgw_ufw_active; then
        ufw route allow in on "$NATGW_BRIDGE" out on "$wan" >/dev/null
        ufw route allow in on "$NATGW_BRIDGE" out on "$NATGW_BRIDGE" >/dev/null
        NATGW_APPLIED_UFW="yes"
    fi
    if natgw_docker_chain_present; then
        iptables -C "$NATGW_DOCKER_CHAIN" -i "$NATGW_BRIDGE" -o "$wan" -j ACCEPT 2>/dev/null \
            || iptables -I "$NATGW_DOCKER_CHAIN" -i "$NATGW_BRIDGE" -o "$wan" -j ACCEPT
        iptables -C "$NATGW_DOCKER_CHAIN" -i "$wan" -o "$NATGW_BRIDGE" -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT 2>/dev/null \
            || iptables -I "$NATGW_DOCKER_CHAIN" -i "$wan" -o "$NATGW_BRIDGE" -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
        iptables -C "$NATGW_DOCKER_CHAIN" -i "$NATGW_BRIDGE" -o "$NATGW_BRIDGE" -j ACCEPT 2>/dev/null \
            || iptables -I "$NATGW_DOCKER_CHAIN" -i "$NATGW_BRIDGE" -o "$NATGW_BRIDGE" -j ACCEPT
        NATGW_APPLIED_DOCKER="yes"
    fi
}

natgw_firewall_revoke() {
    local wan="$1"
    local ufw_used="$2"
    local docker_used="$3"
    [ -n "$wan" ] || return 0
    if [ "$ufw_used" = "yes" ] && command -v ufw >/dev/null 2>&1; then
        ufw route delete allow in on "$NATGW_BRIDGE" out on "$wan" >/dev/null 2>&1 || true
        ufw route delete allow in on "$NATGW_BRIDGE" out on "$NATGW_BRIDGE" >/dev/null 2>&1 || true
    fi
    if [ "$docker_used" = "yes" ] && natgw_docker_chain_present; then
        iptables -D "$NATGW_DOCKER_CHAIN" -i "$NATGW_BRIDGE" -o "$wan" -j ACCEPT 2>/dev/null || true
        iptables -D "$NATGW_DOCKER_CHAIN" -i "$wan" -o "$NATGW_BRIDGE" -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true
        iptables -D "$NATGW_DOCKER_CHAIN" -i "$NATGW_BRIDGE" -o "$NATGW_BRIDGE" -j ACCEPT 2>/dev/null || true
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
    local path=""
    for path in /sys/class/net/"$NATGW_BRIDGE"/brif/*; do
        [ -e "$path" ] && basename "$path"
    done
}

natgw_ensure_bridge() {
    local iface=""
    if [ ! -d "/sys/class/net/$NATGW_BRIDGE" ]; then
        ip link add name "$NATGW_BRIDGE" type bridge
        natgw_log "Created bridge $NATGW_BRIDGE"
    fi
    natgw_nm_set_managed "$NATGW_BRIDGE" no
    ip link set "$NATGW_BRIDGE" up

    while IFS= read -r iface; do
        natgw_list_contains "$iface" "${NATGW_LAN_LIST[@]}" && continue
        natgw_release_port "$iface"
    done < <(natgw_bridge_members)

    for iface in "${NATGW_LAN_LIST[@]}"; do
        [ "$(natgw_master_of "$iface")" = "$NATGW_BRIDGE" ] && continue
        natgw_nm_set_managed "$iface" no
        ip -4 addr flush dev "$iface" 2>/dev/null || true
        ip link set "$iface" master "$NATGW_BRIDGE"
        ip link set "$iface" up
        natgw_log "Relay port joined: $iface"
    done

    if [ -n "$NATGW_APPLIED_ADDRESS" ] && [ "$NATGW_APPLIED_ADDRESS" != "$LAN_ADDRESS" ]; then
        ip addr del "$NATGW_APPLIED_ADDRESS" dev "$NATGW_BRIDGE" 2>/dev/null || true
    fi
    ip addr replace "$LAN_ADDRESS" dev "$NATGW_BRIDGE"
}

natgw_release_port() {
    local iface="$1"
    ip link set "$iface" nomaster 2>/dev/null || true
    natgw_nm_set_managed "$iface" yes
    natgw_log "Relay port released: $iface"
}

# Atomic replace of our own table only (add + delete + define in one nft run).
natgw_apply_nft() {
    local wan="$1"
    nft -f - <<EOF
add table ip $NATGW_NFT_TABLE
delete table ip $NATGW_NFT_TABLE
table ip $NATGW_NFT_TABLE {
    chain forward {
        type filter hook forward priority filter; policy accept;
        oifname "$wan" tcp flags syn tcp option maxseg size set rt mtu
        iifname "$NATGW_BRIDGE" oifname "$wan" accept
        iifname "$wan" oifname "$NATGW_BRIDGE" ct state established,related accept
    }
    chain postrouting {
        type nat hook postrouting priority srcnat; policy accept;
        iifname "$NATGW_BRIDGE" oifname "$wan" masquerade
    }
}
EOF
}

natgw_nft_present() {
    nft list table ip "$NATGW_NFT_TABLE" >/dev/null 2>&1
}

natgw_dnsmasq_alive() {
    local pid=""
    pid="$(cat "$NATGW_DNSMASQ_PID_FILE" 2>/dev/null)"
    [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

natgw_stop_dnsmasq() {
    local pid=""
    pid="$(cat "$NATGW_DNSMASQ_PID_FILE" 2>/dev/null)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
    fi
    rm -f "$NATGW_DNSMASQ_PID_FILE"
}

# DHCP + DNS on the bridge address only (bind-interfaces, loopback excluded),
# so it never clashes with systemd-resolved or another dnsmasq.
natgw_start_dnsmasq() {
    natgw_stop_dnsmasq
    [ "$DHCP_ENABLED" = "yes" ] || return 0
    dnsmasq \
        --conf-file=/dev/null \
        --bind-interfaces \
        --interface="$NATGW_BRIDGE" \
        --except-interface=lo \
        --dhcp-authoritative \
        --dhcp-range="$NATGW_DHCP_START,$NATGW_DHCP_END,255.255.255.0,$NATGW_DHCP_LEASE_TIME" \
        --dhcp-option=option:router,"$NATGW_GATEWAY_IP" \
        --dhcp-option=option:dns-server,"$NATGW_GATEWAY_IP" \
        --dhcp-leasefile="$NATGW_LEASE_FILE" \
        --pid-file="$NATGW_DNSMASQ_PID_FILE" \
        --user=root
    natgw_log "DHCP/DNS serving $NATGW_DHCP_START-$NATGW_DHCP_END via $NATGW_GATEWAY_IP"
}

# ----------------------------------------------------------- reconcile ------

natgw_load_applied() {
    NATGW_APPLIED_SIGNATURE=""
    NATGW_APPLIED_WAN=""
    NATGW_APPLIED_ADDRESS=""
    NATGW_APPLIED_UFW=""
    NATGW_APPLIED_DOCKER=""
    [ -f "$NATGW_APPLIED_FILE" ] || return 0
    {
        IFS= read -r NATGW_APPLIED_SIGNATURE
        IFS= read -r NATGW_APPLIED_WAN
        IFS= read -r NATGW_APPLIED_ADDRESS
        IFS= read -r NATGW_APPLIED_UFW
        IFS= read -r NATGW_APPLIED_DOCKER
    } < "$NATGW_APPLIED_FILE"
}

natgw_healthy() {
    local -a members=()
    [ -d "/sys/class/net/$NATGW_BRIDGE" ] || return 1
    natgw_nft_present || return 1
    if [ "$DHCP_ENABLED" = "yes" ]; then
        natgw_dnsmasq_alive || return 1
    fi
    mapfile -t members < <(natgw_bridge_members)
    [ "${#members[@]}" -eq "${#NATGW_LAN_LIST[@]}" ]
}

natgw_apply() {
    local signature="$1"
    mkdir -p "$NATGW_RUN_DIR"
    if [ -n "$NATGW_APPLIED_WAN" ] && [ "$NATGW_APPLIED_WAN" != "$NATGW_WAN" ]; then
        natgw_firewall_revoke "$NATGW_APPLIED_WAN" "$NATGW_APPLIED_UFW" "$NATGW_APPLIED_DOCKER"
    fi
    natgw_ensure_ip_forward
    natgw_ensure_bridge
    natgw_apply_nft "$NATGW_WAN"
    natgw_firewall_allow "$NATGW_WAN"
    natgw_start_dnsmasq
    printf '%s\n' "$signature" "$NATGW_WAN" "$LAN_ADDRESS" "$NATGW_APPLIED_UFW" "$NATGW_APPLIED_DOCKER" > "$NATGW_APPLIED_FILE"
    natgw_log "Active: uplink $NATGW_WAN -> relay ${NATGW_LAN_LIST[*]} ($LAN_ADDRESS)"
}

natgw_teardown() {
    local reason="$1"
    local iface=""
    natgw_load_applied
    natgw_stop_dnsmasq
    natgw_firewall_revoke "$NATGW_APPLIED_WAN" "$NATGW_APPLIED_UFW" "$NATGW_APPLIED_DOCKER"
    nft delete table ip "$NATGW_NFT_TABLE" 2>/dev/null || true
    if [ -d "/sys/class/net/$NATGW_BRIDGE" ]; then
        while IFS= read -r iface; do
            natgw_release_port "$iface"
        done < <(natgw_bridge_members)
        ip link del "$NATGW_BRIDGE" 2>/dev/null || true
    fi
    if [ -f "$NATGW_APPLIED_FILE" ]; then
        natgw_log "Inactive: $reason"
    fi
    rm -f "$NATGW_APPLIED_FILE"
}

natgw_reconcile() {
    local signature=""
    natgw_load_config
    natgw_load_applied
    natgw_resolve_wan
    natgw_resolve_lan

    if [ -z "$NATGW_WAN" ] || [ "${#NATGW_LAN_LIST[@]}" -eq 0 ]; then
        if [ -f "$NATGW_APPLIED_FILE" ] || [ -d "/sys/class/net/$NATGW_BRIDGE" ]; then
            if [ -z "$NATGW_WAN" ]; then
                natgw_teardown "no uplink (WAN_SELECT=$WAN_SELECT)"
            else
                natgw_teardown "no relay port available (${NATGW_LAN_SKIPPED[*]:-none})"
            fi
        fi
        return 0
    fi

    signature="$NATGW_WAN|${NATGW_LAN_LIST[*]}|$LAN_ADDRESS|$DHCP_ENABLED|$(natgw_ufw_active && echo ufw)|$(natgw_docker_chain_present && echo docker)"
    if [ "$signature" = "$NATGW_APPLIED_SIGNATURE" ] && natgw_healthy; then
        return 0
    fi
    natgw_apply "$signature"
}

# ------------------------------------------------------------- reporting ----

natgw_print_ports() {
    local iface=""
    local kind=""
    local role=""
    local -a default_ifaces=()

    natgw_load_config
    natgw_resolve_wan
    natgw_resolve_lan
    mapfile -t default_ifaces < <(natgw_default_route_ifaces)
    printf '%-18s %-9s %-8s %-8s %-19s %-7s %s\n' "INTERFACE" "BUS" "MEDIA" "LINK" "IPV4" "DEFAULT" "ROLE"
    while IFS= read -r iface; do
        kind="onboard"
        natgw_is_usb "$iface" && kind="usb"
        role="-"
        [ "$iface" = "$NATGW_WAN" ] && role="uplink (WAN)"
        natgw_list_contains "$iface" "${NATGW_LAN_LIST[@]}" && role="relay (LAN)"
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

natgw_print_status() {
    natgw_load_config
    natgw_load_applied
    echo "Config: $NATGW_CONFIG_FILE"
    echo "  Uplink (WAN_SELECT):  $WAN_SELECT"
    echo "  Relay mode (LAN_MODE): $LAN_MODE${LAN_PORTS:+ ($LAN_PORTS)}"
    echo "  Gateway address:      $LAN_ADDRESS (DHCP: $DHCP_ENABLED, pool $NATGW_DHCP_START-$NATGW_DHCP_END)"
    echo "Service: $NATGW_SERVICE_NAME $(systemctl is-active "$NATGW_SERVICE_NAME" 2>/dev/null) / $(systemctl is-enabled "$NATGW_SERVICE_NAME" 2>/dev/null)"
    echo "IP forwarding: $(cat /proc/sys/net/ipv4/ip_forward 2>/dev/null)"
    if [ -n "$NATGW_APPLIED_WAN" ]; then
        echo "State: ACTIVE  uplink=$NATGW_APPLIED_WAN relay=[$(natgw_bridge_members | tr '\n' ' ')] ufw=$NATGW_APPLIED_UFW docker=$NATGW_APPLIED_DOCKER"
    else
        echo "State: IDLE (waiting for an uplink and a relay port)"
    fi
    echo ""
    natgw_print_ports
    if [ -s "$NATGW_LEASE_FILE" ]; then
        echo ""
        echo "DHCP leases (expiry mac ip host):"
        awk '{print "  " $1, $2, $3, $4}' "$NATGW_LEASE_FILE"
    fi
}
