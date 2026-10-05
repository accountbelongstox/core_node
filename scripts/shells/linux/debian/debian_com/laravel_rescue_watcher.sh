#!/bin/bash
# Watcher unit of the Laravel rescue plane (config/service_contract.json#laravel_rescue).
# Every LR_POLL_SECONDS: each <epoch>-<nonce>.<action>.request in LR_REQUESTS_DIR is
# deleted at once, then its Laravel action runs (one run per action per pass).
# With LR_KEEPALIVE_FLAG present, every pass also restarts the Laravel / UI unit
# whose port stopped listening (at most once per LR_KEEPALIVE_COOLDOWN seconds).
# Environment comes from the unit rendered by laravel_rescue_common.sh.

LR_STATUS_KEEP_LINES=500
LR_PHP_BIN=""
LR_REQUEST=""
LR_NAME=""
LR_ACTION=""
LR_DONE=""
LR_EXIT=0
LR_OUTPUT=""
LR_ACTIONS="${LR_ACTIONS//,/ }"
LR_KEEPALIVE_LAST_LARAVEL=0
LR_KEEPALIVE_LAST_UI=0

lr_log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LR_STATUS_FILE"
    echo "[laravel-rescue] $*"
}

lr_trim_status() {
    local tmp=""

    [ -f "$LR_STATUS_FILE" ] || return 0
    [ "$(wc -l < "$LR_STATUS_FILE")" -gt "$LR_STATUS_KEEP_LINES" ] || return 0
    tmp="$LR_STATUS_FILE.tmp"
    tail -n "$LR_STATUS_KEEP_LINES" "$LR_STATUS_FILE" > "$tmp" && mv -f "$tmp" "$LR_STATUS_FILE"
}

# Runs as root: hand every rescue file back to the real user, touching only mismatches.
lr_fix_ownership() {
    [ -n "$LR_OWNER" ] && [ -d "$LR_ROOT_DIR" ] || return 0
    find "$LR_ROOT_DIR" \( ! -user "$LR_OWNER" -o ! -group "$LR_GROUP" \) -exec chown -h "$LR_OWNER:$LR_GROUP" {} + 2>/dev/null
    [ ! -f "$LR_STATUS_FILE" ] || [ "$(stat -c '%a' "$LR_STATUS_FILE")" = "644" ] || chmod 644 "$LR_STATUS_FILE"
}

lr_unit_present() {
    [ -n "$LR_LARAVEL_SERVICE" ] && [ -f "/etc/systemd/system/$LR_LARAVEL_SERVICE.service" ]
}

# No registered plane unit: the 175 setup registers and starts it non-interactively.
lr_ui_unit_present() {
    [ -n "$LR_UI_SERVICE" ] && [ -f "/etc/systemd/system/$LR_UI_SERVICE.service" ]
}

lr_port_up() {
    ss -ltnH "sport = :$1" 2>/dev/null | grep -q .
}

lr_ui_action() {
    if lr_ui_unit_present; then
        systemctl reset-failed "$LR_UI_SERVICE" >/dev/null 2>&1
        systemctl "$1" "$LR_UI_SERVICE" 2>&1
    elif [ -n "$LR_LARAVEL_START_SCRIPT" ]; then
        bash "$LR_LARAVEL_START_SCRIPT" --ui-service < /dev/null 2>&1 | tail -n 5
        return "${PIPESTATUS[0]}"
    else
        echo "$LR_UI_SERVICE unit missing"
        return 1
    fi
}

# lr_keepalive_unit <label> <port> <unit> <last_var>: restart a registered unit
# whose port is down; skipped while systemd is still activating it.
lr_keepalive_unit() {
    local label="$1"
    local port="$2"
    local unit="$3"
    local last_var="$4"
    local now=0
    local state=""

    [ -n "$port" ] && [ -n "$unit" ] && [ -f "/etc/systemd/system/$unit.service" ] || return 0
    lr_port_up "$port" && return 0
    now="$(date +%s)"
    [ $(( now - ${!last_var} )) -ge "${LR_KEEPALIVE_COOLDOWN:-300}" ] || return 0
    state="$(systemctl is-active "$unit" 2>/dev/null)"
    [ "$state" = "activating" ] && return 0
    printf -v "$last_var" '%s' "$now"
    lr_log "keepalive: $label port $port down (unit $state); restarting $unit"
    systemctl reset-failed "$unit" >/dev/null 2>&1
    LR_OUTPUT="$(systemctl restart "$unit" 2>&1)"
    lr_log "keepalive: $label restart exit=$? $(printf '%s' "$LR_OUTPUT" | tr '\n' ' ' | cut -c1-200)"
}

lr_keepalive_pass() {
    [ -n "$LR_KEEPALIVE_FLAG" ] && [ -f "$LR_KEEPALIVE_FLAG" ] || return 0
    lr_keepalive_unit laravel "$LR_LARAVEL_PORT" "$LR_LARAVEL_SERVICE" LR_KEEPALIVE_LAST_LARAVEL
    lr_keepalive_unit ui "$LR_UI_PORT" "$LR_UI_SERVICE" LR_KEEPALIVE_LAST_UI
}

lr_run_setup() {
    AS_SERVICE=yes CODEMART_INIT=no INCLUDE_UI=no LARAVEL_RESCUE_SKIP=yes \
        bash "$LR_LARAVEL_START_SCRIPT" < /dev/null 2>&1 | tail -n 5
    return "${PIPESTATUS[0]}"
}

lr_artisan() {
    LR_PHP_BIN="$(command -v php 2>/dev/null)"
    if [ -z "$LR_PHP_BIN" ]; then
        echo "php not found"
        return 1
    fi
    ( cd "$LR_LARAVEL_DIR" && "$LR_PHP_BIN" artisan "$@" --no-interaction 2>&1 | tail -n 5; exit "${PIPESTATUS[0]}" )
}

lr_run_action() {
    case "$1" in
        start)
            if lr_unit_present; then
                systemctl reset-failed "$LR_LARAVEL_SERVICE" >/dev/null 2>&1
                systemctl start "$LR_LARAVEL_SERVICE" 2>&1
            else
                lr_run_setup
            fi
            ;;
        restart)
            if lr_unit_present; then
                systemctl reset-failed "$LR_LARAVEL_SERVICE" >/dev/null 2>&1
                systemctl restart "$LR_LARAVEL_SERVICE" 2>&1
            else
                lr_run_setup
            fi
            ;;
        sys-init)
            lr_artisan sys:init
            ;;
        optimize-clear)
            lr_artisan optimize:clear
            ;;
        ui-start)
            lr_ui_action start
            ;;
        ui-restart)
            lr_ui_action restart
            ;;
        keepalive-on)
            : > "$LR_KEEPALIVE_FLAG" && echo "keepalive on"
            ;;
        keepalive-off)
            rm -f "$LR_KEEPALIVE_FLAG" && echo "keepalive off"
            ;;
        *)
            echo "unsupported action"
            return 1
            ;;
    esac
}

mkdir -p "$LR_REQUESTS_DIR"
lr_log "watcher started (poll ${LR_POLL_SECONDS}s, dir $LR_REQUESTS_DIR, unit ${LR_LARAVEL_SERVICE:-none}, ui ${LR_UI_SERVICE:-none})"
lr_fix_ownership
while true; do
    LR_DONE=" "
    for LR_REQUEST in "$LR_REQUESTS_DIR"/*.request; do
        [ -f "$LR_REQUEST" ] || continue
        LR_NAME="$(basename "$LR_REQUEST" .request)"
        LR_ACTION="${LR_NAME##*.}"
        rm -f "$LR_REQUEST"
        case " $LR_ACTIONS " in
            *" $LR_ACTION "*) ;;
            *) lr_log "ignored $LR_NAME (unknown action)"; continue ;;
        esac
        case "$LR_DONE" in
            *" $LR_ACTION "*) lr_log "skipped $LR_NAME (already ran this pass)"; continue ;;
        esac
        LR_DONE="$LR_DONE$LR_ACTION "
        lr_log "running $LR_ACTION ($LR_NAME)"
        LR_OUTPUT="$(lr_run_action "$LR_ACTION")"
        LR_EXIT=$?
        lr_log "finished $LR_ACTION exit=$LR_EXIT $(printf '%s' "$LR_OUTPUT" | tr '\n' ' ' | cut -c1-400)"
    done
    lr_keepalive_pass
    lr_trim_status
    lr_fix_ownership
    sleep "$LR_POLL_SECONDS"
done
