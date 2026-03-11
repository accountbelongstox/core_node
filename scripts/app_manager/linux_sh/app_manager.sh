#!/bin/bash
# Unified App Manager - Linux SH (multi-file, no Python)
# Entry point for dd.sh on Linux. Scans apps, shows menu, launches selected app.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
export ROOT_DIR

# Source config and modules
source "$SCRIPT_DIR/config/app_config.sh"
source "$SCRIPT_DIR/core/app_scanner.sh"
source "$SCRIPT_DIR/core/command_generator.sh"

# State
CURRENT_INDEX=0
MAX_NAME_WIDTH=8

# Colors
C_HEADER="\033[36m"
C_SUCCESS="\033[32m"
C_WARNING="\033[33m"
C_ERROR="\033[31m"
C_INFO="\033[90m"
C_RESET="\033[0m"

print_header()  { echo -e "${C_HEADER}=== $1 ===${C_RESET}"; }
print_ok()      { echo -e "[OK] $1"; }
print_warn()    { echo -e "${C_WARNING}[!!] $1${C_RESET}"; }
print_err()     { echo -e "${C_ERROR}[X] $1${C_RESET}"; }
print_info()    { echo -e "${C_INFO}$1${C_RESET}"; }

do_scan() {
    print_header "Starting Application Scan"
    scan_applications "$ROOT_DIR"
    fill_commands "$ROOT_DIR"
    MAX_NAME_WIDTH=8
    local i
    for (( i=0; i < APP_COUNT; i++ )); do
        local len=${#APP_NAMES[$i]}
        (( len > MAX_NAME_WIDTH )) && MAX_NAME_WIDTH=$len
    done
    print_ok "Scan complete - found $APP_COUNT applications"
    return 0
}

show_menu() {
    clear
    print_header "Unified App Manager (Linux SH)"
    print_info "Platform: Linux | Root: $ROOT_DIR"
    echo ""

    if (( APP_COUNT == 0 )); then
        print_warn "No applications found."
        print_info "Scanned: apps/, pyapps/, poly_apps/ under the root above."
        print_info "Use R to rescan, Q to quit."
        echo ""
        echo -ne "${C_HEADER}Enter command (R / Q): ${C_RESET}"
        return
    fi

    local name_width=$MAX_NAME_WIDTH
    (( name_width < 8 )) && name_width=8
    print_warn "Application List:"
    printf "No. | %-${name_width}s | %-11s | %-14s | Port  | Debug\n" "App Name" "Type" "Framework"
    echo "----|$(printf '%*s' $((name_width+2)) '' | tr ' ' '-')|-------------|----------------|-------|------"

    local i
    for (( i=0; i < APP_COUNT; i++ )); do
        local ind=" "
        local line_color="$C_RESET"
        (( i == CURRENT_INDEX )) && ind=">" && line_color="$C_WARNING"
        printf "${line_color}%s%2d | %-${name_width}s | %-11s | %-14s | %-5s | %s${C_RESET}\n" \
            "$ind" $((i+1)) "${APP_NAMES[$i]}" "${APP_TYPES[$i]}" "${APP_FRAMEWORKS[$i]}" "${APP_PORTS[$i]}" "${APP_DEBUGS[$i]}"
    done
    echo ""
    print_warn "Controls:"
    echo "Enter app number to select | L: Launch | R: Rescan | Q: Quit"
    echo ""
    echo -ne "${C_HEADER}Enter app number (1-$APP_COUNT) or command: ${C_RESET}"
}

launch_current() {
    (( APP_COUNT == 0 )) && print_err "No applications available" && return 1
    local cmd="${APP_COMMANDS[$CURRENT_INDEX]}"
    local name="${APP_NAMES[$CURRENT_INDEX]}"
    [[ -z "$cmd" ]] && print_err "No command for $name" && return 1
    print_header "Launching $name"
    print_info "Command: $cmd"
    print_info "Port: ${APP_PORTS[$CURRENT_INDEX]} | Debug: ${APP_DEBUGS[$CURRENT_INDEX]}"
    echo ""
    local wd="${APP_PATHS[$CURRENT_INDEX]}"
    ( cd "$wd" && eval "$cmd" )
    return $?
}

main_loop() {
    do_scan || { print_err "Initial application scan failed"; exit 1; }
    while true; do
        show_menu
        read -r input
        input_upper="${input^^}"
        if [[ "$input" =~ ^[0-9]+$ ]]; then
            num=$((10#$input))
            idx=$((num - 1))
            if (( idx >= 0 && idx < APP_COUNT )); then
                CURRENT_INDEX=$idx
                print_ok "Selected app #$num: ${APP_NAMES[$idx]}"
                sleep 1
            else
                print_err "Invalid app number: $num"
                sleep 1
            fi
        elif [[ "$input_upper" == "L" ]]; then
            launch_current
            echo ""
            print_warn "Press Enter to return to menu..."
            read -r
        elif [[ "$input_upper" == "R" ]]; then
            do_scan
            sleep 1
        elif [[ "$input_upper" == "Q" || "$input_upper" == "QUIT" || "$input_upper" == "EXIT" ]]; then
            print_warn "Exiting"
            exit 0
        elif [[ -z "$input" || -z "${input// }" ]]; then
            launch_current
            echo ""
            print_warn "Press Enter to return to menu..."
            read -r
        else
            print_err "Unknown command: $input"
            print_info "Valid: L (launch), R (rescan), Q (quit) or app number 1-$APP_COUNT"
            sleep 2
        fi
    done
}

main_loop
