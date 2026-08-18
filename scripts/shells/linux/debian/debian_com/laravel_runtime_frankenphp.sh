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

# laravel_main runtime - FRANKENPHP PLANE branch (referenced by
# 132_laravel_main_start.sh and the plane-aware laravel service).
# Single supervised `octane:start --server=frankenphp` process: HTTPS on
# the contract frankenphp_https port (h2/h3), admin API on frankenphp_admin
# (loopback), built-in Mercure hub at /.well-known/mercure. NO Reverb
# process exists on this plane.
#
# Mercure hub material (Mercure 1.0): HMAC keys + the trusted issuer (the
# `iss` the app signs with) are read from the RuntimeConfigurationStore and
# injected as PROCESS ENV ({env...} Caddyfile references) - they never
# appear in the Caddyfile, logs or URLs.

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LARAVEL_SERVICE_COMMON_DIR="$(dirname "$SCRIPT_CURRENT_DIR")"
LINUX_COMMON_DIR="$(dirname "$LARAVEL_SERVICE_COMMON_DIR")/common"

PHP_BIN="${PHP_BIN:-php}"
LARAVEL_DIR="${LARAVEL_DIR:-}"
WORKERS="${WORKERS:-4}"
TASK_WORKERS="${TASK_WORKERS:-2}"
OCTANE_WATCH="${OCTANE_WATCH:-0}"
OCTANE_POLL="${OCTANE_POLL:-0}"
VENDOR_AUTOLOAD="${LARAVEL_DIR}/vendor/autoload.php"
BOOTSTRAP_APP="${LARAVEL_DIR}/bootstrap/app.php"
FRANKENPHP_CADDYFILE="${LARAVEL_DIR}/storage/frankenphp/Caddyfile"
FRANKENPHP_SITE_HOST="${FRANKENPHP_SITE_HOST:-localhost}"
MERCURE_PUBLISHER_JWT=""
MERCURE_SUBSCRIBER_JWT=""
MERCURE_TRUSTED_ISSUERS=""
DNSPOD_TOKEN=""
FRANKENPHP_HTTPS_PORT=""
FRANKENPHP_ADMIN_PORT=""
OCTANE_ARGS=()

# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/service_contract_common.sh"
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/gvar_common.sh"
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/runtime_config_common.sh"
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/frankenphp_manager.sh"

FRANKENPHP_HTTPS_PORT="$(sc_get ports.frankenphp_https)"
FRANKENPHP_ADMIN_PORT="$(sc_get ports.frankenphp_admin)"

# Canonical Caddyfile before launch (content-hash idempotent).
fm_caddyfile_ensure \
    "${LARAVEL_DIR}/public" \
    "$FRANKENPHP_SITE_HOST" \
    "$FRANKENPHP_HTTPS_PORT" \
    "$FRANKENPHP_ADMIN_PORT" \
    "$FRANKENPHP_CADDYFILE"

# Mercure hub keys + trusted issuer: keys provisioned once by 132; the
# issuer self-bootstraps from the site host when absent (single source:
# the store, mirrored back on derivation).
MERCURE_PUBLISHER_JWT="$(runtime_config_get "MERCURE_PUBLISHER_JWT")"
MERCURE_SUBSCRIBER_JWT="$(runtime_config_get "MERCURE_SUBSCRIBER_JWT")"
MERCURE_TRUSTED_ISSUERS="$(runtime_config_get "MERCURE_TRUSTED_ISSUERS")"
DNSPOD_TOKEN="$(runtime_config_get "DNSPOD_TOKEN")"
if [ -z "$MERCURE_TRUSTED_ISSUERS" ]; then
    MERCURE_TRUSTED_ISSUERS="https://${FRANKENPHP_SITE_HOST}"
    runtime_config_put "MERCURE_TRUSTED_ISSUERS" "$MERCURE_TRUSTED_ISSUERS"
fi
if [ -z "$MERCURE_PUBLISHER_JWT" ] || [ -z "$MERCURE_SUBSCRIBER_JWT" ]; then
    echo "[laravel-runtime-frankenphp] [ERROR] Mercure keys missing in RuntimeConfigurationStore; run 132_laravel_main_start.sh provisioning first"
    exit 1
fi
export MERCURE_PUBLISHER_JWT_KEY="$MERCURE_PUBLISHER_JWT"
export MERCURE_PUBLISHER_JWT_ALG="HS256"
export MERCURE_SUBSCRIBER_JWT_KEY="$MERCURE_SUBSCRIBER_JWT"
export MERCURE_SUBSCRIBER_JWT_ALG="HS256"
export MERCURE_TRUSTED_ISSUERS
# DNSPod DNS-01 token (only when stored; the Caddyfile gate renders the tls
# stanza only when module + token both exist).
[ -n "$DNSPOD_TOKEN" ] && export DNSPOD_TOKEN
# Embedded PHP ini scan dir (34_configure_php85.sh frankenphp plane target):
# the Caddyfile-adjacent overrides load through PHP's own scan-dir rule.
export PHP_INI_SCAN_DIR="$(fm_php_ini_dir)"

cd "$LARAVEL_DIR" || exit 1

OCTANE_ARGS=(
    artisan octane:start
    "--server=frankenphp"
    "--https"
    "--caddyfile=${FRANKENPHP_CADDYFILE}"
    "--admin-port=${FRANKENPHP_ADMIN_PORT}"
    "--workers=${WORKERS}"
    "--task-workers=${TASK_WORKERS}"
)

if [ "$OCTANE_WATCH" = "1" ]; then
    OCTANE_ARGS+=("--watch")
fi
if [ "$OCTANE_POLL" = "1" ]; then
    OCTANE_ARGS+=("--poll")
fi

echo "[laravel-runtime-frankenphp] Starting octane:frankenphp (https :${FRANKENPHP_HTTPS_PORT} h2/h3, admin :${FRANKENPHP_ADMIN_PORT}, Mercure hub on plane)"
exec "$PHP_BIN" "${OCTANE_ARGS[@]}"
