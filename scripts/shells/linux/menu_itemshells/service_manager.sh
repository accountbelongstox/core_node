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

# Service Manager
# This script provides a menu interface to manage system services (Redis, PostgreSQL, Docker, MySQL)

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
PARENT_DIR_LEVEL_3="$(dirname "$PARENT_DIR_LEVEL_2")"
INSTALL_SHELLS_DIR="$PARENT_DIR_LEVEL_1/debian/install_shells"
SERVER_MANAGER_DIR="$PARENT_DIR_LEVEL_1/debian/server_manager"
# Repo root and the canonical Laravel Octane entrypoint (PARENT_DIR_LEVEL_3 == scripts/).
REPO_ROOT="$(dirname "$PARENT_DIR_LEVEL_3")"
LARAVEL_DIR="$REPO_ROOT/poly_apps/laravel_main"
LARAVEL_START_SCRIPT="$LARAVEL_DIR/scripts/start.sh"

# Source global variables
source "$PARENT_DIR_LEVEL_1/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_1/common/common_functions.sh"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Service definitions
declare -A SERVICE_NAME
declare -A SERVICE_SYSTEMD
declare -A SERVICE_INSTALL_SCRIPT
declare -A SERVICE_MANAGER_SCRIPT

SERVICE_NAME["redis"]="Redis"
SERVICE_SYSTEMD["redis"]="redis-server"
SERVICE_INSTALL_SCRIPT["redis"]="73_install_redis.sh"
SERVICE_MANAGER_SCRIPT["redis"]="$SERVER_MANAGER_DIR/redis_manager.sh"

SERVICE_NAME["postgresql"]="PostgreSQL"
SERVICE_SYSTEMD["postgresql"]="postgresql"
SERVICE_INSTALL_SCRIPT["postgresql"]="75_install_postgresql.sh"
SERVICE_MANAGER_SCRIPT["postgresql"]="$SERVER_MANAGER_DIR/postgresql_manager.sh"

SERVICE_NAME["docker"]="Docker"
SERVICE_SYSTEMD["docker"]="docker"
SERVICE_INSTALL_SCRIPT["docker"]="79_install_docker.sh"
SERVICE_MANAGER_SCRIPT["docker"]="$SERVER_MANAGER_DIR/docker_manager.sh"

SERVICE_NAME["mysql"]="MySQL"
SERVICE_SYSTEMD["mysql"]="mariadb"
SERVICE_INSTALL_SCRIPT["mysql"]="85_install_mysql.sh"
SERVICE_MANAGER_SCRIPT["mysql"]="$SERVER_MANAGER_DIR/mysql_manager.sh"

SERVICE_NAME["nginx"]="Nginx"
SERVICE_SYSTEMD["nginx"]="nginx"
SERVICE_INSTALL_SCRIPT["nginx"]="33_install_nginx.sh"
SERVICE_MANAGER_SCRIPT["nginx"]="$SERVER_MANAGER_DIR/nginx_manager.sh"

SERVICE_NAME["ssh"]="SSH Server"
SERVICE_SYSTEMD["ssh"]="ssh"
SERVICE_INSTALL_SCRIPT["ssh"]="23_setup_ssh_remote.sh"
SERVICE_MANAGER_SCRIPT["ssh"]="$SERVER_MANAGER_DIR/ssh_manager.sh"

SERVICE_NAME["pycore"]="Pycore HTTP"
SERVICE_SYSTEMD["pycore"]="pycore-module-caller"
SERVICE_INSTALL_SCRIPT["pycore"]="189_install_pycore_http_service.sh"
SERVICE_MANAGER_SCRIPT["pycore"]="$SERVER_MANAGER_DIR/pycore_manager.sh"

SERVICE_NAME["laravel"]="Laravel Octane"
# Canonical units registered by 175_laravel_main_start.sh --service.
# Plane-aware: frankenphp -> ncore-laravel-frankenphp, nginx -> ncore-laravel-nginx.
# Legacy ncore-laravel-main (pre-plane) is also recognized.
SERVICE_SYSTEMD["laravel"]="ncore-laravel-main"
# Install/reinstall is special-cased to run 175_laravel_main_start.sh (see reinstall_service).
SERVICE_INSTALL_SCRIPT["laravel"]="134_setup_api_domains.sh"
SERVICE_MANAGER_SCRIPT["laravel"]="$SERVER_MANAGER_DIR/laravel_octane_manager.sh"
# Laravel service grep pattern: plane-aware (ncore-laravel-frankenphp, ncore-laravel-nginx) +
# canonical (ncore-laravel-main) + legacy app_manager (app-manager-laravel*) +
# legacy octane-* multi-domain units.
LARAVEL_SERVICE_PATTERN="ncore-laravel\|app-manager-laravel\|octane-.*"

SERVICE_NAME["unified_apps"]="Unified Apps"
SERVICE_SYSTEMD["unified_apps"]=""
SERVICE_INSTALL_SCRIPT["unified_apps"]=""
SERVICE_MANAGER_SCRIPT["unified_apps"]="$SCRIPT_CURRENT_DIR/unified_app_service_manager.sh"

# Core Node services: auto-discovered ncore-*/pycore*/codesync/octane-*/app-manager-*
# units created by the various Linux service-manager shells. No single systemd unit
# (the manager scans all matching prefixes), no single install script.
SERVICE_NAME["core_services"]="Core Node Services"
SERVICE_SYSTEMD["core_services"]=""
SERVICE_INSTALL_SCRIPT["core_services"]=""
SERVICE_MANAGER_SCRIPT["core_services"]="$SCRIPT_CURRENT_DIR/core_service_manager.sh"
# Prefixes scanned for the aggregate Core Node services status (mirrors core_service_manager.sh).
CORE_SERVICE_PREFIXES=("ncore-" "pycore" "codesync" "octane-" "app-manager-")

# Build the precise unit-name regex for a core prefix: hyphen-terminated prefixes
# (ncore-/octane-/app-manager-) match any suffix; bare stems (pycore/codesync) must
# hit a name boundary so unrelated units like pycoredb/codesyncd are NOT swept in.
# Kept in sync with core_service_manager.sh.
core_prefix_pattern() {
    local prefix="$1"
    if [[ "$prefix" == *- ]]; then
        echo "^${prefix}[A-Za-z0-9_.@-]*\.service$"
    else
        echo "^${prefix}(-[A-Za-z0-9_.@-]*)?\.service$"
    fi
}

# Service list
SERVICES=("redis" "postgresql" "docker" "mysql" "nginx" "ssh" "pycore" "laravel" "unified_apps" "core_services")

# Function to check if service is installed
is_service_installed() {
    local service="$1"
    local systemd_name="${SERVICE_SYSTEMD[$service]}"

    # Special handling for Unified Apps (manages multiple services)
    if [ "$service" = "unified_apps" ]; then
        local unified_prefixes=("app-" "webapp-" "nuxt-" "laravel-" "flutter-" "react-" "vue-")
        for prefix in "${unified_prefixes[@]}"; do
            if systemctl list-unit-files --type=service 2>/dev/null | grep -q "^${prefix}"; then
                return 0
            fi
        done
        return 1
    fi

    # Special handling for Core Node services (auto-discovered across all prefixes)
    if [ "$service" = "core_services" ]; then
        local prefix match
        for prefix in "${CORE_SERVICE_PREFIXES[@]}"; do
            # Exclude the internal app-manager-log-trim housekeeping unit.
            match=$(systemctl list-unit-files --type=service 2>/dev/null | awk '{print $1}' \
                | grep -E "$(core_prefix_pattern "$prefix")" | grep -v '^app-manager-log-trim\.service$')
            if [ -n "$match" ]; then
                return 0
            fi
        done
        return 1
    fi

    if [ -z "$systemd_name" ]; then
        return 1
    fi

    # Special handling for SSH (can be ssh or sshd)
    if [ "$service" = "ssh" ]; then
        if systemctl list-unit-files | grep -q "^ssh.service"; then
            SERVICE_SYSTEMD["ssh"]="ssh"
            return 0
        elif systemctl list-unit-files | grep -q "^sshd.service"; then
            SERVICE_SYSTEMD["ssh"]="sshd"
            return 0
        fi
        return 1
    fi

    # Special handling for Laravel Octane (canonical: ncore-laravel-main from start.sh;
    # legacy: app-manager-laravel*, octane-*)
    if [ "$service" = "laravel" ]; then
        if systemctl list-units --type=service --all | grep -qE "(ncore-laravel-main|app-manager-laravel|octane-).*\.service"; then
            return 0
        fi
        return 1
    fi

    # Check if systemd service exists
    if systemctl list-unit-files | grep -q "^$systemd_name.service"; then
        return 0
    fi

    return 1
}

# Function to get service status
get_service_status() {
    local service="$1"
    local systemd_name="${SERVICE_SYSTEMD[$service]}"

    # Special handling for Unified Apps (multiple services)
    if [ "$service" = "unified_apps" ]; then
        if ! is_service_installed "$service"; then
            echo "NOT_INSTALLED"
            return
        fi

        local unified_prefixes=("app-" "webapp-" "nuxt-" "laravel-" "flutter-" "react-" "vue-")
        local total_count=0
        local running_count=0

        for prefix in "${unified_prefixes[@]}"; do
            local services=$(systemctl list-unit-files --type=service 2>/dev/null | grep "^${prefix}" | awk '{print $1}' | sed 's/.service$//')
            if [ -n "$services" ]; then
                while IFS= read -r svc; do
                    ((total_count++))
                    if systemctl is-active --quiet "$svc"; then
                        ((running_count++))
                    fi
                done <<< "$services"
            fi
        done

        if [ "$total_count" -eq 0 ]; then
            echo "NOT_INSTALLED"
        elif [ "$running_count" -eq "$total_count" ]; then
            echo "RUNNING:$running_count/$total_count"
        elif [ "$running_count" -gt 0 ]; then
            echo "PARTIAL:$running_count/$total_count"
        else
            echo "STOPPED:0/$total_count"
        fi
        return
    fi

    # Special handling for Core Node services (auto-discovered across all prefixes)
    if [ "$service" = "core_services" ]; then
        if ! is_service_installed "$service"; then
            echo "NOT_INSTALLED"
            return
        fi

        local total_count=0
        local running_count=0
        local seen=" "
        local prefix svc

        for prefix in "${CORE_SERVICE_PREFIXES[@]}"; do
            local services=$(systemctl list-unit-files --type=service 2>/dev/null | awk '{print $1}' | grep -E "$(core_prefix_pattern "$prefix")" | sed 's/\.service$//')
            if [ -n "$services" ]; then
                while IFS= read -r svc; do
                    [ -z "$svc" ] && continue
                    # Skip the internal app-manager-log-trim housekeeping unit (timer-driven).
                    [ "$svc" = "app-manager-log-trim" ] && continue
                    case "$seen" in *" $svc "*) continue ;; esac
                    seen="$seen$svc "
                    ((total_count++))
                    if systemctl is-active --quiet "$svc"; then
                        ((running_count++))
                    fi
                done <<< "$services"
            fi
        done

        if [ "$total_count" -eq 0 ]; then
            echo "NOT_INSTALLED"
        elif [ "$running_count" -eq "$total_count" ]; then
            echo "RUNNING:$running_count/$total_count"
        elif [ "$running_count" -gt 0 ]; then
            echo "PARTIAL:$running_count/$total_count"
        else
            echo "STOPPED:0/$total_count"
        fi
        return
    fi

    if ! is_service_installed "$service"; then
        echo "NOT_INSTALLED"
        return
    fi

    # Special handling for Laravel Octane (canonical: ncore-laravel-main; legacy: app-manager-laravel*, octane-*)
    if [ "$service" = "laravel" ]; then
        local total_count=$(systemctl list-units --type=service --all 2>/dev/null | grep -cE "(ncore-laravel-main|app-manager-laravel|octane-).*\.service" || echo "0")
        local running_count=$(systemctl list-units --type=service --state=active 2>/dev/null | grep -cE "(ncore-laravel-main|app-manager-laravel|octane-).*\.service" || echo "0")

        # Clean up: ensure single line numeric value
        total_count=$(printf "%s" "$total_count" | tr -cd '0-9' | head -c 10)
        running_count=$(printf "%s" "$running_count" | tr -cd '0-9' | head -c 10)

        # Default to 0 if empty
        total_count=${total_count:-0}
        running_count=${running_count:-0}

        if [ "$total_count" -eq 0 ]; then
            echo "NOT_INSTALLED"
        elif [ "$running_count" -eq "$total_count" ]; then
            echo "RUNNING:$running_count/$total_count"
        elif [ "$running_count" -gt 0 ]; then
            echo "PARTIAL:$running_count/$total_count"
        else
            echo "STOPPED:0/$total_count"
        fi
        return
    fi

    if systemctl is-active --quiet "$systemd_name"; then
        echo "RUNNING"
    else
        if systemctl is-enabled --quiet "$systemd_name" 2>/dev/null; then
            echo "STOPPED_ENABLED"
        else
            echo "STOPPED_DISABLED"
        fi
    fi
}

# Function to print colored status
print_status() {
    local service="$1"
    local status=$(get_service_status "$service")

    # Check for Octane-specific status formats (RUNNING:x/y, PARTIAL:x/y, STOPPED:x/y)
    if [[ "$status" =~ ^RUNNING:([0-9]+)/([0-9]+)$ ]]; then
        echo -e "${GREEN}[RUNNING: ${BASH_REMATCH[1]}/${BASH_REMATCH[2]} services]${NC}"
    elif [[ "$status" =~ ^PARTIAL:([0-9]+)/([0-9]+)$ ]]; then
        echo -e "${YELLOW}[PARTIAL: ${BASH_REMATCH[1]}/${BASH_REMATCH[2]} running]${NC}"
    elif [[ "$status" =~ ^STOPPED:([0-9]+)/([0-9]+)$ ]]; then
        echo -e "${YELLOW}[STOPPED: ${BASH_REMATCH[2]} services]${NC}"
    else
        case "$status" in
            "RUNNING")
                echo -e "${GREEN}[RUNNING]${NC}"
                ;;
            "STOPPED_ENABLED")
                echo -e "${YELLOW}[STOPPED - Auto-start ENABLED]${NC}"
                ;;
            "STOPPED_DISABLED")
                echo -e "${YELLOW}[STOPPED - Auto-start DISABLED]${NC}"
                ;;
            "NOT_INSTALLED")
                echo -e "${RED}[NOT INSTALLED]${NC}"
                ;;
            *)
                echo -e "${RED}[UNKNOWN]${NC}"
                ;;
        esac
    fi
}

# Function to start service
start_service() {
    local service="$1"
    local systemd_name="${SERVICE_SYSTEMD[$service]}"
    local service_name="${SERVICE_NAME[$service]}"

    echo ""
    echo "================================================"
    echo "Starting $service_name..."
    echo "================================================"

    if ! is_service_installed "$service"; then
        echo -e "${RED}Error: $service_name is not installed${NC}"
        return 1
    fi

    # Special handling for Laravel Octane (multiple services)
    if [ "$service" = "laravel" ]; then
        local octane_services=$(systemctl list-units --type=service --all | grep -E "(ncore-laravel-main|app-manager-laravel|octane-).*.service" | awk '{print $1}' | sed 's/.service$//')
        local success_count=0
        local fail_count=0

        for octane_service in $octane_services; do
            if systemctl is-active --quiet "$octane_service"; then
                echo -e "${YELLOW}$octane_service is already running${NC}"
                ((success_count++))
            else
                if $USE_SUDO systemctl start "$octane_service"; then
                    echo -e "${GREEN}Started $octane_service${NC}"
                    $USE_SUDO systemctl enable "$octane_service" 2>/dev/null
                    ((success_count++))
                else
                    echo -e "${RED}Failed to start $octane_service${NC}"
                    ((fail_count++))
                fi
            fi
        done

        echo ""
        echo "Summary: $success_count started, $fail_count failed"
        [ $fail_count -eq 0 ] && return 0 || return 1
    fi

    if systemctl is-active --quiet "$systemd_name"; then
        echo -e "${YELLOW}$service_name is already running${NC}"
        return 0
    fi

    if $USE_SUDO systemctl start "$systemd_name"; then
        echo -e "${GREEN}$service_name started successfully${NC}"

        # Enable auto-start
        if ! systemctl is-enabled --quiet "$systemd_name" 2>/dev/null; then
            echo "Enabling auto-start for $service_name..."
            $USE_SUDO systemctl enable "$systemd_name"
        fi

        # Show status
        echo ""
        echo "Service status:"
        systemctl status "$systemd_name" --no-pager --lines=10
        return 0
    else
        echo -e "${RED}Failed to start $service_name${NC}"
        systemctl status "$systemd_name" --no-pager
        return 1
    fi
}

# Function to stop service
stop_service() {
    local service="$1"
    local systemd_name="${SERVICE_SYSTEMD[$service]}"
    local service_name="${SERVICE_NAME[$service]}"

    echo ""
    echo "================================================"
    echo "Stopping $service_name..."
    echo "================================================"

    if ! is_service_installed "$service"; then
        echo -e "${RED}Error: $service_name is not installed${NC}"
        return 1
    fi

    # Special handling for Laravel Octane (multiple services)
    if [ "$service" = "laravel" ]; then
        local octane_services=$(systemctl list-units --type=service --all | grep -E "(ncore-laravel-main|app-manager-laravel|octane-).*.service" | awk '{print $1}' | sed 's/.service$//')
        local success_count=0
        local fail_count=0

        for octane_service in $octane_services; do
            if ! systemctl is-active --quiet "$octane_service"; then
                echo -e "${YELLOW}$octane_service is not running${NC}"
                ((success_count++))
            else
                if $USE_SUDO systemctl stop "$octane_service"; then
                    echo -e "${GREEN}Stopped $octane_service${NC}"
                    ((success_count++))
                else
                    echo -e "${RED}Failed to stop $octane_service${NC}"
                    ((fail_count++))
                fi
            fi
        done

        echo ""
        echo "Summary: $success_count stopped, $fail_count failed"
        [ $fail_count -eq 0 ] && return 0 || return 1
    fi

    if ! systemctl is-active --quiet "$systemd_name"; then
        echo -e "${YELLOW}$service_name is not running${NC}"
        return 0
    fi

    if $USE_SUDO systemctl stop "$systemd_name"; then
        echo -e "${GREEN}$service_name stopped successfully${NC}"
        return 0
    else
        echo -e "${RED}Failed to stop $service_name${NC}"
        return 1
    fi
}

# Function to restart service
restart_service() {
    local service="$1"
    local systemd_name="${SERVICE_SYSTEMD[$service]}"
    local service_name="${SERVICE_NAME[$service]}"

    echo ""
    echo "================================================"
    echo "Restarting $service_name..."
    echo "================================================"

    if ! is_service_installed "$service"; then
        echo -e "${RED}Error: $service_name is not installed${NC}"
        return 1
    fi

    # Special handling for Laravel Octane (multiple services)
    if [ "$service" = "laravel" ]; then
        local octane_services=$(systemctl list-units --type=service --all | grep -E "(ncore-laravel-main|app-manager-laravel|octane-).*.service" | awk '{print $1}' | sed 's/.service$//')
        local success_count=0
        local fail_count=0

        for octane_service in $octane_services; do
            if $USE_SUDO systemctl restart "$octane_service"; then
                echo -e "${GREEN}Restarted $octane_service${NC}"
                ((success_count++))
            else
                echo -e "${RED}Failed to restart $octane_service${NC}"
                ((fail_count++))
            fi
        done

        echo ""
        echo "Summary: $success_count restarted, $fail_count failed"
        [ $fail_count -eq 0 ] && return 0 || return 1
    fi

    if $USE_SUDO systemctl restart "$systemd_name"; then
        echo -e "${GREEN}$service_name restarted successfully${NC}"

        # Show status
        echo ""
        echo "Service status:"
        systemctl status "$systemd_name" --no-pager --lines=10
        return 0
    else
        echo -e "${RED}Failed to restart $service_name${NC}"
        systemctl status "$systemd_name" --no-pager
        return 1
    fi
}

# Function to show service status
show_service_status() {
    local service="$1"
    local systemd_name="${SERVICE_SYSTEMD[$service]}"
    local service_name="${SERVICE_NAME[$service]}"

    echo ""
    echo "================================================"
    echo "$service_name Status"
    echo "================================================"

    if ! is_service_installed "$service"; then
        echo -e "${RED}$service_name is not installed${NC}"
        return 1
    fi

    systemctl status "$systemd_name" --no-pager
}

# Function to show service logs
show_service_logs() {
    local service="$1"
    local systemd_name="${SERVICE_SYSTEMD[$service]}"
    local service_name="${SERVICE_NAME[$service]}"

    echo ""
    echo "================================================"
    echo "$service_name Logs"
    echo "================================================"

    if ! is_service_installed "$service"; then
        echo -e "${RED}$service_name is not installed${NC}"
        return 1
    fi

    # Special handling for Laravel Octane (multiple services)
    if [ "$service" = "laravel" ]; then
        echo ""
        echo "Choose log source:"
        echo "1. Systemd Journal (All Laravel services)"
        echo "2. Laravel Log File (storage/logs/swoole_http.log)"
        echo "3. Octane State File (storage/logs/octane-server-state.json)"
        echo "0. Back"
        echo ""
        read -p "Choose an option: " log_choice

        case "$log_choice" in
            1)
                echo ""
                echo -e "${CYAN}Recent logs from Laravel services (last 100 lines):${NC}"
                echo "================================================"
                journalctl -u 'ncore-laravel-main' -u 'app-manager-laravel*' -u 'octane-*' -n 100 --no-pager | tail -50
                echo ""
                echo -e "${YELLOW}Tip: Use 'journalctl -u ncore-laravel-main -f' to follow logs in real-time${NC}"
                ;;
            2)
                local swoole_log="$LARAVEL_DIR/storage/logs/swoole_http.log"
                if [ -f "$swoole_log" ]; then
                    echo ""
                    echo -e "${CYAN}Swoole HTTP Log (last 50 lines):${NC}"
                    echo "================================================"
                    tail -50 "$swoole_log"
                    echo ""
                    echo -e "${YELLOW}Full log: $swoole_log${NC}"
                else
                    echo -e "${RED}Swoole log file not found: $swoole_log${NC}"
                fi
                ;;
            3)
                local state_file="$LARAVEL_DIR/storage/logs/octane-server-state.json"
                if [ -f "$state_file" ]; then
                    echo ""
                    echo -e "${CYAN}Octane Server State:${NC}"
                    echo "================================================"
                    cat "$state_file" | python3 -m json.tool 2>/dev/null || cat "$state_file"
                    echo ""
                else
                    echo -e "${RED}State file not found: $state_file${NC}"
                fi
                ;;
            0)
                return 0
                ;;
            *)
                echo -e "${RED}Invalid option${NC}"
                ;;
        esac
        return 0
    fi

    # For other services, show systemd journal
    echo ""
    echo -e "${CYAN}Recent logs (last 50 lines):${NC}"
    echo "================================================"
    journalctl -u "$systemd_name" -n 50 --no-pager
    echo ""
    echo -e "${YELLOW}Tip: Use 'journalctl -u $systemd_name -f' to follow logs in real-time${NC}"
}

# Function to enable/disable auto-start
toggle_autostart() {
    local service="$1"
    local systemd_name="${SERVICE_SYSTEMD[$service]}"
    local service_name="${SERVICE_NAME[$service]}"

    echo ""
    echo "================================================"
    echo "Toggle Auto-start for $service_name"
    echo "================================================"

    if ! is_service_installed "$service"; then
        echo -e "${RED}Error: $service_name is not installed${NC}"
        return 1
    fi

    if systemctl is-enabled --quiet "$systemd_name" 2>/dev/null; then
        echo "Auto-start is currently: ENABLED"
        echo ""
        read -p "Do you want to DISABLE auto-start? (y/N): " confirm
        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            $USE_SUDO systemctl disable "$systemd_name"
            echo -e "${GREEN}Auto-start disabled${NC}"
        fi
    else
        echo "Auto-start is currently: DISABLED"
        echo ""
        read -p "Do you want to ENABLE auto-start? (y/N): " confirm
        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            $USE_SUDO systemctl enable "$systemd_name"
            echo -e "${GREEN}Auto-start enabled${NC}"
        fi
    fi
}

# Function to reinstall service
reinstall_service() {
    local service="$1"
    local install_script="${SERVICE_INSTALL_SCRIPT[$service]}"
    local service_name="${SERVICE_NAME[$service]}"

    # Special handling for Laravel Octane: the canonical installer is the app's own
    # start.sh, which runs the full prerequisite setup and registers the
    # ncore-laravel-main systemd unit (--service). This keeps the menu aligned with
    # poly_apps/laravel_main/scripts/start.sh instead of a separate install path.
    if [ "$service" = "laravel" ]; then
        echo ""
        echo "================================================"
        echo "Install / Reinstall Laravel Octane (ncore-laravel-main)"
        echo "================================================"
        echo ""
        echo "Canonical installer:"
        echo "  $LARAVEL_START_SCRIPT --service"
        echo ""
        echo "This runs the full prerequisite setup (php/composer/pg/swoole/migrate/"
        echo "sys:init) and registers/restarts the ncore-laravel-main systemd service."
        echo ""
        if [ ! -f "$LARAVEL_START_SCRIPT" ]; then
            echo -e "${RED}Error: start.sh not found: $LARAVEL_START_SCRIPT${NC}"
            return 1
        fi
        read -p "Run it now? (Y/n): " confirm
        if [[ "$confirm" =~ ^[Nn]$ ]]; then
            echo "Cancelled"
            return 0
        fi
        echo ""
        echo "Executing: bash $LARAVEL_START_SCRIPT --service"
        echo ""
        bash "$LARAVEL_START_SCRIPT" --service
        return 0
    fi

    # Special handling for Core Node services: no single install target; open the
    # auto-discovery manager (it lists every ncore-*/pycore*/codesync/octane-*/
    # app-manager-* unit and how to install the ones that are missing).
    if [ "$service" = "core_services" ]; then
        launch_advanced_manager "core_services"
        return 0
    fi

    # Special handling for Unified Apps (launches unified manager)
    if [ "$service" = "unified_apps" ]; then
        echo ""
        echo "================================================"
        echo "Launching Unified App Manager"
        echo "================================================"
        echo ""
        echo -e "${GREEN}Opening Unified App Manager to create/reinstall services${NC}"
        echo ""
        read -p "Press Enter to continue..."

        local unified_manager="$PARENT_DIR_LEVEL_3/scripts/unified_manager/unified_manager.sh"
        if [ -f "$unified_manager" ]; then
            bash "$unified_manager"
        else
            echo -e "${RED}Error: Unified Manager not found at $unified_manager${NC}"
            return 1
        fi
        return 0
    fi

    echo ""
    echo "================================================"

    # Check if service is already installed
    if is_service_installed "$service"; then
        echo "Reinstalling $service_name"
        echo "================================================"
        echo ""
        echo -e "${YELLOW}$service_name is already installed${NC}"
        echo "This will:"
        echo "  1. Run the installation script: $install_script"
        echo "  2. Reconfigure the service"
        echo "  3. Update to latest version if available"
        echo ""
        echo "Note: Installation script will handle reinstall confirmation"
        echo ""
        read -p "Do you want to reinstall? (Y/n): " confirm

        # Default to Yes (empty input or Y/y)
        if [[ "$confirm" =~ ^[Nn]$ ]]; then
            echo "Reinstallation cancelled"
            return 0
        fi
    else
        echo "Installing $service_name"
        echo "================================================"
        echo ""
        echo -e "${GREEN}Installing $service_name for the first time${NC}"
        echo "This will:"
        echo "  1. Run the installation script: $install_script"
        echo "  2. Configure the service"
        echo "  3. Set up required dependencies"
        echo ""
        read -p "Do you want to install? (Y/n): " confirm

        # Default to Yes (empty input or Y/y)
        if [[ "$confirm" =~ ^[Nn]$ ]]; then
            echo "Installation cancelled"
            return 0
        fi
    fi

    local script_path="$INSTALL_SHELLS_DIR/$install_script"
    if [ ! -f "$script_path" ]; then
        echo -e "${RED}Error: Installation script not found: $script_path${NC}"
        return 1
    fi

    echo ""
    echo "Executing: bash $script_path"
    echo ""

    if bash "$script_path"; then
        echo ""
        if is_service_installed "$service"; then
            echo -e "${GREEN}$service_name installation/reinstallation completed successfully${NC}"
        else
            echo -e "${YELLOW}$service_name script execution completed${NC}"
            echo -e "${YELLOW}Service may need manual configuration${NC}"
        fi
        return 0
    else
        echo ""
        echo -e "${RED}$service_name installation/reinstallation failed${NC}"
        return 1
    fi
}

# Function to check if service has advanced manager
has_advanced_manager() {
    local service="$1"
    local manager_script="${SERVICE_MANAGER_SCRIPT[$service]}"
    
    if [ -n "$manager_script" ] && [ -x "$manager_script" ]; then
        return 0
    fi
    return 1
}

# Function to launch advanced manager
launch_advanced_manager() {
    local service="$1"
    local manager_script="${SERVICE_MANAGER_SCRIPT[$service]}"
    local service_name="${SERVICE_NAME[$service]}"
    
    if [ ! -x "$manager_script" ]; then
        echo -e "${RED}Error: Manager script not found or not executable: $manager_script${NC}"
        read -p "Press Enter to continue..."
        return 1
    fi
    
    echo ""
    echo "Launching advanced manager for $service_name..."
    bash "$manager_script"
}

# Function to manage specific service
manage_service() {
    local service="$1"
    local service_name="${SERVICE_NAME[$service]}"
    
    # Check if service has advanced manager script
    if has_advanced_manager "$service"; then
        launch_advanced_manager "$service"
        return
    fi

    # Standard management menu for services without advanced manager
    while true; do
        clear
        echo "================================================"
        echo "$service_name Service Management"
        echo "================================================"
        echo ""
        echo -n "Status: "
        print_status "$service"
        echo ""
        echo "1. Start Service"
        echo "2. Stop Service"
        echo "3. Restart Service"
        echo "4. Show Status"
        echo "5. Toggle Auto-start"
        echo "6. Reinstall Service"
        echo ""
        echo "0. Back to Main Menu"
        echo ""
        read -p "Choose an option: " choice

        case "$choice" in
            1)
                start_service "$service"
                ;;
            2)
                stop_service "$service"
                ;;
            3)
                restart_service "$service"
                ;;
            4)
                show_service_status "$service"
                ;;
            5)
                toggle_autostart "$service"
                ;;
            6)
                reinstall_service "$service"
                ;;
            0)
                return 0
                ;;
            *)
                echo -e "${RED}Invalid option${NC}"
                ;;
        esac

        echo ""
        read -p "Press Enter to continue..."
    done
}

# Function to show all services status
show_all_services_status() {
    echo ""
    echo "================================================"
    echo "All Services Status"
    echo "================================================"
    echo ""

    for service in "${SERVICES[@]}"; do
        local service_name="${SERVICE_NAME[$service]}"
        printf "%-15s : " "$service_name"
        print_status "$service"
    done
}

# Function to start all services
start_all_services() {
    echo ""
    echo "================================================"
    echo "Starting All Services"
    echo "================================================"
    echo ""
    read -p "Do you want to start all installed services? (y/N): " confirm

    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Operation cancelled"
        return 0
    fi

    for service in "${SERVICES[@]}"; do
        if is_service_installed "$service"; then
            start_service "$service"
            echo ""
        fi
    done

    echo ""
    echo -e "${GREEN}All services started${NC}"
}

# Function to stop all services
stop_all_services() {
    echo ""
    echo "================================================"
    echo "Stopping All Services"
    echo "================================================"
    echo ""
    read -p "Do you want to stop all running services? (y/N): " confirm

    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Operation cancelled"
        return 0
    fi

    for service in "${SERVICES[@]}"; do
        if is_service_installed "$service"; then
            stop_service "$service"
            echo ""
        fi
    done

    echo ""
    echo -e "${GREEN}All services stopped${NC}"
}

# Main menu
show_main_menu() {
    while true; do
        clear
        echo "================================================"
        echo "Service Manager - Quick Actions"
        echo "================================================"
        echo ""

        local index=1
        for service in "${SERVICES[@]}"; do
            local service_name="${SERVICE_NAME[$service]}"
            local status=$(get_service_status "$service")
            local manager_script="${SERVICE_MANAGER_SCRIPT[$service]}"
            local systemd_name="${SERVICE_SYSTEMD[$service]}"

            # Format: [#] Service Name    [STATUS] [Actions]
            printf "${CYAN}%d.${NC} %-15s " "$index" "$service_name"
            print_status "$service"

            # Aggregate entries (Unified Apps / Core Node Services) have no single
            # systemd unit but own an advanced manager that scans many units. The
            # generic per-unit keys (s/x/r/l) cannot act on an empty unit name, so
            # offer only Manage (its sub-menu handles per-unit + bulk actions).
            local is_aggregate=false
            if [ -z "$systemd_name" ] && has_advanced_manager "$service"; then
                is_aggregate=true
            fi

            # Show quick action hints
            if [ "$is_aggregate" = true ]; then
                if [ "$status" = "NOT_INSTALLED" ]; then
                    echo -e "  ${YELLOW}${index}m${NC} Manage (none discovered yet)"
                else
                    echo -e "  ${YELLOW}${index}m${NC} Manage (per-unit + bulk actions inside)"
                fi
            elif [ "$status" = "NOT_INSTALLED" ]; then
                echo -e "  ${YELLOW}${index}i${NC} Install"
            else
                # Check if service is running (handles both "RUNNING" and "RUNNING:x/y" formats)
                if [[ "$status" =~ ^RUNNING ]] || [[ "$status" =~ ^PARTIAL ]]; then
                    echo -e "  ${YELLOW}${index}x${NC} Stop  ${YELLOW}${index}r${NC} Restart  ${YELLOW}${index}i${NC} Reinstall  ${YELLOW}${index}l${NC} Logs  ${YELLOW}${index}m${NC} Manage"
                else
                    echo -e "  ${YELLOW}${index}s${NC} Start  ${YELLOW}${index}r${NC} Restart  ${YELLOW}${index}i${NC} Reinstall  ${YELLOW}${index}l${NC} Logs  ${YELLOW}${index}m${NC} Manage"
                fi
            fi

            # Show systemd service name
            if [ -n "$systemd_name" ]; then
                echo -e "   ${BLUE}Service: $systemd_name${NC}"
            fi

            # Show advanced manager indicator with path
            if has_advanced_manager "$service"; then
                echo -e "   ${BLUE}[Advanced Manager: ${index}m]${NC}"
                echo -e "   ${BLUE}Manager: $manager_script${NC}"
            fi

            ((index++))
        done

        echo ""
        echo "================================================"
        echo -e "Enter: ${YELLOW}<number><action>${NC} (e.g., ${YELLOW}1s${NC}=Start, ${YELLOW}5x${NC}=Stop, ${YELLOW}3i${NC}=Install/Reinstall, ${YELLOW}8l${NC}=Logs, ${YELLOW}7m${NC}=Manage) | ${YELLOW}0${NC}=Exit"
        echo "================================================"
        echo ""
        read -p "Command: " choice

        # Parse command format: <number><action>
        if [[ "$choice" =~ ^([0-9]+)([sxriml])$ ]]; then
            local service_num="${BASH_REMATCH[1]}"
            local action="${BASH_REMATCH[2]}"
            # Force base-10: a leading zero (e.g. "08") would be parsed as octal and abort.
            local service_index=$((10#$service_num - 1))

            if [ "$service_index" -ge 0 ] && [ "$service_index" -lt ${#SERVICES[@]} ]; then
                local service="${SERVICES[$service_index]}"

                case "$action" in
                    s)
                        start_service "$service"
                        read -p "Press Enter to continue..."
                        ;;
                    x)
                        stop_service "$service"
                        read -p "Press Enter to continue..."
                        ;;
                    r)
                        restart_service "$service"
                        read -p "Press Enter to continue..."
                        ;;
                    i)
                        reinstall_service "$service"
                        read -p "Press Enter to continue..."
                        ;;
                    l)
                        show_service_logs "$service"
                        read -p "Press Enter to continue..."
                        ;;
                    m)
                        manage_service "$service"
                        ;;
                esac
            else
                echo -e "${RED}Invalid service number${NC}"
                read -p "Press Enter to continue..."
            fi
        else
            # Handle special commands and bulk operations
            case "$choice" in
                ss|SS)
                    start_all_services
                    read -p "Press Enter to continue..."
                    ;;
                xx|XX)
                    stop_all_services
                    read -p "Press Enter to continue..."
                    ;;
                rr|RR)
                    echo ""
                    echo "================================================"
                    echo "Restarting All Services"
                    echo "================================================"
                    echo ""
                    read -p "Do you want to restart all running services? (y/N): " confirm
                    if [[ "$confirm" =~ ^[Yy]$ ]]; then
                        for service in "${SERVICES[@]}"; do
                            if is_service_installed "$service"; then
                                restart_service "$service"
                                echo ""
                            fi
                        done
                        echo -e "${GREEN}All services restarted${NC}"
                    else
                        echo "Operation cancelled"
                    fi
                    read -p "Press Enter to continue..."
                    ;;
                aa|AA)
                    show_all_services_status
                    read -p "Press Enter to continue..."
                    ;;
                0)
                    echo "Exiting Service Manager..."
                    exit 0
                    ;;
                *)
                    echo -e "${RED}Invalid command. Use format: <number><action> (e.g., 1s, 5x, 7m)${NC}"
                    read -p "Press Enter to continue..."
                    ;;
            esac
        fi
    done
}

# Main execution
show_main_menu
