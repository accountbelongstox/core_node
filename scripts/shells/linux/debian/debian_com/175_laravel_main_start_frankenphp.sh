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

# 175_laravel_main_start.sh -> FRANKENPHP PLANE branch. Dispatched by the
# orchestrator for BOTH plane-specific phases (shared constants via
# gvar_common/service_contract/frankenphp_domain_common/frankenphp_manager -
# this file defines NO plane or path constants of its own):
#
#   domains mode: the frankenphp analog of the nginx domain phase
#     (ensure_nginx_stack + ensure_certbot_stack + run_domain_setup_phase).
#     Reuses the SAME shared components - domain_setup_load_secrets /
#     domain_setup_ensure_prefix / domain_setup_persist_state - plus the
#     same DNS_DNSPOD_API_TOKENS secret, mirrored into the runtime store.
#     Per-domain Caddy route files are rendered with independent API and UI
#     planes: api.${prefix}.${domain} -> Laravel, while apex/www/regional UI
#     aliases -> Nexus Dash. The main Caddyfile includes them and DNS-01
#     readiness is converged. nginx and certbot are NEVER touched on this
#     plane (TLS is Caddy-ACME owned).
#
#   runtime mode (default): exact-variant runtime pointer convergence, then
#     hands off to
#     laravel_runtime_frankenphp.sh (Mercure key provisioning + canonical
#     Caddyfile render with literal keys, directly supervised FrankenPHP
#     HTTPS h2/h3 + embedded Laravel Octane worker and hub).

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LARAVEL_SERVICE_COMMON_DIR="$(dirname "$SCRIPT_CURRENT_DIR")"
LINUX_COMMON_DIR="$(dirname "$LARAVEL_SERVICE_COMMON_DIR")/common"

PORT="${PORT:-}"
PHP_BIN="${PHP_BIN:-php}"
LARAVEL_DIR="${LARAVEL_DIR:-}"
LARAVEL_RUNTIME_FRANKENPHP_SCRIPT="${LARAVEL_RUNTIME_FRANKENPHP_SCRIPT:-${SCRIPT_CURRENT_DIR}/laravel_runtime_frankenphp.sh}"
FRANKENPHP_SITE_HOST="${FRANKENPHP_SITE_HOST:-}"
FRANKENPHP_HTTPS_PORT="${FRANKENPHP_HTTPS_PORT:-}"
OCTANE_RUNTIME_WATCH="${OCTANE_RUNTIME_WATCH:-0}"
OCTANE_RUNTIME_POLL="${OCTANE_RUNTIME_POLL:-0}"
DOMAIN_SCOPE="${DOMAIN_SCOPE:-all}"
VENDOR_AUTOLOAD="${LARAVEL_DIR}/vendor/autoload.php"
BOOTSTRAP_APP="${LARAVEL_DIR}/bootstrap/app.php"
SCRIPT_INDEX="175F"
MODE="${1:-runtime}"

# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/service_contract_common.sh"
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/gvar_common.sh"
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/common_functions.sh"
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/runtime_config_common.sh"
# Shared domain components (secrets reader, region prefix, persist state) -
# the SAME library the nginx plane domain phase uses.
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/domain_setup_common.sh"
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/frankenphp_manager.sh"
# FrankenPHP domain setup library (Caddy-native counterpart of
# domain_setup_common.sh: per-domain route files, main Caddyfile include,
# DNS-01 readiness - no nginx, no certbot).
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/frankenphp_domain_common.sh"

FRANKENPHP_HTTPS_PORT="$(sc_get ports.frankenphp_https)"

# --- ui-binding mode: shared state + Caddy UI route convergence ----------
if [ "$MODE" = "ui-binding" ]; then
    fm_domain_enable_ui_binding
    echo "[$SCRIPT_INDEX] UI binding ready: $FM_DOMAIN_UI_BINDING_READY"
    echo "[$SCRIPT_INDEX] Caddy live reload ready: $FM_DOMAIN_CADDY_RELOAD_READY"
    exit 0
fi

# --- domains mode: frankenphp plane domain/DNS-01 convergence -------------
if [ "$MODE" = "domains" ]; then
    if [ ! -d "$DOMAIN_SETUP_SECRETS_DIR" ]; then
        echo "[$SCRIPT_INDEX] No decrypted DNSPod secrets; site host falls back to localhost (run dd.sh, then re-run 175)."
        exit 0
    fi
    if [ "$(id -u)" -ne 0 ] && ! sudo -n true 2>/dev/null; then
        echo "[$SCRIPT_INDEX] Domain setup needs root privileges; re-run when convenient:"
        echo "  sudo bash ${LARAVEL_SERVICE_COMMON_DIR}/install_shells/175_laravel_main_start.sh --domains-only"
        exit 0
    fi

    if [ "$DOMAIN_SCOPE" = "certs" ]; then
        fm_domain_certificates_only || echo "  Warning: DNS-01 readiness convergence reported issues (continuing)."
    else
        fm_domain_install_all "$LARAVEL_DIR"
        if [ "$FM_DOMAIN_INSTALL_READY" != "yes" ]; then
            echo "  Warning: Caddy domain install postcondition is incomplete (continuing)."
        fi
    fi

    echo "[$SCRIPT_INDEX] frankenphp plane: nginx/certbot phases skipped (Caddy ACME DNS-01 owns TLS, per-domain Caddy routes created)"
    # Site host truth: what is actually configured now.
    echo "[$SCRIPT_INDEX] site host: $(fm_site_host)"
    echo "[$SCRIPT_INDEX] DNS-01: $(fm_dns01_status)"
    echo "[$SCRIPT_INDEX] Caddy routes: $(ls -1 "$FM_DOMAIN_ROUTES_DIR"/*.caddy 2>/dev/null | wc -l | tr -d ' ') file(s) in $FM_DOMAIN_ROUTES_DIR"
    exit 0
fi

# --- runtime mode (default): runtime-only convergence + supervised launch --
# Site host: shared resolver (persisted region prefix + domain list; env
# FRANKENPHP_SITE_HOST still wins).
FRANKENPHP_SITE_HOST="${FRANKENPHP_SITE_HOST:-$(fm_site_host)}"

echo "Starting headless API runtime (frankenphp plane -> direct Caddy supervision on :${FRANKENPHP_HTTPS_PORT} h2/h3, Laravel Octane worker + Mercure hub at https://${FRANKENPHP_SITE_HOST}/.well-known/mercure)"

# Installation, custom-module builds and package cleanup are owned by step
# 93. Foreground launches use the same exact-variant runtime contract as the
# systemd launcher.
fm_runtime_converge
if [ -z "$FM_RUNTIME_BINARY" ]; then
    exit 1
fi

# Single supervised runtime process (canonical Caddyfile with
# literal Mercure keys, embedded hub - no sidecar process on this plane).
PORT="$PORT" PHP_BIN="$PHP_BIN" LARAVEL_DIR="$LARAVEL_DIR" \
    FRANKENPHP_SITE_HOST="$FRANKENPHP_SITE_HOST" \
    OCTANE_WATCH="$OCTANE_RUNTIME_WATCH" OCTANE_POLL="$OCTANE_RUNTIME_POLL" \
    exec /bin/bash "$LARAVEL_RUNTIME_FRANKENPHP_SCRIPT"
