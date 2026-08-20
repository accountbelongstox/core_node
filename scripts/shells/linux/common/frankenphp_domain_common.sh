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

# FrankenPHP plane domain setup library. The Caddy-native counterpart of
# domain_setup_common.sh (nginx plane): single source of truth for
#   - reading DNSPod secrets (shared with the nginx plane via the same
#     domain_setup_load_secrets / domain_setup_ensure_prefix /
#     domain_setup_persist_state primitives)
#   - idempotent per-domain Caddy route files (one file per domain under
#     the Caddy config dir, included by the main Caddyfile)
#   - the canonical Caddyfile (main server block + include directive)
#   - Caddy-managed DNS-01 ACME certificates (no certbot - Caddy is the
#     ACME client; the module + token gate is shared with the manager)
#
# Every managed domain gets one Caddy route file with two independent,
# contract-owned planes: api.${prefix}.${domain} proxies to Laravel, while
# the apex and UI aliases proxy to Nexus Dash. UI routing never depends on
# service readiness; an unavailable UI returns an upstream error instead of
# installing a cacheable redirect to the API plane.
# Content-hash idempotent via the shared write_file_if_changed.
#
# SYNC CONTRACT: Caddy route semantics are shared with the Laravel end
# (ServerManagerV1FrankenPhpManagerCtl); change both ends together.

FM_DOMAIN_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$FM_DOMAIN_COMMON_DIR/service_contract_common.sh"
# shellcheck source=/dev/null
source "$FM_DOMAIN_COMMON_DIR/gvar_common.sh"
# shellcheck source=/dev/null
source "$FM_DOMAIN_COMMON_DIR/domain_setup_common.sh"
# shellcheck source=/dev/null
source "$FM_DOMAIN_COMMON_DIR/frankenphp_manager.sh"

FM_DOMAIN_REPO_ROOT="$(cd "$FM_DOMAIN_COMMON_DIR/../../../.." && pwd)"
FM_DOMAIN_LARAVEL_DIR="${FM_DOMAIN_LARAVEL_DIR:-${FM_DOMAIN_REPO_ROOT}/poly_apps/laravel_main}"
FM_DOMAIN_CADDY_DIR="${FM_DOMAIN_LARAVEL_DIR}/storage/frankenphp"
FM_DOMAIN_CADDYFILE="${FM_DOMAIN_CADDY_DIR}/Caddyfile"
FM_DOMAIN_ROUTES_DIR="${FM_DOMAIN_CADDY_DIR}/routes"
FM_DOMAIN_BACKEND_URL="http://$(sc_require hosts.loopback):$(sc_require ports.laravel_api_backend)"
FM_DOMAIN_UI_BACKEND_URL="$(domain_ui_backend_url)"
FM_DOMAIN_UI_EARLY_HINTS_LINK="$(sc_require http.ui_early_hints_link)"
FM_DOMAIN_HTTP_PORT="$(sc_get ports.frankenphp_http)"
FM_DOMAIN_HTTPS_PORT="$(sc_get ports.frankenphp_https)"
FM_DOMAIN_MARKER="managed-by: frankenphp_domain_common"
FM_DOMAIN_UI_BINDING_READY="no"
FM_DOMAIN_CADDY_RELOAD_READY="no"
FM_DOMAIN_ROUTES_READY="no"
FM_DOMAIN_ROUTE_FILE_READY="no"
FM_DOMAIN_INSTALL_READY="no"
FM_DOMAIN_CERTIFICATES_READY="no"

# Ensure the Caddy routes directory exists (lazy sudo, symlink-aware).
fm_domain_ensure_routes_dir() {
    local sudo_cmd

    FM_DOMAIN_ROUTES_READY="no"
    sudo_cmd=$(lazy_sudo)
    if [ ! -d "$FM_DOMAIN_ROUTES_DIR" ]; then
        if [ -e "$FM_DOMAIN_ROUTES_DIR" ] || [ -L "$FM_DOMAIN_ROUTES_DIR" ]; then
            $sudo_cmd rm -f "$FM_DOMAIN_ROUTES_DIR"
        fi
        $sudo_cmd mkdir -p "$FM_DOMAIN_ROUTES_DIR"
    fi
    if [ -d "$FM_DOMAIN_ROUTES_DIR" ]; then
        FM_DOMAIN_ROUTES_READY="yes"
        return
    fi
    echo "[fm-domain] [FAIL] routes directory could not be ensured: $FM_DOMAIN_ROUTES_DIR"
}

# Render ONE Caddy route file for a domain. The API host always maps to the
# Laravel backend. Apex, www, regional, and regional-www hosts always map to
# the UI backend. TLS is rendered only when a prebuilt certificate or the
# DNSPod module gate is ready; otherwise Caddy built-in ACME remains active.
# Usage: fm_domain_render_route <domain> <prefix>
fm_domain_render_route() {
    local domain="$1"
    local prefix="$2"
    local api_host="api.${prefix}.${domain}"
    local dnspod_tls=""
    local acme_tls=""
    local tls_directive=""
    local acme_cert_dir=""
    local ui_addresses=""
    local api_http_address=""
    local ui_http_addresses=""
    local api_handlers=""
    local ui_handlers=""

    # Prebuilt-cert gate FIRST (acme.sh DNS-01 certificates on disk are
    # pinned explicitly); the dnspod module stanza is the fallback.
    acme_cert_dir="$(fm_acme_cert_dir_for_host "$api_host")"
    if [ -n "$acme_cert_dir" ] \
        && [ -f "${acme_cert_dir}/fullchain.pem" ] \
        && [ -f "${acme_cert_dir}/key.pem" ]; then
        acme_tls="tls ${acme_cert_dir}/fullchain.pem ${acme_cert_dir}/key.pem"
    fi

    # DNS-01 fallback gate: identical to fm_caddyfile_ensure
    if [ -z "$acme_tls" ] \
        && [ "$(fm_has_module "$FRANKENPHP_DNSPOD_MODULE")" = "yes" ] \
        && [ -n "$(fm_dnspod_token_value)" ]; then
        dnspod_tls="tls {
		dns dnspod {env.${FRANKENPHP_DNSPOD_TOKEN_KEY}}
	}"
    fi

    # Single tls directive line - omitted entirely when both gates are off
    # (a bare tab line would not survive caddy fmt).
    tls_directive=""
    if [ -n "$acme_tls" ]; then
        tls_directive="	${acme_tls}
"
    elif [ -n "$dnspod_tls" ]; then
        tls_directive="	${dnspod_tls}
"
    fi

    ui_addresses="${domain}:${FM_DOMAIN_HTTPS_PORT}, www.${domain}:${FM_DOMAIN_HTTPS_PORT}, ${prefix}.${domain}:${FM_DOMAIN_HTTPS_PORT}, www.${prefix}.${domain}:${FM_DOMAIN_HTTPS_PORT}"
    api_http_address="http://${api_host}:${FM_DOMAIN_HTTP_PORT}"
    ui_http_addresses="http://${domain}:${FM_DOMAIN_HTTP_PORT}, http://www.${domain}:${FM_DOMAIN_HTTP_PORT}, http://${prefix}.${domain}:${FM_DOMAIN_HTTP_PORT}, http://www.${prefix}.${domain}:${FM_DOMAIN_HTTP_PORT}"
    api_handlers="$(fm_caddy_reverse_proxy_handlers_render "$FM_DOMAIN_BACKEND_URL")"
    ui_handlers="$(fm_caddy_reverse_proxy_handlers_render "$FM_DOMAIN_UI_BACKEND_URL" "$FM_DOMAIN_UI_EARLY_HINTS_LINK")"
    cat <<EOF
# ${FM_DOMAIN_MARKER} domain=${domain} prefix=${prefix}

${api_host}:${FM_DOMAIN_HTTPS_PORT} {
${tls_directive}${api_handlers}
}

${ui_addresses} {
${tls_directive}${ui_handlers}
}

${api_http_address} {
${api_handlers}
}

${ui_http_addresses} {
${ui_handlers}
}
EOF
}

# Log the same two-plane topology rendered above. Keeping this in the shared
# domain library prevents callers from presenting the legacy apex-to-API
# redirect as the active route.
fm_domain_log_route_topology() {
    local domain="$1"
    local prefix="$2"
    local indentation="${3:-}"
    local api_host="api.${prefix}.${domain}"
    local ui_hosts="${domain}, www.${domain}, ${prefix}.${domain}, www.${prefix}.${domain}"

    echo "[fm-domain] ${indentation}API: ${api_host} -> ${FM_DOMAIN_BACKEND_URL}"
    echo "[fm-domain] ${indentation}UI: ${ui_hosts} -> ${FM_DOMAIN_UI_BACKEND_URL}"
}

# Enable and render the dashboard aliases on the FrankenPHP plane. Shared
# state/allowed-host inputs stay owned by domain_setup_common; this function
# owns only Caddy route convergence and the zero-downtime admin load.
fm_domain_enable_ui_binding() {
    local domain=""
    local prefix=""
    local route_drift="no"
    local admin_port=""
    local reload_code=""

    FM_DOMAIN_UI_BINDING_READY="no"
    FM_DOMAIN_CADDY_RELOAD_READY="no"
    domain_setup_prepare_ui_binding
    if [ "$DOMAIN_UI_BINDING_READY" != "yes" ]; then
        echo "[fm-domain] [FAIL] Shared UI binding state is not ready"
        return
    fi

    prefix="$DOMAIN_API_PREFIX"
    echo "[fm-domain] UI routes: <domain>, www.<domain>, ${prefix}.<domain>, www.${prefix}.<domain> -> ${FM_DOMAIN_UI_BACKEND_URL}"
    while IFS= read -r domain; do
        [ -z "$domain" ] && continue
        fm_domain_ensure_route_file "$domain" "$prefix"
        if [ "$FM_DOMAIN_ROUTE_FILE_READY" != "yes" ]; then
            route_drift="yes"
        fi
    done <<< "$DOMAIN_DOMAINS_LIST"

    admin_port="$(sc_require ports.frankenphp_admin)"
    fm_domain_ensure_main_caddyfile "$admin_port" "${FM_DOMAIN_LARAVEL_DIR}/public"
    if [ "$route_drift" = "no" ] && [ "$FM_CADDYFILE_READY" = "yes" ]; then
        FM_DOMAIN_UI_BINDING_READY="yes"
    fi

    if command -v curl >/dev/null 2>&1 && [ -f "$FM_DOMAIN_CADDYFILE" ]; then
        reload_code="$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
            -H 'Content-Type: text/caddyfile' --data-binary "@${FM_DOMAIN_CADDYFILE}" \
            "http://127.0.0.1:${admin_port}/load" 2>/dev/null)"
    fi
    if [ "$reload_code" = "200" ]; then
        FM_DOMAIN_CADDY_RELOAD_READY="yes"
        echo "[fm-domain] [OK] Caddy loaded the UI routes"
    else
        echo "[fm-domain] [INFO] Caddy load deferred; the supervised runtime will read the canonical files at start"
    fi
}

# Idempotently write ONE domain's Caddy route file. Content-hash idempotent
# via write_file_if_changed.
fm_domain_ensure_route_file() {
    local domain="$1"
    local prefix="$2"
    local route_file="${FM_DOMAIN_ROUTES_DIR}/${domain}.caddy"
    local rendered=""
    local existing=""

    FM_DOMAIN_ROUTE_FILE_READY="no"
    fm_domain_ensure_routes_dir
    if [ "$FM_DOMAIN_ROUTES_READY" != "yes" ]; then
        echo "[fm-domain] [FAIL] Route file deferred because the routes directory is unavailable: $route_file"
        return
    fi

    rendered="$(fm_domain_render_route "$domain" "$prefix")"
    echo "$rendered" | write_file_if_changed "$route_file"
    if [ -f "$route_file" ]; then
        existing="$(cat "$route_file")"
    fi
    if [ "$existing" = "$rendered" ]; then
        FM_DOMAIN_ROUTE_FILE_READY="yes"
        echo "[fm-domain] [OK] Route file: $route_file"
        fm_domain_log_route_topology "$domain" "$prefix" "    "
    else
        echo "[fm-domain] [FAIL] Route file postcondition failed: $route_file"
    fi
}

# Render the canonical main Caddyfile through the manager-owned renderer.
fm_domain_render_main_caddyfile() {
    local admin_port="${1:-$(sc_get ports.frankenphp_admin)}"
    local laravel_public="${2:-${FM_DOMAIN_LARAVEL_DIR}/public}"

    fm_caddyfile_render "$laravel_public" "$FM_DOMAIN_HTTPS_PORT" "$admin_port" "$FM_DOMAIN_CADDYFILE"
    printf '%s\n' "$FM_CADDYFILE_RENDERED"
}

# Ensure the main Caddyfile is canonical (content-hash idempotent).
fm_domain_ensure_main_caddyfile() {
    local admin_port="${1:-$(sc_get ports.frankenphp_admin)}"
    local laravel_public="${2:-${FM_DOMAIN_LARAVEL_DIR}/public}"

    fm_domain_ensure_routes_dir
    if [ "$FM_DOMAIN_ROUTES_READY" != "yes" ]; then
        echo "[fm-domain] [FAIL] Main Caddyfile deferred because the routes directory is unavailable"
        return
    fi

    fm_caddyfile_ensure "$laravel_public" "$FM_DOMAIN_HTTPS_PORT" "$admin_port" "$FM_DOMAIN_CADDYFILE"
    if [ "$FM_CADDYFILE_READY" != "yes" ]; then
        echo "[fm-domain] [FAIL] Main Caddyfile convergence failed"
    fi
}

# Clean up stale route files for domains that are no longer in the secrets
# list (e.g. a domain was removed from DOMAINS_LISTS). The managed marker
# prevents accidental deletion of user-created files.
fm_domain_cleanup_stale_routes() {
    local domains_list="$1"
    local route_file=""
    local domain=""
    local found=""
    local candidate_domain=""

    if [ -d "$FM_DOMAIN_ROUTES_DIR" ]; then
        for route_file in "$FM_DOMAIN_ROUTES_DIR"/*.caddy; do
            [ -f "$route_file" ] || continue
            if ! grep -q "$FM_DOMAIN_MARKER" "$route_file" 2>/dev/null; then
                continue
            fi
            domain="$(basename "$route_file" .caddy)"
            found=""
            while IFS= read -r candidate_domain; do
                [ -z "$candidate_domain" ] && continue
                if [ "$candidate_domain" = "$domain" ]; then
                    found="yes"
                    break
                fi
            done <<< "$domains_list"
            if [ -z "$found" ]; then
                rm -f "$route_file"
                echo "[fm-domain] [OK] Removed stale route: $domain (no longer in secrets)"
            fi
        done
    fi
}

# Full idempotent frankenphp domain installation: secrets -> prefix ->
# per-domain route files -> main Caddyfile -> DNS-01 readiness.
# Mirrors domain_setup_install_all but for the Caddy-native plane:
#   - no nginx (Caddy is the TLS terminator and reverse proxy)
#   - no certbot (Caddy ACME DNS-01 issues wildcard certificates)
#   - the backend URL is the SAME laravel_api_backend contract
# Usage: fm_domain_install_all [laravel_dir]
fm_domain_install_all() {
    local laravel_dir="${1:-$FM_DOMAIN_LARAVEL_DIR}"
    local domain=""
    local prefix=""
    local failures=0

    FM_DOMAIN_INSTALL_READY="no"
    domain_setup_load_secrets
    if [ -z "$DOMAIN_DNSPOD_EMAIL" ] || [ -z "$DOMAIN_DNSPOD_TOKEN" ] || [ -z "$DOMAIN_DOMAINS_LIST" ]; then
        echo "[fm-domain] [WARN] Domain installation deferred because the secret postcondition is incomplete"
        return
    fi
    domain_setup_ensure_prefix
    if [ -z "$DOMAIN_API_PREFIX" ]; then
        echo "[fm-domain] [WARN] Domain installation deferred because the API prefix postcondition is incomplete"
        return
    fi
    domain_setup_persist_state

    prefix="$(domain_state_get "$DOMAIN_API_PREFIX_KEY" "si")"
    if [ -z "$prefix" ]; then
        echo "[fm-domain] [WARN] Domain installation deferred because the persisted API prefix is empty"
        return
    fi

    echo "[fm-domain] Installing domain route topology (Caddy + DNS-01 ACME, no nginx/certbot):"
    while IFS= read -r domain; do
        [ -n "$domain" ] && fm_domain_log_route_topology "$domain" "$prefix" "  - "
    done <<< "$DOMAIN_DOMAINS_LIST"

    # Mirror the DNSPod token into the runtime store (Caddyfile env-read).
    fm_dnspod_token_ensure

    while IFS= read -r domain; do
        [ -z "$domain" ] && continue
        fm_domain_ensure_route_file "$domain" "$prefix"
        if [ "$FM_DOMAIN_ROUTE_FILE_READY" != "yes" ]; then
            failures=$((failures + 1))
        fi
    done <<< "$DOMAIN_DOMAINS_LIST"

    fm_domain_cleanup_stale_routes "$DOMAIN_DOMAINS_LIST"

    # The main Caddyfile owns only the internal TLS site. Public API and UI
    # hosts remain exclusively owned by the per-domain route files above.
    fm_domain_ensure_main_caddyfile "$(sc_get ports.frankenphp_admin)" "${laravel_dir}/public"
    if [ "$FM_CADDYFILE_READY" != "yes" ]; then
        failures=$((failures + 1))
    fi

    # DNS-01 readiness (module + token; Caddy issues wildcard at launch)
    fm_dns01_ensure

    if [ $failures -eq 0 ]; then
        FM_DOMAIN_INSTALL_READY="yes"
        echo "[fm-domain] [OK] All domains installed (Caddy-native, DNS-01 ACME, no nginx/certbot)"
        return
    fi
    echo "[fm-domain] [WARN] Domain installation completed with $failures warning(s)"
}

# Certificates only (the frankenphp plane equivalent of
# domain_setup_certificates_only): DNS-01 readiness convergence.
# Caddy issues/renews at runtime; the shell end ensures the module +
# token pair are in place.
fm_domain_certificates_only() {
    FM_DOMAIN_CERTIFICATES_READY="no"
    domain_setup_load_secrets
    if [ -z "$DOMAIN_DNSPOD_EMAIL" ] || [ -z "$DOMAIN_DNSPOD_TOKEN" ] || [ -z "$DOMAIN_DOMAINS_LIST" ]; then
        echo "[fm-domain] [WARN] Certificate convergence deferred because the secret postcondition is incomplete"
        return
    fi
    domain_setup_ensure_prefix
    if [ -z "$DOMAIN_API_PREFIX" ]; then
        echo "[fm-domain] [WARN] Certificate convergence deferred because the API prefix postcondition is incomplete"
        return
    fi
    domain_setup_persist_state
    fm_dnspod_token_ensure
    fm_dns01_ensure
    FM_DOMAIN_CERTIFICATES_READY="yes"
    echo "[fm-domain] [OK] DNS-01 readiness converged (Caddy issues/renews wildcard at launch)"
}
