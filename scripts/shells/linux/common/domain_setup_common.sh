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
# - idempotent nginx site install for api.<prefix>.<domain> (HTTP/3 + 301 +
#   TLS early data, rendered by nginx_common.sh) with per-site repair
# - idempotent certificate issuance through Laravel ServerManager (artisan)
#
# Load-time side effect free. USE_SUDO and the site directories are resolved
# lazily so this library is safe to source from both dd.sh installers (which
# have gvar_common.sh loaded) and plain app start scripts (which do not).

DOMAIN_SETUP_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$DOMAIN_SETUP_COMMON_DIR/nginx_common.sh"

DOMAIN_SETUP_REPO_ROOT="$(cd "$DOMAIN_SETUP_COMMON_DIR/../../../.." && pwd)"
DOMAIN_SETUP_CORE_NODE_DIR="${CORE_NODE_DIR:-$DOMAIN_SETUP_REPO_ROOT}"
DOMAIN_SETUP_SECRETS_DIR="$DOMAIN_SETUP_CORE_NODE_DIR/.secret_keys/.secret_ignore"
DOMAIN_SETUP_GLOBAL_VAR_DIR="${CORE_NODE_DATA_DIR:-/var/_core_node}/global_var"
DOMAIN_API_PREFIX_KEY="DOMAIN_API_REGION_PREFIX"
DOMAIN_SETUP_VALID_REGIONS="si sh sz hk"
DOMAIN_SETUP_LARAVEL_DIR="$DOMAIN_SETUP_CORE_NODE_DIR/poly_apps/laravel_main"

# Fallback definition of the shared writer from common_functions.sh. That file
# sources gvar_common.sh (heavy top-level side effects), so this library keeps
# a guarded local copy for start-script contexts; when common_functions.sh is
# already loaded the shared definition wins.
if ! declare -F write_file_if_changed >/dev/null 2>&1; then
write_file_if_changed() {
    local target="$1"
    local backup_dir="${2:-}"
    local tmp_content
    local sudo_cmd
    tmp_content=$(mktemp)
    cat > "$tmp_content"
    sudo_cmd=$(domain_setup_sudo)

    if [ -f "$target" ] && cmp -s "$tmp_content" "$target"; then
        rm -f "$tmp_content"
        echo "[domain] [SKIP] $target already up to date"
        return 0
    fi

    if [ -n "$backup_dir" ] && [ -f "$target" ]; then
        $sudo_cmd mkdir -p "$backup_dir"
        $sudo_cmd cp -a "$target" "$backup_dir/$(basename "$target").$(date +%Y%m%d%H%M%S).bak"
    fi
    $sudo_cmd mkdir -p "$(dirname "$target")"
    $sudo_cmd cp "$tmp_content" "$target"
    rm -f "$tmp_content"
    # House policy: idempotent-replace writes are mode 777 (NTFS no-op safe).
    $sudo_cmd chmod 777 "$target" 2>/dev/null || true
    echo "[domain] [OK] $target written"
    return 0
}
fi

DOMAIN_DNSPOD_EMAIL=""
DOMAIN_DNSPOD_TOKEN=""
DOMAIN_DOMAINS_LIST=""
DOMAIN_API_PREFIX=""

# Lazily resolve sudo (gvar_common.sh sets USE_SUDO when it is loaded).
domain_setup_sudo() {
    if [ -n "${USE_SUDO+x}" ]; then
        echo "$USE_SUDO"
    elif [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
        echo "sudo"
    else
        echo ""
    fi
}

# Persist one key in the file-backed global-var store (the user data
# directory). Reuses set_global_var when gvar_common.sh is loaded; otherwise
# writes the same one-file-per-key format directly.
domain_state_set() {
    local key="$1"
    local value="$2"
    local sudo_cmd
    sudo_cmd=$(domain_setup_sudo)

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
    sudo_cmd=$(domain_setup_sudo)

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
    domain_state_set "PHP_VERSION" "$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;' 2>/dev/null || echo 8.4)"
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

    pre_output=$(cd "$laravel_dir" && $(domain_setup_sudo) php artisan servermanager:certificate find "$domain" 2>&1 || true)
    if echo "$pre_output" | grep -q "Found certificate"; then
        echo "[domain] [SKIP] Certificate already exists for: $domain"
        echo "$pre_output" | grep "Expires:" | head -1 || true
        return 0
    fi

    echo "[domain] Issuing certificate: $domain (prefixes: $DOMAIN_API_PREFIX, provider: dnspod)"
    issue_output=$(cd "$laravel_dir" && \
        DNSPOD_EMAIL="$DOMAIN_DNSPOD_EMAIL" DNSPOD_API_TOKEN="$DOMAIN_DNSPOD_TOKEN" \
        $(domain_setup_sudo) php artisan servermanager:certificate add "$domain" \
        --prefixes="$DOMAIN_API_PREFIX" --provider=dnspod 2>&1)
    echo "$issue_output" | while IFS= read -r line; do echo "[domain]   $line"; done

    pre_output=$(cd "$laravel_dir" && $(domain_setup_sudo) php artisan servermanager:certificate find "$domain" 2>&1 || true)
    if echo "$pre_output" | grep -q "Found certificate"; then
        echo "[domain] [OK] Certificate verified for: $domain"
        return 0
    fi
    echo "[domain] [WARN] Certificate not present after issuance attempt: $domain (site falls back to HTTP bootstrap)"
    return 1
}

# Install the nginx site for api.<prefix>.<domain>. When the root domain
# certificate exists the full HTTP/3 + 301 + early-data vhost is written;
# otherwise an ACME-capable HTTP bootstrap. Content-hash idempotent: a site
# whose file differs from the canonical render is rewritten (site repair).
domain_setup_ensure_api_site() {
    local domain="$1"
    local backend="${2:-http://127.0.0.1:9000}"
    local fqdn
    local sites_available
    local sites_enabled
    local site_file
    local enabled_link
    local cert_path
    local sudo_cmd

    fqdn=$(domain_setup_api_fqdn "$domain")
    sites_available=$(nginx_get_sites_available)
    sites_enabled=$(nginx_get_sites_enabled)
    site_file="$sites_available/$fqdn"
    enabled_link="$sites_enabled/$fqdn"
    cert_path=$(nginx_le_cert_path "$domain")
    sudo_cmd=$(domain_setup_sudo)

    if [ -f "$cert_path" ]; then
        {
            echo "# $NGINX_MANAGED_SITE_MARKER domain_setup fqdn=$fqdn cert=$domain"
            nginx_render_proxy_vhost "$fqdn" "$backend" "$domain"
        } | write_file_if_changed "$site_file" "$(dirname "$sites_available")/backup"
    else
        {
            echo "# $NGINX_MANAGED_SITE_MARKER domain_setup fqdn=$fqdn bootstrap"
            nginx_render_http_bootstrap "$fqdn"
        } | write_file_if_changed "$site_file" "$(dirname "$sites_available")/backup"
    fi

    if [ ! -L "$enabled_link" ] || [ "$(readlink -f "$enabled_link" 2>/dev/null)" != "$(readlink -f "$site_file" 2>/dev/null)" ]; then
        $sudo_cmd mkdir -p "$sites_enabled"
        $sudo_cmd ln -sfn "$site_file" "$enabled_link"
        echo "[domain] [OK] Site enabled: $fqdn"
    fi
    return 0
}

# Full idempotent domain installation: secrets -> prefix -> certificates ->
# nginx sites -> repair -> config test + reload.
# Usage: domain_setup_install_all [backend_url] [laravel_dir] [--skip-certs]
domain_setup_install_all() {
    local backend="${1:-http://127.0.0.1:9000}"
    local laravel_dir="${2:-$DOMAIN_SETUP_LARAVEL_DIR}"
    local skip_certs="${3:-}"
    local domain
    local failures=0

    domain_setup_load_secrets || return 1
    domain_setup_ensure_prefix || return 1
    domain_setup_persist_state

    echo "[domain] Installing domains (API pattern: api.$DOMAIN_API_PREFIX.<domain>):"
    echo "$DOMAIN_DOMAINS_LIST" | while IFS= read -r domain; do
        [ -n "$domain" ] && echo "[domain]   - $domain -> $(domain_setup_api_fqdn "$domain")"
    done

    while IFS= read -r domain; do
        [ -z "$domain" ] && continue
        if [ "$skip_certs" != "--skip-certs" ]; then
            domain_setup_issue_certificate "$domain" "$laravel_dir" || failures=$((failures + 1))
        fi
        domain_setup_ensure_api_site "$domain" "$backend" || failures=$((failures + 1))
    done <<< "$DOMAIN_DOMAINS_LIST"

    nginx_repair_sites || failures=$((failures + 1))

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

    if [ $failures -eq 0 ]; then
        echo "[domain] [OK] All certificates verified"
        return 0
    fi
    echo "[domain] [WARN] $failures certificate(s) could not be issued"
    return 1
}
