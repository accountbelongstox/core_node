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

# Show script selection menu for current app
show_script_menu() {
    local app_index=$1
    local scripts_str="${APPS_AVAILABLE_SCRIPTS[$app_index]}"

    if [ -z "$scripts_str" ] || [ "$scripts_str" = "None" ]; then
        echo -e "\033[33mNo scripts available for ${APPS_NAME[$app_index]}\033[0m"
        echo -e "\033[33mPress any key to continue...\033[0m"
        read -n 1
        return 1
    fi

    IFS=',' read -ra scripts <<< "$scripts_str"

    # Always show menu, even for single script
    clear
    echo -e "\033[36m=== Script Selection Menu ===\033[0m"
    echo -e "\033[33mApp: ${APPS_NAME[$app_index]}\033[0m"
    echo -e "\033[33mPath: ${APPS_PATH[$app_index]}\033[0m"
    echo ""
    echo -e "\033[33mAvailable Scripts:\033[0m"

    local current_script_index=${APPS_SCRIPT_INDEX[$app_index]}

    for i in "${!scripts[@]}"; do
        local indicator=" "
        local color="\033[37m"  # White

        if [ $i -eq $current_script_index ]; then
            indicator=">"
            color="\033[33m"  # Yellow (current selection)
        fi

        printf "${color}%s%2d | %s\033[0m\n" "$indicator" $((i + 1)) "${scripts[$i]}"
    done

    echo ""
    if [ ${#scripts[@]} -eq 1 ]; then
        echo -e "\033[33mNote: Only one script available\033[0m"
    fi
    echo -e "\033[33mControls:\033[0m"
    echo "Enter script number to select | L: Launch with current script | B: Back to main menu"
    echo ""
    echo -ne "\033[36mEnter script number (1-${#scripts[@]}) or command: \033[0m"

    while true; do
        read script_input

        # Convert to uppercase for command comparison
        script_input_upper=$(echo "$script_input" | tr '[:lower:]' '[:upper:]')

        if [[ "$script_input" =~ ^[0-9]+$ ]]; then
            local script_num=$script_input
            local script_index=$((script_num - 1))

            if [ $script_index -ge 0 ] && [ $script_index -lt ${#scripts[@]} ]; then
                APPS_SCRIPT_INDEX[$app_index]=$script_index
                APPS_CURRENT_SCRIPT[$app_index]="${scripts[$script_index]}"
                save_cache
                echo -e "\033[32mSelected script #$script_num: ${scripts[$script_index]}\033[0m"
                sleep 1
                return 0
            else
                echo -e "\033[31mInvalid script number: $script_num\033[0m"
                echo -ne "\033[36mEnter script number (1-${#scripts[@]}) or command: \033[0m"
            fi
        elif [ "$script_input_upper" = "L" ]; then
            return 2  # Signal to launch
        elif [ "$script_input_upper" = "B" ] || [ "$script_input_upper" = "BACK" ]; then
            return 0  # Back to main menu
        elif [ -z "$script_input" ]; then
            return 2  # Empty input, launch current script
        else
            echo -e "\033[31mUnknown command: $script_input\033[0m"
            echo -e "\033[33mValid commands: L (launch), B (back), or script number (1-${#scripts[@]})\033[0m"
            echo -ne "\033[36mEnter script number (1-${#scripts[@]}) or command: \033[0m"
        fi
    done
}