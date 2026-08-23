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

# ============================================================================
# nginx_manager.sh - complete nginx management architecture (shell side)
# ============================================================================
# SYNC CONTRACT (two ends, one truth):
#   Shell end   : this file + nginx_common.sh + domain_setup_common.sh
#                 + port_guard_common.sh (80/443 tcp+udp occupier guard)
#   Laravel end : poly_apps/laravel_main/app/Apps/ServerManagerV1/
#                 ServerManagerV1Controllers/ServerManagerV1NginxManagerCtl.php
#                 ServerManagerV1Utils/ServerManagerV1NginxConfigBuilder.php
#                 ServerManagerV1Utils/ServerManagerV1CertificateManager.php
#                 ServerManagerV1CLI/Commands/ServerManagerV1BaseCommand.php
#                 (api.* proxy default backend port)
#   UI end      : poly_apps/pycore_laravel_wordnew_ui/apps/laravel-manager
#                 (http://127.0.0.1:13054/laravel-manager#/server)
# Any change to vhost templates (HTTP/3, 301, TLS early data), repair logic,
# upgrade policy, or certificate flow MUST be applied to BOTH the shell end
# and the Laravel end in the same change. Update this contract when the file
# list changes.
#
# Lifecycle split: initial provisioning runs through the shell end
# (dd.sh -> 33_install_nginx.sh -> this manager; or 175_laravel_main_start.sh
# -> this manager). After provisioning, day-to-day management runs through the
# UI -> laravel_main API (the Laravel end), which renders the SAME canonical
# vhost stanzas.
#
# Every capability is a fine-grained idempotent primitive; the CLI dispatches
# one subcommand per primitive so callers (26, 132, artisan, cron) compose
# exactly what they need. Load-time side effect free: safe to source from any
# context; directories resolve map_web_path -> global-var store -> defaults.
# ============================================================================

NGINX_MANAGER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$NGINX_MANAGER_DIR/domain_setup_common.sh"

NM_MAIN_CONF="$NGINX_MAIN_CONF"
NM_LOG_DIR="$NGINX_LOG_DIR"
NM_PORT="80"
NM_CONF_D="$NGINX_CONF_D"
NGINX_MANAGER_SITE_ACTIONS="$NGINX_MANAGER_DIR/nginx_manager_site_actions.sh"

source "$NGINX_MANAGER_SITE_ACTIONS"

# --- Lazy path resolution (valid with or without gvar_common.sh) -----------
nm_web_path() {
    local key="$1"
    local sub="${2:-}"
    local stored=""
    local gdir="${CORE_NODE_DATA_DIR:-/var/_core_node}/global_var"
    local store_key

    if declare -F map_web_path >/dev/null 2>&1; then
        map_web_path "$key" "$sub"
        return 0
    fi
    store_key="$(echo "NGINX_${key}${sub:+_$sub}" | tr '[:lower:]-' '[:upper:]_')"
    if [ -f "$gdir/$store_key" ]; then
        stored=$(lazy_sudo cat "$gdir/$store_key" 2>/dev/null | tr -d '\r')
        stored=$(echo "$stored" | sed '/^\s*$/d' | head -1)
    fi
    if [ -n "$stored" ]; then
        echo "$stored"
        return 0
    fi
    case "$key" in
        wwwroot)     echo "/www/wwwroot" ;;
        nginxconfig)
            if [ -n "$sub" ]; then echo "/etc/nginx/$sub"; else echo "/etc/nginx"; fi ;;
        backup)      echo "/www/backup/${sub:-nginx-configs}" ;;
        *)           echo "/www/$key${sub:+/$sub}" ;;
    esac
}

nm_sites_available() { nginx_get_sites_available; }
nm_sites_enabled() { nginx_get_sites_enabled; }
nm_www_root() { nm_web_path "wwwroot"; }
nm_backup_dir() { nm_web_path "backup" "nginx-configs"; }

# --- Primitives (each one independently idempotent) -------------------------

# Disable/remove competing web servers (Caddy, Apache) and their repos.
nm_conflicts_clear() {
    local sudo_cmd
    sudo_cmd=$(lazy_sudo)
    echo "[nginx-mgr] Checking conflicting web servers..."

    if command -v caddy >/dev/null 2>&1; then
        echo "[nginx-mgr] Removing Caddy..."
        $sudo_cmd systemctl stop caddy 2>/dev/null || true
        $sudo_cmd systemctl disable caddy 2>/dev/null || true
        $sudo_cmd apt remove --purge -y caddy 2>/dev/null || true
        $sudo_cmd rm -f /etc/apt/sources.list.d/caddy-stable.list
        $sudo_cmd rm -f /usr/share/keyrings/caddy-stable-archive-keyring.gpg
        $sudo_cmd rm -rf /etc/caddy /var/lib/caddy /var/log/caddy
    else
        echo "[nginx-mgr] No Caddy installation found"
    fi

    if declare -F abg_block_apache >/dev/null 2>&1; then
        abg_block_apache
    fi
}

# Free the nginx edge ports (80/TCP, 443/TCP, 443/UDP for QUIC) from foreign
# occupiers through the shared port guard (port_guard_common.sh): detect ->
# identify -> stop -> interactive y/N uninstall -> re-detect. nginx's own
# sockets are never touched. Self-detecting and safe to run on every pass.
nm_edge_ports_ensure() {
    pg_ports_ensure_free 80 443
}

# Ensure the mapped directory layout used by Laravel ServerManager.
nm_layout_ensure() {
    local sudo_cmd
    local dirs=(
        "$(nm_www_root)"
        "$(nm_www_root)/default"
        "$(nm_sites_available)"
        "$(nm_sites_enabled)"
        "$NM_CONF_D"
        "$NM_LOG_DIR"
        "$(nm_backup_dir)"
    )
    local dir
    sudo_cmd=$(lazy_sudo)

    for dir in "${dirs[@]}"; do
        nginx_ensure_directory "$dir"
    done

    $sudo_cmd chown -R root:root "$(nm_web_path "nginxconfig")" 2>/dev/null || true
    $sudo_cmd chmod -R 755 "$(nm_web_path "nginxconfig")" 2>/dev/null || true
    $sudo_cmd chown -R root:adm "$NM_LOG_DIR" 2>/dev/null || true
    $sudo_cmd chmod -R 755 "$NM_LOG_DIR" 2>/dev/null || true
}

# Install the canonical nginx.conf (includes mapped sites-enabled + conf.d).
# TLS 1.2/1.3 with early data + QUIC tuning; content-hash idempotent.
nm_main_config() {
    local sudo_cmd
    local quic_bpf_line=""
    sudo_cmd=$(lazy_sudo)

    # quic_bpf (Linux 5.7+): eBPF steering keeps one QUIC connection on one
    # worker; the reuseport alternative is NOT usable here because nginx
    # accepts reuseport only once per address:port while every managed vhost
    # listens on 443 quic.
    if [ "$(uname -s 2>/dev/null)" = "Linux" ] && \
       nginx_version_ge "$(uname -r 2>/dev/null | grep -oE '^[0-9]+(\.[0-9]+){0,2}' || echo 0)" "5.7.0"; then
        quic_bpf_line="    quic_bpf on;
"
    fi

    write_file_if_changed "$NM_MAIN_CONF" "$(nm_backup_dir)" <<EOF
user www-data;
worker_processes auto;
pid /run/nginx.pid;
error_log $NM_LOG_DIR/error.log;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '\$remote_addr - \$remote_user [\$time_local] "\$request" '
                    '\$status \$body_bytes_sent "\$http_referer" '
                    '"\$http_user_agent" "\$http_x_forwarded_for"';

    access_log $NM_LOG_DIR/access.log main;

    sendfile on;
    tcp_nopush on;
    types_hash_max_size 2048;
    server_tokens off;

    keepalive_timeout 65;
    keepalive_requests 1000;

    # TLS defaults: TLS 1.2/1.3 with 0-RTT early data (replay-safe via
    # \$ssl_early_data forwarded to backends).
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_early_data on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # HTTP/3 (QUIC) tuning; harmless on builds without http_v3_module.
    quic_gso on;
    quic_active_connection_id_limit 4;
${quic_bpf_line}

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript
               application/javascript application/json application/xml+rss;

    include $NM_CONF_D/*.conf;
    include $(nm_sites_enabled)/*;
}
EOF
    # The official package ships its own default server; drop it so only the
    # mapped sites-enabled layout serves content.
    $sudo_cmd rm -f "$NM_CONF_D/default.conf"
    $sudo_cmd rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
}

# Install the default vhost (port 80 + ACME webroot).
nm_default_vhost() {
    local sudo_cmd
    local site_config
    local site_enabled
    sudo_cmd=$(lazy_sudo)
    site_config="$(nm_sites_available)/default"
    site_enabled="$(nm_sites_enabled)/default"

    write_file_if_changed "$site_config" "$(nm_backup_dir)" <<EOF
server {
    listen $NM_PORT default_server;
    listen [::]:$NM_PORT default_server;

    server_name _;

    root $(nm_www_root);
    index index.html index.htm;

    location / {
        try_files \$uri \$uri/ =404;
    }

    location ^~ /.well-known/acme-challenge/ {
        allow all;
        root $(nm_www_root);
        try_files \$uri =404;
    }

    location ~ /\.ht {
        deny all;
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
}
EOF

    if [ ! -L "$site_enabled" ] || [ "$(readlink -f "$site_enabled")" != "$(readlink -f "$site_config")" ]; then
        $sudo_cmd ln -sfn "$site_config" "$site_enabled"
        echo "[nginx-mgr] [OK] Enabled default site"
    else
        echo "[nginx-mgr] [SKIP] Default site already enabled"
    fi
}

# Link /etc/nginx items into the mapped nginxconfig view directory.
nm_symlinks_ensure() {
    local sudo_cmd
    local items=(
        "nginx.conf"
        "mime.types"
        "conf.d"
        "snippets"
        "modules-available"
        "modules-enabled"
    )
    local item
    local source_path
    local target_path
    local config_dir
    sudo_cmd=$(lazy_sudo)
    config_dir=$(nm_web_path "nginxconfig")

    $sudo_cmd mkdir -p "$config_dir"

    for item in "${items[@]}"; do
        source_path="/etc/nginx/$item"
        target_path="$config_dir/$item"
        if [ ! -e "$source_path" ]; then
            continue
        fi
        if [ -L "$target_path" ] && [ "$(readlink "$target_path")" = "$source_path" ]; then
            continue
        fi
        $sudo_cmd rm -rf "$target_path"
        $sudo_cmd ln -sfn "$source_path" "$target_path"
        echo "[nginx-mgr] [OK] Symlink: $target_path -> $source_path"
    done
}

# Detect all server IPv4 addresses for the default page.
nm_detect_ips() {
    local ips
    local unique_ips
    ips=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | grep -v '^127\.0\.0\.1$' || true)
    if [ -z "$ips" ]; then
        ips=$(ip -4 addr show 2>/dev/null | grep -oE 'inet [0-9.]+' | cut -d' ' -f2 | grep -v '^127\.0\.0\.1$' || true)
    fi
    unique_ips=$(echo "$ips" | sort -u | tr '\n' ' ' | xargs)
    if [ -z "$unique_ips" ]; then
        unique_ips="localhost"
    fi
    echo "$unique_ips"
}

# Install the default landing page with current server IPs.
nm_default_page() {
    local sudo_cmd
    local html_file
    local server_ips
    local ip
    local ip_list=""
    sudo_cmd=$(lazy_sudo)
    html_file="$(nm_www_root)/default/index.html"

    server_ips=$(nm_detect_ips)
    for ip in $server_ips; do
        if [ "$ip" != "localhost" ]; then
            ip_list="$ip_list<li><a href=\"http://$ip:$NM_PORT\">http://$ip:$NM_PORT</a></li>"
        fi
    done
    if [ -z "$ip_list" ]; then
        ip_list="<li>http://your-server-ip:$NM_PORT</li>"
    fi

    write_file_if_changed "$html_file" "$(nm_backup_dir)" <<EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nginx Installation Successful</title>
</head>
<body>
    <h1>Nginx Installation Successful!</h1>
    <p>Version: $(nginx_get_version)</p>
    <p>WWW Root: $(nm_www_root)</p>
    <h2>Access URLs:</h2>
    <ul>$ip_list</ul>
    <p>Generated: $(date)</p>
</body>
</html>
EOF
    $sudo_cmd chown root:root "$html_file" 2>/dev/null || true
    $sudo_cmd chmod 644 "$html_file" 2>/dev/null || true
}

# Enable/start (arg "start") or stop/disable the service.
nm_service_state() {
    local wanted="${1:-start}"
    local sudo_cmd
    local unit_exists
    sudo_cmd=$(lazy_sudo)
    unit_exists=$(systemctl list-unit-files 2>/dev/null | grep -c "^nginx\.service" || true)

    if [ "$unit_exists" = "0" ]; then
        echo "[nginx-mgr] [WARN] nginx.service unit not found"
        return 1
    fi

    if [ "$wanted" = "start" ]; then
        # Self-gating: never start/reload on a broken configuration. Callers
        # detect the outcome via systemctl is-active, not via this function's
        # exit code.
        if ! $sudo_cmd nginx -t -c "$NM_MAIN_CONF" >/dev/null 2>&1; then
            echo "[nginx-mgr] [WARN] Config test failed; service start skipped (fix config, then re-run)"
            return 1
        fi
        nm_edge_ports_ensure || true
        $sudo_cmd systemctl enable nginx 2>/dev/null || true
        $sudo_cmd systemctl start nginx 2>/dev/null || true
        local attempt
        for attempt in 1 2 3 4 5; do
            if systemctl is-active --quiet nginx; then
                echo "[nginx-mgr] [OK] Nginx service active and enabled"
                return 0
            fi
            sleep 1
        done
        echo "[nginx-mgr] [FAIL] Nginx service failed to start"
        return 1
    fi

    if systemctl is-enabled --quiet nginx 2>/dev/null; then
        $sudo_cmd systemctl disable nginx
    fi
    echo "[nginx-mgr] [OK] Service left disabled"
    return 0
}

# Persist installation facts into the global-var store for downstream
# consumers (Laravel ServerManager, nginx_manager path resolution).
nm_store_info() {
    local nginx_binary
    nginx_binary=$(nginx_get_binary)

    domain_state_set "NGINX_BIN" "$nginx_binary"
    domain_state_set "NGINX_VERSION" "$(nginx_get_version)"
    domain_state_set "NGINX_WWW_ROOT" "$(nm_www_root)"
    domain_state_set "NGINX_DEFAULT_SITE" "$(nm_www_root)/default"
    domain_state_set "NGINX_CONFIG_DIR" "$(nm_web_path "nginxconfig")"
    domain_state_set "NGINX_SITES_AVAILABLE" "$(nm_sites_available)"
    domain_state_set "NGINX_SITES_ENABLED" "$(nm_sites_enabled)"
    domain_state_set "NGINX_CONFIG_FILE" "$NM_MAIN_CONF"
    domain_state_set "NGINX_LOG_DIR" "$NM_LOG_DIR"
    domain_state_set "NGINX_PORT" "$NM_PORT"
    domain_state_set "NGINX_SERVER_IPS" "$(nm_detect_ips)"
    domain_state_set "NGINX_SERVICE_STATUS" "$(systemctl is-active nginx 2>/dev/null || echo unknown)"
    domain_state_set "NGINX_HTTP3_SUPPORT" "$(nginx_has_http3 && echo true || echo false)"
    domain_state_set "NGINX_QUIC_EARLY_DATA" "$(nginx_quic_early_data_supported && echo true || echo false)"
}

# Full verification: config test, version floor, HTTP/3 module, service state.
nm_verify() {
    local failures=0
    local version
    local sudo_cmd
    local bin_link_target
    local port_ok=false
    local attempt
    local canonical
    local alias_path
    local alias_failures=0
    sudo_cmd=$(lazy_sudo)

    nginx_unify_binaries || failures=$((failures + 1))

    version=$(nginx_get_version)
    canonical=$(nginx_get_binary)
    if [ -z "$version" ]; then
        echo "[nginx-mgr] [FAIL] No nginx binary found"
        return 1
    fi

    echo "[nginx-mgr] Version: nginx/$version (binary: $(nginx_get_binary))"

    if ! nginx_version_ge "$version" "$NGINX_MINIMUM_VERSION"; then
        echo "[nginx-mgr] [FAIL] nginx/$version is older than required $NGINX_MINIMUM_VERSION"
        failures=$((failures + 1))
    fi

    if nginx_has_http3; then
        echo "[nginx-mgr] [OK] HTTP/3 module present"
    else
        echo "[nginx-mgr] [FAIL] HTTP/3 module missing"
        failures=$((failures + 1))
    fi

    if nginx_quic_early_data_supported; then
        echo "[nginx-mgr] [OK] QUIC 0-RTT early data supported (OpenSSL >= $NGINX_OPENSSL_QUIC_VERSION)"
    else
        echo "[nginx-mgr] [INFO] QUIC 0-RTT unavailable (OpenSSL $(nginx_get_openssl_version)); TLS 1.3 early data over TCP remains active"
    fi

    if ! $sudo_cmd nginx -t -c "$NM_MAIN_CONF" 2>&1; then
        echo "[nginx-mgr] [FAIL] Configuration test failed"
        failures=$((failures + 1))
    fi

    bin_link_target=$(readlink -f /usr/local/bin/nginx 2>/dev/null || true)
    if [ -z "$bin_link_target" ] || [ ! -x "$bin_link_target" ]; then
        echo "[nginx-mgr] [FAIL] /usr/local/bin/nginx link missing or broken"
        failures=$((failures + 1))
    else
        echo "[nginx-mgr] [OK] /usr/local/bin/nginx -> $bin_link_target"
    fi

    if [ -n "$canonical" ]; then
        canonical=$(readlink -f "$canonical" 2>/dev/null || echo "$canonical")
        for alias_path in /usr/local/bin/nginx /usr/sbin/nginx /usr/bin/nginx /usr/local/sbin/nginx; do
            [ "$alias_path" = "$canonical" ] && continue
            [ -e "$alias_path" ] || [ -L "$alias_path" ] || continue
            if [ "$(readlink -f "$alias_path" 2>/dev/null || true)" != "$canonical" ]; then
                echo "[nginx-mgr] [FAIL] $alias_path not unified to $canonical"
                alias_failures=$((alias_failures + 1))
            fi
        done
        failures=$((failures + alias_failures))
        if [ $alias_failures -eq 0 ]; then
            echo "[nginx-mgr] [OK] Single nginx binary unified at $canonical"
        fi
    fi

    if systemctl is-active --quiet nginx 2>/dev/null; then
        for attempt in 1 2 3 4 5 6 7 8 9 10; do
            if ss -tln 2>/dev/null | grep -qE ':80(\s|$)'; then
                port_ok=true
                break
            fi
            sleep 1
        done
        if [ "$port_ok" = true ]; then
            echo "[nginx-mgr] [OK] Port 80 listening"
        else
            echo "[nginx-mgr] [FAIL] Port 80 not listening"
            failures=$((failures + 1))
        fi
    else
        echo "[nginx-mgr] [INFO] Service not active; port 80 check skipped"
    fi

    if [ $failures -eq 0 ]; then
        echo "[nginx-mgr] [OK] All verification checks passed"
        return 0
    fi
    echo "[nginx-mgr] [FAIL] $failures verification check(s) failed"
    return 1
}

# Install or upgrade to the official mainline package. When nginx is already
# installed and the apt candidate is newer, the package is upgraded in place
# (sites and certificates are untouched by apt; the repair sweep re-validates).
nm_install_or_upgrade() {
    local sudo_cmd
    local installed=""
    local candidate=""
    sudo_cmd=$(lazy_sudo)

    nginx_ensure_official_repo || return 1

    installed=$(nginx_get_version)
    candidate=$(apt-cache policy nginx 2>/dev/null | grep -m1 'Candidate:' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || true)

    if [ -z "$installed" ]; then
        nm_edge_ports_ensure || true
        $sudo_cmd apt install -y nginx --no-install-recommends
        return $?
    fi

    if [ -n "$candidate" ] && ! nginx_version_ge "$installed" "$candidate"; then
        echo "[nginx-mgr] Upgrading nginx $installed -> $candidate (sites preserved)"
        $sudo_cmd apt install -y nginx --no-install-recommends
        return $?
    fi

    echo "[nginx-mgr] [SKIP] nginx $installed already at candidate ${candidate:-unknown}"
    return 0
}

# Migrate existing site files from the legacy inline-HTTP/2 style to the
# canonical HTTP/3 stanza. Per-file idempotent: each directive is only
# rewritten/added when absent. Only files with ssl_certificate are touched.
nm_http3_migrate() {
    local sites_available
    local file
    local changed
    local sudo_cmd
    sudo_cmd=$(lazy_sudo)
    sites_available=$(nm_sites_available)

    [ -d "$sites_available" ] || return 0

    for file in "$sites_available"/*; do
        [ -f "$file" ] || continue
        grep -q "ssl_certificate" "$file" 2>/dev/null || continue
        changed=false

        # Deprecated "listen ... http2" parameter -> standalone http2 on;
        if grep -qE 'listen\s+.*\bhttp2\b' "$file"; then
            $sudo_cmd sed -i -E 's/(listen\s+[^;]*?)\s+http2(\s*;)/\1\2/g' "$file"
            grep -q 'http2 on;' "$file" || $sudo_cmd sed -i -E '0,/(listen\s+443 ssl;)/s//\1\n    http2 on;/' "$file"
            changed=true
        fi

        # Missing QUIC listeners -> add HTTP/3
        if ! grep -q 'listen 443 quic;' "$file"; then
            $sudo_cmd sed -i -E '0,/(listen\s+\[::\]:443 ssl;)/s//\1\n    listen 443 quic;\n    listen [::]:443 quic;\n    http3 on;\n    quic_retry on;/' "$file"
            changed=true
        fi

        # Missing fixed QUIC host key -> add (stops the per-reload random-key
        # token invalidation under quic_retry on)
        if grep -q 'quic_retry on;' "$file" && ! grep -q 'quic_host_key' "$file"; then
            nginx_ensure_quic_host_key
            if [ "$NGINX_QUIC_HOST_KEY_READY" = "yes" ]; then
                $sudo_cmd sed -i -E "0,/(quic_retry on;)/s||\1\n    quic_host_key $(nginx_quic_host_key_file);|" "$file"
                changed=true
            fi
        fi

        # Missing Alt-Svc advertisement -> add
        if ! grep -q 'Alt-Svc' "$file"; then
            $sudo_cmd sed -i -E '0,/(quic_retry on;)/s//\1\n    add_header Alt-Svc '\''h3=":443"; ma=86400'\'' always;/' "$file"
            changed=true
        fi

        # Missing TLS early data -> add
        if ! grep -q 'ssl_early_data on;' "$file"; then
            $sudo_cmd sed -i -E '0,/(ssl_protocols[^;]*;)/s//\1\n    ssl_early_data on;/' "$file"
            changed=true
        fi

        if [ "$changed" = true ]; then
            echo "[nginx-mgr] [OK] Migrated to canonical HTTP/3 stanza: $file"
        fi
    done

    return 0
}


# --- CLI dispatch -----------------------------------------------------------

nm_usage() {
    cat <<EOF
nginx_manager.sh - complete nginx management (idempotent primitives)

Usage: bash nginx_manager.sh <command> [args]

Lifecycle:
  ensure-repo        Configure the official nginx.org mainline repository
                     (Debian / Ubuntu / Kali - Kali maps to the Debian repo)
  install            Install or in-place upgrade nginx (sites preserved)
  migrate-legacy     Interactively replace a legacy/distro install
  purge-legacy       Purge distro variant packages (nginx-common/-core/...)
  replace-foreign    Quarantine foreign prefix installs (/usr/local/nginx, ...)
  edge-ports         Free 80/TCP, 443/TCP, 443/UDP from foreign occupiers
                     (stop + interactive y/N uninstall; nginx never touched)
  repair             Repair sites + main config + service (self-healing sweep)
  http3-migrate      Upgrade existing site files to the canonical HTTP/3 stanza
  verify             Run all verification checks
  status [--json]    Human or machine-readable status

Configuration:
  layout             Ensure the mapped directory layout
  main-config        Write the canonical nginx.conf (content-hash idempotent)
  default-vhost      Write the default port-80 vhost + ACME webroot
  default-page       Write the default landing page
  symlinks           Link /etc/nginx into the mapped nginxconfig view
  bin-link           Unify all nginx paths to a single canonical binary
  unify-binaries     Alias for bin-link (idempotent replace of old nginx paths)
  service <start|stop>  Enable/start or disable the systemd service
  store-info         Persist facts into the global-var store

Sites:
  site-add <fqdn> <static|proxy> <root|backend> [cert_domain]
  site-remove <fqdn>
  site-list
  domains-sync [backend_url]   Secrets -> certificates -> api.<region>.<domain>

Certificates:
  cert-ensure <domain>         Issue/verify via Laravel ServerManager (DNSPod)
  cert-renew                   certbot renew + reload nginx on change

Region prefix:
  prefix-show                  Show the stored API region prefix
  prefix-set <prefix>          Store a new API region prefix (si/sh/sz/hk/...)
EOF
}

nginx_manager_main() {
    local cmd="${1:-}"
    shift 2>/dev/null || true

    case "$cmd" in
        ensure-repo)     nginx_ensure_official_repo ;;
        install)         nm_install_or_upgrade ;;
        migrate-legacy)  nginx_replace_legacy_install "false" ;;
        purge-legacy)    nm_purge_legacy_packages ;;
        replace-foreign) nm_replace_foreign_nginx ;;
        source-build)    nginx_offer_source_build "false" ;;
        repair)          nginx_repair_sites ;;
        http3-migrate)   nm_http3_migrate ;;
        verify)          nm_verify ;;
        status)
            if [ "${1:-}" = "--json" ]; then nm_status_json; else nm_verify; fi ;;
        layout)          nm_layout_ensure ;;
        main-config)     nm_main_config ;;
        default-vhost)   nm_default_vhost ;;
        default-page)    nm_default_page ;;
        symlinks)        nm_symlinks_ensure ;;
        bin-link|unify-binaries) nginx_unify_binaries ;;
        service)         nm_service_state "${1:-start}" ;;
        store-info)      nm_store_info ;;
        conflicts-clear) nm_conflicts_clear ;;
        edge-ports)      nm_edge_ports_ensure ;;
        site-add)        nm_site_add "$@" ;;
        site-remove)     nm_site_remove "$@" ;;
        site-list)       nm_site_list ;;
        domains-sync)    nm_domains_sync "$@" ;;
        cert-ensure)     nm_cert_ensure "$@" ;;
        cert-renew)      nm_cert_renew ;;
        prefix-show)     domain_state_get "$DOMAIN_API_PREFIX_KEY" "(not set)" ;;
        prefix-set)
            domain_state_set "$DOMAIN_API_PREFIX_KEY" "$1"
            echo "[nginx-mgr] [OK] API region prefix set to: $1" ;;
        ""|--help|-h|help) nm_usage ;;
        *)
            echo "[nginx-mgr] Unknown command: $cmd" >&2
            nm_usage >&2
            return 1
            ;;
    esac
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    nginx_manager_main "$@"
    exit $?
fi
