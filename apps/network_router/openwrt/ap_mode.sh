#!/bin/sh
# Turns an OpenWrt router into a plain wireless access point behind the
# natgateway host (this host routes, NATs, serves DHCP/DNS and shapes; the
# router only bridges its Wi-Fi and ports into one LAN). Run on the router:
#   sh ap_mode.sh apply [ap_ip/24] [gateway]   default 192.168.50.2/24 via 192.168.50.1
#   sh ap_mode.sh status
#   sh ap_mode.sh restore                      undo with the newest backup
# Wire the natgateway relay port (LAN1) to a router LAN port; apply also bridges
# the WAN port into br-lan, so any port works. The router is then reached at
# the AP address from the 192.168.50.0/24 network.

BACKUP_DIR="/root/ap-mode-backups"
CONFIGS="network dhcp wireless firewall"
PROXY_SERVICES="openclash passwall passwall2 shadowsocksr homeproxy v2raya mihomo nikki"
AP_ADDRESS="192.168.50.2/24"
AP_GATEWAY="192.168.50.1"

log() {
    echo "[AP-MODE] $*"
}

backup() {
    local stamp=""
    stamp="$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    (cd /etc/config && tar -czf "$BACKUP_DIR/config-$stamp.tar.gz" $CONFIGS 2>/dev/null)
    log "Backup: $BACKUP_DIR/config-$stamp.tar.gz"
}

# The br-lan device section (DSA, OpenWrt 21.02+), empty on swconfig builds.
br_lan_section() {
    uci show network 2>/dev/null | sed -n "s/^network\.\([^.]*\)\.name='br-lan'$/\1/p" | head -n 1
}

wan_device() {
    uci -q get network.wan.device || uci -q get network.wan.ifname
}

apply() {
    local address="${1:-$AP_ADDRESS}"
    local gateway="${2:-$AP_GATEWAY}"
    local ip="${address%/*}"
    local wan=""
    local section=""
    local iface=""
    local service=""

    backup
    wan="$(wan_device)"
    section="$(br_lan_section)"

    uci set network.lan.proto='static'
    uci set network.lan.ipaddr="$ip"
    uci set network.lan.netmask='255.255.255.0'
    uci set network.lan.gateway="$gateway"
    uci -q delete network.lan.dns
    uci add_list network.lan.dns="$gateway"
    uci -q delete network.lan.ip6assign

    if [ -n "$wan" ]; then
        if [ -n "$section" ]; then
            uci show "network.$section.ports" 2>/dev/null | grep -q "'$wan'" || uci add_list "network.$section.ports=$wan"
        else
            uci set network.lan.ifname="$(uci -q get network.lan.ifname) $wan"
        fi
        log "WAN port $wan joined br-lan"
    fi
    for iface in wan wan6; do
        uci -q get "network.$iface" >/dev/null && uci set "network.$iface.proto=none" && uci set "network.$iface.auto=0"
    done

    uci set dhcp.lan.ignore='1'
    uci set dhcp.lan.dhcpv6='disabled'
    uci set dhcp.lan.ra='disabled'
    uci -q delete dhcp.lan.ra_management

    for iface in $(uci show wireless 2>/dev/null | sed -n "s/^wireless\.\([^.]*\)=wifi-iface$/\1/p"); do
        uci set "wireless.$iface.network=lan"
        uci set "wireless.$iface.isolate=0"
        uci set "wireless.$iface.mode=ap"
    done
    uci commit

    for service in odhcpd $PROXY_SERVICES; do
        [ -x "/etc/init.d/$service" ] || continue
        "/etc/init.d/$service" stop >/dev/null 2>&1
        "/etc/init.d/$service" disable >/dev/null 2>&1
        log "Disabled service: $service"
    done

    log "AP mode set: $ip via $gateway, DHCP off, Wi-Fi bridged to LAN without isolation"
    log "Network restarts in 3s; reconnect to http://$ip from the $gateway network"
    (sleep 3; /etc/init.d/network restart; wifi reload) >/dev/null 2>&1 &
}

status() {
    echo "LAN: $(uci -q get network.lan.proto) $(uci -q get network.lan.ipaddr) gw $(uci -q get network.lan.gateway) dns $(uci -q get network.lan.dns)"
    echo "br-lan ports: $(uci -q get "network.$(br_lan_section).ports" || uci -q get network.lan.ifname)"
    echo "WAN: proto $(uci -q get network.wan.proto) device $(wan_device)"
    echo "DHCP on LAN: $([ "$(uci -q get dhcp.lan.ignore)" = "1" ] && echo off || echo on)"
    for iface in $(uci show wireless 2>/dev/null | sed -n "s/^wireless\.\([^.]*\)=wifi-iface$/\1/p"); do
        echo "Wi-Fi $iface: ssid $(uci -q get "wireless.$iface.ssid") network $(uci -q get "wireless.$iface.network") isolate $(uci -q get "wireless.$iface.isolate")"
    done
    for service in odhcpd $PROXY_SERVICES; do
        [ -x "/etc/init.d/$service" ] && echo "service $service: $("/etc/init.d/$service" enabled && echo enabled || echo disabled)"
    done
    ls -1 "$BACKUP_DIR" 2>/dev/null | sed 's/^/backup: /'
}

restore() {
    local latest=""
    local service=""
    latest="$(ls -1 "$BACKUP_DIR"/config-*.tar.gz 2>/dev/null | tail -n 1)"
    [ -n "$latest" ] || { log "No backup in $BACKUP_DIR"; return 1; }
    tar -xzf "$latest" -C /etc/config
    for service in odhcpd; do
        [ -x "/etc/init.d/$service" ] && "/etc/init.d/$service" enable && "/etc/init.d/$service" start
    done
    log "Restored $latest (proxy services stay disabled: enable them in LuCI if needed); network restarts in 3s"
    (sleep 3; /etc/init.d/network restart; wifi reload) >/dev/null 2>&1 &
}

case "$1" in
    apply) apply "$2" "$3" ;;
    status) status ;;
    restore) restore ;;
    *) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//' ;;
esac
