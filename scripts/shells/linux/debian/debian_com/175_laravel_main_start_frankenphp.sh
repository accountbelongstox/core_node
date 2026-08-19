#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Declare all variables at the beginning of the file
# 6. Do not modify these rules
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# 175_laravel_main_start.sh -> FRANKENPHP PLANE branch (PART_0 0.6 W3).
# Converges the plane stack BEFORE the single supervised octane:frankenphp
# launch - every step its own idempotent probe, no step's no-op blocks the
# next: binary -> canonical link -> php-cli shims -> plane PHP ini ->
# dnspod module (defer-safe) -> DNS-01 certificate readiness. Then hands
# off to laravel_runtime_frankenphp.sh (canonical Caddyfile render, Mercure
# key env injection, octane:frankenphp HTTPS h2/h3 + embedded hub).

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LARAVEL_SERVICE_COMMON_DIR="$(dirname "$SCRIPT_CURRENT_DIR")"
LINUX_COMMON_DIR="$(dirname "$LARAVEL_SERVICE_COMMON_DIR")/common"

PORT="${PORT:-}"
PHP_BIN="${PHP_BIN:-php}"
LARAVEL_DIR="${LARAVEL_DIR:-}"
LARAVEL_RUNTIME_FRANKENPHP_SCRIPT="${LARAVEL_RUNTIME_FRANKENPHP_SCRIPT:-}"
FRANKENPHP_SITE_HOST="${FRANKENPHP_SITE_HOST:-localhost}"
FRANKENPHP_HTTPS_PORT="${FRANKENPHP_HTTPS_PORT:-443}"
OCTANE_RUNTIME_WATCH="${OCTANE_RUNTIME_WATCH:-0}"
OCTANE_RUNTIME_POLL="${OCTANE_RUNTIME_POLL:-0}"
VENDOR_AUTOLOAD="${LARAVEL_DIR}/vendor/autoload.php"
BOOTSTRAP_APP="${LARAVEL_DIR}/bootstrap/app.php"
SCRIPT_INDEX="175F"

# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/gvar_common.sh"
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/common_functions.sh"
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/runtime_config_common.sh"
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/frankenphp_manager.sh"

echo "Starting headless API runtime (frankenphp plane -> octane:frankenphp on :${FRANKENPHP_HTTPS_PORT} h2/h3, Mercure hub at https://${FRANKENPHP_SITE_HOST}/.well-known/mercure)"

# STEP 1: plane stack convergence (fine-grained, each probe independent).
fm_install
fm_ensure_local_bin_link
fm_ensure_php_cli_shim
fm_php_ini_ensure
fm_ensure_dnspod_module

# STEP 2: idempotent certificate readiness - the wildcard certificate is
# issued/renewed by Caddy's ACME at launch once module + token both hold;
# the token is the single manual input and cannot be generated.
fm_dns01_ensure

# STEP 3: single supervised runtime process (canonical Caddyfile, Mercure
# env injection, embedded hub - no sidecar process on this plane).
exec /bin/bash "$LARAVEL_RUNTIME_FRANKENPHP_SCRIPT"
