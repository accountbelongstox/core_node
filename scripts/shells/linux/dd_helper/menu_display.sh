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
    menu_items["Install and Test Environment"]="text=Install and Test Environment;values=default;current=0;key=INSTALL_TEST_MENU;action=show_install_test_menu"
    menu_order+=("Install and Test Environment")


    menu_items["Git Management"]="text=Git Management;values=default;current=0;key=GIT_MANAGEMENT_MENU;action=show_git_management_menu"
    menu_order+=("Git Management")

    menu_items["System Information & Variables"]="text=System Information & Variables;values=default;current=0;key=SYSTEM_INFO_MENU;action=show_system_info_menu"
    menu_order+=("System Information & Variables")

    menu_items["Unified App Manager"]="text=Unified App Manager;values=default;current=0;key=UNIFIED_MANAGER_TYPE;action=unified_manager"
    menu_order+=("Unified App Manager")

    menu_items["Set Special Software Environment Variables (like AI)"]="text=Set Special Software Environment Variables (like AI);values=default;current=0;key=SPECIAL_ENV_MENU;action=show_special_software_env_menu"
    menu_order+=("Set Special Software Environment Variables (like AI)")

    menu_items["Service Manager"]="text=Service Manager (Redis/PostgreSQL/Docker/MySQL/Nginx/SSH);values=default;current=0;key=SERVICE_MANAGER_MENU;action=show_service_manager"
    menu_order+=("Service Manager")

    menu_items["Linux Management"]="text=Linux Management;values=default;current=0;key=LINUX_MANAGEMENT_MENU;action=show_linux_management_submenu"
    menu_order+=("Linux Management")

    menu_items["Push to git"]="text=Push to git;values=all,gitee,github,local;current=0;key=GIT_PUSH_TARGET;action=push_git"
    menu_order+=("Push to git")

    menu_items["Exit"]="text=Exit;values=default;current=0;key=EXIT_TYPE;action=exit_script"
    menu_order+=("Exit")

    load_saved_values
}

show_interactive_menu() {
    local selected=0
    local total=${#menu_order[@]}
    local old_settings=$(stty -g)

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

    stty -icanon -echo
    trap 'stty "$old_settings"; exit' EXIT

    while true; do
        printf "\033c"
        local current_sys=$(get_global_var "CURRENT_SYSTEM" "$SYSTEM_VERSION")
        printf "Current system: %s\n" "$current_sys"
        printf "Select an option (Up/Down to move, Left/Right to change value, Enter to select):\n"
        printf "Press Ctrl+C to exit\n\n"

        for i in "${!menu_order[@]}"; do
            local key="${menu_order[$i]}"
            local item="${menu_items[$key]}"
            local text=$(echo "$item" | grep -o 'text=[^;]*' | cut -d= -f2)
            local values=($(echo "$item" | grep -o 'values=[^;]*' | cut -d= -f2 | tr ',' ' '))
            local current=$(echo "$item" | grep -o 'current=[0-9]*' | cut -d= -f2)
            
            local value_display=""
            if [ ${#values[@]} -gt 1 ] || [ "${values[$current]}" != "default" ]; then
                value_display=" [${values[$current]}]"
            fi
            
            if [ "$i" -eq "$selected" ]; then
                printf "\033[47m\033[30m>%-40s%s\033[0m\n" " $text" "$value_display"
            else
                printf " %-40s%s\n" " $text" "$value_display"
            fi
        done

        local char
        char=$(dd bs=1 count=1 2>/dev/null)

        case "$char" in
            $'\x1B')
                read -r -t 0.1 -d '' seq
                case "$seq" in
                    '[A')
                        ((selected--))
                        [ "$selected" -lt 0 ] && selected=$((total - 1))
                        ;;
                    '[B')
                        ((selected++))
                        [ "$selected" -ge "$total" ] && selected=0
                        ;;
                    '[C'|'[D')
                        local key="${menu_order[$selected]}"
                        local item="${menu_items[$key]}"
                        local values=($(echo "$item" | grep -o 'values=[^;]*' | cut -d= -f2 | tr ',' ' '))
                        local current=$(echo "$item" | grep -o 'current=[0-9]*' | cut -d= -f2)
                        local total_values=${#values[@]}
                        local var_key=$(echo "$item" | grep -o 'key=[^;]*' | cut -d= -f2)
                        local action=$(echo "$item" | grep -o 'action=[^;]*' | cut -d= -f2)
                        
                        if [ "$seq" = '[C' ]; then
                            ((current++))
                            [ "$current" -ge "$total_values" ] && current=0
                        else
                            ((current--))
                            [ "$current" -lt 0 ] && current=$((total_values - 1))
                        fi
                        
                        menu_items[$key]=$(echo "$item" | sed "s/current=[0-9]*/current=$current/")
                        set_global_var "$var_key" "${values[$current]}"
                        
                        case "$action" in
                            "set_region")
                                echo "Region changed to: ${values[$current]}"
                                ;;
                            "set_cloud_provider")
                                echo "Cloud Provider changed to: ${values[$current]}"
                                ;;
                        esac
                        ;;
                esac
                ;;
            '')
                local key="${menu_order[$selected]}"
                local item="${menu_items[$key]}"
                local values=($(echo "$item" | grep -o 'values=[^;]*' | cut -d= -f2 | tr ',' ' '))
                local current=$(echo "$item" | grep -o 'current=[0-9]*' | cut -d= -f2)
                local action=$(echo "$item" | grep -o 'action=[^;]*' | cut -d= -f2)
                local var_key=$(echo "$item" | grep -o 'key=[^;]*' | cut -d= -f2)

                stty "$old_settings"
                printf "\033c"

                handle_menu_action "$action" "${values[$current]}" "$var_key"

                echo
                echo "Press 'q' to quit, any other key to continue..."
                read -n 1 key
                if [ "$key" = "q" ]; then
                    exit 0
                fi

                stty -icanon -echo
                ;;
        esac
    done
}
