#!/bin/bash
# Headscale Server Installation Script
#
# Self-hosted Tailscale control server (mesh VPN provider "headscale").
# Runs only when MESH_VPN_PROVIDER=headscale AND hs.<region>.<root> resolves to
# this host's public IP (auto-discovered, never a static host); otherwise it
# prints SKIP. Nodes join through 97_install_tailscale.sh (--login-server).
#
# Design: docs_fix/DESIGN_SHELL_HOSTS.md section 6.5.
# No certificate is requested by this script: the hs.* route only carries the
# shared tls gate (fm_domain_tls_directive_for_host), the same as the 175 domain routes.
# Idempotent: installs the package only when the binary is missing, rewrites the
# config only when its content changed (restart only then), keeps an existing
# pre-auth key secret, and re-renders the FrankenPHP site on every run.

SCRIPT_INDEX="98"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/installation_library.sh"
source "$PARENT_DIR_LEVEL_2/common/firewall_manager.sh"
source "$PARENT_DIR_LEVEL_2/common/service_contract_common.sh"
source "$PARENT_DIR_LEVEL_2/common/mesh_common.sh"
source "$PARENT_DIR_LEVEL_2/common/headscale_common.sh"
source "$PARENT_DIR_LEVEL_2/common/tailscale_common.sh"

init_global_vars

MESH_PROVIDER=""
SERVER_HOST=""
BASE_DOMAIN=""
HEADSCALE_REPO=""
HEADSCALE_SERVICE=""
HEADSCALE_CONFIG_DIR=""
HEADSCALE_DATA_DIR=""
HEADSCALE_CONFIG_FILE=""
HEADSCALE_LISTEN_PORT=""
HEADSCALE_METRICS_PORT=""
HEADSCALE_STUN_PORT=""
HEADSCALE_DERP_REGION_ID=""
HEADSCALE_DERP_REGION_CODE=""
HEADSCALE_IP_V4=""
HEADSCALE_IP_V6=""
HEADSCALE_GITHUB_PROXY_PREFIX="$(get_var "GITHUB_PROXY_PREFIX" "")"
CONFIG_CHANGED="no"

if command -v sudo >/dev/null 2>&1; then
    USE_SUDO="sudo"
else
    USE_SUDO=""
fi

load_headscale_constants() {
    MESH_PROVIDER="$(mesh_vpn_provider)"
    SERVER_HOST="$(mesh_headscale_server_host)"
    BASE_DOMAIN="$(mesh_base_domain)"
    HEADSCALE_REPO="$(headscale_contract_value release_repo)"
    HEADSCALE_SERVICE="$(headscale_service_name)"
    HEADSCALE_CONFIG_DIR="$(headscale_config_dir)"
    HEADSCALE_DATA_DIR="$(headscale_data_dir)"
    HEADSCALE_CONFIG_FILE="$HEADSCALE_CONFIG_DIR/config.yaml"
    HEADSCALE_LISTEN_PORT="$(sc_get ports.headscale)"
    HEADSCALE_METRICS_PORT="$(sc_get ports.headscale_metrics)"
    HEADSCALE_STUN_PORT="$(sc_get ports.headscale_stun)"
    HEADSCALE_DERP_REGION_ID="$(headscale_contract_value derp_region_id)"
    HEADSCALE_DERP_REGION_CODE="$(headscale_contract_value derp_region_code)"
    HEADSCALE_IP_V4="$(headscale_contract_value ip_prefix_v4)"
    HEADSCALE_IP_V6="$(headscale_contract_value ip_prefix_v6)"
}

# Latest release .deb URL for this architecture (optional mirror prefix for
# regions where github.com is slow: gvar GITHUB_PROXY_PREFIX).
resolve_headscale_deb_url() {
    local arch=""
    arch="$(dpkg --print-architecture 2>/dev/null)"
    curl -fsSL --connect-timeout 15 --max-time 60 "${HEADSCALE_GITHUB_PROXY_PREFIX}https://api.github.com/repos/$HEADSCALE_REPO/releases/latest" 2>/dev/null \
        | grep -o '"browser_download_url": *"[^"]*"' \
        | cut -d'"' -f4 \
        | grep -E "headscale_[0-9.]+(-[a-z0-9]+)?_linux_${arch}\.deb$" \
        | head -1
}

install_headscale_package() {
    local deb_url=""
    local deb_file=""

    if command -v headscale >/dev/null 2>&1; then
        print_info_from_common_functions "headscale already installed; skipping package install"
        return 0
    fi
    print_step_from_common_functions "Resolving the latest Headscale release (.deb)..."
    deb_url="$(resolve_headscale_deb_url)"
    if [ -z "$deb_url" ]; then
        print_error_from_common_functions "No Headscale .deb found in the latest $HEADSCALE_REPO release"
        return 1
    fi
    deb_file="$(mktemp /tmp/headscale.XXXXXX.deb)"
    chmod 0644 "$deb_file"
    if ! curl -fsSL --connect-timeout 15 -o "$deb_file" "${HEADSCALE_GITHUB_PROXY_PREFIX}${deb_url}"; then
        print_error_from_common_functions "Failed to download $deb_url"
        rm -f "$deb_file"
        return 1
    fi
    if ! $USE_SUDO dpkg -i "$deb_file"; then
        $USE_SUDO apt-get install -f -y
        $USE_SUDO dpkg -i "$deb_file" || true
    fi
    rm -f "$deb_file"
    if command -v headscale >/dev/null 2>&1; then
        print_success_from_common_functions "Headscale installed"
        return 0
    fi
    print_error_from_common_functions "Headscale installation failed"
    return 1
}

render_headscale_config() {
    local nameservers=""
    local nameserver=""
    local public_ip=""
    local derp_ipv4=""

    for nameserver in $(headscale_dns_nameservers); do
        nameservers="${nameservers}      - ${nameserver}
"
    done
    public_ip="$(get_var PUBLIC_IP "" 2>/dev/null | tr -d '[:space:]')"
    [ -n "$public_ip" ] || public_ip="$(net_detect_public_ip 2>/dev/null || true)"
    [ -n "$public_ip" ] && derp_ipv4="    ipv4: ${public_ip}
"
    cat <<EOF
# managed-by: 98_install_headscale_server.sh
server_url: https://${SERVER_HOST}
listen_addr: 127.0.0.1:${HEADSCALE_LISTEN_PORT}
metrics_listen_addr: 127.0.0.1:${HEADSCALE_METRICS_PORT}
grpc_listen_addr: 127.0.0.1:50443
grpc_allow_insecure: false
noise:
  private_key_path: ${HEADSCALE_DATA_DIR}/noise_private.key
prefixes:
  v4: ${HEADSCALE_IP_V4}
  v6: ${HEADSCALE_IP_V6}
  allocation: sequential
derp:
  server:
    enabled: true
    region_id: ${HEADSCALE_DERP_REGION_ID}
    region_code: "${HEADSCALE_DERP_REGION_CODE}"
    region_name: "Core Embedded DERP"
    stun_listen_addr: "0.0.0.0:${HEADSCALE_STUN_PORT}"
    private_key_path: ${HEADSCALE_DATA_DIR}/derp_server_private.key
    automatically_add_embedded_derp_region: true
${derp_ipv4}  urls:
    - https://controlplane.tailscale.com/derpmap/default
  paths: []
  auto_update_enabled: true
  update_frequency: 3h
disable_check_updates: true
ephemeral_node_inactivity_timeout: 30m
database:
  type: sqlite
  sqlite:
    path: ${HEADSCALE_DATA_DIR}/db.sqlite
    write_ahead_log: true
log:
  level: info
  format: text
policy:
  mode: file
  path: ""
dns:
  magic_dns: true
  base_domain: ${BASE_DOMAIN}
  override_local_dns: true
  nameservers:
    global:
${nameservers}  search_domains: []
  extra_records_path: $(headscale_extra_records_file)
unix_socket: /var/run/headscale/headscale.sock
unix_socket_permission: "0770"
EOF
}

configure_headscale() {
    local extra_file=""

    $USE_SUDO mkdir -p "$HEADSCALE_CONFIG_DIR" "$HEADSCALE_DATA_DIR"
    extra_file="$(headscale_extra_records_file)"
    if [ ! -f "$extra_file" ]; then
        echo "[]" | write_file_if_changed "$extra_file" "" 640 headscale headscale >/dev/null
    fi
    render_headscale_config | write_file_if_changed "$HEADSCALE_CONFIG_FILE" "$HEADSCALE_CONFIG_DIR/backup" 640 headscale headscale
    CONFIG_CHANGED="$WRITE_FILE_CHANGED"
    $USE_SUDO chown -R headscale:headscale "$HEADSCALE_DATA_DIR" 2>/dev/null || true
}

enable_headscale_service() {
    print_step_from_common_functions "Enabling the $HEADSCALE_SERVICE service..."
    $USE_SUDO systemctl enable --now "$HEADSCALE_SERVICE" 2>/dev/null || true
    if [ "$CONFIG_CHANGED" = "true" ]; then
        $USE_SUDO systemctl restart "$HEADSCALE_SERVICE" 2>/dev/null || true
    fi
    sleep 2
    if [ "$(headscale_service_state)" = "active" ]; then
        print_success_from_common_functions "$HEADSCALE_SERVICE is running"
        return 0
    fi
    print_warning_from_common_functions "$HEADSCALE_SERVICE is not active; check: journalctl -u $HEADSCALE_SERVICE"
    return 1
}

ensure_user_and_authkey() {
    local key=""

    headscale_user_ensure
    if [ -n "$(headscale_authkey_read)" ]; then
        print_info_from_common_functions "Secret $(headscale_authkey_secret_name) already present; keeping it"
        return 0
    fi
    key="$(headscale_preauthkey_create)"
    if [ -z "$key" ]; then
        print_warning_from_common_functions "Could not create a pre-auth key (service not ready?); rerun this step"
        return 0
    fi
    headscale_authkey_store "$key"
    key=""
    print_success_from_common_functions "Pre-auth key stored as $(headscale_authkey_secret_name) (not printed; encrypt it with dd.sh and sync it to the nodes)"
}

ensure_frankenphp_site() {
    headscale_server_route_ensure
    if declare -F fm_domain_caddy_apply_converged >/dev/null 2>&1 && [ -f "$FM_DOMAIN_CADDYFILE" ]; then
        fm_domain_caddy_apply_converged
    fi
}

# The local node joins its own server: step 97 ran before the server existed
# and skipped the join, so rerun it (idempotent) once the key is stored.
join_local_node() {
    local tailscale_installer="$SCRIPT_CURRENT_DIR/97_install_tailscale.sh"

    command -v tailscale >/dev/null 2>&1 || return 0
    [ "$(ts_backend_state)" = "Running" ] && return 0
    [ -n "$(headscale_authkey_read)" ] || return 0
    print_step_from_common_functions "Joining this node to its own Headscale server (step 97)..."
    bash "$tailscale_installer" || true
}

open_stun_port() {
    firewall_allow_port "$HEADSCALE_STUN_PORT" udp "Headscale embedded DERP STUN"
}

main() {
    print_header_from_common_functions "Headscale Server Installation Script"
    load_headscale_constants

    if [ "$MESH_PROVIDER" != "headscale" ]; then
        print_info_from_common_functions "SKIP: MESH_VPN_PROVIDER is '$MESH_PROVIDER' (not headscale)"
        mesh_provider_converge --skip-client
        exit 0
    fi
    if [ -z "$SERVER_HOST" ] || [ "$(mesh_is_headscale_server_host)" != "yes" ]; then
        print_info_from_common_functions "SKIP: ${SERVER_HOST:-hs.<region>.<root>} does not resolve to this host's public IP"
        exit 0
    fi

    install_headscale_package || exit 1
    configure_headscale
    enable_headscale_service
    ensure_user_and_authkey
    headscale_extra_records_sync
    ensure_frankenphp_site
    open_stun_port
    join_local_node
    mesh_provider_converge --skip-client

    print_success_from_common_functions "Headscale server ready: https://$SERVER_HOST (MagicDNS base: $BASE_DOMAIN)"
    exit 0
}

main
