#!/usr/bin/env bash
# Unified App Manager - Linux SH (multi-file, no Python)
# Entry point for dd.sh on Linux. Scans apps, shows menu, launches selected app.
# App types: ncoreApp (./apps), pycoreApp (./pyapps), polyApp (./poly_apps).
# Input: N+a/s/l, N alone, u/d, [/], go, r/q (see menu).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
STATE_FILE="$ROOT_DIR/.app_manager_last_index"
DEBIAN_SERVICE_MANAGER="$ROOT_DIR/scripts/shells/linux/common/debian_service_manager.sh"

# Config (path constants + budget) must load before we resolve the data dir.
source "$SCRIPT_DIR/config/app_config.sh"
source "$SCRIPT_DIR/core/app_scanner.sh"
source "$SCRIPT_DIR/core/command_generator.sh"
source "$SCRIPT_DIR/utils/log_budget.sh"

# State + logs (foreground.log, service.log) live under APP_MANAGER_DATA_DIR/logs/namespaces/apps/<name>/
# ONE unified dir for all users (canonical path-map key 'app_manager_logs' parent).
# Not under $HOME (root would use /root/.local/... - other users cannot read).
# Created world-accessible (0777) so any user can read/write; override only via
# CORE_NODE_APP_MANAGER_DATA. Old/scattered dirs are purged by cleanup_old_log_dirs().
resolve_app_manager_data_dir() {
    local d
    d="${CORE_NODE_APP_MANAGER_DATA:-${APP_MANAGER_DATA_DIR_DEFAULT:-/opt/_core_node}}"
    mkdir -p "$d" 2>/dev/null || true
    chmod 0777 "$d" 2>/dev/null || true
    printf '%s' "$d"
}
APP_MANAGER_DATA_DIR="$(resolve_app_manager_data_dir)"
export APP_MANAGER_DATA_DIR

LOG_BUDGET_SCRIPT="$SCRIPT_DIR/utils/log_budget.sh"
LOG_NAMESPACE_DIR="$APP_MANAGER_DATA_DIR/logs/namespaces/apps"
LOG_TRIM_STAMP="$APP_MANAGER_DATA_DIR/.log_trim_last"

CURRENT_INDEX=0
MAX_NAME_WIDTH=8
declare -a APP_ACTIVES=()

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

app_logs_dir_for_name() {
    printf '%s' "$APP_MANAGER_DATA_DIR/logs/namespaces/apps/${1}"
}

foreground_log_path() {
    printf '%s' "$(app_logs_dir_for_name "$1")/foreground.log"
}

service_log_path() {
    printf '%s' "$(app_logs_dir_for_name "$1")/service.log"
}

ensure_app_log_dir() {
    mkdir -p "$(app_logs_dir_for_name "$1")" 2>/dev/null || true
}

# Trim the unified log namespace to the configured byte budget right now.
trim_logs_now() {
    enforce_log_budget "$LOG_NAMESPACE_DIR" \
        "${APP_MANAGER_LOG_TOTAL_BYTES:-$((50 * 1024 * 1024))}" \
        "${APP_MANAGER_LOG_FILE_BYTES:-$((10 * 1024 * 1024))}" 2>/dev/null || true
}

# Reserved cleanup hook: purge retired log roots (formerly core_node_unified_manager,
# path-map key 'app_manager_logs_old'). Deletes ONLY the known old constant dirs from
# APP_MANAGER_OLD_DATA_DIRS, never the active data dir. Safe to call repeatedly.
cleanup_old_log_dirs() {
    local d
    for d in ${APP_MANAGER_OLD_DATA_DIRS:-}; do
        [[ -n "$d" ]] || continue
        [[ "$d" == "$APP_MANAGER_DATA_DIR" ]] && continue   # never remove the active dir
        [[ -d "$d" ]] || continue
        rm -rf "$d" 2>/dev/null || true
    done
}

# Throttled trim: invoked on every log-writing event (foreground launch, service
# install, menu start). Enforces the budget + purges old dirs, but at most once per
# APP_MANAGER_LOG_TRIM_INTERVAL (default 30min) so frequent writes don't re-scan.
maybe_trim_logs() {
    local now last interval
    interval="${APP_MANAGER_LOG_TRIM_INTERVAL:-1800}"
    now="$(date +%s 2>/dev/null || echo 0)"
    last=0
    if [[ -f "$LOG_TRIM_STAMP" ]]; then
        read -r last < "$LOG_TRIM_STAMP" 2>/dev/null || last=0
        [[ "$last" =~ ^[0-9]+$ ]] || last=0
    fi
    # now==0 means date failed: fall through and trim (don't get stuck).
    if (( now > 0 && now - last < interval )); then
        return 0
    fi
    trim_logs_now
    cleanup_old_log_dirs
    mkdir -p "$APP_MANAGER_DATA_DIR" 2>/dev/null || true
    # Write WITH a trailing newline: a no-newline file makes `read` return non-zero
    # at EOF, and the `|| last=0` above would then clobber the timestamp to 0,
    # defeating the throttle (it would re-scan on every call).
    printf '%s\n' "$now" > "$LOG_TRIM_STAMP" 2>/dev/null || true
}

# Install a systemd timer that caps the log folder on the same throttle interval,
# so the budget holds even when this interactive menu is not running. systemd
# "append:" never rotates on its own, so without this a looping unit refills it.
ensure_log_budget_timer() {
    command -v systemctl >/dev/null 2>&1 || return 0
    [[ -d /etc/systemd/system ]] || return 0
    [[ -w /etc/systemd/system ]] || return 0   # needs root; silently skip otherwise

    local svc="/etc/systemd/system/app-manager-log-trim.service"
    local tmr="/etc/systemd/system/app-manager-log-trim.timer"

    cat > "$svc" 2>/dev/null <<EOF || return 0
[Unit]
Description=App Manager: trim unified log namespace to byte budget

[Service]
Type=oneshot
Environment="APP_MANAGER_DATA_DIR=$APP_MANAGER_DATA_DIR"
Environment="APP_MANAGER_LOG_TOTAL_BYTES=${APP_MANAGER_LOG_TOTAL_BYTES:-$((50 * 1024 * 1024))}"
Environment="APP_MANAGER_LOG_FILE_BYTES=${APP_MANAGER_LOG_FILE_BYTES:-$((10 * 1024 * 1024))}"
ExecStart=/usr/bin/env bash $LOG_BUDGET_SCRIPT $LOG_NAMESPACE_DIR
EOF

    cat > "$tmr" 2>/dev/null <<EOF || return 0
[Unit]
Description=App Manager: periodic unified-log trim

[Timer]
OnBootSec=5min
OnUnitActiveSec=${APP_MANAGER_LOG_TRIM_INTERVAL:-1800}s
AccuracySec=30s
Persistent=true

[Install]
WantedBy=timers.target
EOF

    systemctl daemon-reload 2>/dev/null || true
    systemctl enable --now app-manager-log-trim.timer 2>/dev/null || true
}

trim_line() {
    local v="$1"
    v="${v#"${v%%[![:space:]]*}"}"
    v="${v%"${v##*[![:space:]]}"}"
    printf '%s' "$v"
}

do_scan() {
    print_header "Starting Application Scan"
    scan_applications "$ROOT_DIR"
    fill_commands "$ROOT_DIR"
    MAX_NAME_WIDTH=8
    APP_ACTIVES=()
    local i
    for (( i=0; i < APP_COUNT; i++ )); do
        local len=${#APP_NAMES[$i]}
        if (( len > MAX_NAME_WIDTH )); then MAX_NAME_WIDTH=$len; fi
        APP_ACTIVES+=("start")
    done
    load_last_index
    print_ok "Scan complete - found $APP_COUNT applications"
    print_info "Unified log namespace: $APP_MANAGER_DATA_DIR/logs/namespaces/apps/<AppName>/"
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
    print_info "Data / logs: $APP_MANAGER_DATA_DIR"
    echo ""

    if (( APP_COUNT == 0 )); then
        print_warn "No applications found."
        print_info "Scanned: apps/, pyapps/, poly_apps/ under the root above."
        print_info "Input: r rescan | q quit"
        echo ""
        echo -ne "${C_HEADER}Input: ${C_RESET}"
        return
    fi

    local name_width=$MAX_NAME_WIDTH
    if (( name_width < 8 )); then name_width=8; fi
    print_warn "Application List:"
    printf "No. | %-${name_width}s | %-11s | %-14s | %-6s | %-5s | Debug\n" "App Name" "Type" "Framework" "Active" "Port"
    echo "----|$(printf '%*s' $((name_width+2)) '' | tr ' ' '-')|-------------|----------------|--------|-------|------"

    local i
    for (( i=0; i < APP_COUNT; i++ )); do
        local ind=" "
        local line_color="$C_RESET"
        if (( i == CURRENT_INDEX )); then ind=">"; line_color="$C_WARNING"; fi
        local active="${APP_ACTIVES[$i]:-start}"
        printf "${line_color}%s%2d | %-${name_width}s | %-11s | %-14s | %-6s | %-5s | %s${C_RESET}\n" \
            "$ind" $((i+1)) "${APP_NAMES[$i]}" "${APP_TYPES[$i]}" "${APP_FRAMEWORKS[$i]}" "$active" "${APP_PORTS[$i]}" "${APP_DEBUGS[$i]}"
    done
    echo ""
    print_warn "Input (1-based No.):"
    echo "  Na   foreground start (dev)       e.g. 21a"
    echo "  Ns   install systemd service       e.g. 21s"
    echo "  Nl   unified logs (files+journal) e.g. 21l"
    echo "  N    select row only              e.g. 21"
    echo "  a s l on current row (no number)"
    echo "  u d  move selection up / down"
    echo "  [ ]  toggle Active (install-service vs start) for current row"
    echo "  go   run Active column for current row (start or install-service)"
    echo "  r q  rescan | quit"
    echo ""
    echo -ne "${C_HEADER}Input: ${C_RESET}"
}

run_foreground_with_log() {
    local name="$1"
    shift
    local logf
    logf="$(foreground_log_path "$name")"
    ensure_app_log_dir "$name"
    maybe_trim_logs   # writing logs -> throttled budget check (>=30min since last)
    { echo "===== $(date -Is) foreground ====="; "$@"; } 2>&1 | tee -a "$logf"
    return "${PIPESTATUS[0]}"
}

# Check if an app at given index is a Laravel app
is_laravel_app() {
    local idx="$1"
    [[ "${APP_FRAMEWORKS[$idx]}" == "laravelStart" ]]
}

launch_at_index() {
    local idx="$1"
    if (( APP_COUNT == 0 )); then print_err "No applications available"; return 1; fi
    if (( idx < 0 || idx >= APP_COUNT )); then print_err "Invalid index"; return 1; fi

    local name="${APP_NAMES[$idx]}"
    local type="${APP_TYPES[$idx]}"
    local port="${APP_PORTS[$idx]}"

    case "$type" in
        ncoreApp)
            if [[ ! -f "$ROOT_DIR/main.js" ]]; then
                print_err "ncoreApp requires root/main.js. Missing: $ROOT_DIR/main.js"
                return 1
            fi
            print_header "Launching $name"
            print_info "Command: node ./main.js app=$name (cwd: $ROOT_DIR)"
            print_info "Foreground log: $(foreground_log_path "$name")"
            run_foreground_with_log "$name" bash -c 'cd "$0" && exec node ./main.js app="$1"' "$ROOT_DIR" "$name"
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
            print_info "Foreground log: $(foreground_log_path "$name")"
            run_foreground_with_log "$name" bash -c 'cd "$0" && exec python3 "./pyapps/$1/main.py"' "$ROOT_DIR" "$name"
            return $?
            ;;
        polyApp)
            local start_sh="$ROOT_DIR/poly_apps/$name/scripts/start.sh"
            if [[ ! -f "$start_sh" ]]; then
                print_err "polyApp requires poly_apps/$name/scripts/start.sh. Missing: $start_sh"
                return 1
            fi
            print_header "Launching $name"
            print_info "PORT=$port (cwd: poly_apps/$name)"
            if is_laravel_app "$idx"; then
                print_info "Framework: Laravel (dev mode, port $port)"
            fi
            print_info "Foreground log: $(foreground_log_path "$name")"
            run_foreground_with_log "$name" bash -c 'cd "$0" && exec env PORT="$1" bash ./scripts/start.sh' "$ROOT_DIR/poly_apps/$name" "$port"
            return $?
            ;;
        *)
            print_err "Unknown app type: $type"
            return 1
            ;;
    esac
}

launch_current() {
    launch_at_index "$CURRENT_INDEX"
}

# After systemd unit install: show status + script stdout/stderr in service.log + journal.
print_post_install_log_preview() {
    local name="$1" svc="$2" slog="$3"
    echo ""
    print_header "Log preview ($name)"
    print_info "Follow file: tail -f $(printf %q "$slog")"
    print_info "Follow unit:  journalctl -u $(printf %q "$svc") -f"
    echo ""
    echo "--- systemd (is unit running?) ---"
    if command -v systemctl >/dev/null 2>&1; then
        local st
        st="$(systemctl is-active "$svc" 2>/dev/null || true)"
        print_info "systemctl is-active: ${st:-unknown}"
        systemctl show "$svc" -p ActiveState,SubState,ExecMainStatus,Result --no-pager 2>/dev/null \
            | sed '/^$/d' || print_info "(systemctl show failed - need root?)"
    else
        print_info "systemctl not in PATH"
    fi
    echo ""
    echo "--- service.log (last 120 lines; ExecStart stdout/stderr appended here) ---"
    if [[ -f "$slog" ]]; then
        if [[ -s "$slog" ]]; then
            tail -n 120 "$slog" 2>/dev/null || print_err "Cannot read $slog"
        else
            print_info "(still empty: unit not started yet, or process writes nowhere, or still starting - see journal above)"
        fi
    else
        print_info "(no service.log file yet)"
    fi
    echo ""
    echo "--- journalctl -u $svc (last 45 lines) ---"
    if command -v journalctl >/dev/null 2>&1; then
        journalctl -u "$svc" -n 45 --no-pager 2>/dev/null || print_info "(no journal lines yet, or no permission)"
    else
        print_info "journalctl not available"
    fi
}

install_service_at_index() {
    local idx="$1"
    if (( APP_COUNT == 0 )); then print_err "No applications available"; return 1; fi
    if (( idx < 0 || idx >= APP_COUNT )); then print_err "Invalid index"; return 1; fi

    if [[ ! -f "$DEBIAN_SERVICE_MANAGER" ]]; then
        print_err "Service manager not found: $DEBIAN_SERVICE_MANAGER"
        return 1
    fi
    # shellcheck source=/dev/null
    source "$DEBIAN_SERVICE_MANAGER" || { print_err "Failed to source debian_service_manager.sh"; return 1; }

    local name="${APP_NAMES[$idx]}"
    local type="${APP_TYPES[$idx]}"
    local port="${APP_PORTS[$idx]}"
    local service_name="app-manager-$name"
    local description="App Manager: $name ($type)"
    local slog
    slog="$(service_log_path "$name")"
    ensure_app_log_dir "$name"
    local install_ok=0

    case "$type" in
        ncoreApp)
            if [[ ! -f "$ROOT_DIR/main.js" ]]; then
                print_err "ncoreApp requires root/main.js. Missing: $ROOT_DIR/main.js"
                return 1
            fi
            if create_systemd_service "$service_name" "$description" "node ./main.js app=$name" "$ROOT_DIR" "root" "always" "5" "50%" "1G" "$slog"; then
                install_ok=1
            else
                print_warn "If permission denied, run with sudo to install the service."
            fi
            ;;
        pycoreApp)
            local py_main="$ROOT_DIR/pyapps/$name/main.py"
            if [[ ! -f "$py_main" ]]; then
                print_err "pycoreApp requires pyapps/$name/main.py. Missing: $py_main"
                return 1
            fi
            if create_systemd_service "$service_name" "$description" "python3 ./pyapps/$name/main.py" "$ROOT_DIR" "root" "always" "5" "50%" "1G" "$slog"; then
                install_ok=1
            else
                print_warn "If permission denied, run with sudo to install the service."
            fi
            ;;
        polyApp)
            local work_dir="$ROOT_DIR/poly_apps/$name"

            # Laravel apps use dedicated start_service.sh (Octane/Swoole production mode)
            if is_laravel_app "$idx"; then
                local service_sh="$work_dir/scripts/start_service.sh"
                if [[ ! -f "$service_sh" ]]; then
                    print_err "Laravel app requires poly_apps/$name/scripts/start_service.sh. Missing: $service_sh"
                    return 1
                fi
                local laravel_desc="App Manager: $name (Laravel Octane)"
                print_info "Laravel detected: using start_service.sh (Octane, port $port)"
                print_info "Memory: ${LARAVEL_MEMORY_LIMIT}, CPU: ${LARAVEL_CPU_LIMIT}"
                if create_systemd_service "$service_name" "$laravel_desc" "env PORT=$port bash ./scripts/start_service.sh" "$work_dir" "root" "always" "10" "$LARAVEL_CPU_LIMIT" "$LARAVEL_MEMORY_LIMIT" "$slog"; then
                    install_ok=1
                else
                    print_warn "If permission denied, run with sudo to install the service."
                fi
            else
                local start_sh="$work_dir/scripts/start.sh"
                if [[ ! -f "$start_sh" ]]; then
                    print_err "polyApp requires poly_apps/$name/scripts/start.sh. Missing: $start_sh"
                    return 1
                fi
                if create_systemd_service "$service_name" "$description" "env PORT=$port bash ./scripts/start.sh" "$work_dir" "root" "always" "5" "50%" "1G" "$slog"; then
                    install_ok=1
                else
                    print_warn "If permission denied, run with sudo to install the service."
                fi
            fi
            ;;
        *)
            print_err "Unknown app type: $type"
            return 1
            ;;
    esac
    if (( install_ok )); then
        maybe_trim_logs   # new service.log appender -> throttled budget check
        ensure_log_budget_timer
        print_info "Service log file: $slog"
        print_info "Log budget: folder capped at ${APP_MANAGER_LOG_TOTAL_BYTES} bytes (trim timer: app-manager-log-trim.timer)"
        # Unit file alone does not run ExecStart - service.log stays empty until the unit is started.
        if command -v systemctl >/dev/null 2>&1; then
            if systemctl enable --now "${service_name}.service" 2>/dev/null; then
                print_ok "Started unit: ${service_name}.service (stdout/stderr -> service.log)"
            else
                print_warn "Could not enable/start unit (run as root): sudo systemctl enable --now ${service_name}.service"
            fi
            # First pnpm install can take >10s; poll briefly so preview shows script logs when possible
            local _tries
            for ((_tries = 0; _tries < 20; _tries++)); do
                [[ -s "$slog" ]] && break
                sleep 1
            done
        fi
        print_post_install_log_preview "$name" "$service_name" "$slog"
    fi
}

install_service_current() {
    install_service_at_index "$CURRENT_INDEX"
}

show_logs_at_index() {
    local idx="$1"
    if (( APP_COUNT == 0 )); then print_err "No applications available"; return 1; fi
    if (( idx < 0 || idx >= APP_COUNT )); then print_err "Invalid index"; return 1; fi

    local name="${APP_NAMES[$idx]}"
    local svc="app-manager-$name"
    local fg svc
    fg="$(foreground_log_path "$name")"
    svc="$(service_log_path "$name")"

    print_header "Logs: $name"
    print_info "Namespace: $(app_logs_dir_for_name "$name")"
    echo ""
    echo "--- foreground.log (tail) ---"
    if [[ -f "$fg" ]]; then
        tail -n 120 "$fg" 2>/dev/null || print_err "Cannot read $fg"
    else
        print_info "(no foreground log yet)"
    fi
    echo ""
    echo "--- service.log (tail) ---"
    if [[ -f "$svc" ]]; then
        tail -n 120 "$svc" 2>/dev/null || print_err "Cannot read $svc"
    else
        print_info "(no service file log yet - reinstall service to enable append logging)"
    fi
    echo ""
    echo "--- journalctl -u $svc (last 40) ---"
    if command -v journalctl >/dev/null 2>&1; then
        journalctl -u "$svc" -n 40 --no-pager 2>/dev/null || print_info "(no journal unit or no permission)"
    else
        print_info "journalctl not available"
    fi
}

pause_return_menu() {
    echo ""
    print_warn "Press Enter to return to menu..."
    read -r
}

handle_line_input() {
    local line
    line="$(trim_line "$1")"
    [[ -z "$line" ]] && return 0

    if [[ "$line" == [qQ] ]]; then
        save_last_index
        print_warn "Exiting"
        exit 0
    fi

    if [[ "$line" == [rR] ]]; then
        do_scan
        sleep 1
        return 0
    fi

    if [[ "$line" == [uU] ]]; then
        if (( CURRENT_INDEX > 0 )); then CURRENT_INDEX=$((CURRENT_INDEX - 1)); fi
        save_last_index
        return 0
    fi

    if [[ "$line" == [dD] ]]; then
        if (( CURRENT_INDEX < APP_COUNT - 1 )); then CURRENT_INDEX=$((CURRENT_INDEX + 1)); fi
        save_last_index
        return 0
    fi

    if [[ "$line" == "[" ]]; then
        if [[ "${APP_ACTIVES[$CURRENT_INDEX]:-start}" == "start" ]]; then
            APP_ACTIVES[$CURRENT_INDEX]="install-service"
        fi
        return 0
    fi

    if [[ "$line" == "]" ]]; then
        if [[ "${APP_ACTIVES[$CURRENT_INDEX]:-start}" == "install-service" ]]; then
            APP_ACTIVES[$CURRENT_INDEX]="start"
        fi
        return 0
    fi

    if [[ "$line" == "go" ]] || [[ "$line" == "GO" ]]; then
        save_last_index
        if [[ "${APP_ACTIVES[$CURRENT_INDEX]:-start}" == "install-service" ]]; then
            install_service_current
        else
            launch_current
        fi
        pause_return_menu
        return 0
    fi

    local n cmd
    if [[ "$line" =~ ^([0-9]+)([aAsSlL])$ ]]; then
        n="${BASH_REMATCH[1]}"
        cmd="${BASH_REMATCH[2],,}"
    elif [[ "$line" =~ ^([0-9]+)$ ]]; then
        n="${BASH_REMATCH[1]}"
        if (( n < 1 || n > APP_COUNT )); then
            print_err "No. out of range (1-$APP_COUNT): $n"
            sleep 1
            return 0
        fi
        CURRENT_INDEX=$((n - 1))
        save_last_index
        return 0
    elif [[ "$line" =~ ^([aAsSlL])$ ]]; then
        cmd="${BASH_REMATCH[1],,}"
        n=$((CURRENT_INDEX + 1))
    else
        print_err "Unknown input: $line"
        print_info "Try: 21a  21s  21l  21  a  u  d  [ ]  go  r  q"
        sleep 1
        return 0
    fi

    if (( n < 1 || n > APP_COUNT )); then
        print_err "No. out of range (1-$APP_COUNT): $n"
        sleep 1
        return 0
    fi
    local idx=$((n - 1))

    case "$cmd" in
        a)
            save_last_index
            CURRENT_INDEX=$idx
            launch_at_index "$idx"
            pause_return_menu
            ;;
        s)
            save_last_index
            CURRENT_INDEX=$idx
            install_service_at_index "$idx"
            pause_return_menu
            ;;
        l)
            save_last_index
            CURRENT_INDEX=$idx
            show_logs_at_index "$idx"
            pause_return_menu
            ;;
    esac
}

main_loop() {
    mkdir -p "$APP_MANAGER_DATA_DIR/logs/namespaces/apps" 2>/dev/null || true
    chmod -R a+rwX "$APP_MANAGER_DATA_DIR/logs" 2>/dev/null || true   # all users can access
    maybe_trim_logs        # throttled budget check + old-dir purge on startup
    ensure_log_budget_timer
    do_scan || { print_err "Initial application scan failed"; exit 1; }
    while true; do
        show_menu
        if (( APP_COUNT == 0 )); then
            local zline
            if ! IFS= read -r zline; then exit 0; fi
            handle_line_input "$zline"
            continue
        fi

        local line
        if ! IFS= read -r line; then exit 0; fi
        handle_line_input "$line"
    done
}

main_loop
