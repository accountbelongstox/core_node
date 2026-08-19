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
#   - Caddy-managed DNS-01 ACME certificates (no certbot — Caddy is the
#     ACME client; the module + token gate is shared with the manager)
#
# Every managed domain gets a Caddy route file that reverse-proxies to the
# Laravel API backend (service contract ports.laravel_api_backend on
# loopback) — the same contract the nginx plane sites use. Apex and www
# variants redirect to the canonical api.${prefix}.${domain} host.
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
FM_DOMAIN_HTTPS_PORT="$(sc_get ports.frankenphp_https)"
FM_DOMAIN_MARKER="managed-by: frankenphp_domain_common"

# Ensure the Caddy routes directory exists (lazy sudo, symlink-aware).
fm_domain_ensure_routes_dir() {
    local sudo_cmd
    sudo_cmd=$(lazy_sudo)
    if [ ! -d "$FM_DOMAIN_ROUTES_DIR" ]; then
        if [ -e "$FM_DOMAIN_ROUTES_DIR" ] || [ -L "$FM_DOMAIN_ROUTES_DIR" ]; then
            $sudo_cmd rm -f "$FM_DOMAIN_ROUTES_DIR"
        fi
        $sudo_cmd mkdir -p "$FM_DOMAIN_ROUTES_DIR"
    fi
    if [ -d "$FM_DOMAIN_ROUTES_DIR" ]; then
        return 0
    fi
    echo "[fm-domain] [FAIL] routes directory could not be ensured: $FM_DOMAIN_ROUTES_DIR"
    return 1
}

# Render ONE Caddy route file for a domain. Maps api.${prefix}.${domain}
# (reverse proxy → backend), ${domain} (apex, 301 → api host), and
# www.${domain} (301 → api host). The tls stanza is rendered ONLY when
# the dnspod module + token both hold (DNS-01); otherwise Caddy built-in
# ACME (HTTP-01/TLS-ALPN-01) stays in charge.
# Usage: fm_domain_render_route <domain> <prefix>
fm_domain_render_route() {
    local domain="$1"
    local prefix="$2"
    local api_host="api.${prefix}.${domain}"
    local dnspod_tls=""
    local acme_tls=""
    local acme_cert_dir=""

    # DNS-01 gate: identical to fm_caddyfile_ensure
    if [ "$(fm_has_module "$FRANKENPHP_DNSPOD_MODULE")" = "yes" ] \
        && [ -n "$(fm_dnspod_token_value)" ]; then
        dnspod_tls="tls {
			dns dnspod {env.${FRANKENPHP_DNSPOD_TOKEN_KEY}}
		}"
    fi

    # Prebuilt variant gate: acme.sh certs on disk
    if [ -z "$dnspod_tls" ]; then
        acme_cert_dir="$(fm_acme_cert_dir_for_host "$api_host")"
        if [ -n "$acme_cert_dir" ] \
            && [ -f "${acme_cert_dir}/fullchain.pem" ] \
            && [ -f "${acme_cert_dir}/key.pem" ]; then
            acme_tls="tls ${acme_cert_dir}/fullchain.pem ${acme_cert_dir}/key.pem"
        fi
    fi

    cat <<EOF
# ${FM_DOMAIN_MARKER} domain=${domain} prefix=${prefix}

${api_host}:${FM_DOMAIN_HTTPS_PORT} {
	${dnspod_tls}${acme_tls}
	reverse_proxy ${FM_DOMAIN_BACKEND_URL}
}

${domain}:${FM_DOMAIN_HTTPS_PORT} {
	redir https://${api_host}{uri} permanent
}

www.${domain}:${FM_DOMAIN_HTTPS_PORT} {
	redir https://${api_host}{uri} permanent
}
EOF
}

# Idempotently write ONE domain's Caddy route file. Content-hash idempotent
# via write_file_if_changed.
fm_domain_ensure_route_file() {
    local domain="$1"
    local prefix="$2"
    local route_file="${FM_DOMAIN_ROUTES_DIR}/${domain}.caddy"
    local rendered=""

    fm_domain_ensure_routes_dir || return 1

    rendered="$(fm_domain_render_route "$domain" "$prefix")"
    echo "$rendered" | write_file_if_changed "$route_file"
    echo "[fm-domain] [OK] Route file: $route_file (${domain} -> api.${prefix}.${domain} -> ${FM_DOMAIN_BACKEND_URL})"
    return 0
}

# Render the canonical main Caddyfile that includes all per-domain route
# files plus the Mercure hub + php_server. The admin block and global
# options are shared; per-domain routes are imported via the Caddy
# `import` directive. Content-hash idempotent.
fm_domain_render_main_caddyfile() {
    local admin_port="${1:-$(sc_get ports.frankenphp_admin)}"
    local site_host="${2:-$(fm_site_host)}"
    local laravel_public="${3:-${FM_DOMAIN_LARAVEL_DIR}/public}"
    local dnspod_tls=""
    local acme_tls=""
    local acme_cert_dir=""

    # DNS-01 gate for the main server block (wildcard applies to the
    # primary site_host; per-domain routes carry their own tls stanza).
    if [ "$(fm_has_module "$FRANKENPHP_DNSPOD_MODULE")" = "yes" ] \
        && [ -n "$(fm_dnspod_token_value)" ]; then
        dnspod_tls="	tls {
		dns dnspod {env.${FRANKENPHP_DNSPOD_TOKEN_KEY}}
	}

"
    fi

    if [ -z "$dnspod_tls" ]; then
        acme_cert_dir="$(fm_acme_cert_dir_for_host "$site_host")"
        if [ -n "$acme_cert_dir" ] \
            && [ -f "${acme_cert_dir}/fullchain.pem" ] \
            && [ -f "${acme_cert_dir}/key.pem" ]; then
            acme_tls="	tls ${acme_cert_dir}/fullchain.pem ${acme_cert_dir}/key.pem

"
        fi
    fi

    cat <<EOF
# ${FM_DOMAIN_MARKER} main Caddyfile
{
	admin localhost:${admin_port}
	auto_https disable_redirects
}

# Primary site host (Mercure hub + php_server for the default app)
https://${site_host}:${FM_DOMAIN_HTTPS_PORT} {
	root * ${laravel_public}
	encode zstd gzip

${dnspod_tls}${acme_tls}	mercure {
		issuer {env.MERCURE_TRUSTED_ISSUERS} {
			publisher {
				jwt {env.MERCURE_PUBLISHER_JWT_KEY} {env.MERCURE_PUBLISHER_JWT_ALG}
			}
			subscriber {
				jwt {env.MERCURE_SUBSCRIBER_JWT_KEY} {env.MERCURE_SUBSCRIBER_JWT_ALG}
			}
		}
	}

	php_server
	file_server
}

# Per-domain route files (managed by fm_domain_ensure_route_file)
import ${FM_DOMAIN_ROUTES_DIR}/*
EOF
}

# Ensure the main Caddyfile is canonical (content-hash idempotent).
fm_domain_ensure_main_caddyfile() {
    local admin_port="${1:-$(sc_get ports.frankenphp_admin)}"
    local site_host="${2:-$(fm_site_host)}"
    local laravel_public="${3:-${FM_DOMAIN_LARAVEL_DIR}/public}"
    local rendered=""

    fm_domain_ensure_routes_dir || return 1

    rendered="$(fm_domain_render_main_caddyfile "$admin_port" "$site_host" "$laravel_public")"
    echo "$rendered" | write_file_if_changed "$FM_DOMAIN_CADDYFILE"
    echo "[fm-domain] [OK] Main Caddyfile: $FM_DOMAIN_CADDYFILE"
    return 0
}

# Clean up stale route files for domains that are no longer in the secrets
# list (e.g. a domain was removed from DOMAINS_LISTS). The managed marker
# prevents accidental deletion of user-created files.
fm_domain_cleanup_stale_routes() {
    local domains_list="$1"
    local route_file=""
    local domain=""
    local found=""

    [ -d "$FM_DOMAIN_ROUTES_DIR" ] || return 0

    for route_file in "$FM_DOMAIN_ROUTES_DIR"/*.caddy; do
        [ -f "$route_file" ] || continue
        if ! grep -q "$FM_DOMAIN_MARKER" "$route_file" 2>/dev/null; then
            continue
        fi
        domain="$(basename "$route_file" .caddy)"
        found=""
        while IFS= read -r d; do
            [ -z "$d" ] && continue
            if [ "$d" = "$domain" ]; then
                found="yes"
                break
            fi
        done <<< "$domains_list"
        if [ -z "$found" ]; then
            rm -f "$route_file"
            echo "[fm-domain] [OK] Removed stale route: $domain (no longer in secrets)"
        fi
    done
    return 0
}

# Full idempotent frankenphp domain installation: secrets → prefix →
# per-domain route files → main Caddyfile → DNS-01 readiness.
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

    domain_setup_load_secrets || return 1
    domain_setup_ensure_prefix || return 1
    domain_setup_persist_state || true

    prefix="$(domain_state_get "$DOMAIN_API_PREFIX_KEY" "si")"

    echo "[fm-domain] Installing domains (Caddy routes, DNS-01 ACME via Caddy, no nginx/certbot):"
    while IFS= read -r domain; do
        [ -n "$domain" ] && echo "[fm-domain]   - ${domain} -> api.${prefix}.${domain}"
    done <<< "$DOMAIN_DOMAINS_LIST"

    # Mirror the DNSPod token into the runtime store (Caddyfile env-read).
    fm_dnspod_token_ensure

    while IFS= read -r domain; do
        [ -z "$domain" ] && continue
        fm_domain_ensure_route_file "$domain" "$prefix" || failures=$((failures + 1))
    done <<< "$DOMAIN_DOMAINS_LIST"

    fm_domain_cleanup_stale_routes "$DOMAIN_DOMAINS_LIST"

    # Main Caddyfile: site host = first api.${prefix}.${domain}
    local site_host=""
    site_host="$(fm_site_host)"
    fm_domain_ensure_main_caddyfile "$(sc_get ports.frankenphp_admin)" "$site_host" "${laravel_dir}/public" \
        || failures=$((failures + 1))

    # DNS-01 readiness (module + token; Caddy issues wildcard at launch)
    fm_dns01_ensure

    if [ $failures -eq 0 ]; then
        echo "[fm-domain] [OK] All domains installed (Caddy-native, DNS-01 ACME, no nginx/certbot)"
        return 0
    fi
    echo "[fm-domain] [WARN] Domain installation completed with $failures warning(s)"
    return 1
}

# Certificates only (the frankenphp plane equivalent of
# domain_setup_certificates_only): DNS-01 readiness convergence.
# Caddy issues/renews at runtime; the shell end ensures the module +
# token pair are in place.
fm_domain_certificates_only() {
    domain_setup_load_secrets || return 1
    domain_setup_ensure_prefix || return 1
    domain_setup_persist_state || true
    fm_dnspod_token_ensure
    fm_dns01_ensure
    echo "[fm-domain] [OK] DNS-01 readiness converged (Caddy issues/renews wildcard at launch)"
    return 0
}