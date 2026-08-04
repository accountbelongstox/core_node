#!/bin/bash
# =============================================================================
# Permissions Repair Menu Script
# =============================================================================
# This script provides a comprehensive menu for repairing various permission 
# issues in the Core Node project. It allows users to choose specific repair
# operations instead of running all fixes at once.
# =============================================================================

# Source smart_permissions.sh and gvar_common.sh for repair functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/smart_permissions.sh"
source "$SCRIPT_DIR/../common/gvar_common.sh"

# =============================================================================
# Comprehensive Permission Repair Functions
# =============================================================================

fix_core_node_permissions_full() {
    local project_root="$1"
    local user_info="$2"
    local real_user="${user_info%%:*}"
    local real_group=""
    local parent_dir=""
    local build_dir=""
    local laravel_db_dir=""

    echo "[INFO] Fixing Core Node full permissions..."
    echo "[SAFE_PATH] project_root=$project_root"
    echo "[INFO] Real user: $real_user"
    real_group="$(id -gn "$real_user" 2>/dev/null || echo "$real_user")"
    parent_dir="$(dirname "$project_root")"
    build_dir="$parent_dir/_build_dir"
    laravel_db_dir="$(map_web_path "laravel_db" 2>/dev/null)"

    repair_owned_tree_777 "$project_root" "$real_user" "$real_group" || return $?
    ensure_owned_tree_777 "$build_dir" "$real_user" "$real_group" || return $?
    if [ -n "$laravel_db_dir" ] && [ -d "$laravel_db_dir" ]; then
        repair_owned_tree_777 "$laravel_db_dir" "$real_user" "$real_group" || return $?
    fi
    echo "[SUCCESS] Full Core Node permissions fixed"
}

fix_python_permissions() {
    local project_root="$1"
    local user_info="$2"
    local real_user="${user_info%%:*}"
    local real_group=""

    echo "[INFO] Fixing Python-specific permissions..."
    echo "[SAFE_PATH] project_root=$project_root"
    real_group="$(id -gn "$real_user" 2>/dev/null || echo "$real_user")"
    repair_owned_tree_777 "$project_root/pycore" "$real_user" "$real_group" || return $?
    repair_owned_tree_777 "$project_root/pyapps" "$real_user" "$real_group" || return $?
    echo "[SUCCESS] Python permissions fixed"
}

fix_node_permissions() {
    local project_root="$1"
    local user_info="$2"
    local real_user="${user_info%%:*}"
    local real_group=""

    echo "[INFO] Fixing Node.js-specific permissions..."
    echo "[SAFE_PATH] project_root=$project_root"
    real_group="$(id -gn "$real_user" 2>/dev/null || echo "$real_user")"
    repair_owned_tree_777 "$project_root/ncore" "$real_user" "$real_group" || return $?
    repair_owned_tree_777 "$project_root/apps" "$real_user" "$real_group" || return $?
    echo "[SUCCESS] Node.js permissions fixed"
}

repair_ai_tools_comprehensive() {
    local project_root="$1"
    local user_info="$2"
    
    echo "[INFO] Comprehensive AI tools repair..."
    
    # List of AI tools to repair
    local ai_tools=("claude" "codex" "droid")
    
    for tool in "${ai_tools[@]}"; do
        echo "[INFO] Repairing $tool..."
        repair_ai_tool_simple "$tool" "$user_info"
    done
    
    echo "[SUCCESS] AI tools repair completed"
}

# =============================================================================
# Menu Functions
# =============================================================================

show_permissions_menu() {
    echo ""
    echo "============================================================"
    echo "              Permissions Repair Menu"
    echo "============================================================"
    echo ""
    echo "Choose repair operation:"
    echo ""
    echo "1) Essential Repair (Fast) - Core Node root & scripts only"
    echo "2) Full Core Node Repair - All project directories"
    echo "3) Python Permissions - pycore & pyapps directories"
    echo "4) Node.js Permissions - ncore & apps directories"
    echo "5) /var/_core_node Permissions - MyBest directories"
    echo "6) Environment Variables Setup"
    echo "7) AI Tools Repair - claude, codex, droid"
    echo "8) Complete System Repair - All of the above"
    echo "9) Back to main menu"
    echo ""
    echo "============================================================"
}

handle_permissions_choice() {
    local choice="$1"
    local project_root="${2:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"
    local user_info="$(get_real_user_info "$project_root")"
    
    case "$choice" in
        1)
            echo "[INFO] Running essential repair..."
            fix_core_node_permissions_essential "$project_root" "$user_info"
            ;;
        2)
            echo "[INFO] Running full Core Node repair..."
            fix_core_node_permissions_full "$project_root" "$user_info"
            ;;
        3)
            echo "[INFO] Running Python permissions repair..."
            fix_python_permissions "$project_root" "$user_info"
            ;;
        4)
            echo "[INFO] Running Node.js permissions repair..."
            fix_node_permissions "$project_root" "$user_info"
            ;;
        5)
            echo "[INFO] Running /var/_core_node permissions repair..."
            fix_var_core_node_permissions "$project_root" "$user_info"
            ;;
        6)
            echo "[INFO] Setting up environment variables..."
            setup_environment_variables "$project_root"
            ;;
        7)
            echo "[INFO] Running AI tools repair..."
            repair_ai_tools_comprehensive "$project_root" "$user_info"
            ;;
        8)
            echo "[INFO] Running complete system repair..."
            echo "[INFO] This will perform all repair operations..."
            fix_core_node_permissions_full "$project_root" "$user_info"
            fix_var_core_node_permissions "$project_root" "$user_info"
            setup_environment_variables "$project_root"
            repair_ai_tools_comprehensive "$project_root" "$user_info"
            echo "[SUCCESS] Complete system repair finished"
            ;;
        9)
            echo "[INFO] Returning to main menu..."
            return 0
            ;;
        *)
            echo "[ERROR] Invalid choice: $choice"
            return 1
            ;;
    esac
    
    if [ "$choice" != "9" ]; then
        echo ""
        read -p "Press Enter to continue..."
    fi
}

# =============================================================================
# Main Menu Loop
# =============================================================================

permissions_repair_menu() {
    local project_root="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"
    
    while true; do
        show_permissions_menu
        read -p "Enter your choice [1-9]: " choice
        
        if [ "$choice" = "9" ]; then
            break
        fi
        
        handle_permissions_choice "$choice" "$project_root"
    done
}

# =============================================================================
# Export functions for dd.sh integration
# =============================================================================

# Function that dd.sh can call directly
run_permissions_repair_menu() {
    local project_root="$1"
    permissions_repair_menu "$project_root"
}

# =============================================================================
# Main execution when called directly
# =============================================================================
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    # Called directly, run the menu
    permissions_repair_menu "$1"
fi
