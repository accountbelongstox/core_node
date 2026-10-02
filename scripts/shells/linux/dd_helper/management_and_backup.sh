#!/bin/bash

# Management & Backup is a child of Linux Management; numbered menus (numeric_menu_select).

DESKTOP_ICON_REFRESH_SCRIPT="$CORE_NODE_ROOT_DIR/scripts/shells/linux/refresh_desktop_icons.sh"
REMOTE_CONTROL_COMMON_SCRIPT_FOR_MB="$CORE_NODE_ROOT_DIR/scripts/shells/linux/common/remote_control_common.sh"

management_and_backup_header() {
    echo "Management & Backup ($(hostname))"
}

management_and_backup_pause() {
    echo ""
    echo "Press Enter to continue..."
    read -r
}

# Organize Desktop Icons (Windows: Management & Backup > Apps & environment > Organize desktop icons).
show_desktop_icon_organizer_menu() {
    local menu_items=(
        "Organize"
        "Preview (no changes)"
        "Undo last organize"
        "Back"
    )
    local actions=("organize" "preview" "undo")

    while true; do
        numeric_menu_select "Management & Backup > Organize Desktop Icons" menu_items 3 management_and_backup_header
        if [ "$ARROW_MENU_SELECTED_INDEX" -lt 0 ] || [ "$ARROW_MENU_SELECTED_INDEX" -ge "${#actions[@]}" ]; then
            return 0
        fi
        bash "$DESKTOP_ICON_REFRESH_SCRIPT" "${actions[$ARROW_MENU_SELECTED_INDEX]}"
        management_and_backup_pause
    done
}

show_management_and_backup() {
    local menu_items=()

    while true; do
        menu_items=(
            "-- Remote control (Windows <-> this machine) --"
            "One-click: allow remote control of this machine (shared desktop + SSH)"
            "Remote control (connect to Windows via VNC, status, help)  >"
            "Tailscale [$(ts_quick_menu_label 2>/dev/null || echo unknown)]  >"
            "-- Desktop --"
            "Organize desktop icons  >"
            "-- Backup --"
            "Backup management  >"
            "Back to Linux System Tools"
        )
        numeric_menu_select "Management & Backup" menu_items 8 management_and_backup_header
        case "$ARROW_MENU_SELECTED_INDEX" in
            1)
                printf "\033c"
                bash "$REMOTE_CONTROL_COMMON_SCRIPT_FOR_MB" host
                management_and_backup_pause
                ;;
            2) bash "$REMOTE_CONTROL_COMMON_SCRIPT_FOR_MB" menu ;;
            3) show_tailscale_management_menu ;;
            5) show_desktop_icon_organizer_menu ;;
            7)
                if declare -F show_backup_management >/dev/null 2>&1; then
                    show_backup_management
                else
                    echo "Backup Management is unavailable (show_backup_management not loaded)."
                    sleep 1
                fi
                ;;
            *) return 0 ;;
        esac
    done
}
