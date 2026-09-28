#!/bin/bash
# =============================================================================
# Smart Permissions & Environment Setup Script
# =============================================================================
# This script intelligently fixes all permissions and environment variables
# for the Core Node Project, combining multiple functionalities:
# - Core Node project permissions (root access issue fix)
# - core_node data root permissions (MyBest directories)
# - Environment variables setup (Claude Code auto-update disable, etc.)
# - AI tools repair functionality
# =============================================================================

# Variable declarations
SMART_PERMISSIONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SMART_PERMISSIONS_HELPER="$SMART_PERMISSIONS_DIR/../common/fs_perm_helpers.sh"

# shellcheck source=/dev/null
source "$SMART_PERMISSIONS_HELPER"
# CORE_NODE_DATA_DIR is defined once in common/runtime_environment.sh
[ -z "${CORE_NODE_DATA_DIR:-}" ] && source "$SMART_PERMISSIONS_DIR/../common/runtime_environment.sh"
# dd.sh background repair state: the worker holds the lock while it runs.
SMART_PERMISSIONS_STATE_DIR="$CORE_NODE_INSTALLER_STATE_DIR/dd_startup"
SMART_PERMISSIONS_LOG_FILE="$SMART_PERMISSIONS_STATE_DIR/permissions.log"
SMART_PERMISSIONS_LOCK_FILE="$SMART_PERMISSIONS_STATE_DIR/permissions.lock"

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
# core_node data root Permissions (MyBest directories)
# =============================================================================
fix_var_core_node_permissions() {
    local project_root="$1"
    local user_info="$2"
    local real_user="${user_info%%:*}"
    local real_group=""
    local target_path="$CORE_NODE_DATA_DIR"

    echo "[INFO] Fixing core_node data root permissions for MyBest directories..."
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
# Main Smart Permissions Function
# =============================================================================

# Tree repairs: project root + _build_dir, then the core_node data root.
smart_permissions_repair_trees() {
    local project_root="$1"
    local user_info=""

    user_info="$(get_real_user_info "$project_root")"
    echo "[INFO] Real user: ${user_info%%:*} (home: ${user_info##*:})"
    echo "[STEP 1/2] Fixing essential Core Node permissions..."
    fix_core_node_permissions_essential "$project_root" "$user_info"
    echo "[STEP 2/2] Fixing core_node data root permissions..."
    fix_var_core_node_permissions "$project_root" "$user_info"
    echo "[SUCCESS] Permission repair completed"
}

# 0 while a background repair holds the lock.
smart_permissions_background_running() {
    [ -e "$SMART_PERMISSIONS_LOCK_FILE" ] || return 1
    ! flock -n "$SMART_PERMISSIONS_LOCK_FILE" true 2>/dev/null
}

# Environment setup runs in this shell. As root, the full-tree permission walk
# (minutes on a cold ntfs cache) runs detached so startup continues; it keeps
# running after dd.sh exits. Non-root runs it in the foreground (sudo may ask).
smart_permissions_fix() {
    local project_root="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"

    echo "[INFO] Project root: $project_root"
    setup_environment_variables "$project_root"
    if [ "$(id -u)" -ne 0 ]; then
        smart_permissions_repair_trees "$project_root"
        return 0
    fi
    mkdir -p "$SMART_PERMISSIONS_STATE_DIR" 2>/dev/null
    if smart_permissions_background_running; then
        echo "[INFO] Permission repair is already running in the background (log: $SMART_PERMISSIONS_LOG_FILE)"
        return 0
    fi
    setsid bash "$SMART_PERMISSIONS_DIR/smart_permissions.sh" perms "$project_root" \
        > "$SMART_PERMISSIONS_LOG_FILE" 2>&1 < /dev/null &
    echo "[INFO] Permission repair started in the background (pid $!, log: $SMART_PERMISSIONS_LOG_FILE)"
    return 0
}

# Status of the background repair; printed right before the menu.
smart_permissions_report() {
    [ "$(id -u)" -eq 0 ] || return 0
    if smart_permissions_background_running; then
        echo -e "\033[33m[PERMISSIONS] Background repair still running; log: $SMART_PERMISSIONS_LOG_FILE\033[0m"
    elif [ -s "$SMART_PERMISSIONS_LOG_FILE" ]; then
        echo -e "\033[36m[PERMISSIONS] Background repair finished ($SMART_PERMISSIONS_LOG_FILE):\033[0m"
        grep -E '^\[(permissions|SUCCESS|ERROR|WARNING)\]' "$SMART_PERMISSIONS_LOG_FILE" | tail -n 6 | sed 's/^/  /'
    fi
}

# =============================================================================
# Export functions for use by other scripts
# =============================================================================

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
    project_root="${2:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"
    case "${1:-smart}" in
        "smart"|"all")
            setup_environment_variables "$project_root"
            smart_permissions_repair_trees "$project_root"
            ;;
        "perms")
            mkdir -p "$SMART_PERMISSIONS_STATE_DIR" 2>/dev/null
            exec 9>"$SMART_PERMISSIONS_LOCK_FILE"
            if ! flock -n 9; then
                echo "[INFO] Another permission repair is running"
                exit 0
            fi
            printf '[INFO] Started %(%Y-%m-%d %H:%M:%S)T\n' -1
            smart_permissions_repair_trees "$project_root"
            printf '[INFO] Finished %(%Y-%m-%d %H:%M:%S)T\n' -1
            ;;
        "core")
            user_info="$(get_real_user_info "$project_root")"
            fix_core_node_permissions_essential "$project_root" "$user_info"
            ;;
        "var")
            user_info="$(get_real_user_info "$project_root")"
            fix_var_core_node_permissions "$project_root" "$user_info"
            ;;
        "env")
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
            echo "Usage: $0 [smart|perms|core|var|env|repair <tool>] [project_root]"
            echo "  smart - Run all fixes (default)"
            echo "  perms - Permission repair only, single instance (dd.sh background worker)"
            echo "  core  - Fix core project permissions only"
            echo "  var   - Fix core_node data root permissions only"
            echo "  env   - Setup environment variables only"
            echo "  repair - Repair specific AI tool"
            ;;
    esac
fi
