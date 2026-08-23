#!/bin/bash

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
        # <prefix>/conf/nginx.conf - letting it become canonical would strand
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

