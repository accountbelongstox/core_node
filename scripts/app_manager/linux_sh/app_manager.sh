#!/bin/bash
# Unified App Manager - Linux SH (multi-file, no Python)
# Entry point for dd.sh on Linux. Scans apps, shows menu, launches selected app.
# App types: ncoreApp (./apps), pycoreApp (./pyapps), polyApp (./poly_apps).
# UI: Up/Down to select, Enter to launch; last selection persisted to .app_manager_last_index.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
STATE_FILE="$ROOT_DIR/.app_manager_last_index"
DEBIAN_SERVICE_MANAGER="$ROOT_DIR/scripts/shells/linux/common/debian_service_manager.sh"

# Source config and modules
source "$SCRIPT_DIR/config/app_config.sh"
source "$SCRIPT_DIR/core/app_scanner.sh"
source "$SCRIPT_DIR/core/command_generator.sh"

# State
CURRENT_INDEX=0
MAX_NAME_WIDTH=8
# Active per row: "start" or "安装到服务" (toggle with Left/Right on selected row)
declare -a APP_ACTIVES=()

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
    APP_ACTIVES=()
    local i
    for (( i=0; i < APP_COUNT; i++ )); do
        local len=${#APP_NAMES[$i]}
        (( len > MAX_NAME_WIDTH )) && MAX_NAME_WIDTH=$len
        APP_ACTIVES+=("start")
    done
    # Restore last selected index (clamp to valid range)
    load_last_index
    print_ok "Scan complete - found $APP_COUNT applications"
    return 0
}

load_last_index() {
    [[ -f "$STATE_FILE" ]] || return 0
    local idx
    read -r idx < "$STATE_FILE" 2>/dev/null || return 0
    [[ "$idx" =~ ^[0-9]+$ ]] || return 0
    CURRENT_INDEX=$idx
    if (( APP_COUNT > 0 && CURRENT_INDEX >= APP_COUNT )); then
        CURRENT_INDEX=$((APP_COUNT - 1))
    fi
    if (( CURRENT_INDEX < 0 )); then
        CURRENT_INDEX=0
    fi
}

save_last_index() {
    (( APP_COUNT > 0 )) || return 0
    echo "$CURRENT_INDEX" > "$STATE_FILE" 2>/dev/null || true
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
        echo -ne "${C_HEADER}Press key (R / Q): ${C_RESET}"
        return
    fi

    local name_width=$MAX_NAME_WIDTH
    (( name_width < 8 )) && name_width=8
    print_warn "Application List:"
    printf "No. | %-${name_width}s | %-11s | %-14s | %-6s | %-5s | Debug\n" "App Name" "Type" "Framework" "Active" "Port"
    echo "----|$(printf '%*s' $((name_width+2)) '' | tr ' ' '-')|-------------|----------------|--------|-------|------"

    local i
    for (( i=0; i < APP_COUNT; i++ )); do
        local ind=" "
        local line_color="$C_RESET"
        (( i == CURRENT_INDEX )) && ind=">" && line_color="$C_WARNING"
        local active="${APP_ACTIVES[$i]:-start}"
        printf "${line_color}%s%2d | %-${name_width}s | %-11s | %-14s | %-6s | %-5s | %s${C_RESET}\n" \
            "$ind" $((i+1)) "${APP_NAMES[$i]}" "${APP_TYPES[$i]}" "${APP_FRAMEWORKS[$i]}" "$active" "${APP_PORTS[$i]}" "${APP_DEBUGS[$i]}"
    done
    echo ""
    print_warn "Controls:"
    echo "Up/Down: select app | Left/Right: toggle Active (start / 安装到服务) | Enter: Launch or Install | R: Rescan | Q: Quit"
    echo ""
    echo -ne "${C_HEADER}Press key: ${C_RESET}"
}

launch_current() {
    (( APP_COUNT == 0 )) && print_err "No applications available" && return 1
    local name="${APP_NAMES[$CURRENT_INDEX]}"
    local type="${APP_TYPES[$CURRENT_INDEX]}"
    local port="${APP_PORTS[$CURRENT_INDEX]}"

    # Strict launch rules: ncoreApp = node from root; pycoreApp = python from root; polyApp = start.sh with Port
    case "$type" in
        ncoreApp)
            if [[ ! -f "$ROOT_DIR/main.js" ]]; then
                print_err "ncoreApp requires root/main.js. Missing: $ROOT_DIR/main.js"
                return 1
            fi
            print_header "Launching $name"
            print_info "Command: node ./main.js app=$name (cwd: $ROOT_DIR)"
            ( cd "$ROOT_DIR" && node ./main.js app="$name" )
            return $?
            ;;
        pycoreApp)
            local py_main="$ROOT_DIR/pyapps/$name/main.py"
            if [[ ! -f "$py_main" ]]; then
                print_err "pycoreApp requires pyapps/$name/main.py. Missing: $py_main"
                return 1
            fi
            print_header "Launching $name"
            print_info "Command: python3 ./pyapps/$name/main.py (cwd: $ROOT_DIR)"
            ( cd "$ROOT_DIR" && python3 "./pyapps/$name/main.py" )
            return $?
            ;;
        polyApp)
            local start_sh="$ROOT_DIR/poly_apps/$name/scripts/start.sh"
            if [[ ! -f "$start_sh" ]]; then
                print_err "polyApp requires poly_apps/$name/scripts/start.sh. Missing: $start_sh"
                return 1
            fi
            print_header "Launching $name"
            print_info "Command: $start_sh $port (cwd: poly_apps/$name)"
            ( cd "$ROOT_DIR/poly_apps/$name" && bash "./scripts/start.sh" "$port" )
            return $?
            ;;
        *)
            print_err "Unknown app type: $type"
            return 1
            ;;
    esac
}

install_service_current() {
    (( APP_COUNT == 0 )) && print_err "No applications available" && return 1
    if [[ ! -f "$DEBIAN_SERVICE_MANAGER" ]]; then
        print_err "Service manager not found: $DEBIAN_SERVICE_MANAGER"
        return 1
    fi
    source "$DEBIAN_SERVICE_MANAGER" 2>/dev/null || { print_err "Failed to source debian_service_manager.sh"; return 1; }

    local name="${APP_NAMES[$CURRENT_INDEX]}"
    local type="${APP_TYPES[$CURRENT_INDEX]}"
    local port="${APP_PORTS[$CURRENT_INDEX]}"
    local service_name="app-manager-$name"
    local description="App Manager: $name ($type)"

    case "$type" in
        ncoreApp)
            if [[ ! -f "$ROOT_DIR/main.js" ]]; then
                print_err "ncoreApp requires root/main.js. Missing: $ROOT_DIR/main.js"
                return 1
            fi
            if ! create_systemd_service "$service_name" "$description" "node ./main.js app=$name" "$ROOT_DIR" "root" "always" "5" "50%" "1G"; then
                print_warn "If permission denied, run this script with sudo to install the service."
            fi
            ;;
        pycoreApp)
            local py_main="$ROOT_DIR/pyapps/$name/main.py"
            if [[ ! -f "$py_main" ]]; then
                print_err "pycoreApp requires pyapps/$name/main.py. Missing: $py_main"
                return 1
            fi
            if ! create_systemd_service "$service_name" "$description" "python3 ./pyapps/$name/main.py" "$ROOT_DIR" "root" "always" "5" "50%" "1G"; then
                print_warn "If permission denied, run this script with sudo to install the service."
            fi
            ;;
        polyApp)
            local start_sh="$ROOT_DIR/poly_apps/$name/scripts/start.sh"
            if [[ ! -f "$start_sh" ]]; then
                print_err "polyApp requires poly_apps/$name/scripts/start.sh. Missing: $start_sh"
                return 1
            fi
            # start.sh accepts Port as argument: ./scripts/start.sh Port
            local work_dir="$ROOT_DIR/poly_apps/$name"
            if ! create_systemd_service "$service_name" "$description" "bash ./scripts/start.sh $port" "$work_dir" "root" "always" "5" "50%" "1G"; then
                print_warn "If permission denied, run this script with sudo to install the service."
            fi
            ;;
        *)
            print_err "Unknown app type: $type"
            return 1
            ;;
    esac
}

main_loop() {
    do_scan || { print_err "Initial application scan failed"; exit 1; }
    while true; do
        show_menu
        local key seq
        read -rsn1 key
        if [[ "$key" == $'\e' ]]; then
            read -rsn2 seq
            key="$seq"
        fi
        case "$key" in
            [A) # Up
                if (( APP_COUNT > 0 )); then
                    (( CURRENT_INDEX > 0 )) && (( CURRENT_INDEX-- ))
                    save_last_index
                fi
                ;;
            [B) # Down
                if (( APP_COUNT > 0 )); then
                    (( CURRENT_INDEX < APP_COUNT - 1 )) && (( CURRENT_INDEX++ ))
                    save_last_index
                fi
                ;;
            [C) # Right - toggle active to 安装到服务
                if (( APP_COUNT > 0 )); then
                    [[ "${APP_ACTIVES[$CURRENT_INDEX]}" == "start" ]] && APP_ACTIVES[$CURRENT_INDEX]="安装到服务"
                fi
                ;;
            [D) # Left - toggle active to start
                if (( APP_COUNT > 0 )); then
                    [[ "${APP_ACTIVES[$CURRENT_INDEX]}" == "安装到服务" ]] && APP_ACTIVES[$CURRENT_INDEX]="start"
                fi
                ;;
            ""|$'\r'|$'\n') # Enter - launch current or install as service
                if (( APP_COUNT > 0 )); then
                    save_last_index
                    if [[ "${APP_ACTIVES[$CURRENT_INDEX]}" == "安装到服务" ]]; then
                        install_service_current
                    else
                        launch_current
                    fi
                    echo ""
                    print_warn "Press Enter to return to menu..."
                    read -r
                fi
                ;;
            R|r)
                do_scan
                sleep 1
                ;;
            Q|q)
                save_last_index
                print_warn "Exiting"
                exit 0
                ;;
            *)
                print_info "Up/Down: select | Left/Right: Active | Enter: Launch/Install | R: Rescan | Q: Quit"
                sleep 1
                ;;
        esac
    done
}

main_loop
