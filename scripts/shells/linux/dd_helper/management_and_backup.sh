#!/bin/bash

# Management & Backup is a child of Linux Management and dispatches backup tools.

DESKTOP_ICON_REFRESH_SCRIPT="$CORE_NODE_ROOT_DIR/scripts/shells/linux/refresh_desktop_icons.sh"

# Organize Desktop Icons [organize/preview/undo] (Windows: Management & Backup > Organize Desktop Icons).
show_desktop_icon_organizer_menu() {
    local selected_index=0
    local menu_items=(
        "Organize"
        "Preview"
        "Undo"
        "Back to Management & Backup"
    )
    local actions=("organize" "preview" "undo")

    while true; do
        arrow_menu_select "Organize Desktop Icons" menu_items "$selected_index" 3
        selected_index="$ARROW_MENU_SELECTED_INDEX"
        if [ "$selected_index" -lt 0 ] || [ "$selected_index" -ge "${#actions[@]}" ]; then
            return 0
        fi
        bash "$DESKTOP_ICON_REFRESH_SCRIPT" "${actions[$selected_index]}"
        echo ""
        echo "Press Enter to continue..."
        read -r
    done
}

show_management_and_backup() {
    local selected_index=0
    local menu_items=(
        "Backup Management"
        "Organize Desktop Icons (organize / preview / undo)"
        "Back to Linux System Tools"
    )

    while true; do
        arrow_menu_select "Management & Backup" menu_items "$selected_index" 2
        selected_index="$ARROW_MENU_SELECTED_INDEX"
        case "$selected_index" in
            0)
                if declare -F show_backup_management >/dev/null 2>&1; then
                    show_backup_management
                else
                    echo "Backup Management is unavailable (show_backup_management not loaded)."
                    sleep 1
                fi
                ;;
            1)
                show_desktop_icon_organizer_menu
                ;;
            2)
                return 0
                ;;
        esac
    done
}
