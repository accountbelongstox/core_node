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
source "$PARENT_DIR_LEVEL_2/common/arrow_menu.sh"

REDIS_CONFIG="/etc/redis/redis.conf"
REDIS_CLI="redis-cli"

COLOR_RESET="\033[0m"
COLOR_RED="\033[31m"
COLOR_GREEN="\033[32m"
COLOR_YELLOW="\033[33m"
COLOR_BLUE="\033[34m"
COLOR_CYAN="\033[36m"

check_redis_installed() {
    if ! command -v redis-server >/dev/null 2>&1; then
        echo -e "${COLOR_RED}Redis is not installed!${COLOR_RESET}"
        echo "Please run installation script first: 73_install_redis.sh"
        return 1
    fi
    return 0
}

show_header() {
    clear
    echo -e "${COLOR_CYAN}========================================${COLOR_RESET}"
    echo -e "${COLOR_CYAN}    Redis Management Script${COLOR_RESET}"
    echo -e "${COLOR_CYAN}========================================${COLOR_RESET}"
    echo ""
}

show_redis_status() {
    echo -e "${COLOR_BLUE}=== Redis Service Status ===${COLOR_RESET}"
    systemctl status redis-server --no-pager -l | head -20
    echo ""
}

show_redis_info() {
    show_header
    echo -e "${COLOR_BLUE}=== Redis Basic Information ===${COLOR_RESET}"
    echo ""

    echo -e "${COLOR_CYAN}Version:${COLOR_RESET}"
    redis-server --version
    echo ""

    echo -e "${COLOR_CYAN}Configuration File:${COLOR_RESET}"
    echo "$REDIS_CONFIG"
    echo ""

    show_redis_status

    echo -e "${COLOR_CYAN}Listening Port:${COLOR_RESET}"
    $USE_SUDO netstat -tlnp | grep redis || $USE_SUDO ss -tlnp | grep redis
    echo ""

    if pgrep redis-server >/dev/null 2>&1; then
        echo -e "${COLOR_CYAN}Redis Server Info:${COLOR_RESET}"
        $REDIS_CLI INFO server | head -20
        echo ""
    fi

    read -p "Press Enter to continue..."
}

start_redis() {
    show_header
    echo -e "${COLOR_BLUE}=== Starting Redis ===${COLOR_RESET}"

    if systemctl is-active --quiet redis-server; then
        echo -e "${COLOR_YELLOW}Redis is already running${COLOR_RESET}"
    else
        echo "Starting Redis service..."
        $USE_SUDO systemctl start redis-server

        if [ $? -eq 0 ]; then
            echo -e "${COLOR_GREEN}Redis started successfully${COLOR_RESET}"
            $USE_SUDO systemctl enable redis-server
        else
            echo -e "${COLOR_RED}Failed to start Redis${COLOR_RESET}"
        fi
    fi

    echo ""
    show_redis_status
    read -p "Press Enter to continue..."
}

stop_redis() {
    show_header
    echo -e "${COLOR_BLUE}=== Stopping Redis ===${COLOR_RESET}"

    if ! systemctl is-active --quiet redis-server; then
        echo -e "${COLOR_YELLOW}Redis is not running${COLOR_RESET}"
    else
        echo "Stopping Redis service..."
        $USE_SUDO systemctl stop redis-server

        if [ $? -eq 0 ]; then
            echo -e "${COLOR_GREEN}Redis stopped successfully${COLOR_RESET}"
        else
            echo -e "${COLOR_RED}Failed to stop Redis${COLOR_RESET}"
        fi
    fi

    echo ""
    show_redis_status
    read -p "Press Enter to continue..."
}

restart_redis() {
    show_header
    echo -e "${COLOR_BLUE}=== Restarting Redis ===${COLOR_RESET}"

    echo "Restarting Redis service..."
    $USE_SUDO systemctl restart redis-server

    if [ $? -eq 0 ]; then
        echo -e "${COLOR_GREEN}Redis restarted successfully${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}Failed to restart Redis${COLOR_RESET}"
    fi

    echo ""
    show_redis_status
    read -p "Press Enter to continue..."
}

show_redis_stats() {
    show_header
    echo -e "${COLOR_BLUE}=== Redis Statistics ===${COLOR_RESET}"
    echo ""

    if ! pgrep redis-server >/dev/null 2>&1; then
        echo -e "${COLOR_RED}Redis is not running${COLOR_RESET}"
        read -p "Press Enter to continue..."
        return
    fi

    echo -e "${COLOR_CYAN}Memory Stats:${COLOR_RESET}"
    $REDIS_CLI INFO memory
    echo ""

    echo -e "${COLOR_CYAN}Stats:${COLOR_RESET}"
    $REDIS_CLI INFO stats
    echo ""

    echo -e "${COLOR_CYAN}Clients:${COLOR_RESET}"
    $REDIS_CLI INFO clients
    echo ""

    read -p "Press Enter to continue..."
}

show_redis_keys() {
    show_header
    echo -e "${COLOR_BLUE}=== Redis Keys Information ===${COLOR_RESET}"
    echo ""

    if ! pgrep redis-server >/dev/null 2>&1; then
        echo -e "${COLOR_RED}Redis is not running${COLOR_RESET}"
        read -p "Press Enter to continue..."
        return
    fi

    echo -e "${COLOR_CYAN}Database Size:${COLOR_RESET}"
    $REDIS_CLI DBSIZE
    echo ""

    echo -e "${COLOR_CYAN}Sample Keys (first 20):${COLOR_RESET}"
    $REDIS_CLI KEYS '*' | head -20
    echo ""

    read -p "Press Enter to continue..."
}

flush_redis() {
    show_header
    echo -e "${COLOR_BLUE}=== Flush Redis Database ===${COLOR_RESET}"
    echo ""

    if ! pgrep redis-server >/dev/null 2>&1; then
        echo -e "${COLOR_RED}Redis is not running${COLOR_RESET}"
        read -p "Press Enter to continue..."
        return
    fi

    echo -e "${COLOR_RED}WARNING: This will delete all keys in the current database!${COLOR_RESET}"
    read -p "Are you sure you want to continue? (yes/no): " confirm

    if [ "$confirm" = "yes" ]; then
        $REDIS_CLI FLUSHDB
        echo -e "${COLOR_GREEN}Database flushed${COLOR_RESET}"
    else
        echo "Operation cancelled"
    fi

    echo ""
    read -p "Press Enter to continue..."
}

view_config() {
    show_header
    echo -e "${COLOR_BLUE}=== Redis Configuration ===${COLOR_RESET}"
    echo ""

    if [ -f "$REDIS_CONFIG" ]; then
        less "$REDIS_CONFIG"
    else
        echo -e "${COLOR_RED}Configuration file not found: $REDIS_CONFIG${COLOR_RESET}"
    fi

    read -p "Press Enter to continue..."
}

show_menu() {
    local menu_items=(
        "Start Redis"
        "Stop Redis"
        "Restart Redis"
        "Show Basic Information"
        "Show Statistics"
        "Show Keys Information"
        "View Configuration File"
        "Flush Database (Delete All Keys)"
        "Back to Service Manager"
    )

    arrow_menu_select "Redis Manager" menu_items 0 8 show_redis_status
    if [ "$ARROW_MENU_SELECTED_INDEX" -eq 8 ]; then
        choice=0
    else
        choice=$((ARROW_MENU_SELECTED_INDEX + 1))
    fi
}

main() {
    if ! check_redis_installed; then
        exit 1
    fi

    while true; do
        show_menu

        case $choice in
            1) start_redis ;;
            2) stop_redis ;;
            3) restart_redis ;;
            4) show_redis_info ;;
            5) show_redis_stats ;;
            6) show_redis_keys ;;
            7) view_config ;;
            8) flush_redis ;;
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
