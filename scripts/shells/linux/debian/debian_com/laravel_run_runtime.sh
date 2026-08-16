#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Declare all variables at the beginning of the file
# 6. Do not modify these rules
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Canonical Laravel Octane runtime launcher (common-area copy). Starts Reverb
# and Octane as a supervised pair; invoked by 132_laravel_main_start.sh and
# laravel_start_service.sh. LARAVEL_DIR falls back to the core_node layout.
#
# SYNC CONTRACT: the per-app instance is
#   poly_apps/laravel_main/scripts/run_runtime.sh
# Change both together.

LARAVEL_RUNTIME_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LARAVEL_RUNTIME_REPO_ROOT="$(cd "$LARAVEL_RUNTIME_COMMON_DIR/../../../../.." && pwd)"
LARAVEL_DIR="${LARAVEL_DIR:-${CORE_NODE_DIR:-$LARAVEL_RUNTIME_REPO_ROOT}/poly_apps/laravel_main}"
PHP_BIN="${PHP_BIN:-$(command -v php)}"
PORT="${PORT:-9000}"
WORKERS="${WORKERS:-4}"
TASK_WORKERS="${TASK_WORKERS:-4}"
OCTANE_SERVER="${OCTANE_SERVER:-swoole}"
OCTANE_HOST="${OCTANE_HOST:-0.0.0.0}"
OCTANE_WATCH="${OCTANE_WATCH:-0}"
OCTANE_POLL="${OCTANE_POLL:-0}"
REVERB_HOST="${REVERB_SERVER_HOST:-0.0.0.0}"
REVERB_PORT="${REVERB_SERVER_PORT:-8080}"
REVERB_PID=""
OCTANE_PID=""
RUNTIME_STATUS=0
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
