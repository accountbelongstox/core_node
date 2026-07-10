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

SSH_CONFIG="/etc/ssh/sshd_config"
SSH_SERVICE="ssh"

COLOR_RESET="\033[0m"
COLOR_RED="\033[31m"
COLOR_GREEN="\033[32m"
COLOR_YELLOW="\033[33m"
COLOR_BLUE="\033[34m"
COLOR_CYAN="\033[36m"

check_ssh_installed() {
    if ! command -v sshd >/dev/null 2>&1; then
        echo -e "${COLOR_RED}SSH server is not installed!${COLOR_RESET}"
        echo "Please run installation script first: 20_setup_ssh_remote.sh"
        return 1
    fi

    if systemctl list-unit-files | grep -q "^sshd.service"; then
        SSH_SERVICE="sshd"
    elif systemctl list-unit-files | grep -q "^ssh.service"; then
        SSH_SERVICE="ssh"
    else
        echo -e "${COLOR_RED}SSH service not found!${COLOR_RESET}"
        return 1
    fi

    return 0
}

show_header() {
    clear
    echo -e "${COLOR_CYAN}========================================${COLOR_RESET}"
    echo -e "${COLOR_CYAN}    SSH Server Management Script${COLOR_RESET}"
    echo -e "${COLOR_CYAN}========================================${COLOR_RESET}"
    echo ""
}

show_ssh_status() {
    echo -e "${COLOR_BLUE}=== SSH Service Status ===${COLOR_RESET}"
    systemctl status $SSH_SERVICE --no-pager -l | head -20
    echo ""
}

show_ssh_info() {
    show_header
    echo -e "${COLOR_BLUE}=== SSH Server Basic Information ===${COLOR_RESET}"
    echo ""

    echo -e "${COLOR_CYAN}Version:${COLOR_RESET}"
    sshd -V 2>&1 | head -1
    echo ""

    echo -e "${COLOR_CYAN}Configuration File:${COLOR_RESET}"
    echo "$SSH_CONFIG"
    echo ""

    show_ssh_status

    echo -e "${COLOR_CYAN}Listening Ports:${COLOR_RESET}"
    $USE_SUDO netstat -tlnp | grep sshd || $USE_SUDO ss -tlnp | grep sshd
    echo ""

    if systemctl is-active --quiet $SSH_SERVICE; then
        echo -e "${COLOR_CYAN}Active SSH Connections:${COLOR_RESET}"
        who
        echo ""
    fi

    read -p "Press Enter to continue..."
}

start_ssh() {
    show_header
    echo -e "${COLOR_BLUE}=== Starting SSH Server ===${COLOR_RESET}"

    if systemctl is-active --quiet $SSH_SERVICE; then
        echo -e "${COLOR_YELLOW}SSH server is already running${COLOR_RESET}"
    else
        echo "Starting SSH service..."
        $USE_SUDO systemctl start $SSH_SERVICE

        if [ $? -eq 0 ]; then
            echo -e "${COLOR_GREEN}SSH server started successfully${COLOR_RESET}"
            $USE_SUDO systemctl enable $SSH_SERVICE
        else
            echo -e "${COLOR_RED}Failed to start SSH server${COLOR_RESET}"
        fi
    fi

    echo ""
    show_ssh_status
    read -p "Press Enter to continue..."
}

stop_ssh() {
    show_header
    echo -e "${COLOR_BLUE}=== Stopping SSH Server ===${COLOR_RESET}"

    if ! systemctl is-active --quiet $SSH_SERVICE; then
        echo -e "${COLOR_YELLOW}SSH server is not running${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}WARNING: Stopping SSH may disconnect your current session!${COLOR_RESET}"
        read -p "Are you sure you want to stop SSH? (yes/no): " confirm

        if [ "$confirm" = "yes" ]; then
            echo "Stopping SSH service..."
            $USE_SUDO systemctl stop $SSH_SERVICE

            if [ $? -eq 0 ]; then
                echo -e "${COLOR_GREEN}SSH server stopped successfully${COLOR_RESET}"
            else
                echo -e "${COLOR_RED}Failed to stop SSH server${COLOR_RESET}"
            fi
        else
            echo "Operation cancelled"
        fi
    fi

    echo ""
    show_ssh_status
    read -p "Press Enter to continue..."
}

restart_ssh() {
    show_header
    echo -e "${COLOR_BLUE}=== Restarting SSH Server ===${COLOR_RESET}"

    echo "Testing configuration before restart..."
    if ! $USE_SUDO sshd -t 2>&1; then
        echo -e "${COLOR_RED}Configuration test failed! Please fix errors before restarting.${COLOR_RESET}"
        read -p "Press Enter to continue..."
        return 1
    fi

    echo "Restarting SSH service..."
    $USE_SUDO systemctl restart $SSH_SERVICE

    if [ $? -eq 0 ]; then
        echo -e "${COLOR_GREEN}SSH server restarted successfully${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}Failed to restart SSH server${COLOR_RESET}"
    fi

    echo ""
    show_ssh_status
    read -p "Press Enter to continue..."
}

reload_ssh() {
    show_header
    echo -e "${COLOR_BLUE}=== Reloading SSH Configuration ===${COLOR_RESET}"

    echo "Testing configuration before reload..."
    if ! $USE_SUDO sshd -t 2>&1; then
        echo -e "${COLOR_RED}Configuration test failed! Please fix errors before reloading.${COLOR_RESET}"
        read -p "Press Enter to continue..."
        return 1
    fi

    echo "Reloading SSH configuration..."
    $USE_SUDO systemctl reload $SSH_SERVICE

    if [ $? -eq 0 ]; then
        echo -e "${COLOR_GREEN}SSH configuration reloaded successfully${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}Failed to reload SSH configuration${COLOR_RESET}"
    fi

    echo ""
    read -p "Press Enter to continue..."
}

show_connections() {
    show_header
    echo -e "${COLOR_BLUE}=== Active SSH Connections ===${COLOR_RESET}"
    echo ""

    if ! systemctl is-active --quiet $SSH_SERVICE; then
        echo -e "${COLOR_RED}SSH server is not running${COLOR_RESET}"
        read -p "Press Enter to continue..."
        return
    fi

    echo -e "${COLOR_CYAN}Current Users:${COLOR_RESET}"
    who
    echo ""

    echo -e "${COLOR_CYAN}SSH Sessions:${COLOR_RESET}"
    w
    echo ""

    echo -e "${COLOR_CYAN}Recent Login History:${COLOR_RESET}"
    last -10
    echo ""

    read -p "Press Enter to continue..."
}

show_authorized_keys() {
    show_header
    echo -e "${COLOR_BLUE}=== SSH Authorized Keys ===${COLOR_RESET}"
    echo ""

    echo -e "${COLOR_CYAN}Root Authorized Keys:${COLOR_RESET}"
    if [ -f "/root/.ssh/authorized_keys" ]; then
        cat "/root/.ssh/authorized_keys"
    else
        echo "  (not configured)"
    fi
    echo ""

    echo -e "${COLOR_CYAN}Current User Authorized Keys:${COLOR_RESET}"
    if [ -f "$HOME/.ssh/authorized_keys" ]; then
        cat "$HOME/.ssh/authorized_keys"
    else
        echo "  (not configured)"
    fi
    echo ""

    read -p "Press Enter to continue..."
}

test_config() {
    show_header
    echo -e "${COLOR_BLUE}=== Test SSH Configuration ===${COLOR_RESET}"
    echo ""

    echo "Running configuration test..."
    $USE_SUDO sshd -t 2>&1

    if [ $? -eq 0 ]; then
        echo -e "${COLOR_GREEN}Configuration is valid${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}Configuration has errors${COLOR_RESET}"
    fi

    echo ""
    read -p "Press Enter to continue..."
}

view_config() {
    show_header
    echo -e "${COLOR_BLUE}=== SSH Configuration ===${COLOR_RESET}"
    echo ""

    if [ -f "$SSH_CONFIG" ]; then
        less "$SSH_CONFIG"
    else
        echo -e "${COLOR_RED}Configuration file not found: $SSH_CONFIG${COLOR_RESET}"
    fi

    read -p "Press Enter to continue..."
}

view_logs() {
    show_header
    echo -e "${COLOR_BLUE}=== SSH Server Logs ===${COLOR_RESET}"
    echo ""

    echo "1) View last 50 lines"
    echo "2) View last 100 lines"
    echo "3) Follow logs (real-time)"
    echo "0) Back to main menu"
    echo ""

    read -p "Select option: " choice

    case $choice in
        1)
            journalctl -u $SSH_SERVICE -n 50 --no-pager
            echo ""
            read -p "Press Enter to continue..."
            ;;
        2)
            journalctl -u $SSH_SERVICE -n 100 --no-pager
            echo ""
            read -p "Press Enter to continue..."
            ;;
        3)
            echo "Press Ctrl+C to stop following logs..."
            journalctl -u $SSH_SERVICE -f
            ;;
    esac
}

show_menu() {
    show_header
    show_ssh_status

    echo -e "${COLOR_CYAN}Menu:${COLOR_RESET}"
    echo "  1) Start SSH Server"
    echo "  2) Stop SSH Server"
    echo "  3) Restart SSH Server"
    echo "  4) Reload Configuration"
    echo "  5) Show Basic Information"
    echo "  6) Show Active Connections"
    echo "  7) Show Authorized Keys"
    echo "  8) Test Configuration"
    echo "  9) View Configuration File"
    echo " 10) View Server Logs"
    echo "  0) Exit"
    echo ""
}

main() {
    if ! check_ssh_installed; then
        exit 1
    fi

    while true; do
        show_menu
        read -p "Select option: " choice

        case $choice in
            1) start_ssh ;;
            2) stop_ssh ;;
            3) restart_ssh ;;
            4) reload_ssh ;;
            5) show_ssh_info ;;
            6) show_connections ;;
            7) show_authorized_keys ;;
            8) test_config ;;
            9) view_config ;;
            10) view_logs ;;
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
