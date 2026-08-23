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

# Unified App Service Manager
# Manages services created by unified_manager (app-*, webapp-*, nuxt-*, etc.)

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
PARENT_DIR_LEVEL_3="$(dirname "$PARENT_DIR_LEVEL_2")"
ROOT_DIR="$PARENT_DIR_LEVEL_3"
source "$PARENT_DIR_LEVEL_1/common/arrow_menu.sh"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Service prefixes managed by unified_manager
UNIFIED_PREFIXES=("app-" "webapp-" "nuxt-" "laravel-" "flutter-" "react-" "vue-")

# Detect all services created by unified_manager
detect_unified_services() {
    local services=()

    for prefix in "${UNIFIED_PREFIXES[@]}"; do
        local found_services=$(systemctl list-unit-files --type=service --no-pager --no-legend 2>/dev/null | \
            grep -E "^${prefix}[^[:space:]]+\.service" | \
            awk '{print $1}' | \
            sed 's/.service$//')

        if [ -n "$found_services" ]; then
            while IFS= read -r service; do
                services+=("$service")
            done <<< "$found_services"
        fi
    done

    printf '%s\n' "${services[@]}"
}

# Get service status
get_service_status() {
    local service="$1"

    if ! systemctl list-unit-files "${service}.service" >/dev/null 2>&1; then
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

# Print colored status
print_status() {
    local status="$1"

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
        "NOT_FOUND")
            echo -e "${RED}[NOT FOUND]${NC}"
            ;;
        *)
            echo -e "${RED}[UNKNOWN]${NC}"
            ;;
    esac
}

# Start service
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

    if sudo systemctl start "$service"; then
        echo -e "${GREEN}$service started successfully${NC}"

        if ! systemctl is-enabled --quiet "$service" 2>/dev/null; then
            echo "Enabling auto-start for $service..."
            sudo systemctl enable "$service"
        fi

        echo ""
        echo "Service status:"
        systemctl status "$service" --no-pager --lines=10
        return 0
    else
        echo -e "${RED}Failed to start $service${NC}"
        systemctl status "$service" --no-pager
        return 1
    fi
}

# Stop service
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

    if sudo systemctl stop "$service"; then
        echo -e "${GREEN}$service stopped successfully${NC}"
        return 0
    else
        echo -e "${RED}Failed to stop $service${NC}"
        return 1
    fi
}

# Restart service
restart_service() {
    local service="$1"

    echo ""
    echo "================================================"
    echo "Restarting $service..."
    echo "================================================"

    if sudo systemctl restart "$service"; then
        echo -e "${GREEN}$service restarted successfully${NC}"

        echo ""
        echo "Service status:"
        systemctl status "$service" --no-pager --lines=10
        return 0
    else
        echo -e "${RED}Failed to restart $service${NC}"
        systemctl status "$service" --no-pager
        return 1
    fi
}

# Show service status
show_service_status() {
    local service="$1"

    echo ""
    echo "================================================"
    echo "$service Status"
    echo "================================================"

    systemctl status "$service" --no-pager
}

# Show service logs
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

# Show service configuration
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
        echo -e "${RED}Service file not found: $service_file${NC}"
        return 1
    fi
}

# Toggle auto-start
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
            sudo systemctl disable "$service"
            echo -e "${GREEN}Auto-start disabled${NC}"
        fi
    else
        echo "Auto-start is currently: DISABLED"
        echo ""
        read -p "Do you want to ENABLE auto-start? (y/N): " confirm
        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            sudo systemctl enable "$service"
            echo -e "${GREEN}Auto-start enabled${NC}"
        fi
    fi
}

# Reinstall service (calls unified_manager)
reinstall_service() {
    local service="$1"

    echo ""
    echo "================================================"
    echo "Reinstall $service"
    echo "================================================"
    echo ""
    echo -e "${YELLOW}This will launch Unified App Manager to reinstall the service${NC}"
    echo ""
    read -p "Do you want to continue? (y/N): " confirm

    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Operation cancelled"
        return 0
    fi

    # Launch unified_manager
    local unified_manager="$ROOT_DIR/scripts/unified_manager/unified_manager.sh"
    if [ -f "$unified_manager" ]; then
        bash "$unified_manager"
    else
        echo -e "${RED}Error: Unified Manager not found at $unified_manager${NC}"
        return 1
    fi
}

# Remove service
remove_service() {
    local service="$1"

    echo ""
    echo "================================================"
    echo "Remove $service"
    echo "================================================"
    echo ""
    echo -e "${RED}WARNING: This will permanently remove the service${NC}"
    echo ""
    read -p "Are you sure you want to remove $service? (y/N): " confirm

    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Operation cancelled"
        return 0
    fi

    echo ""
    echo "Stopping service..."
    sudo systemctl stop "$service" 2>/dev/null || true

    echo "Disabling auto-start..."
    sudo systemctl disable "$service" 2>/dev/null || true

    local service_file="/etc/systemd/system/${service}.service"
    if [ -f "$service_file" ]; then
        echo "Removing service file..."
        sudo rm -f "$service_file"
    fi

    # Remove launcher script if exists
    local launcher_script="/var/_core_node/unified_manager/temp_scripts/${service}.sh"
    if [ -f "$launcher_script" ]; then
        echo "Removing launcher script..."
        sudo rm -f "$launcher_script"
        echo -e "${GREEN}Launcher script removed: $launcher_script${NC}"
    fi

    echo "Reloading systemd..."
    sudo systemctl daemon-reload

    echo ""
    echo -e "${GREEN}$service has been removed${NC}"
}

# Manage specific service
manage_service() {
    local service="$1"
    local selected_index=0
    local choice=0
    local menu_items=(
        "Start Service"
        "Stop Service"
        "Restart Service"
        "Show Status"
        "Show Logs"
        "Show Configuration"
        "Toggle Auto-start"
        "Reinstall (via Unified Manager)"
        "Remove Service"
        "Back to Service List"
    )

    while true; do
        arrow_menu_select "$service Management" menu_items "$selected_index" 9
        selected_index="$ARROW_MENU_SELECTED_INDEX"
        if [ "$selected_index" -eq 9 ]; then
            choice=0
        else
            choice=$((selected_index + 1))
        fi

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
                show_service_logs "$service"
                ;;
            6)
                show_service_config "$service"
                ;;
            7)
                toggle_autostart "$service"
                ;;
            8)
                reinstall_service "$service"
                return 0
                ;;
            9)
                remove_service "$service"
                return 0
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

# Main menu
show_main_menu() {
    local services=()
    local menu_items=()
    local service=""
    local status=""
    local selected_index=0

    while true; do
        services=($(detect_unified_services))
        menu_items=()
        for service in "${services[@]}"; do
            status="$(get_service_status "$service")"
            menu_items+=("$service [$status]")
        done
        menu_items+=("Back to Service Manager")

        arrow_menu_select "Unified App Services Manager" menu_items "$selected_index" "${#services[@]}"
        selected_index="$ARROW_MENU_SELECTED_INDEX"
        if [ "$selected_index" -eq "${#services[@]}" ]; then
            echo "Returning to Service Manager..."
            return 0
        fi
        manage_service "${services[$selected_index]}"
    done
}

# Main execution
show_main_menu
