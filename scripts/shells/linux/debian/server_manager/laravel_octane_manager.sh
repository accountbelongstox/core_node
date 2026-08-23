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

# Laravel Octane Advanced Manager
# Interactive menu interface for managing Laravel Octane/Swoole services

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source required files
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/arrow_menu.sh"
source "$PARENT_DIR_LEVEL_2/common/octane_service_manager.sh"
source "$PARENT_DIR_LEVEL_2/common/app_paths.sh"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

show_selected_octane_service_status() {
    local is_active="$(systemctl is-active "$service_name" 2>/dev/null || echo "inactive")"
    local is_enabled="$(systemctl is-enabled "$service_name" 2>/dev/null || echo "disabled")"
    local timer_active="$(systemctl is-active "${service_name}.timer" 2>/dev/null || echo "inactive")"

    if [ "$is_active" = "active" ]; then
        echo -e "Status: ${GREEN}RUNNING${NC}"
    else
        echo -e "Status: ${RED}STOPPED${NC}"
    fi
    echo "Auto-start: $is_enabled"
    echo "48h Timer: $timer_active"
}

# Show all Octane services with detailed status
show_services_overview() {
    clear
    echo "================================================"
    echo "Laravel Octane Services Overview"
    echo "================================================"
    echo ""

    status_all_octane

    echo ""
    read -p "Press Enter to continue..."
}

# Create new Octane service
create_new_service() {
    clear
    echo "================================================"
    echo "Create New Laravel Octane Service"
    echo "================================================"
    echo ""

    read -p "Domain (e.g., api.example.com): " domain
    if [ -z "$domain" ]; then
        echo -e "${RED}Error: Domain is required${NC}"
        read -p "Press Enter to continue..."
        return 1
    fi

    read -p "Port (press Enter for auto-assign): " port
    read -p "Workers (default: 4): " workers
    workers="${workers:-4}"

    read -p "Laravel path (default: $LARAVEL_MAIN_PATH): " laravel_path
    laravel_path="${laravel_path:-$LARAVEL_MAIN_PATH}"

    read -p "Service user (default: root): " service_user
    service_user="${service_user:-root}"

    read -p "Service group (default: root): " service_group
    service_group="${service_group:-root}"

    echo ""
    echo -e "${YELLOW}Creating service with:${NC}"
    echo "  Domain: $domain"
    echo "  Port: ${port:-auto-assign}"
    echo "  Workers: $workers"
    echo "  Laravel Path: $laravel_path"
    echo "  User: $service_user:$service_group"
    echo ""
    read -p "Continue? (y/N): " confirm

    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Operation cancelled"
        read -p "Press Enter to continue..."
        return 0
    fi

    if create_octane_service "$domain" "$port" "$workers" "$laravel_path" "$service_user" "$service_group"; then
        if [ -z "$port" ]; then
            port=$(get_next_available_port)
        fi
        start_octane_service "$(get_octane_service_name "$domain" "$port")"
        echo ""
        echo -e "${GREEN}Service created and started successfully${NC}"
    else
        echo -e "${RED}Failed to create service${NC}"
    fi

    echo ""
    read -p "Press Enter to continue..."
}

# Manage specific service
manage_service_menu() {
    local service_name="$1"
    local selected_index=0
    local choice=0
    local menu_items=(
        "Start Service"
        "Stop Service"
        "Restart Service"
        "Show Detailed Status"
        "View Recent Logs"
        "Remove Service"
        "Back to Laravel Octane Manager"
    )

    while true; do
        arrow_menu_select "Manage Service: $service_name" menu_items "$selected_index" 6 show_selected_octane_service_status
        selected_index="$ARROW_MENU_SELECTED_INDEX"
        if [ "$selected_index" -eq 6 ]; then
            choice=0
        else
            choice=$((selected_index + 1))
        fi

        case "$choice" in
            1)
                start_octane_service "$service_name"
                echo ""
                read -p "Press Enter to continue..."
                ;;
            2)
                stop_octane_service "$service_name"
                echo ""
                read -p "Press Enter to continue..."
                ;;
            3)
                restart_octane_service "$service_name"
                echo ""
                read -p "Press Enter to continue..."
                ;;
            4)
                status_octane_service "$service_name"
                echo ""
                read -p "Press Enter to continue..."
                ;;
            5)
                echo ""
                echo -e "${CYAN}Recent Logs (last 50 lines):${NC}"
                journalctl -u "$service_name" -n 50 --no-pager
                echo ""
                read -p "Press Enter to continue..."
                ;;
            6)
                echo ""
                echo -e "${YELLOW}WARNING: This will permanently remove the service${NC}"
                read -p "Are you sure? (y/N): " confirm
                if [[ "$confirm" =~ ^[Yy]$ ]]; then
                    remove_octane_service "$service_name"
                    echo ""
                    read -p "Press Enter to continue..."
                    return 0
                fi
                ;;
            0)
                return 0
                ;;
            *)
                echo -e "${RED}Invalid option${NC}"
                sleep 1
                ;;
        esac
    done
}

# Select service to manage
select_service_to_manage() {
    local services=($(list_octane_services))
    local menu_items=()
    local selected_index=0
    local service=""
    local is_active=""

    if [ ${#services[@]} -eq 0 ]; then
        echo -e "${YELLOW}No Octane services found${NC}"
        echo ""
        read -p "Press Enter to continue..."
        return 0
    fi

    for service in "${services[@]}"; do
        is_active="$(systemctl is-active "$service" 2>/dev/null || echo "inactive")"
        if [ "$is_active" = "active" ]; then
            menu_items+=("$service [RUNNING]")
        else
            menu_items+=("$service [STOPPED]")
        fi
    done
    menu_items+=("Back to Laravel Octane Manager")

    arrow_menu_select "Select Octane Service to Manage" menu_items 0 "${#services[@]}"
    selected_index="$ARROW_MENU_SELECTED_INDEX"
    if [ "$selected_index" -eq "${#services[@]}" ]; then
        return 0
    fi
    manage_service_menu "${services[$selected_index]}"
}

# Restart all Octane services
restart_all_services() {
    clear
    echo "================================================"
    echo "Restart All Octane Services"
    echo "================================================"
    echo ""

    local services=($(list_octane_services))

    if [ ${#services[@]} -eq 0 ]; then
        echo -e "${YELLOW}No Octane services found${NC}"
        echo ""
        read -p "Press Enter to continue..."
        return 0
    fi

    echo "Found ${#services[@]} service(s)"
    echo ""
    read -p "Restart all services? (y/N): " confirm

    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Operation cancelled"
        read -p "Press Enter to continue..."
        return 0
    fi

    echo ""
    restart_all_octane

    echo ""
    read -p "Press Enter to continue..."
}

# Run installation script
run_installation() {
    clear
    echo "================================================"
    echo "Run Octane Installation Script"
    echo "================================================"
    echo ""

    local install_script="$PARENT_DIR_LEVEL_1/install_shells/134_setup_api_domains.sh"

    if [ ! -f "$install_script" ]; then
        echo -e "${RED}Installation script not found: $install_script${NC}"
        echo ""
        read -p "Press Enter to continue..."
        return 1
    fi

    echo "This will run: 134_setup_api_domains.sh"
    echo ""
    read -p "Continue? (y/N): " confirm

    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Operation cancelled"
        read -p "Press Enter to continue..."
        return 0
    fi

    echo ""
    bash "$install_script"

    echo ""
    read -p "Press Enter to continue..."
}

# Main menu
show_main_menu() {
    local selected_index=0
    local choice=0
    local menu_items=(
        "Show All Services Overview"
        "Create New Service"
        "Manage Existing Service"
        "Restart All Services"
        "Run Installation Script (134_setup_api_domains.sh)"
        "Back to Service Manager"
    )

    while true; do
        arrow_menu_select "Laravel Octane Advanced Manager" menu_items "$selected_index" 5
        selected_index="$ARROW_MENU_SELECTED_INDEX"
        if [ "$selected_index" -eq 5 ]; then
            choice=0
        else
            choice=$((selected_index + 1))
        fi

        case "$choice" in
            1)
                show_services_overview
                ;;
            2)
                create_new_service
                ;;
            3)
                select_service_to_manage
                ;;
            4)
                restart_all_services
                ;;
            5)
                run_installation
                ;;
            0)
                echo "Exiting..."
                exit 0
                ;;
            *)
                echo -e "${RED}Invalid option${NC}"
                sleep 1
                ;;
        esac
    done
}

# Main execution
show_main_menu
