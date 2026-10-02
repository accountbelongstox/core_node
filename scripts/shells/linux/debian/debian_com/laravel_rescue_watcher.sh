#!/bin/bash
# Watcher unit of the Laravel rescue plane (config/service_contract.json#laravel_rescue).
# Every LR_POLL_SECONDS: each <epoch>-<nonce>.<action>.request in LR_REQUESTS_DIR is
# deleted at once, then its Laravel action runs (one run per action per pass).
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
        *)
            echo "unsupported action"
            return 1
            ;;
    esac
}

mkdir -p "$LR_REQUESTS_DIR"
lr_log "watcher started (poll ${LR_POLL_SECONDS}s, dir $LR_REQUESTS_DIR, unit ${LR_LARAVEL_SERVICE:-none})"
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
    lr_trim_status
    lr_fix_ownership
    sleep "$LR_POLL_SECONDS"
done
