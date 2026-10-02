#!/bin/bash

# =============================================================================
# mesh_common.sh - mesh VPN provider resolver (Headscale default / Tailscale).
#
# Single source of truth for which control plane the Tailscale client talks
# to. Every value comes from config/service_contract.json (access.mesh) and the
# shared gvars MESH_VPN_PROVIDER / DOMAIN_API_REGION_PREFIX; no host is static.
# Design: docs_fix/DESIGN_SHELL_HOSTS.md section 6.5.
#
# Public API (all print to stdout, no exit-code contracts):
#   mesh_vpn_provider               - headscale|tailscale|none
#   mesh_region_prefix              - DOMAIN_API_REGION_PREFIX or the contract default
#   mesh_root_domain                - access.root_domains[headscale.root_domain_index]
#   mesh_headscale_server_host      - hs.<region>.<root> (the control server FQDN)
#   mesh_login_server_url           - https://<server host>; empty for tailscale
#   mesh_base_domain                - MagicDNS base (mesh.<root>) for headscale, else the tailscale tailnet suffix
#   mesh_dns_suffix                 - MagicDNS suffix of the active provider
#   mesh_cert_source                - tailscale_cert|dns01_dnspod
#   mesh_is_headscale_server_host   - yes|no: server host resolves to this host's public IP
#   mesh_control_url_desired/actual - control URL the provider wants / `tailscale debug prefs` ControlURL
#   mesh_control_url_needs_switch   - yes|no: node is logged into a different control server
#   mesh_provider_converge          - idempotent switch pass (see below); [--skip-client] for step 97/98
# =============================================================================

if [ "${MESH_COMMON_LOADED:-false}" = "true" ]; then
    return 0 2>/dev/null || exit 0
fi
MESH_COMMON_LOADED="true"

MESH_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$MESH_COMMON_DIR/service_contract_common.sh"
# shellcheck source=/dev/null
source "$MESH_COMMON_DIR/network_detect_common.sh"
# shellcheck source=/dev/null
source "$MESH_COMMON_DIR/file_ops_common.sh"

MESH_PROVIDER_KEY="MESH_VPN_PROVIDER"
MESH_REGION_PREFIX_KEY="DOMAIN_API_REGION_PREFIX"

# Read one shared gvar: get_var when the store is loaded, else the bare
# shared-key file (MESH_VPN_PROVIDER / DOMAIN_API_REGION_PREFIX stay unprefixed).
mesh_gvar_read() {
    local key="$1"
    local value=""
    local gvar_dir=""

    if declare -F get_var >/dev/null 2>&1; then
        value="$(get_var "$key" "" 2>/dev/null)"
    else
        gvar_dir="${CORE_NODE_DATA_DIR:-/www/core_node}/$(sc_get paths.global_var_dir_name)"
        if [ -f "$gvar_dir/$key" ]; then
            value="$(cat "$gvar_dir/$key" 2>/dev/null)"
        fi
    fi
    printf '%s' "$value" | tr -d '\0\r\n ' | tr '[:upper:]' '[:lower:]'
}

mesh_vpn_provider() {
    local provider=""
    local default_provider=""
    local legacy_flag=""

    default_provider="$(sc_get access.mesh.provider_default)"
    [ -n "$default_provider" ] || default_provider="headscale"
    provider="$(mesh_gvar_read "$MESH_PROVIDER_KEY")"
    case " $(sc_list access.mesh.providers) " in
        *" $provider "*) ;;
        *) provider="" ;;
    esac
    if [ -z "$provider" ]; then
        legacy_flag="$(mesh_gvar_read INSTALL_TAILSCALE)"
        if [ "$legacy_flag" = "false" ]; then
            provider="none"
        else
            provider="$default_provider"
        fi
    fi
    printf '%s' "$provider"
}

mesh_region_prefix() {
    local prefix=""

    prefix="$(mesh_gvar_read "$MESH_REGION_PREFIX_KEY")"
    if [[ ! "$prefix" =~ ^[a-z0-9][a-z0-9-]{0,30}$ ]]; then
        prefix="$(sc_get access.default_api_region_prefix)"
    fi
    printf '%s' "$prefix"
}

mesh_root_domain() {
    local index=""
    local domains=""
    local -a domain_list=()

    index="$(sc_get access.mesh.headscale.root_domain_index)"
    [[ "$index" =~ ^[0-9]+$ ]] || index=0
    domains="$(sc_list access.root_domains)"
    read -r -a domain_list <<< "$domains"
    printf '%s' "${domain_list[$index]:-}"
}

# Join contract labels ("hs {region}") plus the root domain into one FQDN.
mesh_labels_fqdn() {
    local labels_key="$1"
    local label=""
    local fqdn=""
    local region=""
    local root=""

    region="$(mesh_region_prefix)"
    root="$(mesh_root_domain)"
    [ -n "$root" ] || return 0
    for label in $(sc_list "$labels_key"); do
        label="${label//\{region\}/$region}"
        fqdn="${fqdn}${label}."
    done
    printf '%s%s' "$fqdn" "$root"
}

mesh_headscale_server_host() {
    mesh_labels_fqdn access.mesh.headscale.server_labels
}

mesh_login_server_url() {
    local provider=""
    local host=""

    provider="$(mesh_vpn_provider)"
    if [ "$provider" = "headscale" ]; then
        host="$(mesh_headscale_server_host)"
        [ -n "$host" ] && printf 'https://%s' "$host"
        return 0
    fi
    sc_get access.mesh.tailscale.login_server
}

mesh_base_domain() {
    if [ "$(mesh_vpn_provider)" = "headscale" ]; then
        mesh_labels_fqdn access.mesh.headscale.base_domain_labels
        return 0
    fi
    sc_get access.mesh.tailscale.dns_suffix
}

mesh_dns_suffix() {
    mesh_base_domain
}

mesh_cert_source() {
    local provider=""
    local source_name=""

    provider="$(mesh_vpn_provider)"
    [ "$provider" = "none" ] && provider="tailscale"
    source_name="$(sc_get "access.mesh.${provider}.cert_source")"
    [ -n "$source_name" ] || source_name="tailscale_cert"
    printf '%s' "$source_name"
}

# yes when this host is the public server and hs.<region>.<root> resolves to
# its public IP; no otherwise. Cheap-first, so a LAN host never runs the
# port-80 probe:
#   1. HAS_PUBLIC_IP=yes (persisted by 9_fix_dns.sh --detect-public-ip):
#      compare the resolved IPs with PUBLIC_IP, no probe.
#   2. otherwise compare them with net_detect_public_ip (side-effect free) and
#      the local non-private interface IPs; only a match (candidate server)
#      runs 9_fix_dns.sh --detect-public-ip to confirm, then re-reads the gvars.
mesh_is_headscale_server_host() {
    local host=""
    local has_public_ip=""
    local public_ip=""
    local resolved=""
    local local_ips=""
    local probe_script="$MESH_COMMON_DIR/../debian/install_shells/9_fix_dns.sh"
    local ip=""
    local candidate="no"

    host="$(mesh_headscale_server_host)"
    if [ -z "$host" ]; then
        printf 'no'
        return 0
    fi
    if ! declare -F get_var >/dev/null 2>&1; then
        # shellcheck source=/dev/null
        source "$MESH_COMMON_DIR/gvar_common.sh"
    fi
    resolved="$(getent ahostsv4 "$host" 2>/dev/null | awk '{print $1}' | sort -u)"
    if [ -z "$resolved" ]; then
        printf 'no'
        return 0
    fi
    has_public_ip="$(get_var HAS_PUBLIC_IP "" 2>/dev/null)"
    public_ip="$(get_var PUBLIC_IP "" 2>/dev/null | tr -d '[:space:]')"
    if [ "$has_public_ip" = "yes" ] && [ -n "$public_ip" ]; then
        for ip in $resolved; do
            if [ "$ip" = "$public_ip" ]; then
                printf 'yes'
                return 0
            fi
        done
        printf 'no'
        return 0
    fi
    public_ip="$(net_detect_public_ip 2>/dev/null || true)"
    local_ips="$(net_detect_local_ipv4s 2>/dev/null)"
    for ip in $resolved; do
        if [ -n "$public_ip" ] && [ "$ip" = "$public_ip" ]; then
            candidate="yes"
        elif printf '%s\n' "$local_ips" | grep -qx "$ip" && ! net_ip_is_private "$ip"; then
            candidate="yes"
        fi
    done
    if [ "$candidate" != "yes" ]; then
        printf 'no'
        return 0
    fi
    if [ -f "$probe_script" ]; then
        bash "$probe_script" --detect-public-ip >/dev/null 2>&1 || true
    fi
    if [ "$(get_var HAS_PUBLIC_IP "" 2>/dev/null)" = "yes" ]; then
        printf 'yes'
        return 0
    fi
    printf 'no'
}

MESH_TAILSCALE_CONTROL_URL="https://controlplane.tailscale.com"
MESH_APPLIED_PROVIDER_KEY="MESH_VPN_APPLIED_PROVIDER"
MESH_CONVERGE_FAILURES=0
MESH_CONVERGE_ROUTES_CHANGED="no"
MESH_CONVERGE_DESIRED_UNREACHABLE="no"

mesh_control_url_desired() {
    local url=""
    url="$(mesh_login_server_url)"
    printf '%s' "${url:-$MESH_TAILSCALE_CONTROL_URL}"
}

# Live ControlURL of this node; empty when the client or its prefs are unavailable.
mesh_control_url_actual() {
    local url=""
    command -v tailscale >/dev/null 2>&1 || return 0
    url="$($(lazy_sudo) tailscale debug prefs 2>/dev/null | sed -n 's/.*"ControlURL": *"\([^"]*\)".*/\1/p' | head -n1)"
    printf '%s' "${url%/}"
}

mesh_control_url_needs_switch() {
    local actual=""
    actual="$(mesh_control_url_actual)"
    if [ -n "$actual" ] && [ "$actual" != "$(mesh_control_url_desired)" ]; then
        printf 'yes'
        return 0
    fi
    printf 'no'
}

# yes when the desired control server answers: Headscale /health, or the
# Tailscale control plane (any HTTP answer).
mesh_control_server_reachable() {
    local url=""
    local provider=""

    provider="$(mesh_vpn_provider)"
    if [ "$provider" = "headscale" ]; then
        url="$(mesh_login_server_url)"
        # Body check: the wildcard *.<region>.<root> answers any /health with an
        # empty 200, only a real Headscale returns {"status":"pass"}.
        if [ -n "$url" ] && curl -fsS --max-time 5 "$url/health" 2>/dev/null | grep -q '"pass"'; then
            printf 'yes'
            return 0
        fi
    elif curl -sS --max-time 5 -o /dev/null "$MESH_TAILSCALE_CONTROL_URL" 2>/dev/null; then
        printf 'yes'
        return 0
    fi
    printf 'no'
}

mesh_converge_log() {
    echo "[mesh] $*"
}

mesh_converge_load_deps() {
    if ! declare -F headscale_server_route_render >/dev/null 2>&1; then
        # shellcheck source=/dev/null
        source "$MESH_COMMON_DIR/headscale_common.sh"
    fi
    if ! declare -F ts_backend_state >/dev/null 2>&1; then
        # shellcheck source=/dev/null
        source "$MESH_COMMON_DIR/tailscale_common.sh"
    fi
}

mesh_converge_load_fm() {
    if ! declare -F fm_domain_ensure_routes_dir >/dev/null 2>&1; then
        # shellcheck source=/dev/null
        source "$MESH_COMMON_DIR/frankenphp_domain_common.sh"
    fi
}

# Remove one managed Caddy route file (marker-checked); marks routes changed.
mesh_converge_route_remove() {
    local route_file="$1"
    local marker="$2"
    if [ -f "$route_file" ] && grep -q "$marker" "$route_file" 2>/dev/null; then
        $(lazy_sudo) rm -f "$route_file"
        MESH_CONVERGE_ROUTES_CHANGED="yes"
        mesh_converge_log "disabled route: $route_file"
    fi
}

# Step 1: provider none -> client down, tailscaled stopped + disabled.
mesh_converge_client_none() {
    local sudo_cmd=""
    local unit="${TAILSCALE_SERVICE:-tailscaled}"

    sudo_cmd="$(lazy_sudo)"
    command -v tailscale >/dev/null 2>&1 || return 0
    if [ "$(ts_backend_state)" = "Running" ]; then
        $sudo_cmd tailscale down 2>/dev/null || true
        mesh_converge_log "tailscale down"
    fi
    if [ "$(systemctl is-active "$unit" 2>/dev/null)" = "active" ]; then
        $sudo_cmd systemctl stop "$unit" 2>/dev/null || true
    fi
    if [ "$(systemctl is-enabled "$unit" 2>/dev/null)" = "enabled" ]; then
        $sudo_cmd systemctl disable "$unit" 2>/dev/null || true
        mesh_converge_log "$unit stopped and disabled"
    fi
}

# Step 2: node must be Running on the desired control server; otherwise run
# step 97 (logout on mismatch, up --login-server, --reset fallback).
mesh_converge_client_join() {
    local installer="$MESH_COMMON_DIR/../debian/install_shells/97_install_tailscale.sh"

    command -v tailscale >/dev/null 2>&1 || return 0
    if [ "$(mesh_control_url_needs_switch)" = "no" ] && [ "$(ts_backend_state)" = "Running" ]; then
        return 0
    fi
    if [ "$(mesh_control_url_needs_switch)" = "yes" ] && [ "$(mesh_control_server_reachable)" != "yes" ]; then
        MESH_CONVERGE_DESIRED_UNREACHABLE="yes"
        MESH_CONVERGE_FAILURES=$((MESH_CONVERGE_FAILURES + 1))
        mesh_converge_log "[WARN] desired control server unreachable; staying on $(mesh_control_url_actual)"
        return 0
    fi
    mesh_converge_log "switching the client to $(mesh_control_url_desired)"
    bash "$installer" || true
    if [ "$(mesh_control_url_needs_switch)" = "yes" ] || [ "$(ts_backend_state)" != "Running" ]; then
        MESH_CONVERGE_FAILURES=$((MESH_CONVERGE_FAILURES + 1))
        mesh_converge_log "client not Running on $(mesh_control_url_desired) yet (state: $(ts_backend_state))"
    fi
}

# Step 3: Headscale server host. Never deletes config, DB, keys or certificates.
mesh_converge_server() {
    local provider="$1"
    local service=""
    local sudo_cmd=""
    local host=""
    local route_file=""
    local installer="$MESH_COMMON_DIR/../debian/install_shells/98_install_headscale_server.sh"

    service="$(headscale_service_name)"
    sudo_cmd="$(lazy_sudo)"
    host="$(mesh_headscale_server_host)"
    if [ "$provider" != "headscale" ] && [ -z "$(systemctl list-unit-files "${service}.service" --no-legend 2>/dev/null)" ]; then
        return 0
    fi
    mesh_converge_load_fm
    route_file="${FM_DOMAIN_ROUTES_DIR}/${host}.caddy"
    if [ "$provider" != "headscale" ]; then
        if [ "$(systemctl is-active "$service" 2>/dev/null)" = "active" ]; then
            $sudo_cmd systemctl stop "$service" 2>/dev/null || true
            mesh_converge_log "$service stopped"
        fi
        if [ "$(systemctl is-enabled "$service" 2>/dev/null)" = "enabled" ]; then
            $sudo_cmd systemctl disable "$service" 2>/dev/null || true
            mesh_converge_log "$service disabled"
        fi
        [ -n "$host" ] && mesh_converge_route_remove "$route_file" "$HEADSCALE_ROUTE_MARKER"
        return 0
    fi
    if [ "$(mesh_is_headscale_server_host)" != "yes" ]; then
        return 0
    fi
    if [ "$(systemctl is-active "$service" 2>/dev/null)" != "active" ] || [ ! -f "$route_file" ]; then
        bash "$installer" || true
        [ "$(systemctl is-active "$service" 2>/dev/null)" = "active" ] || MESH_CONVERGE_FAILURES=$((MESH_CONVERGE_FAILURES + 1))
    fi
}

# Step 4: tailnet HTTPS site for the active suffix only; one Caddy reload.
mesh_converge_tailnet_site() {
    local provider="$1"
    local route_file=""
    local before=""
    local after=""

    if declare -F web_server_plane >/dev/null 2>&1 && [ "$(web_server_plane)" != "frankenphp" ]; then
        return 0
    fi
    mesh_converge_load_fm
    [ -d "$FM_DOMAIN_LARAVEL_DIR" ] || return 0
    route_file="${FM_DOMAIN_ROUTES_DIR}/local_lan.caddy"
    before="$(cat "$route_file" 2>/dev/null)"
    DOMAIN_TS_DNSNAME=""
    if [ "$provider" = "none" ] || [ "$(mesh_control_url_needs_switch)" = "yes" ] || [ "$(ts_backend_state)" != "Running" ]; then
        [ "$(command -v tailscale)" ] || return 0
        mesh_converge_route_remove "$route_file" "lan=local_lan"
    else
        fm_domain_tailnet_site_ensure
        after="$(cat "$route_file" 2>/dev/null)"
        [ "$before" != "$after" ] && MESH_CONVERGE_ROUTES_CHANGED="yes"
    fi
    if [ "$MESH_CONVERGE_ROUTES_CHANGED" = "yes" ]; then
        if [ -f "$FM_DOMAIN_CADDYFILE" ]; then
            fm_domain_caddy_apply_converged
        fi
        web_access_config_ensure
        if [ "$WEB_ACCESS_CONFIG_CHANGED" = "true" ] && declare -F domain_setup_restart_ui_service >/dev/null 2>&1; then
            domain_setup_restart_ui_service
        fi
    fi
}

mesh_provider_converge_run() {
    local skip_client="$1"
    local provider=""

    provider="$(mesh_vpn_provider)"
    MESH_CONVERGE_FAILURES=0
    MESH_CONVERGE_ROUTES_CHANGED="no"
    MESH_CONVERGE_DESIRED_UNREACHABLE="no"
    mesh_converge_load_deps
    mesh_converge_log "converging provider: $provider"
    # Order: server first (a server host must be up before its own node
    # switches), then the client (never logs out unless the desired server
    # is reachable), then the tailnet site (untouched while unreachable).
    mesh_converge_server "$provider"
    if [ "$skip_client" != "yes" ]; then
        if [ "$provider" = "none" ]; then
            mesh_converge_client_none
        else
            mesh_converge_client_join
        fi
    fi
    if [ "$provider" != "none" ] && [ "$(mesh_control_url_needs_switch)" = "yes" ] && [ "$(mesh_control_server_reachable)" != "yes" ]; then
        MESH_CONVERGE_DESIRED_UNREACHABLE="yes"
        [ "$skip_client" = "yes" ] && MESH_CONVERGE_FAILURES=$((MESH_CONVERGE_FAILURES + 1))
        [ "$skip_client" = "yes" ] && mesh_converge_log "[WARN] desired control server unreachable; staying on $(mesh_control_url_actual)"
    fi
    if [ "$MESH_CONVERGE_DESIRED_UNREACHABLE" != "yes" ]; then
        mesh_converge_tailnet_site "$provider"
    fi
    if [ "$MESH_CONVERGE_FAILURES" -eq 0 ] && declare -F set_global_var >/dev/null 2>&1; then
        set_global_var "$MESH_APPLIED_PROVIDER_KEY" "$provider" 'false'
    fi
}

# Idempotent switch pass: every step checks live state first. The guard stops
# the nested call from steps 97/98 (which this pass may run itself).
mesh_provider_converge() {
    local skip_client="no"

    [ "${1:-}" = "--skip-client" ] && skip_client="yes"
    [ "${MESH_CONVERGE_RUNNING:-no}" = "yes" ] && return 0
    MESH_CONVERGE_RUNNING="yes"
    export MESH_CONVERGE_RUNNING
    mesh_provider_converge_run "$skip_client"
    unset MESH_CONVERGE_RUNNING
}

# Interactive provider switch for the Tailscale/Headscale menus: pick, confirm,
# set_mesh_vpn_provider (selection + INSTALL_TAILSCALE together), converge.
mesh_switch_provider_interactive() {
    local current=""
    local -a providers=()
    local -a labels=()
    local choice=""
    local answer=""
    local index=0
    local back_idx=0

    if ! declare -F set_mesh_vpn_provider >/dev/null 2>&1; then
        # shellcheck source=/dev/null
        source "$MESH_COMMON_DIR/gvar_common.sh"
    fi
    current="$(mesh_vpn_provider)"
    read -r -a providers <<< "$(sc_list access.mesh.providers)"
    for choice in "${providers[@]}"; do
        if [ "$choice" = "$current" ]; then
            labels+=("$choice (current)")
        else
            labels+=("$choice")
        fi
    done
    back_idx=${#labels[@]}
    labels+=("Cancel")
    arrow_menu_select "Switch mesh VPN provider" labels 0 "$back_idx"
    index=$ARROW_MENU_SELECTED_INDEX
    if [ "$index" = "$back_idx" ]; then
        echo "Cancelled."
        return 0
    fi
    choice="${providers[$index]}"
    if [ "$choice" = "$current" ]; then
        echo "Provider unchanged ($current); converging to verify live state..."
    else
        printf "Switch provider %s -> %s (logout/login, services and sites are converged)? [y/N]: " "$current" "$choice"
        read -r answer
        case "$answer" in
            [Yy]*) ;;
            *) echo "Cancelled."; return 0 ;;
        esac
        set_mesh_vpn_provider "$choice"
    fi
    mesh_provider_converge
}
