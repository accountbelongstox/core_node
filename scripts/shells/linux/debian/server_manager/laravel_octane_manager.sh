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
source "$PARENT_DIR_LEVEL_2/common/octane_service_manager.sh"
source "$PARENT_DIR_LEVEL_2/common/app_paths.sh"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

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

    while true; do
        clear
        echo "================================================"
        echo "Manage Service: $service_name"
        echo "================================================"
        echo ""

        # Show service status
        local is_active=$(systemctl is-active "$service_name" 2>/dev/null || echo "inactive")
        local is_enabled=$(systemctl is-enabled "$service_name" 2>/dev/null || echo "disabled")
        local timer_active=$(systemctl is-active "${service_name}.timer" 2>/dev/null || echo "inactive")

        echo -n "Status: "
        if [ "$is_active" = "active" ]; then
            echo -e "${GREEN}RUNNING${NC}"
        else
            echo -e "${RED}STOPPED${NC}"
        fi

        echo "Auto-start: $is_enabled"
        echo "48h Timer: $timer_active"
        echo ""

        echo "1. Start Service"
        echo "2. Stop Service"
        echo "3. Restart Service"
        echo "4. Show Detailed Status"
        echo "5. View Recent Logs"
        echo "6. Remove Service"
        echo ""
        echo "0. Back to Main Menu"
        echo ""
        read -p "Choose an option: " choice

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
    clear
    echo "================================================"
    echo "Select Service to Manage"
    echo "================================================"
    echo ""

    local services=($(list_octane_services))

    if [ ${#services[@]} -eq 0 ]; then
        echo -e "${YELLOW}No Octane services found${NC}"
        echo ""
        read -p "Press Enter to continue..."
        return 0
    fi

    local index=1
    for service in "${services[@]}"; do
        local is_active=$(systemctl is-active "$service" 2>/dev/null || echo "inactive")
        printf "%d. %-40s " "$index" "$service"
        if [ "$is_active" = "active" ]; then
            echo -e "${GREEN}[RUNNING]${NC}"
        else
            echo -e "${RED}[STOPPED]${NC}"
        fi
        ((index++))
    done

    echo ""
    echo "0. Back to Main Menu"
    echo ""
    read -p "Choose a service: " choice

    if [ "$choice" = "0" ]; then
        return 0
    fi

    if [ "$choice" -ge 1 ] && [ "$choice" -le "${#services[@]}" ]; then
        local selected_service="${services[$((choice - 1))]}"
        manage_service_menu "$selected_service"
    else
        echo -e "${RED}Invalid option${NC}"
        sleep 1
    fi
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

    local install_script="$PARENT_DIR_LEVEL_1/install_shells/137_setup_api_domains.sh"

    if [ ! -f "$install_script" ]; then
        echo -e "${RED}Installation script not found: $install_script${NC}"
        echo ""
        read -p "Press Enter to continue..."
        return 1
    fi

    echo "This will run: 135_setup_api_domains.sh"
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
    while true; do
        clear
        echo "================================================"
        echo "Laravel Octane Advanced Manager"
        echo "================================================"
        echo ""
        echo "Service Management:"
        echo "  1. Show All Services Overview"
        echo "  2. Create New Service"
        echo "  3. Manage Existing Service"
        echo "  4. Restart All Services"
        echo ""
        echo "Installation:"
        echo "  5. Run Installation Script (135_setup_api_domains.sh)"
        echo ""
        echo "0. Exit"
        echo ""
        read -p "Choose an option: " choice

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
