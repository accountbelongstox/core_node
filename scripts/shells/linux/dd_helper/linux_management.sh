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
        # Source the script to access its functions
        source "$PERMISSIONS_REPAIR_MENU_SCRIPT"
        # Call the menu function with the project root
        run_permissions_repair_menu "$CORE_NODE_ROOT_DIR"
    else
        echo "Error: Permissions repair menu script not found at: $PERMISSIONS_REPAIR_MENU_SCRIPT"
        echo ""
        echo "Press Enter to continue..."
        read
        return 1
    fi
}

# Function to show Linux management submenu
show_linux_management_submenu() {
    while true; do
        clear
        echo "=========================================="
        echo "Linux Management Menu"
        echo "=========================================="
        echo "1) Disable Ubuntu Automatic Updates"
        echo "2) Permissions Repair Menu"
        echo "3) Show System Information"
        echo "4) Back to Main Menu"
        echo "=========================================="
        echo -n "Enter your choice (1-4): "
        
        read -r choice
        case "$choice" in
            1)
                disable_ubuntu_auto_updates
                ;;
            2)
                show_permissions_repair_menu
                ;;
            3)
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
                ;;
            4)
                return 0
                ;;
            *)
                echo "Invalid choice. Please try again."
                sleep 1
                ;;
        esac
    done
}

