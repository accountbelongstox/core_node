#!/bin/bash
# NAT gateway disconnect diagnostics (systemd: ncore-natgateway-diag). Probes
# the phone uplink every NATGW_DIAG_TICK seconds, keeps rolling samples (host
# traffic/latency, phone power/thermal over adb, conntrack) for the last
# NATGW_DIAG_WINDOW_SECONDS, and saves an incident around every outage.

MONITOR_SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
MONITOR_COMMON_DIR="$(dirname "$(dirname "$MONITOR_SCRIPT_DIR")")/common"
NATGW_DIAG_TICK=2
NATGW_DIAG_PHONE_PID=""
NATGW_DIAG_STOP="false"

source "$MONITOR_COMMON_DIR/runtime_environment.sh"
source "$MONITOR_COMMON_DIR/natgateway_engine_common.sh"
source "$MONITOR_COMMON_DIR/natgateway_diag_common.sh"

export HOME="${HOME:-/root}"

diag_log() {
    echo "[$(date '+%F %T')][NATGW-DIAG] $*"
}

diag_now() {
    date '+%F %T'
}

# The phone uplink: the USB interface holding a default route.
diag_uplink() {
    local iface=""
    local -a ifaces=()
    mapfile -t ifaces < <(natgw_default_route_ifaces)
    for iface in "${ifaces[@]}"; do
        natgw_is_usb "$iface" && { echo "$iface"; return; }
    done
}

# Bytes of every relay port (members of the gateway bridges): $1 = rx|tx.
# The bridge devices' own counters stay 0 for routed traffic on some kernels.
diag_relay_bytes() {
    local path=""
    local total=0
    for path in /sys/class/net/"$NATGW_BRIDGE_PREFIX"*/brif/*; do
        [ -e "$path" ] || continue
        total=$((total + $(cat "/sys/class/net/$(basename "$path")/statistics/${1}_bytes" 2>/dev/null || echo 0)))
    done
    echo "$total"
}

diag_adb_ready() {
    command -v adb >/dev/null 2>&1 && timeout 5 adb devices 2>/dev/null | grep -q 'device$'
}

# Every 5s: plugged/charging, battery temperature, charger voltage, battery
# current, level, hottest CPU, thermal status (empty row while adb is gone).
diag_phone_loop() {
    local out="$NATGW_DIAG_LIVE_DIR/phone.csv"
    local b=""
    local th=""
    command -v adb >/dev/null 2>&1 || return 0
    while true; do
        b="$(timeout 4 adb shell dumpsys battery 2>/dev/null)"
        if [ -z "$b" ]; then
            echo "$(diag_now),adb-unreachable,,,,,,," >> "$out"
            sleep 5
            continue
        fi
        th="$(timeout 4 adb shell dumpsys thermalservice 2>/dev/null)"
        printf '%s,%s,%s,%s,%s,%s,%s,%s,%s\n' "$(diag_now)" \
            "$(awk -F': ' '/USB powered/{print $2; exit}' <<< "$b")" \
            "$(awk -F': ' '/^  status/{print $2; exit}' <<< "$b")" \
            "$(awk -F': ' '/^  temperature/{print $2; exit}' <<< "$b")" \
            "$(awk -F': ' '/Charger voltage/{print $2; exit}' <<< "$b")" \
            "$(awk -F': ' '/Battery current/{print $2; exit}' <<< "$b")" \
            "$(awk -F': ' '/^  level/{print $2; exit}' <<< "$b")" \
            "$(grep -oE 'mValue=[0-9.]+, mType=0' <<< "$th" | grep -oE '[0-9.]+' | sort -n | tail -n 1)" \
            "$(awk -F': ' '/^Thermal Status/{print $2; exit}' <<< "$th")" >> "$out"
        sleep 5
    done
}

diag_conntrack_sample() {
    command -v conntrack >/dev/null 2>&1 || return 0
    {
        echo "=== $(diag_now) total $(conntrack -C 2>/dev/null)"
        conntrack -L 2>/dev/null | grep -oE '^[a-z]+ .*src=[0-9.]+ dst=[0-9.]+' \
            | awk '{for (i = 1; i <= NF; i++) {if ($i ~ /^src=/) s = $i; if ($i ~ /^dst=/) d = $i}; print $1, s, d}' \
            | sort | uniq -c | sort -rn | head -n 15
    } >> "$NATGW_DIAG_LIVE_DIR/conntrack.log"
}

# Drops samples older than the window (csv rows and conntrack blocks).
diag_prune() {
    local cut=""
    local file=""
    cut="$(date -d "-$NATGW_DIAG_WINDOW_SECONDS sec" '+%F %T')"
    for file in host.csv phone.csv; do
        [ -f "$NATGW_DIAG_LIVE_DIR/$file" ] || continue
        awk -F, -v cut="$cut" 'NR == 1 || $1 >= cut' "$NATGW_DIAG_LIVE_DIR/$file" > "$NATGW_DIAG_LIVE_DIR/.$file.tmp" \
            && mv -f "$NATGW_DIAG_LIVE_DIR/.$file.tmp" "$NATGW_DIAG_LIVE_DIR/$file"
    done
    [ -f "$NATGW_DIAG_LIVE_DIR/conntrack.log" ] || return 0
    awk -v cut="$cut" '/^=== / {keep = (substr($0, 5, 19) >= cut)} keep' "$NATGW_DIAG_LIVE_DIR/conntrack.log" > "$NATGW_DIAG_LIVE_DIR/.conntrack.tmp" \
        && mv -f "$NATGW_DIAG_LIVE_DIR/.conntrack.tmp" "$NATGW_DIAG_LIVE_DIR/conntrack.log"
}

diag_reset_live() {
    mkdir -p "$NATGW_DIAG_LIVE_DIR"
    echo "$NATGW_DIAG_HOST_HEADER" > "$NATGW_DIAG_LIVE_DIR/host.csv"
    echo "$NATGW_DIAG_PHONE_HEADER" > "$NATGW_DIAG_LIVE_DIR/phone.csv"
    : > "$NATGW_DIAG_LIVE_DIR/conntrack.log"
}

# Saves the live window plus kernel, gateway and phone logs for
# [event - window, now], writes summary.txt, keeps the newest incidents only.
diag_save_incident() {
    local event="$1"
    local reason="$2"
    local back="$3"
    local wan_before="$4"
    local dir=""
    local since=""
    local outage=""
    local service=""
    dir="$NATGW_DIAG_INCIDENTS_DIR/$(date -d "@$event" '+%Y%m%d-%H%M%S')-$reason"
    mkdir -p "$dir"
    since="$(date -d "@$((event - NATGW_DIAG_WINDOW_SECONDS))" '+%F %T')"
    cp -f "$NATGW_DIAG_LIVE_DIR/host.csv" "$NATGW_DIAG_LIVE_DIR/phone.csv" "$NATGW_DIAG_LIVE_DIR/conntrack.log" "$dir/" 2>/dev/null
    journalctl -k --since "$since" --no-pager -o short-iso 2>/dev/null \
        | grep -E 'usb [0-9]+-|usb[0-9]+-port|rndis|EMI|error -71|over-current|xhci' > "$dir/kernel.log"
    journalctl -u "$NATGW_SERVICE_NAME" --since "$since" --no-pager -o short-iso 2>/dev/null | grep -v dnsmasq > "$dir/natgw.log"
    if diag_adb_ready; then
        adb logcat -b all -v threadtime -d -t "$(date -d "@$((event - NATGW_DIAG_WINDOW_SECONDS))" '+%m-%d %H:%M:%S.000')" > "$dir/logcat.txt" 2>&1
        for service in tethering usb battery thermalservice; do
            timeout 10 adb shell dumpsys "$service" > "$dir/dumpsys_$service.txt" 2>&1
        done
    fi
    if [ "$back" -gt 0 ]; then
        outage="$((back - event))s"
    else
        outage="not restored within ${NATGW_DIAG_MAX_OUTAGE_SECONDS}s"
    fi
    {
        echo "event: $(date -d "@$event" '+%F %T') ($reason)"
        echo "outage: $outage"
        echo "uplink before: ${wan_before:--}  after: $(diag_uplink)"
        echo "phone, last samples before the event:"
        awk -F, -v t="$(date -d "@$event" '+%F %T')" 'NR == 1 || $1 <= t' "$dir/phone.csv" | tail -n 4 | sed 's/^/  /'
        echo "host, last samples before the event:"
        awk -F, -v t="$(date -d "@$event" '+%F %T')" 'NR == 1 || $1 <= t' "$dir/host.csv" | tail -n 4 | sed 's/^/  /'
        echo "kernel USB events:"
        grep -E 'USB disconnect|EMI|error -71|over-current|New USB device found' "$dir/kernel.log" | tail -n 8 | sed 's/^/  /'
        echo "phone power/USB events (logcat):"
        grep -E ' battery_status: |USB_STATE=|usbtemp|Tethering.*(stop|Stop|error)|thermal' "$dir/logcat.txt" 2>/dev/null \
            | grep -vE 'am_cpu| adbd | dumpsys ' | tail -n 12 | sed 's/^/  /'
    } > "$dir/summary.txt"
    natgw_diag_incidents | tail -n +"$((NATGW_DIAG_KEEP_INCIDENTS + 1))" | while IFS= read -r dir; do
        rm -rf "$dir"
    done
    diag_log "Incident saved: $(date -d "@$event" '+%F %T') $reason, outage $outage"
}

diag_main() {
    local state="online"
    local wan=""
    local last_wan=""
    local gw=""
    local gw_rtt=""
    local net_rtt=""
    local now=0
    local event=0
    local reason=""
    local fail_since=0
    local online_since=0
    local wan_before=""
    local tick=0
    local rx=0 tx=0 brx=0 btx=0 prx=0 ptx=0 pbrx=0 pbtx=0

    diag_reset_live
    mkdir -p "$NATGW_DIAG_INCIDENTS_DIR"
    diag_phone_loop &
    NATGW_DIAG_PHONE_PID=$!
    diag_log "Started (window ${NATGW_DIAG_WINDOW_SECONDS}s, incidents: $NATGW_DIAG_INCIDENTS_DIR)"
    while [ "$NATGW_DIAG_STOP" != "true" ]; do
        now="$(date +%s)"
        wan="$(diag_uplink)"
        gw_rtt=""
        net_rtt=""
        if [ -n "$wan" ]; then
            rx="$(cat "/sys/class/net/$wan/statistics/rx_bytes" 2>/dev/null || echo 0)"
            tx="$(cat "/sys/class/net/$wan/statistics/tx_bytes" 2>/dev/null || echo 0)"
            gw="$(ip -4 route show default dev "$wan" 2>/dev/null | awk '{print $3; exit}')"
            gw_rtt="$(ping -c1 -W1 "$gw" 2>/dev/null | grep -oE 'time=[0-9.]+' | cut -d= -f2)"
            net_rtt="$(ping -c1 -W3 "$NATGW_DIAG_PROBE_TARGET" 2>/dev/null | grep -oE 'time=[0-9.]+' | cut -d= -f2)"
        fi
        brx="$(diag_relay_bytes rx)"
        btx="$(diag_relay_bytes tx)"
        if [ -n "$wan" ] && [ "$wan" = "$last_wan" ]; then
            echo "$(diag_now),$wan,$(( (rx - prx) / 1024 / NATGW_DIAG_TICK )),$(( (tx - ptx) / 1024 / NATGW_DIAG_TICK )),$(( (btx - pbtx) / 1024 / NATGW_DIAG_TICK )),$(( (brx - pbrx) / 1024 / NATGW_DIAG_TICK )),${gw_rtt:-timeout},${net_rtt:-timeout},$(conntrack -C 2>/dev/null)" >> "$NATGW_DIAG_LIVE_DIR/host.csv"
        else
            echo "$(diag_now),${wan:-none},,,,,,," >> "$NATGW_DIAG_LIVE_DIR/host.csv"
        fi

        if [ "$state" = "online" ]; then
            if [ -n "$last_wan" ] && [ "$wan" != "$last_wan" ]; then
                state="outage"; event="$now"; reason="uplink-lost"; wan_before="$last_wan"; online_since=0
                diag_log "Outage: phone uplink $last_wan lost"
            elif [ -n "$wan" ] && [ -z "$net_rtt" ]; then
                [ "$fail_since" -gt 0 ] || fail_since="$now"
                if [ $((now - fail_since)) -ge "$NATGW_DIAG_STALL_SECONDS" ]; then
                    state="outage"; event="$fail_since"; reason="internet-stall"; wan_before="$wan"; online_since=0
                    diag_log "Outage: no internet through $wan for ${NATGW_DIAG_STALL_SECONDS}s"
                fi
            else
                fail_since=0
            fi
        else
            if [ -n "$wan" ] && [ -n "$net_rtt" ]; then
                [ "$online_since" -gt 0 ] || online_since="$now"
            else
                online_since=0
            fi
            if [ "$online_since" -gt 0 ] && [ $((now - online_since)) -ge "$NATGW_DIAG_POST_SECONDS" ]; then
                diag_save_incident "$event" "$reason" "$online_since" "$wan_before"
                diag_reset_live
                state="online"; fail_since=0
            elif [ $((now - event)) -ge "$NATGW_DIAG_MAX_OUTAGE_SECONDS" ]; then
                diag_save_incident "$event" "$reason" 0 "$wan_before"
                diag_reset_live
                state="online"; fail_since=0
            fi
        fi

        tick=$((tick + 1))
        if [ $((tick % 30)) -eq 0 ]; then
            diag_conntrack_sample
            [ "$state" = "online" ] && diag_prune
        fi
        last_wan="$wan"; prx=$rx; ptx=$tx; pbrx=$brx; pbtx=$btx
        sleep "$NATGW_DIAG_TICK" & wait $!
    done
}

trap 'NATGW_DIAG_STOP="true"' TERM INT
diag_main
[ -n "$NATGW_DIAG_PHONE_PID" ] && kill "$NATGW_DIAG_PHONE_PID" 2>/dev/null
diag_log "Stopped"
