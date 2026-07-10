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

    echo "[INFO] Fixing Core Node full permissions..."
    echo "[SAFE_PATH] project_root=$project_root"
    echo "[INFO] Real user: $real_user"

    if ! safe_path_for_recursive_chown "$project_root"; then
        echo "[ERROR] project_root unsafe; refusing chown/chmod"
        return 1
    fi

    # Calculate build directory path dynamically (no hardcoding)
    local parent_dir="$(dirname "$project_root")"
    local build_dir="$parent_dir/_build_dir"

    # Full directories for comprehensive operation
    local full_dirs=(
        "$project_root"
        "$project_root/scripts"
        "$project_root/pycore"
        "$project_root/ncore"
        "$project_root/apps"
        "$project_root/pyapps"
        "$build_dir"
    )

    if [ "$(id -u)" -eq 0 ]; then
        echo "[INFO] Running as root - fixing full permissions"

        # Fix all directories with proper permissions
        for dir in "${full_dirs[@]}"; do
            if [ ! -d "$dir" ]; then
                echo "[INFO] Creating directory: $dir"
                mkdir -p "$dir" 2>/dev/null
            fi
            if [ -d "$dir" ]; then
                echo "[INFO] Setting 777 permissions for: $dir"
                chmod -R 777 "$dir" 2>/dev/null
                chown -R "$real_user:$real_user" "$dir" 2>/dev/null
                # Ensure all .sh files are executable
                find "$dir" -name "*.sh" -exec chmod 755 {} \; 2>/dev/null
            else
                echo "[WARNING] Failed to create/access directory: $dir"
            fi
        done

        # Fix Laravel database directory
        local laravel_db_dir=$(map_web_path "laravel_db" 2>/dev/null)
        [ -z "$laravel_db_dir" ] && laravel_db_dir="/www/wwwroot/laravel_db"
        if [ -d "$laravel_db_dir" ]; then
            echo "[INFO] Fixing Laravel database directory permissions: $laravel_db_dir"
            local detected_user=$(detect_system_user)
            chown -R ${detected_user}:${detected_user} "$laravel_db_dir" 2>/dev/null
            chmod -R 775 "$laravel_db_dir" 2>/dev/null
            # Fix SQLite database files
            find "$laravel_db_dir" -name "*.sqlite" -exec chmod 664 {} \; 2>/dev/null
            # Fix JSON status files
            find "$laravel_db_dir" -name "*.json" -exec chmod 664 {} \; 2>/dev/null
            echo "[SUCCESS] Laravel database directory permissions fixed"
        else
            echo "[INFO] Laravel database directory not found (may not be needed)"
        fi

        echo "[SUCCESS] Full Core Node permissions fixed"
    else
        echo "[WARNING] Not running as root - cannot perform full permission fix"
        echo "[INFO] Please run with sudo for comprehensive permission repair"
    fi
}

fix_python_permissions() {
    local project_root="$1"
    local user_info="$2"
    local real_user="${user_info%%:*}"

    echo "[INFO] Fixing Python-specific permissions..."
    echo "[SAFE_PATH] project_root=$project_root"
    if ! safe_path_for_recursive_chown "$project_root"; then
        echo "[ERROR] project_root unsafe; skipping Python permissions"
        return 1
    fi

    local python_dirs=(
        "$project_root/pycore"
        "$project_root/pyapps"
    )
    
    if [ "$(id -u)" -eq 0 ]; then
        for dir in "${python_dirs[@]}"; do
            if [ -d "$dir" ]; then
                echo "[INFO] Setting Python permissions for: $dir"
                chmod -R 755 "$dir" 2>/dev/null
                chown -R "$real_user:$real_user" "$dir" 2>/dev/null
                # Make Python files executable
                find "$dir" -name "*.py" -exec chmod 644 {} \; 2>/dev/null
                find "$dir" -name "__pycache__" -type d -exec chmod 755 {} \; 2>/dev/null
            fi
        done
        echo "[SUCCESS] Python permissions fixed"
    else
        echo "[WARNING] Need root access to fix Python permissions"
    fi
}

fix_node_permissions() {
    local project_root="$1"
    local user_info="$2"
    local real_user="${user_info%%:*}"

    echo "[INFO] Fixing Node.js-specific permissions..."
    echo "[SAFE_PATH] project_root=$project_root"
    if ! safe_path_for_recursive_chown "$project_root"; then
        echo "[ERROR] project_root unsafe; skipping Node permissions"
        return 1
    fi

    local node_dirs=(
        "$project_root/ncore"
        "$project_root/apps"
    )
    
    if [ "$(id -u)" -eq 0 ]; then
        for dir in "${node_dirs[@]}"; do
            if [ -d "$dir" ]; then
                echo "[INFO] Setting Node permissions for: $dir"
                chmod -R 755 "$dir" 2>/dev/null
                chown -R "$real_user:$real_user" "$dir" 2>/dev/null
                # Make Node files executable
                find "$dir" -name "*.js" -exec chmod 644 {} \; 2>/dev/null
                find "$dir" -name "node_modules" -type d -exec chmod 755 {} \; 2>/dev/null
            fi
        done
        echo "[SUCCESS] Node.js permissions fixed"
    else
        echo "[WARNING] Need root access to fix Node.js permissions"
    fi
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