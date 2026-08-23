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

# =============================================================================
# Menu Display Functions for dd.sh
# =============================================================================

initialize_menu_items() {
    menu_items["Linux Management"]="text=Linux Management;values=default;current=0;key=LINUX_MANAGEMENT_MENU;action=show_linux_management_submenu"
    menu_order+=("Linux Management")

    menu_items["Exit"]="text=Exit;values=default;current=0;key=EXIT_TYPE;action=exit_script"
    menu_order+=("Exit")

    load_saved_values
}

show_interactive_menu() {
    local selected_index=0
    local -a main_menu_items=("Linux Management" "Exit")

    # Pause before showing menu with auto-countdown (before changing terminal settings)
    echo ""
    echo -e "\033[33mPress Enter to continue, or any other key to pause (auto-continue in 3 seconds)...\033[0m"
    echo -ne "\033[36mAuto-continuing in \033[0m"

    # Countdown with non-blocking key check
    for i in 3 2 1; do
        echo -ne "\033[36m$i \033[0m"

        # Check if key is available (non-blocking)
        if read -t 1 -n 1 key; then
            echo ""
            if [ "$key" = "" ]; then
                # Enter pressed - continue immediately
                break
            else
                # Any other key pauses
                echo -e "\033[36mPaused. Press Enter to continue...\033[0m"
                read -r
                break
            fi
        fi
    done

    echo ""
    echo ""

    while true; do
        arrow_menu_select "Core Node Management" main_menu_items "$selected_index" 1 show_main_menu_context
        selected_index=$ARROW_MENU_SELECTED_INDEX
        case "$selected_index" in
            0) handle_menu_action "show_linux_management_submenu" "default" "LINUX_MANAGEMENT_MENU" ;;
            1) exit_script ;;
        esac
    done
}

show_main_menu_context() {
    local current_system

    current_system=$(get_global_var "CURRENT_SYSTEM" "$SYSTEM_VERSION")
    printf "Current system: %s\n" "$current_system"
}
