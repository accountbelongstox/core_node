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

# 175_laravel_main_start.sh -> NGINX PLANE branch. Dispatched by the
# orchestrator for BOTH plane-specific phases (constants and components are
# shared: web_server_plane (gvar_common), service contract ports, the
# domain_setup_common / nginx_manager / cert_selfheal_common libraries - this
# file defines no plane or path constants of its own):
#
#   domains mode: ensure_nginx_stack (HTTP/3 + 301 + early data, idempotent
#     install/upgrade/repair via nginx_manager.sh) + ensure_certbot_stack
#     (pipx-isolated certbot-dnspod) + run_domain_setup_phase (nginx sites
#     from decrypted DNSPod secrets + certificate issuance + self-heal).
#
#   runtime mode (default): Octane swoole on the loopback API backend port
#     (laravel_runtime_nginx.sh); Swoole unavailable -> node npx fallback
#     or the node-free php-serve fallback (shared launcher sub-scripts).

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LARAVEL_SERVICE_COMMON_DIR="$(dirname "$SCRIPT_CURRENT_DIR")"
LINUX_COMMON_DIR="$(dirname "$LARAVEL_SERVICE_COMMON_DIR")/common"
INSTALL_SHELLS_DIR="${LARAVEL_SERVICE_COMMON_DIR}/install_shells"
LARAVEL_START_SCRIPT="${INSTALL_SHELLS_DIR}/175_laravel_main_start.sh"
NGINX_INSTALL_SCRIPT="${INSTALL_SHELLS_DIR}/33_install_nginx.sh"
CERTBOT_INSTALL_SCRIPT="${INSTALL_SHELLS_DIR}/35_install_certbot.sh"
LARAVEL_RUNTIME_NGINX_SCRIPT="${LARAVEL_RUNTIME_NGINX_SCRIPT:-${SCRIPT_CURRENT_DIR}/laravel_runtime_nginx.sh}"
NPX_FALLBACK_SCRIPT="${SCRIPT_CURRENT_DIR}/175_laravel_main_start_npx_fallback.sh"
PHP_SERVE_FALLBACK_SCRIPT="${SCRIPT_CURRENT_DIR}/175_laravel_main_start_php_serve.sh"

PORT="${PORT:-}"
PHP_BIN="${PHP_BIN:-php}"
COMPOSER_CMD="${COMPOSER_CMD:-composer}"
NPX_BIN="${NPX_BIN:-}"
LARAVEL_DIR="${LARAVEL_DIR:-}"
DOMAIN_SCOPE="${DOMAIN_SCOPE:-all}"
OCTANE_RUNTIME_WATCH="${OCTANE_RUNTIME_WATCH:-0}"
OCTANE_RUNTIME_POLL="${OCTANE_RUNTIME_POLL:-0}"
SCRIPT_INDEX="175N"
MODE="${1:-runtime}"
SWOOLE_LOADED=""

# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/service_contract_common.sh"
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/gvar_common.sh"
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/common_functions.sh"
# domain_setup_common pulls in nginx_common + file_ops_common (the canonical
# file writer); nginx_manager self-sources domain_setup_common.
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/domain_setup_common.sh"
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/nginx_manager.sh"
# shellcheck source=/dev/null
. "$LINUX_COMMON_DIR/cert_selfheal_common.sh"

# DEFAULT YES prompt on the controlling TTY; no TTY -> yes.
ask_default_yes() {
    local msg="$1" reply=""
    if [ -t 0 ] && [ -r /dev/tty ]; then
        printf '%s [Y/n] ' "$msg" > /dev/tty
        read -r reply < /dev/tty || reply=""
    fi
    case "$reply" in [Nn]*) return 1 ;; *) return 0 ;; esac
}

# Ensure nginx with HTTP/3 + 301 + early-data support, driven by the shared
# management architecture (common/nginx_manager.sh). Fine-grained idempotent:
# missing -> canonical installer; outdated -> upgrade prompt (in-place, sites
# preserved); broken config -> repair prompt; healthy -> silent repair sweep
# plus the per-file HTTP/3 stanza migration.
ensure_nginx_stack() {
    local current_version=""

    # Edge-port guard (80/TCP, 443/TCP, 443/UDP for QUIC): stop foreign
    # occupiers (e.g. hysteria on UDP/443) and offer their uninstall (y/N,
    # default No) BEFORE any install/upgrade/repair below - every reload or
    # restart downstream can only take effect when nginx can actually bind.
    # Self-detecting: no-op when the ports are free; nginx's own sockets are
    # never touched.
    nm_edge_ports_ensure

    current_version=$(nginx_get_version)
    if [ -z "$current_version" ]; then
        echo "nginx not found. Setting START_WEB_SERVER=nginx and invoking the canonical installer:"
        echo "  $NGINX_INSTALL_SCRIPT"
        set_web_server_plane "nginx"
        if [ -f "$NGINX_INSTALL_SCRIPT" ]; then
            bash "$NGINX_INSTALL_SCRIPT" || echo "  Warning: nginx installer reported failure (continuing)."
        else
            echo "  *** ACTION REQUIRED: nginx installer missing: $NGINX_INSTALL_SCRIPT"
        fi
        return 0
    fi

    echo "nginx present: nginx/$current_version (HTTP/3: $(nginx_has_http3 && echo yes || echo no))"

    # Binary/link unification is self-detecting (every alias check no-ops when
    # correct); run it every time so link drift (loops, dangling aliases) is
    # repaired on every start.
    nginx_unify_binaries || echo "  Warning: nginx binary unify reported issues (continuing)."

    if ! nginx_version_ge "$current_version" "$NGINX_MAINLINE_VERSION"; then
        echo "  nginx $current_version is older than the reference mainline $NGINX_MAINLINE_VERSION."
        if ask_default_yes "  Upgrade nginx to the official mainline build? Sites and certificates are preserved and repaired idempotently."; then
            nm_install_or_upgrade || echo "  Warning: nginx upgrade reported failure (continuing)."
            nm_http3_migrate || true
            nginx_repair_sites || echo "  Warning: post-upgrade repair reported issues (continuing)."
            return 0
        fi
    fi

    if ! $USE_SUDO nginx -t -c "$NGINX_MAIN_CONF" >/dev/null 2>&1; then
        echo "  nginx configuration test FAILED."
        if ask_default_yes "  Run the idempotent site repair now (quarantines broken managed sites, reloads on success)?"; then
            nginx_repair_sites || bash "$NGINX_INSTALL_SCRIPT" || echo "  Warning: nginx repair reported failure (continuing)."
        fi
    else
        # Healthy config: guarantee the main conf includes the mapped
        # sites-enabled (content-hash idempotent, no-op when current), an
        # explicit default_server exists (without one, the first site file
        # silently becomes the default and answers every unmatched host),
        # then the fine-grained repair sweep and the HTTP/3 stanza migration.
        nm_main_config
        nm_default_vhost
        nginx_repair_sites || echo "  Warning: site repair sweep reported issues (continuing)."
        nm_http3_migrate || echo "  Warning: HTTP/3 migration sweep reported issues (continuing)."
    fi

    # Service state ensure (fine-grained idempotent): a configured but
    # STOPPED nginx serves nothing - the repair/reload paths above never
    # start it ("service not active, reload skipped"). nm_service_state
    # self-gates on nginx -t and is effect-idempotent when already active
    # (systemctl enable/start on a running unit is a no-op).
    nm_service_state "start" || echo "  Warning: nginx service start reported issues (continuing)."
    nginx_serve_truth_report
    return 0
}

# Ensure certbot tooling when domain setup is in scope. Detection is
# file-based and flavor-aware: /usr/local/bin/certbot must resolve INTO the
# pipx venv (35_install_certbot.sh owns that link). A stale real file (old
# system-pip/apt console script at the same path) passes a bare -x check but
# is NOT the managed install -> invoke the canonical installer to re-link.
ensure_certbot_stack() {
    local certbot_resolved=""
    certbot_resolved="$(readlink -f /usr/local/bin/certbot 2>/dev/null || true)"
    if [ -n "$certbot_resolved" ] && [ -x "$certbot_resolved" ]; then
        case "$certbot_resolved" in
            *"/venvs/certbot/bin/certbot")
                # The venv must also carry the WORKING DNSPod authenticator
                # (the zope-era dns-dnspod plugin cannot load on modern
                # certbot). Functional probe: plugins listing.
                if /usr/local/bin/certbot plugins 2>/dev/null | grep -q "certbot-dnspod"; then
                    echo "certbot present: $(/usr/local/bin/certbot --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
                    return 0
                fi
                echo "certbot venv lacks the working certbot-dnspod plugin. Re-provisioning via the canonical installer:"
                echo "  $CERTBOT_INSTALL_SCRIPT"
                if [ -f "$CERTBOT_INSTALL_SCRIPT" ]; then
                    bash "$CERTBOT_INSTALL_SCRIPT" || echo "  Warning: certbot installer reported failure (continuing)."
                fi
                return 0
                ;;
        esac
    fi
    if [ -e /usr/local/bin/certbot ]; then
        echo "certbot at /usr/local/bin/certbot is stale (not the pipx-isolated venv build). Re-linking via the canonical installer:"
    else
        echo "certbot not found. Invoking the canonical installer:"
    fi
    echo "  $CERTBOT_INSTALL_SCRIPT"
    if [ -f "$CERTBOT_INSTALL_SCRIPT" ]; then
        bash "$CERTBOT_INSTALL_SCRIPT" || echo "  Warning: certbot installer reported failure (continuing)."
    else
        echo "  Warning: certbot installer missing: $CERTBOT_INSTALL_SCRIPT"
    fi
    return 0
}

# Domain install from decrypted DNSPod secrets: api.<region>.<domain> nginx
# sites (HTTP/3 + 301) plus idempotent certificate issuance. The region prefix
# is stored in the global-var store; re-runs only ask whether to modify it.
run_domain_setup_phase() {
    if [ ! -d "$DOMAIN_SETUP_SECRETS_DIR" ]; then
        echo "Domain setup skipped: secrets not decrypted ($DOMAIN_SETUP_SECRETS_DIR missing; run dd.sh first)."
        return 0
    fi
    if [ "$(id -u)" -ne 0 ] && ! sudo -n true 2>/dev/null; then
        echo "Domain setup needs root privileges; re-run when convenient:"
        echo "  sudo bash $LARAVEL_START_SCRIPT --domains-only"
        return 0
    fi
    if [ "$DOMAIN_SCOPE" = "certs" ]; then
        domain_setup_certificates_only "$LARAVEL_DIR" || echo "  Warning: certificate phase reported issues (continuing)."
    else
        domain_setup_install_all "http://127.0.0.1:$PORT" "$LARAVEL_DIR" || echo "  Warning: domain phase reported issues (continuing)."
    fi
    # Certificate self-heal (independent fine-grained steps): deploy hooks that
    # reload nginx only after an actual renewal, the twice-daily renewal timer,
    # and a startup renewal pass (certbot renews only near-expiry certificates;
    # the artisan end reconciles stale renewal configs first).
    cert_selfheal_run_once "$LARAVEL_DIR" || echo "  Warning: certificate self-heal reported issues (continuing)."
    # Detail: what is actually serving now (binary, master, includes, sites).
    nginx_serve_truth_report
    return 0
}

# --- domains mode: nginx plane web stack + domain/SSL convergence ----------
if [ "$MODE" = "domains" ]; then
    echo "Ensuring nginx (HTTP/3 + 301 + early data, idempotent repair/upgrade)..."
    ensure_nginx_stack
    echo "Ensuring certbot tooling..."
    ensure_certbot_stack
    echo "Installing domains from decrypted DNSPod secrets (api.<region>.<domain>)..."
    run_domain_setup_phase
    exit 0
fi

# --- runtime mode (default): Octane swoole / fallback launchers ------------
if [ -n "$PHP_BIN" ] && "$PHP_BIN" -m 2>/dev/null | grep -qi '^swoole$'; then
    SWOOLE_LOADED="yes"
fi

cd "$LARAVEL_DIR" || exit 1

if [ "$SWOOLE_LOADED" = "yes" ]; then
    echo "Starting headless API runtime (nginx plane -> Octane swoole on server 0.0.0.0:${PORT}, single timer driver)"
    PORT="$PORT" PHP_BIN="$PHP_BIN" LARAVEL_DIR="$LARAVEL_DIR" \
        OCTANE_WATCH="$OCTANE_RUNTIME_WATCH" OCTANE_POLL="$OCTANE_RUNTIME_POLL" \
        exec /bin/bash "$LARAVEL_RUNTIME_NGINX_SCRIPT"
elif [ -n "$NPX_BIN" ] || command -v npx >/dev/null 2>&1; then
    echo "WARNING: Swoole unavailable -> Octane HTTP server disabled, using node-based fallback."
    PORT="$PORT" COMPOSER_CMD="$COMPOSER_CMD" \
        exec /bin/bash "$NPX_FALLBACK_SCRIPT"
else
    echo "WARNING: Swoole unavailable and no node -> using node-free fallback."
    echo "node-free fallback: php artisan serve + queue:listen + schedule:work (sub-minute timer tasks still run via Laravel Schedule)"
    PORT="$PORT" PHP_BIN="$PHP_BIN" \
        exec /bin/bash "$PHP_SERVE_FALLBACK_SCRIPT"
fi
