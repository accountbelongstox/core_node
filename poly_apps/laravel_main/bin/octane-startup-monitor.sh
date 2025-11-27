#!/bin/bash

STARTUP_LOG="/tmp/laravel_startup.log"
SYSTEMD_LOG="/tmp/laravel_systemd_startup.log"

log_startup() {
    local stage="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S.%N')
    local elapsed_ms=$(( $(date +%s%3N) - START_TIME ))

    echo "[${timestamp}] [${elapsed_ms}ms] [${stage}] ${message}" >> "$SYSTEMD_LOG"
}

START_TIME=$(date +%s%3N)

log_startup "SYSTEMD_START" "Systemd service starting"

echo "" > "$STARTUP_LOG"

log_startup "OCTANE_COMMAND" "Executing php artisan octane:start command"

exec "$@"
