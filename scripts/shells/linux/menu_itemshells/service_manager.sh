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
SERVICE_INSTALL_SCRIPT["redis"]="45_install_redis.sh"
SERVICE_MANAGER_SCRIPT["redis"]="$SERVER_MANAGER_DIR/redis_manager.sh"

SERVICE_NAME["postgresql"]="PostgreSQL"
SERVICE_SYSTEMD["postgresql"]="postgresql"
SERVICE_INSTALL_SCRIPT["postgresql"]="46_install_postgresql.sh"
SERVICE_MANAGER_SCRIPT["postgresql"]="$SERVER_MANAGER_DIR/postgresql_manager.sh"

SERVICE_NAME["docker"]="Docker"
SERVICE_SYSTEMD["docker"]="docker"
SERVICE_INSTALL_SCRIPT["docker"]="47_install_docker.sh"
SERVICE_MANAGER_SCRIPT["docker"]="$SERVER_MANAGER_DIR/docker_manager.sh"

SERVICE_NAME["mysql"]="MySQL"
SERVICE_SYSTEMD["mysql"]="mariadb"
SERVICE_INSTALL_SCRIPT["mysql"]="48_install_mysql.sh"
SERVICE_MANAGER_SCRIPT["mysql"]="$SERVER_MANAGER_DIR/mysql_manager.sh"

SERVICE_NAME["nginx"]="Nginx"
SERVICE_SYSTEMD["nginx"]="nginx"
SERVICE_INSTALL_SCRIPT["nginx"]="25_install_nginx.sh"
SERVICE_MANAGER_SCRIPT["nginx"]="$SERVER_MANAGER_DIR/nginx_manager.sh"

SERVICE_NAME["ssh"]="SSH Server"
SERVICE_SYSTEMD["ssh"]="ssh"
SERVICE_INSTALL_SCRIPT["ssh"]="17_setup_ssh_remote.sh"
SERVICE_MANAGER_SCRIPT["ssh"]="$SERVER_MANAGER_DIR/ssh_manager.sh"

SERVICE_NAME["pycore"]="Pycore HTTP"
SERVICE_SYSTEMD["pycore"]="pycore-module-caller"
SERVICE_INSTALL_SCRIPT["pycore"]="150_install_pycore_http_service.sh"
SERVICE_MANAGER_SCRIPT["pycore"]="$SERVER_MANAGER_DIR/pycore_manager.sh"

SERVICE_NAME["laravel"]="Laravel Octane"
SERVICE_SYSTEMD["laravel"]="laravel-octane"
SERVICE_INSTALL_SCRIPT["laravel"]="133_setup_api_domains.sh"
SERVICE_MANAGER_SCRIPT["laravel"]="$SERVER_MANAGER_DIR/laravel_octane_manager.sh"

SERVICE_NAME["unified_apps"]="Unified Apps"
SERVICE_SYSTEMD["unified_apps"]=""
SERVICE_INSTALL_SCRIPT["unified_apps"]=""
SERVICE_MANAGER_SCRIPT["unified_apps"]="$SCRIPT_CURRENT_DIR/unified_app_service_manager.sh"

# Service list
SERVICES=("redis" "postgresql" "docker" "mysql" "nginx" "ssh" "pycore" "laravel" "unified_apps")

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

    # Special handling for Laravel Octane (path-based services with pattern: octane-*)
    if [ "$service" = "laravel" ]; then
        if systemctl list-units --type=service --all | grep -q "octane-.*\.service"; then
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

    if ! is_service_installed "$service"; then
        echo "NOT_INSTALLED"
        return
    fi

    # Special handling for Laravel Octane (multiple services)
    if [ "$service" = "laravel" ]; then
        local total_count=$(systemctl list-units --type=service --all 2>/dev/null | grep -c "octane-.*\.service" || echo "0")
        local running_count=$(systemctl list-units --type=service --state=active 2>/dev/null | grep -c "octane-.*\.service" || echo "0")

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
        local octane_services=$(systemctl list-units --type=service --all | grep "octane-.*\.service" | awk '{print $1}' | sed 's/.service$//')
        local success_count=0
        local fail_count=0

        for octane_service in $octane_services; do
            if systemctl is-active --quiet "$octane_service"; then
                echo -e "${YELLOW}$octane_service is already running${NC}"
                ((success_count++))
            else
                if $USE_SUDO systemctl start "$octane_service"; then
                    echo -e "${GREEN}ï¿?Started $octane_service${NC}"
                    $USE_SUDO systemctl enable "$octane_service" 2>/dev/null
                    ((success_count++))
                else
                    echo -e "${RED}ï¿?Failed to start $octane_service${NC}"
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
        local octane_services=$(systemctl list-units --type=service --all | grep "octane-.*\.service" | awk '{print $1}' | sed 's/.service$//')
        local success_count=0
        local fail_count=0

        for octane_service in $octane_services; do
            if ! systemctl is-active --quiet "$octane_service"; then
                echo -e "${YELLOW}$octane_service is not running${NC}"
                ((success_count++))
            else
                if $USE_SUDO systemctl stop "$octane_service"; then
                    echo -e "${GREEN}ï¿?Stopped $octane_service${NC}"
                    ((success_count++))
                else
                    echo -e "${RED}ï¿?Failed to stop $octane_service${NC}"
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
        local octane_services=$(systemctl list-units --type=service --all | grep "octane-.*\.service" | awk '{print $1}' | sed 's/.service$//')
        local success_count=0
        local fail_count=0

        for octane_service in $octane_services; do
            if $USE_SUDO systemctl restart "$octane_service"; then
                echo -e "${GREEN}ï¿?Restarted $octane_service${NC}"
                ((success_count++))
            else
                echo -e "${RED}ï¿?Failed to restart $octane_service${NC}"
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
        echo "1. Systemd Journal (All Octane services)"
        echo "2. Laravel Log File (storage/logs/swoole_http.log)"
        echo "3. Octane State File (storage/logs/octane-server-state.json)"
        echo "0. Back"
        echo ""
        read -p "Choose an option: " log_choice

        case "$log_choice" in
            1)
                echo ""
                echo -e "${CYAN}Recent logs from all Octane services (last 100 lines):${NC}"
                echo "================================================"
                journalctl -u 'octane-*' -n 100 --no-pager | tail -50
                echo ""
                echo -e "${YELLOW}Tip: Use 'journalctl -u octane-poly-9000 -f' to follow logs in real-time${NC}"
                ;;
            2)
                local swoole_log="/www/programing/core_node/poly_apps/laravel_main/storage/logs/swoole_http.log"
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
                local state_file="/www/programing/core_node/poly_apps/laravel_main/storage/logs/octane-server-state.json"
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

            # Show quick action hints
            if [ "$status" = "NOT_INSTALLED" ]; then
                echo -e "  ${YELLOW}ï¿?${index}i${NC} Install"
            else
                # Check if service is running (handles both "RUNNING" and "RUNNING:x/y" formats)
                if [[ "$status" =~ ^RUNNING ]] || [[ "$status" =~ ^PARTIAL ]]; then
<<<<<<< HEAD
                    echo -e "  ${YELLOW}ï¿½?${index}x${NC} Stop  ${YELLOW}${index}r${NC} Restart  ${YELLOW}${index}l${NC} Logs  ${YELLOW}${index}m${NC} Manage"
                else
                    echo -e "  ${YELLOW}ï¿½?${index}s${NC} Start  ${YELLOW}${index}r${NC} Restart  ${YELLOW}${index}l${NC} Logs  ${YELLOW}${index}m${NC} Manage"
=======
                    echo -e "  ${YELLOW}ï¿?${index}x${NC} Stop  ${YELLOW}${index}r${NC} Restart  ${YELLOW}${index}i${NC} Reinstall  ${YELLOW}${index}l${NC} Logs  ${YELLOW}${index}m${NC} Manage"
                else
                    echo -e "  ${YELLOW}ï¿?${index}s${NC} Start  ${YELLOW}${index}r${NC} Restart  ${YELLOW}${index}i${NC} Reinstall  ${YELLOW}${index}l${NC} Logs  ${YELLOW}${index}m${NC} Manage"
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
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
<<<<<<< HEAD
        echo -e "Enter: ${YELLOW}<number><action>${NC} (e.g., ${YELLOW}1s${NC}=Start, ${YELLOW}5x${NC}=Stop, ${YELLOW}8l${NC}=Logs, ${YELLOW}7m${NC}=Manage) | ${YELLOW}0${NC}=Exit"
=======
        echo -e "Enter: ${YELLOW}<number><action>${NC} (e.g., ${YELLOW}1s${NC}=Start, ${YELLOW}5x${NC}=Stop, ${YELLOW}3i${NC}=Install/Reinstall, ${YELLOW}8l${NC}=Logs, ${YELLOW}7m${NC}=Manage) | ${YELLOW}0${NC}=Exit"
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
        echo "================================================"
        echo ""
        read -p "Command: " choice

        # Parse command format: <number><action>
        if [[ "$choice" =~ ^([0-9]+)([sxriml])$ ]]; then
            local service_num="${BASH_REMATCH[1]}"
            local action="${BASH_REMATCH[2]}"
            local service_index=$((service_num - 1))

            if [ $service_index -ge 0 ] && [ $service_index -lt ${#SERVICES[@]} ]; then
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
