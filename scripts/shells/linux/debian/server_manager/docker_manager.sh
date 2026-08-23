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

DOCKER_CONFIG="/etc/docker/daemon.json"

COLOR_RESET="\033[0m"
COLOR_RED="\033[31m"
COLOR_GREEN="\033[32m"
COLOR_YELLOW="\033[33m"
COLOR_BLUE="\033[34m"
COLOR_CYAN="\033[36m"

check_docker_installed() {
    if ! command -v docker >/dev/null 2>&1; then
        echo -e "${COLOR_RED}Docker is not installed!${COLOR_RESET}"
        echo "Please run installation script first: 79_install_docker.sh"
        return 1
    fi
    return 0
}

show_header() {
    clear
    echo -e "${COLOR_CYAN}========================================${COLOR_RESET}"
    echo -e "${COLOR_CYAN}    Docker Management Script${COLOR_RESET}"
    echo -e "${COLOR_CYAN}========================================${COLOR_RESET}"
    echo ""
}

show_docker_status() {
    echo -e "${COLOR_BLUE}=== Docker Service Status ===${COLOR_RESET}"
    systemctl status docker --no-pager -l | head -20
    echo ""
}

show_docker_info() {
    show_header
    echo -e "${COLOR_BLUE}=== Docker Basic Information ===${COLOR_RESET}"
    echo ""

    echo -e "${COLOR_CYAN}Version:${COLOR_RESET}"
    docker --version
    echo ""

    echo -e "${COLOR_CYAN}Docker Compose Version:${COLOR_RESET}"
    docker-compose --version 2>/dev/null || echo "Docker Compose not installed"
    echo ""

    show_docker_status

    if systemctl is-active --quiet docker; then
        echo -e "${COLOR_CYAN}Docker System Info:${COLOR_RESET}"
        docker system info 2>/dev/null | head -30
        echo ""
    fi

    read -p "Press Enter to continue..."
}

start_docker() {
    show_header
    echo -e "${COLOR_BLUE}=== Starting Docker ===${COLOR_RESET}"

    if systemctl is-active --quiet docker; then
        echo -e "${COLOR_YELLOW}Docker is already running${COLOR_RESET}"
    else
        echo "Starting Docker service..."
        $USE_SUDO systemctl start docker

        if [ $? -eq 0 ]; then
            echo -e "${COLOR_GREEN}Docker started successfully${COLOR_RESET}"
            $USE_SUDO systemctl enable docker
        else
            echo -e "${COLOR_RED}Failed to start Docker${COLOR_RESET}"
        fi
    fi

    echo ""
    show_docker_status
    read -p "Press Enter to continue..."
}

stop_docker() {
    show_header
    echo -e "${COLOR_BLUE}=== Stopping Docker ===${COLOR_RESET}"

    if ! systemctl is-active --quiet docker; then
        echo -e "${COLOR_YELLOW}Docker is not running${COLOR_RESET}"
    else
        echo "Stopping Docker service..."
        $USE_SUDO systemctl stop docker

        if [ $? -eq 0 ]; then
            echo -e "${COLOR_GREEN}Docker stopped successfully${COLOR_RESET}"
        else
            echo -e "${COLOR_RED}Failed to stop Docker${COLOR_RESET}"
        fi
    fi

    echo ""
    show_docker_status
    read -p "Press Enter to continue..."
}

restart_docker() {
    show_header
    echo -e "${COLOR_BLUE}=== Restarting Docker ===${COLOR_RESET}"

    echo "Restarting Docker service..."
    $USE_SUDO systemctl restart docker

    if [ $? -eq 0 ]; then
        echo -e "${COLOR_GREEN}Docker restarted successfully${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}Failed to restart Docker${COLOR_RESET}"
    fi

    echo ""
    show_docker_status
    read -p "Press Enter to continue..."
}

list_containers() {
    show_header
    echo -e "${COLOR_BLUE}=== Docker Containers ===${COLOR_RESET}"
    echo ""

    if ! systemctl is-active --quiet docker; then
        echo -e "${COLOR_RED}Docker is not running${COLOR_RESET}"
        read -p "Press Enter to continue..."
        return
    fi

    echo -e "${COLOR_CYAN}Running Containers:${COLOR_RESET}"
    docker ps
    echo ""

    echo -e "${COLOR_CYAN}All Containers (including stopped):${COLOR_RESET}"
    docker ps -a
    echo ""

    read -p "Press Enter to continue..."
}

list_images() {
    show_header
    echo -e "${COLOR_BLUE}=== Docker Images ===${COLOR_RESET}"
    echo ""

    if ! systemctl is-active --quiet docker; then
        echo -e "${COLOR_RED}Docker is not running${COLOR_RESET}"
        read -p "Press Enter to continue..."
        return
    fi

    echo -e "${COLOR_CYAN}Available Images:${COLOR_RESET}"
    docker images
    echo ""

    read -p "Press Enter to continue..."
}

list_volumes() {
    show_header
    echo -e "${COLOR_BLUE}=== Docker Volumes ===${COLOR_RESET}"
    echo ""

    if ! systemctl is-active --quiet docker; then
        echo -e "${COLOR_RED}Docker is not running${COLOR_RESET}"
        read -p "Press Enter to continue..."
        return
    fi

    echo -e "${COLOR_CYAN}Available Volumes:${COLOR_RESET}"
    docker volume ls
    echo ""

    read -p "Press Enter to continue..."
}

list_networks() {
    show_header
    echo -e "${COLOR_BLUE}=== Docker Networks ===${COLOR_RESET}"
    echo ""

    if ! systemctl is-active --quiet docker; then
        echo -e "${COLOR_RED}Docker is not running${COLOR_RESET}"
        read -p "Press Enter to continue..."
        return
    fi

    echo -e "${COLOR_CYAN}Available Networks:${COLOR_RESET}"
    docker network ls
    echo ""

    read -p "Press Enter to continue..."
}

show_disk_usage() {
    show_header
    echo -e "${COLOR_BLUE}=== Docker Disk Usage ===${COLOR_RESET}"
    echo ""

    if ! systemctl is-active --quiet docker; then
        echo -e "${COLOR_RED}Docker is not running${COLOR_RESET}"
        read -p "Press Enter to continue..."
        return
    fi

    docker system df
    echo ""

    read -p "Press Enter to continue..."
}

cleanup_system() {
    show_header
    echo -e "${COLOR_BLUE}=== Docker System Cleanup ===${COLOR_RESET}"
    echo ""

    if ! systemctl is-active --quiet docker; then
        echo -e "${COLOR_RED}Docker is not running${COLOR_RESET}"
        read -p "Press Enter to continue..."
        return
    fi

    echo "This will remove:"
    echo "  - All stopped containers"
    echo "  - All networks not used by at least one container"
    echo "  - All dangling images"
    echo "  - All dangling build cache"
    echo ""

    read -p "Do you want to continue? (y/n): " confirm

    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        docker system prune -f
        echo -e "${COLOR_GREEN}Cleanup completed${COLOR_RESET}"
    else
        echo "Operation cancelled"
    fi

    echo ""
    read -p "Press Enter to continue..."
}

view_config() {
    show_header
    echo -e "${COLOR_BLUE}=== Docker Configuration ===${COLOR_RESET}"
    echo ""

    if [ -f "$DOCKER_CONFIG" ]; then
        echo -e "${COLOR_CYAN}Configuration File: $DOCKER_CONFIG${COLOR_RESET}"
        echo ""
        cat "$DOCKER_CONFIG"
    else
        echo -e "${COLOR_YELLOW}Configuration file not found: $DOCKER_CONFIG${COLOR_RESET}"
        echo "Using default configuration"
    fi

    echo ""
    read -p "Press Enter to continue..."
}

show_menu() {
    local menu_items=(
        "Start Docker"
        "Stop Docker"
        "Restart Docker"
        "Show Basic Information"
        "List Containers"
        "List Images"
        "List Volumes"
        "List Networks"
        "Show Disk Usage"
        "System Cleanup (prune)"
        "View Configuration"
        "Back to Service Manager"
    )

    arrow_menu_select "Docker Manager" menu_items 0 11 show_docker_status
    if [ "$ARROW_MENU_SELECTED_INDEX" -eq 11 ]; then
        choice=0
    else
        choice=$((ARROW_MENU_SELECTED_INDEX + 1))
    fi
}

main() {
    if ! check_docker_installed; then
        exit 1
    fi

    while true; do
        show_menu

        case $choice in
            1) start_docker ;;
            2) stop_docker ;;
            3) restart_docker ;;
            4) show_docker_info ;;
            5) list_containers ;;
            6) list_images ;;
            7) list_volumes ;;
            8) list_networks ;;
            9) show_disk_usage ;;
            10) cleanup_system ;;
            11) view_config ;;
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
