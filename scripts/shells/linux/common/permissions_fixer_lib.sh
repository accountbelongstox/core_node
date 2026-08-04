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
# Permissions Fixer Library (Unified)
# =============================================================================
#
# Synopsis:
#     Universal permissions fixer for core_node and related directories
#
# Description:
#     Provides individual methods to fix permissions for specific directories
#     and a master method to fix all at once. All directories are fixed to be
#     owned by the real login user (not root).
#
# Usage:
#     source /path/to/permissions_fixer_lib.sh
#
#     # Fix individual directories
#     fix_permissions_core_node_dir
#     fix_permissions_project_dir
#     fix_permissions_build_dir
#     fix_permissions_wwwroot_dir
#
#     # Fix all at once
#     fix_permissions_all
#
# Returns:
#     0 on success, non-zero on failure
# =============================================================================

# Variable declarations
PERMISSIONS_FIXER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PERMISSIONS_FIXER_FS_HELPER="$PERMISSIONS_FIXER_DIR/fs_perm_helpers.sh"

# shellcheck source=/dev/null
source "$PERMISSIONS_FIXER_FS_HELPER"

# Get real user (cached)
get_target_user() {
    resolve_active_permission_owner >/dev/null
    echo "$ACTIVE_PERMISSION_USER"
}

# Fix permissions for a specific directory
# Args: $1=directory_path, $2=description
fix_directory_permissions() {
    local dir_path="$1"
    local description="$2"
    local real_user=""
    local real_group=""

    resolve_active_permission_owner >/dev/null
    real_user="$ACTIVE_PERMISSION_USER"
    real_group="$ACTIVE_PERMISSION_GROUP"

    if [ -z "$dir_path" ]; then
        echo "[ERROR] Directory path not provided"
        return 1
    fi

    if [ ! -d "$dir_path" ]; then
        echo "[SKIP] $description: Directory does not exist: $dir_path"
        return 0
    fi

    echo "[FIX] $description..."
    echo "  Path: $dir_path"
    echo "  Owner: $real_user:$real_group"
    echo "  Permissions: 777"

    repair_owned_tree_777 "$dir_path" "$real_user" "$real_group"
}

# Fix core_node directory permissions
fix_permissions_core_node_dir() {
    local core_node_dir=$(map_web_path "www" "core_node" 2>/dev/null)
    if [ -z "$core_node_dir" ]; then
        core_node_dir="/www/programing/core_node"
    fi

    fix_directory_permissions "$core_node_dir" "Core Node Directory"
}

# Fix project directory permissions (parent of core_node)
fix_permissions_project_dir() {
    local www_base=$(map_web_path "www" 2>/dev/null)
    if [ -z "$www_base" ]; then
        www_base="/www/programing"
    fi

    fix_directory_permissions "$www_base" "Project Directory"
}

# Fix _build_dir permissions
fix_permissions_build_dir() {
    local www_base=$(map_web_path "www" 2>/dev/null)
    if [ -z "$www_base" ]; then
        www_base="/www/programing"
    fi

    local build_dir="$www_base/_build_dir"
    fix_directory_permissions "$build_dir" "Build Directory"
}

# Fix wwwroot directory permissions
fix_permissions_wwwroot_dir() {
    local wwwroot=$(map_web_path "wwwroot" 2>/dev/null)
    if [ -z "$wwwroot" ]; then
        wwwroot="/www/wwwroot"
    fi

    fix_directory_permissions "$wwwroot" "WWW Root Directory"
}

# Fix laravel_db directory permissions
fix_permissions_laravel_db_dir() {
    local laravel_db=$(map_web_path "laravel_db" 2>/dev/null)
    if [ -z "$laravel_db" ]; then
        laravel_db="/www/wwwroot/laravel_db"
    fi

    fix_directory_permissions "$laravel_db" "Laravel Database Directory"
}

# Fix cache directory permissions
fix_permissions_cache_dir() {
    local cache_dir=$(map_web_path "cache" 2>/dev/null)
    if [ -z "$cache_dir" ]; then
        cache_dir="/www/cache"
    fi

    fix_directory_permissions "$cache_dir" "Cache Directory"
}

# Fix logs directory permissions
fix_permissions_logs_dir() {
    local logs_dir=$(map_web_path "logs" 2>/dev/null)
    if [ -z "$logs_dir" ]; then
        logs_dir="/www/logs"
    fi

    fix_directory_permissions "$logs_dir" "Logs Directory"
}

# Fix shared-data directory permissions
fix_permissions_shared_data_dir() {
    local shared_data=$(map_web_path "shared-data" 2>/dev/null)
    if [ -z "$shared_data" ]; then
        shared_data="/www/shared-data"
    fi

    fix_directory_permissions "$shared_data" "Shared Data Directory"
}

# Fix specific app directory permissions
# Args: $1=app_name
fix_permissions_app_dir() {
    local app_name="$1"

    if [ -z "$app_name" ]; then
        echo "[ERROR] App name not provided"
        return 1
    fi

    local www_base=$(map_web_path "www" 2>/dev/null || echo "/www/programing")
    local build_dir="$www_base/_build_dir/$app_name"

    fix_directory_permissions "$build_dir" "App Build Directory ($app_name)"
}

# Fix all common directory permissions
fix_permissions_all() {
    local real_user=$(get_target_user)

    echo "========================================="
    echo "Permissions Fixer - Fix All Directories"
    echo "========================================="
    echo "Target User: $real_user"
    echo ""

    # Fix core directories
    fix_permissions_core_node_dir
    echo ""

    fix_permissions_build_dir
    echo ""

    fix_permissions_wwwroot_dir
    echo ""

    fix_permissions_laravel_db_dir
    echo ""

    fix_permissions_cache_dir
    echo ""

    fix_permissions_logs_dir
    echo ""

    fix_permissions_shared_data_dir
    echo ""

    echo "========================================="
    echo "All Permissions Fixed"
    echo "========================================="
}

# If script is executed directly (not sourced), run fix_all
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    fix_permissions_all
fi
