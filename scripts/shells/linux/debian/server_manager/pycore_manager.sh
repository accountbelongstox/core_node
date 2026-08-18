#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Declare all variables at the beginning of the file
# 6. For Bash scripts: Use absolute paths resolved from script location
# 7. Do not modify these rules
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/app_paths.sh"

SERVICE_NAME="pycore-module-caller"
SERVICE_PORT=59000
SERVICE_SCRIPT="${CORE_NODE_ROOT_FROM_SCRIPTS}/pycore_module_caller.py"
PYCORE_ROOT="${CORE_NODE_ROOT_FROM_SCRIPTS}/pycore"

COLOR_RESET="\033[0m"
COLOR_RED="\033[31m"
COLOR_GREEN="\033[32m"
COLOR_YELLOW="\033[33m"
COLOR_BLUE="\033[34m"
COLOR_CYAN="\033[36m"

check_pycore_installed() {
    if [ ! -f "$SERVICE_SCRIPT" ]; then
        echo -e "${COLOR_RED}Pycore HTTP service is not installed!${COLOR_RESET}"
        echo "Service script not found: $SERVICE_SCRIPT"
        echo "Please run installation script first: 189_install_pycore_http_service.sh"
        return 1
    fi

    if ! systemctl list-unit-files | grep -q "^$SERVICE_NAME.service"; then
        echo -e "${COLOR_RED}Pycore HTTP service is not installed!${COLOR_RESET}"
        echo "Please run installation script first: 189_install_pycore_http_service.sh"
        return 1
    fi

    return 0
}

show_header() {
    clear
    echo -e "${COLOR_CYAN}========================================${COLOR_RESET}"
    echo -e "${COLOR_CYAN}    Pycore HTTP Service Manager${COLOR_RESET}"
    echo -e "${COLOR_CYAN}========================================${COLOR_RESET}"
    echo ""
}

show_service_status() {
    echo -e "${COLOR_BLUE}=== Pycore HTTP Service Status ===${COLOR_RESET}"
    systemctl status $SERVICE_NAME --no-pager -l | head -20
    echo ""
}

show_service_info() {
    show_header
    echo -e "${COLOR_BLUE}=== Pycore HTTP Service Information ===${COLOR_RESET}"
    echo ""

    echo -e "${COLOR_CYAN}Service Name:${COLOR_RESET} $SERVICE_NAME"
    echo -e "${COLOR_CYAN}Service Port:${COLOR_RESET} $SERVICE_PORT"
    echo -e "${COLOR_CYAN}Service Script:${COLOR_RESET} $SERVICE_SCRIPT"
    echo -e "${COLOR_CYAN}Pycore Root:${COLOR_RESET} $PYCORE_ROOT"
    echo ""

    show_service_status

    echo -e "${COLOR_CYAN}Listening Port:${COLOR_RESET}"
    $USE_SUDO netstat -tlnp | grep $SERVICE_PORT || $USE_SUDO ss -tlnp | grep $SERVICE_PORT
    echo ""

    if systemctl is-active --quiet $SERVICE_NAME; then
        echo -e "${COLOR_CYAN}Health Check:${COLOR_RESET}"
        if curl -s "http://127.0.0.1:$SERVICE_PORT/health" >/dev/null 2>&1; then
            echo -e "${COLOR_GREEN}�?Service is healthy${COLOR_RESET}"
            curl -s "http://127.0.0.1:$SERVICE_PORT/health"
        else
            echo -e "${COLOR_RED}�?Health check failed${COLOR_RESET}"
        fi
        echo ""
    fi

    read -p "Press Enter to continue..."
}

start_service() {
    show_header
    echo -e "${COLOR_BLUE}=== Starting Pycore HTTP Service ===${COLOR_RESET}"

    if systemctl is-active --quiet $SERVICE_NAME; then
        echo -e "${COLOR_YELLOW}Pycore HTTP service is already running${COLOR_RESET}"
    else
        echo "Starting Pycore HTTP service..."
        $USE_SUDO systemctl start $SERVICE_NAME

        if [ $? -eq 0 ]; then
            echo -e "${COLOR_GREEN}Pycore HTTP service started successfully${COLOR_RESET}"
            $USE_SUDO systemctl enable $SERVICE_NAME

            sleep 2

            if curl -s "http://127.0.0.1:$SERVICE_PORT/health" >/dev/null 2>&1; then
                echo -e "${COLOR_GREEN}�?Health check passed${COLOR_RESET}"
            else
                echo -e "${COLOR_YELLOW}�?Health check failed - service may still be starting${COLOR_RESET}"
            fi
        else
            echo -e "${COLOR_RED}Failed to start Pycore HTTP service${COLOR_RESET}"
        fi
    fi

    echo ""
    show_service_status
    read -p "Press Enter to continue..."
}

stop_service() {
    show_header
    echo -e "${COLOR_BLUE}=== Stopping Pycore HTTP Service ===${COLOR_RESET}"

    if ! systemctl is-active --quiet $SERVICE_NAME; then
        echo -e "${COLOR_YELLOW}Pycore HTTP service is not running${COLOR_RESET}"
    else
        echo "Stopping Pycore HTTP service..."
        $USE_SUDO systemctl stop $SERVICE_NAME

        if [ $? -eq 0 ]; then
            echo -e "${COLOR_GREEN}Pycore HTTP service stopped successfully${COLOR_RESET}"
        else
            echo -e "${COLOR_RED}Failed to stop Pycore HTTP service${COLOR_RESET}"
        fi
    fi

    echo ""
    show_service_status
    read -p "Press Enter to continue..."
}

restart_service() {
    show_header
    echo -e "${COLOR_BLUE}=== Restarting Pycore HTTP Service ===${COLOR_RESET}"

    echo "Restarting Pycore HTTP service..."
    $USE_SUDO systemctl restart $SERVICE_NAME

    if [ $? -eq 0 ]; then
        echo -e "${COLOR_GREEN}Pycore HTTP service restarted successfully${COLOR_RESET}"

        sleep 2

        if curl -s "http://127.0.0.1:$SERVICE_PORT/health" >/dev/null 2>&1; then
            echo -e "${COLOR_GREEN}�?Health check passed${COLOR_RESET}"
        else
            echo -e "${COLOR_YELLOW}�?Health check failed - service may still be starting${COLOR_RESET}"
        fi
    else
        echo -e "${COLOR_RED}Failed to restart Pycore HTTP service${COLOR_RESET}"
    fi

    echo ""
    show_service_status
    read -p "Press Enter to continue..."
}

test_health() {
    show_header
    echo -e "${COLOR_BLUE}=== Test Pycore HTTP Service Health ===${COLOR_RESET}"
    echo ""

    if ! systemctl is-active --quiet $SERVICE_NAME; then
        echo -e "${COLOR_RED}Pycore HTTP service is not running${COLOR_RESET}"
        read -p "Press Enter to continue..."
        return
    fi

    echo "Testing health endpoint..."
    echo ""

    response=$(curl -s "http://127.0.0.1:$SERVICE_PORT/health")

    if [ $? -eq 0 ]; then
        echo -e "${COLOR_GREEN}�?Health check passed${COLOR_RESET}"
        echo ""
        echo "Response:"
        # Use python (venv) instead of python3 (system)
        echo "$response" | python -m json.tool 2>/dev/null || echo "$response"
    else
        echo -e "${COLOR_RED}�?Health check failed${COLOR_RESET}"
    fi

    echo ""
    read -p "Press Enter to continue..."
}

view_logs() {
    show_header
    echo -e "${COLOR_BLUE}=== Pycore HTTP Service Logs ===${COLOR_RESET}"
    echo ""

    echo "1) View last 50 lines"
    echo "2) View last 100 lines"
    echo "3) View last 200 lines"
    echo "4) Follow logs (real-time)"
    echo "0) Back to main menu"
    echo ""

    read -p "Select option: " choice

    case $choice in
        1)
            journalctl -u $SERVICE_NAME -n 50 --no-pager
            echo ""
            read -p "Press Enter to continue..."
            ;;
        2)
            journalctl -u $SERVICE_NAME -n 100 --no-pager
            echo ""
            read -p "Press Enter to continue..."
            ;;
        3)
            journalctl -u $SERVICE_NAME -n 200 --no-pager
            echo ""
            read -p "Press Enter to continue..."
            ;;
        4)
            echo "Press Ctrl+C to stop following logs..."
            journalctl -u $SERVICE_NAME -f
            ;;
    esac
}

view_service_file() {
    show_header
    echo -e "${COLOR_BLUE}=== Pycore HTTP Service File ===${COLOR_RESET}"
    echo ""

    local service_file="/etc/systemd/system/$SERVICE_NAME.service"

    if [ -f "$service_file" ]; then
        cat "$service_file"
    else
        echo -e "${COLOR_RED}Service file not found: $service_file${COLOR_RESET}"
    fi

    echo ""
    read -p "Press Enter to continue..."
}

show_resource_usage() {
    show_header
    echo -e "${COLOR_BLUE}=== Pycore HTTP Service Resource Usage ===${COLOR_RESET}"
    echo ""

    if ! systemctl is-active --quiet $SERVICE_NAME; then
        echo -e "${COLOR_RED}Pycore HTTP service is not running${COLOR_RESET}"
        read -p "Press Enter to continue..."
        return
    fi

    echo -e "${COLOR_CYAN}Resource Usage:${COLOR_RESET}"
    systemctl show $SERVICE_NAME --property=CPUUsageNSec,MemoryCurrent,TasksCurrent
    echo ""

    echo -e "${COLOR_CYAN}Process Details:${COLOR_RESET}"
    ps aux | grep -E "(PID|$SERVICE_SCRIPT)" | grep -v grep
    echo ""

    read -p "Press Enter to continue..."
}

show_menu() {
    show_header
    show_service_status

    echo -e "${COLOR_CYAN}Menu:${COLOR_RESET}"
    echo "  1) Start Service"
    echo "  2) Stop Service"
    echo "  3) Restart Service"
    echo "  4) Show Service Information"
    echo "  5) Test Health Endpoint"
    echo "  6) Show Resource Usage"
    echo "  7) View Service Logs"
    echo "  8) View Service File"
    echo "  0) Exit"
    echo ""
}

main() {
    if ! check_pycore_installed; then
        exit 1
    fi

    while true; do
        show_menu
        read -p "Select option: " choice

        case $choice in
            1) start_service ;;
            2) stop_service ;;
            3) restart_service ;;
            4) show_service_info ;;
            5) test_health ;;
            6) show_resource_usage ;;
            7) view_logs ;;
            8) view_service_file ;;
            0)
                echo "Exiting..."
                exit 0
                ;;
            *)
                echo -e "${COLOR_RED}Invalid option${COLOR_RESET}"
                sleep 1
                ;;
        esac
    done
}

main "$@"
