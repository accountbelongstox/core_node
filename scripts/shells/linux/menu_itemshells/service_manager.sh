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

SERVICE_NAME["redis"]="Redis"
SERVICE_SYSTEMD["redis"]="redis-server"
SERVICE_INSTALL_SCRIPT["redis"]="45_install_redis.sh"

SERVICE_NAME["postgresql"]="PostgreSQL"
SERVICE_SYSTEMD["postgresql"]="postgresql"
SERVICE_INSTALL_SCRIPT["postgresql"]="46_install_postgresql.sh"

SERVICE_NAME["docker"]="Docker"
SERVICE_SYSTEMD["docker"]="docker"
SERVICE_INSTALL_SCRIPT["docker"]="47_install_docker.sh"

SERVICE_NAME["mysql"]="MySQL"
SERVICE_SYSTEMD["mysql"]="mariadb"
SERVICE_INSTALL_SCRIPT["mysql"]="48_install_mysql.sh"

SERVICE_NAME["nginx"]="Nginx"
SERVICE_SYSTEMD["nginx"]="nginx"
SERVICE_INSTALL_SCRIPT["nginx"]="25_install_nginx.sh"

SERVICE_NAME["ssh"]="SSH Server"
SERVICE_SYSTEMD["ssh"]="ssh"
SERVICE_INSTALL_SCRIPT["ssh"]="17_setup_ssh_remote.sh"

# Service list
SERVICES=("redis" "postgresql" "docker" "mysql" "nginx" "ssh")

# Function to check if service is installed
is_service_installed() {
    local service="$1"
    local systemd_name="${SERVICE_SYSTEMD[$service]}"

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

    if ! is_service_installed "$service"; then
        echo "NOT_INSTALLED"
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

    echo ""
    echo "================================================"
    echo "Reinstalling $service_name"
    echo "================================================"
    echo ""
    echo -e "${YELLOW}WARNING: This will reinstall $service_name${NC}"
    echo "This will:"
    echo "  1. Run the installation script: $install_script"
    echo "  2. Reconfigure the service"
    echo "  3. Leave the service stopped and disabled (to save memory)"
    echo ""
    read -p "Do you want to continue? (y/N): " confirm

    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Reinstallation cancelled"
        return 0
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
        echo -e "${GREEN}$service_name reinstallation completed successfully${NC}"
        return 0
    else
        echo ""
        echo -e "${RED}$service_name reinstallation failed${NC}"
        return 1
    fi
}

# Function to manage specific service
manage_service() {
    local service="$1"
    local service_name="${SERVICE_NAME[$service]}"

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
        echo "Service Manager"
        echo "================================================"
        echo ""
        echo "Installed Services:"
        echo ""

        local index=1
        for service in "${SERVICES[@]}"; do
            local service_name="${SERVICE_NAME[$service]}"
            printf "%d. %-15s : " "$index" "$service_name"
            print_status "$service"
            ((index++))
        done

        echo ""
        echo "================================================"
        echo "Bulk Operations:"
        echo "================================================"
        echo ""
        echo "a. Show All Services Status"
        echo "s. Start All Services"
        echo "x. Stop All Services"
        echo ""
        echo "0. Exit"
        echo ""
        read -p "Choose an option: " choice

        case "$choice" in
            [1-6])
                local service_index=$((choice - 1))
                if [ $service_index -lt ${#SERVICES[@]} ]; then
                    manage_service "${SERVICES[$service_index]}"
                else
                    echo -e "${RED}Invalid option${NC}"
                    read -p "Press Enter to continue..."
                fi
                ;;
            a|A)
                show_all_services_status
                echo ""
                read -p "Press Enter to continue..."
                ;;
            s|S)
                start_all_services
                echo ""
                read -p "Press Enter to continue..."
                ;;
            x|X)
                stop_all_services
                echo ""
                read -p "Press Enter to continue..."
                ;;
            0)
                echo "Exiting Service Manager..."
                exit 0
                ;;
            *)
                echo -e "${RED}Invalid option${NC}"
                read -p "Press Enter to continue..."
                ;;
        esac
    done
}

# Main execution
show_main_menu
