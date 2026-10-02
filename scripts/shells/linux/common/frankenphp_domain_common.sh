#!/bin/bash

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
FM_DOMAIN_API_EARLY_HINTS_LINK="$(sc_require http.api_early_hints_link)"
FM_DOMAIN_UI_EARLY_HINTS_LINK="$(sc_require http.ui_early_hints_link)"
FM_DOMAIN_HTTP_PORT="$(sc_get ports.frankenphp_http)"
FM_DOMAIN_HTTPS_PORT="$(sc_get ports.frankenphp_https)"
# Laravel main on the tailnet under the UI site's trusted tailscale cert:
# https://<machine>.<tailnet>.ts.net<api_path> (tailscale cert never covers
# api.<machine>, and no extra port is opened).
FM_DOMAIN_TAILNET_API_PATH="$(sc_get access.tailnet.api_path)"
# Loopback-only pycore on the tailnet: https://<machine>.<tailnet>.ts.net<pycore_path>.
FM_DOMAIN_TAILNET_PYCORE_PATH="$(sc_get access.tailnet.pycore_path)"
FM_DOMAIN_PYCORE_BACKEND_URL="http://$(sc_require hosts.loopback):$(sc_require ports.pycore_backend)"
FM_DOMAIN_MARKER="managed-by: frankenphp_domain_common"
FM_DOMAIN_UI_BINDING_READY="no"
FM_DOMAIN_CADDY_RELOAD_READY="no"
FM_DOMAIN_ROUTES_READY="no"
FM_DOMAIN_ROUTE_FILE_READY="no"
FM_DOMAIN_INSTALL_READY="no"
FM_DOMAIN_CERTIFICATES_READY="no"
FM_DOMAIN_LAN_SITE_READY="no"
FM_DOMAIN_LAN_RENDERED=""
FM_DOMAIN_TAILNET_ACTIVE="no"
# Live-apply contract: the plane service unit the reload/restart fallback
# owns, plus the bounded /load retry window (tolerates transient admin
# endpoint blips such as a worker-restart window).
FM_DOMAIN_SERVICE_UNIT="${FM_DOMAIN_SERVICE_UNIT:-ncore-laravel-frankenphp}"
FM_DOMAIN_CADDY_APPLY_ATTEMPTS="${FM_DOMAIN_CADDY_APPLY_ATTEMPTS:-3}"
FM_DOMAIN_CADDY_APPLY_RETRY_DELAY_SECONDS="${FM_DOMAIN_CADDY_APPLY_RETRY_DELAY_SECONDS:-2}"
FM_DOMAIN_CADDY_RELOAD_CODE=""
FM_DOMAIN_CADDY_APPLY_ATTEMPT=""
FM_DOMAIN_CADDY_RELOAD_OUTCOME=""
# Disruption budget: a running unit is restarted only when it is provably
# wedged - past the startup grace window (the runtime pre-flight may take
# minutes) and unresponsive on BOTH the admin endpoint and the backend for
# FM_DOMAIN_WEDGE_PROBES consecutive probes.
FM_DOMAIN_UNIT_STARTUP_GRACE_SECONDS="${FM_DOMAIN_UNIT_STARTUP_GRACE_SECONDS:-180}"
FM_DOMAIN_WEDGE_PROBES="${FM_DOMAIN_WEDGE_PROBES:-3}"
FM_DOMAIN_WEDGE_PROBE_DELAY_SECONDS="${FM_DOMAIN_WEDGE_PROBE_DELAY_SECONDS:-5}"
FM_DOMAIN_UNIT_WEDGED="no"
FM_DOMAIN_WORKERS_RESTART_CODE=""
FM_DOMAIN_CODE_CHANGED="no"
FM_DOMAIN_WORKERS_RESTARTED_AT_KEY="LARAVEL_WORKERS_RESTARTED_AT"

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

# Single tls-directive gate for one host (no trailing newline): the prebuilt
# acme.sh DNS-01 certificate pinned explicitly when on disk, else the dnspod
# module stanza when module + token are ready, else nothing (callers omit the
# line; a bare tab line would not survive caddy fmt).
# Usage: fm_domain_tls_directive_for_host <host>
fm_domain_tls_directive_for_host() {
    local host="$1"
    local acme_cert_dir=""

    acme_cert_dir="$(fm_acme_cert_dir_for_host "$host")"
    if [ -n "$acme_cert_dir" ] \
        && [ -f "${acme_cert_dir}/fullchain.pem" ] \
        && [ -f "${acme_cert_dir}/key.pem" ]; then
        printf '\ttls %s/fullchain.pem %s/key.pem' "$acme_cert_dir" "$acme_cert_dir"
        return 0
    fi
    if [ "$(fm_has_module "$FRANKENPHP_DNSPOD_MODULE")" = "yes" ] \
        && [ -n "$(fm_dnspod_token_value)" ]; then
        printf '\ttls {\n\t\tdns dnspod {env.%s}\n\t}' "$FRANKENPHP_DNSPOD_TOKEN_KEY"
    fi
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
    local tls_directive=""
    local ui_addresses=""
    local api_http_address=""
    local ui_http_addresses=""
    local api_handlers=""
    local ui_handlers=""
    local api_http_redirect=""
    local ui_http_redirect=""

    tls_directive="$(fm_domain_tls_directive_for_host "$api_host")"
    if [ -n "$tls_directive" ]; then
        tls_directive="${tls_directive}
"
    fi

    ui_addresses="${domain}:${FM_DOMAIN_HTTPS_PORT}, www.${domain}:${FM_DOMAIN_HTTPS_PORT}, ${prefix}.${domain}:${FM_DOMAIN_HTTPS_PORT}, www.${prefix}.${domain}:${FM_DOMAIN_HTTPS_PORT}"
    api_http_address="http://${api_host}:${FM_DOMAIN_HTTP_PORT}"
    ui_http_addresses="http://${domain}:${FM_DOMAIN_HTTP_PORT}, http://www.${domain}:${FM_DOMAIN_HTTP_PORT}, http://${prefix}.${domain}:${FM_DOMAIN_HTTP_PORT}, http://www.${prefix}.${domain}:${FM_DOMAIN_HTTP_PORT}"
    api_handlers="$(fm_caddy_reverse_proxy_handlers_render "$FM_DOMAIN_BACKEND_URL" "$FM_DOMAIN_API_EARLY_HINTS_LINK")"
    ui_handlers="$(fm_caddy_reverse_proxy_handlers_render "$FM_DOMAIN_UI_BACKEND_URL" "$FM_DOMAIN_UI_EARLY_HINTS_LINK")"
    api_http_redirect="redir https://${api_host}{uri} permanent"
    ui_http_redirect="redir https://{host}{uri} permanent"
    cat <<EOF
# ${FM_DOMAIN_MARKER} domain=${domain} prefix=${prefix}

${api_host}:${FM_DOMAIN_HTTPS_PORT} {
${tls_directive}${api_handlers}
}

${ui_addresses} {
${tls_directive}${ui_handlers}
}

${api_http_address} {
${api_http_redirect}
}

${ui_http_addresses} {
${ui_http_redirect}
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

# Append one restart record to the shared service action log (same file and
# format as systemd_service_manager log_service_action) so every restart
# carries its reason even after the journal is vacuumed.
fm_domain_restart_ledger() {
    local unit="$1"
    local reason="$2"
    local log_dir=""

    logger -t ncore-service-converge "restart ${unit}: ${reason}" 2>/dev/null || true
    log_dir="$(map_web_path "www" "services_log" 2>/dev/null)"
    if [ -n "$log_dir" ] && [ -d "$log_dir" ]; then
        printf '[%s] RESTART: %s -> %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$unit" "$reason" >> "$log_dir/ncore_service_actions.log" 2>/dev/null || true
    fi
}

# The ONLY unit restart in the live-apply path; always ledgered with a reason.
fm_domain_unit_restart() {
    local unit="$1"
    local reason="$2"
    local sudo_cmd=""

    sudo_cmd=$(lazy_sudo)
    echo "[fm-domain] [INFO] restarting ${unit}: ${reason}"
    fm_domain_restart_ledger "$unit" "$reason"
    $sudo_cmd systemctl restart "$unit"
}

# Epoch (seconds) of the plane unit's last activation, derived from the
# monotonic activation stamp (immune to tz-abbreviation parsing); empty when
# unknown.
fm_domain_unit_start_epoch() {
    local mono=""
    local uptime_seconds=""

    mono="$(systemctl show -p ActiveEnterTimestampMonotonic --value "$FM_DOMAIN_SERVICE_UNIT" 2>/dev/null)"
    uptime_seconds="$(cut -d. -f1 /proc/uptime 2>/dev/null)"
    case "$mono" in ''|*[!0-9]*|0) return ;; esac
    case "$uptime_seconds" in ''|*[!0-9]*) return ;; esac
    echo $(( $(date +%s) - uptime_seconds + mono / 1000000 ))
}

# Sets FM_DOMAIN_UNIT_WEDGED=yes only for a unit that is past its startup
# grace window and unresponsive on both the admin endpoint and the backend for
# every probe; a booting or merely slow unit is never treated as hung.
fm_domain_unit_wedged() {
    local unit_start=""
    local age=""
    local probe=1
    local admin_code=""
    local backend_code=""
    local admin_port=""

    FM_DOMAIN_UNIT_WEDGED="no"
    unit_start="$(fm_domain_unit_start_epoch)"
    if [ -z "$unit_start" ]; then
        return
    fi
    age=$(( $(date +%s) - unit_start ))
    if [ "$age" -lt "$FM_DOMAIN_UNIT_STARTUP_GRACE_SECONDS" ]; then
        echo "[fm-domain] [INFO] ${FM_DOMAIN_SERVICE_UNIT} started ${age}s ago (startup grace ${FM_DOMAIN_UNIT_STARTUP_GRACE_SECONDS}s): a missing admin endpoint is not a hang"
        return
    fi
    admin_port="$(sc_require ports.frankenphp_admin)"
    while [ "$probe" -le "$FM_DOMAIN_WEDGE_PROBES" ]; do
        admin_code="$(curl -sS -m 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:${admin_port}/config/" 2>/dev/null)"
        backend_code="$(curl -sS -m 10 -o /dev/null -w '%{http_code}' "${FM_DOMAIN_BACKEND_URL}/" 2>/dev/null)"
        if { [ -n "$admin_code" ] && [ "$admin_code" != "000" ]; } || { [ -n "$backend_code" ] && [ "$backend_code" != "000" ]; }; then
            return
        fi
        probe=$((probe + 1))
        if [ "$probe" -le "$FM_DOMAIN_WEDGE_PROBES" ]; then
            sleep "$FM_DOMAIN_WEDGE_PROBE_DELAY_SECONDS"
        fi
    done
    FM_DOMAIN_UNIT_WEDGED="yes"
}

# Apply the converged Caddy configuration to the live plane through the
# official admin API (zero downtime, transactional: a rejected configuration
# leaves the running server untouched). The outcome decides the next step -
# a restart is NEVER the response to a rejected configuration (the restart
# would read the same invalid files and crash-loop the plane):
#   applied     200        -> snapshot as last-known-good
#   rejected    HTTP 4xx   -> roll the files back to last-known-good
#   restarted   no reply   -> only for a unit proven wedged (fm_domain_unit_wedged)
#   deferred    no reply   -> unit booting/serving: the next start reads the files
# FM_DOMAIN_CADDY_RELOAD_READY is "yes" only when the live server provably
# serves the converged files.
fm_domain_caddy_apply_converged() {
    FM_DOMAIN_CADDY_RELOAD_READY="no"
    FM_DOMAIN_CADDY_RELOAD_CODE=""
    FM_DOMAIN_CADDY_RELOAD_OUTCOME="deferred"
    if command -v curl >/dev/null 2>&1 && [ -f "$FM_DOMAIN_CADDYFILE" ]; then
        FM_DOMAIN_CADDY_APPLY_ATTEMPT="1"
        while [ "$FM_DOMAIN_CADDY_APPLY_ATTEMPT" -le "$FM_DOMAIN_CADDY_APPLY_ATTEMPTS" ]; do
            FM_DOMAIN_CADDY_RELOAD_CODE="$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
                -H 'Content-Type: text/caddyfile' --data-binary "@${FM_DOMAIN_CADDYFILE}" \
                "http://127.0.0.1:$(sc_require ports.frankenphp_admin)/load" 2>/dev/null)"
            case "$FM_DOMAIN_CADDY_RELOAD_CODE" in
                200|4[0-9][0-9]) break ;;
            esac
            sleep "$FM_DOMAIN_CADDY_APPLY_RETRY_DELAY_SECONDS"
            FM_DOMAIN_CADDY_APPLY_ATTEMPT=$((FM_DOMAIN_CADDY_APPLY_ATTEMPT + 1))
        done
    fi
    case "$FM_DOMAIN_CADDY_RELOAD_CODE" in
        200)
            FM_DOMAIN_CADDY_RELOAD_READY="yes"
            FM_DOMAIN_CADDY_RELOAD_OUTCOME="applied"
            fm_caddy_config_snapshot "$FM_DOMAIN_CADDYFILE"
            echo "[fm-domain] [OK] Caddy admin /load applied the converged configuration (zero downtime)"
            return
            ;;
        4[0-9][0-9])
            FM_DOMAIN_CADDY_RELOAD_OUTCOME="rejected"
            echo "[fm-domain] [ERROR] live Caddy rejected the converged configuration (HTTP ${FM_DOMAIN_CADDY_RELOAD_CODE}); the running server keeps its previous configuration and no restart is attempted"
            fm_caddy_config_restore "$FM_DOMAIN_CADDYFILE"
            if [ "$FM_CADDY_CONFIG_RESTORED" = "yes" ]; then
                echo "[fm-domain] [WARN] configuration files rolled back to last-known-good (rejected copy under $(fm_caddy_lkg_dir "$FM_DOMAIN_CADDYFILE")/rejected)"
            fi
            return
            ;;
    esac
    if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ] \
        && [ -f "/etc/systemd/system/${FM_DOMAIN_SERVICE_UNIT}.service" ] \
        && systemctl is-active --quiet "$FM_DOMAIN_SERVICE_UNIT"; then
        fm_domain_unit_wedged
        if [ "$FM_DOMAIN_UNIT_WEDGED" = "yes" ]; then
            fm_domain_unit_restart "$FM_DOMAIN_SERVICE_UNIT" "wedged: admin endpoint and backend unresponsive past the startup grace window"
            FM_DOMAIN_CADDY_RELOAD_OUTCOME="restarted"
            if systemctl is-active --quiet "$FM_DOMAIN_SERVICE_UNIT"; then
                FM_DOMAIN_CADDY_RELOAD_READY="yes"
                echo "[fm-domain] [OK] ${FM_DOMAIN_SERVICE_UNIT} active with the converged configuration"
            fi
            return
        fi
    fi
    echo "[fm-domain] [INFO] Caddy load deferred; the supervised runtime will read the canonical files at start"
}

# Gracefully restart ALL FrankenPHP workers through the official admin
# endpoint: the workers re-read application state (.env, config, code
# caches) without dropping the server. Non-fatal when unavailable - the
# worker 'watch' directive and max_requests also cycle workers.
fm_domain_workers_restart() {
    FM_DOMAIN_WORKERS_RESTART_CODE="$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
        "http://127.0.0.1:$(sc_require ports.frankenphp_admin)/frankenphp/workers/restart" 2>/dev/null)"
    if [ "$FM_DOMAIN_WORKERS_RESTART_CODE" = "200" ]; then
        set_var "$FM_DOMAIN_WORKERS_RESTARTED_AT_KEY" "$(date +%s)" >/dev/null 2>&1
        echo "[fm-domain] [OK] FrankenPHP workers restarted gracefully (application state re-read)"
    else
        echo "[fm-domain] [INFO] Worker restart endpoint unavailable (code ${FM_DOMAIN_WORKERS_RESTART_CODE:-none}); workers keep their current state"
    fi
}

# Sets FM_DOMAIN_CODE_CHANGED=yes|no: any application code/config/translation
# file newer than the given epoch. `find -quit` stops at the first hit, so the
# probe costs one partial tree walk.
fm_domain_code_changed_since() {
    local since="$1"
    local root="$FM_DOMAIN_LARAVEL_DIR"
    local hit=""

    FM_DOMAIN_CODE_CHANGED="no"
    hit="$(find "$root/app" "$root/bootstrap" "$root/config" "$root/routes" "$root/database" \
        "$root/lang" "$root/resources/lang" "$root/resources/views" "$root/.env" "$root/composer.lock" \
        "$root/vendor/composer/installed.json" "$FM_DOMAIN_REPO_ROOT/config" \
        -type f -newermt "@${since}" ! -path "*/bootstrap/cache/*" -print -quit 2>/dev/null)"
    if [ -n "$hit" ]; then
        FM_DOMAIN_CODE_CHANGED="yes"
    fi
}

# Workers restart only when they are provably stale: some code file is newer
# than the later of (unit activation, last graceful workers restart). An
# unchanged tree costs zero restarts however many times 175 runs.
fm_domain_workers_restart_if_stale() {
    local baseline=""
    local stored=""

    baseline="$(fm_domain_unit_start_epoch)"
    stored="$(get_var "$FM_DOMAIN_WORKERS_RESTARTED_AT_KEY" "" 2>/dev/null)"
    case "$stored" in
        ''|*[!0-9]*) ;;
        *) if [ -z "$baseline" ] || [ "$stored" -gt "$baseline" ]; then baseline="$stored"; fi ;;
    esac
    if [ -z "$baseline" ]; then
        echo "[fm-domain] [INFO] worker boot time unknown; skipping the staleness-gated workers restart"
        return
    fi
    fm_domain_code_changed_since "$baseline"
    if [ "$FM_DOMAIN_CODE_CHANGED" = "yes" ]; then
        echo "[fm-domain] [INFO] application code changed after the workers booted; restarting workers gracefully"
        fm_domain_restart_ledger "${FM_DOMAIN_SERVICE_UNIT}-workers" "graceful workers restart: code newer than last worker boot"
        fm_domain_workers_restart
    else
        echo "[fm-domain] [OK] workers already run the current code (no restart)"
    fi
}

# Enable and render the dashboard aliases on the FrankenPHP plane. Shared
# state/allowed-host inputs stay owned by domain_setup_common; this function
# owns only Caddy route convergence and the zero-downtime admin load.
fm_domain_enable_ui_binding() {
    local domain=""
    local prefix=""
    local route_drift="no"

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

    fm_domain_ensure_main_caddyfile "" "${FM_DOMAIN_LARAVEL_DIR}/public"
    if [ "$route_drift" = "no" ] && [ "$FM_CADDYFILE_READY" = "yes" ]; then
        FM_DOMAIN_UI_BINDING_READY="yes"
    fi

    fm_domain_caddy_apply_converged
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
# list (e.g. a domain was removed from the service contract). The managed marker
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
            # The tailnet/LAN route is owned by fm_domain_lan_site_ensure
            # (additive to the public domains), never by the domain list.
            if head -n 1 "$route_file" 2>/dev/null | grep -q 'lan=local_lan'; then
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

# Render the tailnet/LAN route file, one HTTPS site per certificate on disk:
#   <machine>.<tailnet>.ts.net      -> UI frontend   (tailscale cert)
#   <machine>...ts.net<api_path>    -> Laravel main  (tailscale cert)
#   <machine>...ts.net<pycore_path> -> pycore        (tailscale cert, tailnet sources only)
#   api.<machine>.<tailnet>.ts.net  -> Laravel main  (mkcert local CA)
#   127.0.0.1                       -> Laravel main  (mkcert local CA)
fm_domain_lan_site_render() {
    local api_handlers=""
    local ui_handlers=""
    local api_mount=""
    local pycore_mount=""
    local ts_tls="	tls ${DOMAIN_LAN_TS_CERT} ${DOMAIN_LAN_TS_KEY}"
    local ts_api_tls="	tls ${DOMAIN_LAN_TS_API_CERT} ${DOMAIN_LAN_TS_API_KEY}"
    local ts_enabled="no"
    local ts_api_enabled="no"
    if [ "$(mesh_vpn_provider)" = "headscale" ]; then
        ts_tls="$(headscale_lan_tls_directive "$DOMAIN_LAN_TS_CERT" "$DOMAIN_LAN_TS_KEY")"
        ts_api_tls="$(headscale_lan_tls_directive "$DOMAIN_LAN_TS_API_CERT" "$DOMAIN_LAN_TS_API_KEY")"
    fi
    if { [ -n "$DOMAIN_LAN_TS_CERT" ] && [ -n "$DOMAIN_LAN_TS_KEY" ]; } || [ "$DOMAIN_LAN_TS_DNS01" = "yes" ]; then
        ts_enabled="yes"
    fi
    if { [ -n "$DOMAIN_LAN_TS_API_CERT" ] && [ -n "$DOMAIN_LAN_TS_API_KEY" ]; } || [ "$DOMAIN_LAN_TS_DNS01" = "yes" ]; then
        ts_api_enabled="yes"
    fi
    api_handlers="$(fm_caddy_reverse_proxy_handlers_render "$FM_DOMAIN_BACKEND_URL" "$FM_DOMAIN_API_EARLY_HINTS_LINK")"
    ui_handlers="$(fm_caddy_reverse_proxy_handlers_render "$FM_DOMAIN_UI_BACKEND_URL" "$FM_DOMAIN_UI_EARLY_HINTS_LINK")"
    api_mount="$(fm_caddy_path_mount_render "$FM_DOMAIN_TAILNET_API_PATH" "$FM_DOMAIN_BACKEND_URL")"
    pycore_mount="$(fm_caddy_tailnet_pycore_mount_render "$FM_DOMAIN_TAILNET_PYCORE_PATH" "$FM_DOMAIN_PYCORE_BACKEND_URL" "${DOMAIN_TS_DNSNAME#*.}")"

    FM_DOMAIN_LAN_RENDERED="$({
        echo "# ${FM_DOMAIN_MARKER} lan=local_lan ts=${DOMAIN_TS_DNSNAME:-none}"
        if [ "$ts_enabled" = "yes" ]; then
            cat <<EOF

https://${DOMAIN_TS_DNSNAME}:${FM_DOMAIN_HTTPS_PORT} {
${ts_tls}
${pycore_mount}
${api_mount}
	handle {
${ui_handlers}
	}
}

http://${DOMAIN_TS_DNSNAME}:${FM_DOMAIN_HTTP_PORT} {
	redir https://${DOMAIN_TS_DNSNAME}{uri} permanent
}
EOF
        fi
        if [ "$ts_api_enabled" = "yes" ]; then
            cat <<EOF

https://${DOMAIN_TS_API_DNSNAME}:${FM_DOMAIN_HTTPS_PORT} {
${ts_api_tls}
${api_handlers}
}

http://${DOMAIN_TS_API_DNSNAME}:${FM_DOMAIN_HTTP_PORT} {
	redir https://${DOMAIN_TS_API_DNSNAME}{uri} permanent
}
EOF
        fi
        if [ -n "$DOMAIN_LAN_MKCERT_PEM" ] && [ -n "$DOMAIN_LAN_MKCERT_KEY" ]; then
            cat <<EOF

https://127.0.0.1:${FM_DOMAIN_HTTPS_PORT} {
	tls ${DOMAIN_LAN_MKCERT_PEM} ${DOMAIN_LAN_MKCERT_KEY}
${api_handlers}
}
EOF
        fi
    })"
}

# Ensure the LAN-mode route file (content-hash idempotent). Drops the managed
# file when no local certificate material exists (the printed manual steps
# produce it on the next run). On a public server it is written only when
# tailscaled is connected (fm_domain_tailnet_site_ensure), and its sites only
# answer tailnet/loopback names, so the public domain routes are unaffected.
fm_domain_lan_site_ensure() {
    local route_file="${FM_DOMAIN_ROUTES_DIR}/local_lan.caddy"
    local rendered=""
    local existing=""
    local ts_enabled_log="no"
    local ts_tls_label="tailscale cert"
    local ts_api_tls_label="mkcert local CA"

    FM_DOMAIN_LAN_SITE_READY="no"
    fm_domain_ensure_routes_dir
    if [ "$FM_DOMAIN_ROUTES_READY" != "yes" ]; then
        echo "[fm-domain] [FAIL] LAN site deferred because the routes directory is unavailable: $route_file"
        return
    fi

    domain_setup_lan_cert_paths_refresh
    if [ -z "$DOMAIN_LAN_TS_CERT" ] && [ -z "$DOMAIN_LAN_MKCERT_PEM" ] && [ "$DOMAIN_LAN_TS_DNS01" != "yes" ]; then
        if [ -f "$route_file" ] && grep -q "$FM_DOMAIN_MARKER" "$route_file" 2>/dev/null; then
            rm -f "$route_file"
            echo "[fm-domain] [OK] Removed LAN route (no local certificates present): $route_file"
        fi
        echo "[fm-domain] [WARN] LAN site skipped: no Tailscale/mkcert certificate files in $DOMAIN_LAN_CERT_DIR"
        return
    fi

    fm_domain_lan_site_render
    rendered="$FM_DOMAIN_LAN_RENDERED"
    echo "$rendered" | write_file_if_changed "$route_file"
    if [ -f "$route_file" ]; then
        existing="$(cat "$route_file")"
    fi
    if [ "$existing" = "$rendered" ]; then
        FM_DOMAIN_LAN_SITE_READY="yes"
        echo "[fm-domain] [OK] LAN route file: $route_file"
        if [ "$(mesh_vpn_provider)" = "headscale" ]; then
            ts_tls_label="$(mesh_cert_source)"
            [ "$DOMAIN_LAN_TS_DNS01" = "yes" ] && ts_api_tls_label="$(mesh_cert_source)"
        fi
        if [ -n "$DOMAIN_LAN_TS_CERT" ] || [ "$DOMAIN_LAN_TS_DNS01" = "yes" ]; then
            ts_enabled_log="yes"
        fi
        if [ "$ts_enabled_log" = "yes" ]; then
            echo "[fm-domain]     https://${DOMAIN_TS_DNSNAME}:${FM_DOMAIN_HTTPS_PORT} -> ${FM_DOMAIN_UI_BACKEND_URL} (tls: ${ts_tls_label})"
            echo "[fm-domain]     https://${DOMAIN_TS_DNSNAME}${FM_DOMAIN_TAILNET_API_PATH}/ -> ${FM_DOMAIN_BACKEND_URL} (tls: ${ts_tls_label})"
            echo "[fm-domain]     https://${DOMAIN_TS_DNSNAME}${FM_DOMAIN_TAILNET_PYCORE_PATH}/ -> ${FM_DOMAIN_PYCORE_BACKEND_URL} (tls: ${ts_tls_label}, tailnet sources only)"
        fi
        if [ -n "$DOMAIN_LAN_TS_API_CERT" ] || [ "$DOMAIN_LAN_TS_DNS01" = "yes" ]; then
            echo "[fm-domain]     https://${DOMAIN_TS_API_DNSNAME}:${FM_DOMAIN_HTTPS_PORT} -> ${FM_DOMAIN_BACKEND_URL} (tls: ${ts_api_tls_label})"
        fi
        if [ -n "$DOMAIN_LAN_MKCERT_PEM" ]; then
            echo "[fm-domain]     https://127.0.0.1:${FM_DOMAIN_HTTPS_PORT} -> ${FM_DOMAIN_BACKEND_URL} (tls: mkcert local CA)"
        fi
    else
        echo "[fm-domain] [FAIL] LAN route file postcondition failed: $route_file"
    fi
}

# Public servers that are ALSO tailnet members get the tailnet sites added on
# top of the public domain routes (additive; the public routes are untouched).
# A host without a connected tailscaled is a no-op.
fm_domain_tailnet_certificates_ensure() {
    FM_DOMAIN_TAILNET_ACTIVE="no"
    if ! command -v tailscale >/dev/null 2>&1 || ! tailscale status >/dev/null 2>&1; then
        return
    fi
    FM_DOMAIN_TAILNET_ACTIVE="yes"
    domain_setup_lan_cert_mkcert || true
    domain_setup_tailnet_certificates
}

fm_domain_tailnet_site_ensure() {
    fm_domain_tailnet_certificates_ensure
    if [ "$FM_DOMAIN_TAILNET_ACTIVE" = "yes" ]; then
        fm_domain_lan_site_ensure
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
    domain_setup_detect_environment
    if [ "$DOMAIN_ENV_LAN_MODE" = "yes" ]; then
        # LAN/desktop host: local certificates (Tailscale ts.net + mkcert
        # 127.0.0.1) instead of the public-domain flow; deploy them as Caddy
        # HTTPS sites on the same backend and live-apply. The public server
        # logic below is untouched and never sees this branch.
        domain_setup_lan_certificates
        fm_domain_lan_site_ensure
        fm_domain_ensure_main_caddyfile "$(sc_get ports.frankenphp_admin)" "${laravel_dir}/public"
        fm_domain_caddy_apply_converged
        if [ "$FM_CADDYFILE_READY" = "yes" ]; then
            FM_DOMAIN_INSTALL_READY="yes"
        fi
        return
    fi
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
    fm_domain_tailnet_site_ensure
    if [ "$(mesh_vpn_provider)" = "headscale" ] && [ "$(mesh_is_headscale_server_host)" = "yes" ]; then
        headscale_server_route_ensure
    fi

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
    domain_setup_detect_environment
    if [ "$DOMAIN_ENV_LAN_MODE" = "yes" ]; then
        domain_setup_lan_certificates
        FM_DOMAIN_CERTIFICATES_READY="yes"
        return
    fi
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
    fm_domain_tailnet_certificates_ensure
    FM_DOMAIN_CERTIFICATES_READY="yes"
    echo "[fm-domain] [OK] DNS-01 readiness converged (Caddy issues/renews wildcard at launch)"
}
