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

# UI Module
# Provides user interface functions for unified manager

# Show menu
show_menu() {
    clear
    echo -e "\033[36m=== dd.sh Unified App Manager >16 ===\033[0m"
    echo -e "\033[90mCurrent directory: $ROOT_DIR\033[0m"
    echo ""

    if [ ${#APPS_NAME[@]} -eq 0 ]; then
        echo -e "\033[31mNo applications found\033[0m"
        return
    fi

    # Calculate column widths
    local name_width=$((MAX_APP_NAME_WIDTH > 8 ? MAX_APP_NAME_WIDTH : 8))

    echo -e "\033[33mApplication List:\033[0m"

    # Header
    printf "No. | %-${name_width}s | %-11s | %-14s | Sel\n" "App Name" "Type" "Current Script"
    printf -- "----|-%${name_width}s-|-------------|----------------|-\n" "$(printf '%*s' $name_width | tr ' ' '-')"

    # App list
    for i in "${!APPS_NAME[@]}"; do
        local indicator=" "
        local color="\033[37m"  # White

        if [ $i -eq $CURRENT_INDEX ]; then
            indicator=">"
            color="\033[33m"  # Yellow
        fi

        printf "${color}%s%2d | %-${name_width}s | %-11s | %-14s | %s\033[0m\n" \
            "$indicator" \
            $((i + 1)) \
            "${APPS_NAME[$i]}" \
            "${APPS_TYPE[$i]}" \
            "${APPS_CURRENT_SCRIPT[$i]}" \
            "${APPS_IS_SELECTED[$i]}"
    done

    echo ""
    echo -e "\033[33mControls:\033[0m"
    echo "Enter app number to select | L: Launch current | C: Create service | T: Toggle script | S: Select/Unselect | R: Rescan | Q: Quit"
    echo ""
    echo -ne "\033[36mEnter app number (1-${#APPS_NAME[@]}) or command: \033[0m"
}

# Navigation and control functions
navigate_up() {
    if [ $CURRENT_INDEX -gt 0 ]; then
        ((CURRENT_INDEX--))
    fi
}

navigate_down() {
    if [ $CURRENT_INDEX -lt $((${#APPS_NAME[@]} - 1)) ]; then
        ((CURRENT_INDEX++))
    fi
}

toggle_script() {
    local scripts_str="${APPS_AVAILABLE_SCRIPTS[$CURRENT_INDEX]}"

    if [ -z "$scripts_str" ] || [ "$scripts_str" = "None" ]; then
        echo -e "\033[33mNo alternative scripts available for ${APPS_NAME[$CURRENT_INDEX]}\033[0m"
        return
    fi

    IFS=',' read -ra scripts <<< "$scripts_str"

    if [ ${#scripts[@]} -gt 1 ]; then
        local current_index=${APPS_SCRIPT_INDEX[$CURRENT_INDEX]}
        ((current_index++))
        [ $current_index -ge ${#scripts[@]} ] && current_index=0

        APPS_SCRIPT_INDEX[$CURRENT_INDEX]=$current_index
        APPS_CURRENT_SCRIPT[$CURRENT_INDEX]="${scripts[$current_index]}"

        echo -e "\033[32mSwitched to ${APPS_CURRENT_SCRIPT[$CURRENT_INDEX]} for ${APPS_NAME[$CURRENT_INDEX]}\033[0m"
        save_cache
    else
        echo -e "\033[33mNo alternative scripts available for ${APPS_NAME[$CURRENT_INDEX]}\033[0m"
    fi
}

toggle_selection() {
    if [ "${APPS_IS_SELECTED[$CURRENT_INDEX]}" = "Y" ]; then
        APPS_IS_SELECTED[$CURRENT_INDEX]="N"
        echo -e "\033[32m${APPS_NAME[$CURRENT_INDEX]} deselected\033[0m"
    else
        APPS_IS_SELECTED[$CURRENT_INDEX]="Y"
        echo -e "\033[32m${APPS_NAME[$CURRENT_INDEX]} selected\033[0m"
    fi
    save_cache
}

# Show app action menu for current app
show_script_menu() {
    local app_index=$1
    local app_name="${APPS_NAME[$app_index]}"
    local app_path="${APPS_PATH[$app_index]}"
    local app_type="${APPS_TYPE[$app_index]}"
    local current_script="${APPS_CURRENT_SCRIPT[$app_index]}"
    local scripts_str="${APPS_AVAILABLE_SCRIPTS[$app_index]}"

    if [ -z "$scripts_str" ] || [ "$scripts_str" = "None" ]; then
        echo -e "\033[31mNo startup methods available for $app_name\033[0m"
        echo -e "\033[33mPress any key to continue...\033[0m"
        read -n 1
        return 1
    fi

    IFS=',' read -ra scripts <<< "$scripts_str"

    clear
    echo -e "\033[36m=== Application Launch Configuration ===\033[0m"
    echo -e "\033[33mSelected App: \033[37m$app_name\033[0m"
    echo -e "\033[33mType: \033[37m$app_type\033[0m"
    echo -e "\033[33mPath: \033[90m$app_path\033[0m"
    echo ""

    # Show current startup method
    echo -e "\033[36m=== Current Startup Method ===\033[0m"
    echo -e "\033[32m�?$current_script\033[0m"

    # Show alternative methods if available
    if [ ${#scripts[@]} -gt 1 ]; then
        echo ""
        echo -e "\033[36m=== Alternative Startup Methods ===\033[0m"
        local current_script_index=${APPS_SCRIPT_INDEX[$app_index]}

        for i in "${!scripts[@]}"; do
            if [ $i -ne $current_script_index ]; then
                echo -e "\033[90m  $((i + 1)). ${scripts[$i]}\033[0m"
            fi
        done
        echo ""
        echo -e "\033[33mTip: Enter number 1-${#scripts[@]} to switch startup method\033[0m"
    fi

    echo ""
    echo -e "\033[36m=== Available Actions ===\033[0m"
    echo -e "\033[32m1. \033[37mLaunch Application (Development Mode)\033[0m"
    echo -e "\033[32m2. \033[37mInstall as System Service\033[0m"
    echo -e "\033[32m3. \033[37mInstall as System Service + Domain Proxy\033[0m"
    if [ ${#scripts[@]} -gt 1 ]; then
        echo -e "\033[32m4. \033[37mChange Startup Method\033[0m"
        echo -e "\033[32m5. \033[37mBack to Main Menu\033[0m"
    else
        echo -e "\033[32m4. \033[37mBack to Main Menu\033[0m"
    fi
    echo ""

    if [ ${#scripts[@]} -gt 1 ]; then
        echo -ne "\033[36mSelect action (1-5): \033[0m"
    else
        echo -ne "\033[36mSelect action (1-4): \033[0m"
    fi

    while true; do
        read action_input

        case "$action_input" in
            "1")
                echo -e "\033[32mLaunching $app_name in development mode...\033[0m"
                return 2  # Signal to launch
                ;;
            "2")
                echo -e "\033[32mInstalling $app_name as system service...\033[0m"
                return 3  # Signal to create service
                ;;
            "3")
                echo -e "\033[32mInstalling $app_name as system service with domain proxy...\033[0m"
                return 4  # Signal to create service with proxy
                ;;
            "4")
                if [ ${#scripts[@]} -gt 1 ]; then
                    # Show startup method selection
                    echo ""
                    echo -e "\033[36m=== Select Startup Method ===\033[0m"
                    local current_script_index=${APPS_SCRIPT_INDEX[$app_index]}

                    for i in "${!scripts[@]}"; do
                        local indicator=" "
                        local color="\033[37m"  # White

                        if [ $i -eq $current_script_index ]; then
                            indicator="*"
                            color="\033[33m"  # Yellow (current selection)
                        fi

                        printf "${color}%s%2d. %s\033[0m\n" "$indicator" $((i + 1)) "${scripts[$i]}"
                    done
                    echo ""
                    echo -ne "\033[36mSelect startup method (1-${#scripts[@]}): \033[0m"

                    read method_input
                    if [[ "$method_input" =~ ^[0-9]+$ ]]; then
                        local method_index=$((method_input - 1))
                        if [ $method_index -ge 0 ] && [ $method_index -lt ${#scripts[@]} ]; then
                            APPS_SCRIPT_INDEX[$app_index]=$method_index
                            APPS_CURRENT_SCRIPT[$app_index]="${scripts[$method_index]}"
                            save_cache
                            echo -e "\033[32m�?Switched to: ${scripts[$method_index]}\033[0m"
                            sleep 1
                            # Refresh the menu
                            show_script_menu "$app_index"
                            return $?
                        fi
                    fi
                    echo -e "\033[31mInvalid selection\033[0m"
                    echo -ne "\033[36mSelect action (1-5): \033[0m"
                else
                    echo -e "\033[33mReturning to main menu...\033[0m"
                    return 0  # Back to main menu
                fi
                ;;
            "5")
                if [ ${#scripts[@]} -gt 1 ]; then
                    echo -e "\033[33mReturning to main menu...\033[0m"
                    return 0  # Back to main menu
                else
                    echo -e "\033[31mInvalid option\033[0m"
                    echo -ne "\033[36mSelect action (1-4): \033[0m"
                fi
                ;;
            *)
                echo -e "\033[31mInvalid option\033[0m"
                if [ ${#scripts[@]} -gt 1 ]; then
                    echo -ne "\033[36mSelect action (1-5): \033[0m"
                else
                    echo -ne "\033[36mSelect action (1-4): \033[0m"
                fi
                ;;
        esac
    done
}