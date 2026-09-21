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
    return
fi
ARROW_MENU_LOADED=true

# Non-interactive probe (shared by both menu renderers). Returns 0 when the
# menu must NOT block on the terminal:
# (1) auto-continue envs (DD_AUTO_CONTINUE/CI/NONINTERACTIVE/DEBIAN_FRONTEND)
# (2) no controlling terminal (cron/ssh -T)
# (3) the process is not in the terminal's FOREGROUND process group -- a
#     background job reading /dev/tty is stopped by SIGTTIN and freezes on
#     the rendered menu (the Debian desktop launcher case); same probe as
#     prompt_common.sh.
arrow_menu_noninteractive() {
    local tpgid=""
    local pgid=""
    if [ "${DD_AUTO_CONTINUE:-}" = "1" ] || [ "${DD_AUTO_CONTINUE:-}" = "true" ] \
        || [ "${NONINTERACTIVE:-}" = "1" ] || [ "${CI:-}" = "true" ] \
        || [ "${DEBIAN_FRONTEND:-}" = "noninteractive" ]; then
        return 0
    fi
    if [ ! -t 0 ] || [ ! -r /dev/tty ]; then
        return 0
    fi
    tpgid="$(ps -o tpgid= -p $$ 2>/dev/null | tr -d ' ')"
    pgid="$(ps -o pgid= -p $$ 2>/dev/null | tr -d ' ')"
    if [ -n "$tpgid" ] && [ -n "$pgid" ] && [ "$tpgid" != "$pgid" ]; then
        return 0
    fi
    return 1
}

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
    local read_rc=0
    local index=0
    local menu_width=0
    local option_length=0

    ARROW_MENU_CANCELLED=false
    if [ "$option_count" -eq 0 ]; then
        ARROW_MENU_SELECTED_INDEX=-1
        return
    fi
    if [ "$selected_index" -lt 0 ] || [ "$selected_index" -ge "$option_count" ]; then
        selected_index=0
    fi
    if arrow_menu_noninteractive; then
        ARROW_MENU_SELECTED_INDEX="$back_index"
        ARROW_MENU_CANCELLED=true
        return
    fi

    old_settings="$(stty -g < /dev/tty 2>/dev/null)"
    if [ -z "$old_settings" ]; then
        ARROW_MENU_SELECTED_INDEX="$back_index"
        ARROW_MENU_CANCELLED=true
        return
    fi
    for index in "${!arrow_menu_options[@]}"; do
        option_length="${#arrow_menu_options[$index]}"
        if [ "$option_length" -gt "$menu_width" ]; then
            menu_width="$option_length"
        fi
    done
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
            for index in "${!arrow_menu_options[@]}"; do
                if [ "$index" -eq "$selected_index" ]; then
                    printf "\033[47m\033[30m> %-${menu_width}s\033[0m" "${arrow_menu_options[$index]}"
                else
                    printf "  %-${menu_width}s" "${arrow_menu_options[$index]}"
                fi
                if [ "$index" -lt "$((option_count - 1))" ]; then
                    printf "\n"
                fi
            done
        } > /dev/tty

        stty -icanon -echo -isig < /dev/tty 2>/dev/null
        char="$(dd bs=1 count=1 < /dev/tty 2>/dev/null)"
        read_rc=$?
        sequence=""
        if [ "$char" = $'\x1B' ]; then
            read -r -t 0.1 -d '' sequence < /dev/tty
        fi
        stty "$old_settings" < /dev/tty 2>/dev/null

        if [ "$read_rc" -ne 0 ]; then
            # tty hangup / read error -> cancel instead of spinning forever
            # re-rendering the menu on a dead terminal (busy-loop freeze).
            if [ "$back_index" -ge 0 ] && [ "$back_index" -lt "$option_count" ]; then
                ARROW_MENU_SELECTED_INDEX="$back_index"
            else
                ARROW_MENU_SELECTED_INDEX=-1
            fi
            ARROW_MENU_CANCELLED=true
            printf "\n" > /dev/tty 2>/dev/null || true
            return
        fi

        case "$char" in
            $'\x1B')
                # Accept both CSI (ESC [ A, normal cursor mode) and SS3
                # (ESC O A, application cursor mode) arrow sequences: newer
                # VTE/Ptyxis terminals on Debian 13 may report application
                # mode, which otherwise makes the arrow keys look dead.
                case "$sequence" in
                    '[A'|'OA') selected_index=$(((selected_index - 1 + option_count) % option_count)) ;;
                    '[B'|'OB') selected_index=$(((selected_index + 1) % option_count)) ;;
                esac
                ;;
            ''|$'\r'|$'\n')
                # '' is the stripped LF; '\r' covers terminals left without
                # icrnl translation (raw-mode predecessors), where Enter
                # otherwise never confirms and the menu looks stuck.
                ARROW_MENU_SELECTED_INDEX="$selected_index"
                printf "\n" > /dev/tty
                return
                ;;
            $'\x03'|q|Q)
                if [ "$back_index" -ge 0 ] && [ "$back_index" -lt "$option_count" ]; then
                    ARROW_MENU_SELECTED_INDEX="$back_index"
                    ARROW_MENU_CANCELLED=true
                    printf "\n" > /dev/tty
                    return
                fi
                ;;
        esac
    done
}

# Numbered-input menu: prints options as "N) label" and reads an option number.
# Shares ARROW_MENU_SELECTED_INDEX / ARROW_MENU_CANCELLED with arrow_menu_select.
# Reads raw bytes from /dev/tty (same stty model as arrow_menu_select), so
# Ctrl+C arrives as a byte and selects back_index when it is valid;
# invalid input re-prompts without re-rendering the menu.
numeric_menu_select() {
    local title="$1"
    local options_name="$2"
    local back_index="${3:--1}"
    local -n numeric_menu_options="$options_name"
    local option_count="${#numeric_menu_options[@]}"
    local old_settings=""
    local char=""
    local input_buffer=""
    local read_rc=0
    local selected_index=-1
    local index=0

    ARROW_MENU_CANCELLED=false
    if [ "$option_count" -eq 0 ]; then
        ARROW_MENU_SELECTED_INDEX=-1
        return
    fi
    if arrow_menu_noninteractive; then
        ARROW_MENU_SELECTED_INDEX="$back_index"
        ARROW_MENU_CANCELLED=true
        return
    fi

    old_settings="$(stty -g < /dev/tty 2>/dev/null)"
    if [ -z "$old_settings" ]; then
        ARROW_MENU_SELECTED_INDEX="$back_index"
        ARROW_MENU_CANCELLED=true
        return
    fi

    echo "=========================================="
    echo "$title"
    echo "=========================================="
    echo "Select an option (enter the option number):"
    for index in "${!numeric_menu_options[@]}"; do
        printf "%2d) %s\n" "$((index + 1))" "${numeric_menu_options[$index]}"
    done
    if [ "$back_index" -ge 0 ] && [ "$back_index" -lt "$option_count" ]; then
        echo "Press Ctrl+C to go back"
    fi

    stty -icanon -echo -isig < /dev/tty 2>/dev/null
    printf "Enter number: "
    while true; do
        char="$(dd bs=1 count=1 < /dev/tty 2>/dev/null)"
        read_rc=$?
        if [ "$read_rc" -ne 0 ]; then
            # tty hangup / read error -> cancel to back target when available
            selected_index="$back_index"
            ARROW_MENU_CANCELLED=true
            break
        fi
        case "$char" in
            $'\x03')
                # Ctrl+C -> go back
                selected_index="$back_index"
                ARROW_MENU_CANCELLED=true
                break
                ;;
            ''|$'\x0d'|$'\x0a')
                # Enter -> submit (empty char means the stripped newline)
                if [ -n "$input_buffer" ] && [[ "$input_buffer" =~ ^[0-9]+$ ]] \
                    && [ "$((10#$input_buffer))" -ge 1 ] && [ "$((10#$input_buffer))" -le "$option_count" ]; then
                    selected_index=$((10#$input_buffer - 1))
                    break
                fi
                printf "\nInvalid selection%s\n" "${input_buffer:+: $input_buffer}"
                input_buffer=""
                printf "Enter number: "
                ;;
            $'\x7f'|$'\x08')
                if [ -n "$input_buffer" ]; then
                    input_buffer="${input_buffer%?}"
                    printf "\b \b"
                fi
                ;;
            [0-9])
                if [ "${#input_buffer}" -lt 3 ]; then
                    input_buffer+="$char"
                    printf "%s" "$char"
                fi
                ;;
            *)
                # ignore other control bytes / escape sequences
                ;;
        esac
    done
    stty "$old_settings" < /dev/tty 2>/dev/null
    printf "\n"
    if [ "$selected_index" -ge 0 ] && [ "$selected_index" -lt "$option_count" ]; then
        ARROW_MENU_SELECTED_INDEX="$selected_index"
    elif [ "$back_index" -ge 0 ] && [ "$back_index" -lt "$option_count" ]; then
        ARROW_MENU_SELECTED_INDEX="$back_index"
    else
        ARROW_MENU_SELECTED_INDEX=-1
    fi
}
