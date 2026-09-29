#!/bin/bash

# =============================================================================
# tailscale_menu.sh - "[T] Tailscale" quick entry (dd.sh > Linux Management >
# Linux System Tools > [T] Tailscale).
#
# Thin arrow-menu wrapper around scripts/shells/linux/common/tailscale_common.sh
# (single source of truth for status/devices/all-ips/settings/restart/ui/
# login/logout) and the existing installer
# scripts/shells/linux/debian/install_shells/97_install_tailscale.sh
# (install/repair; not duplicated here). Paths are resolved only from this
# script's own location, matching app_install_menu.sh.
# =============================================================================

SCRIPT_DIR=""
LINUX_DIR=""
COMMON_DIR=""
INSTALL_SHELLS_DIR=""
TAILSCALE_INSTALL_SCRIPT=""
ARROW_MENU_SCRIPT=""
TAILSCALE_COMMON_SCRIPT=""

_resolve_tailscale_menu_paths() {
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    LINUX_DIR="$(dirname "$SCRIPT_DIR")"
    COMMON_DIR="$LINUX_DIR/common"
    INSTALL_SHELLS_DIR="$LINUX_DIR/debian/install_shells"
    TAILSCALE_INSTALL_SCRIPT="$INSTALL_SHELLS_DIR/97_install_tailscale.sh"
    ARROW_MENU_SCRIPT="$COMMON_DIR/arrow_menu.sh"
    TAILSCALE_COMMON_SCRIPT="$COMMON_DIR/tailscale_common.sh"
}

_resolve_tailscale_menu_paths

if [ ! -s "$TAILSCALE_COMMON_SCRIPT" ]; then
    echo "Error: tailscale_common.sh not found at $TAILSCALE_COMMON_SCRIPT"
    read -r -p "Press Enter to go back..."
    exit 1
fi
source "$ARROW_MENU_SCRIPT"
source "$TAILSCALE_COMMON_SCRIPT"

# Install/Repair via the existing idempotent installer (never duplicated
# here); it also handles the interactive "disable" prompt when Tailscale is
# already installed and INSTALL_TAILSCALE=false is set beforehand. Confirmed
# first since re-running it restarts/reconfigures a working installation.
_tailscale_menu_run_installer() {
    printf "\033c"
    echo "=========================================="
    echo "Tailscale: Install / Repair"
    echo "=========================================="
    echo ""
    printf "Run the Tailscale installer now? [y/N]: "
    read -r _ts_confirm
    case "$_ts_confirm" in
        [Yy]*) ;;
        *) echo "Cancelled."; echo ""; echo "Press Enter to continue..."; read -r; return 0 ;;
    esac
    echo ""
    if [ -s "$TAILSCALE_INSTALL_SCRIPT" ]; then
        bash "$TAILSCALE_INSTALL_SCRIPT"
    else
        echo "Error: installer not found at $TAILSCALE_INSTALL_SCRIPT"
    fi
    echo ""
    echo "Press Enter to continue..."
    read -r
}

_tailscale_menu_status() {
    printf "\033c"
    ts_show_status
    echo ""
    echo "Press Enter to continue..."
    read -r
}

_tailscale_menu_all_ips() {
    printf "\033c"
    ts_show_all_ips
    echo ""
    echo "Press Enter to continue..."
    read -r
}

_tailscale_menu_restart() {
    printf "\033c"
    echo "=========================================="
    echo "Tailscale: Restart tailscaled service"
    echo "=========================================="
    ts_restart_service
    echo ""
    echo "Press Enter to continue..."
    read -r
}

_tailscale_menu_open_ui() {
    printf "\033c"
    echo "=========================================="
    echo "Tailscale: Open UI"
    echo "=========================================="
    echo ""
    ts_open_ui
    echo ""
    echo "Press Enter to continue..."
    read -r
}

# Interactive Settings screen: show current values, let the user pick one of
# TAILSCALE_SETTING_NAMES and enter a value, then apply it via
# ts_apply_setting (tailscale_common.sh -- never runs `up --reset` here).
_tailscale_menu_settings() {
    local selected_index=0
    local setting_items=(hostname accept-routes advertise-exit-node exit-node ssh shields-up operator)
    local setting_labels=(
        "hostname (device name shown in the tailnet)"
        "accept-routes (accept subnet routes from other nodes)"
        "advertise-exit-node (offer this device as an exit node)"
        "exit-node (use another device's exit node; empty = stop using one)"
        "ssh (Tailscale SSH server)"
        "shields-up (block incoming connections from other devices)"
        "operator (unix user allowed to run tailscale without sudo)"
    )
    local back_idx=${#setting_items[@]}

    while true; do
        printf "\033c"
        echo "=========================================="
        echo "Tailscale: Settings"
        echo "=========================================="
        echo ""
        ts_show_settings
        echo ""
        local menu_items=("${setting_labels[@]}" "Back")
        arrow_menu_select "Tailscale Settings" menu_items "$selected_index" "$back_idx"
        selected_index=$ARROW_MENU_SELECTED_INDEX
        [ "$selected_index" = "$back_idx" ] && return 0

        local name="${setting_items[$selected_index]}"
        local value=""
        case "$name" in
            accept-routes|advertise-exit-node|ssh|shields-up)
                printf "Enable %s? [y/N]: " "$name"
                read -r _ts_yn
                case "$_ts_yn" in
                    [Yy]*) value="true" ;;
                    *) value="false" ;;
                esac
                ;;
            operator)
                printf "Operator username [%s]: " "${ACTUAL_DESKTOP_USER:-$(id -un)}"
                read -r value
                [ -n "$value" ] || value="${ACTUAL_DESKTOP_USER:-$(id -un)}"
                ;;
            exit-node)
                printf "Exit node IP or name (empty to stop using one): "
                read -r value
                ;;
            hostname)
                printf "New hostname: "
                read -r value
                [ -n "$value" ] || { echo "Hostname cannot be empty."; echo ""; echo "Press Enter to continue..."; read -r; continue; }
                ;;
        esac

        echo ""
        ts_apply_setting "$name" "$value"
        echo ""
        echo "Press Enter to continue..."
        read -r
    done
}

_tailscale_menu_login_logout() {
    printf "\033c"
    echo "=========================================="
    if [ "$(ts_backend_state)" = "Running" ]; then
        echo "Tailscale: Logout"
    else
        echo "Tailscale: Login"
    fi
    echo "=========================================="
    echo ""
    ts_login_logout_toggle
    echo ""
    echo "Press Enter to continue..."
    read -r
}

show_tailscale_management_menu() {
    local selected_index=0
    local login_logout_label="Login / Logout"

    while true; do
        if is_tailscale_installed && [ "$(ts_backend_state)" = "Running" ]; then
            login_logout_label="Logout (tailscale logout)"
        else
            login_logout_label="Login (tailscale up)"
        fi
        local menu_items=(
            "Install / Repair Tailscale"
            "Settings (hostname, accept-routes, exit-node, ssh, shields-up, operator)"
            "Open UI (admin console + local tailscale web UI)"
            "All IPs (this machine + every peer)"
            "Status (install, service, backend state, IPs)"
            "Restart Service (sudo systemctl restart tailscaled)"
            "$login_logout_label"
            "Help (dispatcher usage + official doc links)"
            "Back to Linux System Tools"
        )

        arrow_menu_select "[T] Tailscale [$(ts_quick_menu_label)]" menu_items "$selected_index" 8
        selected_index=$ARROW_MENU_SELECTED_INDEX
        case "$selected_index" in
            0) _tailscale_menu_run_installer ;;
            1) _tailscale_menu_settings ;;
            2) _tailscale_menu_open_ui ;;
            3) _tailscale_menu_all_ips ;;
            4) _tailscale_menu_status ;;
            5) _tailscale_menu_restart ;;
            6) _tailscale_menu_login_logout ;;
            7)
                printf "\033c"
                ts_show_help
                echo ""
                echo "Press Enter to continue..."
                read -r
                ;;
            8) return 0 ;;
        esac
    done
}

show_tailscale_management_menu
