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
# 175_laravel_main_start.sh and the plane-aware laravel service).
# Single supervised `octane:frankenphp` process: HTTPS on
# the contract frankenphp_https port (h2/h3), admin API on frankenphp_admin
# (loopback), built-in Mercure hub at /.well-known/mercure. NO Reverb
# process exists on this plane.
#
# Mercure hub material (the pinned embedded Mercure runtime): the HMAC keys
# are provisioned (never rotated) by the laravel_main RelayHubKeyProvisioner into the
# RuntimeConfigurationStore constant directory (outside the repo - git
# safe) and embedded as LITERAL publisher_jwt/subscriber_jwt values in the
# canonical Caddyfile (0600) before launch - no process env, no .env. The
# trusted issuer (the `iss` the app signs with) is store-only material for
# the app-side signer.

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LARAVEL_SERVICE_COMMON_DIR="$(dirname "$SCRIPT_CURRENT_DIR")"
LINUX_COMMON_DIR="$(dirname "$LARAVEL_SERVICE_COMMON_DIR")/common"

PHP_BIN="${PHP_BIN:-php}"
LARAVEL_DIR="${LARAVEL_DIR:-}"
WORKERS="${WORKERS:-4}"
MAX_REQUESTS="${MAX_REQUESTS:-500}"
OCTANE_WATCH="${OCTANE_WATCH:-0}"
OCTANE_POLL="${OCTANE_POLL:-0}"
VENDOR_AUTOLOAD="${LARAVEL_DIR}/vendor/autoload.php"
BOOTSTRAP_APP="${LARAVEL_DIR}/bootstrap/app.php"
FRANKENPHP_CADDYFILE="${LARAVEL_DIR}/storage/frankenphp/Caddyfile"
FRANKENPHP_ROUTES_DIR="$(dirname "$FRANKENPHP_CADDYFILE")/routes"
FRANKENPHP_SITE_HOST="${FRANKENPHP_SITE_HOST:-localhost}"
MERCURE_TRUSTED_ISSUERS=""
MERCURE_CANONICAL_ISSUER=""
DNSPOD_TOKEN=""
FRANKENPHP_HTTPS_PORT=""
FRANKENPHP_ADMIN_PORT=""
FRANKENPHP_ACME_RELOAD_CMD=""
FM_VARIANT=""
FM_DNS01_MODE=""
FM_BINARY=""
OCTANE_ARGS=()

# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/service_contract_common.sh"
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/gvar_common.sh"
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/common_functions.sh"
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/runtime_config_common.sh"
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/frankenphp_manager.sh"
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/frankenphp_acme_sh_install.sh"

FRANKENPHP_HTTPS_PORT="$(sc_get ports.frankenphp_https)"
FRANKENPHP_ADMIN_PORT="$(sc_get ports.frankenphp_admin)"
# Renewal reload hook baked into the acme.sh renewal conf: renewed certs go
# live through the caddy admin /load endpoint without a service restart
# (fails harmlessly while the server is not up yet).
FRANKENPHP_ACME_RELOAD_CMD="curl -fsS -m 5 -X POST -H 'Content-Type: text/caddyfile' --data-binary @${FRANKENPHP_CADDYFILE} http://127.0.0.1:${FRANKENPHP_ADMIN_PORT}/load || true"

# Mercure hub keys: provisioned (never rotated) BEFORE the canonical
# Caddyfile render so the literal publisher_jwt/subscriber_jwt values are
# always present at render time. The trusted issuer self-bootstraps from
# the site host when absent (single source: the store, mirrored back on
# derivation) for the app-side token signer.
runtime_config_ensure_mercure_keys
if [ "$(runtime_config_mercure_keys_ready)" != "yes" ]; then
    echo "[laravel-runtime-frankenphp] [ERROR] Mercure key provisioning failed (RelayHubKeyProvisioner); check the PHP runtime"
    exit 1
fi
MERCURE_CANONICAL_ISSUER="https://${FRANKENPHP_SITE_HOST}"
MERCURE_TRUSTED_ISSUERS="$(runtime_config_get "MERCURE_TRUSTED_ISSUERS")"
if [ "$MERCURE_TRUSTED_ISSUERS" != "$MERCURE_CANONICAL_ISSUER" ]; then
    runtime_config_put "MERCURE_TRUSTED_ISSUERS" "$MERCURE_CANONICAL_ISSUER" >/dev/null
    MERCURE_TRUSTED_ISSUERS="$(runtime_config_get "MERCURE_TRUSTED_ISSUERS")"
fi
if [ "$MERCURE_TRUSTED_ISSUERS" != "$MERCURE_CANONICAL_ISSUER" ]; then
    echo "[laravel-runtime-frankenphp] [ERROR] Mercure trusted issuer convergence failed"
    exit 1
fi
DNSPOD_TOKEN="$(runtime_config_get "DNSPOD_TOKEN")"

# Certificate pre-flight (issue first, start after): acquire/renew the
# acme.sh DNS-01 prebuilt certificates BEFORE the Caddyfile renders and
# the server binds the HTTPS port - the prebuilt-tls gate pins them; the
# embedded dnspod module path stays a fallback. Issuance failures only
# warn: the renderers keep their fallback gates and the server starts.
fm_cert_status "$FRANKENPHP_SITE_HOST" "$FRANKENPHP_ROUTES_DIR"
acme_sh_preflight_for_service "$FRANKENPHP_SITE_HOST" "$FRANKENPHP_ROUTES_DIR" "$FRANKENPHP_ACME_RELOAD_CMD"

# Variant branch (175SF contract, one launcher / two flows):
#   compiled | prebuilt - acme.sh DNS-01 certificates FIRST (prebuilt-tls
#     gate), the embedded dnspod module stays a TLS fallback (module
#     variant carries it; official builds do not);
#   apt - official deb build has NO dnspod module: certificates come
#     exclusively from the acme.sh dns_dp pre-flight (issue-before-start).
# Both flows share the pre-flight above (initial install / renewal check)
# and the persistent ncore-acme-cert renewal timer it registers.
FM_VARIANT="$(fm_variant)"
FM_DNS01_MODE="$(fm_variant_dns01_mode "$FM_VARIANT")"
FM_BINARY="$(fm_variant_binary)"
export FRANKENPHP_VARIANT="$FM_VARIANT"
export FRANKENPHP_DNS01_MODE="$FM_DNS01_MODE"
export FRANKENPHP_BINARY_PATH="$FM_BINARY"
case "$FM_DNS01_MODE" in
    "$FRANKENPHP_DNS01_MODE_ACME_SH")
        echo "[laravel-runtime-frankenphp] variant: ${FM_VARIANT} (acme.sh DNS-01 certificates only)"
        ;;
    *)
        echo "[laravel-runtime-frankenphp] variant: ${FM_VARIANT:-unrecorded} (acme.sh DNS-01 first; dnspod module fallback)"
        ;;
esac

# Canonical Caddyfile before launch (content-hash idempotent; literal
# Mercure keys from the store).
fm_caddyfile_ensure \
    "${LARAVEL_DIR}/public" \
    "$FRANKENPHP_SITE_HOST" \
    "$FRANKENPHP_HTTPS_PORT" \
    "$FRANKENPHP_ADMIN_PORT" \
    "$FRANKENPHP_CADDYFILE"
if [ "$FM_CADDYFILE_READY" != "yes" ]; then
    echo "[laravel-runtime-frankenphp] [ERROR] Canonical Caddyfile convergence failed"
    exit 1
fi

# DNSPod DNS-01 token (only when stored AND a module-capable variant; the
# Caddyfile gate renders the tls stanza only when module + token both
# exist). Stays env-based by design: the token itself never enters the
# file.
if [ "$FM_DNS01_MODE" = "$FRANKENPHP_DNS01_MODE_EMBEDDED" ] && [ -n "$DNSPOD_TOKEN" ]; then
    export DNSPOD_TOKEN
fi
# Embedded PHP ini scan dir (96_configure_php85.sh frankenphp plane target):
# the Caddyfile-adjacent overrides load through PHP's own scan-dir rule.
export PHP_INI_SCAN_DIR="$(fm_php_ini_scan_path)"

cd "$LARAVEL_DIR" || exit 1

OCTANE_ARGS=(
    artisan octane:frankenphp
    "--host=0.0.0.0"
    "--port=${FRANKENPHP_HTTPS_PORT}"
    "--https"
    "--caddyfile=${FRANKENPHP_CADDYFILE}"
    "--admin-port=${FRANKENPHP_ADMIN_PORT}"
    "--workers=${WORKERS}"
    "--max-requests=${MAX_REQUESTS}"
)

if [ "$OCTANE_WATCH" = "1" ]; then
    OCTANE_ARGS+=("--watch")
fi
if [ "$OCTANE_POLL" = "1" ]; then
    OCTANE_ARGS+=("--poll")
fi

echo "[laravel-runtime-frankenphp] Starting octane:frankenphp (https :${FRANKENPHP_HTTPS_PORT} h2/h3, admin :${FRANKENPHP_ADMIN_PORT}, Mercure hub on plane)"
exec "$PHP_BIN" "${OCTANE_ARGS[@]}"
