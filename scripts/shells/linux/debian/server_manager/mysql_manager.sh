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

MYSQL_CONFIG="/etc/mysql/mariadb.conf.d/50-server.cnf"
MYSQL_CLI="mysql"

COLOR_RESET="\033[0m"
COLOR_RED="\033[31m"
COLOR_GREEN="\033[32m"
COLOR_YELLOW="\033[33m"
COLOR_BLUE="\033[34m"
COLOR_CYAN="\033[36m"

check_mysql_installed() {
    if ! command -v mysql >/dev/null 2>&1; then
        echo -e "${COLOR_RED}MySQL/MariaDB is not installed!${COLOR_RESET}"
        echo "Please run installation script first: 51_install_mysql.sh"
        return 1
    fi
    return 0
}

show_header() {
    clear
    echo -e "${COLOR_CYAN}========================================${COLOR_RESET}"
    echo -e "${COLOR_CYAN}    MySQL/MariaDB Management Script${COLOR_RESET}"
    echo -e "${COLOR_CYAN}========================================${COLOR_RESET}"
    echo ""
}

show_mysql_status() {
    echo -e "${COLOR_BLUE}=== MySQL/MariaDB Service Status ===${COLOR_RESET}"
    systemctl status mariadb --no-pager -l 2>/dev/null | head -20 || systemctl status mysql --no-pager -l 2>/dev/null | head -20
    echo ""
}

show_mysql_info() {
    show_header
    echo -e "${COLOR_BLUE}=== MySQL/MariaDB Basic Information ===${COLOR_RESET}"
    echo ""

    echo -e "${COLOR_CYAN}Version:${COLOR_RESET}"
    mysql --version
    echo ""

    echo -e "${COLOR_CYAN}Configuration File:${COLOR_RESET}"
    echo "$MYSQL_CONFIG"
    echo ""

    show_mysql_status

    echo -e "${COLOR_CYAN}Listening Port:${COLOR_RESET}"
    $USE_SUDO netstat -tlnp | grep mysql || $USE_SUDO ss -tlnp | grep mysql
    echo ""

    if systemctl is-active --quiet mariadb 2>/dev/null || systemctl is-active --quiet mysql 2>/dev/null; then
        echo -e "${COLOR_CYAN}Server Status:${COLOR_RESET}"
        $USE_SUDO mysql -e "SHOW STATUS LIKE 'Threads_connected';" 2>/dev/null
        echo ""
    fi

    read -p "Press Enter to continue..."
}

start_mysql() {
    show_header
    echo -e "${COLOR_BLUE}=== Starting MySQL/MariaDB ===${COLOR_RESET}"

    local service_name="mariadb"
    if ! systemctl list-unit-files | grep -q "^mariadb.service"; then
        service_name="mysql"
    fi

    if systemctl is-active --quiet $service_name; then
        echo -e "${COLOR_YELLOW}MySQL/MariaDB is already running${COLOR_RESET}"
    else
        echo "Starting MySQL/MariaDB service..."
        $USE_SUDO systemctl start $service_name

        if [ $? -eq 0 ]; then
            echo -e "${COLOR_GREEN}MySQL/MariaDB started successfully${COLOR_RESET}"
            $USE_SUDO systemctl enable $service_name
        else
            echo -e "${COLOR_RED}Failed to start MySQL/MariaDB${COLOR_RESET}"
        fi
    fi

    echo ""
    show_mysql_status
    read -p "Press Enter to continue..."
}

stop_mysql() {
    show_header
    echo -e "${COLOR_BLUE}=== Stopping MySQL/MariaDB ===${COLOR_RESET}"

    local service_name="mariadb"
    if ! systemctl list-unit-files | grep -q "^mariadb.service"; then
        service_name="mysql"
    fi

    if ! systemctl is-active --quiet $service_name; then
        echo -e "${COLOR_YELLOW}MySQL/MariaDB is not running${COLOR_RESET}"
    else
        echo "Stopping MySQL/MariaDB service..."
        $USE_SUDO systemctl stop $service_name

        if [ $? -eq 0 ]; then
            echo -e "${COLOR_GREEN}MySQL/MariaDB stopped successfully${COLOR_RESET}"
        else
            echo -e "${COLOR_RED}Failed to stop MySQL/MariaDB${COLOR_RESET}"
        fi
    fi

    echo ""
    show_mysql_status
    read -p "Press Enter to continue..."
}

restart_mysql() {
    show_header
    echo -e "${COLOR_BLUE}=== Restarting MySQL/MariaDB ===${COLOR_RESET}"

    local service_name="mariadb"
    if ! systemctl list-unit-files | grep -q "^mariadb.service"; then
        service_name="mysql"
    fi

    echo "Restarting MySQL/MariaDB service..."
    $USE_SUDO systemctl restart $service_name

    if [ $? -eq 0 ]; then
        echo -e "${COLOR_GREEN}MySQL/MariaDB restarted successfully${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}Failed to restart MySQL/MariaDB${COLOR_RESET}"
    fi

    echo ""
    show_mysql_status
    read -p "Press Enter to continue..."
}

list_databases() {
    show_header
    echo -e "${COLOR_BLUE}=== MySQL/MariaDB Databases ===${COLOR_RESET}"
    echo ""

    local service_name="mariadb"
    if ! systemctl list-unit-files | grep -q "^mariadb.service"; then
        service_name="mysql"
    fi

    if ! systemctl is-active --quiet $service_name; then
        echo -e "${COLOR_RED}MySQL/MariaDB is not running${COLOR_RESET}"
        read -p "Press Enter to continue..."
        return
    fi

    echo -e "${COLOR_CYAN}Available Databases:${COLOR_RESET}"
    $USE_SUDO mysql -e "SHOW DATABASES;"
    echo ""

    read -p "Press Enter to continue..."
}

list_users() {
    show_header
    echo -e "${COLOR_BLUE}=== MySQL/MariaDB Users ===${COLOR_RESET}"
    echo ""

    local service_name="mariadb"
    if ! systemctl list-unit-files | grep -q "^mariadb.service"; then
        service_name="mysql"
    fi

    if ! systemctl is-active --quiet $service_name; then
        echo -e "${COLOR_RED}MySQL/MariaDB is not running${COLOR_RESET}"
        read -p "Press Enter to continue..."
        return
    fi

    echo -e "${COLOR_CYAN}Database Users:${COLOR_RESET}"
    $USE_SUDO mysql -e "SELECT User, Host FROM mysql.user;"
    echo ""

    read -p "Press Enter to continue..."
}

show_connections() {
    show_header
    echo -e "${COLOR_BLUE}=== MySQL/MariaDB Active Connections ===${COLOR_RESET}"
    echo ""

    local service_name="mariadb"
    if ! systemctl list-unit-files | grep -q "^mariadb.service"; then
        service_name="mysql"
    fi

    if ! systemctl is-active --quiet $service_name; then
        echo -e "${COLOR_RED}MySQL/MariaDB is not running${COLOR_RESET}"
        read -p "Press Enter to continue..."
        return
    fi

    echo -e "${COLOR_CYAN}Active Connections:${COLOR_RESET}"
    $USE_SUDO mysql -e "SHOW PROCESSLIST;"
    echo ""

    read -p "Press Enter to continue..."
}

create_database() {
    show_header
    echo -e "${COLOR_BLUE}=== Create New Database ===${COLOR_RESET}"
    echo ""

    local service_name="mariadb"
    if ! systemctl list-unit-files | grep -q "^mariadb.service"; then
        service_name="mysql"
    fi

    if ! systemctl is-active --quiet $service_name; then
        echo -e "${COLOR_RED}MySQL/MariaDB is not running${COLOR_RESET}"
        read -p "Press Enter to continue..."
        return
    fi

    read -p "Enter database name: " db_name

    if [ -z "$db_name" ]; then
        echo -e "${COLOR_RED}Database name cannot be empty${COLOR_RESET}"
        sleep 2
        return
    fi

    echo ""
    echo "Creating database: $db_name"

    $USE_SUDO mysql -e "CREATE DATABASE $db_name;"

    if [ $? -eq 0 ]; then
        echo -e "${COLOR_GREEN}Database created successfully${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}Failed to create database${COLOR_RESET}"
    fi

    echo ""
    read -p "Press Enter to continue..."
}

show_variables() {
    show_header
    echo -e "${COLOR_BLUE}=== MySQL/MariaDB Variables ===${COLOR_RESET}"
    echo ""

    local service_name="mariadb"
    if ! systemctl list-unit-files | grep -q "^mariadb.service"; then
        service_name="mysql"
    fi

    if ! systemctl is-active --quiet $service_name; then
        echo -e "${COLOR_RED}MySQL/MariaDB is not running${COLOR_RESET}"
        read -p "Press Enter to continue..."
        return
    fi

    echo "1) Show all variables"
    echo "2) Show specific variable"
    echo "0) Back to main menu"
    echo ""

    read -p "Select option: " choice

    case $choice in
        1)
            $USE_SUDO mysql -e "SHOW VARIABLES;" | less
            ;;
        2)
            read -p "Enter variable name (e.g., max_connections): " var_name
            if [ -n "$var_name" ]; then
                $USE_SUDO mysql -e "SHOW VARIABLES LIKE '$var_name';"
                echo ""
                read -p "Press Enter to continue..."
            fi
            ;;
    esac
}

view_config() {
    show_header
    echo -e "${COLOR_BLUE}=== MySQL/MariaDB Configuration ===${COLOR_RESET}"
    echo ""

    if [ -f "$MYSQL_CONFIG" ]; then
        less "$MYSQL_CONFIG"
    else
        echo -e "${COLOR_RED}Configuration file not found: $MYSQL_CONFIG${COLOR_RESET}"
    fi

    read -p "Press Enter to continue..."
}

show_menu() {
    show_header
    show_mysql_status

    echo -e "${COLOR_CYAN}Menu:${COLOR_RESET}"
    echo "  1) Start MySQL/MariaDB"
    echo "  2) Stop MySQL/MariaDB"
    echo "  3) Restart MySQL/MariaDB"
    echo "  4) Show Basic Information"
    echo "  5) List Databases"
    echo "  6) List Users"
    echo "  7) Show Active Connections"
    echo "  8) Create New Database"
    echo "  9) Show Variables"
    echo " 10) View Configuration File"
    echo "  0) Exit"
    echo ""
}

main() {
    if ! check_mysql_installed; then
        exit 1
    fi

    while true; do
        show_menu
        read -p "Select option: " choice

        case $choice in
            1) start_mysql ;;
            2) stop_mysql ;;
            3) restart_mysql ;;
            4) show_mysql_info ;;
            5) list_databases ;;
            6) list_users ;;
            7) show_connections ;;
            8) create_database ;;
            9) show_variables ;;
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
