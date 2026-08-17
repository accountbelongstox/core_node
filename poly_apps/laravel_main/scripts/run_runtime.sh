#!/bin/bash

# SYNC CONTRACT: this is the per-app instance; the canonical common-area copy is
#   scripts/shells/linux/debian/debian_com/laravel_run_runtime.sh
# (used by install_shells/132_laravel_main_start.sh). Change both together.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LARAVEL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PHP_BIN="${PHP_BIN:-$(command -v php)}"
PORT="${PORT:-}"
WORKERS="${WORKERS:-4}"
TASK_WORKERS="${TASK_WORKERS:-4}"
OCTANE_SERVER="${OCTANE_SERVER:-swoole}"
OCTANE_HOST="${OCTANE_HOST:-}"
OCTANE_WATCH="${OCTANE_WATCH:-0}"
OCTANE_POLL="${OCTANE_POLL:-0}"
REVERB_HOST="${REVERB_SERVER_HOST:-0.0.0.0}"
REVERB_PORT="${REVERB_SERVER_PORT:-8080}"
REVERB_PID=""
OCTANE_PID=""
RUNTIME_STATUS=0

# Central service contract (config/service_contract.json) via the shell
# adapter: default bind port = ports.laravel_api_backend, default bind host =
# hosts.any (0.0.0.0). PORT/OCTANE_HOST env vars still win.
# shellcheck source=/dev/null
. "${SCRIPT_DIR}/../../../scripts/shells/linux/common/service_contract_common.sh"
PORT="${PORT:-$(sc_get ports.laravel_api_backend)}"
OCTANE_HOST="${OCTANE_HOST:-$(sc_get hosts.any)}"

OCTANE_ARGS=(
    artisan octane:start
    "--server=${OCTANE_SERVER}"
    "--host=${OCTANE_HOST}"
    "--port=${PORT}"
    "--workers=${WORKERS}"
    "--task-workers=${TASK_WORKERS}"
)

stop_runtime() {
    if [ -n "$OCTANE_PID" ]; then
        kill "$OCTANE_PID" 2>/dev/null || true
        wait "$OCTANE_PID" 2>/dev/null || true
    fi
    if [ -n "$REVERB_PID" ]; then
        kill "$REVERB_PID" 2>/dev/null || true
        wait "$REVERB_PID" 2>/dev/null || true
    fi
}

reload_runtime() {
    "$PHP_BIN" artisan octane:reload || true
    "$PHP_BIN" artisan reverb:restart || true
}

if [ "$OCTANE_WATCH" = "1" ]; then
    OCTANE_ARGS+=("--watch")
fi
if [ "$OCTANE_POLL" = "1" ]; then
    OCTANE_ARGS+=("--poll")
fi

cd "$LARAVEL_DIR" || exit 1
trap stop_runtime EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap reload_runtime USR1

echo "Starting Reverb on ${REVERB_HOST}:${REVERB_PORT}"
"$PHP_BIN" artisan reverb:start --host="$REVERB_HOST" --port="$REVERB_PORT" &
REVERB_PID=$!

echo "Starting Octane on ${OCTANE_HOST}:${PORT} with ${WORKERS} request workers and ${TASK_WORKERS} task workers"
"$PHP_BIN" "${OCTANE_ARGS[@]}" &
OCTANE_PID=$!
wait -n "$REVERB_PID" "$OCTANE_PID" || RUNTIME_STATUS=$?
exit "$RUNTIME_STATUS"
