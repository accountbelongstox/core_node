#!/bin/bash
# NAT gateway monitor (systemd: ncore-natgateway). Reconciles on every link,
# address or route event (ip monitor; a DHCP renew re-adding the default route
# of a relay-only pair uplink) and at least every NATGW_POLL_SECONDS; tears the
# gateway down on stop so relay ports go back to NetworkManager, except for a
# restart that left NATGW_KEEP_LINKS_MARKER (upgrade/restart: the next process
# takes the live links over). Every NATGW_UPGRADE_CHECK_SECONDS it checks the
# natgateway code: newer files that pass `bash -n` run an idempotent
# `113_natgateway.sh install --yes` in its own transient unit (installs missing
# units, restarts the ones running old code).

MONITOR_SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
MONITOR_COMMON_DIR="$(dirname "$(dirname "$MONITOR_SCRIPT_DIR")")/common"
MONITOR_INSTALL_SCRIPT="$(dirname "$MONITOR_SCRIPT_DIR")/install_shells/113_natgateway.sh"
MONITOR_STARTED_AT="$(date +%s)"
MONITOR_UPGRADE_SEEN=0
MONITOR_UPGRADE_CHECKED=0
NATGW_DEBOUNCE_SECONDS=1
NATGW_EVENTS_PID=""
NATGW_EVENTS_FD=""
NATGW_EVENT_LINE=""
NATGW_STOP_REQUESTED="false"

source "$MONITOR_COMMON_DIR/runtime_environment.sh"
source "$MONITOR_COMMON_DIR/natgateway_engine_common.sh"

natgw_start_event_stream() {
    # coproc sets NATGW_EVENTS (fds) and NATGW_EVENTS_PID.
    coproc NATGW_EVENTS { exec ip -o monitor link address route 2>/dev/null; }
    NATGW_EVENTS_FD="${NATGW_EVENTS[0]}"
}

# Block until the next interface event (or the poll timeout), then drain the
# burst an apply/hot-plug produces so one change triggers one reconcile.
natgw_wait_for_event() {
    if [ -z "$NATGW_EVENTS_PID" ] || ! kill -0 "$NATGW_EVENTS_PID" 2>/dev/null; then
        natgw_start_event_stream
    fi
    if [ -z "$NATGW_EVENTS_FD" ]; then
        sleep "$NATGW_POLL_SECONDS"
        return
    fi
    if read -r -t "$NATGW_POLL_SECONDS" -u "$NATGW_EVENTS_FD" NATGW_EVENT_LINE; then
        while [ "$NATGW_STOP_REQUESTED" != "true" ] && read -r -t "$NATGW_DEBOUNCE_SECONDS" -u "$NATGW_EVENTS_FD" NATGW_EVENT_LINE; do
            :
        done
    fi
}

# The handler only sets a flag: a signal interrupts the blocking read at once,
# and teardown runs from the main loop, never from inside the trap.
natgw_code_files() {
    echo "$MONITOR_INSTALL_SCRIPT"
    echo "$MONITOR_SCRIPT_DIR/natgateway_monitor.sh"
    echo "$MONITOR_SCRIPT_DIR/natgateway_diag_monitor.sh"
    ls -1 "$MONITOR_COMMON_DIR"/natgateway_*.sh "$MONITOR_COMMON_DIR/runtime_environment.sh" 2>/dev/null
}

# Newest code mtime after this process started, once per change, and only when
# every present file parses (a half-synced checkout waits for the next check;
# files a sync removed or moved are skipped).
natgw_check_upgrade() {
    local now=0
    local newest=0
    local mtime=0
    local file=""
    now="$(date +%s)"
    [ $((now - MONITOR_UPGRADE_CHECKED)) -ge "$NATGW_UPGRADE_CHECK_SECONDS" ] || return 0
    MONITOR_UPGRADE_CHECKED="$now"
    while IFS= read -r file; do
        [ -f "$file" ] || continue
        mtime="$(stat -c %Y "$file" 2>/dev/null || echo 0)"
        [ "$mtime" -gt "$newest" ] && newest="$mtime"
    done < <(natgw_code_files)
    [ "$newest" -gt "$MONITOR_STARTED_AT" ] && [ "$newest" -gt "$MONITOR_UPGRADE_SEEN" ] || return 0
    while IFS= read -r file; do
        [ -f "$file" ] || continue
        bash -n "$file" 2>/dev/null || { natgw_log "Code update pending (syntax check failed: $file)"; return 0; }
    done < <(natgw_code_files)
    systemctl is-active --quiet "$NATGW_UPGRADE_UNIT" && return 0
    MONITOR_UPGRADE_SEEN="$newest"
    natgw_log "Code updated: running install --yes ($NATGW_UPGRADE_UNIT)"
    systemd-run --quiet --no-block --collect --unit="$NATGW_UPGRADE_UNIT" /bin/bash "$MONITOR_INSTALL_SCRIPT" install --yes
}

trap 'NATGW_STOP_REQUESTED="true"' TERM INT
mkdir -p "$NATGW_RUN_DIR"
rm -f "$NATGW_KEEP_LINKS_MARKER"
natgw_log "Monitor started (config: $NATGW_CONFIG_FILE)"
while [ "$NATGW_STOP_REQUESTED" != "true" ]; do
    natgw_reconcile
    [ "$NATGW_STOP_REQUESTED" = "true" ] && break
    natgw_check_upgrade
    natgw_wait_for_event
done
[ -n "$NATGW_EVENTS_PID" ] && kill "$NATGW_EVENTS_PID" 2>/dev/null
if [ -f "$NATGW_KEEP_LINKS_MARKER" ]; then
    natgw_log "Restarting: live links kept for the next monitor"
else
    natgw_teardown "service stopped"
fi
