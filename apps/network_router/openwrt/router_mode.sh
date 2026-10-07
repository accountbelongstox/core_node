#!/bin/sh
# Turns an OpenWrt router (also one left in AP mode by ap_mode.sh) into a routing
# gateway: WAN with NAT, LAN with its own /24, DHCP and DNS, plus a per-device
# bandwidth balancer (service router-balance). Run on the router:
#   sh router_mode.sh apply [lan_ip/24]   default 192.168.60.1/24
#   sh router_mode.sh status
#   sh router_mode.sh restore             undo with the newest backup
# The balancer measures the WAN rate (100 Mbit until measured), raises the limit
# when the link saturates without delay, clamps it to the live rate when a busy
# link shows latency congestion, guarantees each active device 10% (or an equal
# share) and each idle device 100 kbit (20 kbit on very slow links); unused
# bandwidth is shared equally. Tune it in /etc/router-mode/config.

BACKUP_DIR="/root/router-mode-backups"
CONFIGS="network dhcp wireless firewall"
LAN_ADDRESS="192.168.60.1/24"
REQUIRED_PACKAGES="kmod-sched-core kmod-ifb"
TC_PACKAGE="tc-tiny"
INSTALL_PATH="/usr/sbin/router-mode.sh"
SERVICE_NAME="router-balance"
SERVICE_PATH="/etc/init.d/$SERVICE_NAME"
CONFIG_DIR="/etc/router-mode"
CONFIG_FILE="$CONFIG_DIR/config"
CAPACITY_FILE="$CONFIG_DIR/capacity"
STATE_DIR="/tmp/router-mode"
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
CAP_DOWN=0
CAP_UP=0
BASE_RTT=""
KNOWN=""

[ -f "$CONFIG_FILE" ] && . "$CONFIG_FILE"

log() {
    echo "[ROUTER-MODE] $*"
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

lan_device() {
    local device=""
    device="$(ifstatus lan 2>/dev/null | jsonfilter -e '@.l3_device' 2>/dev/null)"
    echo "${device:-br-lan}"
}

wan_l3_device() {
    ifstatus wan 2>/dev/null | jsonfilter -e '@.l3_device' 2>/dev/null
}

firewall_zone() {
    uci show firewall 2>/dev/null | sed -n "s/^firewall\.\([^.]*\)\.name='$1'$/\1/p" | head -n 1
}

ensure_zone() {
    local name="$1"
    local input="$2"
    local forward="$3"
    local zone=""
    local network=""

    zone="$(firewall_zone "$name")"
    if [ -z "$zone" ]; then
        zone="$(uci add firewall zone)"
        uci set "firewall.$zone.name=$name"
    fi
    uci set "firewall.$zone.input=$input"
    uci set "firewall.$zone.output=ACCEPT"
    uci set "firewall.$zone.forward=$forward"
    for network in $4; do
        uci show "firewall.$zone.network" 2>/dev/null | grep -q "'$network'" || uci add_list "firewall.$zone.network=$network"
    done
    echo "$zone"
}

ensure_lan_forwarding() {
    local section=""

    for section in $(uci show firewall 2>/dev/null | sed -n "s/^firewall\.\([^.]*\)=forwarding$/\1/p"); do
        [ "$(uci -q get "firewall.$section.src")" = "lan" ] && [ "$(uci -q get "firewall.$section.dest")" = "wan" ] && return 0
    done
    section="$(uci add firewall forwarding)"
    uci set "firewall.$section.src=lan"
    uci set "firewall.$section.dest=wan"
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

    command -v tc >/dev/null 2>&1 || missing="$TC_PACKAGE"
    for package in $REQUIRED_PACKAGES; do
        package_installed "$package" || missing="$missing $package"
    done
    [ -n "$missing" ] || return 0
    log "Installing:$missing"
    if command -v apk >/dev/null 2>&1; then
        apk update && apk add $missing
    else
        opkg update && opkg install $missing
    fi || log "Package install failed:$missing; the balancer needs them"
}

install_balancer() {
    [ "$(readlink -f "$0")" = "$INSTALL_PATH" ] || cp "$0" "$INSTALL_PATH"
    chmod +x "$INSTALL_PATH"
    mkdir -p "$CONFIG_DIR"
    [ -f "$CONFIG_FILE" ] || cat > "$CONFIG_FILE" <<EOF
PING_TARGET="$PING_TARGET"
DEFAULT_CAPACITY_KBIT=$DEFAULT_CAPACITY_KBIT
ACTIVE_SHARE_PERCENT=$ACTIVE_SHARE_PERCENT
IDLE_FLOOR_KBIT=$IDLE_FLOOR_KBIT
SLOW_IDLE_FLOOR_KBIT=$SLOW_IDLE_FLOOR_KBIT
SLOW_CAPACITY_KBIT=$SLOW_CAPACITY_KBIT
CONGESTION_DELTA_MS=$CONGESTION_DELTA_MS
EOF
    cat > "$SERVICE_PATH" <<EOF
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
    chmod +x "$SERVICE_PATH"
    "$SERVICE_PATH" enable
}

apply() {
    local address="${1:-$LAN_ADDRESS}"
    local ip="${address%/*}"
    local wan=""
    local section=""
    local iface=""
    local service=""

    backup
    install_packages
    wan="$(wan_device)"
    section="$(br_lan_section)"

    if [ -n "$wan" ]; then
        if [ -n "$section" ]; then
            uci -q del_list "network.$section.ports=$wan"
        else
            uci set network.lan.ifname="$(uci -q get network.lan.ifname | tr ' ' '\n' | grep -vx "$wan" | tr '\n' ' ' | sed 's/ *$//')"
        fi
        log "WAN port $wan left br-lan"
    else
        log "No network.wan device; set the WAN port in LuCI"
    fi
    if uci -q get network.wan >/dev/null; then
        [ "$(uci -q get network.wan.proto)" = "none" ] && uci set network.wan.proto='dhcp'
        uci -q delete network.wan.auto
    fi
    if uci -q get network.wan6 >/dev/null; then
        [ "$(uci -q get network.wan6.proto)" = "none" ] && uci set network.wan6.proto='dhcpv6'
        uci -q delete network.wan6.auto
    fi

    uci set network.lan.proto='static'
    uci set network.lan.ipaddr="$ip"
    uci set network.lan.netmask='255.255.255.0'
    uci -q delete network.lan.gateway
    uci -q delete network.lan.dns
    uci set network.lan.ip6assign='60'

    uci -q get dhcp.lan >/dev/null || uci set dhcp.lan=dhcp
    uci set dhcp.lan.interface='lan'
    uci -q delete dhcp.lan.ignore
    uci set dhcp.lan.start='100'
    uci set dhcp.lan.limit='150'
    uci set dhcp.lan.leasetime='12h'
    uci set dhcp.lan.dhcpv6='server'
    uci set dhcp.lan.ra='server'

    ensure_zone lan ACCEPT ACCEPT lan >/dev/null
    section="$(ensure_zone wan REJECT REJECT "wan wan6")"
    uci set "firewall.$section.masq=1"
    uci set "firewall.$section.mtu_fix=1"
    ensure_lan_forwarding
    # Offloaded flows bypass the qdiscs the balancer shapes with.
    uci -q delete firewall.@defaults[0].flow_offloading
    uci -q delete firewall.@defaults[0].flow_offloading_hw

    for iface in $(uci show wireless 2>/dev/null | sed -n "s/^wireless\.\([^.]*\)=wifi-iface$/\1/p"); do
        uci set "wireless.$iface.network=lan"
        uci set "wireless.$iface.isolate=0"
        uci set "wireless.$iface.mode=ap"
    done
    uci commit

    for service in dnsmasq odhcpd firewall; do
        [ -x "/etc/init.d/$service" ] && "/etc/init.d/$service" enable
    done
    install_balancer

    log "Router mode set: LAN $ip/24 with DHCP, WAN $(uci -q get network.wan.proto) with NAT, balancer $SERVICE_NAME enabled"
    log "Network restarts in 3s; reconnect to http://$ip from the LAN"
    (sleep 3; /etc/init.d/network restart; wifi reload; for service in firewall dnsmasq odhcpd $SERVICE_NAME; do [ -x "/etc/init.d/$service" ] && "/etc/init.d/$service" restart; done) >/dev/null 2>&1 &
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
        lan_ip="$(uci -q get network.lan.ipaddr)"
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

    echo "LAN: $(uci -q get network.lan.proto) $(uci -q get network.lan.ipaddr)/$(uci -q get network.lan.netmask)"
    echo "br-lan ports: $(uci -q get "network.$(br_lan_section).ports" || uci -q get network.lan.ifname)"
    echo "WAN: proto $(uci -q get network.wan.proto) device $(wan_device) ($(wan_l3_device))"
    echo "DHCP on LAN: $([ "$(uci -q get dhcp.lan.ignore)" = "1" ] && echo off || echo "on, start $(uci -q get dhcp.lan.start) limit $(uci -q get dhcp.lan.limit)")"
    for iface in $(uci show wireless 2>/dev/null | sed -n "s/^wireless\.\([^.]*\)=wifi-iface$/\1/p"); do
        echo "Wi-Fi $iface: ssid $(uci -q get "wireless.$iface.ssid") network $(uci -q get "wireless.$iface.network")"
    done
    [ -x "$SERVICE_PATH" ] && echo "balancer: $("$SERVICE_PATH" enabled && echo enabled || echo disabled)"
    cat "$STATE_DIR/status" 2>/dev/null
    ls -1 "$BACKUP_DIR" 2>/dev/null | sed 's/^/backup: /'
}

restore() {
    local latest=""

    latest="$(ls -1 "$BACKUP_DIR"/config-*.tar.gz 2>/dev/null | tail -n 1)"
    [ -n "$latest" ] || { log "No backup in $BACKUP_DIR"; return 1; }
    if [ -x "$SERVICE_PATH" ]; then
        "$SERVICE_PATH" stop
        "$SERVICE_PATH" disable
    fi
    shaper_stop
    tar -xzf "$latest" -C /etc/config
    log "Restored $latest and disabled $SERVICE_NAME; network restarts in 3s"
    (sleep 3; /etc/init.d/network restart; wifi reload; /etc/init.d/firewall restart; /etc/init.d/dnsmasq restart) >/dev/null 2>&1 &
}

case "$1" in
    apply) apply "$2" ;;
    status) status ;;
    restore) restore ;;
    daemon) daemon ;;
    shaper-stop) shaper_stop ;;
    *) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//' ;;
esac
