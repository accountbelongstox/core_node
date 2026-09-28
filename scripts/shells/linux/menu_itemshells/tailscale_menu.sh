#!/bin/bash

# =============================================================================
# tailscale_menu.sh - Tailscale Management menu item (dd.sh > Linux Management
# > Linux System Tools > Tailscale Management).
#
# Thin arrow-menu wrapper around scripts/shells/linux/common/tailscale_common.sh
# (single source of truth for status/devices/restart/panel) and the existing
# installer scripts/shells/linux/debian/install_shells/97_install_tailscale.sh
# (install/uninstall; not duplicated here). Paths are resolved only from this
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

# Install/reconfigure via the existing idempotent installer (never duplicated
# here); it also handles the interactive "disable" prompt when Tailscale is
# already installed and INSTALL_TAILSCALE=false is set beforehand.
_tailscale_menu_run_installer() {
    printf "\033c"
    echo "=========================================="
    echo "Tailscale: Install / Reconfigure"
    echo "=========================================="
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

_tailscale_menu_devices() {
    printf "\033c"
    ts_show_devices
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

_tailscale_menu_panel() {
    printf "\033c"
    ts_show_panel
    echo ""
    echo "Press Enter to continue..."
    read -r
}

show_tailscale_management_menu() {
    local selected_index=0
    local menu_items=(
        "Status (install, service, backend state, IPs)"
        "List Devices (every tailnet device)"
        "Restart Service (sudo systemctl restart tailscaled)"
        "Open Panel (admin console + local device web UI)"
        "Install / Reconfigure Tailscale"
        "Help (dispatcher usage + official doc links)"
        "Back to Linux System Tools"
    )

    while true; do
        arrow_menu_select "Tailscale Management" menu_items "$selected_index" 6
        selected_index=$ARROW_MENU_SELECTED_INDEX
        case "$selected_index" in
            0) _tailscale_menu_status ;;
            1) _tailscale_menu_devices ;;
            2) _tailscale_menu_restart ;;
            3) _tailscale_menu_panel ;;
            4) _tailscale_menu_run_installer ;;
            5)
                printf "\033c"
                ts_show_help
                echo ""
                echo "Press Enter to continue..."
                read -r
                ;;
            6) return 0 ;;
        esac
    done
}

show_tailscale_management_menu
