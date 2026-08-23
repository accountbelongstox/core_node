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

PG_VERSION=$(psql --version 2>/dev/null | awk '{print $3}' | cut -d. -f1)
PG_CONFIG_DIR="/etc/postgresql"
PG_DATA_DIR="/var/lib/postgresql"

COLOR_RESET="\033[0m"
COLOR_RED="\033[31m"
COLOR_GREEN="\033[32m"
COLOR_YELLOW="\033[33m"
COLOR_BLUE="\033[34m"
COLOR_CYAN="\033[36m"

check_postgresql_installed() {
    if ! command -v psql >/dev/null 2>&1; then
        echo -e "${COLOR_RED}PostgreSQL is not installed!${COLOR_RESET}"
        echo "Please run installation script first: 75_install_postgresql.sh"
        return 1
    fi
    return 0
}

show_header() {
    clear
    echo -e "${COLOR_CYAN}========================================${COLOR_RESET}"
    echo -e "${COLOR_CYAN}    PostgreSQL Management Script${COLOR_RESET}"
    echo -e "${COLOR_CYAN}========================================${COLOR_RESET}"
    echo ""
}

show_postgresql_status() {
    echo -e "${COLOR_BLUE}=== PostgreSQL Service Status ===${COLOR_RESET}"
    systemctl status postgresql --no-pager -l | head -20
    echo ""
}

show_postgresql_info() {
    show_header
    echo -e "${COLOR_BLUE}=== PostgreSQL Basic Information ===${COLOR_RESET}"
    echo ""

    echo -e "${COLOR_CYAN}Version:${COLOR_RESET}"
    psql --version
    echo ""

    echo -e "${COLOR_CYAN}Configuration Directory:${COLOR_RESET}"
    echo "$PG_CONFIG_DIR"
    echo ""

    echo -e "${COLOR_CYAN}Data Directory:${COLOR_RESET}"
    echo "$PG_DATA_DIR"
    echo ""

    show_postgresql_status

    echo -e "${COLOR_CYAN}Listening Port:${COLOR_RESET}"
    $USE_SUDO netstat -tlnp | grep postgres || $USE_SUDO ss -tlnp | grep postgres
    echo ""

    if systemctl is-active --quiet postgresql; then
        echo -e "${COLOR_CYAN}Active Connections:${COLOR_RESET}"
        $USE_SUDO -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null
        echo ""
    fi

    read -p "Press Enter to continue..."
}

start_postgresql() {
    show_header
    echo -e "${COLOR_BLUE}=== Starting PostgreSQL ===${COLOR_RESET}"

    if systemctl is-active --quiet postgresql; then
        echo -e "${COLOR_YELLOW}PostgreSQL is already running${COLOR_RESET}"
    else
        echo "Starting PostgreSQL service..."
        $USE_SUDO systemctl start postgresql

        if [ $? -eq 0 ]; then
            echo -e "${COLOR_GREEN}PostgreSQL started successfully${COLOR_RESET}"
            $USE_SUDO systemctl enable postgresql
        else
            echo -e "${COLOR_RED}Failed to start PostgreSQL${COLOR_RESET}"
        fi
    fi

    echo ""
    show_postgresql_status
    read -p "Press Enter to continue..."
}

stop_postgresql() {
    show_header
    echo -e "${COLOR_BLUE}=== Stopping PostgreSQL ===${COLOR_RESET}"

    if ! systemctl is-active --quiet postgresql; then
        echo -e "${COLOR_YELLOW}PostgreSQL is not running${COLOR_RESET}"
    else
        echo "Stopping PostgreSQL service..."
        $USE_SUDO systemctl stop postgresql

        if [ $? -eq 0 ]; then
            echo -e "${COLOR_GREEN}PostgreSQL stopped successfully${COLOR_RESET}"
        else
            echo -e "${COLOR_RED}Failed to stop PostgreSQL${COLOR_RESET}"
        fi
    fi

    echo ""
    show_postgresql_status
    read -p "Press Enter to continue..."
}

restart_postgresql() {
    show_header
    echo -e "${COLOR_BLUE}=== Restarting PostgreSQL ===${COLOR_RESET}"

    echo "Restarting PostgreSQL service..."
    $USE_SUDO systemctl restart postgresql

    if [ $? -eq 0 ]; then
        echo -e "${COLOR_GREEN}PostgreSQL restarted successfully${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}Failed to restart PostgreSQL${COLOR_RESET}"
    fi

    echo ""
    show_postgresql_status
    read -p "Press Enter to continue..."
}

reload_postgresql() {
    show_header
    echo -e "${COLOR_BLUE}=== Reloading PostgreSQL Configuration ===${COLOR_RESET}"

    echo "Reloading PostgreSQL configuration..."
    $USE_SUDO systemctl reload postgresql

    if [ $? -eq 0 ]; then
        echo -e "${COLOR_GREEN}PostgreSQL configuration reloaded successfully${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}Failed to reload PostgreSQL${COLOR_RESET}"
    fi

    echo ""
    read -p "Press Enter to continue..."
}

list_databases() {
    show_header
    echo -e "${COLOR_BLUE}=== PostgreSQL Databases ===${COLOR_RESET}"
    echo ""

    if ! systemctl is-active --quiet postgresql; then
        echo -e "${COLOR_RED}PostgreSQL is not running${COLOR_RESET}"
        read -p "Press Enter to continue..."
        return
    fi

    echo -e "${COLOR_CYAN}Available Databases:${COLOR_RESET}"
    $USE_SUDO -u postgres psql -c "\l"
    echo ""

    read -p "Press Enter to continue..."
}

list_users() {
    show_header
    echo -e "${COLOR_BLUE}=== PostgreSQL Users/Roles ===${COLOR_RESET}"
    echo ""

    if ! systemctl is-active --quiet postgresql; then
        echo -e "${COLOR_RED}PostgreSQL is not running${COLOR_RESET}"
        read -p "Press Enter to continue..."
        return
    fi

    echo -e "${COLOR_CYAN}Database Users:${COLOR_RESET}"
    $USE_SUDO -u postgres psql -c "\du"
    echo ""

    read -p "Press Enter to continue..."
}

show_connections() {
    show_header
    echo -e "${COLOR_BLUE}=== PostgreSQL Active Connections ===${COLOR_RESET}"
    echo ""

    if ! systemctl is-active --quiet postgresql; then
        echo -e "${COLOR_RED}PostgreSQL is not running${COLOR_RESET}"
        read -p "Press Enter to continue..."
        return
    fi

    echo -e "${COLOR_CYAN}Active Connections:${COLOR_RESET}"
    $USE_SUDO -u postgres psql -c "SELECT datname, usename, application_name, client_addr, state FROM pg_stat_activity WHERE state = 'active';"
    echo ""

    read -p "Press Enter to continue..."
}

create_database() {
    show_header
    echo -e "${COLOR_BLUE}=== Create New Database ===${COLOR_RESET}"
    echo ""

    if ! systemctl is-active --quiet postgresql; then
        echo -e "${COLOR_RED}PostgreSQL is not running${COLOR_RESET}"
        read -p "Press Enter to continue..."
        return
    fi

    read -p "Enter database name: " db_name

    if [ -z "$db_name" ]; then
        echo -e "${COLOR_RED}Database name cannot be empty${COLOR_RESET}"
        sleep 2
        return
    fi

    read -p "Enter owner username (default: postgres): " db_owner
    db_owner=${db_owner:-postgres}

    echo ""
    echo "Creating database: $db_name"
    echo "Owner: $db_owner"

    $USE_SUDO -u postgres psql -c "CREATE DATABASE $db_name OWNER $db_owner;"

    if [ $? -eq 0 ]; then
        echo -e "${COLOR_GREEN}Database created successfully${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}Failed to create database${COLOR_RESET}"
    fi

    echo ""
    read -p "Press Enter to continue..."
}

view_config() {
    local selected_index=0
    local choice=0
    local menu_items=(
        "View postgresql.conf"
        "View pg_hba.conf"
        "Back to PostgreSQL Manager"
    )

    arrow_menu_select "PostgreSQL Configuration Files" menu_items 0 2
    selected_index="$ARROW_MENU_SELECTED_INDEX"
    choice=$((selected_index + 1))

    case $choice in
        1)
            if [ -f "$PG_CONFIG_DIR/$PG_VERSION/main/postgresql.conf" ]; then
                less "$PG_CONFIG_DIR/$PG_VERSION/main/postgresql.conf"
            else
                echo -e "${COLOR_RED}Configuration file not found${COLOR_RESET}"
                sleep 2
            fi
            ;;
        2)
            if [ -f "$PG_CONFIG_DIR/$PG_VERSION/main/pg_hba.conf" ]; then
                less "$PG_CONFIG_DIR/$PG_VERSION/main/pg_hba.conf"
            else
                echo -e "${COLOR_RED}Configuration file not found${COLOR_RESET}"
                sleep 2
            fi
            ;;
    esac
}

show_menu() {
    local menu_items=(
        "Start PostgreSQL"
        "Stop PostgreSQL"
        "Restart PostgreSQL"
        "Reload Configuration"
        "Show Basic Information"
        "List Databases"
        "List Users/Roles"
        "Show Active Connections"
        "Create New Database"
        "View Configuration Files"
        "Back to Service Manager"
    )

    arrow_menu_select "PostgreSQL Manager" menu_items 0 10 show_postgresql_status
    if [ "$ARROW_MENU_SELECTED_INDEX" -eq 10 ]; then
        choice=0
    else
        choice=$((ARROW_MENU_SELECTED_INDEX + 1))
    fi
}

main() {
    if ! check_postgresql_installed; then
        exit 1
    fi

    while true; do
        show_menu

        case $choice in
            1) start_postgresql ;;
            2) stop_postgresql ;;
            3) restart_postgresql ;;
            4) reload_postgresql ;;
            5) show_postgresql_info ;;
            6) list_databases ;;
            7) list_users ;;
            8) show_connections ;;
            9) create_database ;;
            10) view_config ;;
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
