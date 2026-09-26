#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Management & Backup is a child of Linux Management and dispatches backup tools.

show_management_and_backup() {
    local selected_index=0
    local menu_items=(
        "Backup Management"
        "Back to Linux System Tools"
    )

    while true; do
        arrow_menu_select "Management & Backup" menu_items "$selected_index" 1
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
                return 0
                ;;
        esac
    done
}
