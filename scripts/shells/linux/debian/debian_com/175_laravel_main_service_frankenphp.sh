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

# Service runtime launcher - FRANKENPHP PLANE. Systemd ExecStart target.
# Called by systemd_service_manager via 175_laravel_main_start.sh's
# register_laravel_service. Validates and repairs runtime pointers, then
# exec's laravel_runtime_frankenphp.sh with direct Caddy supervision.
#
# NO domain setup, NO nginx, NO certbot, NO 175 init - those are handled
# by 175_laravel_main_start.sh (one-time setup). This script is the
# "just start the Laravel Octane worker plane" path for every systemd
# restart.
#
# Default: hot-reload (--watch). Set OCTANE_WATCH=0 to disable.

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LARAVEL_SERVICE_COMMON_DIR="$(dirname "$SCRIPT_CURRENT_DIR")"
LINUX_COMMON_DIR="$(dirname "$LARAVEL_SERVICE_COMMON_DIR")/common"

PORT="${PORT:-}"
PHP_BIN="${PHP_BIN:-php}"
LARAVEL_DIR="${LARAVEL_DIR:-}"
LARAVEL_RUNTIME_FRANKENPHP_SCRIPT="${LARAVEL_RUNTIME_FRANKENPHP_SCRIPT:-${SCRIPT_CURRENT_DIR}/laravel_runtime_frankenphp.sh}"
FRANKENPHP_SITE_HOST="${FRANKENPHP_SITE_HOST:-}"
OCTANE_WATCH="${OCTANE_WATCH:-1}"
OCTANE_POLL="${OCTANE_POLL:-0}"
WORKERS="${WORKERS:-4}"
TASK_WORKERS="${TASK_WORKERS:-2}"
SCRIPT_INDEX="175SF"

# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/service_contract_common.sh"
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/gvar_common.sh"
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/common_functions.sh"
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/frankenphp_manager.sh"

echo "[$SCRIPT_INDEX] frankenphp plane service runtime: runtime-only convergence, then direct FrankenPHP supervision (Octane worker, watch=${OCTANE_WATCH})"

# Package installation, static builds and package cleanup are step 93
# responsibilities. A service restart only repairs pointers for the exact
# selected variant and fails closed when that payload is missing.
fm_runtime_converge
if [ -z "$FM_RUNTIME_BINARY" ]; then
    exit 1
fi

FRANKENPHP_SITE_HOST="${FRANKENPHP_SITE_HOST:-$(fm_site_host)}"

cd "$LARAVEL_DIR" || exit 1

exec /bin/bash "$LARAVEL_RUNTIME_FRANKENPHP_SCRIPT"
