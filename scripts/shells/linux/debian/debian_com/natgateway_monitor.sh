#!/bin/bash
# NAT gateway monitor (systemd: ncore-natgateway). Reconciles on every link or
# address event (ip monitor) and at least every NATGW_POLL_SECONDS; tears the
# gateway down on stop so relay ports go back to NetworkManager.

MONITOR_SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
MONITOR_COMMON_DIR="$(dirname "$(dirname "$MONITOR_SCRIPT_DIR")")/common"
NATGW_DEBOUNCE_SECONDS=1
NATGW_EVENTS_PID=""
NATGW_EVENTS_FD=""
NATGW_EVENT_LINE=""
NATGW_STOP_REQUESTED="false"

source "$MONITOR_COMMON_DIR/runtime_environment.sh"
source "$MONITOR_COMMON_DIR/natgateway_engine_common.sh"

natgw_start_event_stream() {
    # coproc sets NATGW_EVENTS (fds) and NATGW_EVENTS_PID.
    coproc NATGW_EVENTS { exec ip -o monitor link address 2>/dev/null; }
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
trap 'NATGW_STOP_REQUESTED="true"' TERM INT
mkdir -p "$NATGW_RUN_DIR"
natgw_log "Monitor started (config: $NATGW_CONFIG_FILE)"
while [ "$NATGW_STOP_REQUESTED" != "true" ]; do
    natgw_reconcile
    [ "$NATGW_STOP_REQUESTED" = "true" ] && break
    natgw_wait_for_event
done
[ -n "$NATGW_EVENTS_PID" ] && kill "$NATGW_EVENTS_PID" 2>/dev/null
natgw_teardown "service stopped"
