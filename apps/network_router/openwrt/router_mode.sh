#!/bin/sh
# Turns an OpenWrt router (also one left in AP mode by ap_mode.sh) into a routing
# gateway: WAN with NAT, LAN with its own /24, DHCP and DNS, Wi-Fi on every
# radio, plus a per-device bandwidth balancer (service router-balance). Every
# command is idempotent and prints each setting it checks (= kept, * changed).
# Hosts on the LAN reach the upstream router (e.g. 192.168.1.1) through NAT.
# Run on the router:
#   sh router_mode.sh apply [lan_ip/24]     default 192.168.50.1/24
#   sh router_mode.sh wifi [ssid_5g] [ssid_24] [password]
#   sh router_mode.sh check                 compare every setting with router mode, change nothing
#   sh router_mode.sh repair                re-apply router mode on the current LAN address
#   sh router_mode.sh status
#   sh router_mode.sh restore               undo with the newest backup
# The balancer measures the WAN rate (100 Mbit until measured), raises the limit
# when the link saturates without delay, clamps it to the live rate when a busy
# link shows latency congestion, guarantees each active device 10% (or an equal
# share) and each idle device 100 kbit (20 kbit on very slow links); unused
# bandwidth is shared equally. Tune it in /etc/router-mode/config.

BACKUP_DIR="/root/router-mode-backups"
CONFIGS="network dhcp wireless firewall"
LAN_ADDRESS="192.168.50.1/24"
BRIDGE_DEVICE="br-lan"
UPLINK_INTERFACE="uplink"
MGMT_NAT_NAME="ap_mgmt_masq"
REQUIRED_PACKAGES="kmod-sched-core kmod-ifb"
TC_PACKAGE="tc-tiny"
INSTALL_PATH="/usr/sbin/router-mode.sh"
SERVICE_NAME="router-balance"
SERVICE_PATH="/etc/init.d/$SERVICE_NAME"
CONFIG_DIR="/etc/router-mode"
CONFIG_FILE="$CONFIG_DIR/config"
CAPACITY_FILE="$CONFIG_DIR/capacity"
STATE_DIR="/tmp/router-mode"
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
LOG_PREFIX="[ROUTER-MODE]"
IFB_DEVICE="ifb-rmode"
PING_TARGET="223.5.5.5"
DEFAULT_CAPACITY_KBIT=100000
MIN_CAPACITY_KBIT=1000
MAX_CAPACITY_KBIT=10000000
LOCAL_RATE_KBIT=1000000
SHAPE_PERCENT=95
ACTIVE_SHARE_PERCENT=10
ACTIVE_POOL_PERCENT=90
ACTIVE_THRESHOLD_KBIT=64
IDLE_FLOOR_KBIT=100
SLOW_IDLE_FLOOR_KBIT=20
SLOW_CAPACITY_KBIT=2000
PROBE_TRIGGER_PERCENT=90
PROBE_PERCENT=110
PROBE_HOLD_SECONDS=60
CLAMP_MIN_UTIL_PERCENT=50
CONGESTION_DELTA_MS=80
CONGESTION_SAMPLES=2
BASE_RTT_IDLE_PERCENT=20
SAMPLE_SECONDS=5
SAVE_MIN_SECONDS=600
QUANTUM=1514
CHANGED=0
DRY_RUN=0
DIFFS=0
ZONE_SECTION=""
WIFI_SSID_5G=""
WIFI_SSID_24=""
WIFI_KEY=""
CAP_DOWN=0
CAP_UP=0
BASE_RTT=""
KNOWN=""

[ -f "$CONFIG_FILE" ] && . "$CONFIG_FILE"

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

ensure_lan_forwarding() {
    local section=""

    for section in $(uci show firewall 2>/dev/null | sed -n "s/^firewall\.\([^.]*\)=forwarding$/\1/p"); do
        if [ "$(uci -q get "firewall.$section.src")" = "lan" ] && [ "$(uci -q get "firewall.$section.dest")" = "wan" ]; then
            echo "  = firewall forwarding lan -> wan exists"
            return 0
        fi
    done
    [ "$DRY_RUN" = "1" ] && { report_diff "firewall forwarding lan -> wan missing"; return 0; }
    section="$(uci add firewall forwarding)"
    uci set "firewall.$section.src=lan"
    uci set "firewall.$section.dest=wan"
    echo "  * firewall forwarding lan -> wan created"
    CHANGED=1
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

lan_device() {
    local device=""
    device="$(ifstatus lan 2>/dev/null | jsonfilter -e '@.l3_device' 2>/dev/null)"
    echo "${device:-$BRIDGE_DEVICE}"
}

# OpenWrt 21.02+ may store the LAN address in CIDR form (192.168.1.1/24).
lan_address() {
    local address=""
    address="$(uci -q get network.lan.ipaddr)"
    echo "${address%%/*}"
}

wan_l3_device() {
    ifstatus wan 2>/dev/null | jsonfilter -e '@.l3_device' 2>/dev/null
}

wan_address() {
    ifstatus wan 2>/dev/null | jsonfilter -e '@["ipv4-address"][0].address' 2>/dev/null
}

package_installed() {
    if command -v apk >/dev/null 2>&1; then
        apk info -e "$1" >/dev/null 2>&1
    else
        opkg list-installed "$1" 2>/dev/null | grep -q .
    fi
}

install_packages() {
    local missing=""
    local package=""

    step "Balancer packages"
    if command -v tc >/dev/null 2>&1; then
        echo "  = tc installed"
    else
        missing="$TC_PACKAGE"
    fi
    for package in $REQUIRED_PACKAGES; do
        if package_installed "$package"; then
            echo "  = $package installed"
        else
            missing="$missing $package"
        fi
    done
    [ -n "$missing" ] || return 0
    [ "$DRY_RUN" = "1" ] && { report_diff "packages missing:$missing"; return 0; }
    log "Installing:$missing"
    pkg_install $missing || log "Package install failed:$missing; the balancer needs them"
}

write_if_changed() {
    local target="$1"
    local source="$2"

    if cmp -s "$source" "$target"; then
        echo "  = $target up to date"
        rm -f "$source"
        return 0
    fi
    [ "$DRY_RUN" = "1" ] && { report_diff "$target outdated"; rm -f "$source"; return 0; }
    mv "$source" "$target" || { echo "  ! cannot write $target"; return 1; }
    chmod +x "$target"
    echo "  * $target written"
}

install_balancer() {
    local staged="/tmp/router-mode.staged"

    step "Balancer service"
    cp "$0" "$staged"
    write_if_changed "$INSTALL_PATH" "$staged"
    mkdir -p "$CONFIG_DIR"
    if [ -f "$CONFIG_FILE" ]; then
        echo "  = $CONFIG_FILE kept"
    elif [ "$DRY_RUN" = "1" ]; then
        report_diff "$CONFIG_FILE missing"
    else
        cat > "$CONFIG_FILE" <<EOF
PING_TARGET="$PING_TARGET"
DEFAULT_CAPACITY_KBIT=$DEFAULT_CAPACITY_KBIT
ACTIVE_SHARE_PERCENT=$ACTIVE_SHARE_PERCENT
IDLE_FLOOR_KBIT=$IDLE_FLOOR_KBIT
SLOW_IDLE_FLOOR_KBIT=$SLOW_IDLE_FLOOR_KBIT
SLOW_CAPACITY_KBIT=$SLOW_CAPACITY_KBIT
CONGESTION_DELTA_MS=$CONGESTION_DELTA_MS
EOF
        echo "  * $CONFIG_FILE written"
    fi
    cat > "$staged" <<EOF
#!/bin/sh /etc/rc.common
START=99
USE_PROCD=1

start_service() {
    procd_open_instance
    procd_set_param command /bin/sh $INSTALL_PATH daemon
    procd_set_param respawn
    procd_set_param stdout 1
    procd_set_param stderr 1
    procd_close_instance
}

stop_service() {
    /bin/sh $INSTALL_PATH shaper-stop
}
EOF
    write_if_changed "$SERVICE_PATH" "$staged"
    service_enable "$SERVICE_NAME"
}

apply() {
    local address="${1:-$LAN_ADDRESS}"
    local ip="${address%/*}"
    local wan=""
    local wan_ip=""
    local section=""
    local current=""
    local nat=""

    CHANGED=0
    log "Router mode: LAN $ip/24 with DHCP, WAN by DHCP with NAT, Wi-Fi on, balancer on"
    backup
    install_packages
    wan="$(wan_device)"
    section="$(br_lan_section)"

    step "WAN port"
    if [ -z "$wan" ]; then
        echo "  ! no WAN device in network.wan; set the WAN port in LuCI"
    elif [ -n "$section" ]; then
        del_list_once "network.$section.ports" "$wan"
    else
        current="$(uci -q get network.lan.ifname)"
        case " $current " in
            *" $wan "*) set_option network.lan.ifname "$(echo "$current" | tr ' ' '\n' | grep -vx "$wan" | tr '\n' ' ' | sed 's/ *$//')" ;;
            *) echo "  = network.lan.ifname lacks $wan" ;;
        esac
    fi
    if uci -q get network.wan >/dev/null; then
        case "$(uci -q get network.wan.proto)" in
            ""|none) set_option network.wan.proto "dhcp" ;;
            *) echo "  = network.wan.proto='$(uci -q get network.wan.proto)'" ;;
        esac
        delete_option network.wan.auto
    fi
    if uci -q get network.wan6 >/dev/null; then
        case "$(uci -q get network.wan6.proto)" in
            ""|none) set_option network.wan6.proto "dhcpv6" ;;
            *) echo "  = network.wan6.proto='$(uci -q get network.wan6.proto)'" ;;
        esac
        delete_option network.wan6.auto
    fi

    step "LAN"
    set_option network.lan.proto "static"
    set_option network.lan.ipaddr "$ip"
    set_option network.lan.netmask "255.255.255.0"
    delete_option network.lan.gateway
    delete_option network.lan.dns
    set_option network.lan.ip6assign "60"
    delete_section "network.$UPLINK_INTERFACE"
    wan_ip="$(wan_address)"
    if [ -n "$wan_ip" ] && [ "${wan_ip%.*}" = "${ip%.*}" ]; then
        echo "  ! WAN address $wan_ip is in ${ip%.*}.0/24 too: pick another LAN subnet"
    fi

    step "DHCP"
    ensure_section dhcp.lan dhcp
    set_option dhcp.lan.interface "lan"
    delete_option dhcp.lan.ignore
    set_option dhcp.lan.start "100"
    set_option dhcp.lan.limit "150"
    set_option dhcp.lan.leasetime "12h"
    set_option dhcp.lan.dhcpv6 "server"
    set_option dhcp.lan.ra "server"

    step "Firewall"
    ensure_zone lan ACCEPT ACCEPT lan
    del_list_once "firewall.$ZONE_SECTION.network" "$UPLINK_INTERFACE"
    nat="$(firewall_section_named nat "$MGMT_NAT_NAME")"
    if [ -n "$nat" ]; then
        delete_section "firewall.$nat"
    else
        echo "  = firewall nat $MGMT_NAT_NAME absent"
    fi
    ensure_zone wan "" "" "wan wan6"
    set_option "firewall.$ZONE_SECTION.masq" "1"
    set_option "firewall.$ZONE_SECTION.mtu_fix" "1"
    ensure_lan_forwarding
    # Offloaded flows bypass the qdiscs the balancer shapes with.
    delete_option "firewall.@defaults[0].flow_offloading"
    delete_option "firewall.@defaults[0].flow_offloading_hw"

    wifi_load_settings
    setup_wifi

    step "Services"
    for current in dnsmasq odhcpd firewall; do
        service_enable "$current"
    done
    install_balancer

    apply_changes "firewall dnsmasq odhcpd $SERVICE_NAME"
    echo
    log "Management: http://$ip and ssh root@$ip from the LAN or Wi-Fi"
    log "LAN hosts reach the upstream router (e.g. http://192.168.1.1) through NAT"
}

uptime_seconds() {
    cut -d. -f1 /proc/uptime
}

idle_floor() {
    if [ "$1" -lt "$SLOW_CAPACITY_KBIT" ]; then
        echo "$SLOW_IDLE_FLOOR_KBIT"
    else
        echo "$IDLE_FLOOR_KBIT"
    fi
}

shape_rate() {
    echo $(($1 * SHAPE_PERCENT / 100))
}

ping_rtt() {
    ping -c 1 -W 1 "$PING_TARGET" 2>/dev/null | sed -n 's/.*time=\([0-9]*\).*/\1/p' | head -n 1
}

lan_hosts() {
    {
        ip -4 neigh show dev "$1" 2>/dev/null | awk '$NF != "FAILED" && $NF != "INCOMPLETE" {print $1}'
        awk '{print $3}' /tmp/dhcp.leases 2>/dev/null
    } | awk -v prefix="$2." -v self="$3" 'index($0, prefix) == 1 && $0 != self' | sort -u
}

shaper_class() {
    local dev="$1"
    local minor="$2"
    local rate="$3"
    local ceil="$4"

    tc class add dev "$dev" parent 1:1 classid "1:$minor" htb rate "${rate}kbit" ceil "${ceil}kbit" quantum "$QUANTUM"
    tc qdisc add dev "$dev" parent "1:$minor" fq_codel
}

shaper_tree() {
    local dev="$1"
    local local_field="$2"
    local lan_ip="$3"
    local capacity="$4"
    local shape=""

    shape="$(shape_rate "$capacity")"
    tc qdisc add dev "$dev" root handle 1: htb default ffff
    tc class add dev "$dev" parent 1: classid 1:1 htb rate "${shape}kbit" ceil "${shape}kbit" quantum "$QUANTUM"
    tc class add dev "$dev" parent 1: classid 1:2 htb rate "${LOCAL_RATE_KBIT}kbit" quantum "$QUANTUM"
    tc qdisc add dev "$dev" parent 1:2 fq_codel
    tc filter add dev "$dev" parent 1: protocol ip prio 1 u32 match ip "$local_field" "$lan_ip/32" flowid 1:2
    shaper_class "$dev" ffff "$(idle_floor "$capacity")" "$shape"
}

shaper_device() {
    local dev="$1"
    local field="$2"
    local host="$3"
    local minor="$4"
    local capacity="$5"

    shaper_class "$dev" "$minor" "$(idle_floor "$capacity")" "$(shape_rate "$capacity")"
    tc filter add dev "$dev" parent 1: protocol ip prio 10 u32 match ip "$field" "$host/32" flowid "1:$minor"
}

shaper_stop() {
    local lan=""

    lan="$(lan_device)"
    tc qdisc del dev "$lan" root 2>/dev/null
    tc qdisc del dev "$lan" ingress 2>/dev/null
    ip link del "$IFB_DEVICE" 2>/dev/null
    return 0
}

reset_known() {
    local minor=""

    for minor in $KNOWN root ffff; do
        unset "applied_down_$minor" "applied_up_$minor"
    done
    KNOWN=""
    rm -f "$STATE_DIR"/bytes.*
}

# Download shapes on the LAN egress, upload on an IFB fed by the LAN ingress, so
# both directions still see LAN addresses (before NAT).
shaper_setup() {
    local lan="$1"
    local lan_ip="$2"

    shaper_stop
    reset_known
    ip link add "$IFB_DEVICE" type ifb 2>/dev/null
    ip link set "$IFB_DEVICE" up
    tc qdisc add dev "$lan" handle ffff: ingress
    tc filter add dev "$lan" parent ffff: protocol all prio 1 u32 match u32 0 0 flowid 1:1 action mirred egress redirect dev "$IFB_DEVICE"
    shaper_tree "$lan" src "$lan_ip" "$CAP_DOWN"
    shaper_tree "$IFB_DEVICE" dst "$lan_ip" "$CAP_UP"
    log "Shaper ready on $lan/$IFB_DEVICE: down ${CAP_DOWN}kbit up ${CAP_UP}kbit"
}

class_rates() {
    local dev="$1"
    local name="$2"
    local elapsed="$3"
    local current="$STATE_DIR/bytes.$name.now"
    local previous="$STATE_DIR/bytes.$name"

    tc -s class show dev "$dev" | awk '/^class htb/ {split($3, id, ":")} /^ Sent/ {print id[2], $2}' > "$current"
    if [ -f "$previous" ]; then
        awk -v seconds="$elapsed" 'NR == FNR {before[$1] = $2; next} ($1 in before) {rate = ($2 - before[$1]) * 8 / 1000 / seconds; if (rate < 0) rate = 0; printf "%s %d\n", $1, rate}' "$previous" "$current" > "$STATE_DIR/rates.$name"
    fi
    mv "$current" "$previous"
}

# Active devices get ACTIVE_SHARE_PERCENT of the shaped rate (an equal part of
# ACTIVE_POOL_PERCENT when too many are active), idle ones the idle floor; every
# class may borrow up to the full shaped rate in equal quanta.
balance() {
    local dev="$1"
    local name="$2"
    local capacity="$3"
    local elapsed="$4"
    local shape=""
    local floor=""
    local threshold=$(($3 / 100))
    local active=0
    local share=0
    local pool=0
    local minor=""
    local target=0
    local applied=""
    local desired=""

    shape="$(shape_rate "$capacity")"
    floor="$(idle_floor "$capacity")"
    [ "$threshold" -ge "$ACTIVE_THRESHOLD_KBIT" ] || threshold="$ACTIVE_THRESHOLD_KBIT"
    class_rates "$dev" "$name" "$elapsed"
    [ -f "$STATE_DIR/rates.$name" ] || return 0

    eval "applied=\${applied_${name}_root:-}"
    if [ "$applied" != "$shape" ]; then
        tc class change dev "$dev" parent 1: classid 1:1 htb rate "${shape}kbit" ceil "${shape}kbit" quantum "$QUANTUM" && eval "applied_${name}_root=$shape"
    fi

    active="$(awk -v t="$threshold" '$1 ~ /^1[0-9a-f][0-9a-f]$/ && $2 >= t' "$STATE_DIR/rates.$name" | wc -l)"
    share=$((shape * ACTIVE_SHARE_PERCENT / 100))
    pool=$((shape * ACTIVE_POOL_PERCENT / 100))
    [ "$active" -gt 0 ] && [ $((share * active)) -gt "$pool" ] && share=$((pool / active))
    [ "$share" -ge "$floor" ] || share="$floor"

    {
        awk -v t="$threshold" -v s="$share" -v f="$floor" '$1 ~ /^1[0-9a-f][0-9a-f]$/ {print $1, ($2 >= t ? s : f)}' "$STATE_DIR/rates.$name"
        echo "ffff $floor"
    } > "$STATE_DIR/targets.$name"
    while read -r minor target; do
        desired="$target:$shape"
        eval "applied=\${applied_${name}_${minor}:-}"
        [ "$applied" = "$desired" ] && continue
        tc class change dev "$dev" parent 1:1 classid "1:$minor" htb rate "${target}kbit" ceil "${shape}kbit" quantum "$QUANTUM" && eval "applied_${name}_${minor}=$desired"
    done < "$STATE_DIR/targets.$name"
    echo "$name: active $active, guaranteed ${share}kbit each, idle floor ${floor}kbit, shaped ${shape}kbit" > "$STATE_DIR/status.$name"
}

# Saturation without congestion raises the limit; congestion on a busy link
# clamps it to the live rate; a rate above the limit becomes the new limit.
adjust_capacity() {
    local capacity="$1"
    local rate="$2"
    local clamp="$3"
    local probe="$4"
    local shape=""

    shape="$(shape_rate "$capacity")"
    if [ "$clamp" = "1" ]; then
        capacity="$rate"
    elif [ "$rate" -gt "$capacity" ]; then
        capacity="$rate"
    elif [ "$probe" = "1" ] && [ $((rate * 100)) -ge $((shape * PROBE_TRIGGER_PERCENT)) ]; then
        capacity=$((capacity * PROBE_PERCENT / 100))
    fi
    [ "$capacity" -ge "$MIN_CAPACITY_KBIT" ] || capacity="$MIN_CAPACITY_KBIT"
    [ "$capacity" -le "$MAX_CAPACITY_KBIT" ] || capacity="$MAX_CAPACITY_KBIT"
    echo "$capacity"
}

load_capacity() {
    CAP_DOWN="$DEFAULT_CAPACITY_KBIT"
    CAP_UP="$DEFAULT_CAPACITY_KBIT"
    [ -f "$CAPACITY_FILE" ] && read -r CAP_DOWN CAP_UP < "$CAPACITY_FILE"
    case "$CAP_DOWN" in ''|*[!0-9]*) CAP_DOWN="$DEFAULT_CAPACITY_KBIT" ;; esac
    case "$CAP_UP" in ''|*[!0-9]*) CAP_UP="$DEFAULT_CAPACITY_KBIT" ;; esac
}

changed_tenth() {
    local delta=$(($1 - $2))
    [ "$delta" -ge 0 ] || delta=$((0 - delta))
    [ $((delta * 10)) -ge "$2" ]
}

write_status() {
    local rtt="$1"
    local prefix="$2"
    local minor=""
    local down=""
    local up=""

    {
        echo "updated: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "capacity: down ${CAP_DOWN}kbit up ${CAP_UP}kbit (shaped at ${SHAPE_PERCENT}%)"
        echo "rtt: ${rtt:-lost} ms, base ${BASE_RTT:-unknown} ms, target ${PING_TARGET:-none}"
        cat "$STATE_DIR/status.down" "$STATE_DIR/status.up" 2>/dev/null
        awk 'NR == FNR {down[$1] = $2; next} {print $1, down[$1] + 0, $2}' "$STATE_DIR/rates.down" "$STATE_DIR/rates.up" 2>/dev/null | while read -r minor down up; do
            case "$minor" in
                1[0-9a-f][0-9a-f]) echo "device $prefix.$((0x$minor - 256)): down ${down}kbit up ${up}kbit" ;;
            esac
        done
    } > "$STATE_DIR/status.tmp"
    mv "$STATE_DIR/status.tmp" "$STATE_DIR/status"
}

daemon() {
    local lan=""
    local lan_ip=""
    local prefix=""
    local wan=""
    local host=""
    local minor=""
    local now=0
    local last=0
    local elapsed=1
    local rx=0
    local tx=0
    local last_rx=0
    local last_tx=0
    local rate_down=0
    local rate_up=0
    local util_down=0
    local util_up=0
    local rtt=""
    local slow_samples=0
    local clamp_down=0
    local clamp_up=0
    local probe_down=0
    local probe_up=0
    local hold_down=0
    local hold_up=0
    local last_save=0
    local saved_down=0
    local saved_up=0

    command -v tc >/dev/null 2>&1 || { log "tc is missing; run apply to install it"; exit 1; }
    mkdir -p "$STATE_DIR"
    rm -f "$STATE_DIR"/*
    load_capacity
    saved_down="$CAP_DOWN"
    saved_up="$CAP_UP"
    trap 'shaper_stop; exit 0' INT TERM
    last="$(uptime_seconds)"
    last_save="$last"

    while true; do
        lan="$(lan_device)"
        lan_ip="$(lan_address)"
        prefix="${lan_ip%.*}"
        # A network restart recreates br-lan without the shaper.
        tc qdisc show dev "$lan" 2>/dev/null | grep -q "htb 1:" || shaper_setup "$lan" "$lan_ip"
        for host in $(lan_hosts "$lan" "$prefix" "$lan_ip"); do
            minor="$(printf '%x' $((256 + ${host##*.})))"
            case " $KNOWN " in
                *" $minor "*) ;;
                *)
                    shaper_device "$lan" dst "$host" "$minor" "$CAP_DOWN"
                    shaper_device "$IFB_DEVICE" src "$host" "$minor" "$CAP_UP"
                    KNOWN="$KNOWN $minor"
                    ;;
            esac
        done

        sleep "$SAMPLE_SECONDS"
        now="$(uptime_seconds)"
        elapsed=$((now - last))
        [ "$elapsed" -gt 0 ] || elapsed=1
        last="$now"

        wan="$(wan_l3_device)"
        rx="$(cat "/sys/class/net/$wan/statistics/rx_bytes" 2>/dev/null || echo 0)"
        tx="$(cat "/sys/class/net/$wan/statistics/tx_bytes" 2>/dev/null || echo 0)"
        if [ "$last_rx" -gt 0 ] && [ "$rx" -ge "$last_rx" ] && [ "$tx" -ge "$last_tx" ]; then
            rate_down=$(((rx - last_rx) * 8 / 1000 / elapsed))
            rate_up=$(((tx - last_tx) * 8 / 1000 / elapsed))
            util_down=$((rate_down * 100 / CAP_DOWN))
            util_up=$((rate_up * 100 / CAP_UP))

            rtt=""
            clamp_down=0
            clamp_up=0
            if [ -n "$PING_TARGET" ]; then
                rtt="$(ping_rtt)"
                if [ -z "$rtt" ] || { [ -n "$BASE_RTT" ] && [ "$rtt" -gt $((BASE_RTT + CONGESTION_DELTA_MS)) ]; }; then
                    slow_samples=$((slow_samples + 1))
                else
                    slow_samples=0
                fi
                if [ -n "$rtt" ]; then
                    if [ -z "$BASE_RTT" ] || [ "$rtt" -lt "$BASE_RTT" ]; then
                        BASE_RTT="$rtt"
                    elif [ "$util_down" -lt "$BASE_RTT_IDLE_PERCENT" ] && [ "$util_up" -lt "$BASE_RTT_IDLE_PERCENT" ]; then
                        BASE_RTT=$(((BASE_RTT * 7 + rtt) / 8))
                    fi
                fi
                if [ "$slow_samples" -ge "$CONGESTION_SAMPLES" ]; then
                    if [ "$util_down" -ge "$util_up" ] && [ "$util_down" -ge "$CLAMP_MIN_UTIL_PERCENT" ]; then
                        clamp_down=1
                        hold_down=$((now + PROBE_HOLD_SECONDS))
                    elif [ "$util_up" -ge "$CLAMP_MIN_UTIL_PERCENT" ]; then
                        clamp_up=1
                        hold_up=$((now + PROBE_HOLD_SECONDS))
                    fi
                    slow_samples=0
                fi
            fi
            probe_down=0
            probe_up=0
            [ "$slow_samples" -eq 0 ] && [ "$now" -ge "$hold_down" ] && probe_down=1
            [ "$slow_samples" -eq 0 ] && [ "$now" -ge "$hold_up" ] && probe_up=1
            CAP_DOWN="$(adjust_capacity "$CAP_DOWN" "$rate_down" "$clamp_down" "$probe_down")"
            CAP_UP="$(adjust_capacity "$CAP_UP" "$rate_up" "$clamp_up" "$probe_up")"
        fi
        last_rx="$rx"
        last_tx="$tx"

        balance "$lan" down "$CAP_DOWN" "$elapsed"
        balance "$IFB_DEVICE" up "$CAP_UP" "$elapsed"

        if [ $((now - last_save)) -ge "$SAVE_MIN_SECONDS" ] && { changed_tenth "$CAP_DOWN" "$saved_down" || changed_tenth "$CAP_UP" "$saved_up"; }; then
            mkdir -p "$CONFIG_DIR"
            echo "$CAP_DOWN $CAP_UP" > "$CAPACITY_FILE"
            saved_down="$CAP_DOWN"
            saved_up="$CAP_UP"
            last_save="$now"
        fi
        write_status "$rtt" "$prefix"
    done
}

status() {
    local iface=""
    local radio=""

    step "Network"
    echo "  LAN: $(uci -q get network.lan.proto) $(uci -q get network.lan.ipaddr)/$(uci -q get network.lan.netmask)"
    echo "  Bridge ports: $(uci -q get "network.$(br_lan_section).ports" || uci -q get network.lan.ifname)"
    echo "  WAN: proto $(uci -q get network.wan.proto) device $(wan_device) ($(wan_l3_device)) address $(wan_address)"
    ip -4 addr show 2>/dev/null | sed -n 's/^ *inet \([^ ]*\).* \([^ ]*\)$/  Address: \1 on \2/p'
    ip -4 route show default 2>/dev/null | sed 's/^/  Route: /'
    echo "  DHCP on LAN: $([ "$(uci -q get dhcp.lan.ignore)" = "1" ] && echo off || echo "on, start $(uci -q get dhcp.lan.start) limit $(uci -q get dhcp.lan.limit)")"
    [ -f /tmp/dhcp.leases ] && awk '{print "  Lease: " $3 " " $2 " " $4}' /tmp/dhcp.leases
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
    for iface in dnsmasq odhcpd firewall uhttpd dropbear "$SERVICE_NAME"; do
        [ -x "/etc/init.d/$iface" ] && echo "  $iface: $("/etc/init.d/$iface" enabled && echo enabled || echo disabled), $("/etc/init.d/$iface" running >/dev/null 2>&1 && echo running || echo stopped)"
    done
    step "Balancer"
    cat "$STATE_DIR/status" 2>/dev/null | sed 's/^/  /' || echo "  no state yet"
    step "Backups"
    ls -1 "$BACKUP_DIR" 2>/dev/null | grep 'tar.gz$' | sed 's/^/  /'
}

restore() {
    if [ -x "$SERVICE_PATH" ]; then
        "$SERVICE_PATH" stop
        "$SERVICE_PATH" disable
        log "Stopped and disabled $SERVICE_NAME"
    fi
    shaper_stop
    restore_backup || return 0
    CHANGED=1
    apply_changes "firewall dnsmasq odhcpd"
}

case "$1" in
    apply) apply "$2" ;;
    wifi) wifi_command "$2" "$3" "$4" ;;
    wifi-check) wifi_check "$2" ;;
    check) DRY_RUN=1; log "Check only: every setting is compared, nothing changes"; apply "$(lan_address)/24" ;;
    repair) apply "$(lan_address)/24" ;;
    status) status ;;
    restore) restore ;;
    daemon) daemon ;;
    shaper-stop) shaper_stop ;;
    *) sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//' ;;
esac
