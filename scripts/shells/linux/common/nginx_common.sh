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

# Shared nginx install/manage library. Single source of truth for:
# - official nginx.org mainline repository setup (nginx > 1.30, HTTP/3 ready)
# - version / vendor / OpenSSL capability probing
# - legacy installation replacement with config preservation
# - optional source build against OpenSSL >= 3.5.1 (full QUIC 0-RTT)
# - modern TLS/HTTP3 vhost stanza rendering (used by installer AND manager)
# Requires: gvar_common.sh (GLOBAL_VAR_DIR, USE_SUDO, IS_WSL) already sourced.

NGINX_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$NGINX_COMMON_DIR/apt_repository_manager.sh"
# Shared idempotent-replace writer + canonical lazy sudo (single source of
# truth, shared with domain_setup_common.sh / cert_selfheal_common.sh /
# common_functions.sh). Side-effect free; safe in any load order.
# shellcheck source=/dev/null
source "$NGINX_COMMON_DIR/file_ops_common.sh"
# Shared edge-port guard (80/TCP, 443/TCP, 443/UDP occupier stop + y/N
# uninstall); the reload verification and restart pre-flight below build on it.
# shellcheck source=/dev/null
source "$NGINX_COMMON_DIR/port_guard_common.sh"

NGINX_COMMON_NAMESPACE="nginx"
NGINX_MINIMUM_VERSION="1.30.0"
NGINX_MAINLINE_VERSION="1.31.3"
NGINX_OPENSSL_QUIC_VERSION="3.5.1"
NGINX_SIGNING_KEY_URL="https://nginx.org/keys/nginx_signing.key"
NGINX_SIGNING_KEY_FINGERPRINT="573BFD6B3D8FBC641079A6ABABF5BD827BD9BF62"
NGINX_KEYRING_FILE="/usr/share/keyrings/nginx-archive-keyring.gpg"
NGINX_SOURCE_BASE="/usr/local/src/nginx-build"
NGINX_SOURCE_PREFIX="/usr/local/nginx"
NGINX_SOURCE_CONF_PATH="/etc/nginx/nginx.conf"
NGINX_KNOWN_ALIAS_PATHS=(
    "/usr/local/bin/nginx"
    "/usr/sbin/nginx"
    "/usr/bin/nginx"
    "/usr/local/sbin/nginx"
)

# Canonical filesystem constants — the single shell-side source, shared by
# nginx_manager.sh / domain_setup_common.sh / cert_selfheal_common.sh /
# 26_install_nginx.sh / 27_install_certbot.sh / 132_laravel_main_start.sh.
# The Laravel end mirrors the same paths through PathMapper::mapWebPath()
# (ServerManagerV1PathConfig) — the cross-language SYNC CONTRACT. Paths are
# identical on Ubuntu / Debian / Kali.
NGINX_MAIN_CONF="${NGINX_MAIN_CONF:-/etc/nginx/nginx.conf}"
NGINX_LOG_DIR="${NGINX_LOG_DIR:-/var/log/nginx}"
NGINX_CONF_D="${NGINX_CONF_D:-/etc/nginx/conf.d}"
NGINX_LEGACY_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_LEGACY_SITES_ENABLED="/etc/nginx/sites-enabled"
NGINX_SYSTEMD_UNIT_FILE="/etc/systemd/system/nginx.service"
CERTBOT_BIN_LINK="/usr/local/bin/certbot"
CERTBOT_DEFAULT_CONFIG_DIR="/etc/letsencrypt"

# Compare two dotted versions; returns 0 when v1 >= v2.
# Usage: nginx_version_ge <v1> <v2>
nginx_version_ge() {
    local v1="$1"
    local v2="$2"
    local i
    local a
    local b
    local v1_parts
    local v2_parts

    IFS='.' read -ra v1_parts <<< "$v1"
    IFS='.' read -ra v2_parts <<< "$v2"
    for i in 0 1 2; do
        a=${v1_parts[$i]:-0}
        b=${v2_parts[$i]:-0}
        a=$(echo "$a" | grep -oE '^[0-9]+' || echo 0)
        b=$(echo "$b" | grep -oE '^[0-9]+' || echo 0)
        if [ "$a" -gt "$b" ]; then
            return 0
        fi
        if [ "$a" -lt "$b" ]; then
            return 1
        fi
    done
    return 0
}

# Pick the single real nginx binary the system should run (never a symlink).
# Source builds win over package installs; otherwise keep the highest version.
nginx_resolve_canonical_binary() {
    local candidate
    local best=""
    local best_version=""
    local version=""
    local candidates=(
        "$NGINX_SOURCE_PREFIX/sbin/nginx"
        "/usr/sbin/nginx"
        "/usr/bin/nginx"
        "/usr/local/sbin/nginx"
    )

    if [ -x "$NGINX_SOURCE_PREFIX/sbin/nginx" ] && [ ! -L "$NGINX_SOURCE_PREFIX/sbin/nginx" ]; then
        # Only OUR managed source build wins by default: the marker file, or a
        # compile-time conf-path pointing at the canonical main config. A
        # foreign vanilla build at the same prefix defaults to
        # <prefix>/conf/nginx.conf — letting it become canonical would strand
        # every managed site write in /etc/nginx while the master keeps
        # serving the foreign world. Foreign builds go through migrate-legacy.
        if [ -f "$NGINX_SOURCE_PREFIX/.core_node_source_build" ] || \
           "$NGINX_SOURCE_PREFIX/sbin/nginx" -V 2>&1 | grep -qF -- "--conf-path=$NGINX_MAIN_CONF"; then
            echo "$NGINX_SOURCE_PREFIX/sbin/nginx"
            return 0
        fi
    fi

    for candidate in "${candidates[@]}"; do
        [ -x "$candidate" ] || continue
        [ -L "$candidate" ] && continue
        version=$("$candidate" -v 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
        if [ -z "$best" ] || { [ -n "$version" ] && nginx_version_ge "$version" "$best_version"; }; then
            best="$candidate"
            best_version="$version"
        fi
    done

    if [ -n "$best" ]; then
        echo "$best"
        return 0
    fi

    candidate=$(command -v nginx 2>/dev/null || true)
    if [ -n "$candidate" ]; then
        candidate=$(readlink -f "$candidate" 2>/dev/null || true)
        if [ -n "$candidate" ] && [ -x "$candidate" ] && [ ! -L "$candidate" ]; then
            echo "$candidate"
            return 0
        fi
    fi
    return 1
}

# Return the canonical nginx binary path (empty when not installed).
nginx_get_binary() {
    nginx_resolve_canonical_binary 2>/dev/null || true
}

# Get installed nginx version (e.g. "1.31.3"); empty when not installed.
nginx_get_version() {
    local binary
    binary=$(nginx_get_binary)
    if [ -z "$binary" ]; then
        return 0
    fi
    "$binary" -v 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1
}

# Get the OpenSSL version nginx was built with (e.g. "3.0.13"); empty on failure.
nginx_get_openssl_version() {
    local binary
    binary=$(nginx_get_binary)
    if [ -z "$binary" ]; then
        return 0
    fi
    "$binary" -V 2>&1 | grep -oE 'built with OpenSSL [0-9]+\.[0-9]+\.[0-9]+[a-z]*' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1
}

# Check whether the active nginx binary has the HTTP/3 (QUIC) module.
nginx_has_http3() {
    local binary
    binary=$(nginx_get_binary)
    if [ -z "$binary" ]; then
        return 1
    fi
    "$binary" -V 2>&1 | grep -q "http_v3_module"
}

# Check whether the active nginx build supports QUIC 0-RTT early data,
# which requires OpenSSL >= 3.5.1 (older OpenSSL uses the compat layer).
nginx_quic_early_data_supported() {
    local openssl_version
    openssl_version=$(nginx_get_openssl_version)
    if [ -z "$openssl_version" ]; then
        return 1
    fi
    nginx_version_ge "$openssl_version" "$NGINX_OPENSSL_QUIC_VERSION"
}

# Get apt package origin of the installed nginx (e.g. "nginx.org" or distro).
nginx_get_package_origin() {
    local policy
    policy=$(apt-cache policy nginx 2>/dev/null | grep -m1 -oE 'https?://[^ ,]+' || true)
    if echo "$policy" | grep -q "nginx.org"; then
        echo "nginx.org"
    elif dpkg -l nginx 2>/dev/null | grep -q "^ii"; then
        echo "distro"
    else
        echo "unknown"
    fi
}

# Ensure the official nginx.org mainline repository is configured.
# Idempotent: only touches apt when the keyring/list/pin is missing or stale.
nginx_ensure_official_repo() {
    local distro_id
    local codename
    local repo_url
    local list_file
    local pin_file
    local changed=false

    if [ ! -f /etc/os-release ]; then
        echo "[nginx] /etc/os-release missing, cannot configure official repository"
        return 1
    fi

    distro_id=$(grep -oP '^ID=\K.*' /etc/os-release | tr -d '"' | tr -d "'")
    if [ "$distro_id" != "debian" ] && [ "$distro_id" != "ubuntu" ] && [ "$distro_id" != "kali" ]; then
        echo "[nginx] Unsupported distro for official repository: $distro_id"
        return 1
    fi
    codename=$(grep -oP '^VERSION_CODENAME=\K.*' /etc/os-release | tr -d '"' | tr -d "'")
    if [ -z "$codename" ]; then
        echo "[nginx] Cannot determine distribution codename"
        return 1
    fi
    if [ "$distro_id" = "kali" ]; then
        distro_id="debian"
    fi

    repo_url="https://nginx.org/packages/mainline/$distro_id"
    list_file="/etc/apt/sources.list.d/nginx-mainline.list"
    pin_file="/etc/apt/preferences.d/99-nginx-mainline"

    if [ ! -f "$NGINX_KEYRING_FILE" ]; then
        echo "[nginx] Importing nginx.org signing key..."
        ensure_packages_from_apt_repository_manager curl ca-certificates >/dev/null 2>&1 || true
        curl -fsSL "$NGINX_SIGNING_KEY_URL" | $USE_SUDO gpg --dearmor -o "$NGINX_KEYRING_FILE" 2>/dev/null
        changed=true
    fi

    local stored_fingerprint
    stored_fingerprint=$($USE_SUDO gpg --dry-run --quiet --no-keyring --import --import-options import-show "$NGINX_KEYRING_FILE" 2>/dev/null | grep -oE '[0-9A-F]{40}' | head -1 || true)
    if [ -n "$stored_fingerprint" ] && [ "$stored_fingerprint" != "$NGINX_SIGNING_KEY_FINGERPRINT" ]; then
        echo "[nginx] Refreshing nginx.org signing key (fingerprint mismatch)..."
        $USE_SUDO rm -f "$NGINX_KEYRING_FILE"
        curl -fsSL "$NGINX_SIGNING_KEY_URL" | $USE_SUDO gpg --dearmor -o "$NGINX_KEYRING_FILE" 2>/dev/null
        changed=true
    fi

    local wanted_list
    wanted_list="deb [signed-by=$NGINX_KEYRING_FILE] $repo_url $codename nginx"
    if [ ! -f "$list_file" ] || ! grep -qF "$wanted_list" "$list_file" 2>/dev/null; then
        echo "[nginx] Writing mainline repository list: $list_file"
        echo "$wanted_list" | $USE_SUDO tee "$list_file" >/dev/null
        changed=true
    fi

    if [ ! -f "$pin_file" ]; then
        echo "[nginx] Writing apt pin (priority 900, origin nginx.org)..."
        printf 'Package: *\nPin: origin nginx.org\nPin: release o=nginx\nPin-Priority: 900\n' | $USE_SUDO tee "$pin_file" >/dev/null
        changed=true
    fi

    if [ "$changed" = true ]; then
        $USE_SUDO apt update
    else
        echo "[nginx] Official mainline repository already configured"
    fi
    return 0
}

# Install/upgrade nginx from the official mainline repository (>= 1.31).
nginx_install_official() {
    nginx_ensure_official_repo || return 1
    $USE_SUDO apt install -y nginx --no-install-recommends
}

# Backup live nginx configuration (sites, certs metadata, main config).
# Usage: nginx_backup_config <backup_dir>
nginx_backup_config() {
    local backup_dir="$1"
    local items=(
        "/etc/nginx"
        "/etc/letsencrypt"
    )
    local item

    if [ -z "$backup_dir" ]; then
        echo "[nginx] Backup directory is required"
        return 1
    fi
    $USE_SUDO mkdir -p "$backup_dir"
    for item in "${items[@]}"; do
        if [ -d "$item" ]; then
            $USE_SUDO cp -a "$item" "$backup_dir/" 2>/dev/null || true
        fi
    done
    echo "$backup_dir"
}

# Detect a legacy/distro/foreign nginx and interactively offer replacement by
# the official mainline package. Configs are always preserved. Default answer
# is No (keep the existing installation untouched).
# Usage: nginx_replace_legacy_install <auto_confirm>
nginx_replace_legacy_install() {
    local auto_confirm="$1"
    local current_version
    local origin
    local response

    current_version=$(nginx_get_version)
    if [ -z "$current_version" ]; then
        return 0
    fi
    origin=$(nginx_get_package_origin)

    if nginx_version_ge "$current_version" "$NGINX_MINIMUM_VERSION" && [ "$origin" = "nginx.org" ]; then
        echo "[nginx] Existing official install $current_version meets requirements, keeping it"
        return 0
    fi

    echo "[nginx] Existing installation detected: nginx/$current_version (origin: $origin)"
    echo "[nginx] The official mainline repository provides nginx/$NGINX_MAINLINE_VERSION with HTTP/3 support"

    if [ "$auto_confirm" = "true" ]; then
        response="y"
    else
        read -r -p "[nginx] Replace the existing installation with the official mainline package? Configs will be preserved [y/N]: " response
    fi

    case "$response" in
        [Yy]*)
            ;;
        *)
            echo "[nginx] Keeping existing installation $current_version"
            return 0
            ;;
    esac

    local backup_dir
    backup_dir=$(create_script_temp_dir "nginx-legacy-replace")
    nginx_backup_config "$backup_dir" >/dev/null

    $USE_SUDO systemctl stop nginx 2>/dev/null || true
    $USE_SUDO apt remove --purge -y nginx nginx-common nginx-core nginx-full 2>/dev/null || true
    $USE_SUDO apt autoremove -y 2>/dev/null || true

    nginx_install_official || return 1

    if [ -d "$backup_dir/nginx" ] && [ ! -d /etc/nginx ]; then
        $USE_SUDO cp -a "$backup_dir/nginx" /etc/nginx
    fi
    cleanup_script_temp_dir "$backup_dir" 2>/dev/null || true
    echo "[nginx] Replaced with nginx/$(nginx_get_version), configuration preserved"
    return 0
}

# Build nginx from source against OpenSSL >= 3.5.1 for full QUIC 0-RTT.
# Installs to $NGINX_SOURCE_PREFIX while keeping /etc/nginx as config home.
nginx_source_build() {
    local nginx_tar="nginx-$NGINX_MAINLINE_VERSION.tar.gz"
    local openssl_major
    local openssl_tar
    local build_dir="$NGINX_SOURCE_BASE/$NGINX_MAINLINE_VERSION"
    local cpu_count

    openssl_major=$(echo "$NGINX_OPENSSL_QUIC_VERSION" | cut -d. -f1-2)
    openssl_tar="openssl-$NGINX_OPENSSL_QUIC_VERSION.tar.gz"
    cpu_count=$(nproc 2>/dev/null || echo 2)

    $USE_SUDO apt update
    $USE_SUDO apt install -y build-essential libpcre2-dev zlib1g-dev curl ca-certificates

    $USE_SUDO mkdir -p "$build_dir"
    # Build tree must be writable by the invoking user; install stays root.
    $USE_SUDO chown -R "$(id -un):$(id -gn)" "$NGINX_SOURCE_BASE" 2>/dev/null || true

    if [ ! -f "$build_dir/$nginx_tar" ]; then
        curl -fsSL "https://nginx.org/download/$nginx_tar" -o "$build_dir/$nginx_tar" || return 1
    fi
    if [ ! -f "$build_dir/$openssl_tar" ]; then
        curl -fsSL "https://www.openssl.org/source/$openssl_tar" -o "$build_dir/$openssl_tar" || return 1
    fi
    if [ ! -d "$build_dir/nginx-$NGINX_MAINLINE_VERSION" ]; then
        tar -xzf "$build_dir/$nginx_tar" -C "$build_dir" || return 1
    fi
    if [ ! -d "$build_dir/openssl-$NGINX_OPENSSL_QUIC_VERSION" ]; then
        tar -xzf "$build_dir/$openssl_tar" -C "$build_dir" || return 1
    fi

    cd "$build_dir/nginx-$NGINX_MAINLINE_VERSION" || return 1
    ./configure \
        --prefix="$NGINX_SOURCE_PREFIX" \
        --conf-path="$NGINX_SOURCE_CONF_PATH" \
        --sbin-path="$NGINX_SOURCE_PREFIX/sbin/nginx" \
        --pid-path=/run/nginx.pid \
        --lock-path=/run/lock/nginx.lock \
        --error-log-path=/var/log/nginx/error.log \
        --http-log-path=/var/log/nginx/access.log \
        --with-http_ssl_module \
        --with-http_v2_module \
        --with-http_v3_module \
        --with-http_gzip_static_module \
        --with-http_stub_status_module \
        --with-threads \
        --with-file-aio \
        --with-openssl="$build_dir/openssl-$NGINX_OPENSSL_QUIC_VERSION" \
        --with-openssl-opt="no-tests" || return 1
    make -j"$cpu_count" || return 1
    $USE_SUDO make install || return 1
    # Marker so nm_replace_foreign_nginx can tell this managed source build
    # apart from foreign /usr/local/nginx installs left by other tooling.
    $USE_SUDO touch "$NGINX_SOURCE_PREFIX/.core_node_source_build"
    $USE_SUDO chmod 777 "$NGINX_SOURCE_PREFIX/.core_node_source_build" 2>/dev/null || true
    return 0
}

# Offer the source build path when the running build lacks QUIC 0-RTT.
# Usage: nginx_offer_source_build <auto_confirm>
nginx_offer_source_build() {
    local auto_confirm="$1"
    local response

    if [ -x "$NGINX_SOURCE_PREFIX/sbin/nginx" ]; then
        echo "[nginx] Source build already present at $NGINX_SOURCE_PREFIX"
        nginx_unify_binaries
        return 0
    fi
    if nginx_quic_early_data_supported; then
        echo "[nginx] QUIC 0-RTT early data already supported (OpenSSL >= $NGINX_OPENSSL_QUIC_VERSION)"
        return 0
    fi

    echo "[nginx] Current build uses OpenSSL $(nginx_get_openssl_version) < $NGINX_OPENSSL_QUIC_VERSION"
    echo "[nginx] HTTP/3 works, but QUIC 0-RTT early data requires a source build against OpenSSL >= $NGINX_OPENSSL_QUIC_VERSION"

    if [ "$auto_confirm" != "true" ]; then
        read -r -p "[nginx] Build nginx $NGINX_MAINLINE_VERSION from source now? [y/N]: " response
        case "$response" in
            [Yy]*)
                ;;
            *)
                echo "[nginx] Skipping source build; ssl_early_data stays enabled for TLS 1.3 over TCP"
                return 0
                ;;
        esac
    fi

    $USE_SUDO systemctl stop nginx 2>/dev/null || true
    nginx_source_build || return 1
    nginx_unify_binaries
    echo "[nginx] Source build installed: $($NGINX_SOURCE_PREFIX/sbin/nginx -v 2>&1)"
    return 0
}

# Ensure the systemd unit exists for a source-built nginx. The unit always
# declares the managed main config explicitly (-c $NGINX_MAIN_CONF): a vanilla
# foreign build at the same prefix would otherwise keep serving its own
# compile-time config (<prefix>/conf/nginx.conf) no matter how often it is
# reloaded or restarted.
nginx_ensure_source_service() {
    local unit_file="/etc/systemd/system/nginx.service"
    local wanted
    wanted="[Unit]
Description=nginx http(s) server (source build)
After=network.target nss-lookup.target

[Service]
Type=forking
PIDFile=/run/nginx.pid
ExecStartPre=$NGINX_SOURCE_PREFIX/sbin/nginx -t -c $NGINX_MAIN_CONF
ExecStart=$NGINX_SOURCE_PREFIX/sbin/nginx -c $NGINX_MAIN_CONF
ExecReload=$NGINX_SOURCE_PREFIX/sbin/nginx -s reload -c $NGINX_MAIN_CONF
ExecStop=$NGINX_SOURCE_PREFIX/sbin/nginx -s quit -c $NGINX_MAIN_CONF
PrivateTmp=true

[Install]
WantedBy=multi-user.target"

    if [ ! -f "$NGINX_SOURCE_PREFIX/sbin/nginx" ]; then
        echo "[nginx] Source binary missing, cannot create service"
        return 1
    fi
    if [ -f "$unit_file" ] && grep -qF "ExecStart=$NGINX_SOURCE_PREFIX/sbin/nginx -c $NGINX_MAIN_CONF" "$unit_file"; then
        echo "[nginx] Source service unit already present"
    else
        echo "$wanted" | $USE_SUDO tee "$unit_file" >/dev/null
    fi
    $USE_SUDO systemctl daemon-reload
    return 0
}

# Divert an apt-owned nginx path so package upgrades do not restore a second binary.
nginx_divert_package_path() {
    local path="$1"

    if ! dpkg -S "$path" >/dev/null 2>&1; then
        return 0
    fi
    if $USE_SUDO dpkg-divert --list 2>/dev/null | grep -qF "local diversion of $path"; then
        return 0
    fi
    echo "[nginx] Diverting package-owned path: $path"
    $USE_SUDO dpkg-divert --local --rename --add "$path" 2>/dev/null || true
}

# Point one alias path at the canonical binary; no-op when already correct.
nginx_unify_alias_path() {
    local alias_path="$1"
    local canonical="$2"
    local current_resolved

    if [ "$alias_path" = "$canonical" ]; then
        return 0
    fi

    if [ -L "$alias_path" ] && [ "$(readlink "$alias_path")" = "$alias_path" ]; then
        echo "[nginx] Removing self-referential link: $alias_path"
        $USE_SUDO rm -f "$alias_path"
    fi

    current_resolved=$(readlink -f "$alias_path" 2>/dev/null || true)
    if [ "$current_resolved" = "$canonical" ]; then
        echo "[nginx] [SKIP] Already unified: $alias_path -> $canonical"
        return 0
    fi

    if [ -e "$alias_path" ] && [ ! -L "$alias_path" ]; then
        nginx_divert_package_path "$alias_path"
        echo "[nginx] Replacing duplicate binary: $alias_path"
    fi

    $USE_SUDO rm -f "$alias_path"
    $USE_SUDO ln -sf "$canonical" "$alias_path"
    echo "[nginx] [OK] Unified: $alias_path -> $canonical"
}

# Ensure systemd always execs the canonical binary (source or package).
nginx_ensure_unified_service() {
    local canonical="$1"
    local unit_file="/etc/systemd/system/nginx.service"
    local wanted

    if [ -z "$canonical" ]; then
        return 1
    fi

    if [[ "$canonical" == "$NGINX_SOURCE_PREFIX/sbin/nginx" ]]; then
        nginx_ensure_source_service
        return 0
    fi

    wanted="[Unit]
Description=nginx http(s) server
After=network.target nss-lookup.target

[Service]
Type=forking
PIDFile=/run/nginx.pid
ExecStartPre=$canonical -t
ExecStart=$canonical
ExecReload=$canonical -s reload
ExecStop=$canonical -s quit
PrivateTmp=true

[Install]
WantedBy=multi-user.target"

    if [ -f "$unit_file" ] && grep -qF "ExecStart=$canonical" "$unit_file"; then
        echo "[nginx] Service unit already uses canonical binary"
        return 0
    fi

    echo "$wanted" | $USE_SUDO tee "$unit_file" >/dev/null
    $USE_SUDO systemctl daemon-reload
    echo "[nginx] [OK] Service unit points to $canonical"
}

# Idempotently replace every known nginx path with symlinks to one canonical binary.
nginx_unify_binaries() {
    local canonical
    local alias_path
    local canonical_resolved

    canonical=$(nginx_resolve_canonical_binary) || {
        echo "[nginx] No canonical nginx binary found, cannot unify"
        return 1
    }
    canonical_resolved=$(readlink -f "$canonical" 2>/dev/null || echo "$canonical")
    echo "[nginx] Canonical binary: $canonical_resolved"

    for alias_path in "${NGINX_KNOWN_ALIAS_PATHS[@]}"; do
        nginx_unify_alias_path "$alias_path" "$canonical_resolved"
    done

    nginx_ensure_unified_service "$canonical_resolved"
    return 0
}

# Backward-compatible alias for callers that only need PATH unification.
nginx_ensure_bin_link() {
    nginx_unify_binaries
}

# Render the modern TLS/HTTP3 stanza for an HTTPS server block.
# Single source shared by the installer, certbot setup and manager scripts.
# Usage: nginx_render_tls_stanza <indent> <cert_path> <key_path>
nginx_render_tls_stanza() {
    local indent="${1:-    }"
    local cert_path="$2"
    local key_path="$3"
    local quic_key_line=""

    # Fixed QUIC host key (see nginx_ensure_quic_host_key): rendered only when
    # the key file is really in place, so the stanza stays nginx -t valid even
    # when the key could not be ensured.
    nginx_ensure_quic_host_key
    if [ "$NGINX_QUIC_HOST_KEY_READY" = "yes" ]; then
        quic_key_line="
${indent}quic_host_key $(nginx_quic_host_key_file);"
    fi

    cat <<EOF
${indent}listen 443 ssl;
${indent}listen [::]:443 ssl;
${indent}listen 443 quic;
${indent}listen [::]:443 quic;
${indent}http2 on;
${indent}http3 on;
${indent}quic_retry on;${quic_key_line}
${indent}ssl_certificate $cert_path;
${indent}ssl_certificate_key $key_path;
${indent}ssl_protocols TLSv1.2 TLSv1.3;
${indent}ssl_early_data on;
${indent}ssl_session_cache shared:SSL:10m;
${indent}ssl_session_timeout 1d;
${indent}ssl_session_tickets off;
${indent}add_header Alt-Svc 'h3=":443"; ma=86400' always;
EOF
}

# True when the fqdn's first label is "api" (api.<region>.<domain>). The
# single shell-side copy of the api/apex distinction: api.* vhosts proxy
# directly on :80 (no 301), apex vhosts keep the 301.
nginx_is_api_fqdn() {
    case "$1" in api.*) return 0 ;; *) return 1 ;; esac
}

# Render the proxy location pair (location / + location /ws) shared by the
# :80 direct-proxy block and the 443 TLS block. The Early-Data replay guard
# (RFC 8470) is only meaningful on TLS listeners, hence the flag.
# Usage: nginx_render_proxy_locations <upstream_name> <with_early_data:yes|no>
nginx_render_proxy_locations() {
    local upstream="$1"
    local early_data="${2:-no}"
    local early_line=""

    if [ "$early_data" = "yes" ]; then
        early_line="        proxy_set_header Early-Data \$ssl_early_data;
"
    fi

    cat <<EOF
    location / {
${early_line}        proxy_pass http://$upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$server_name;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /ws {
        proxy_pass http://$upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
EOF
}

# Resolve the certbot config dirs that actually hold certificates, in
# priority order (direct file detection on live/ or renewal/). The Laravel
# ServerManager end issues with --config-dir <mapped nginxconfig>/letsencrypt;
# /etc/letsencrypt covers legacy/default certificates. When nothing exists
# yet, the canonical mapped dir is returned so pre-issuance renders point
# where the first certificate will land.
NGINX_LE_CONFIG_DIRS=()
nginx_le_config_dirs_resolve() {
    local candidates=()
    local candidate=""
    local seen=""

    if declare -F map_web_path >/dev/null 2>&1; then
        candidates+=("$(map_web_path "nginxconfig" "letsencrypt")")
    fi
    candidates+=("/www/nginxconfig/letsencrypt" "/etc/letsencrypt")

    NGINX_LE_CONFIG_DIRS=()
    for candidate in "${candidates[@]}"; do
        case "$seen" in *"|$candidate|"*) continue ;; esac
        seen="${seen}|${candidate}|"
        if [ -d "$candidate/live" ] || [ -d "$candidate/renewal" ]; then
            NGINX_LE_CONFIG_DIRS+=("$candidate")
        fi
    done
    if [ ${#NGINX_LE_CONFIG_DIRS[@]} -eq 0 ]; then
        NGINX_LE_CONFIG_DIRS=("${candidates[0]}")
    fi
}

# Canonical QUIC host key: a FIXED file stops the per-reload random-key
# invalidation (with quic_retry on, a random per-reload key voids every
# outstanding token, so each reload forces fresh handshakes). Created once
# with 32 random bytes; file-detection idempotent.
nginx_quic_host_key_file() {
    if declare -F map_web_path >/dev/null 2>&1; then
        map_web_path "nginxconfig" "ssl/quic/host.key"
        return 0
    fi
    echo "/www/nginxconfig/ssl/quic/host.key"
}

# Ensure the QUIC host key exists (created once, kept across reloads).
# Publishes NGINX_QUIC_HOST_KEY_READY=yes|no.
NGINX_QUIC_HOST_KEY_READY="no"
nginx_ensure_quic_host_key() {
    local file
    local sudo_cmd
    file="$(nginx_quic_host_key_file)"
    sudo_cmd=$(lazy_sudo)

    if [ -f "$file" ]; then
        NGINX_QUIC_HOST_KEY_READY="yes"
        return 0
    fi

    nginx_ensure_directory "$(dirname "$file")"
    if [ "$NGINX_ENSURE_DIR_READY" = "yes" ]; then
        $sudo_cmd sh -c "head -c 32 /dev/urandom > \"$file\"" 2>/dev/null || true
        $sudo_cmd chmod 600 "$file" 2>/dev/null || true
    fi

    if [ -f "$file" ]; then
        NGINX_QUIC_HOST_KEY_READY="yes"
    else
        NGINX_QUIC_HOST_KEY_READY="no"
        echo "[nginx] [WARN] QUIC host key could not be ensured at $file"
    fi
}

# Canonical placeholder (snakeoil) certificate: guarantees every TLS vhost is
# renderable and `nginx -t`-valid EVEN before/without a real certificate, so a
# site's proxy shape (HTTP/3 + 301 + upstream) is INVARIANT — certificate
# state never changes the vhost type. Real Let's Encrypt material always wins
# the probe in nginx_le_cert_path/nginx_le_key_path; the content-hash writer
# swaps the vhost to the real cert on the next sweep.
NGINX_PLACEHOLDER_CERT_READY="no"
nginx_placeholder_cert_dir() {
    if declare -F map_web_path >/dev/null 2>&1; then
        map_web_path "nginxconfig" "ssl/snakeoil"
        return 0
    fi
    echo "/www/nginxconfig/ssl/snakeoil"
}

# Ensure the placeholder certificate exists (created once; file-detection
# idempotent). Result published in NGINX_PLACEHOLDER_CERT_READY.
nginx_ensure_placeholder_cert() {
    local dir
    local cert
    local key
    local sudo_cmd
    dir="$(nginx_placeholder_cert_dir)"
    cert="$dir/fullchain.pem"
    key="$dir/privkey.pem"
    sudo_cmd=$(lazy_sudo)

    if [ -f "$cert" ] && [ -f "$key" ]; then
        NGINX_PLACEHOLDER_CERT_READY="yes"
        return 0
    fi

    nginx_ensure_directory "$dir"
    if [ "$NGINX_ENSURE_DIR_READY" = "yes" ] && command -v openssl >/dev/null 2>&1; then
        $sudo_cmd openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
            -keyout "$key" -out "$cert" \
            -subj "/CN=core_node-placeholder" >/dev/null 2>&1 || true
        $sudo_cmd chmod 600 "$key" 2>/dev/null || true
    fi

    if [ -f "$cert" ] && [ -f "$key" ]; then
        NGINX_PLACEHOLDER_CERT_READY="yes"
    else
        NGINX_PLACEHOLDER_CERT_READY="no"
        echo "[nginx] [WARN] placeholder certificate could not be ensured at $dir"
    fi
}

# Let's Encrypt live certificate paths for a domain: probe every known
# certbot config dir by direct file detection; fall back to the placeholder
# certificate (ensured by nginx_ensure_placeholder_cert) so the rendered
# vhost is always nginx-valid and swaps to real material via content-hash.
nginx_le_cert_path() {
    local domain="$1"
    local le_dir=""
    nginx_le_config_dirs_resolve
    for le_dir in "${NGINX_LE_CONFIG_DIRS[@]}"; do
        if [ -f "$le_dir/live/$domain/fullchain.pem" ]; then
            echo "$le_dir/live/$domain/fullchain.pem"
            return 0
        fi
    done
    echo "$(nginx_placeholder_cert_dir)/fullchain.pem"
}

nginx_le_key_path() {
    local domain="$1"
    local le_dir=""
    nginx_le_config_dirs_resolve
    for le_dir in "${NGINX_LE_CONFIG_DIRS[@]}"; do
        if [ -f "$le_dir/live/$domain/privkey.pem" ]; then
            echo "$le_dir/live/$domain/privkey.pem"
            return 0
        fi
    done
    echo "$(nginx_placeholder_cert_dir)/privkey.pem"
}

# Render a complete static-site vhost pair (80 redirect + 443 modern TLS).
# Usage: nginx_render_site_vhost <domain> <doc_root> [cert_domain]
# cert_domain defaults to domain; pass the certificate owner domain when the
# served host is a subdomain covered by another domain's certificate.
nginx_render_site_vhost() {
    local domain="$1"
    local doc_root="$2"
    local cert_domain="${3:-$1}"
    local cert_path
    local key_path
    cert_path=$(nginx_le_cert_path "$cert_domain")
    key_path=$(nginx_le_key_path "$cert_domain")

    cat <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $domain www.$domain;
    return 301 https://\$server_name\$request_uri;
}

server {
$(nginx_render_tls_stanza "    " "$cert_path" "$key_path")
    server_name $domain www.$domain;

    root $doc_root;
    index index.html index.htm;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    location / {
        try_files \$uri \$uri/ =404;
    }

    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location ^~ /.well-known/acme-challenge/ {
        allow all;
        root /var/www/html;
        try_files \$uri =404;
    }

    access_log /var/log/nginx/${domain}_access.log;
    error_log /var/log/nginx/${domain}_error.log;
}
EOF
}

# Render a complete reverse-proxy vhost pair (port-80 block + 443 modern TLS).
# Usage: nginx_render_proxy_vhost <domain> <backend_url> [cert_domain] [http_mode] [server_names]
# cert_domain defaults to domain; pass the certificate owner domain when the
# served host is a subdomain covered by another domain's certificate.
# server_names defaults to domain; pass a space-separated list for multi-name
# sites (e.g. the dashboard www binding). Upstream name and log files always
# derive from <domain> so the site identity stays stable.
# http_mode=redirect (default; apex and generic sites): the :80 block 301s to
# https. http_mode=proxy (api.* vhosts): the :80 block proxies DIRECTLY to the
# backend, so plain HTTP reaches it even while 443 is blocked by the cloud
# security group; the ACME location stays local on :80 for renewals.
nginx_render_proxy_vhost() {
    local domain="$1"
    local backend="$2"
    local cert_domain="${3:-$1}"
    local http_mode="${4:-redirect}"
    local server_names="${5:-$1}"
    local backend_addr
    local cert_path
    local key_path
    local http_block
    backend_addr=$(echo "$backend" | sed -E 's#^[a-zA-Z][a-zA-Z0-9+.-]*://##; s#/$##')
    cert_path=$(nginx_le_cert_path "$cert_domain")
    key_path=$(nginx_le_key_path "$cert_domain")

    if [ "$http_mode" = "proxy" ]; then
        http_block=$(cat <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $server_names;

$(nginx_render_proxy_locations "${domain}_backend" "no")

    location ^~ /.well-known/acme-challenge/ {
        allow all;
        root /var/www/html;
        try_files \$uri =404;
    }

    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    access_log /var/log/nginx/${domain}_access.log;
    error_log /var/log/nginx/${domain}_error.log;
}
EOF
)
    else
        http_block=$(cat <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $server_names;
    return 301 https://\$server_name\$request_uri;
}
EOF
)
    fi

    cat <<EOF
upstream ${domain}_backend {
    server $backend_addr;
    keepalive 32;
}

$http_block

server {
$(nginx_render_tls_stanza "    " "$cert_path" "$key_path")
    server_name $server_names;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

$(nginx_render_proxy_locations "${domain}_backend" "yes")

    location ^~ /.well-known/acme-challenge/ {
        allow all;
        root /var/www/html;
        try_files \$uri =404;
    }

    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    access_log /var/log/nginx/${domain}_access.log;
    error_log /var/log/nginx/${domain}_error.log;
}
EOF
}

# Render the plain port-80 bootstrap config used before a certificate exists.
# Usage: nginx_render_http_bootstrap <domain> [doc_root]
nginx_render_http_bootstrap() {
    local domain="$1"
    local doc_root="${2:-}"
    local extra=""

    if [ -n "$doc_root" ]; then
        extra="    root $doc_root;
    index index.html index.htm;

    location / {
        try_files \$uri \$uri/ =404;
    }
"
    else
        extra="    location / {
        return 200 'ok';
        add_header Content-Type text/plain;
    }
"
    fi

    cat <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $domain;

$extra
    location ^~ /.well-known/acme-challenge/ {
        allow all;
        root /var/www/html;
        try_files \$uri =404;
    }
}
EOF
}


NGINX_MANAGED_SITE_MARKER="managed-by: core_node"

# Resolve the sites-available directory: map_web_path when gvar_common is
# loaded, else the value 26_install_nginx.sh persisted, else the default.
nginx_get_sites_available() {
    if declare -F map_web_path >/dev/null 2>&1; then
        map_web_path "nginxconfig" "sites-available"
        return 0
    fi
    local stored=""
    local gdir="${CORE_NODE_DATA_DIR:-/var/_core_node}/global_var"
    [ -f "$gdir/NGINX_SITES_AVAILABLE" ] && stored=$($USE_SUDO cat "$gdir/NGINX_SITES_AVAILABLE" 2>/dev/null | tr -d '[:space:]')
    echo "${stored:-/etc/nginx/sites-available}"
}

# Resolve the sites-enabled directory (same resolution order as above).
nginx_get_sites_enabled() {
    if declare -F map_web_path >/dev/null 2>&1; then
        map_web_path "nginxconfig" "sites-enabled"
        return 0
    fi
    local stored=""
    local gdir="${CORE_NODE_DATA_DIR:-/var/_core_node}/global_var"
    [ -f "$gdir/NGINX_SITES_ENABLED" ] && stored=$($USE_SUDO cat "$gdir/NGINX_SITES_ENABLED" 2>/dev/null | tr -d '[:space:]')
    echo "${stored:-/etc/nginx/sites-enabled}"
}

# Ensure a directory path exists as a REAL, traversable directory. Shared by
# every nginx site/layout step (fine-grained idempotent; safe to re-run).
# Repairs the two conflict shapes that defeat a bare `mkdir -p`:
#   - a regular file at the path   (mkdir -p reports "File exists")
#   - a DANGLING symlink           ([ -e ] false, [ -d ] false, mkdir -p
#     reports "File exists", writes through it fail ENOENT)
# A symlink that already resolves to a directory is kept (writes flow through
# to its target). The repair commands are trusted to run; the outcome is then
# verified by direct filesystem detection and published in
# NGINX_ENSURE_DIR_READY ("yes"/"no") — never inferred from an exit code.
# Usage: nginx_ensure_directory <path>; then read NGINX_ENSURE_DIR_READY.
NGINX_ENSURE_DIR_READY="no"
nginx_ensure_directory() {
    local dir="$1"
    local sudo_cmd=""

    # Canonical lazy sudo (file_ops_common.sh, sourced at the top of this
    # library; honors a pre-set USE_SUDO from gvar_common.sh).
    sudo_cmd=$(lazy_sudo)

    if [ ! -d "$dir" ]; then
        if [ -e "$dir" ] || [ -L "$dir" ]; then
            echo "[nginx] Removing conflicting non-directory path: $dir"
            $sudo_cmd rm -f "$dir"
        fi
        $sudo_cmd mkdir -p "$dir" 2>/dev/null || true
    fi

    if [ -d "$dir" ]; then
        NGINX_ENSURE_DIR_READY="yes"
    else
        NGINX_ENSURE_DIR_READY="no"
        echo "[nginx] [FAIL] Directory could not be ensured: $dir"
    fi
}

# Quarantine stale duplicate server_name configs. nginx loads the FIRST
# server block for a name and merely warns "conflicting server name ...
# ignored" for the rest, so a bootstrap-era file anywhere in the include
# path silently masks the canonical managed vhost. Canonical names are the
# server_name values of the managed files in the mapped sites-available;
# duplicates found in OTHER include dirs (conf.d, /etc/nginx/sites-*,
# provided they do not resolve into the mapped tree) are moved to the
# quarantine dir. Fine-grained idempotent: nothing moves when no duplicate
# exists.
nginx_quarantine_duplicate_server_names() {
    local sites_available="$1"
    local sites_enabled="$2"
    local quarantine_dir
    local canonical_names=""
    local file=""
    local dir=""
    local name=""
    local file_names=""
    local sudo_cmd

    sudo_cmd=$(lazy_sudo)
    quarantine_dir="$(dirname "$sites_available")/quarantined"

    for file in "$sites_available"/*; do
        [ -f "$file" ] || continue
        grep -q "$NGINX_MANAGED_SITE_MARKER" "$file" 2>/dev/null || continue
        file_names=$(grep -oE '^[[:space:]]*server_name[[:space:]]+[^;]+;' "$file" 2>/dev/null \
            | sed -E 's/^[[:space:]]*server_name[[:space:]]+//; s/;//' \
            | tr ' ' '\n' | grep -vE '^$|^_$' || true)
        for name in $file_names; do
            case " $canonical_names " in *" $name "*) ;; *) canonical_names="$canonical_names $name" ;; esac
        done
    done
    [ -z "$canonical_names" ] && return 0

    for dir in /etc/nginx/sites-available /etc/nginx/sites-enabled /etc/nginx/conf.d; do
        [ -d "$dir" ] || continue
        [ "$(readlink -f "$dir" 2>/dev/null)" = "$(readlink -f "$sites_available")" ] && continue
        [ "$(readlink -f "$dir" 2>/dev/null)" = "$(readlink -f "$sites_enabled")" ] && continue
        for file in "$dir"/*; do
            { [ -f "$file" ] || [ -L "$file" ]; } || continue
            file_names=$(grep -oE '^[[:space:]]*server_name[[:space:]]+[^;]+;' "$file" 2>/dev/null \
                | sed -E 's/^[[:space:]]*server_name[[:space:]]+//; s/;//' \
                | tr ' ' '\n' | grep -vE '^$|^_$' || true)
            for name in $file_names; do
                case " $canonical_names " in
                    *" $name "*)
                        echo "[nginx] Quarantining stale duplicate of $name: $file"
                        $sudo_cmd mkdir -p "$quarantine_dir"
                        if [ -L "$file" ]; then
                            $sudo_cmd rm -f "$file"
                        else
                            $sudo_cmd mv "$file" "$quarantine_dir/$(basename "$file").$(date +%Y%m%d%H%M%S).dup"
                        fi
                        break
                        ;;
                esac
            done
        done
    done
    return 0
}

# Verify the :80/:443 listeners belong to the systemd-managed nginx master.
# A foreign nginx master (source build / manual start, e.g. an old duplicate
# install) keeps serving the OLD config no matter how often the unit is
# reloaded. Foreign masters are stopped and the unit restarted — this is the
# nginx twin of the stale-certbot detection. Result is re-verified from the
# process table after the stop.
nginx_single_instance_ensure() {
    local sudo_cmd
    local unit_main_pid=""
    local pid=""
    local ppid=""
    local foreign=""
    local remaining=""

    sudo_cmd=$(lazy_sudo)
    command -v systemctl >/dev/null 2>&1 || return 0
    systemctl is-active --quiet nginx 2>/dev/null || return 0
    command -v pgrep >/dev/null 2>&1 || return 0

    unit_main_pid=$(systemctl show -p MainPID --value nginx 2>/dev/null)
    if [ -z "$unit_main_pid" ] || [ "$unit_main_pid" = "0" ]; then
        return 0
    fi

    for pid in $(pgrep -x nginx 2>/dev/null); do
        ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
        # A master has PPID 1; any master that is not the unit's MainPID is foreign.
        if [ "$ppid" = "1" ] && [ "$pid" != "$unit_main_pid" ]; then
            foreign="$foreign $pid"
        fi
    done

    for pid in $foreign; do
        echo "[nginx] Stopping foreign nginx master PID $pid (systemd unit master is $unit_main_pid); it was serving stale config"
        $sudo_cmd kill "$pid" 2>/dev/null || true
    done

    if [ -n "$foreign" ]; then
        sleep 2
        $sudo_cmd systemctl restart nginx 2>/dev/null || true
        remaining=$(pgrep -x nginx 2>/dev/null | while read -r pid; do
            ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
            if [ "$ppid" = "1" ] && [ "$pid" != "$unit_main_pid" ]; then
                echo "$pid"
            fi
        done)
        if [ -n "$remaining" ]; then
            echo "[nginx] [WARN] foreign nginx master(s) still present: $remaining"
        else
            echo "[nginx] [OK] single systemd-managed nginx instance serving"
        fi
    fi
    return 0
}

# Compile-time default config path of a binary (its -V --conf-path). Debian /
# Ubuntu package builds do not print one and default to /etc/nginx/nginx.conf.
nginx_binary_default_conf() {
    local binary="$1"
    local conf_path=""
    conf_path=$("$binary" -V 2>&1 | tr ' ' '\n' | grep -m1 '^--conf-path=' | cut -d= -f2)
    if [ -n "$conf_path" ]; then
        echo "$conf_path"
    else
        echo "/etc/nginx/nginx.conf"
    fi
}

# Effective config path of a running master process: an explicit -c in its
# cmdline wins over the binary's compile-time default.
nginx_master_effective_conf() {
    local pid="$1"
    local exe=""
    local cmdline=""
    exe=$(readlink "/proc/$pid/exe" 2>/dev/null || true)
    exe="${exe% (deleted)}"
    [ -n "$exe" ] || return 1
    cmdline=$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)
    if echo "$cmdline" | grep -qE '(^|[[:space:]])-c[[:space:]]'; then
        echo "$cmdline" | sed -E 's/.*(^|[[:space:]])-c[[:space:]]+([^[:space:]]+).*/\2/'
        return 0
    fi
    nginx_binary_default_conf "$exe"
}

# Compute the edge listeners the rendered configuration DECLARES: tcp:80
# always (the default vhost), tcp:443 when any enabled site carries an ssl
# listener, udp:443 when any enabled site carries a quic listener (HTTP/3).
# Publishes NGINX_EXPECTED_LISTENERS as a space-separated "proto:port" list.
NGINX_EXPECTED_LISTENERS="tcp:80"
nginx_expected_listeners_compute() {
    local sites_enabled
    local entry
    local target
    local has_tls="no"
    local has_quic="no"

    sites_enabled=$(nginx_get_sites_enabled)
    for entry in "$sites_enabled"/*; do
        [ -e "$entry" ] || [ -L "$entry" ] || continue
        target=$(readlink -f "$entry" 2>/dev/null || echo "$entry")
        [ -f "$target" ] || continue
        if grep -qE '^[[:space:]]*listen[[:space:]]+(\[::\]:)?443[[:space:]][^;]*\bssl\b' "$target" 2>/dev/null; then
            has_tls="yes"
        fi
        if grep -qE '^[[:space:]]*listen[[:space:]]+(\[::\]:)?443[[:space:]][^;]*\bquic\b' "$target" 2>/dev/null; then
            has_quic="yes"
        fi
    done

    NGINX_EXPECTED_LISTENERS="tcp:80"
    [ "$has_tls" = "yes" ] && NGINX_EXPECTED_LISTENERS="$NGINX_EXPECTED_LISTENERS tcp:443"
    [ "$has_quic" = "yes" ] && NGINX_EXPECTED_LISTENERS="$NGINX_EXPECTED_LISTENERS udp:443"
    return 0
}

# Audit the declared listeners against the LIVE socket table: every declared
# socket must be bound by nginx itself. This is the truth a reload assertion
# can never provide - a master whose reload aborted on a failed bind shows up
# here as "nothing bound" or "held by <foreign>". Publishes
# NGINX_LISTENERS_OK=yes|no.
NGINX_LISTENERS_OK="yes"
nginx_listeners_audit() {
    local sudo_cmd
    local item
    local proto
    local port
    local opt
    local owner
    sudo_cmd=$(lazy_sudo)

    NGINX_LISTENERS_OK="yes"
    command -v ss >/dev/null 2>&1 || return 0

    for item in $NGINX_EXPECTED_LISTENERS; do
        proto="${item%%:*}"
        port="${item##*:}"
        opt="-lntHp"
        [ "$proto" = "udp" ] && opt="-lnuHp"
        owner=$($sudo_cmd ss "$opt" 2>/dev/null | grep -E "[:.]${port}[[:space:]]" | grep -oE '"[^"]+"' | head -1 | tr -d '"')
        if [ "$owner" = "nginx" ]; then
            echo "[nginx]   listener $proto/$port: [OK] bound by nginx"
        else
            NGINX_LISTENERS_OK="no"
            if [ -n "$owner" ]; then
                echo "[nginx]   listener $proto/$port: [FAIL] held by foreign process: $owner"
            else
                echo "[nginx]   listener $proto/$port: [FAIL] declared in config but nothing is bound"
            fi
        fi
    done
    return 0
}

# Restart pre-flight: every declared listen socket must be bindable before a
# restart, otherwise the new master aborts on the bind failure and "stale but
# serving" becomes "down". Foreign occupiers are cleared through the shared
# port guard (stop + y/N uninstall offer); the outcome is re-detected from
# the live socket table. Publishes NGINX_BIND_PREFLIGHT_OK=yes|no.
NGINX_BIND_PREFLIGHT_OK="yes"
nginx_bind_preflight() {
    NGINX_BIND_PREFLIGHT_OK="yes"
    pg_holders_detect 80 443
    if [ -n "$PG_HOLDERS" ]; then
        echo "[nginx] [WARN] foreign occupiers on the nginx edge ports; clearing them before the restart"
        pg_ports_ensure_free 80 443
    fi
    pg_holders_detect 80 443
    if [ -n "$PG_HOLDERS" ]; then
        NGINX_BIND_PREFLIGHT_OK="no"
        echo "[nginx] [FAIL] bind pre-flight: edge ports still occupied; a restart would abort the master"
    fi
    return 0
}

# Fine-grained conformance step: the RUNNING systemd master must exec the
# canonical binary AND serve $NGINX_MAIN_CONF AND bound the listeners the
# rendered config declares. A master started from a foreign build (or before
# a binary switch) keeps serving its own compile-time config across any
# number of reloads; a master whose reloads keep aborting (e.g. a foreign
# process holding UDP/443) serves a STALE in-memory world with the correct
# exe and conf-path - the listener audit catches what exe/conf cannot. Only a
# fresh exec heals either divergence, so both end in a gated restart (nginx
# -t + bind pre-flight first). Self-detecting: no-op when fully conformant.
nginx_master_conformance_ensure() {
    local sudo_cmd
    local canonical=""
    local unit_main_pid=""
    local master_exe=""
    local master_conf=""
    local divergent="no"
    sudo_cmd=$(lazy_sudo)

    command -v systemctl >/dev/null 2>&1 || return 0
    systemctl is-active --quiet nginx 2>/dev/null || return 0

    canonical=$(nginx_get_binary)
    [ -n "$canonical" ] || return 0
    canonical=$(readlink -f "$canonical" 2>/dev/null || echo "$canonical")

    unit_main_pid=$(systemctl show -p MainPID --value nginx 2>/dev/null)
    if [ -z "$unit_main_pid" ] || [ "$unit_main_pid" = "0" ]; then
        return 0
    fi

    master_exe=$(readlink "/proc/$unit_main_pid/exe" 2>/dev/null || true)
    master_exe="${master_exe% (deleted)}"
    master_conf=$(nginx_master_effective_conf "$unit_main_pid")

    if [ "$master_exe" != "$canonical" ] || [ "$master_conf" != "$NGINX_MAIN_CONF" ]; then
        divergent="yes"
        echo "[nginx] [WARN] running master diverges: exe=$master_exe conf=${master_conf:-unknown}"
        echo "[nginx]         canonical: exe=$canonical conf=$NGINX_MAIN_CONF"
    fi

    # Third conformance dimension (staleness): the live listeners must match
    # the rendered configuration even when exe and conf-path are correct.
    if [ "$divergent" = "no" ]; then
        nginx_expected_listeners_compute
        nginx_listeners_audit
        if [ "$NGINX_LISTENERS_OK" = "yes" ]; then
            return 0
        fi
        divergent="yes"
        echo "[nginx] [WARN] master serves a stale in-memory world: live listeners diverge from the rendered config"
    fi

    if ! $sudo_cmd nginx -t -c "$NGINX_MAIN_CONF" >/dev/null 2>&1; then
        echo "[nginx] [WARN] config test failed; master restart skipped (repair config first)"
        return 1
    fi

    # Restart pre-flight: a restart under a port conflict converts "stale but
    # serving" into "down", so every edge socket must be bindable first.
    nginx_bind_preflight
    if [ "$NGINX_BIND_PREFLIGHT_OK" != "yes" ]; then
        echo "[nginx] [WARN] bind pre-flight failed; master restart skipped (would take nginx down)"
        return 1
    fi

    echo "[nginx] Restarting nginx so the master execs the canonical binary, config and listeners"
    $sudo_cmd systemctl restart nginx || return 1

    nginx_expected_listeners_compute
    nginx_listeners_audit
    if [ "$NGINX_LISTENERS_OK" = "yes" ]; then
        echo "[nginx] [OK] nginx master restarted onto $NGINX_MAIN_CONF; listeners verified"
        return 0
    fi
    echo "[nginx] [FAIL] listeners still divergent after the restart"
    return 1
}

# Print the serve-truth report (read-only diagnostic): which binary SHOULD
# serve vs which master process ACTUALLY serves and with which config. The
# divergence between the two is the classic "site file updated on disk but
# the served config never changed" case (foreign master, or a main config
# without the mapped sites-enabled include).
nginx_serve_truth_report() {
    local binary
    local sites_available
    local sites_enabled
    local unit_main_pid=""
    local master_exe=""
    local master_cmd=""
    local pid=""
    local ppid=""
    local available_count=0
    local enabled_count=0

    binary=$(nginx_get_binary)
    sites_available=$(nginx_get_sites_available)
    sites_enabled=$(nginx_get_sites_enabled)

    echo "[nginx] serve-truth:"
    echo "[nginx]   canonical binary: ${binary:-none} (version $(nginx_get_version))"
    echo "[nginx]   main config: $NGINX_MAIN_CONF"
    echo "[nginx]   sites dirs: available=$sites_available enabled=$sites_enabled"

    if [ -f "$NGINX_MAIN_CONF" ]; then
        if grep -q "include ${sites_enabled}/\*" "$NGINX_MAIN_CONF" 2>/dev/null || \
           grep -qE "include[[:space:]]+${sites_enabled}/\*" "$NGINX_MAIN_CONF" 2>/dev/null; then
            echo "[nginx]   main config includes mapped sites-enabled: yes"
        else
            echo "[nginx]   main config includes mapped sites-enabled: NO (managed sites will NOT load)"
        fi
    else
        echo "[nginx]   main config missing: $NGINX_MAIN_CONF"
    fi

    available_count=$(find "$sites_available" -maxdepth 1 -type f 2>/dev/null | wc -l | tr -d ' ')
    enabled_count=$(find "$sites_enabled" -maxdepth 1 \( -type f -o -type l \) 2>/dev/null | wc -l | tr -d ' ')
    echo "[nginx]   site files: $available_count available, $enabled_count enabled"

    # Content class per enabled site (proxy vhost vs stale bootstrap stub) —
    # this is the truth that decides what a request actually gets.
    local site=""
    local site_target=""
    local site_class=""
    for site in "$sites_enabled"/*; do
        [ -e "$site" ] || [ -L "$site" ] || continue
        site_target=$(readlink -f "$site" 2>/dev/null || true)
        if [ -z "$site_target" ] || [ ! -f "$site_target" ]; then
            echo "[nginx]   site $(basename "$site"): DANGLING LINK"
            continue
        fi
        site_class=$(grep -m1 -oE 'proxy_pass http://[^;]+' "$site_target" 2>/dev/null || true)
        if [ -n "$site_class" ]; then
            echo "[nginx]   site $(basename "$site"): proxy ($site_class), quic=$(grep -c 'listen 443 quic' "$site_target" 2>/dev/null)"
        elif [ "$(basename "$site")" = "default" ]; then
            echo "[nginx]   site default: static catch-all (intentional: unmatched hosts + ACME webroot)"
        else
            echo "[nginx]   site $(basename "$site"): NON-PROXY content (stale bootstrap or static) -> needs re-render"
        fi
    done

    if command -v systemctl >/dev/null 2>&1; then
        unit_main_pid=$(systemctl show -p MainPID --value nginx 2>/dev/null)
    fi
    if [ -n "$unit_main_pid" ] && [ "$unit_main_pid" != "0" ]; then
        master_exe=$(readlink -f "/proc/$unit_main_pid/exe" 2>/dev/null || echo "?")
        master_cmd=$(tr '\0' ' ' < "/proc/$unit_main_pid/cmdline" 2>/dev/null || echo "?")
        echo "[nginx]   running master: pid=$unit_main_pid exe=$master_exe"
        echo "[nginx]   master cmdline: $master_cmd"
        local master_conf=""
        master_conf=$(nginx_master_effective_conf "$unit_main_pid" 2>/dev/null || true)
        echo "[nginx]   master effective conf: ${master_conf:-unknown}"
        if [ -n "$master_conf" ] && [ "$master_conf" != "$NGINX_MAIN_CONF" ]; then
            echo "[nginx]   [FAIL] master does NOT serve the managed main conf ($NGINX_MAIN_CONF); site writes never reach it"
        fi
    else
        echo "[nginx]   running master: none via systemd"
    fi

    if command -v pgrep >/dev/null 2>&1; then
        for pid in $(pgrep -x nginx 2>/dev/null); do
            ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
            if [ "$ppid" = "1" ] && [ "$pid" != "$unit_main_pid" ]; then
                echo "[nginx]   FOREIGN master detected: pid=$pid ($(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null))"
            fi
        done
    fi

    # Declared-vs-live listener audit (the stale-master truth: a master with
    # aborted reloads shows up here as unbound or foreign-held sockets).
    if systemctl is-active --quiet nginx 2>/dev/null; then
        nginx_expected_listeners_compute
        nginx_listeners_audit
    fi
    return 0
}

# Fine-grained, idempotent site repair. Each sub-check is independent:
# 1. prune dangling symlinks in sites-enabled
# 2. prune symlinks whose target is outside sites-available
# 3. run nginx -t; on failure quarantine the offending managed site and retry
# 4. reload the service only when the final config test passes
# Usage: nginx_repair_sites
nginx_repair_sites() {
    local sites_available
    local sites_enabled
    local entry
    local target
    local test_output
    local bad_file
    local quarantine_dir
    local attempt
    local log_mark=0
    local new_emerg=""
    local emerg_line=""

    sites_available=$(nginx_get_sites_available)
    sites_enabled=$(nginx_get_sites_enabled)
    quarantine_dir="$(dirname "$sites_available")/quarantined"

    # Prerequisite sub-step, independent of the sweeps below: the site
    # directories must be real, traversable directories (symlink-aware ensure;
    # repairs dangling symlinks / file conflicts left by older layouts).
    nginx_ensure_directory "$sites_available"
    local available_ready="$NGINX_ENSURE_DIR_READY"
    nginx_ensure_directory "$sites_enabled"
    if [ "$available_ready" != "yes" ] || [ "$NGINX_ENSURE_DIR_READY" != "yes" ]; then
        echo "[nginx] [FAIL] sites directories unusable; repair cannot run"
        return 1
    fi

    for entry in "$sites_enabled"/*; do
        [ -e "$entry" ] || [ -L "$entry" ] || continue
        if [ -L "$entry" ]; then
            target=$(readlink -f "$entry" 2>/dev/null || true)
            if [ -z "$target" ] || [ ! -e "$target" ]; then
                echo "[nginx] Removing dangling site link: $entry"
                $USE_SUDO rm -f "$entry"
                continue
            fi
            case "$target" in
                "$sites_available"/*) ;;
                *)
                    echo "[nginx] Removing foreign site link: $entry -> $target"
                    $USE_SUDO rm -f "$entry"
                    ;;
            esac
        fi
    done

    # Stale duplicate server_name configs mask the canonical managed vhost
    # (nginx keeps the first-loaded block and only warns); quarantine them.
    nginx_quarantine_duplicate_server_names "$sites_available" "$sites_enabled"

    for attempt in 1 2 3 4 5; do
        test_output=$($USE_SUDO nginx -t -c "$NGINX_MAIN_CONF" 2>&1) && break
        bad_file=$(echo "$test_output" | grep -oE "$sites_available/[^ :]+" | head -1)
        if [ -z "$bad_file" ] || [ ! -f "$bad_file" ]; then
            echo "[nginx] [FAIL] nginx -t failed and no site file could be identified:"
            echo "$test_output"
            return 1
        fi
        if ! grep -q "$NGINX_MANAGED_SITE_MARKER" "$bad_file" 2>/dev/null; then
            echo "[nginx] [FAIL] nginx -t failed on unmanaged site $bad_file; manual fix required:"
            echo "$test_output"
            return 1
        fi
        echo "[nginx] Quarantining broken managed site: $bad_file"
        $USE_SUDO mkdir -p "$quarantine_dir"
        $USE_SUDO mv "$bad_file" "$quarantine_dir/$(basename "$bad_file").$(date +%Y%m%d%H%M%S).broken"
        $USE_SUDO rm -f "$sites_enabled/$(basename "$bad_file")"
    done

    if ! $USE_SUDO nginx -t -c "$NGINX_MAIN_CONF" >/dev/null 2>&1; then
        echo "[nginx] [FAIL] configuration still invalid after repair attempts"
        return 1
    fi

    # The reload only helps when the listeners ARE the systemd unit's nginx;
    # a foreign master would keep serving the old config regardless.
    nginx_single_instance_ensure

    # The unit's master itself must exec the canonical binary and serve
    # $NGINX_MAIN_CONF; a divergent master ignores reloads (they re-read its
    # own compile-time config), so this heals via a gated restart.
    nginx_master_conformance_ensure || true

    if systemctl is-active --quiet nginx 2>/dev/null; then
        [ -f "$NGINX_LOG_DIR/error.log" ] && log_mark=$(wc -l < "$NGINX_LOG_DIR/error.log" 2>/dev/null | tr -d ' ')
        [ -z "$log_mark" ] && log_mark=0
        $USE_SUDO systemctl reload nginx 2>/dev/null || true
        sleep 1

        # Verify, never assert: a reload aborted by a failed bind leaves the
        # master serving its stale in-memory world. Detect it via fresh
        # [emerg] log lines AND the declared-vs-live listener audit.
        if [ -f "$NGINX_LOG_DIR/error.log" ]; then
            new_emerg=$(tail -n +$((log_mark + 1)) "$NGINX_LOG_DIR/error.log" 2>/dev/null | grep '\[emerg\]' || true)
        fi
        nginx_expected_listeners_compute
        nginx_listeners_audit

        if [ "$NGINX_LISTENERS_OK" = "yes" ] && [ -z "$new_emerg" ]; then
            echo "[nginx] [OK] Configuration valid; service reloaded and listeners verified"
        else
            echo "[nginx] [FAIL] reload did NOT take effect; the master keeps serving its stale in-memory config"
            if [ -n "$new_emerg" ]; then
                printf '%s\n' "$new_emerg" | while IFS= read -r emerg_line; do
                    echo "[nginx]   $emerg_line"
                done
            fi
            # A reload can never heal an aborted-bind world; only a fresh exec
            # can. The restart is gated on the bind pre-flight so a port
            # conflict is cleared first instead of causing downtime.
            nginx_bind_preflight
            if [ "$NGINX_BIND_PREFLIGHT_OK" != "yes" ]; then
                echo "[nginx] [FAIL] bind pre-flight failed; restart skipped (would take nginx down)"
                return 1
            fi
            $USE_SUDO systemctl restart nginx 2>/dev/null || true
            sleep 1
            nginx_expected_listeners_compute
            nginx_listeners_audit
            if [ "$NGINX_LISTENERS_OK" = "yes" ] && systemctl is-active --quiet nginx 2>/dev/null; then
                echo "[nginx] [OK] restart healed the stale master; listeners verified"
            else
                echo "[nginx] [FAIL] listeners still divergent after the restart"
                return 1
            fi
        fi
    else
        echo "[nginx] Configuration valid; service not active, reload skipped"
    fi
    return 0
}
