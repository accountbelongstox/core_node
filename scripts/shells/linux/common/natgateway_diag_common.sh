#!/bin/bash
# NAT gateway disconnect diagnostics shared by the diag daemon
# (debian_com/natgateway_diag_monitor.sh) and the natgateway CLI/menu.
# Samples roll in NATGW_DIAG_LIVE_DIR and keep only the last
# NATGW_DIAG_WINDOW_SECONDS while online; an outage (phone uplink lost, or the
# internet probe failing NATGW_DIAG_STALL_SECONDS) is saved as an incident
# with the window before it, the outage and NATGW_DIAG_POST_SECONDS after it
# (plus kernel, gateway and phone logcat for that span), then the live samples
# are cleared.

if [ "${NATGW_DIAG_LOADED:-false}" = "true" ]; then
    return
fi
NATGW_DIAG_LOADED="true"

NATGW_DIAG_DIR="$NATGW_CONFIG_DIR/diag"
NATGW_DIAG_INCIDENTS_DIR="$NATGW_DIAG_DIR/incidents"
NATGW_DIAG_LIVE_DIR="/run/ncore-natgateway-diag"
NATGW_DIAG_SERVICE_NAME="ncore-natgateway-diag"
NATGW_DIAG_WINDOW_SECONDS=600
NATGW_DIAG_POST_SECONDS=60
NATGW_DIAG_MAX_OUTAGE_SECONDS=600
NATGW_DIAG_STALL_SECONDS=20
NATGW_DIAG_KEEP_INCIDENTS=30
NATGW_DIAG_PROBE_TARGET="1.1.1.1"
NATGW_DIAG_HOST_HEADER="time,uplink,down_KiBs,up_KiBs,to_clients_KiBs,from_clients_KiBs,phone_rtt_ms,internet_rtt_ms,conntrack"
NATGW_DIAG_PHONE_HEADER="time,usb_powered,status,battery_temp_dC,charger_mV,battery_mA,level,cpu_max_C,thermal_status"

# Newest first.
natgw_diag_incidents() {
    ls -1d "$NATGW_DIAG_INCIDENTS_DIR"/*/ 2>/dev/null | sed 's:/$::' | sort -r
}

natgw_diag_clear() {
    rm -rf "${NATGW_DIAG_INCIDENTS_DIR:?}"/*
    [ -f "$NATGW_DIAG_LIVE_DIR/host.csv" ] && echo "$NATGW_DIAG_HOST_HEADER" > "$NATGW_DIAG_LIVE_DIR/host.csv"
    [ -f "$NATGW_DIAG_LIVE_DIR/phone.csv" ] && echo "$NATGW_DIAG_PHONE_HEADER" > "$NATGW_DIAG_LIVE_DIR/phone.csv"
    [ -f "$NATGW_DIAG_LIVE_DIR/conntrack.log" ] && : > "$NATGW_DIAG_LIVE_DIR/conntrack.log"
    return 0
}

natgw_diag_print_list() {
    local dir=""
    local -a dirs=()
    mapfile -t dirs < <(natgw_diag_incidents)
    echo "Diagnostics service: $(systemctl is-active "$NATGW_DIAG_SERVICE_NAME" 2>/dev/null) | Incidents: ${#dirs[@]} (kept: last $NATGW_DIAG_KEEP_INCIDENTS) | $NATGW_DIAG_INCIDENTS_DIR"
    for dir in "${dirs[@]}"; do
        echo "  $(basename "$dir")  $(sed -n 's/^outage: //p' "$dir/summary.txt" 2>/dev/null)"
    done
}

# Summary plus the files of one incident, through a pager when interactive.
natgw_diag_show() {
    local dir="$1"
    local file=""
    {
        cat "$dir/summary.txt" 2>/dev/null
        for file in host.csv phone.csv kernel.log natgw.log conntrack.log; do
            [ -s "$dir/$file" ] || continue
            echo
            echo "===== $file"
            cat "$dir/$file"
        done
        [ -s "$dir/logcat.txt" ] && printf '\n===== logcat.txt: %s lines (%s)\n' "$(wc -l < "$dir/logcat.txt")" "$dir/logcat.txt"
    } | if [ -t 1 ] && command -v less >/dev/null 2>&1; then less -R; else cat; fi
}
