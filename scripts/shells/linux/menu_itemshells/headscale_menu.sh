#!/bin/bash

# =============================================================================
# headscale_menu.sh - Headscale server admin menu (nodes, users, pre-auth keys,
# routes, service). Opened from the "[T]" mesh VPN menu (tailscale_menu.sh) when
# MESH_VPN_PROVIDER=headscale. Wraps common/headscale_common.sh (single source
# of truth) and the installer 98_install_headscale_server.sh; paths resolve from
# this script's own location.
# =============================================================================

SCRIPT_DIR=""
LINUX_DIR=""
COMMON_DIR=""
HEADSCALE_INSTALL_SCRIPT=""
ARROW_MENU_SCRIPT=""
HEADSCALE_COMMON_SCRIPT=""

_resolve_headscale_menu_paths() {
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    LINUX_DIR="$(dirname "$SCRIPT_DIR")"
    COMMON_DIR="$LINUX_DIR/common"
    HEADSCALE_INSTALL_SCRIPT="$LINUX_DIR/debian/install_shells/98_install_headscale_server.sh"
    ARROW_MENU_SCRIPT="$COMMON_DIR/arrow_menu.sh"
    HEADSCALE_COMMON_SCRIPT="$COMMON_DIR/headscale_common.sh"
}

_resolve_headscale_menu_paths

if [ ! -s "$HEADSCALE_COMMON_SCRIPT" ]; then
    echo "Error: headscale_common.sh not found at $HEADSCALE_COMMON_SCRIPT"
    read -r -p "Press Enter to go back..."
    exit 1
fi
source "$ARROW_MENU_SCRIPT"
source "$HEADSCALE_COMMON_SCRIPT"

_headscale_menu_pause() {
    echo ""
    echo "Press Enter to continue..."
    read -r
}

_headscale_menu_require_server() {
    if headscale_server_installed; then
        return 0
    fi
    echo "Headscale server is not installed on this host."
    echo "It installs only where $(mesh_headscale_server_host) resolves to this host (step 98)."
    return 1
}

_headscale_menu_show() {
    local title="$1"
    shift
    printf "\033c"
    echo "=========================================="
    echo "Headscale: $title"
    echo "=========================================="
    echo ""
    if _headscale_menu_require_server; then
        "$@"
    fi
    _headscale_menu_pause
}

_headscale_menu_install() {
    printf "\033c"
    echo "=========================================="
    echo "Headscale: Install / Repair server"
    echo "=========================================="
    echo ""
    printf "Run the Headscale server installer now? [y/N]: "
    read -r _hs_confirm
    case "$_hs_confirm" in
        [Yy]*) bash "$HEADSCALE_INSTALL_SCRIPT" ;;
        *) echo "Cancelled." ;;
    esac
    _headscale_menu_pause
}

_headscale_menu_create_key() {
    local key=""

    _headscale_menu_require_server || return 0
    headscale_user_ensure
    key="$(headscale_preauthkey_create)"
    if [ -z "$key" ]; then
        echo "Could not create a pre-auth key."
        return 0
    fi
    headscale_authkey_store "$key"
    echo "New reusable pre-auth key stored as $(headscale_authkey_secret_name): $(headscale_authkey_masked "$key")"
    echo "The value is not printed. Encrypt it with dd.sh and sync it to the nodes."
    key=""
}

_headscale_menu_approve_routes() {
    local node_id=""
    local routes=""

    _headscale_menu_require_server || return 0
    headscale_routes_list
    echo ""
    printf "Node ID to approve routes for (empty to cancel): "
    read -r node_id
    [ -n "$node_id" ] || { echo "Cancelled."; return 0; }
    printf "Routes, comma separated (e.g. 192.168.1.0/24): "
    read -r routes
    [ -n "$routes" ] || { echo "Cancelled."; return 0; }
    headscale_routes_approve "$node_id" "$routes"
}

_headscale_menu_logs() {
    local sudo_cmd=""
    sudo_cmd="$(lazy_sudo)"
    $sudo_cmd journalctl -u "$(headscale_service_name)" -n 50 --no-pager
}

_headscale_menu_status() {
    echo "Server URL:      $(mesh_login_server_url)"
    echo "MagicDNS domain: $(mesh_domain)"
    echo "Server host:     $(mesh_is_headscale_server_host)"
    echo "Installed:       $(headscale_server_installed && echo yes || echo no)"
    echo "Service state:   $(headscale_service_state)"
    echo "Pre-auth secret: $(headscale_authkey_masked "$(headscale_authkey_read)")"
}

_headscale_menu_restart() {
    _headscale_menu_require_server || return 0
    headscale_service_restart
}

_headscale_menu_sync_records() {
    _headscale_menu_require_server || return 0
    headscale_extra_records_sync
    echo "API DNS records synced: $(headscale_extra_records_file)"
}

_headscale_menu_header() {
    echo "Headscale ($(hostname))"
}

show_headscale_management_menu() {
    local selected_index=0
    local menu_items=(
        "Status (server URL, service, secret)"
        "Nodes (list)"
        "Users (list)"
        "Create reusable pre-auth key (stored as secret)"
        "Routes (list + approve)"
        "Sync api.<machine> DNS records"
        "Restart service"
        "Logs (last 50 lines)"
        "Install / Repair server (step 98)"
        "Switch provider (headscale / tailscale / none)"
        "Back"
    )

    while true; do
        numeric_menu_select "Headscale [$(headscale_service_state)]" menu_items 10 _headscale_menu_header
        selected_index=$ARROW_MENU_SELECTED_INDEX
        case "$selected_index" in
            0) _headscale_menu_show "Status" _headscale_menu_status ;;
            1) _headscale_menu_show "Nodes" headscale_nodes_list ;;
            2) _headscale_menu_show "Users" headscale_users_list ;;
            3) _headscale_menu_show "Create pre-auth key" _headscale_menu_create_key ;;
            4) _headscale_menu_show "Routes" _headscale_menu_approve_routes ;;
            5) _headscale_menu_show "Sync DNS records" _headscale_menu_sync_records ;;
            6) _headscale_menu_show "Restart service" _headscale_menu_restart ;;
            7) _headscale_menu_show "Logs" _headscale_menu_logs ;;
            8) _headscale_menu_install ;;
            9)
                printf "\033c"
                mesh_switch_provider_interactive
                _headscale_menu_pause
                ;;
            10) return 0 ;;
        esac
    done
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    show_headscale_management_menu
fi
