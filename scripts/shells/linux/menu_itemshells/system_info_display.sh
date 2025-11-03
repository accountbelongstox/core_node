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

# System Information Display Script
# Displays system information and global variables

# =============================================================================
# Variable Declarations
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"
COMMON_DIR="$PARENT_DIR/common"

# Source common functions
source "/mnt/dev_sdb3/programing/core_node/scripts/shells/linux/common/gvar_common.sh"

selected_option=""
current_system=""

# =============================================================================
# Functions
# =============================================================================

show_complete_system_info() {
    clear
    echo "========================================="
    echo "  Complete System Information"
    echo "========================================="
    echo ""

    # Current System Status
    echo "--- Current System Status ---"
    current_system=$(get_global_var "CURRENT_SYSTEM" "UNKNOWN")
    echo "Current System: $current_system"

    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo "Distribution: $NAME"
        echo "Version: $VERSION"
        echo "ID: $ID"
        echo "Codename: ${VERSION_CODENAME:-N/A}"
    fi

    echo ""
    echo "System Resources:"
    echo "  Memory: $(free -h | grep Mem: | awk '{print $2}')"
    echo "  CPU: $(nproc) cores"
    echo ""

    echo "--- Disk Usage Information ---"
    echo ""

    echo "All Mounted Filesystems:"
    df -h --output=source,fstype,size,used,avail,pcent,target | awk '
    BEGIN {
        printf "%-25s %-10s %8s %8s %8s %6s  %s\n", "Filesystem", "Type", "Size", "Used", "Avail", "Use%", "Mounted on"
        printf "%-25s %-10s %8s %8s %8s %6s  %s\n", "----------", "----", "----", "----", "-----", "----", "----------"
    }
    NR>1 {
        printf "%-25s %-10s %8s %8s %8s %6s  %s\n", $1, $2, $3, $4, $5, $6, $7
    }'

    echo ""
    echo "Main Physical Disks:"
    df -h | grep -E '^/dev/(sd|nvme|vd|hd)' | awk '{printf "  %s: %s / %s used (%s)\n", $6, $3, $2, $5}'

    echo ""
    echo "Total Disk Summary:"
    df -h --total | tail -1 | awk '{printf "  Total: %s / %s used (%s available)\n", $3, $2, $4}'
    echo ""

    # Basic System Information
    echo "--- Basic System Information ---"
    uname -a
    echo ""

    # Detailed System Information
    echo "--- Detailed System Information ---"
    if [ -f /etc/os-release ]; then
        cat /etc/os-release
    else
        echo "OS release information not available"
    fi

    echo ""
    echo "Kernel: $(uname -r)"
    echo "Architecture: $(uname -m)"
    echo "Hostname: $(hostname)"

    if command -v lsb_release >/dev/null 2>&1; then
        echo ""
        echo "LSB Information:"
        lsb_release -a 2>/dev/null
    fi

    echo ""

    # Network Information
    echo "--- Network Information ---"
    ip addr show
    echo ""

    echo "Press Enter to return to menu..."
    read
}

show_global_vars() {
    clear
    echo "========================================="
    echo "  Global Variables"
    echo "========================================="
    echo ""
    echo "Global Variables Directory: $GLOBAL_VAR_DIR"
    echo ""

    if [ -d "$GLOBAL_VAR_DIR" ] && [ "$(ls -A $GLOBAL_VAR_DIR 2>/dev/null)" ]; then
        for file in "$GLOBAL_VAR_DIR"/*; do
            if [ -f "$file" ]; then
                filename=$(basename "$file")
                value=$(cat "$file" 2>/dev/null)
                printf "%-30s = %s\n" "$filename" "$value"
            fi
        done
    else
        echo "No global variables found."
    fi

    echo ""
    echo "Press Enter to return to menu..."
    read
}

# =============================================================================
# Main Menu
# =============================================================================

show_menu() {
    while true; do
        clear
        echo "========================================="
        echo "  System Information & Variables Menu"
        echo "========================================="
        echo ""
        echo "1. Show Complete System Information"
        echo "2. Show Global Variables"
        echo "0. Exit"
        echo ""
        read -p "Select option: " selected_option

        case "$selected_option" in
            1)
                show_complete_system_info
                ;;
            2)
                show_global_vars
                ;;
            0)
                echo "Returning to main menu..."
                exit 0
                ;;
            *)
                echo "Invalid option. Press Enter to continue..."
                read
                ;;
        esac
    done
}

# Run main menu
show_menu
