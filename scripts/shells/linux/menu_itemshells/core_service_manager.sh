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

# Core Node Services Manager (NCORE / PYCORE)
# Auto-discovers and manages every systemd unit created by the core_node Linux
# service-manager shells, regardless of which installer created it:
#   - ncore-*            create_ncore_service / debian_service_manager.sh
#                        (incl. ncore-laravel-main from poly_apps/laravel_main/scripts/start.sh)
#   - pycore             pycore_service.sh (headless module caller)
#   - pycore-module-caller   189_install_pycore_http_service.sh (HTTP service :59000)
#   - codesync           codesync_service.sh
#   - octane-*           octane_service_manager.sh (legacy octane-<domain>-<port>)
#   - app-manager-*      scripts/app_manager/linux_sh/app_manager.sh
# The Unified App Services Manager (Service Manager item 9) also surfaces
# app-manager-* via its greedy 'app-' prefix, so those app units can be managed
# from either menu; this manager additionally owns the project's infrastructure
# units (ncore-/pycore/codesync/octane-). The internal app-manager-log-trim
# housekeeping unit is intentionally excluded (it is driven by its .timer).

# --- Variable declarations (rule 5) -------------------------------------- #
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
PARENT_DIR_LEVEL_3="$(dirname "$PARENT_DIR_LEVEL_2")"
ROOT_DIR="$PARENT_DIR_LEVEL_3"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Service name prefixes created by the core_node service-manager shells.
# Note: "pycore" matches both "pycore" and "pycore-module-caller"; "codesync"
# matches the bare "codesync" unit. Anchored at start-of-name when matched.
CORE_SERVICE_PREFIXES=("ncore-" "pycore" "codesync" "octane-" "app-manager-")

# Privilege escalation: empty when root, "sudo" otherwise. We deliberately do NOT
# source gvar_common.sh (its top-level side effects scan disks / can block on a
# sudo prompt); plain sudo is all this manager needs.
USE_SUDO=""
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
    USE_SUDO="sudo"
fi

# Build the precise unit-name regex for a prefix: hyphen-terminated prefixes
# (ncore-/octane-/app-manager-) match any suffix; bare stems (pycore/codesync)
# must hit a name boundary so unrelated units like pycoredb/codesyncd are NOT swept in.
core_prefix_pattern() {
    local prefix="$1"
    if [[ "$prefix" == *- ]]; then
        echo "^${prefix}[A-Za-z0-9_.@-]*\.service$"
    else
        echo "^${prefix}(-[A-Za-z0-9_.@-]*)?\.service$"
    fi
}

# Detect all core_node services across every managed prefix (deduplicated, sorted).
detect_core_services() {
    local services=()
    local seen=" "
    local prefix pat found svc

    for prefix in "${CORE_SERVICE_PREFIXES[@]}"; do
        pat="$(core_prefix_pattern "$prefix")"
        # Union installed unit files with loaded-but-not-installed (transient) units.
        found=$( { systemctl list-unit-files --type=service --no-pager --no-legend 2>/dev/null
                   systemctl list-units --type=service --all --no-pager --no-legend 2>/dev/null; } \
            | awk '{print $1}' \
            | grep -E "$pat" \
            | sed 's/\.service$//')

        while IFS= read -r svc; do
            [ -z "$svc" ] && continue
            # Skip the internal app-manager-log-trim housekeeping unit: it is driven by
            # its companion .timer, so managing the bare .service here would orphan it.
            [ "$svc" = "app-manager-log-trim" ] && continue
            case "$seen" in *" $svc "*) continue ;; esac
            seen="$seen$svc "
            services+=("$svc")
        done <<< "$found"
    done

    [ ${#services[@]} -eq 0 ] && return 0
    printf '%s\n' "${services[@]}" | sort -u
}

# Human-readable category for a service, used as a column label.
categorize_service() {
    local service="$1"
    case "$service" in
        ncore-laravel-main)   echo "NCORE/Laravel" ;;
        pycore-module-caller) echo "PYCORE/HTTP" ;;
        pycore)               echo "PYCORE" ;;
        codesync)             echo "CODESYNC" ;;
        octane-*)             echo "OCTANE" ;;
        app-manager-*)        echo "APP-MGR" ;;
        ncore-*)              echo "NCORE" ;;
        *)                    echo "SERVICE" ;;
    esac
}

# Get service status: RUNNING | STOPPED_ENABLED | STOPPED_DISABLED | NOT_FOUND.
get_service_status() {
    local service="$1"

    if ! systemctl list-unit-files "${service}.service" >/dev/null 2>&1 \
        && ! systemctl list-units --all "${service}.service" --no-legend 2>/dev/null | grep -q .; then
        echo "NOT_FOUND"
        return
    fi

    if systemctl is-active --quiet "$service"; then
        echo "RUNNING"
    else
        if systemctl is-enabled --quiet "$service" 2>/dev/null; then
            echo "STOPPED_ENABLED"
        else
            echo "STOPPED_DISABLED"
        fi
    fi
}

# Print colored status.
print_status() {
    local status="$1"
    case "$status" in
        "RUNNING")          echo -e "${GREEN}[RUNNING]${NC}" ;;
        "STOPPED_ENABLED")  echo -e "${YELLOW}[STOPPED - Auto-start ENABLED]${NC}" ;;
        "STOPPED_DISABLED") echo -e "${YELLOW}[STOPPED - Auto-start DISABLED]${NC}" ;;
        "NOT_FOUND")        echo -e "${RED}[NOT FOUND]${NC}" ;;
        *)                  echo -e "${RED}[UNKNOWN]${NC}" ;;
    esac
}

# Start service.
start_service() {
    local service="$1"

    echo ""
    echo "================================================"
    echo "Starting $service..."
    echo "================================================"

    if systemctl is-active --quiet "$service"; then
        echo -e "${YELLOW}$service is already running${NC}"
        return 0
    fi

    if $USE_SUDO systemctl start "$service"; then
        echo -e "${GREEN}$service started successfully${NC}"
        if ! systemctl is-enabled --quiet "$service" 2>/dev/null; then
            echo "Enabling auto-start for $service..."
            $USE_SUDO systemctl enable "$service" 2>/dev/null || true
        fi
        echo ""
        echo "Service status:"
        systemctl status "$service" --no-pager --lines=10
        return 0
    else
        echo -e "${RED}Failed to start $service${NC}"
        systemctl status "$service" --no-pager --lines=10
        return 1
    fi
}

# Stop service.
stop_service() {
    local service="$1"

    echo ""
    echo "================================================"
    echo "Stopping $service..."
    echo "================================================"

    if ! systemctl is-active --quiet "$service"; then
        echo -e "${YELLOW}$service is not running${NC}"
        return 0
    fi

    if $USE_SUDO systemctl stop "$service"; then
        echo -e "${GREEN}$service stopped successfully${NC}"
        return 0
    else
        echo -e "${RED}Failed to stop $service${NC}"
        return 1
    fi
}

# Restart service.
restart_service() {
    local service="$1"

    echo ""
    echo "================================================"
    echo "Restarting $service..."
    echo "================================================"

    if $USE_SUDO systemctl restart "$service"; then
        echo -e "${GREEN}$service restarted successfully${NC}"
        echo ""
        echo "Service status:"
        systemctl status "$service" --no-pager --lines=10
        return 0
    else
        echo -e "${RED}Failed to restart $service${NC}"
        systemctl status "$service" --no-pager --lines=10
        return 1
    fi
}

# Show full service status.
show_service_status() {
    local service="$1"

    echo ""
    echo "================================================"
    echo "$service Status"
    echo "================================================"
    systemctl status "$service" --no-pager
}

# Show recent service logs.
show_service_logs() {
    local service="$1"

    echo ""
    echo "================================================"
    echo "$service Logs"
    echo "================================================"
    echo ""
    echo -e "${CYAN}Recent logs (last 50 lines):${NC}"
    echo "================================================"
    journalctl -u "$service" -n 50 --no-pager
    echo ""
    echo -e "${YELLOW}Tip: Use 'journalctl -u $service -f' to follow logs in real-time${NC}"
}

# Show the systemd unit file.
show_service_config() {
    local service="$1"
    local service_file="/etc/systemd/system/${service}.service"

    echo ""
    echo "================================================"
    echo "$service Configuration"
    echo "================================================"

    if [ -f "$service_file" ]; then
        echo -e "${CYAN}File: $service_file${NC}"
        echo ""
        cat "$service_file"
        echo ""
    else
        echo -e "${YELLOW}No /etc/systemd/system unit file; showing the loaded unit:${NC}"
        systemctl cat "$service" --no-pager 2>/dev/null \
            || echo -e "${RED}Unit definition not found for $service${NC}"
    fi
}

# Toggle auto-start (enable/disable).
toggle_autostart() {
    local service="$1"

    echo ""
    echo "================================================"
    echo "Toggle Auto-start for $service"
    echo "================================================"

    if systemctl is-enabled --quiet "$service" 2>/dev/null; then
        echo "Auto-start is currently: ENABLED"
        echo ""
        read -p "Do you want to DISABLE auto-start? (y/N): " confirm
        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            $USE_SUDO systemctl disable "$service"
            echo -e "${GREEN}Auto-start disabled${NC}"
        fi
    else
        echo "Auto-start is currently: DISABLED"
        echo ""
        read -p "Do you want to ENABLE auto-start? (y/N): " confirm
        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            $USE_SUDO systemctl enable "$service"
            echo -e "${GREEN}Auto-start enabled${NC}"
        fi
    fi
}

# Remove service (stop, disable, delete unit file).
remove_service() {
    local service="$1"

    echo ""
    echo "================================================"
    echo "Remove $service"
    echo "================================================"
    echo ""
    echo -e "${RED}WARNING: This will permanently remove the service unit${NC}"
    echo ""
    read -p "Are you sure you want to remove $service? (y/N): " confirm

    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Operation cancelled"
        return 0
    fi

    echo ""
    echo "Stopping service..."
    $USE_SUDO systemctl stop "$service" 2>/dev/null || true

    echo "Disabling auto-start..."
    $USE_SUDO systemctl disable "$service" 2>/dev/null || true

    local service_file="/etc/systemd/system/${service}.service"
    if [ -f "$service_file" ]; then
        echo "Removing service file..."
        $USE_SUDO rm -f "$service_file"
    fi

    echo "Reloading systemd..."
    $USE_SUDO systemctl daemon-reload

    echo ""
    echo -e "${GREEN}$service has been removed${NC}"
}

# Per-service management submenu.
manage_service() {
    local service="$1"

    while true; do
        clear
        echo "================================================"
        echo "$service Management  [$(categorize_service "$service")]"
        echo "================================================"
        echo ""
        echo -n "Status: "
        print_status "$(get_service_status "$service")"
        echo ""
        echo "1. Start Service"
        echo "2. Stop Service"
        echo "3. Restart Service"
        echo "4. Show Status"
        echo "5. Show Logs"
        echo "6. Show Configuration"
        echo "7. Toggle Auto-start"
        echo "8. Remove Service"
        echo ""
        echo "0. Back to Service List"
        echo ""
        read -p "Choose an option: " choice

        case "$choice" in
            1) start_service "$service" ;;
            2) stop_service "$service" ;;
            3) restart_service "$service" ;;
            4) show_service_status "$service" ;;
            5) show_service_logs "$service" ;;
            6) show_service_config "$service" ;;
            7) toggle_autostart "$service" ;;
            8) remove_service "$service"; return 0 ;;
            0) return 0 ;;
            *) echo -e "${RED}Invalid option${NC}" ;;
        esac

        echo ""
        read -p "Press Enter to continue..."
    done
}

# Bulk operation over every discovered service: start | stop | restart.
bulk_operation() {
    local action="$1"
    local services=($(detect_core_services))

    if [ ${#services[@]} -eq 0 ]; then
        echo -e "${YELLOW}No core_node services found${NC}"
        return 0
    fi

    echo ""
    read -p "Run '$action' on all ${#services[@]} core_node service(s)? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Operation cancelled"
        return 0
    fi

    local service
    for service in "${services[@]}"; do
        case "$action" in
            start)   start_service "$service" ;;
            stop)    stop_service "$service" ;;
            restart) restart_service "$service" ;;
        esac
        echo ""
    done
    echo -e "${GREEN}Bulk '$action' complete${NC}"
}

# Main menu.
show_main_menu() {
    local services index service status category service_num action service_index
    while true; do
        clear
        echo "================================================"
        echo "Core Node Services Manager (NCORE / PYCORE)"
        echo "================================================"
        echo ""

        services=($(detect_core_services))

        if [ ${#services[@]} -eq 0 ]; then
            echo -e "${YELLOW}No core_node services found${NC}"
            echo ""
            echo "Services are auto-discovered by unit-name prefix:"
            echo "  - ncore-*            (incl. ncore-laravel-main)"
            echo "  - pycore / pycore-module-caller"
            echo "  - codesync"
            echo "  - octane-*"
            echo "  - app-manager-*"
            echo ""
            echo "Install them via their installers (Service Manager / dd.sh menu),"
            echo "e.g. Laravel Octane: poly_apps/laravel_main/scripts/start.sh --service"
            echo ""
            echo "0. Back to Service Manager"
            echo ""
            read -p "Choose an option: " choice
            [ "$choice" = "0" ] && return 0
            continue
        fi

        echo -e "${CYAN}Found ${#services[@]} service(s):${NC}"
        echo ""

        index=1
        for service in "${services[@]}"; do
            status=$(get_service_status "$service")
            category=$(categorize_service "$service")

            printf "${CYAN}%d.${NC} %-28s ${BLUE}%-13s${NC} " "$index" "$service" "$category"
            print_status "$status"

            if [[ "$status" == "RUNNING" ]]; then
                echo -e "   ${YELLOW}${index}x${NC} Stop  ${YELLOW}${index}r${NC} Restart  ${YELLOW}${index}l${NC} Logs  ${YELLOW}${index}m${NC} Manage"
            else
                echo -e "   ${YELLOW}${index}s${NC} Start  ${YELLOW}${index}r${NC} Restart  ${YELLOW}${index}l${NC} Logs  ${YELLOW}${index}m${NC} Manage"
            fi
            ((index++))
        done

        echo ""
        echo "================================================"
        echo -e "Enter: ${YELLOW}<number><action>${NC} (e.g., ${YELLOW}1s${NC}=Start, ${YELLOW}2x${NC}=Stop, ${YELLOW}3m${NC}=Manage)"
        echo -e "Bulk:  ${YELLOW}ss${NC}=Start all  ${YELLOW}xx${NC}=Stop all  ${YELLOW}rr${NC}=Restart all  | ${YELLOW}0${NC}=Back"
        echo "================================================"
        echo ""
        read -p "Command: " choice

        if [[ "$choice" =~ ^([0-9]+)([sxrlm])$ ]]; then
            service_num="${BASH_REMATCH[1]}"
            action="${BASH_REMATCH[2]}"
            # Force base-10: a leading zero (e.g. "08") would be parsed as octal and abort.
            service_index=$((10#$service_num - 1))

            if [ "$service_index" -ge 0 ] && [ "$service_index" -lt ${#services[@]} ]; then
                service="${services[$service_index]}"
                case "$action" in
                    s) start_service "$service";   read -p "Press Enter to continue..." ;;
                    x) stop_service "$service";    read -p "Press Enter to continue..." ;;
                    r) restart_service "$service"; read -p "Press Enter to continue..." ;;
                    l) show_service_logs "$service"; read -p "Press Enter to continue..." ;;
                    m) manage_service "$service" ;;
                esac
            else
                echo -e "${RED}Invalid service number${NC}"
                read -p "Press Enter to continue..."
            fi
        else
            case "$choice" in
                ss|SS) bulk_operation "start";   read -p "Press Enter to continue..." ;;
                xx|XX) bulk_operation "stop";    read -p "Press Enter to continue..." ;;
                rr|RR) bulk_operation "restart"; read -p "Press Enter to continue..." ;;
                0) echo "Returning to Service Manager..."; return 0 ;;
                *)
                    echo -e "${RED}Invalid command. Use format: <number><action> (e.g., 1s, 2x, 3m)${NC}"
                    read -p "Press Enter to continue..."
                    ;;
            esac
        fi
    done
}

# Main execution
show_main_menu
