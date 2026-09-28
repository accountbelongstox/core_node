#!/bin/bash

# Site management primitives -------------------------------------------------

# Purge distro nginx variant packages that conflict with the official
# nginx.org monolithic package. Per-package idempotent. Only runs when the
# official package is installed or nginx is absent entirely - a kept legacy
# distro install (user declined replacement) is never broken.
nm_purge_legacy_packages() {
    local sudo_cmd
    local pkg
    local origin
    local legacy_pkgs="nginx-common nginx-core nginx-full nginx-extras"
    sudo_cmd=$(lazy_sudo)
    origin=$(nginx_get_package_origin)

    if [ -n "$(nginx_get_version)" ] && [ "$origin" != "nginx.org" ]; then
        echo "[nginx-mgr] [SKIP] Kept non-official nginx (origin: $origin); legacy variant packages left intact"
        return 0
    fi

    for pkg in $legacy_pkgs; do
        if dpkg -l "$pkg" 2>/dev/null | grep -q "^ii"; then
            echo "[nginx-mgr] Purging legacy package: $pkg"
            $sudo_cmd apt remove --purge -y "$pkg" || echo "[nginx-mgr] [WARN] Failed to purge $pkg"
        fi
    done
    local mod_pkgs
    mod_pkgs=$(dpkg -l 2>/dev/null | awk '/^ii\s+libnginx-mod-/ {print $2}' || true)
    for pkg in $mod_pkgs; do
        echo "[nginx-mgr] Purging legacy module package: $pkg"
        $sudo_cmd apt remove --purge -y "$pkg" || echo "[nginx-mgr] [WARN] Failed to purge $pkg"
    done
    $sudo_cmd apt autoremove -y 2>/dev/null || true
    return 0
}

# Replace every nginx installation on the system that is not the official
# package or our own marked source build. Foreign prefix installs
# (/usr/local/nginx, /opt/nginx, openresty bundles) that are NOT the active
# binary are quarantined into the backup dir; the ACTIVE foreign binary is
# left for the interactive migrate-legacy flow (never killed unattended).
nm_replace_foreign_nginx() {
    local sudo_cmd
    local sbin
    local prefix
    local active_binary
    local quarantine_dir
    sudo_cmd=$(lazy_sudo)
    active_binary=$(nginx_get_binary)
    quarantine_dir="$(nm_backup_dir)/foreign-nginx"

    for sbin in /usr/local/nginx/sbin/nginx /opt/nginx/sbin/nginx /usr/local/openresty/nginx/sbin/nginx; do
        [ -x "$sbin" ] || continue
        prefix="$(dirname "$(dirname "$sbin")")"

        if [ -f "$prefix/.core_node_source_build" ]; then
            echo "[nginx-mgr] [SKIP] $prefix is our managed source build"
            continue
        fi
        if [ "$sbin" = "$active_binary" ]; then
            echo "[nginx-mgr] [SKIP] $sbin is the active binary; handled by the migrate-legacy step"
            continue
        fi

        echo "[nginx-mgr] Quarantining foreign nginx install: $prefix ($($sbin -v 2>&1 | head -1))"
        $sudo_cmd mkdir -p "$quarantine_dir"
        $sudo_cmd pkill -f "$sbin" 2>/dev/null || true
        $sudo_cmd mv "$prefix" "$quarantine_dir/$(basename "$prefix").$(date +%Y%m%d%H%M%S)" || {
            echo "[nginx-mgr] [WARN] Failed to quarantine $prefix"
        }
    done
    return 0
}

# Site management primitives -------------------------------------------------

# Add (or idempotently re-render) one site.
# Usage: nm_site_add <fqdn> <static|proxy> <doc_root|backend_url> [cert_domain]
nm_site_add() {
    local fqdn="$1"
    local type="$2"
    local target="$3"
    local cert_domain="${4:-$1}"
    local http_mode="redirect"
    local sites_available
    local sites_enabled
    local site_file
    local enabled_link
    local cert_path
    local sudo_cmd
    sudo_cmd=$(lazy_sudo)

    if [ -z "$fqdn" ] || [ -z "$type" ]; then
        echo "[nginx-mgr] Usage: site-add <fqdn> <static|proxy> <doc_root|backend_url> [cert_domain]"
        return 1
    fi

    sites_available=$(nm_sites_available)
    sites_enabled=$(nm_sites_enabled)
    site_file="$sites_available/$fqdn"
    enabled_link="$sites_enabled/$fqdn"

    # The vhost SHAPE is invariant: certificate state never downgrades the
    # site to a bootstrap stub. Real Let's Encrypt material wins the probe;
    # otherwise the ensured placeholder keeps the render nginx-valid (the
    # content-hash writer swaps to the real cert on the sweep after issuance).
    nginx_ensure_placeholder_cert

    case "$type" in
        proxy)
            # api.* vhosts proxy directly on :80 (no 301) so plain HTTP
            # reaches the backend even while 443 is blocked; everything else
            # keeps the canonical 301 -> https pair.
            if nginx_is_api_fqdn "$fqdn"; then
                http_mode="proxy"
            fi
            {
                echo "# $NGINX_MANAGED_SITE_MARKER nginx_manager fqdn=$fqdn cert=$cert_domain"
                nginx_render_proxy_vhost "$fqdn" "$target" "$cert_domain" "$http_mode"
            } | write_file_if_changed "$site_file" "$(nm_backup_dir)"
            ;;
        static|html)
            {
                echo "# $NGINX_MANAGED_SITE_MARKER nginx_manager fqdn=$fqdn cert=$cert_domain"
                nginx_render_site_vhost "$fqdn" "$target" "$cert_domain"
            } | write_file_if_changed "$site_file" "$(nm_backup_dir)"
            ;;
        *)
            echo "[nginx-mgr] Unsupported site type: $type"
            return 1
            ;;
    esac

    if [ ! -L "$enabled_link" ] || [ "$(readlink -f "$enabled_link" 2>/dev/null)" != "$(readlink -f "$site_file" 2>/dev/null)" ]; then
        $sudo_cmd mkdir -p "$sites_enabled"
        $sudo_cmd ln -sfn "$site_file" "$enabled_link"
        echo "[nginx-mgr] [OK] Site enabled: $fqdn"
    fi
    return 0
}

# Remove one site (available file + enabled link), keeping a backup.
nm_site_remove() {
    local fqdn="$1"
    local sites_available
    local sites_enabled
    local sudo_cmd
    sudo_cmd=$(lazy_sudo)

    if [ -z "$fqdn" ]; then
        echo "[nginx-mgr] Usage: site-remove <fqdn>"
        return 1
    fi

    sites_available=$(nm_sites_available)
    sites_enabled=$(nm_sites_enabled)

    $sudo_cmd rm -f "$sites_enabled/$fqdn"
    if [ -f "$sites_available/$fqdn" ]; then
        $sudo_cmd mkdir -p "$(nm_backup_dir)"
        $sudo_cmd mv "$sites_available/$fqdn" "$(nm_backup_dir)/$fqdn.$(date +%Y%m%d%H%M%S).removed"
        echo "[nginx-mgr] [OK] Site removed (backed up): $fqdn"
    else
        echo "[nginx-mgr] [SKIP] Site not present: $fqdn"
    fi
    return 0
}

# List sites (enabled links + availability state).
nm_site_list() {
    local sites_available
    local sites_enabled
    local file
    sites_available=$(nm_sites_available)
    sites_enabled=$(nm_sites_enabled)

    for file in "$sites_available"/*; do
        [ -f "$file" ] || continue
        local name
        name=$(basename "$file")
        if [ -L "$sites_enabled/$name" ]; then
            echo "$name enabled"
        else
            echo "$name available"
        fi
    done
}

# Certificate primitives -----------------------------------------------------

# Idempotent certificate ensure for one domain through Laravel ServerManager.
nm_cert_ensure() {
    local domain="$1"
    if [ -z "$domain" ]; then
        echo "[nginx-mgr] Usage: cert-ensure <domain>"
        return 1
    fi
    domain_setup_load_secrets || return 1
    domain_setup_ensure_prefix || return 1
    domain_setup_issue_certificate "$domain"
}

# Renew all certificates and reload nginx on change (the renewal timer calls
# certbot directly; this subcommand is the manual/management path). Uses the
# canonical pipx link owned by 35_install_certbot.sh (binary-existence gate).
nm_cert_renew() {
    local sudo_cmd
    local certbot_bin="/usr/local/bin/certbot"
    sudo_cmd=$(lazy_sudo)
    if [ ! -x "$certbot_bin" ]; then
        echo "[nginx-mgr] [WARN] certbot not installed at $certbot_bin; run 35_install_certbot.sh first"
        return 0
    fi
    $sudo_cmd "$certbot_bin" renew --quiet
    if systemctl is-active --quiet nginx 2>/dev/null; then
        $sudo_cmd systemctl reload nginx 2>/dev/null || true
    fi
    echo "[nginx-mgr] [OK] Certificate renewal pass complete"
    return 0
}

# Sync every domain from the decrypted DNSPod secrets into nginx
# (certificates + api.<region>.<domain> sites + repair sweep).
nm_domains_sync() {
    local backend="${1:-$(domain_api_backend_url)}"
    domain_setup_install_all "$backend"
}

# Machine-readable status for API/UI alignment.
nm_status_json() {
    local version
    local http3
    local early
    local active
    local config_ok
    version=$(nginx_get_version)
    http3=$(nginx_has_http3 && echo true || echo false)
    early=$(nginx_quic_early_data_supported && echo true || echo false)
    active=$(systemctl is-active nginx 2>/dev/null || echo unknown)
    if $(lazy_sudo) nginx -t -c "$NM_MAIN_CONF" >/dev/null 2>&1; then config_ok=true; else config_ok=false; fi
    cat <<EOF
{
  "installed": $([ -n "$version" ] && echo true || echo false),
  "version": "${version:-}",
  "minimum_version": "$NGINX_MINIMUM_VERSION",
  "mainline_version": "$NGINX_MAINLINE_VERSION",
  "http3": $http3,
  "quic_early_data": $early,
  "openssl": "$(nginx_get_openssl_version)",
  "service_active": "$active",
  "config_ok": $config_ok,
  "sites_available": "$(nm_sites_available)",
  "sites_enabled": "$(nm_sites_enabled)",
  "www_root": "$(nm_www_root)"
}
EOF
}

