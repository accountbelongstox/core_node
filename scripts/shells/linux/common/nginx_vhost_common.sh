#!/bin/bash

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
# site's proxy shape (HTTP/3 + 301 + upstream) is INVARIANT - certificate
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

