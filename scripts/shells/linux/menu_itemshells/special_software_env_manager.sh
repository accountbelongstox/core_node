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

# =============================================================================
# Special Software Environment Variables Manager
# =============================================================================
# Linux version of SpecialSoftwareEnvManager.ps1
# Manages environment variables for special software like AI tools

# =============================================================================
# Variable Declarations
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MENU_FUNC_DIR="$SCRIPT_DIR/menu_func"
COMMON_DIR="$(cd "$SCRIPT_DIR/../common" && pwd)"
LINUX_PATH_FUNCTION_SCRIPT="$COMMON_DIR/linux_path_function.sh"

# Export for submenus
export LINUX_PATH_FUNCTION_SCRIPT

# Colors
COLOR_RESET='\033[0m'
COLOR_RED='\033[0;31m'
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[0;33m'
COLOR_BLUE='\033[0;34m'
COLOR_CYAN='\033[0;36m'

# =============================================================================
# Load Dependencies
# =============================================================================

# Source linux_path_function.sh
if [ ! -f "$LINUX_PATH_FUNCTION_SCRIPT" ]; then
    echo -e "${COLOR_RED}[ERROR] linux_path_function.sh not found${COLOR_RESET}"
    echo -e "${COLOR_RED}Expected at: $LINUX_PATH_FUNCTION_SCRIPT${COLOR_RESET}"
    exit 1
fi

source "$LINUX_PATH_FUNCTION_SCRIPT"

# Load menu modules
if [ -f "$MENU_FUNC_DIR/ssh_menu.sh" ]; then
    source "$MENU_FUNC_DIR/ssh_menu.sh"
fi

# =============================================================================
# Main Menu Functions
# =============================================================================

show_main_menu() {
    local selected_index=0
    local menu_items=(
        "SSH Connection"
        "View All Environment Variables"
        "Refresh Current Terminal Environment"
        "Exit"
    )

    while true; do
        clear
        echo -e "${COLOR_CYAN}╔════════════════════════════════════════════════════╗${COLOR_RESET}"
        echo -e "${COLOR_CYAN}║  Special Software Environment Variables Manager  ║${COLOR_RESET}"
        echo -e "${COLOR_CYAN}╚════════════════════════════════════════════════════╝${COLOR_RESET}"
        echo ""
        echo -e "${COLOR_BLUE}Use Up/Down arrows to navigate, Enter to select${COLOR_RESET}"
        echo ""

        for i in "${!menu_items[@]}"; do
            if [ $i -eq $selected_index ]; then
                if [ "${menu_items[$i]}" = "Exit" ]; then
                    echo -e "${COLOR_YELLOW}> ${menu_items[$i]}${COLOR_RESET}"
                else
                    echo -e "${COLOR_YELLOW}> ${menu_items[$i]} >${COLOR_RESET}"
                fi
            else
                if [ "${menu_items[$i]}" = "Exit" ]; then
                    echo -e "  ${menu_items[$i]}"
                else
                    echo -e "  ${menu_items[$i]} >"
                fi
            fi
        done

        echo ""
        echo -e "${COLOR_CYAN}════════════════════════════════════════════════════${COLOR_RESET}"

        # Read arrow keys
        read -rsn1 key
        case "$key" in
            $'\x1b')  # ESC sequence
                read -rsn2 key
                case "$key" in
                    '[A')  # Up arrow
                        selected_index=$(( (selected_index - 1 + ${#menu_items[@]}) % ${#menu_items[@]} ))
                        ;;
                    '[B')  # Down arrow
                        selected_index=$(( (selected_index + 1) % ${#menu_items[@]} ))
                        ;;
                esac
                ;;
            '')  # Enter key
                case $selected_index in
                    0)  # SSH Connection
                        show_ssh_submenu
                        ;;
                    1)  # View All Environment Variables
                        view_all_env_variables
                        ;;
                    2)  # Refresh Environment
                        refresh_environment
                        ;;
                    3)  # Exit
                        clear
                        echo -e "${COLOR_GREEN}[INFO] Exiting...${COLOR_RESET}"
                        exit 0
                        ;;
                esac
                ;;
            'q'|'Q')  # Quick exit
                clear
                echo -e "${COLOR_GREEN}[INFO] Exiting...${COLOR_RESET}"
                exit 0
                ;;
        esac
    done
}

view_all_env_variables() {
    clear
    echo -e "${COLOR_CYAN}=== All Environment Variables ===${COLOR_RESET}"
    echo ""

    printenv | sort | less

    read -p "Press Enter to continue..."
}

refresh_environment() {
    clear
    echo -e "${COLOR_CYAN}=== Refresh Environment ===${COLOR_RESET}"
    echo ""

    log_info "Refreshing environment from ~/.bashrc..."

    # Source bashrc
    if [ -f "$HOME/.bashrc" ]; then
        source "$HOME/.bashrc"
        log_success "Environment refreshed from ~/.bashrc"
    else
        log_warning "~/.bashrc not found"
    fi

    # Show current PATH
    echo ""
    log_info "Current PATH:"
    echo "$PATH" | tr ':' '\n' | nl

    echo ""
    read -p "Press Enter to continue..."
}

# =============================================================================
# Initialization
# =============================================================================

initialize() {
    # Ensure liunxenvs directory exists
    ensure_liunxenvs_dir

    # Add liunxenvs to PATH
    add_dir_to_path "$LIUNXENVS_DIR"

    # Check for required tools
    if ! command -v sshpass &> /dev/null; then
        log_warning "sshpass not installed. Install it for password-based SSH connections:"
        log_info "  Ubuntu/Debian: sudo apt-get install sshpass"
        log_info "  CentOS/RHEL: sudo yum install sshpass"
    fi
}

# =============================================================================
# Main Entry Point
# =============================================================================

main() {
    initialize
    show_main_menu
}

# Run main
main
