#!/bin/bash
# =============================================================================
# Smart Permissions & Environment Setup Script
# =============================================================================
# This script intelligently fixes all permissions and environment variables
# for the Core Node Project, combining multiple functionalities:
# - Core Node project permissions (root access issue fix)
# - /var/_core_node permissions (MyBest directories)
# - Environment variables setup (Claude Code auto-update disable, etc.)
# - AI tools repair functionality
# =============================================================================

# Variable declarations
SMART_PERMISSIONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SMART_PERMISSIONS_HELPER="$SMART_PERMISSIONS_DIR/../common/fs_perm_helpers.sh"

# shellcheck source=/dev/null
source "$SMART_PERMISSIONS_HELPER"

# Get real user information
get_real_user_info() {
    local project_root="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"
    local real_user=""
    local real_user_home=""

    resolve_active_permission_owner >/dev/null
    real_user="$ACTIVE_PERMISSION_USER"
    real_user_home="$(getent passwd "$real_user" 2>/dev/null | cut -d: -f6)"
    [ -n "$real_user_home" ] || real_user_home="/root"
    echo "[INFO] Permission owner source: $ACTIVE_PERMISSION_SOURCE" >&2
    echo "$real_user:$real_user_home"
}

# =============================================================================
# Core Node Essential Permissions Fix (Fast)
# =============================================================================
fix_core_node_permissions_essential() {
    local project_root="$1"
    local user_info="$2"
    local real_user="${user_info%%:*}"
    local real_group=""
    local parent_dir=""
    local build_dir=""

    echo "[INFO] Fixing Core Node essential permissions (fast)..."
    echo "[SAFE_PATH] project_root=$project_root"
    echo "[INFO] Real user: $real_user"
    real_group="$(id -gn "$real_user" 2>/dev/null || echo "$real_user")"
    parent_dir="$(dirname "$project_root")"
    build_dir="$parent_dir/_build_dir"

    repair_owned_tree_777 "$project_root" "$real_user" "$real_group" || return $?
    ensure_owned_tree_777 "$build_dir" "$real_user" "$real_group" || return $?
    echo "[SUCCESS] Essential Core Node permissions fixed"
}

# =============================================================================
# /var/_core_node Permissions (MyBest directories)
# =============================================================================
fix_var_core_node_permissions() {
    local project_root="$1"
    local user_info="$2"
    local real_user="${user_info%%:*}"
    local real_group=""
    local target_path="/var/_core_node"

    echo "[INFO] Fixing /var/_core_node permissions for MyBest directories..."
    echo "[SAFE_PATH] target_path=$target_path (fixed path, allowed)"

    real_group="$(id -gn "$real_user" 2>/dev/null || echo "$real_user")"
    ensure_owned_tree_777 "$target_path" "$real_user" "$real_group"
}

# =============================================================================
# Environment Variables Setup
# =============================================================================
setup_environment_variables() {
    local project_root="$1"
    
    echo "[INFO] Setting up environment variables..."
    
    # Claude Code configuration (disable auto-updates)
    if [ -z "${DISABLE_AUTOUPDATER:-}" ]; then
        DISABLE_AUTOUPDATER="1"
        echo "[SUCCESS] Set DISABLE_AUTOUPDATER=1"
    fi
    
    if [ -z "${CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:-}" ]; then
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1"
        echo "[SUCCESS] Set CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1"
    fi
    
    # Python UTF-8 configuration
    if [ -z "${PYTHONIOENCODING:-}" ]; then
        export PYTHONIOENCODING="utf-8"
        echo "[SUCCESS] Set PYTHONIOENCODING=utf-8"
    fi
    
    if [ -z "${PYTHONUTF8:-}" ]; then
        export PYTHONUTF8="1"
        echo "[SUCCESS] Set PYTHONUTF8=1"
    fi
    
    # Core Node project root
    if [ -n "$project_root" ] && [ -z "${CORE_NODE_PROJECT_ROOT:-}" ]; then
        CORE_NODE_PROJECT_ROOT="$project_root"
        echo "[SUCCESS] Set CORE_NODE_PROJECT_ROOT=$project_root"
    fi
    
    # Locale configuration
    if [ -z "${LC_ALL:-}" ]; then
        export LC_ALL="C.UTF-8"
        echo "[SUCCESS] Set LC_ALL=C.UTF-8"
    fi
    
    # PATH configuration
    if [[ ":$PATH:" != *":/usr/local/bin:"* ]]; then
        export PATH="/usr/local/bin:$PATH"
        echo "[SUCCESS] Added /usr/local/bin to PATH"
    fi
    
    echo "[SUCCESS] Environment variables configured"
}

# =============================================================================
# AI Tools Repair (Simplified)
# =============================================================================
repair_ai_tool_simple() {
    local tool="$1"
    local user_info="$2"
    local real_user="${user_info%%:*}"
    local real_user_home="${user_info##*:}"
    
    echo "[INFO] Checking $tool..."

    # Check if tool exists and works
    if command -v "$tool" &> /dev/null && timeout 5 "$tool" --version &> /dev/null; then
        echo "[SUCCESS] $tool is working"
        return 0
    fi

    # Try to find and fix tool
    local user_locations=(
        "$real_user_home/.local/bin/$tool"
        "$real_user_home/.npm-global/bin/$tool"
        "/usr/bin/$tool"
        "/usr/local/bin/$tool"
    )

    # Print locations to be scanned
    echo "[SCAN] AI tool locations to be checked for $tool:"
    for location in "${user_locations[@]}"; do
        echo "  - $location"
    done
    echo ""

    for location in "${user_locations[@]}"; do
        if [ -x "$location" ] && timeout 3 "$location" --version &> /dev/null; then
            echo "[INFO] Found working $tool at $location"
            if [ ! -L "/usr/local/bin/$tool" ]; then
                ln -sf "$location" "/usr/local/bin/$tool" 2>/dev/null && {
                    echo "[SUCCESS] Created symlink for $tool"
                    return 0
                }
            fi
        fi
    done
    
    echo "[WARNING] $tool needs manual repair or npx fallback"
    return 1
}

# =============================================================================
# Main Smart Permissions Function (Essential Only - Fast)
# =============================================================================
smart_permissions_fix() {
    echo "========================================" >&2
    echo "[TEST] smart_permissions_fix CALLED" >&2
    echo "========================================" >&2

    local project_root="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"

    echo "[INFO] Essential Permissions & Environment Setup"
    echo "[DEBUG] Project root: $project_root"

    # Get user information
    echo "[DEBUG] Getting real user information..."
    local user_info="$(get_real_user_info "$project_root")"
    local real_user="${user_info%%:*}"
    local real_user_home="${user_info##*:}"

    echo "[INFO] Real user: $real_user"
    echo "[INFO] Real user home: $real_user_home"
    echo ""

    # 1. Fix essential Core Node permissions (fast)
    echo "[STEP 1/3] Fixing essential Core Node permissions..."
    fix_core_node_permissions_essential "$project_root" "$user_info"
    echo ""

    # 2. Fix /var/_core_node permissions
    echo "[STEP 2/3] Fixing /var/_core_node permissions..."
    fix_var_core_node_permissions "$project_root" "$user_info"
    echo ""

    # 3. Setup environment variables
    echo "[STEP 3/3] Setting up environment variables..."
    setup_environment_variables "$project_root"
    echo ""

    echo "[SUCCESS] Essential setup completed"
    return 0
}

# =============================================================================
# Export functions for use by other scripts
# =============================================================================

# Simplified functions that dd.sh can call
ensure_var_core_node_permissions() {
    local project_root="$1"
    local user_info="$(get_real_user_info "$project_root")"
    fix_var_core_node_permissions "$project_root" "$user_info"
}

ensure_all_env_vars() {
    local project_root="$1"
    setup_environment_variables "$project_root"
}

repair_ai_tool() {
    local tool="$1"
    local project_root="${2:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"
    local user_info="$(get_real_user_info "$project_root")"
    repair_ai_tool_simple "$tool" "$user_info"
}

# =============================================================================
# Main execution when called directly
# =============================================================================
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    case "${1:-smart}" in
        "smart"|"all")
            smart_permissions_fix "$2"
            ;;
        "core")
            project_root="${2:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"
            user_info="$(get_real_user_info "$project_root")"
            fix_core_node_permissions_essential "$project_root" "$user_info"
            ;;
        "var")
            project_root="${2:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"
            user_info="$(get_real_user_info "$project_root")"
            fix_var_core_node_permissions "$project_root" "$user_info"
            ;;
        "env")
            project_root="${2:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"
            setup_environment_variables "$project_root"
            ;;
        "repair")
            if [ -n "$2" ]; then
                repair_ai_tool "$2" "$3"
            else
                echo "[ERROR] Please specify tool to repair (claude, codex, droid)"
                exit 1
            fi
            ;;
        *)
            echo "Usage: $0 [smart|core|var|env|repair <tool>] [project_root]"
            echo "  smart - Run all fixes (default)"
            echo "  core  - Fix core project permissions only"
            echo "  var   - Fix /var/_core_node permissions only"
            echo "  env   - Setup environment variables only"
            echo "  repair - Repair specific AI tool"
            ;;
    esac
fi
