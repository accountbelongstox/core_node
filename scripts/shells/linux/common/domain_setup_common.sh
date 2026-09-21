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
# - reading DNSPod credentials and the global service contract domain inventory
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
# Prompt helpers: single definition in prompt_common.sh (zero side effects).
if ! command -v prompt_read_default >/dev/null 2>&1; then
    source "$DOMAIN_SETUP_COMMON_DIR/prompt_common.sh"
fi
# Canonical service contract adapter (ports/hosts/paths single source). Must
# load BEFORE the DOMAIN_SETUP_* path variables below - they call sc_get at
# source time.
# shellcheck source=/dev/null
source "$DOMAIN_SETUP_COMMON_DIR/service_contract_common.sh"
# shellcheck source=/dev/null
source "$DOMAIN_SETUP_COMMON_DIR/web_access_common.sh"
# shellcheck source=/dev/null
source "$DOMAIN_SETUP_COMMON_DIR/nginx_common.sh"
# shellcheck source=/dev/null
source "$DOMAIN_SETUP_COMMON_DIR/arrow_menu.sh"
# shellcheck source=/dev/null
source "$DOMAIN_SETUP_COMMON_DIR/network_detect_common.sh"

DOMAIN_SETUP_REPO_ROOT="$(cd "$DOMAIN_SETUP_COMMON_DIR/../../../.." && pwd)"
DOMAIN_SETUP_CORE_NODE_DIR="${CORE_NODE_DIR:-$DOMAIN_SETUP_REPO_ROOT}"
DOMAIN_SETUP_SECRETS_DIR="$DOMAIN_SETUP_CORE_NODE_DIR/.secret_keys/.secret_ignore"
DOMAIN_SETUP_GLOBAL_VAR_DIR="${CORE_NODE_DATA_DIR:-$(sc_get paths.core_node_data_dir_posix)}/$(sc_get paths.global_var_dir_name)"
DOMAIN_API_PREFIX_KEY="DOMAIN_API_REGION_PREFIX"
DOMAIN_UI_BINDING_KEY="DOMAIN_UI_BINDING"
DOMAIN_UI_SERVICE_NAME="ncore-nexus-dash"

# Canonical backend URLs resolve from the central service contract
# (config/service_contract.json) at CALL time via the shell adapter - ports
# and hosts are never hardcoded in this library. An unreadable contract is a
# hard failure: an empty host/port would otherwise render "server :;" and
# break nginx -t for the whole include tree.
domain_api_backend_url() {
    local host
    local port
    host=$(sc_require hosts.loopback)
    port=$(sc_require ports.laravel_api_backend)
    if [ -n "$host" ] && [ -n "$port" ]; then
        echo "http://$host:$port"
    fi
}
domain_ui_backend_url() {
    local host
    local port
    host=$(sc_require hosts.loopback)
    port=$(sc_require ports.nexus_dash_frontend)
    if [ -n "$host" ] && [ -n "$port" ]; then
        echo "http://$host:$port"
    fi
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
DOMAIN_UI_BINDING_ENABLED="no"
DOMAIN_UI_BINDING_READY="no"

# Network environment state (domain_setup_detect_environment). LAN mode
# means no public IP is bound to a local interface: the public-domain prefix
# menu and public certificate issuance are skipped, and local certificates
# (127.0.0.1 via mkcert + the Tailscale ts.net certificate) are provisioned
# or printed instead. DOMAIN_SETUP_NET_MODE=server|lan forces the mode.
DOMAIN_ENV_LAN_MODE="no"
DOMAIN_ENV_PUBLIC_IP=""
DOMAIN_ENV_TAILSCALE_IPV4=""
DOMAIN_TS_DNSNAME=""
DOMAIN_LAN_OUTPUT=""
# TAILSCALE_DOMAIN_1 secret constant: the tailnet base domain (e.g.
# thresher-python.ts.net) the machine ts.net DNS name must live under.
DOMAIN_TAILSCALE_DOMAIN=""
# LAN certificate directory: resolved lazily by
# domain_setup_resolve_lan_cert_dir (the NTFS shared-disk mapping runs at
# call time, after mounts are up). Never inside the repo.
DOMAIN_LAN_CERT_DIR=""
# Resolved LAN certificate material (consumed by the frankenphp LAN site).
DOMAIN_LAN_TS_CERT=""
DOMAIN_LAN_TS_KEY=""
DOMAIN_LAN_MKCERT_PEM=""
DOMAIN_LAN_MKCERT_KEY=""
DOMAIN_MKCERT_VERSION="v1.4.4"

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

    web_access_resolve
    DOMAIN_DOMAINS_LIST="$WEB_ACCESS_DOMAINS"
    if [ -z "$DOMAIN_DOMAINS_LIST" ]; then
        echo "[domain] ERROR: service contract has no valid root domains"
        return 1
    fi

    echo "[domain] [OK] Secrets loaded (domains: $(echo "$DOMAIN_DOMAINS_LIST" | wc -l | tr -d ' '))"
    return 0
}

# TTY-safe prompt defaulting to No; non-interactive shells answer No.
domain_setup_ask_no() {
    local msg="$1"
    local reply=""
    prompt_read_default reply "" 30 "$msg [y/N] "
    case "$reply" in [Yy]*) return 0 ;; *) return 1 ;; esac
}

# Validate a region prefix token.
domain_setup_prefix_valid() {
    echo "$1" | grep -qE '^[a-z0-9][a-z0-9-]{0,30}$'
}

# Classify this host: public server vs LAN/desktop (network_detect_common).
# DOMAIN_SETUP_NET_MODE=server|lan overrides the probe (e.g. a NAT-ed VPS
# that still wants DNS-01 public certificates).
domain_setup_detect_environment() {
    DOMAIN_ENV_LAN_MODE="no"
    case "${DOMAIN_SETUP_NET_MODE:-auto}" in
        lan)
            DOMAIN_ENV_LAN_MODE="yes"
            ;;
        server)
            DOMAIN_ENV_LAN_MODE="no"
            ;;
        *)
            net_env_detect
            DOMAIN_ENV_PUBLIC_IP="$NET_ENV_PUBLIC_IP"
            DOMAIN_ENV_TAILSCALE_IPV4="$NET_ENV_TAILSCALE_IPV4"
            if [ "$NET_ENV_IS_LAN" = "yes" ]; then
                DOMAIN_ENV_LAN_MODE="yes"
            fi
            ;;
    esac
    if [ "$DOMAIN_ENV_LAN_MODE" = "yes" ]; then
        echo "[domain] Network environment: LAN/desktop (no public IP bound to a local interface; public IP: ${DOMAIN_ENV_PUBLIC_IP:-none}, tailscale IP: ${DOMAIN_ENV_TAILSCALE_IPV4:-none})"
        echo "[domain] Skipping the API region prefix selection and public certificate issuance; switching to local certificates (127.0.0.1 + Tailscale LAN IP)."
    else
        echo "[domain] Network environment: public server (public IP bound locally: ${DOMAIN_ENV_PUBLIC_IP:-unknown})"
    fi
    return 0
}

# Read the TAILSCALE_DOMAIN_1 secret constant (the tailnet base domain, e.g.
# thresher-python.ts.net). Prefers the shared constant-centre reader when
# common_functions.sh is loaded; otherwise reads the same file directly.
# Populates DOMAIN_TAILSCALE_DOMAIN; missing constant is NOT an error (the
# machine DNS name is still resolved from tailscaled itself).
domain_setup_load_tailscale_domain() {
    DOMAIN_TAILSCALE_DOMAIN=""
    if declare -F get_secret_key_from_common_functions >/dev/null 2>&1; then
        DOMAIN_TAILSCALE_DOMAIN="$(get_secret_key_from_common_functions "TAILSCALE_DOMAIN_1" 2>/dev/null | tr -d '\0\r ')"
    elif [ -f "$DOMAIN_SETUP_SECRETS_DIR/TAILSCALE_DOMAIN_1" ]; then
        DOMAIN_TAILSCALE_DOMAIN="$(tr -d '\0' < "$DOMAIN_SETUP_SECRETS_DIR/TAILSCALE_DOMAIN_1" | sed '/^\s*$/d' | head -1 | tr -d '\r ')"
    fi
    if [ -n "$DOMAIN_TAILSCALE_DOMAIN" ]; then
        echo "[domain] [OK] Tailscale tailnet constant loaded: $DOMAIN_TAILSCALE_DOMAIN (TAILSCALE_DOMAIN_1)"
    else
        echo "[domain] [WARN] TAILSCALE_DOMAIN_1 secret constant not found; the tailnet suffix check is skipped"
    fi
    return 0
}

# Echo this machine's ts.net DNS name (without the trailing dot); empty when
# tailscaled cannot report it. Self.DNSName is authoritative (the machine
# HostName can differ from the cert-valid name, e.g. hostname "debian" vs
# cert name "debian-gpu.<tailnet>"); the TAILSCALE_DOMAIN_1 constant gates
# the result so a foreign-tailnet name is never certified.
domain_setup_tailscale_dnsname() {
    local dns=""
    if command -v python3 >/dev/null 2>&1; then
        dns=$(tailscale status --json 2>/dev/null | python3 -c 'import sys, json
try:
    print(json.load(sys.stdin).get("Self", {}).get("DNSName", "").rstrip("."))
except Exception:
    pass' 2>/dev/null)
    fi
    if [ -z "$dns" ]; then
        dns=$(tailscale status --json 2>/dev/null | sed -n 's/.*"DNSName": *"\([^"]*\)".*/\1/p' | head -1)
        dns="${dns%.}"
    fi
    if [ -n "$dns" ] && [ -n "$DOMAIN_TAILSCALE_DOMAIN" ]; then
        case "$dns" in
            *."$DOMAIN_TAILSCALE_DOMAIN"|"$DOMAIN_TAILSCALE_DOMAIN") ;;
            *)
                echo "[domain] [WARN] Machine DNS name '$dns' is outside the configured tailnet '$DOMAIN_TAILSCALE_DOMAIN'; refusing it"
                dns=""
                ;;
        esac
    fi
    printf '%s' "$dns"
}

# Resolve the LAN certificate directory into DOMAIN_LAN_CERT_DIR. The certs
# live in the USER DATA tree (never in the repo, never committed). Cross-OS
# rule (one machine dual-booting Windows/Debian off the shared NTFS data
# disk must see the SAME files): Windows pins CORE_NODE_DATA_DIR to
# <data-drive>:\var\_core_node (paths.core_node_data_dir_windows_subpath);
# when Debian bind-mounts that NTFS disk root at /www (ensure_www_base_mount),
# the SAME directory is /www/var/_core_node. Detection mirrors
# gvar_common.sh::www_ntfs_root_mounted (reused when loaded; inline findmnt
# fallback otherwise). Linux-only machines keep the native
# CORE_NODE_DATA_DIR (/var/_core_node).
domain_setup_resolve_lan_cert_dir() {
    local ntfs_mounted="no"
    local src_www=""
    local src_root=""

    if declare -F www_ntfs_root_mounted >/dev/null 2>&1; then
        if www_ntfs_root_mounted; then
            ntfs_mounted="yes"
        fi
    elif command -v findmnt >/dev/null 2>&1 && [ -d /www/www ]; then
        src_www="$(findmnt -n -o SOURCE --target /www 2>/dev/null | head -n1)"
        src_root="$(findmnt -n -o SOURCE --target / 2>/dev/null | head -n1)"
        if [ -n "$src_www" ] && [ -n "$src_root" ] && [ "$src_www" != "$src_root" ]; then
            ntfs_mounted="yes"
        fi
    fi

    if [ "$ntfs_mounted" = "yes" ]; then
        DOMAIN_LAN_CERT_DIR="/www/var/_core_node/certs/local"
    else
        DOMAIN_LAN_CERT_DIR="${CORE_NODE_DATA_DIR:-$(sc_get paths.core_node_data_dir_posix)}/certs/local"
    fi
    return 0
}

# Re-resolve the LAN certificate paths from disk (certs may predate this
# run). Populates DOMAIN_LAN_TS_CERT/KEY and DOMAIN_LAN_MKCERT_PEM/KEY.
domain_setup_lan_cert_paths_refresh() {
    DOMAIN_LAN_TS_CERT=""
    DOMAIN_LAN_TS_KEY=""
    DOMAIN_LAN_MKCERT_PEM=""
    DOMAIN_LAN_MKCERT_KEY=""
    domain_setup_resolve_lan_cert_dir
    if [ -z "$DOMAIN_TAILSCALE_DOMAIN" ]; then
        domain_setup_load_tailscale_domain
    fi
    if [ -z "$DOMAIN_TS_DNSNAME" ] && command -v tailscale >/dev/null 2>&1; then
        DOMAIN_TS_DNSNAME="$(domain_setup_tailscale_dnsname)"
    fi
    if [ -n "$DOMAIN_TS_DNSNAME" ] \
        && [ -f "$DOMAIN_LAN_CERT_DIR/$DOMAIN_TS_DNSNAME.crt" ] \
        && [ -f "$DOMAIN_LAN_CERT_DIR/$DOMAIN_TS_DNSNAME.key" ]; then
        DOMAIN_LAN_TS_CERT="$DOMAIN_LAN_CERT_DIR/$DOMAIN_TS_DNSNAME.crt"
        DOMAIN_LAN_TS_KEY="$DOMAIN_LAN_CERT_DIR/$DOMAIN_TS_DNSNAME.key"
    fi
    DOMAIN_LAN_MKCERT_PEM="$(ls "$DOMAIN_LAN_CERT_DIR"/127.0.0.1+*.pem 2>/dev/null | grep -v -- '-key\.pem$' | head -1)"
    DOMAIN_LAN_MKCERT_KEY="$(ls "$DOMAIN_LAN_CERT_DIR"/127.0.0.1+*-key.pem 2>/dev/null | head -1)"
}

# 127.0.0.1 / localhost certificate through mkcert. Direct when mkcert is
# installed; otherwise a best-effort automatic install runs first (apt
# package, then the official GitHub release binary, then a source clone +
# go build), with all downloads under the constant-centre shared download
# directory. Manual steps print only when every automatic path fails
# (public CAs cannot validate the loopback address, so a local CA is the
# canonical path).
domain_setup_mkcert_install() {
    local sudo_cmd
    local arch=""
    local mkcert_url=""
    local dl_dir=""
    local dl_bin=""
    local src_dir=""
    sudo_cmd=$(lazy_sudo)
    dl_dir="${CORE_NODE_SHARED_DOWNLOADS:-${CORE_NODE_DATA_DIR:-/var/_core_node}/shared_downloads}/mkcert"
    dl_bin="$dl_dir/mkcert"
    src_dir="$dl_dir/src"

    echo "[domain] mkcert not found; attempting automatic installation..."
    if command -v apt-get >/dev/null 2>&1; then
        $sudo_cmd apt-get install -y mkcert libnss3-tools >/dev/null 2>&1 || {
            $sudo_cmd apt-get update -y >/dev/null 2>&1
            $sudo_cmd apt-get install -y mkcert libnss3-tools >/dev/null 2>&1
        }
        if command -v mkcert >/dev/null 2>&1; then
            echo "[domain] [OK] mkcert installed via apt"
            return 0
        fi
    fi

    case "$(uname -m 2>/dev/null)" in
        x86_64|amd64) arch="amd64" ;;
        aarch64|arm64) arch="arm64" ;;
    esac
    if [ -n "$arch" ] && command -v curl >/dev/null 2>&1; then
        mkdir -p "$dl_dir" 2>/dev/null || true
        mkcert_url="https://github.com/FiloSottile/mkcert/releases/latest/download/mkcert-${DOMAIN_MKCERT_VERSION}-linux-${arch}"
        if [ ! -x "$dl_bin" ] || ! "$dl_bin" -version >/dev/null 2>&1; then
            echo "[domain] Downloading mkcert: $mkcert_url"
            curl -fsSL "$mkcert_url" -o "$dl_bin" 2>/dev/null && chmod +x "$dl_bin" 2>/dev/null
        fi
        if [ -x "$dl_bin" ] && "$dl_bin" -version >/dev/null 2>&1; then
            $sudo_cmd cp "$dl_bin" /usr/local/bin/mkcert 2>/dev/null \
                && $sudo_cmd chmod +x /usr/local/bin/mkcert 2>/dev/null
            hash -r 2>/dev/null
            if command -v mkcert >/dev/null 2>&1; then
                echo "[domain] [OK] mkcert installed to /usr/local/bin/mkcert (download cache: $dl_bin)"
                return 0
            fi
        fi
    fi

    # Last automatic path: clone the project and build from source (needs git
    # + a Go toolchain; the clone is cached in the shared download dir).
    if command -v git >/dev/null 2>&1 && command -v go >/dev/null 2>&1; then
        mkdir -p "$dl_dir" 2>/dev/null || true
        if [ ! -d "$src_dir/.git" ]; then
            echo "[domain] Cloning mkcert: https://github.com/FiloSottile/mkcert -> $src_dir"
            git clone --depth 1 https://github.com/FiloSottile/mkcert "$src_dir" >/dev/null 2>&1
        fi
        if [ -d "$src_dir" ]; then
            echo "[domain] Building mkcert from source (go build)..."
            (cd "$src_dir" && go build -o "$dl_bin" . >/dev/null 2>&1)
            if [ -x "$dl_bin" ] && "$dl_bin" -version >/dev/null 2>&1; then
                $sudo_cmd cp "$dl_bin" /usr/local/bin/mkcert 2>/dev/null \
                    && $sudo_cmd chmod +x /usr/local/bin/mkcert 2>/dev/null
                hash -r 2>/dev/null
                if command -v mkcert >/dev/null 2>&1; then
                    echo "[domain] [OK] mkcert built from source and installed to /usr/local/bin/mkcert"
                    return 0
                fi
            fi
        fi
    fi
    echo "[domain] [WARN] Automatic mkcert installation failed"
    return 1
}

domain_setup_lan_cert_mkcert() {
    local mkcert_bin
    mkcert_bin="$(command -v mkcert 2>/dev/null || true)"
    domain_setup_resolve_lan_cert_dir
    mkdir -p "$DOMAIN_LAN_CERT_DIR" 2>/dev/null || true

    if [ -z "$mkcert_bin" ]; then
        domain_setup_mkcert_install || true
        hash -r 2>/dev/null
        mkcert_bin="$(command -v mkcert 2>/dev/null || true)"
    fi
    if [ -z "$mkcert_bin" ]; then
        echo "[domain] [MANUAL] mkcert not installed; create the trusted 127.0.0.1 certificate with:"
        echo "[domain]   1) sudo apt update && sudo apt install -y mkcert libnss3-tools"
        echo "[domain]      (if the apt package is unavailable: download mkcert from https://github.com/FiloSottile/mkcert/releases and install it to /usr/local/bin/mkcert, chmod +x, plus sudo apt install -y libnss3-tools)"
        echo "[domain]   2) mkcert -install    (installs the local CA into the system/browser trust store)"
        echo "[domain]   3) cd \"$DOMAIN_LAN_CERT_DIR\" && mkcert 127.0.0.1 localhost ::1"
        echo "[domain]      -> creates 127.0.0.1+2.pem (certificate) and 127.0.0.1+2-key.pem (private key)"
        echo "[domain]   4) Re-run this setup: the https://127.0.0.1:${FM_DOMAIN_HTTPS_PORT:-443} site is added to the FrankenPHP LAN route automatically"
        return 1
    fi

    echo "[domain] mkcert present; ensuring the local CA and the 127.0.0.1 certificate in $DOMAIN_LAN_CERT_DIR ..."
    (cd "$DOMAIN_LAN_CERT_DIR" && "$mkcert_bin" -install 2>&1) | while IFS= read -r DOMAIN_LAN_OUTPUT; do echo "[domain]   $DOMAIN_LAN_OUTPUT"; done
    (cd "$DOMAIN_LAN_CERT_DIR" && "$mkcert_bin" 127.0.0.1 localhost ::1 2>&1) | while IFS= read -r DOMAIN_LAN_OUTPUT; do echo "[domain]   $DOMAIN_LAN_OUTPUT"; done
    domain_setup_lan_cert_paths_refresh
    if [ -n "$DOMAIN_LAN_MKCERT_PEM" ] && [ -n "$DOMAIN_LAN_MKCERT_KEY" ]; then
        echo "[domain] [OK] 127.0.0.1 certificate ready: $DOMAIN_LAN_MKCERT_PEM (+ key)"
        return 0
    fi
    echo "[domain] [WARN] mkcert ran but the 127.0.0.1 certificate files were not found in $DOMAIN_LAN_CERT_DIR"
    return 1
}

# Tailscale LAN IP certificate through the ts.net MagicDNS/HTTPS integration
# (Let's Encrypt via DNS-01, issued by tailscaled). Direct when tailscaled is
# up and HTTPS certs are enabled; otherwise prints the manual steps.
domain_setup_lan_cert_tailscale() {
    local ts_bin
    local ts_output=""
    ts_bin="$(command -v tailscale 2>/dev/null || true)"
    domain_setup_resolve_lan_cert_dir
    mkdir -p "$DOMAIN_LAN_CERT_DIR" 2>/dev/null || true
    domain_setup_load_tailscale_domain

    if [ -z "$ts_bin" ]; then
        echo "[domain] [MANUAL] tailscale not installed; to get a trusted certificate for the Tailscale LAN IP:"
        echo "[domain]   1) curl -fsSL https://tailscale.com/install.sh | sh"
        echo "[domain]   2) sudo tailscale up"
        echo "[domain]   3) Web admin console (https://login.tailscale.com/admin) -> DNS -> enable MagicDNS, then Settings -> HTTPS -> Enable HTTPS"
        echo "[domain]   4) cd \"$DOMAIN_LAN_CERT_DIR\" && tailscale cert <machine>.${DOMAIN_TAILSCALE_DOMAIN:-<tailnet>.ts.net}"
        return 1
    fi
    if ! "$ts_bin" status >/dev/null 2>&1; then
        echo "[domain] [MANUAL] tailscale is installed but not connected; run: sudo tailscale up"
        echo "[domain]   Then enable HTTPS in the web admin console (https://login.tailscale.com/admin -> Settings -> HTTPS) and run:"
        echo "[domain]   cd \"$DOMAIN_LAN_CERT_DIR\" && tailscale cert <machine>.${DOMAIN_TAILSCALE_DOMAIN:-<tailnet>.ts.net}"
        return 1
    fi

    # tailscaled is running on a LAN-only host: the ts.net certificate is the
    # canonical trusted cert path, gated on the WEB admin console switches.
    echo "[domain] tailscaled is up (LAN-only host). Prerequisite in the WEB admin console: MagicDNS + HTTPS enabled (https://login.tailscale.com/admin -> Settings -> HTTPS)."

    DOMAIN_TS_DNSNAME="$(domain_setup_tailscale_dnsname)"
    if [ -z "$DOMAIN_TS_DNSNAME" ]; then
        echo "[domain] [MANUAL] Could not resolve this machine's ts.net DNS name; find it with 'tailscale status', then:"
        echo "[domain]   cd \"$DOMAIN_LAN_CERT_DIR\" && tailscale cert <machine>.${DOMAIN_TAILSCALE_DOMAIN:-<tailnet>.ts.net}"
        echo "[domain]   (requires MagicDNS + HTTPS enabled in the web admin console: Settings -> HTTPS)"
        return 1
    fi

    echo "[domain] Requesting the Tailscale certificate for $DOMAIN_TS_DNSNAME ..."
    ts_output="$(cd "$DOMAIN_LAN_CERT_DIR" && "$ts_bin" cert "$DOMAIN_TS_DNSNAME" 2>&1)"
    if [ $? -eq 0 ]; then
        echo "$ts_output" | while IFS= read -r DOMAIN_LAN_OUTPUT; do echo "[domain]   $DOMAIN_LAN_OUTPUT"; done
        domain_setup_lan_cert_paths_refresh
        echo "[domain] [OK] Tailscale certificate ready for $DOMAIN_TS_DNSNAME (globally trusted, Let's Encrypt): ${DOMAIN_LAN_TS_CERT:-$DOMAIN_LAN_CERT_DIR/$DOMAIN_TS_DNSNAME.crt}"
        return 0
    fi
    echo "[domain] [MANUAL] tailscale cert failed for $DOMAIN_TS_DNSNAME; enable HTTPS certificates first:"
    echo "[domain]   1) Web admin console (https://login.tailscale.com/admin) -> Settings -> HTTPS -> Enable HTTPS (requires MagicDNS)"
    echo "[domain]   2) Re-run: cd \"$DOMAIN_LAN_CERT_DIR\" && tailscale cert $DOMAIN_TS_DNSNAME"
    echo "$ts_output" | while IFS= read -r DOMAIN_LAN_OUTPUT; do echo "[domain]   $DOMAIN_LAN_OUTPUT"; done
    return 1
}

# LAN-mode certificate replacement for the public-domain flow: best-effort
# direct issuance where the tooling exists, printed steps where it does not.
domain_setup_lan_certificates() {
    echo "[domain] Provisioning local certificates (LAN mode):"
    domain_setup_lan_cert_mkcert || true
    domain_setup_lan_cert_tailscale || true
    domain_setup_lan_cert_paths_refresh
    return 0
}

# Ensure the region prefix used to build api.<prefix>.<domain> sites.
# The choice is persisted in the global-var store; later runs only ask
# whether to modify the stored value instead of prompting from scratch.
domain_setup_ensure_prefix() {
    local stored
    local choice
    local custom
    local selected_index=0
    local -a prefix_menu_items=("si" "sh" "sz" "hk" "Custom prefix")

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

    if [ -t 0 ] && [ -r /dev/tty ]; then
        arrow_menu_select "Select API Region Prefix" prefix_menu_items 0 -1 || true
        selected_index=$ARROW_MENU_SELECTED_INDEX
    fi
    case "$selected_index" in
        0) choice="si" ;;
        1) choice="sh" ;;
        2) choice="sz" ;;
        3) choice="hk" ;;
        4)
            custom=""
            prompt_read_default custom "" 30 "[domain] Custom prefix: "
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
    domain_setup_resolve_ui_binding_state
    if [ "$DOMAIN_UI_BINDING_ENABLED" = "yes" ]; then
        backend="$(domain_ui_backend_url)"
    fi
    domain_setup_ensure_proxy_site "$domain" "$domain" "$backend"
}

# Resolve the persisted dashboard binding into an explicit shared state value.
domain_setup_resolve_ui_binding_state() {
    DOMAIN_UI_BINDING_ENABLED="$(domain_state_get "$DOMAIN_UI_BINDING_KEY" "no")"
    if [ "$DOMAIN_UI_BINDING_ENABLED" != "yes" ]; then
        DOMAIN_UI_BINDING_ENABLED="no"
    fi
}

# Install the dashboard aliases for one domain: www.<domain>,
# <prefix>.<domain> and www.<prefix>.<domain>, reverse proxying to the UI
# backend while reusing the domain certificate.
domain_setup_ensure_www_site() {
    local domain="$1"
    domain_setup_ensure_proxy_site "www.$domain" "$domain" "$(domain_ui_backend_url)" "redirect" \
        "www.$domain $DOMAIN_API_PREFIX.$domain www.$DOMAIN_API_PREFIX.$domain"
}

domain_setup_write_web_access_config() {
    WEB_ACCESS_API_REGION_PREFIX="$DOMAIN_API_PREFIX"
    web_access_config_ensure
    if [ "$WEB_ACCESS_CONFIG_CHANGED" = "true" ]; then
        domain_setup_restart_ui_service
    fi
}

# Restart the dashboard service so vite re-reads a changed allowed-hosts
# file. Idempotent: only an ACTIVE unit is restarted; without systemd (or
# without an active unit) a manual-restart hint is printed instead.
domain_setup_restart_ui_service() {
    local sudo_cmd
    sudo_cmd=$(lazy_sudo)

    if ! command -v systemctl >/dev/null 2>&1 || [ ! -d /run/systemd/system ]; then
        echo "[domain] [WARN] Web access config changed but systemd is unavailable; restart the dashboard so Vite re-reads allowedHosts"
        return 0
    fi
    if systemctl is-active --quiet "$DOMAIN_UI_SERVICE_NAME" 2>/dev/null; then
        if $sudo_cmd systemctl restart "$DOMAIN_UI_SERVICE_NAME" 2>/dev/null; then
            echo "[domain] [OK] Restarted $DOMAIN_UI_SERVICE_NAME (Vite re-read allowedHosts)"
        else
            echo "[domain] [WARN] Failed to restart $DOMAIN_UI_SERVICE_NAME; restart it manually"
        fi
    else
        echo "[domain] [WARN] Web access config changed; $DOMAIN_UI_SERVICE_NAME is not active"
    fi
    return 0
}

# Converge the shared UI binding state and dashboard inputs. Plane-specific
# renderers call this one primitive, then re-probe DOMAIN_UI_BINDING_READY
# before writing nginx or Caddy routes.
domain_setup_prepare_ui_binding() {
    DOMAIN_UI_BINDING_ENABLED="no"
    DOMAIN_UI_BINDING_READY="no"
    DOMAIN_DOMAINS_LIST=""
    domain_setup_load_secrets
    if [ -z "$DOMAIN_DOMAINS_LIST" ]; then
        echo "[domain] [FAIL] UI binding needs at least one configured domain"
        return
    fi
    DOMAIN_API_PREFIX="$(domain_state_get "$DOMAIN_API_PREFIX_KEY" "si")"
    domain_state_set "$DOMAIN_UI_BINDING_KEY" "yes"
    domain_setup_resolve_ui_binding_state
    if [ "$DOMAIN_UI_BINDING_ENABLED" != "yes" ]; then
        echo "[domain] [FAIL] UI binding state did not persist"
        return
    fi

    domain_setup_write_web_access_config
    if [ "$WEB_ACCESS_CONFIG_READY" = "yes" ]; then
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

    domain_setup_detect_environment
    if [ "$DOMAIN_ENV_LAN_MODE" = "yes" ]; then
        domain_setup_lan_certificates
        return 0
    fi

    domain_setup_load_secrets || return 1
    domain_setup_ensure_prefix || return 1
    domain_setup_persist_state
    domain_setup_resolve_ui_binding_state

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
        if [ "$DOMAIN_UI_BINDING_ENABLED" = "yes" ]; then
            domain_setup_ensure_www_site "$domain" || failures=$((failures + 1))
        fi
    done <<< "$DOMAIN_DOMAINS_LIST"

    if [ "$DOMAIN_UI_BINDING_ENABLED" = "yes" ]; then
        domain_setup_write_web_access_config
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

    domain_setup_detect_environment
    if [ "$DOMAIN_ENV_LAN_MODE" = "yes" ]; then
        domain_setup_lan_certificates
        return 0
    fi

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
