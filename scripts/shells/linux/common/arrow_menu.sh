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

ARROW_MENU_LOADED="${ARROW_MENU_LOADED:-false}"
ARROW_MENU_SELECTED_INDEX=0
ARROW_MENU_CANCELLED=false

if [ "$ARROW_MENU_LOADED" = "true" ]; then
    return 0
fi
ARROW_MENU_LOADED=true

arrow_menu_select() {
    local title="$1"
    local options_name="$2"
    local initial_index="${3:-0}"
    local back_index="${4:--1}"
    local render_callback="${5:-}"
    local -n arrow_menu_options="$options_name"
    local option_count="${#arrow_menu_options[@]}"
    local selected_index="$initial_index"
    local old_settings=""
    local char=""
    local sequence=""
    local index=0

    ARROW_MENU_CANCELLED=false
    if [ "$option_count" -eq 0 ]; then
        ARROW_MENU_SELECTED_INDEX=-1
        return 1
    fi
    if [ "$selected_index" -lt 0 ] || [ "$selected_index" -ge "$option_count" ]; then
        selected_index=0
    fi
    if [ ! -t 0 ] || [ ! -r /dev/tty ]; then
        ARROW_MENU_SELECTED_INDEX="$back_index"
        ARROW_MENU_CANCELLED=true
        return 1
    fi

    old_settings="$(stty -g < /dev/tty 2>/dev/null)"
    if [ -z "$old_settings" ]; then
        ARROW_MENU_SELECTED_INDEX="$back_index"
        ARROW_MENU_CANCELLED=true
        return 1
    fi
    while true; do
        {
            printf "\033c"
            echo "=========================================="
            echo "$title"
            echo "=========================================="
            if [ -n "$render_callback" ] && declare -F "$render_callback" >/dev/null 2>&1; then
                "$render_callback"
                echo ""
            fi
            echo "Select an option (Up/Down to move, Enter to select):"
            if [ "$back_index" -ge 0 ]; then
                echo "Press Ctrl+C to go back"
            fi
            echo ""

            for index in "${!arrow_menu_options[@]}"; do
                if [ "$index" -eq "$selected_index" ]; then
                    printf "\033[47m\033[30m> %-68s\033[0m\n" "${arrow_menu_options[$index]}"
                else
                    printf "  %-68s\n" "${arrow_menu_options[$index]}"
                fi
            done
        } > /dev/tty

        stty -icanon -echo -isig < /dev/tty 2>/dev/null
        char="$(dd bs=1 count=1 < /dev/tty 2>/dev/null)"
        sequence=""
        if [ "$char" = $'\x1B' ]; then
            read -r -t 0.1 -d '' sequence < /dev/tty
        fi
        stty "$old_settings" < /dev/tty 2>/dev/null

        case "$char" in
            $'\x1B')
                case "$sequence" in
                    '[A') selected_index=$(((selected_index - 1 + option_count) % option_count)) ;;
                    '[B') selected_index=$(((selected_index + 1) % option_count)) ;;
                esac
                ;;
            '')
                ARROW_MENU_SELECTED_INDEX="$selected_index"
                return 0
                ;;
            $'\x03'|q|Q)
                if [ "$back_index" -ge 0 ] && [ "$back_index" -lt "$option_count" ]; then
                    ARROW_MENU_SELECTED_INDEX="$back_index"
                    ARROW_MENU_CANCELLED=true
                    return 0
                fi
                ;;
        esac
    done
}
