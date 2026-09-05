#!/bin/bash

# Function to show all services status
show_all_services_status() {
    local service=""

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

# Function to start all services (systemd-managed items only)
start_all_services() {
    local service=""
    local confirm=""

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
        if service_is_systemd_managed "$service" && is_service_installed "$service"; then
            start_service "$service"
            echo ""
        fi
    done

    echo ""
    echo -e "${GREEN}All services started${NC}"
}

# Function to stop all services (systemd-managed items only)
stop_all_services() {
    local service=""
    local confirm=""

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
        if service_is_systemd_managed "$service" && is_service_installed "$service"; then
            stop_service "$service"
            echo ""
        fi
    done

    echo ""
    echo -e "${GREEN}All services stopped${NC}"
}

# Function to restart all services (systemd-managed items only)
restart_all_services() {
    local service=""
    local confirm=""

    echo ""
    read -p "Do you want to restart all installed services? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Operation cancelled"
        return 0
    fi
    for service in "${SERVICES[@]}"; do
        if service_is_systemd_managed "$service" && is_service_installed "$service"; then
            restart_service "$service"
            echo ""
        fi
    done
    echo -e "${GREEN}All services restarted${NC}"
}

# Capability-aware action menu:
#   aggregate items -> status details + their own manager (per-unit lifecycle)
#   systemd items   -> start/stop/restart/status/logs/autostart/reinstall (+manager)
#   runtime items   -> status details / reinstall (re-run installer or configuration)
show_service_action_menu() {
    local service="$1"
    local service_name="${SERVICE_NAME[$service]}"
    local status="$(get_service_status "$service")"
    local selected_index=0
    local selected_action=""
    local menu_items=()
    local action_keys=()

    if service_is_aggregate "$service"; then
        menu_items=("Show Details" "Open Manager" "Back to Service List")
        action_keys=("status" "manage" "back")
    elif [ "$status" = "NOT_INSTALLED" ]; then
        menu_items=("Install Service")
        action_keys=("reinstall")
        if has_advanced_manager "$service"; then
            menu_items+=("Open Manager")
            action_keys+=("manage")
        fi
        menu_items+=("Back to Service List")
        action_keys+=("back")
    elif service_is_systemd_managed "$service"; then
        menu_items=(
            "Start Service"
            "Stop Service"
            "Restart Service"
            "Show Status"
            "Show Logs"
            "Toggle Auto-start"
            "Reinstall Service"
        )
        action_keys=("start" "stop" "restart" "status" "logs" "autostart" "reinstall")
        if has_advanced_manager "$service"; then
            menu_items+=("Open Manager")
            action_keys+=("manage")
        fi
        menu_items+=("Back to Service List")
        action_keys+=("back")
    else
        menu_items=("Show Details" "Reinstall / Reconfigure" "Back to Service List")
        action_keys=("status" "reinstall" "back")
    fi

    arrow_menu_select "$service_name [$status]" menu_items 0 "$((${#menu_items[@]} - 1))"
    selected_index="$ARROW_MENU_SELECTED_INDEX"
    selected_action="${action_keys[$selected_index]}"
    case "$selected_action" in
        start) start_service "$service" ;;
        stop) stop_service "$service" ;;
        restart) restart_service "$service" ;;
        status) show_service_status "$service" ;;
        logs) show_service_logs "$service" ;;
        autostart) toggle_autostart "$service" ;;
        reinstall) reinstall_service "$service" ;;
        manage) launch_advanced_manager "$service" ;;
        back) return 0 ;;
    esac
    echo ""
    read -p "Press Enter to continue..."
}

show_main_menu() {
    local selected_index=0
    local service_count="${#SERVICES[@]}"
    local service=""
    local menu_items=()

    while true; do
        menu_items=()
        for service in "${SERVICES[@]}"; do
            menu_items+=("${SERVICE_NAME[$service]} [$(get_service_status "$service")]")
        done
        menu_items+=(
            "Show All Services Status"
            "Start All Installed Services"
            "Stop All Running Services"
            "Restart All Installed Services"
            "Back to Linux Management"
        )

        arrow_menu_select "Service Manager" menu_items "$selected_index" "$((${#menu_items[@]} - 1))"
        selected_index="$ARROW_MENU_SELECTED_INDEX"
        if [ "$selected_index" -lt "$service_count" ]; then
            show_service_action_menu "${SERVICES[$selected_index]}"
            continue
        fi
        case "$((selected_index - service_count))" in
            0) show_all_services_status ;;
            1) start_all_services ;;
            2) stop_all_services ;;
            3) restart_all_services ;;
            4) echo "Exiting Service Manager..."; return 0 ;;
        esac
        echo ""
        read -p "Press Enter to continue..."
    done
}
