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

# Get real user information
get_real_user_info() {
    local project_root="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"
    local real_user=""
    local real_user_home=""

    echo "[DEBUG] get_real_user_info: project_root=$project_root" >&2

    # Method 1: Check SUDO_USER (when running with sudo)
    if [ -n "$SUDO_USER" ] && [ "$SUDO_USER" != "root" ]; then
        real_user="$SUDO_USER"
        real_user_home=$(getent passwd "$real_user" 2>/dev/null | cut -d: -f6)
        if [ -z "$real_user_home" ]; then
            real_user_home="/home/$real_user"
        fi
        echo "[DEBUG] get_real_user_info: Using SUDO_USER method" >&2
    fi

    # Method 2: Check current user (when not running with sudo)
    if [ -z "$real_user" ]; then
        real_user="$(whoami 2>/dev/null || echo "$USER")"
        if [ "$real_user" = "root" ]; then
            # If running as root without sudo, try to find the real user
            real_user="${USER:-ubuntu}"
        fi
        real_user_home=$(getent passwd "$real_user" 2>/dev/null | cut -d: -f6)
        if [ -z "$real_user_home" ]; then
            real_user_home="/home/$real_user"
        fi
        echo "[DEBUG] get_real_user_info: Using current user method" >&2
    fi

    # Method 3: Ultimate fallback
    if [ -z "$real_user" ] || [ "$real_user" = "root" ]; then
        echo "[DEBUG] get_real_user_info: Using ultimate fallback" >&2
        real_user="ubuntu"
        real_user_home="/home/ubuntu"
    fi

    echo "[DEBUG] get_real_user_info: final result=$real_user:$real_user_home" >&2
    echo "$real_user:$real_user_home"
}

# =============================================================================
# Core Node Essential Permissions Fix (Fast)
# =============================================================================
fix_core_node_permissions_essential() {
    local project_root="$1"
    local user_info="$2"
    local real_user="${user_info%%:*}"
    local real_user_home="${user_info##*:}"
    
    echo "[INFO] Fixing Core Node essential permissions (fast)..."
    echo "[INFO] Project root: $project_root"
    echo "[INFO] Real user: $real_user"

    # Essential directories for basic operation - 777 permissions
    local essential_dirs=(
        "$project_root"
        "$project_root/scripts"
    )

    # Print directories to be scanned
    echo "[SCAN] Directories to be checked:"
    for dir in "${essential_dirs[@]}"; do
        echo "  - $dir"
    done
    echo ""

    # Critical file
    local critical_file="$project_root/dd.sh"

    if [ "$(id -u)" -eq 0 ]; then
        echo "[INFO] Running as root - fixing essential permissions"

        # Fix essential directories - set 777 for all users
        for dir in "${essential_dirs[@]}"; do
            if [ -d "$dir" ]; then
                echo "[INFO] Setting 777 permissions for: $dir"
                chmod -R 777 "$dir" 2>/dev/null
                chown -R "$real_user:$real_user" "$dir" 2>/dev/null
                # Ensure all .sh files in scripts are executable
                find "$dir" -name "*.sh" -exec chmod 755 {} \; 2>/dev/null
            fi
        done
        
        # Fix dd.sh specifically
        if [ -f "$critical_file" ]; then
            echo "[INFO] Setting permissions for: $critical_file"
            chmod 755 "$critical_file"
            chown "$real_user:$real_user" "$critical_file" 2>/dev/null
        fi
        
        echo "[SUCCESS] Essential Core Node permissions fixed"
    else
        echo "[INFO] Not running as root - checking essential accessibility"
        local needs_fix=false
        
        for dir in "${essential_dirs[@]}"; do
            if [ -d "$dir" ] && [ ! -w "$dir" ]; then
                echo "[WARNING] Essential directory not writable: $dir"
                needs_fix=true
            fi
        done
        
        if [ "$needs_fix" = "false" ]; then
            echo "[INFO] Essential directories are accessible"
        else
            echo "[WARNING] Essential directories need permission fix"
        fi
    fi
}

# =============================================================================
# /var/_core_node Permissions (MyBest directories)
# =============================================================================
fix_var_core_node_permissions() {
    local project_root="$1"
    local user_info="$2"
    local real_user="${user_info%%:*}"
    local target_path="/var/_core_node"
    
    echo "[INFO] Fixing /var/_core_node permissions for MyBest directories..."
    
    if [ "$(id -u)" -eq 0 ]; then
        echo "[INFO] Running as root - setting up $target_path"
        
        # Create directory if needed
        if [ ! -d "$target_path" ]; then
            echo "[INFO] Creating directory: $target_path"
            mkdir -p "$target_path" || {
                echo "[ERROR] Failed to create $target_path"
                return 1
            }
        fi
        
        # Set ownership and 777 permissions
        echo "[INFO] Setting ownership and permissions for $real_user on $target_path"
        chown -R "$real_user:$real_user" "$target_path" 2>/dev/null || {
            echo "[WARNING] Failed to change ownership to $real_user"
        }
        chmod -R 777 "$target_path" 2>/dev/null || echo "[WARNING] Failed to set 777 permissions"
        chmod -R +rwx "$target_path" 2>/dev/null || echo "[WARNING] Failed to set +rwx permissions"
        
        echo "[SUCCESS] /var/_core_node permissions configured"
    else
        if [ ! -d "$target_path" ]; then
            echo "[WARNING] $target_path does not exist (need root to create)"
        elif [ ! -w "$target_path" ]; then
            echo "[WARNING] $target_path not writable (MyBest creation may fail)"
        else
            echo "[INFO] $target_path is accessible"
        fi
    fi
}

# =============================================================================
# Environment Variables Setup
# =============================================================================
setup_environment_variables() {
    local project_root="$1"
    
    echo "[INFO] Setting up environment variables..."
    
    # Claude Code configuration (disable auto-updates)
    if [ -z "${DISABLE_AUTOUPDATER:-}" ]; then
        export DISABLE_AUTOUPDATER="1"
        echo "[SUCCESS] Set DISABLE_AUTOUPDATER=1"
    fi
    
    if [ -z "${CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:-}" ]; then
        export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1"
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
        export CORE_NODE_PROJECT_ROOT="$project_root"
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
    echo "[INFO] Essential Permissions & Environment Setup" >&2
    echo "[DEBUG] Project root: $project_root"
    echo "[DEBUG] Project root: $project_root" >&2

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
            fix_core_node_permissions "$project_root" "$user_info"
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