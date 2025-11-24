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
# VIOLATION OF THESE RULES IS STRICTLY FORBIDDEN
# ### AI SPECIAL ATTENTION RULES END ###

# =============================================================================
# Linux Management Functions
# =============================================================================

# Source constants (backup copy)
source "$DD_HELPER_DIR/constants.sh"

# Build full paths from constants
DISABLE_UBUNTU_AUTO_UPDATES_SCRIPT_PATH="$CORE_NODE_ROOT_DIR/$DISABLE_UBUNTU_AUTO_UPDATES_SCRIPT_RELATIVE"
PERMISSIONS_REPAIR_MENU_SCRIPT="$DD_HELPER_DIR/permissions_repair_menu.sh"

# Function to disable Ubuntu automatic updates
disable_ubuntu_auto_updates() {
    echo "Disabling Ubuntu automatic updates..."
    echo "This will prevent kernel updates that may cause graphics driver issues."
    echo ""
    
    if [ -s "$DISABLE_UBUNTU_AUTO_UPDATES_SCRIPT_PATH" ]; then
        bash "$DISABLE_UBUNTU_AUTO_UPDATES_SCRIPT_PATH"
        if [ $? -eq 0 ]; then
            echo "Ubuntu automatic updates disabled successfully"
        else
            echo "Failed to disable Ubuntu automatic updates"
        fi
    else
        echo "Error: Script not found at: $DISABLE_UBUNTU_AUTO_UPDATES_SCRIPT_PATH"
        return 1
    fi
    
    echo ""
    echo "Press Enter to continue..."
    read
}

# Function to show permissions repair menu
show_permissions_repair_menu() {
    echo "Opening Permissions Repair Menu..."
    echo ""
    
    if [ -s "$PERMISSIONS_REPAIR_MENU_SCRIPT" ]; then
        source "$PERMISSIONS_REPAIR_MENU_SCRIPT"
        run_permissions_repair_menu "$CORE_NODE_ROOT_DIR"
    else
        echo "Error: Permissions repair menu script not found at: $PERMISSIONS_REPAIR_MENU_SCRIPT"
        echo ""
        echo "Press Enter to continue..."
        read
        return 1
    fi
}

# Function to manage NAT Gateway
manage_natgateway() {
    echo "NAT Gateway Configuration"
    echo ""
    
    local natgateway_script="$CORE_NODE_ROOT_DIR/scripts/shells/linux/debian/install_shells/101_natgateway.sh"
    
    if [ ! -f "$natgateway_script" ]; then
        echo "Error: NAT gateway script not found at: $natgateway_script"
        echo ""
        echo "Press Enter to continue..."
        read
        return
    fi
    
    echo "Launching NAT Gateway configuration..."
    echo ""
    
    if [ ! -x "$natgateway_script" ]; then
        chmod +x "$natgateway_script"
    fi
    
    bash "$natgateway_script"
    
    local exit_code=$?
    echo ""
    
    if [ $exit_code -eq 0 ]; then
        echo "NAT Gateway configuration completed successfully."
    else
        echo "NAT Gateway configuration exited with code: $exit_code"
    fi
    
    echo ""
    echo "Press Enter to continue..."
    read
}

# Function to show system information
show_system_information() {
    echo ""
    echo "System Information:"
    echo "==================="
    if [ -s /etc/os-release ]; then
        . /etc/os-release
        echo "OS: $PRETTY_NAME"
        echo "Version: $VERSION"
        echo "Kernel: $(uname -r)"
        echo "Architecture: $(uname -m)"
    fi
    echo ""
    echo "Memory:"
    free -h
    echo ""
    echo "Disk Usage:"
    df -h | grep -E "^/dev/"
    echo ""
    echo "Press Enter to continue..."
    read
}

# Function to show Linux management submenu
show_linux_management_submenu() {
    local selected=0
    local total=5
    local old_settings=$(stty -g)
    stty -icanon -echo
    trap 'stty "$old_settings"' RETURN
    
    local menu_items=(
        "Disable Ubuntu Automatic Updates"
        "Permissions Repair Menu"
        "NAT Gateway Configuration"
        "Show System Information"
        "Back to Main Menu"
    )
    
    while true; do
        printf "\033c"
        echo "=========================================="
        echo "Linux Management Menu"
        echo "=========================================="
        echo "Select an option (Up/Down to move, Enter to select):"
        echo "Press Ctrl+C to go back"
        echo ""

        for i in "${!menu_items[@]}"; do
            if [ "$i" -eq "$selected" ]; then
                printf "\033[47m\033[30m> %-40s\033[0m\n" "${menu_items[$i]}"
            else
                printf "  %-40s\n" "${menu_items[$i]}"
            fi
        done

        local char
        char=$(dd bs=1 count=1 2>/dev/null)

        case "$char" in
            $'\x1B')
                read -r -t 0.1 -d '' seq
                case "$seq" in
                    '[A')
                        ((selected--))
                        [ "$selected" -lt 0 ] && selected=$((total - 1))
                        ;;
                    '[B')
                        ((selected++))
                        [ "$selected" -ge "$total" ] && selected=0
                        ;;
                esac
                ;;
            '')
                stty "$old_settings"
                printf "\033c"

                case "$selected" in
                    0)
                        disable_ubuntu_auto_updates
                        ;;
                    1)
                        show_permissions_repair_menu
                        ;;
                    2)
                        manage_natgateway
                        ;;
                    3)
                        show_system_information
                        ;;
                    4)
                        return 0
                        ;;
                esac

                stty -icanon -echo
                ;;
        esac
    done
}
