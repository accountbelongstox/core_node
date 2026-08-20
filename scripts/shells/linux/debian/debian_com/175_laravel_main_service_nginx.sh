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

# Service runtime launcher - NGINX PLANE. Systemd ExecStart target.
# Called by systemd_service_manager via 175_laravel_main_start.sh's
# register_laravel_service. Only runs the minimal idempotent convergence
# (nginx edge ports, service state, swoole probe) then exec's
# laravel_runtime_nginx.sh with Octane swoole.
#
# NO domain setup, NO certbot, NO 175 init - those are handled by
# 175_laravel_main_start.sh (one-time setup). This script is the
# "just start octane" path for every systemd restart.
#
# Default: hot-reload (--watch). Set OCTANE_WATCH=0 to disable.

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LARAVEL_SERVICE_COMMON_DIR="$(dirname "$SCRIPT_CURRENT_DIR")"
LINUX_COMMON_DIR="$(dirname "$LARAVEL_SERVICE_COMMON_DIR")/common"

PORT="${PORT:-}"
PHP_BIN="${PHP_BIN:-php}"
LARAVEL_DIR="${LARAVEL_DIR:-}"
LARAVEL_RUNTIME_NGINX_SCRIPT="${LARAVEL_RUNTIME_NGINX_SCRIPT:-${SCRIPT_CURRENT_DIR}/laravel_runtime_nginx.sh}"
OCTANE_WATCH="${OCTANE_WATCH:-1}"
OCTANE_POLL="${OCTANE_POLL:-0}"
WORKERS="${WORKERS:-4}"
TASK_WORKERS="${TASK_WORKERS:-2}"
SCRIPT_INDEX="175SN"

# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/service_contract_common.sh"
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/gvar_common.sh"
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/common_functions.sh"
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/nginx_manager.sh"

echo "[$SCRIPT_INDEX] nginx plane service runtime: minimal convergence, then octane:swoole (watch=${OCTANE_WATCH})"

# Minimal convergence: edge ports (stop foreign occupiers of 80/443/udp-443)
# and nginx service state (start if stopped). No domain setup, no certbot,
# no installer - those are the 175 init job.
nm_edge_ports_ensure
nm_service_state "start" || echo "  Warning: nginx service state reported issues (continuing)."

cd "$LARAVEL_DIR" || exit 1

exec /bin/bash "$LARAVEL_RUNTIME_NGINX_SCRIPT"