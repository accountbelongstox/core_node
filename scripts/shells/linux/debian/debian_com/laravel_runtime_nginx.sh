#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# laravel_main runtime - NGINX PLANE branch (referenced by
# 175_laravel_main_start.sh and the plane-aware laravel service).
# System PHP + Swoole Octane on the contract laravel_api_backend port;
# nginx (external) terminates TLS and reverse-proxies loopback. NO Reverb
# process exists on this plane - realtime is the Mercure hub contract.

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LARAVEL_SERVICE_COMMON_DIR="$(dirname "$SCRIPT_CURRENT_DIR")"
LINUX_COMMON_DIR="$(dirname "$LARAVEL_SERVICE_COMMON_DIR")/common"

PHP_BIN="${PHP_BIN:-php}"
LARAVEL_DIR="${LARAVEL_DIR:-}"
WORKERS="${WORKERS:-4}"
TASK_WORKERS="${TASK_WORKERS:-2}"
OCTANE_WATCH="${OCTANE_WATCH:-0}"
OCTANE_POLL="${OCTANE_POLL:-0}"
OCTANE_PID=""
PORT="${PORT:-}"
OCTANE_HOST="${OCTANE_HOST:-}"
RUNTIME_STATUS=0
OCTANE_ARGS=()

# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/service_contract_common.sh"

# Default bind port = ports.laravel_api_backend, default bind host =
# hosts.any (reachable directly AND via the nginx loopback proxy). PORT /
# OCTANE_HOST env vars still win.
PORT="${PORT:-$(sc_get ports.laravel_api_backend)}"
OCTANE_HOST="${OCTANE_HOST:-$(sc_get hosts.any)}"

stop_runtime() {
    if [ -n "$OCTANE_PID" ]; then
        kill "$OCTANE_PID" 2>/dev/null || true
        wait "$OCTANE_PID" 2>/dev/null || true
    fi
}

reload_runtime() {
    "$PHP_BIN" artisan octane:reload || true
}

OCTANE_ARGS=(
    artisan octane:start
    "--server=swoole"
    "--host=${OCTANE_HOST}"
    "--port=${PORT}"
    "--workers=${WORKERS}"
    "--task-workers=${TASK_WORKERS}"
)

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

echo "Starting Octane (swoole, nginx plane) on ${OCTANE_HOST}:${PORT} with ${WORKERS} request workers and ${TASK_WORKERS} task workers"
"$PHP_BIN" "${OCTANE_ARGS[@]}" &
OCTANE_PID=$!
wait "$OCTANE_PID" || RUNTIME_STATUS=$?
exit "$RUNTIME_STATUS"
