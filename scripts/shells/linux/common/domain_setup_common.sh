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

# Shared domain setup library. Single source of truth for:
# - reading DNSPod secrets (DNSPOD_EMAILS / DNS_DNSPOD_API_TOKENS / DOMAINS_LISTS)
# - region-prefix selection (si/sh/sz/hk/custom) persisted in the file-backed
#   global-var store, so later runs only ask whether to modify
# - idempotent nginx site install for api.<prefix>.<domain> AND the bare apex
#   <domain>: api.* sites reverse proxy to the canonical API backend
#   (service contract ports.laravel_api_backend on loopback) with plain HTTP
#   on :80 proxying DIRECTLY (no 301); apex
#   sites keep the 301 -> https pair (without the apex site, apex requests
#   fall through to the static default vhost),
#   HTTP/3 + 301 + TLS early data, rendered by nginx_common.sh, with per-site
#   repair
# - idempotent certificate issuance through Laravel ServerManager (artisan)
#   plus the closing certificate fleet summary (the old 133 block)
#
# Load-time side effect free. USE_SUDO and the site directories are resolved
# lazily so this library is safe to source from both dd.sh installers (which
# have gvar_common.sh loaded) and plain app start scripts (which do not).

DOMAIN_SETUP_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Canonical service contract adapter (ports/hosts/paths single source). Must
# load BEFORE the DOMAIN_SETUP_* path variables below - they call sc_get at
# source time.
# shellcheck source=/dev/null
source "$DOMAIN_SETUP_COMMON_DIR/service_contract_common.sh"
# shellcheck source=/dev/null
source "$DOMAIN_SETUP_COMMON_DIR/nginx_common.sh"

DOMAIN_SETUP_REPO_ROOT="$(cd "$DOMAIN_SETUP_COMMON_DIR/../../../.." && pwd)"
DOMAIN_SETUP_CORE_NODE_DIR="${CORE_NODE_DIR:-$DOMAIN_SETUP_REPO_ROOT}"
DOMAIN_SETUP_SECRETS_DIR="$DOMAIN_SETUP_CORE_NODE_DIR/.secret_keys/.secret_ignore"
DOMAIN_SETUP_GLOBAL_VAR_DIR="${CORE_NODE_DATA_DIR:-$(sc_get paths.core_node_data_dir_posix)}/$(sc_get paths.global_var_dir_name)"
DOMAIN_API_PREFIX_KEY="DOMAIN_API_REGION_PREFIX"
DOMAIN_UI_BINDING_KEY="DOMAIN_UI_BINDING"
# External allowed-hosts file consumed by the dashboard vite.config.ts
# (server.allowedHosts / preview.allowedHosts). One hostname per line; the
# Vite config keeps its defaults when this file is absent, so the config
# file itself is never rewritten for dynamic domains.
DOMAIN_UI_ALLOWED_HOSTS_FILE="$DOMAIN_SETUP_GLOBAL_VAR_DIR/$(sc_get files.ui_allowed_hosts)"
# systemd unit of the dashboard dev server (registered by the app start.sh).
# vite reads the allowed-hosts file ONCE at startup, so a content change must
# be followed by a restart of this unit or bound domains keep answering 403.
DOMAIN_UI_SERVICE_NAME="ncore-nexus-dash"
# Shell-written UI domain config (api region prefix) consumed by the dashboard
# vite middleware, which serves it same-origin and re-reads it per request, so
# a content change needs NO UI service restart (unlike the allowed-hosts file).
DOMAIN_UI_DOMAIN_CONFIG_FILE="$DOMAIN_SETUP_GLOBAL_VAR_DIR/$(sc_get files.ui_domain_config)"

# Canonical backend URLs resolve from the central service contract
# (config/service_contract.json) at CALL time via the shell adapter - ports
# and hosts are never hardcoded in this library. An unreadable contract is a
# hard failure: an empty host/port would otherwise render "server :;" and
# break nginx -t for the whole include tree.
domain_api_backend_url() {
    local host
    local port
    host=$(sc_require hosts.loopback) || return 1
    port=$(sc_require ports.laravel_api_backend) || return 1
    echo "http://$host:$port"
}
domain_ui_backend_url() {
    local host
    local port
    host=$(sc_require hosts.loopback) || return 1
    port=$(sc_require ports.nexus_dash_frontend) || return 1
    echo "http://$host:$port"
}
DOMAIN_SETUP_VALID_REGIONS="si sh sz hk"
DOMAIN_SETUP_LARAVEL_DIR="$DOMAIN_SETUP_CORE_NODE_DIR/poly_apps/laravel_main"

# Shared idempotent-replace writer + canonical lazy sudo (single source of
# truth; common_functions.sh and cert_selfheal_common.sh source the same
# library, so load order never changes write semantics).
# shellcheck source=/dev/null
source "$DOMAIN_SETUP_COMMON_DIR/file_ops_common.sh"

# Lazily resolve sudo: gvar_common.sh sets USE_SUDO when it is loaded; the
# canonical resolver lives in file_ops_common.sh (lazy_sudo).
DOMAIN_DNSPOD_EMAIL=""
DOMAIN_DNSPOD_TOKEN=""
DOMAIN_DOMAINS_LIST=""
DOMAIN_API_PREFIX=""
DOMAIN_UI_BINDING_READY="no"

# Persist one key in the file-backed global-var store (the user data
# directory). Reuses set_global_var when gvar_common.sh is loaded; otherwise
# writes the same one-file-per-key format directly.
domain_state_set() {
    local key="$1"
    local value="$2"
    local sudo_cmd
    sudo_cmd=$(lazy_sudo)

    if declare -F set_global_var >/dev/null 2>&1; then
        set_global_var "$key" "$value"
        return $?
    fi
    $sudo_cmd mkdir -p "$DOMAIN_SETUP_GLOBAL_VAR_DIR" 2>/dev/null || mkdir -p "$DOMAIN_SETUP_GLOBAL_VAR_DIR"
    printf '%s\n' "$value" | $sudo_cmd tee "$DOMAIN_SETUP_GLOBAL_VAR_DIR/$key" >/dev/null 2>&1 || \
        printf '%s\n' "$value" > "$DOMAIN_SETUP_GLOBAL_VAR_DIR/$key"
    # House policy: shared variable files are mode 777.
    $sudo_cmd chmod 777 "$DOMAIN_SETUP_GLOBAL_VAR_DIR/$key" 2>/dev/null || chmod 777 "$DOMAIN_SETUP_GLOBAL_VAR_DIR/$key" 2>/dev/null || true
}

# Read one key from the file-backed global-var store.
domain_state_get() {
    local key="$1"
    local default_value="${2:-}"
    local sudo_cmd
    sudo_cmd=$(lazy_sudo)

    if declare -F get_global_var >/dev/null 2>&1; then
        get_global_var "$key" "$default_value"
        return 0
    fi
    if [ -f "$DOMAIN_SETUP_GLOBAL_VAR_DIR/$key" ]; then
        $sudo_cmd cat "$DOMAIN_SETUP_GLOBAL_VAR_DIR/$key" 2>/dev/null || cat "$DOMAIN_SETUP_GLOBAL_VAR_DIR/$key" 2>/dev/null || echo "$default_value"
    else
        echo "$default_value"
    fi
}

# Read the DNSPod credentials and domain list from the decrypted secrets.
# Populates DOMAIN_DNSPOD_EMAIL / DOMAIN_DNSPOD_TOKEN / DOMAIN_DOMAINS_LIST.
domain_setup_load_secrets() {
    local secret_file

    if [ ! -d "$DOMAIN_SETUP_SECRETS_DIR" ]; then
        echo "[domain] ERROR: secret directory not found: $DOMAIN_SETUP_SECRETS_DIR"
        echo "[domain] Run dd.sh first to decrypt secrets."
        return 1
    fi

    secret_file="$DOMAIN_SETUP_SECRETS_DIR/DNSPOD_EMAILS"
    if [ ! -f "$secret_file" ]; then
        echo "[domain] ERROR: DNSPOD_EMAILS not found: $secret_file"
        return 1
    fi
    DOMAIN_DNSPOD_EMAIL=$(tr -d '\0' < "$secret_file" | sed '/^\s*$/d')
    if [ -z "$DOMAIN_DNSPOD_EMAIL" ]; then
        echo "[domain] ERROR: DNSPOD_EMAILS is empty"
        return 1
    fi

    secret_file="$DOMAIN_SETUP_SECRETS_DIR/DNS_DNSPOD_API_TOKENS"
    if [ ! -f "$secret_file" ]; then
        echo "[domain] ERROR: DNS_DNSPOD_API_TOKENS not found: $secret_file"
        return 1
    fi
    DOMAIN_DNSPOD_TOKEN=$(tr -d '\0' < "$secret_file" | sed '/^\s*$/d')
    if [ -z "$DOMAIN_DNSPOD_TOKEN" ]; then
        echo "[domain] ERROR: DNS_DNSPOD_API_TOKENS is empty"
        return 1
    fi

    secret_file="$DOMAIN_SETUP_SECRETS_DIR/DOMAINS_LISTS"
    if [ ! -f "$secret_file" ]; then
        echo "[domain] ERROR: DOMAINS_LISTS not found: $secret_file"
        return 1
    fi
    DOMAIN_DOMAINS_LIST=$(tr -d '\0' < "$secret_file" | tr -d '\r' | sed '/^\s*$/d')
    if [ -z "$DOMAIN_DOMAINS_LIST" ]; then
        echo "[domain] ERROR: DOMAINS_LISTS is empty"
        return 1
    fi

    echo "[domain] [OK] Secrets loaded (domains: $(echo "$DOMAIN_DOMAINS_LIST" | wc -l | tr -d ' '))"
    return 0
}

# TTY-safe prompt defaulting to No; non-interactive shells answer No.
domain_setup_ask_no() {
    local msg="$1"
    local reply=""
    if [ -t 0 ] && [ -r /dev/tty ]; then
        printf '%s [y/N] ' "$msg" > /dev/tty
        read -r reply < /dev/tty || reply=""
    fi
    case "$reply" in [Yy]*) return 0 ;; *) return 1 ;; esac
}

# Validate a region prefix token.
domain_setup_prefix_valid() {
    echo "$1" | grep -qE '^[a-z0-9][a-z0-9-]{0,30}$'
}

# Ensure the region prefix used to build api.<prefix>.<domain> sites.
# The choice is persisted in the global-var store; later runs only ask
# whether to modify the stored value instead of prompting from scratch.
domain_setup_ensure_prefix() {
    local stored
    local choice
    local custom
    local reply

    stored=$(domain_state_get "$DOMAIN_API_PREFIX_KEY" "")
    if [ -n "$stored" ]; then
        echo "[domain] Stored API region prefix: $stored"
        if domain_setup_ask_no "[domain] Modify the API region prefix (current: $stored)?"; then
            stored=""
        else
            DOMAIN_API_PREFIX="$stored"
            return 0
        fi
    fi

    echo "[domain] Select the API region prefix (builds api.<prefix>.<domain>):"
    echo "[domain]   1) si"
    echo "[domain]   2) sh"
    echo "[domain]   3) sz"
    echo "[domain]   4) hk"
    echo "[domain]   5) custom"
    reply=""
    if [ -t 0 ] && [ -r /dev/tty ]; then
        printf '[domain] Choice [1-5]: ' > /dev/tty
        read -r reply < /dev/tty || reply=""
    fi
    case "$reply" in
        1|si) choice="si" ;;
        2|sh) choice="sh" ;;
        3|sz) choice="sz" ;;
        4|hk) choice="hk" ;;
        5)
            custom=""
            if [ -t 0 ] && [ -r /dev/tty ]; then
                printf '[domain] Custom prefix: ' > /dev/tty
                read -r custom < /dev/tty || custom=""
            fi
            custom=$(echo "$custom" | tr -d ' ')
            if domain_setup_prefix_valid "$custom"; then
                choice="$custom"
            else
                echo "[domain] Invalid custom prefix '$custom'; falling back to si"
                choice="si"
            fi
            ;;
        *)
            echo "[domain] No selection; using default prefix: si"
            choice="si"
            ;;
    esac

    DOMAIN_API_PREFIX="$choice"
    domain_state_set "$DOMAIN_API_PREFIX_KEY" "$DOMAIN_API_PREFIX"
    echo "[domain] [OK] API region prefix saved: $DOMAIN_API_PREFIX"
    return 0
}

# Persist the values consumed by the downstream 134/135 scripts into the same
# file-backed store (one key per file, loaded via domain_state_get).
domain_setup_persist_state() {
    domain_state_set "SELECTED_PREFIXES" "$DOMAIN_API_PREFIX"
    domain_state_set "DOMAINS_LISTS_CONTENT" "$DOMAIN_DOMAINS_LIST"
    domain_state_set "DNSPOD_EMAIL" "$DOMAIN_DNSPOD_EMAIL"
    domain_state_set "DNSPOD_API_TOKEN" "$DOMAIN_DNSPOD_TOKEN"
    domain_state_set "PHP_VERSION" "$(php_script_run 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;' 2>/dev/null || echo 8.4)"
}

# Echo the fqdn of the API site for a root domain.
domain_setup_api_fqdn() {
    echo "api.$DOMAIN_API_PREFIX.$1"
}

# Issue (or renew) the certificate for one root domain through Laravel
# ServerManager. Idempotent: ServerManager skips valid existing certificates.
domain_setup_issue_certificate() {
    local domain="$1"
    local laravel_dir="${2:-$DOMAIN_SETUP_LARAVEL_DIR}"
    local pre_output
    local issue_output

    if [ ! -d "$laravel_dir" ]; then
        echo "[domain] [WARN] Laravel directory missing: $laravel_dir (certificate skipped for $domain)"
        return 1
    fi

    pre_output=$(cd "$laravel_dir" && $(lazy_sudo) php artisan servermanager:certificate find "$domain" 2>&1 || true)
    if echo "$pre_output" | grep -q "Found certificate"; then
        echo "[domain] [SKIP] Certificate already exists for: $domain"
        echo "$pre_output" | grep "Expires:" | head -1 || true
        return 0
    fi

    echo "[domain] Issuing certificate: $domain (prefixes: $DOMAIN_API_PREFIX, provider: dnspod)"
    issue_output=$(cd "$laravel_dir" && \
        DNSPOD_EMAIL="$DOMAIN_DNSPOD_EMAIL" DNSPOD_API_TOKEN="$DOMAIN_DNSPOD_TOKEN" \
        $(lazy_sudo) php artisan servermanager:certificate add "$domain" \
        --prefixes="$DOMAIN_API_PREFIX" --provider=dnspod 2>&1)
    echo "$issue_output" | while IFS= read -r line; do echo "[domain]   $line"; done

    pre_output=$(cd "$laravel_dir" && $(lazy_sudo) php artisan servermanager:certificate find "$domain" 2>&1 || true)
    if echo "$pre_output" | grep -q "Found certificate"; then
        echo "[domain] [OK] Certificate verified for: $domain"
        return 0
    fi
    echo "[domain] [WARN] Certificate not present after issuance attempt: $domain (site falls back to HTTP bootstrap)"
    return 1
}

# Print the certificate fleet summary through Laravel ServerManager (the final
# status block of the old 133_setup_domain_ssl.sh). Best-effort: a summary
# failure never blocks the install result.
domain_setup_print_certificate_summary() {
    local laravel_dir="${1:-$DOMAIN_SETUP_LARAVEL_DIR}"

    if [ ! -d "$laravel_dir" ]; then
        return 0
    fi
    echo "[domain] Certificate Summary:"
    (cd "$laravel_dir" && $(lazy_sudo) php artisan servermanager:certificate summary 2>/dev/null) \
        | while IFS= read -r line; do echo "[domain]   $line"; done
    return 0
}

# Install one nginx site as the canonical reverse proxy vhost. http_mode
# selects the port-80 block shape: "redirect" (apex: 301 -> https) or
# "proxy" (api.*: direct proxy, plain HTTP reaches the backend even while
# 443 is blocked). Content-hash idempotent: a site whose file differs from
# the canonical render is rewritten (site repair). Certificate state never
# changes the vhost shape - see the placeholder note inside.
domain_setup_ensure_proxy_site() {
    local fqdn="$1"
    local cert_domain="$2"
    local backend="${3:-$(domain_api_backend_url)}"
    local http_mode="${4:-redirect}"
    local server_names="${5:-$fqdn}"
    local sites_available
    local sites_enabled
    local site_file
    local enabled_link
    local sudo_cmd

    sites_available=$(nginx_get_sites_available)
    sites_enabled=$(nginx_get_sites_enabled)
    site_file="$sites_available/$fqdn"
    enabled_link="$sites_enabled/$fqdn"
    sudo_cmd=$(lazy_sudo)

    # Fail loud on an unreadable contract: an empty host/port would render
    # "server :;" and break nginx -t for every managed site.
    if ! echo "$backend" | grep -qE '^https?://[^:/[:space:]]+:[0-9]+$'; then
        echo "[domain] [FAIL] $fqdn: invalid backend URL '$backend' (service contract unreadable?); site NOT rendered"
        return 1
    fi

    # The vhost SHAPE is invariant: certificate state never downgrades the
    # site to a bootstrap stub. Real Let's Encrypt material wins the probe in
    # nginx_le_cert_path; otherwise the ensured placeholder certificate keeps
    # the render nginx-valid (the content-hash writer swaps to the real cert
    # on the sweep after issuance).
    nginx_ensure_placeholder_cert
    echo "[domain] $fqdn: proxy -> $backend (http:$http_mode, names: $server_names), cert=$(nginx_le_cert_path "$cert_domain")"

    {
        echo "# $NGINX_MANAGED_SITE_MARKER domain_setup fqdn=$fqdn cert=$cert_domain"
        nginx_render_proxy_vhost "$fqdn" "$backend" "$cert_domain" "$http_mode" "$server_names"
    } | write_file_if_changed "$site_file" "$(dirname "$sites_available")/backup"

    if [ ! -L "$enabled_link" ] || [ "$(readlink -f "$enabled_link" 2>/dev/null)" != "$(readlink -f "$site_file" 2>/dev/null)" ]; then
        $sudo_cmd mkdir -p "$sites_enabled"
        $sudo_cmd ln -sfn "$site_file" "$enabled_link"
        echo "[domain] [OK] Site enabled: $fqdn"
    fi
    return 0
}

# Install the nginx site for api.<prefix>.<domain>. API domains ALWAYS reverse
# proxy to the canonical Laravel API backend (domain_api_backend_url, the
# laravel_api_backend port on loopback) - never to the generic backend
# argument and never to :80 (which would loop the request back into nginx
# itself) - and their :80 block proxies DIRECTLY (http_mode=proxy, no 301) so
# plain HTTP reaches the backend even while the cloud security group blocks 443.
domain_setup_ensure_api_site() {
    local domain="$1"
    domain_setup_ensure_proxy_site "$(domain_setup_api_fqdn "$domain")" "$domain" "$(domain_api_backend_url)" "proxy"
}

# Install the nginx site for the bare apex <domain>: the apex must reverse
# proxy to the Laravel backend too; without it apex requests fall through to
# the static default vhost (the classic "domain serves /var/www/html instead
# of the app" failure). When the dashboard (UI) binding is enabled the apex
# serves the UI backend instead (persisted choice; see
# domain_setup_enable_ui_binding).
domain_setup_ensure_apex_site() {
    local domain="$1"
    local backend="${2:-$(domain_api_backend_url)}"
    if domain_setup_ui_binding_enabled; then
        backend="$(domain_ui_backend_url)"
    fi
    domain_setup_ensure_proxy_site "$domain" "$domain" "$backend"
}

# True when the dashboard (UI) domain binding is enabled (persisted in the
# file-backed global-var store).
domain_setup_ui_binding_enabled() {
    [ "$(domain_state_get "$DOMAIN_UI_BINDING_KEY" "no")" = "yes" ]
}

# Install the dashboard aliases for one domain: www.<domain>,
# <prefix>.<domain> and www.<prefix>.<domain>, reverse proxying to the UI
# backend while reusing the domain certificate.
domain_setup_ensure_www_site() {
    local domain="$1"
    domain_setup_ensure_proxy_site "www.$domain" "$domain" "$(domain_ui_backend_url)" "redirect" \
        "www.$domain $DOMAIN_API_PREFIX.$domain www.$DOMAIN_API_PREFIX.$domain"
}

# Idempotently (re)write the dashboard allowed-hosts file (one hostname per
# line: apex + www.<domain> + <prefix>.<domain> + www.<prefix>.<domain> for
# every bound domain).
# Content-hash idempotent via write_file_if_changed; the Vite config reads
# this constant path and keeps its defaults while the file is absent.
domain_setup_write_ui_allowed_hosts() {
    local domain
    local write_output

    write_output=$({
        while IFS= read -r domain; do
            [ -z "$domain" ] && continue
            echo "$domain"
            echo "www.$domain"
            echo "$DOMAIN_API_PREFIX.$domain"
            echo "www.$DOMAIN_API_PREFIX.$domain"
        done <<< "$DOMAIN_DOMAINS_LIST"
    } | write_file_if_changed "$DOMAIN_UI_ALLOWED_HOSTS_FILE")
    echo "$write_output"
    echo "[domain] [OK] UI allowed hosts file: $DOMAIN_UI_ALLOWED_HOSTS_FILE"

    # vite reads this file ONCE at startup; when the content changed the
    # running dashboard keeps the old host list (new domains answer 403), so
    # the service must be restarted to re-read it. No-op when [SKIP]ped.
    case "$write_output" in
        *written*) domain_setup_restart_ui_service ;;
    esac
    return 0
}

# Idempotently (re)write the UI domain config JSON carrying the API region
# prefix the frontend uses to build api.<prefix>.<domain> endpoints for HTTPS
# current-URL origins. Content-hash idempotent; the vite middleware re-reads
# the file on EVERY request, so no service restart is required.
domain_setup_write_ui_domain_config() {
    local write_output

    write_output=$(printf '{"apiRegionPrefix":"%s"}\n' "$DOMAIN_API_PREFIX" \
        | write_file_if_changed "$DOMAIN_UI_DOMAIN_CONFIG_FILE")
    echo "$write_output"
    echo "[domain] [OK] UI domain config file: $DOMAIN_UI_DOMAIN_CONFIG_FILE"
    return 0
}

# Restart the dashboard service so vite re-reads a changed allowed-hosts
# file. Idempotent: only an ACTIVE unit is restarted; without systemd (or
# without an active unit) a manual-restart hint is printed instead.
domain_setup_restart_ui_service() {
    local sudo_cmd
    sudo_cmd=$(lazy_sudo)

    if ! command -v systemctl >/dev/null 2>&1 || [ ! -d /run/systemd/system ]; then
        echo "[domain] [WARN] UI allowed hosts changed but systemd is unavailable; restart the dashboard so vite re-reads the file"
        return 0
    fi
    if systemctl is-active --quiet "$DOMAIN_UI_SERVICE_NAME" 2>/dev/null; then
        if $sudo_cmd systemctl restart "$DOMAIN_UI_SERVICE_NAME" 2>/dev/null; then
            echo "[domain] [OK] Restarted $DOMAIN_UI_SERVICE_NAME (vite re-reads the allowed-hosts file)"
        else
            echo "[domain] [WARN] Failed to restart $DOMAIN_UI_SERVICE_NAME; restart it manually"
        fi
    else
        echo "[domain] [WARN] UI allowed hosts changed; $DOMAIN_UI_SERVICE_NAME is not active - start/restart it so vite re-reads the file"
    fi
    return 0
}

# Converge the shared UI binding state and dashboard inputs. Plane-specific
# renderers call this one primitive, then re-probe DOMAIN_UI_BINDING_READY
# before writing nginx or Caddy routes.
domain_setup_prepare_ui_binding() {
    local binding_state=""

    DOMAIN_UI_BINDING_READY="no"
    DOMAIN_DOMAINS_LIST=""
    domain_setup_load_secrets
    if [ -z "$DOMAIN_DOMAINS_LIST" ]; then
        echo "[domain] [FAIL] UI binding needs at least one configured domain"
        return
    fi
    DOMAIN_API_PREFIX="$(domain_state_get "$DOMAIN_API_PREFIX_KEY" "si")"
    domain_state_set "$DOMAIN_UI_BINDING_KEY" "yes"
    binding_state="$(domain_state_get "$DOMAIN_UI_BINDING_KEY" "no")"
    if [ "$binding_state" != "yes" ]; then
        echo "[domain] [FAIL] UI binding state did not persist"
        return
    fi

    domain_setup_write_ui_allowed_hosts
    domain_setup_write_ui_domain_config
    if [ -s "$DOMAIN_UI_ALLOWED_HOSTS_FILE" ] && [ -s "$DOMAIN_UI_DOMAIN_CONFIG_FILE" ]; then
        DOMAIN_UI_BINDING_READY="yes"
        echo "[domain] [OK] Shared UI binding state ready"
    else
        echo "[domain] [FAIL] Shared UI binding files are not ready"
    fi
}

# Enable the dashboard binding on the nginx plane after converging the
# plane-neutral state above.
domain_setup_enable_ui_binding() {
    local domain=""

    domain_setup_prepare_ui_binding
    if [ "$DOMAIN_UI_BINDING_READY" != "yes" ]; then
        return
    fi

    echo "[domain] UI binding enabled: <domain> + www.<domain> + $DOMAIN_API_PREFIX.<domain> + www.$DOMAIN_API_PREFIX.<domain> -> $(domain_ui_backend_url)"
    while IFS= read -r domain; do
        [ -z "$domain" ] && continue
        domain_setup_ensure_apex_site "$domain"
        domain_setup_ensure_www_site "$domain"
    done <<< "$DOMAIN_DOMAINS_LIST"

    nginx_repair_sites || true
}

# Full idempotent domain installation: secrets -> prefix -> certificates ->
# nginx sites -> repair -> config test + reload.
# Usage: domain_setup_install_all [backend_url] [laravel_dir] [--skip-certs]
domain_setup_install_all() {
    local backend="${1:-$(domain_api_backend_url)}"
    local laravel_dir="${2:-$DOMAIN_SETUP_LARAVEL_DIR}"
    local skip_certs="${3:-}"
    local domain
    local failures=0

    domain_setup_load_secrets || return 1
    domain_setup_ensure_prefix || return 1
    domain_setup_persist_state

    echo "[domain] Installing domains (sites: <domain> apex + api.$DOMAIN_API_PREFIX.<domain>, both proxy -> backend):"
    echo "$DOMAIN_DOMAINS_LIST" | while IFS= read -r domain; do
        [ -n "$domain" ] && echo "[domain]   - $domain -> $domain + $(domain_setup_api_fqdn "$domain")"
    done

    while IFS= read -r domain; do
        [ -z "$domain" ] && continue
        if [ "$skip_certs" != "--skip-certs" ]; then
            domain_setup_issue_certificate "$domain" "$laravel_dir" || failures=$((failures + 1))
        fi
        domain_setup_ensure_apex_site "$domain" "$backend" || failures=$((failures + 1))
        domain_setup_ensure_api_site "$domain" || failures=$((failures + 1))
        if domain_setup_ui_binding_enabled; then
            domain_setup_ensure_www_site "$domain" || failures=$((failures + 1))
        fi
    done <<< "$DOMAIN_DOMAINS_LIST"

    # Converge the dashboard allowed-hosts file with the current secrets +
    # prefix on every run while the binding is enabled (content-hash no-op
    # when unchanged).
    if domain_setup_ui_binding_enabled; then
        domain_setup_write_ui_allowed_hosts
        domain_setup_write_ui_domain_config
    fi

    nginx_repair_sites || failures=$((failures + 1))

    if [ "$skip_certs" != "--skip-certs" ]; then
        domain_setup_print_certificate_summary "$laravel_dir"
    fi

    if [ $failures -eq 0 ]; then
        echo "[domain] [OK] All domains installed"
        return 0
    fi
    echo "[domain] [WARN] Domain installation completed with $failures warning(s)"
    return 1
}

# Certificates only (the old 133 scope).
domain_setup_certificates_only() {
    local laravel_dir="${1:-$DOMAIN_SETUP_LARAVEL_DIR}"
    local domain
    local failures=0

    domain_setup_load_secrets || return 1
    domain_setup_ensure_prefix || return 1
    domain_setup_persist_state

    while IFS= read -r domain; do
        [ -z "$domain" ] && continue
        domain_setup_issue_certificate "$domain" "$laravel_dir" || failures=$((failures + 1))
    done <<< "$DOMAIN_DOMAINS_LIST"

    domain_setup_print_certificate_summary "$laravel_dir"

    if [ $failures -eq 0 ]; then
        echo "[domain] [OK] All certificates verified"
        return 0
    fi
    echo "[domain] [WARN] $failures certificate(s) could not be issued"
    return 1
}
