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
    echo "Up/Down: Navigate | Left/Right: Toggle script | Enter: Launch | Space: Select | Q: Quit"
    echo ""
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