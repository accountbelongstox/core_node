#!/bin/bash
# resource_watchdog.sh - Scan for services/processes that exhaust CPU or memory
# and can freeze the system, with special aggregation of frankenphp / php-zts
# child tasks. Alerts go to /logs/debug.log (key events only, size-capped).
#
# Modes:
#   --scan-once   one full report to stdout; breach summary appended to the log
#   --daemon      background loop, alerts only (started via nohup, NOT reboot-persistent)
#   --stop        stop a running daemon
#
# The daemon is intentionally not registered with systemd/cron: it dies at
# reboot and must be restarted manually.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

LOG_DIR="/logs"
LOG_FILE="$LOG_DIR/debug.log"
PID_FILE="$LOG_DIR/resource_watchdog.pid"
LOG_MAX_BYTES=524288
LOG_KEEP_BYTES=262144

INTERVAL_SECONDS=30
ALERT_COOLDOWN_SECONDS=300

CPU_CORES="$(nproc 2>/dev/null || echo 1)"
LOAD_PER_CORE_MAX="${WATCHDOG_LOAD_PER_CORE_MAX:-1.5}"
MEM_AVAIL_PCT_MIN="${WATCHDOG_MEM_AVAIL_PCT_MIN:-10}"
SWAP_USED_PCT_MAX="${WATCHDOG_SWAP_USED_PCT_MAX:-85}"
PROC_CPU_PCT_MAX="${WATCHDOG_PROC_CPU_PCT_MAX:-150}"
FRANKENPHP_COUNT_MAX="${WATCHDOG_FRANKENPHP_COUNT_MAX:-30}"
FRANKENPHP_RSS_MB_MAX="${WATCHDOG_FRANKENPHP_RSS_MB_MAX:-1024}"

MODE="${1:---scan-once}"

timestamp() {
    date '+%Y-%m-%dT%H:%M:%S'
}

rotate_log_if_needed() {
    local size=0
    [ -f "$LOG_FILE" ] || return 0
    size=$(stat -c %s "$LOG_FILE" 2>/dev/null || echo 0)
    if [ "$size" -gt "$LOG_MAX_BYTES" ]; then
        tail -c "$LOG_KEEP_BYTES" "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
        echo "$(timestamp) [WATCHDOG] log rotated (kept last ${LOG_KEEP_BYTES} bytes)" >> "$LOG_FILE"
    fi
}

log_line() {
    mkdir -p "$LOG_DIR"
    rotate_log_if_needed
    echo "$(timestamp) $1" >> "$LOG_FILE"
}

# System metrics: "load1 load_per_core mem_avail_pct swap_used_pct"
read_system_metrics() {
    local load1 mem_total mem_avail swap_total swap_free mem_pct swap_pct per_core
    load1=$(awk '{print $1}' /proc/loadavg)
    mem_total=$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)
    mem_avail=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
    swap_total=$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo)
    swap_free=$(awk '/^SwapFree:/ {print $2}' /proc/meminfo)
    mem_pct=$(( mem_avail * 100 / (mem_total > 0 ? mem_total : 1) ))
    if [ "$swap_total" -gt 0 ]; then
        swap_pct=$(( (swap_total - swap_free) * 100 / swap_total ))
    else
        swap_pct=0
    fi
    per_core=$(awk -v l="$load1" -v c="$CPU_CORES" 'BEGIN {printf "%.2f", l/c}')
    echo "$load1 $per_core $mem_pct $swap_pct"
}

# Top offenders: "comm(pid)=cpu%/rssMb;..." limited to $1 entries, sorted by $2 (cpu|rss)
top_offenders() {
    local limit="$1" sort_key="$2"
    ps -eo pid=,comm=,pcpu=,rss= --sort="-$sort_key" \
        | awk -v n="$limit" 'NR<=n {printf "%s(%s)=%.0f%%/%dMb;", $2, $1, $3, $4/1024}'
}

# frankenphp aggregate: "count rss_mb cpu_pct" across frankenphp and php-zts tasks
frankenphp_aggregate() {
    ps -eo rss=,pcpu=,args= \
        | awk '/[f]rankenphp|[p]hp-zts/ {rss+=$1; cpu+=$2; n++}
               END {printf "%d %d %.0f", n+0, rss/1024, cpu}'
}

# Echoes alert tokens ("LOAD", "MEM", ...) to stdout when thresholds are breached.
# Side effect: prints human-readable report lines to stdout in scan mode.
evaluate() {
    local load1 per_core mem_pct swap_pct alerts=""
    read -r load1 per_core mem_pct swap_pct <<< "$(read_system_metrics)"

    awk -v v="$per_core" -v t="$LOAD_PER_CORE_MAX" 'BEGIN {exit !(v>t)}' && alerts="$alerts LOAD"
    [ "$mem_pct" -lt "$MEM_AVAIL_PCT_MIN" ] && alerts="$alerts MEM"
    [ "$swap_pct" -gt "$SWAP_USED_PCT_MAX" ] && alerts="$alerts SWAP"

    read -r fp_count fp_rss fp_cpu <<< "$(frankenphp_aggregate)"
    [ "$fp_count" -gt "$FRANKENPHP_COUNT_MAX" ] && alerts="$alerts FRANKENPHP_COUNT"
    [ "$fp_rss" -gt "$FRANKENPHP_RSS_MB_MAX" ] && alerts="$alerts FRANKENPHP_RSS"

    local top_cpu_entry=""
    top_cpu_entry=$(ps -eo comm=,pcpu= --sort=-pcpu | awk 'NR==1 {printf "%s=%.0f", $1, $2}')
    local top_cpu_val="${top_cpu_entry#*=}"
    [ "${top_cpu_val%.*}" -gt "$PROC_CPU_PCT_MAX" ] && alerts="$alerts PROC_CPU"

    echo "load1=$load1 load/core=$per_core mem_avail=${mem_pct}% swap_used=${swap_pct}%"
    echo "frankenphp_tasks=$fp_count frankenphp_rss=${fp_rss}Mb frankenphp_cpu=${fp_cpu}%"
    echo "top_cpu: $(top_offenders 3 pcpu)"
    echo "top_mem: $(top_offenders 3 rss)"
    echo "ALERTS:${alerts:-none}"
}

alert_key() {
    echo "$1" | tr ' ' '_' | tr -s '_'
}

daemon_loop() {
    echo "$$" > "$PID_FILE"
    log_line "[WATCHDOG] daemon started pid=$$ interval=${INTERVAL_SECONDS}s thresholds(load/core>$LOAD_PER_CORE_MAX,mem_avail<$MEM_AVAIL_PCT_MIN%,swap>$SWAP_USED_PCT_MAX%,frankenphp_count>$FRANKENPHP_COUNT_MAX,frankenphp_rss>${FRANKENPHP_RSS_MB_MAX}Mb,proc_cpu>$PROC_CPU_PCT_MAX%)"
    declare -A last_alert_at=()
    local report alerts key now last
    while true; do
        report="$(evaluate)"
        alerts="$(echo "$report" | awk -F'ALERTS:' '/^ALERTS:/ {print $2}')"
        if [ "$alerts" != "none" ] && [ -n "$alerts" ]; then
            key="$(alert_key "$alerts")"
            now=$(date +%s)
            last="${last_alert_at[$key]:-0}"
            if [ $(( now - last )) -ge "$ALERT_COOLDOWN_SECONDS" ]; then
                last_alert_at[$key]=$now
                log_line "[ALERT] $(echo "$report" | tr '\n' ' ' | sed 's/ALERTS:/alerts:/')"
            fi
        fi
        sleep "$INTERVAL_SECONDS"
    done
}

stop_daemon() {
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        kill "$(cat "$PID_FILE")"
        log_line "[WATCHDOG] daemon stopped pid=$(cat "$PID_FILE")"
        rm -f "$PID_FILE"
        echo "daemon stopped"
    else
        rm -f "$PID_FILE"
        echo "no daemon running"
    fi
}

case "$MODE" in
    --scan-once)
        report="$(evaluate)"
        echo "$report"
        alerts="$(echo "$report" | awk -F'ALERTS:' '/^ALERTS:/ {print $2}')"
        if [ "$alerts" != "none" ] && [ -n "$alerts" ]; then
            log_line "[SCAN-ALERT] $(echo "$report" | tr '\n' ' ' | sed 's/ALERTS:/alerts:/')"
        else
            log_line "[SCAN-OK] $(echo "$report" | head -2 | tr '\n' ' ')"
        fi
        ;;
    --daemon)
        daemon_loop
        ;;
    --stop)
        stop_daemon
        ;;
    *)
        echo "usage: $0 [--scan-once|--daemon|--stop]"
        ;;
esac
