#!/bin/sh
# Turns an OpenWrt router into a Wi-Fi access point: LAN ports, the WAN port and
# Wi-Fi share one bridge with the upstream router, which serves DHCP. Every
# command is idempotent and prints each setting it checks (= kept, * changed).
# Run on the router:
#   sh ap_mode.sh apply [mgmt_ip/24] [gateway]
#     no gateway (default): management at 192.168.50.1/24; the AP also takes a
#       DHCP address from the upstream router and NATs 192.168.50.0/24 to it, so
#       hosts on 192.168.50.x open the upstream router (e.g. 192.168.1.1)
#     with a gateway (natgateway host): static management address via it
#   sh ap_mode.sh wifi [ssid_5g] [ssid_24] [password]   5G and 2.4G Wi-Fi on every radio
#   sh ap_mode.sh check                    compare every setting with AP mode, change nothing
#   sh ap_mode.sh repair                   re-apply AP mode on the current addresses
#   sh ap_mode.sh status
#   sh ap_mode.sh restore                  undo with the newest backup

BACKUP_DIR="/root/ap-mode-backups"
CONFIGS="network dhcp wireless firewall"
PROXY_SERVICES="openclash passwall passwall2 shadowsocksr homeproxy v2raya mihomo nikki"
AP_ADDRESS="192.168.50.1/24"
BRIDGE_DEVICE="br-lan"
UPLINK_INTERFACE="uplink"
MGMT_NAT_NAME="ap_mgmt_masq"
BALANCER_SERVICE="router-balance"
BALANCER_SCRIPT="/usr/sbin/router-mode.sh"
SETTINGS_DIR="/etc/openwrt-router"
WIFI_SETTINGS_FILE="$SETTINGS_DIR/wifi.conf"
WIFI_DEFAULT_SSID_5G="LN"
WIFI_DEFAULT_SSID_24="Samsung24"
WIFI_DEFAULT_KEY_OCTAL="170151141157155151061062063"
WIFI_ENCRYPTION="psk2"
WIFI_COUNTRY=""
WIFI_PACKAGE="wpad-basic-mbedtls"
WIFI_CHECK_DELAY=90
WIFI_CHECK_LOG="/tmp/openwrt-router-wifi-check.log"
SELF_PATH="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
NETWORK_RESTART_DELAY=3
LOG_PREFIX="[AP-MODE]"
CHANGED=0
DRY_RUN=0
DIFFS=0
ZONE_SECTION=""
WIFI_SSID_5G=""
WIFI_SSID_24=""
WIFI_KEY=""

log() {
    echo "$LOG_PREFIX $*"
}

step() {
    echo
    echo "$LOG_PREFIX == $* =="
}

report_diff() {
    echo "  ! $* (differs)"
    DIFFS=$((DIFFS + 1))
    CHANGED=1
}

set_option() {
    local current=""

    current="$(uci -q get "$1")"
    if [ "$current" = "$2" ]; then
        echo "  = $1='$2'"
        return 0
    fi
    [ "$DRY_RUN" = "1" ] && { report_diff "$1: '${current:-<unset>}', expected '$2'"; return 0; }
    uci set "$1=$2"
    echo "  * $1: '${current:-<unset>}' -> '$2'"
    CHANGED=1
}

delete_option() {
    if ! uci -q get "$1" >/dev/null; then
        echo "  = $1 unset"
        return 0
    fi
    [ "$DRY_RUN" = "1" ] && { report_diff "$1='$(uci -q get "$1")', expected unset"; return 0; }
    uci -q delete "$1"
    echo "  * $1 removed"
    CHANGED=1
}

add_list_once() {
    if uci -q show "$1" | grep -q "'$2'"; then
        echo "  = $1 has '$2'"
        return 0
    fi
    [ "$DRY_RUN" = "1" ] && { report_diff "$1 lacks '$2'"; return 0; }
    uci add_list "$1=$2"
    echo "  * $1 += '$2'"
    CHANGED=1
}

del_list_once() {
    if ! uci -q show "$1" | grep -q "'$2'"; then
        echo "  = $1 lacks '$2'"
        return 0
    fi
    [ "$DRY_RUN" = "1" ] && { report_diff "$1 has '$2', expected without"; return 0; }
    uci del_list "$1=$2"
    echo "  * $1 -= '$2'"
    CHANGED=1
}

ensure_section() {
    if uci -q get "$1" >/dev/null; then
        echo "  = $1 exists"
        return 0
    fi
    [ "$DRY_RUN" = "1" ] && { report_diff "$1 missing ($2)"; return 0; }
    uci set "$1=$2"
    echo "  * $1 created ($2)"
    CHANGED=1
}

delete_section() {
    if ! uci -q get "$1" >/dev/null; then
        echo "  = $1 absent"
        return 0
    fi
    [ "$DRY_RUN" = "1" ] && { report_diff "$1 present, expected removed"; return 0; }
    uci delete "$1"
    echo "  * $1 removed"
    CHANGED=1
}

config_checksum() {
    (cd /etc/config && cat $CONFIGS 2>/dev/null) | md5sum | cut -d ' ' -f 1
}

latest_backup() {
    ls -1 "$BACKUP_DIR"/config-*.tar.gz 2>/dev/null | tail -n 1
}

backup() {
    local stamp=""
    local checksum=""
    local latest=""

    [ "$DRY_RUN" = "1" ] && return 0
    checksum="$(config_checksum)"
    latest="$(latest_backup)"
    if [ -n "$latest" ] && [ "$(cat "${latest%.tar.gz}.md5" 2>/dev/null)" = "$checksum" ]; then
        log "Backup: current config already saved in $latest"
        return 0
    fi
    stamp="$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    (cd /etc/config && tar -czf "$BACKUP_DIR/config-$stamp.tar.gz" $CONFIGS 2>/dev/null)
    echo "$checksum" > "$BACKUP_DIR/config-$stamp.md5"
    log "Backup: $BACKUP_DIR/config-$stamp.tar.gz"
}

# Extracts the newest backup unless the config already matches it.
restore_backup() {
    local latest=""

    latest="$(latest_backup)"
    [ -n "$latest" ] || { log "No backup in $BACKUP_DIR"; return 1; }
    if [ "$(cat "${latest%.tar.gz}.md5" 2>/dev/null)" = "$(config_checksum)" ]; then
        log "Config already matches $latest; nothing to restore"
        return 1
    fi
    tar -xzf "$latest" -C /etc/config
    log "Restored $latest"
}

# The br-lan device section (DSA, OpenWrt 21.02+), empty on swconfig builds.
br_lan_section() {
    uci show network 2>/dev/null | sed -n "s/^network\.\([^.]*\)\.name='$BRIDGE_DEVICE'$/\1/p" | head -n 1
}

wan_device() {
    uci -q get network.wan.device || uci -q get network.wan.ifname
}

# OpenWrt 21.02+ may store the LAN address in CIDR form (192.168.1.1/24).
lan_address() {
    local address=""
    address="$(uci -q get network.lan.ipaddr)"
    echo "${address%%/*}"
}

firewall_zone() {
    uci show firewall 2>/dev/null | sed -n "s/^firewall\.\([^.]*\)\.name='$1'$/\1/p" | head -n 1
}

firewall_section_named() {
    local section=""

    for section in $(uci show firewall 2>/dev/null | sed -n "s/^firewall\.\([^.]*\)\.name='$2'$/\1/p"); do
        [ "$(uci -q get "firewall.$section")" = "$1" ] && { echo "$section"; return 0; }
    done
}

ensure_zone() {
    local network=""

    ZONE_SECTION="$(firewall_zone "$1")"
    if [ -z "$ZONE_SECTION" ] && [ "$DRY_RUN" = "1" ]; then
        report_diff "firewall zone $1 missing"
        return 0
    fi
    if [ -z "$ZONE_SECTION" ]; then
        ZONE_SECTION="$(uci add firewall zone)"
        echo "  * firewall zone $1 created"
        CHANGED=1
        set_option "firewall.$ZONE_SECTION.name" "$1"
        set_option "firewall.$ZONE_SECTION.input" "${2:-REJECT}"
        set_option "firewall.$ZONE_SECTION.output" "ACCEPT"
        set_option "firewall.$ZONE_SECTION.forward" "${3:-REJECT}"
    fi
    # Empty policies keep an existing zone as it is.
    [ -n "$2" ] && set_option "firewall.$ZONE_SECTION.input" "$2"
    [ -n "$3" ] && set_option "firewall.$ZONE_SECTION.forward" "$3"
    for network in $4; do
        add_list_once "firewall.$ZONE_SECTION.network" "$network"
    done
}

service_enable() {
    [ -x "/etc/init.d/$1" ] || { echo "  = service $1 not installed"; return 0; }
    if "/etc/init.d/$1" enabled; then
        echo "  = service $1 enabled"
    else
        [ "$DRY_RUN" = "1" ] && { report_diff "service $1 disabled, expected enabled"; return 0; }
        "/etc/init.d/$1" enable
        echo "  * service $1 enabled"
    fi
}

service_disable() {
    [ -x "/etc/init.d/$1" ] || { echo "  = service $1 not installed"; return 0; }
    if "/etc/init.d/$1" enabled; then
        [ "$DRY_RUN" = "1" ] && { report_diff "service $1 enabled, expected disabled"; return 0; }
        "/etc/init.d/$1" stop >/dev/null 2>&1
        "/etc/init.d/$1" disable >/dev/null 2>&1
        echo "  * service $1 stopped and disabled"
    else
        echo "  = service $1 disabled"
    fi
}

# Commits and restarts the network in the background (an SSH session on the old
# address drops), only when a setting changed.
apply_changes() {
    local services="$1"
    local service=""

    echo
    if [ "$DRY_RUN" = "1" ]; then
        if [ "$DIFFS" = "0" ]; then
            log "Check: every setting matches"
        else
            log "Check: $DIFFS setting(s) differ; 'repair' applies them"
        fi
        return 0
    fi
    if [ "$CHANGED" = "0" ]; then
        log "No setting changed; network not restarted"
        for service in $services; do
            [ -x "/etc/init.d/$service" ] && "/etc/init.d/$service" enabled && ! "/etc/init.d/$service" running >/dev/null 2>&1 && "/etc/init.d/$service" start && log "Started $service"
        done
        return 0
    fi
    uci commit
    log "Settings committed; network restarts in ${NETWORK_RESTART_DELAY}s (SSH on the old address drops)"
    schedule_wifi_check
    (sleep "$NETWORK_RESTART_DELAY"; /etc/init.d/network restart; wifi reload; for service in $services; do [ -x "/etc/init.d/$service" ] && "/etc/init.d/$service" enabled && "/etc/init.d/$service" restart; done) >/dev/null 2>&1 &
}

decode_octal() {
    printf "$(echo "$1" | sed 's/[0-7][0-7][0-7]/\\&/g')"
}

pkg_install() {
    if command -v apk >/dev/null 2>&1; then
        apk update && apk add "$@"
    else
        opkg update && opkg install "$@"
    fi
}

wifi_load_settings() {
    WIFI_SSID_5G="$WIFI_DEFAULT_SSID_5G"
    WIFI_SSID_24="$WIFI_DEFAULT_SSID_24"
    WIFI_KEY="$(decode_octal "$WIFI_DEFAULT_KEY_OCTAL")"
    [ -f "$WIFI_SETTINGS_FILE" ] && . "$WIFI_SETTINGS_FILE"
}

# SSIDs stay plain English: letters, digits and - _ . (1-32 characters).
wifi_valid_ssid() {
    case "$1" in
        ""|*[!A-Za-z0-9_.-]*) return 1 ;;
    esac
    [ "${#1}" -le 32 ]
}

wifi_save_settings() {
    wifi_valid_ssid "$1" && wifi_valid_ssid "$2" || { log "Wi-Fi names allow only English letters, digits and - _ . (1-32 characters)"; return 1; }
    case "$3" in
        *"'"*) log "Wi-Fi password must not contain a single quote"; return 1 ;;
    esac
    if [ "${#3}" -lt 8 ] || [ "${#3}" -gt 63 ]; then
        log "Wi-Fi password needs 8-63 characters"
        return 1
    fi
    mkdir -p "$SETTINGS_DIR"
    printf "WIFI_SSID_5G='%s'\nWIFI_SSID_24='%s'\nWIFI_KEY='%s'\n" "$1" "$2" "$3" > "$WIFI_SETTINGS_FILE"
    WIFI_SSID_5G="$1"
    WIFI_SSID_24="$2"
    WIFI_KEY="$3"
    log "Wi-Fi settings saved in $WIFI_SETTINGS_FILE"
}

wifi_radios() {
    uci show wireless 2>/dev/null | sed -n "s/^wireless\.\([^.]*\)=wifi-device$/\1/p"
}

# 2g, 5g or 6g from the band option, else from the legacy hwmode.
radio_band() {
    local band=""

    band="$(uci -q get "wireless.$1.band")"
    [ -n "$band" ] && { echo "$band"; return 0; }
    case "$(uci -q get "wireless.$1.hwmode")" in
        11a|11ac|11ax) echo "5g" ;;
        *) echo "2g" ;;
    esac
}

ensure_wpad() {
    if [ -x /usr/sbin/hostapd ] || [ -x /usr/sbin/wpad ]; then
        echo "  = hostapd/wpad installed"
        return 0
    fi
    [ "$DRY_RUN" = "1" ] && { report_diff "no hostapd/wpad, expected $WIFI_PACKAGE"; return 0; }
    echo "  * installing $WIFI_PACKAGE (Wi-Fi encryption needs hostapd/wpad)"
    pkg_install "$WIFI_PACKAGE" || echo "  ! $WIFI_PACKAGE install failed: encrypted Wi-Fi will not start"
}

# Enables every radio: 2.4G gets WIFI_SSID_24, 5G/6G get WIFI_SSID_5G, all
# share WIFI_KEY (6G needs WPA3/SAE). Creates missing radio sections and
# access-point interfaces.
setup_wifi() {
    local radios=""
    local radio=""
    local iface=""
    local band=""
    local ssid=""
    local encryption=""

    step "Wi-Fi"
    radios="$(wifi_radios)"
    if [ -z "$radios" ] && [ "$DRY_RUN" != "1" ] && command -v wifi >/dev/null 2>&1; then
        echo "  No radio in /etc/config/wireless; detecting hardware"
        wifi config >/dev/null 2>&1
        radios="$(wifi_radios)"
    fi
    if [ -z "$radios" ]; then
        echo "  = no Wi-Fi hardware or driver found; Wi-Fi skipped"
        return 0
    fi
    ensure_wpad
    for radio in $radios; do
        band="$(radio_band "$radio")"
        case "$band" in
            2g) ssid="$WIFI_SSID_24"; encryption="$WIFI_ENCRYPTION" ;;
            6g) ssid="$WIFI_SSID_5G"; encryption="sae" ;;
            *) ssid="$WIFI_SSID_5G"; encryption="$WIFI_ENCRYPTION" ;;
        esac
        echo "  Radio $radio: band $band, channel $(uci -q get "wireless.$radio.channel"), SSID $ssid"
        set_option "wireless.$radio.disabled" "0"
        [ -n "$WIFI_COUNTRY" ] && set_option "wireless.$radio.country" "$WIFI_COUNTRY"
        iface="$(uci show wireless | sed -n "s/^wireless\.\([^.]*\)\.device='$radio'$/\1/p" | head -n 1)"
        if [ -z "$iface" ]; then
            iface="default_$radio"
            ensure_section "wireless.$iface" wifi-iface
            set_option "wireless.$iface.device" "$radio"
        fi
        set_option "wireless.$iface.mode" "ap"
        set_option "wireless.$iface.network" "lan"
        set_option "wireless.$iface.ssid" "$ssid"
        set_option "wireless.$iface.encryption" "$encryption"
        set_option "wireless.$iface.key" "$WIFI_KEY"
        set_option "wireless.$iface.isolate" "0"
        set_option "wireless.$iface.disabled" "0"
    done
    echo "  Wi-Fi: 5G '$WIFI_SSID_5G', 2.4G '$WIFI_SSID_24', password '$WIFI_KEY'"
}

# Reports each enabled radio; with "fix", a radio still down moves to channel
# auto (a fixed or DFS channel the regulatory domain refuses) and Wi-Fi reloads.
wifi_check() {
    local fix="$1"
    local status=""
    local radio=""
    local up=""
    local channel=""
    local fixed=0

    step "Wi-Fi check"
    command -v ubus >/dev/null 2>&1 || { echo "  = no ubus; check skipped"; return 0; }
    status="$(ubus call network.wireless status 2>/dev/null)"
    for radio in $(wifi_radios); do
        [ "$(uci -q get "wireless.$radio.disabled")" = "1" ] && { echo "  = $radio disabled"; continue; }
        up="$(echo "$status" | jsonfilter -e "@.$radio.up" 2>/dev/null)"
        channel="$(uci -q get "wireless.$radio.channel")"
        if [ "$up" = "true" ]; then
            echo "  = $radio up ($(radio_band "$radio"), channel $channel)"
        elif [ "$fix" = "fix" ] && [ "$channel" != "auto" ]; then
            uci set "wireless.$radio.channel=auto"
            echo "  * $radio down on channel $channel; channel -> auto"
            fixed=1
        else
            echo "  ! $radio down (channel $channel): DFS radar wait can take 60s; logread | grep -i $radio"
        fi
    done
    if [ "$fixed" = "1" ]; then
        uci commit wireless
        wifi reload
        echo "  * Wi-Fi reloaded"
    fi
}

# A background check after Wi-Fi restarts, once DFS channels finished their
# radar wait.
schedule_wifi_check() {
    (sleep "$WIFI_CHECK_DELAY"; sh "$SELF_PATH" wifi-check fix > "$WIFI_CHECK_LOG" 2>&1) >/dev/null 2>&1 &
    log "Wi-Fi self-check in ${WIFI_CHECK_DELAY}s: $WIFI_CHECK_LOG"
}

wifi_command() {
    wifi_load_settings
    if [ -n "$1" ] || [ -n "$2" ] || [ -n "$3" ]; then
        wifi_save_settings "${1:-$WIFI_SSID_5G}" "${2:-$WIFI_SSID_24}" "${3:-$WIFI_KEY}" || return 1
    fi
    CHANGED=0
    setup_wifi
    if [ "$CHANGED" = "1" ]; then
        uci commit wireless
        wifi reload
        log "Wi-Fi reloaded"
        schedule_wifi_check
    else
        log "Wi-Fi unchanged"
        wifi_check
    fi
}

apply() {
    local address="${1:-$AP_ADDRESS}"
    local gateway="$2"
    local ip="${address%/*}"
    local wan=""
    local section=""
    local current=""
    local iface=""
    local service=""
    local nat=""

    CHANGED=0
    if [ -n "$gateway" ]; then
        log "AP mode: management $ip/24 via static gateway $gateway"
    else
        log "AP mode: management $ip/24, DHCP uplink from the upstream router, NAT for ${ip%.*}.0/24"
    fi
    backup
    wan="$(wan_device)"
    section="$(br_lan_section)"

    step "Bridge (LAN ports + WAN port + Wi-Fi)"
    if [ -z "$wan" ]; then
        echo "  = no WAN device in network.wan; only LAN ports are bridged"
    elif [ -n "$section" ]; then
        add_list_once "network.$section.ports" "$wan"
    else
        current="$(uci -q get network.lan.ifname)"
        case " $current " in
            *" $wan "*) echo "  = network.lan.ifname has $wan" ;;
            *) set_option network.lan.ifname "${current:+$current }$wan" ;;
        esac
    fi
    for iface in wan wan6; do
        if uci -q get "network.$iface" >/dev/null; then
            set_option "network.$iface.proto" "none"
            set_option "network.$iface.auto" "0"
        else
            echo "  = network.$iface absent"
        fi
    done

    step "Management address"
    set_option network.lan.proto "static"
    set_option network.lan.ipaddr "$ip"
    set_option network.lan.netmask "255.255.255.0"
    delete_option network.lan.ip6assign
    ensure_zone lan ACCEPT ACCEPT lan
    nat="$(firewall_section_named nat "$MGMT_NAT_NAME")"
    if [ -n "$gateway" ]; then
        set_option network.lan.gateway "$gateway"
        if [ "$(uci -q get network.lan.dns)" = "$gateway" ]; then
            echo "  = network.lan.dns='$gateway'"
        else
            uci -q delete network.lan.dns
            uci add_list network.lan.dns="$gateway"
            echo "  * network.lan.dns -> '$gateway'"
            CHANGED=1
        fi
        delete_section "network.$UPLINK_INTERFACE"
        del_list_once "firewall.$ZONE_SECTION.network" "$UPLINK_INTERFACE"
        [ -n "$nat" ] && delete_section "firewall.$nat"
    else
        delete_option network.lan.gateway
        delete_option network.lan.dns
        step "Uplink (DHCP from the upstream router) and NAT"
        ensure_section "network.$UPLINK_INTERFACE" interface
        set_option "network.$UPLINK_INTERFACE.proto" "dhcp"
        set_option "network.$UPLINK_INTERFACE.device" "$BRIDGE_DEVICE"
        add_list_once "firewall.$ZONE_SECTION.network" "$UPLINK_INTERFACE"
        if [ -z "$nat" ] && [ "$DRY_RUN" = "1" ]; then
            report_diff "firewall nat $MGMT_NAT_NAME missing"
        else
            if [ -z "$nat" ]; then
                nat="$(uci add firewall nat)"
                echo "  * firewall nat $MGMT_NAT_NAME created"
                CHANGED=1
            fi
            set_option "firewall.$nat.name" "$MGMT_NAT_NAME"
            set_option "firewall.$nat.family" "ipv4"
            set_option "firewall.$nat.proto" "all"
            set_option "firewall.$nat.src" "lan"
            set_option "firewall.$nat.src_ip" "${ip%.*}.0/24"
            set_option "firewall.$nat.target" "MASQUERADE"
        fi
    fi

    step "DHCP (the upstream router serves it)"
    ensure_section dhcp.lan dhcp
    set_option dhcp.lan.ignore "1"
    set_option dhcp.lan.dhcpv6 "disabled"
    set_option dhcp.lan.ra "disabled"
    delete_option dhcp.lan.ra_management

    wifi_load_settings
    setup_wifi

    step "Services"
    for service in odhcpd $BALANCER_SERVICE $PROXY_SERVICES; do
        service_disable "$service"
    done
    [ "$DRY_RUN" != "1" ] && [ -x "$BALANCER_SCRIPT" ] && sh "$BALANCER_SCRIPT" shaper-stop
    service_enable firewall
    service_enable dnsmasq

    apply_changes "firewall dnsmasq"
    echo
    log "Management: http://$ip and ssh root@$ip from a host on ${ip%.*}.x"
    if [ -z "$gateway" ]; then
        log "The AP's upstream address (DHCP) also opens LuCI/SSH: see 'sh ap_mode.sh status' after the restart"
        log "Hosts on ${ip%.*}.x reach the upstream router (e.g. http://192.168.1.1) through the AP"
    fi
}

status() {
    local iface=""
    local radio=""

    step "Network"
    echo "  LAN: $(uci -q get network.lan.proto) $(uci -q get network.lan.ipaddr)/$(uci -q get network.lan.netmask) gw $(uci -q get network.lan.gateway) dns $(uci -q get network.lan.dns)"
    echo "  Bridge ports: $(uci -q get "network.$(br_lan_section).ports" || uci -q get network.lan.ifname)"
    echo "  WAN: proto $(uci -q get network.wan.proto) device $(wan_device)"
    if uci -q get "network.$UPLINK_INTERFACE" >/dev/null; then
        echo "  Uplink: $(ifstatus "$UPLINK_INTERFACE" 2>/dev/null | jsonfilter -e '@["ipv4-address"][0].address' 2>/dev/null || echo 'no address yet')"
    fi
    ip -4 addr show 2>/dev/null | sed -n 's/^ *inet \([^ ]*\).* \([^ ]*\)$/  Address: \1 on \2/p'
    ip -4 route show default 2>/dev/null | sed 's/^/  Route: /'
    echo "  DHCP on LAN: $([ "$(uci -q get dhcp.lan.ignore)" = "1" ] && echo off || echo on)"
    echo "  Management NAT: $([ -n "$(firewall_section_named nat "$MGMT_NAT_NAME")" ] && echo on || echo off)"
    step "Wi-Fi"
    for radio in $(wifi_radios); do
        echo "  Radio $radio: disabled=$(uci -q get "wireless.$radio.disabled" || echo 0) band=$(uci -q get "wireless.$radio.band" || uci -q get "wireless.$radio.hwmode") channel=$(uci -q get "wireless.$radio.channel")"
    done
    for iface in $(uci show wireless 2>/dev/null | sed -n "s/^wireless\.\([^.]*\)=wifi-iface$/\1/p"); do
        echo "  $iface: ssid '$(uci -q get "wireless.$iface.ssid")' key '$(uci -q get "wireless.$iface.key")' $(uci -q get "wireless.$iface.encryption") network $(uci -q get "wireless.$iface.network") disabled=$(uci -q get "wireless.$iface.disabled" || echo 0)"
    done
    command -v iwinfo >/dev/null 2>&1 && iwinfo 2>/dev/null | grep -E 'ESSID|Mode:' | sed 's/^/  /'
    [ -f "$WIFI_CHECK_LOG" ] && sed 's/^/  /' "$WIFI_CHECK_LOG"
    step "Services"
    for iface in odhcpd dnsmasq firewall uhttpd dropbear $BALANCER_SERVICE $PROXY_SERVICES; do
        [ -x "/etc/init.d/$iface" ] && echo "  $iface: $("/etc/init.d/$iface" enabled && echo enabled || echo disabled), $("/etc/init.d/$iface" running >/dev/null 2>&1 && echo running || echo stopped)"
    done
    step "Backups"
    ls -1 "$BACKUP_DIR" 2>/dev/null | grep 'tar.gz$' | sed 's/^/  /'
}

restore() {
    restore_backup || return 0
    service_enable odhcpd
    CHANGED=1
    apply_changes "odhcpd firewall dnsmasq"
    log "Proxy services stay disabled: enable them in LuCI if needed"
}

case "$1" in
    apply) apply "$2" "$3" ;;
    wifi) wifi_command "$2" "$3" "$4" ;;
    wifi-check) wifi_check "$2" ;;
    check) DRY_RUN=1; log "Check only: every setting is compared, nothing changes"; apply "$(lan_address)/24" "$(uci -q get network.lan.gateway)" ;;
    repair) apply "$(lan_address)/24" "$(uci -q get network.lan.gateway)" ;;
    status) status ;;
    restore) restore ;;
    *) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//' ;;
esac
