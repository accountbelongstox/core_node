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

# Web Path Permissions Manager
# Sets execute permissions (+x) on web map paths for real-login users (non-root)

# Variable Declarations
WEBPATH_CACHE_FILE=""

# Function to get cache file path
get_webpath_cache_file() {
    if [ -n "$WEBPATH_CACHE_FILE" ]; then
        echo "$WEBPATH_CACHE_FILE"
        return 0
    fi

    local cache_dir=""

    if type map_web_path >/dev/null 2>&1; then
        cache_dir=$(map_web_path "www" ".cache/dd_helper")
    else
        cache_dir="/tmp/dd_helper_cache"
    fi

    if [ ! -d "$cache_dir" ]; then
        mkdir -p "$cache_dir" 2>/dev/null
    fi

    WEBPATH_CACHE_FILE="$cache_dir/webpath_permissions_done"
    echo "$WEBPATH_CACHE_FILE"
}

# Function to check if permissions were already set
check_webpath_permissions_cache() {
    local cache_file=$(get_webpath_cache_file)

    if [ -f "$cache_file" ]; then
        local cache_time=$(cat "$cache_file" 2>/dev/null)
        echo -e "\033[33m[WEBPATH PERMISSIONS] Already set at: $cache_time\033[0m"
        echo -e "\033[33m[WEBPATH PERMISSIONS] Skipping (cache found at: $cache_file)\033[0m"
        return 0
    else
        return 1
    fi
}

# Function to save cache after setting permissions
save_webpath_permissions_cache() {
    local cache_file=$(get_webpath_cache_file)
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo "$timestamp" > "$cache_file" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo -e "\033[32m[WEBPATH PERMISSIONS] Cache saved: $cache_file\033[0m"
    fi
}

# Function to clear cache (force re-run)
clear_webpath_permissions_cache() {
    local cache_file=$(get_webpath_cache_file)

    if [ -f "$cache_file" ]; then
        rm -f "$cache_file" 2>/dev/null
        echo -e "\033[36m[WEBPATH PERMISSIONS] Cache cleared: $cache_file\033[0m"
    fi
}

# Function to ensure parent directories are accessible
ensure_parent_path_accessible() {
    local target_path="$1"
    local current_path=""

    # Split path and ensure each level is accessible
    IFS='/' read -ra PATH_PARTS <<< "$target_path"
    for part in "${PATH_PARTS[@]}"; do
        if [ -z "$part" ]; then
            current_path="/"
            continue
        fi

        if [ "$current_path" = "/" ]; then
            current_path="/$part"
        else
            current_path="$current_path/$part"
        fi

        if [ -d "$current_path" ]; then
            # Set +x on parent directories so user can traverse
            chmod o+x "$current_path" 2>/dev/null
        fi
    done
}

# Function to set execute permissions on web map paths
# Parameters:
#   $1 - force (optional): "force" to bypass cache and re-run
# This function is called when running as root to ensure real users can access web directories
set_webpath_execute_permissions() {
    local force_mode="$1"
    local current_uid=$(id -u)

    # Only run when executing as root
    if [ "$current_uid" -ne 0 ]; then
        return 0
    fi

    # Detect actual desktop user (from gvar_common.sh)
    if [ -z "$ACTUAL_DESKTOP_USER" ]; then
        if type detect_actual_desktop_user >/dev/null 2>&1; then
            detect_actual_desktop_user
        fi
    fi

    # If no real user detected, skip
    if [ -z "$ACTUAL_DESKTOP_USER" ]; then
        return 0
    fi

    # Check cache unless force mode is enabled
    if [ "$force_mode" != "force" ]; then
        if check_webpath_permissions_cache; then
            return 0
        fi
    else
        echo -e "\033[36m[WEBPATH PERMISSIONS] Force mode enabled, bypassing cache\033[0m"
        clear_webpath_permissions_cache
    fi

    echo -e "\033[36m[WEBPATH PERMISSIONS] Setting full access permissions for user: $ACTUAL_DESKTOP_USER\033[0m"

    # Get base data directory
    local data_base=$(get_base_data_directory)

    # Determine base path for www based on environment
    local base_path=""
    if [ "$IS_WSL" = true ]; then
        base_path="$data_base/www"
    elif [ "$IS_PRODUCTION" = true ]; then
        base_path="/www"
    else
        if [ "$data_base" = "/www" ]; then
            base_path="/www"
        else
            base_path="$data_base/www"
        fi
    fi

    # List of web map path keys to process
    # All paths are resolved via map_web_path() function - NO hard-coding!
    local web_path_keys=(
        "wwwroot"
        "nginxconfig"
        "shared-data"
        "backup"
        "www"
        "programing"
        "core_node"
        "dev_system"
        "dev_system_old"
        "npm_global"
        "compile_dir"
        "applications_dir"
    )

    # Set full permissions and ownership on each web map path
    local processed_count=0
    local error_count=0

    for path_key in "${web_path_keys[@]}"; do
        local mapped_path=$(map_web_path "$path_key")

        if [ -d "$mapped_path" ]; then
            local path_ok=true

            echo -e "\033[36m  [SAFE_PATH] path_key=$path_key -> mapped_path=$mapped_path\033[0m"
            case "$mapped_path" in
                /|/usr|/usr/*|/etc|/etc/*|/bin|/bin/*|/sbin|/sbin/*|/lib|/lib/*|/var)
                    echo -e "\033[33m  [SKIP] Refusing chown on system path: $mapped_path\033[0m"
                    path_ok=false
                    ;;
                *)
                    [[ "$mapped_path" != /* ]] && echo -e "\033[33m  [SKIP] Path not absolute: $mapped_path\033[0m" && path_ok=false
                    ;;
            esac
            if [ "$path_ok" = false ]; then
                ((error_count++))
            else
            # Step 0: Ensure parent directories are accessible
            ensure_parent_path_accessible "$mapped_path"

            # Step 1: Change ownership to real user
            if chown -R "$ACTUAL_DESKTOP_USER":"$ACTUAL_DESKTOP_USER" "$mapped_path" 2>/dev/null; then
                echo -e "\033[32m  [OK] Set ownership on $path_key -> $mapped_path (owner: $ACTUAL_DESKTOP_USER)\033[0m"
            else
                echo -e "\033[33m  [WARN] Failed to set ownership on $path_key\033[0m"
                path_ok=false
            fi

            # Step 2: Set directory permissions to 755 (rwxr-xr-x)
            # Owner can read/write/execute, others can read/execute
            if find "$mapped_path" -type d -exec chmod 755 {} + 2>/dev/null; then
                echo -e "\033[32m  [OK] Set directory permissions 755 on $path_key\033[0m"
            else
                echo -e "\033[33m  [WARN] Failed to set directory permissions on $path_key\033[0m"
                path_ok=false
            fi

            # Step 3: Set file permissions to 644 (rw-r--r--)
            # Owner can read/write, others can read
            if find "$mapped_path" -type f -exec chmod 644 {} + 2>/dev/null; then
                echo -e "\033[32m  [OK] Set file permissions 644 on $path_key\033[0m"
            else
                echo -e "\033[33m  [WARN] Failed to set file permissions on $path_key\033[0m"
                path_ok=false
            fi

            # Step 4: Set +x on shell scripts
            if find "$mapped_path" -type f -name "*.sh" -exec chmod +x {} + 2>/dev/null; then
                echo -e "\033[32m  [OK] Set +x on .sh files in $path_key\033[0m"
            fi

            # Step 5: Set +x on Node.js executables (cli.js, bin files in npm-global)
            # This is needed for npm global packages that use .js as entry points
            if [[ "$path_key" == *"npm"* ]] || [[ "$path_key" == *"dev_system"* ]]; then
                if find "$mapped_path" -type f \( -name "cli.js" -o -path "*/bin/*" \) -exec chmod +x {} + 2>/dev/null; then
                    echo -e "\033[32m  [OK] Set +x on npm executables in $path_key\033[0m"
                fi
            fi

            if [ "$path_ok" = true ]; then
                ((processed_count++))
            else
                ((error_count++))
            fi
            fi
        else
            echo -e "\033[33m  [SKIP] Path does not exist: $path_key -> $mapped_path\033[0m"
        fi
    done

    # Ensure base data directory and base path have proper permissions
    echo -e "\033[36m  [BASE PATHS] Processing base directories\033[0m"

    # Set permissions on data base directory (e.g., /www or /mnt/d)
    if [ -d "$data_base" ]; then
        ensure_parent_path_accessible "$data_base"
        if chmod 755 "$data_base" 2>/dev/null; then
            echo -e "\033[32m  [OK] Set permissions 755 on data base: $data_base\033[0m"
        fi
    fi

    # Set permissions and ownership on base path (e.g., /www or /mnt/d/www)
    if [ -d "$base_path" ]; then
        ensure_parent_path_accessible "$base_path"
        if chown "$ACTUAL_DESKTOP_USER":"$ACTUAL_DESKTOP_USER" "$base_path" 2>/dev/null && chmod 755 "$base_path" 2>/dev/null; then
            echo -e "\033[32m  [OK] Set ownership and permissions on base path: $base_path\033[0m"
        fi

        # Recursively set +x on all subdirectories under base path
        if find "$base_path" -type d -exec chmod o+x {} + 2>/dev/null; then
            echo -e "\033[32m  [OK] Set +x recursively on all directories under: $base_path\033[0m"
        fi
    fi

    # Summary
    echo -e "\033[36m[WEBPATH PERMISSIONS] Summary:\033[0m"
    echo -e "\033[32m  - Processed: $processed_count paths\033[0m"
    if [ "$error_count" -gt 0 ]; then
        echo -e "\033[33m  - Warnings: $error_count paths\033[0m"
    fi

    # Save cache if at least one path was processed successfully
    if [ "$processed_count" -gt 0 ]; then
        save_webpath_permissions_cache
    fi

    return 0
}

# Function to set ownership of web paths to real user
# This ensures the real user (non-root) can write to these directories
set_webpath_ownership() {
    local current_uid=$(id -u)
    local target_user="$1"

    # Only run when executing as root
    if [ "$current_uid" -ne 0 ]; then
        return 0
    fi

    # Detect actual desktop user if not provided
    if [ -z "$target_user" ]; then
        if [ -z "$ACTUAL_DESKTOP_USER" ]; then
            detect_actual_desktop_user
        fi
        target_user="$ACTUAL_DESKTOP_USER"
    fi

    # If no real user detected, skip
    if [ -z "$target_user" ]; then
        return 0
    fi

    echo -e "\033[36m[WEBPATH OWNERSHIP] Setting ownership for user: $target_user\033[0m"

    # Get base data directory
    local data_base=$(get_base_data_directory)

    # Determine base path for www based on environment
    local base_path=""
    if [ "$IS_WSL" = true ]; then
        base_path="$data_base/www"
    elif [ "$IS_PRODUCTION" = true ]; then
        base_path="/www"
    else
        if [ "$data_base" = "/www" ]; then
            base_path="/www"
        else
            base_path="$data_base/www"
        fi
    fi

    # List of web map path keys to process
    local web_path_keys=(
        "wwwroot"
        "nginxconfig"
        "shared-data"
        "backup"
    )

    # Set ownership on each web map path
    local processed_count=0
    local error_count=0

    for path_key in "${web_path_keys[@]}"; do
        local mapped_path=$(map_web_path "$path_key")

        if [ -d "$mapped_path" ]; then
            echo -e "\033[36m  [SAFE_PATH] path_key=$path_key -> mapped_path=$mapped_path\033[0m"
            case "$mapped_path" in
                /|/usr|/usr/*|/etc|/etc/*|/bin|/bin/*|/sbin|/sbin/*|/lib|/lib/*|/var)
                    echo -e "\033[33m  [SKIP] Refusing chown on system path: $mapped_path\033[0m"
                    ((error_count++))
                    ;;
                *)
                    if [[ "$mapped_path" != /* ]]; then
                        echo -e "\033[33m  [SKIP] Path not absolute: $mapped_path\033[0m"
                        ((error_count++))
                    else
                        if chown -R "$target_user":"$target_user" "$mapped_path" 2>/dev/null; then
                            ((processed_count++))
                            echo -e "\033[32m  [OK] Set ownership on $path_key -> $mapped_path\033[0m"
                        else
                            ((error_count++))
                            echo -e "\033[33m  [WARN] Failed to set ownership on $path_key -> $mapped_path\033[0m"
                        fi
                    fi
                    ;;
            esac
        else
            echo -e "\033[33m  [SKIP] Path does not exist: $path_key -> $mapped_path\033[0m"
        fi
    done

    # Summary
    echo -e "\033[36m[WEBPATH OWNERSHIP] Summary:\033[0m"
    echo -e "\033[32m  - Processed: $processed_count paths\033[0m"
    if [ "$error_count" -gt 0 ]; then
        echo -e "\033[33m  - Warnings: $error_count paths\033[0m"
    fi

    return 0
}

# Function to display web path permissions status
show_webpath_permissions() {
    echo -e "\033[36m[WEBPATH PERMISSIONS] Current Web Path Status:\033[0m"
    echo ""

    # Get base data directory
    local data_base=$(get_base_data_directory)

    # List of web map path keys to check
    # All paths are resolved via map_web_path() function - NO hard-coding!
    local web_path_keys=(
        "wwwroot"
        "nginxconfig"
        "shared-data"
        "backup"
        "www"
        "programing"
        "core_node"
        "dev_system"
        "dev_system_old"
        "npm_global"
        "compile_dir"
        "applications_dir"
    )

    # Display information for each path
    for path_key in "${web_path_keys[@]}"; do
        local mapped_path=$(map_web_path "$path_key")

        echo -e "\033[33m[$path_key]\033[0m"
        echo "  Path: $mapped_path"

        if [ -d "$mapped_path" ]; then
            local perms=$(stat -c "%a" "$mapped_path" 2>/dev/null)
            local owner=$(stat -c "%U:%G" "$mapped_path" 2>/dev/null)
            echo -e "  Status: \033[32mExists\033[0m"
            echo "  Permissions: $perms"
            echo "  Owner: $owner"
        else
            echo -e "  Status: \033[31mDoes not exist\033[0m"
        fi
        echo ""
    done

    # Display current user info
    echo -e "\033[36m[USER INFO]\033[0m"
    echo "  Current user: $(whoami)"
    echo "  Current UID: $(id -u)"
    if [ -n "$SUDO_USER" ]; then
        echo "  SUDO_USER: $SUDO_USER"
    fi
    if [ -n "$ACTUAL_DESKTOP_USER" ]; then
        echo "  Detected desktop user: $ACTUAL_DESKTOP_USER"
        echo "  Desktop user home: $ACTUAL_DESKTOP_USER_HOME"
    fi
    echo ""

    # Display cache status
    local cache_file=$(get_webpath_cache_file)
    echo -e "\033[36m[CACHE INFO]\033[0m"
    echo "  Cache file: $cache_file"
    if [ -f "$cache_file" ]; then
        local cache_time=$(cat "$cache_file" 2>/dev/null)
        echo -e "  Cache status: \033[32mExists\033[0m (set at: $cache_time)"
    else
        echo -e "  Cache status: \033[33mNot set\033[0m"
    fi
    echo ""
}

# Function to test user access to web paths
test_user_access() {
    local test_user="${1:-$ACTUAL_DESKTOP_USER}"

    if [ -z "$test_user" ]; then
        echo -e "\033[31m[ERROR] No user specified for testing\033[0m"
        return 1
    fi

    echo -e "\033[36m[ACCESS TEST] Testing access for user: $test_user\033[0m"
    echo ""

    # All paths are resolved via map_web_path() function - NO hard-coding!
    local web_path_keys=(
        "wwwroot"
        "nginxconfig"
        "shared-data"
        "backup"
        "www"
        "programing"
        "core_node"
        "dev_system"
        "dev_system_old"
        "npm_global"
        "compile_dir"
        "applications_dir"
    )

    for path_key in "${web_path_keys[@]}"; do
        local mapped_path=$(map_web_path "$path_key")

        echo -e "\033[33m[$path_key]\033[0m"
        echo "  Path: $mapped_path"

        if [ -d "$mapped_path" ]; then
            # Test as the target user
            if su - "$test_user" -c "test -r '$mapped_path' && test -x '$mapped_path'" 2>/dev/null; then
                echo -e "  Read access: \033[32mYES\033[0m"
            else
                echo -e "  Read access: \033[31mNO\033[0m"
            fi

            if su - "$test_user" -c "test -w '$mapped_path'" 2>/dev/null; then
                echo -e "  Write access: \033[32mYES\033[0m"
            else
                echo -e "  Write access: \033[31mNO\033[0m"
            fi

            # Show ownership
            local owner=$(stat -c "%U:%G" "$mapped_path" 2>/dev/null)
            local perms=$(stat -c "%a" "$mapped_path" 2>/dev/null)
            echo "  Owner: $owner"
            echo "  Permissions: $perms"
        else
            echo -e "  Status: \033[31mDoes not exist\033[0m"
        fi
        echo ""
    done
}

# Main execution when script is run directly
# When sourced by dd.sh, this section will not execute
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    GVAR_COMMON_FILE="$SCRIPT_DIR/../common/gvar_common.sh"

    echo -e "\033[36m========================================\033[0m"
    echo -e "\033[36m Web Path Permissions Manager (Direct)\033[0m"
    echo -e "\033[36m========================================\033[0m"
    echo ""

    # Load dependencies if not already loaded
    if ! type map_web_path >/dev/null 2>&1; then
        if [ -f "$GVAR_COMMON_FILE" ]; then
            echo -e "\033[33m[INFO] Loading dependencies: $GVAR_COMMON_FILE\033[0m"
            source "$GVAR_COMMON_FILE"
        else
            echo -e "\033[31m[ERROR] Required file not found: $GVAR_COMMON_FILE\033[0m"
            echo -e "\033[31m[ERROR] Cannot continue without dependencies\033[0m"
            exit 1
        fi
    fi

    # Parse command-line arguments
    ACTION="permissions"
    FORCE_MODE="force"

    while [ $# -gt 0 ]; do
        case "$1" in
            --permissions|-p)
                ACTION="permissions"
                shift
                ;;
            --ownership|-o)
                ACTION="ownership"
                shift
                ;;
            --show|-s)
                ACTION="show"
                shift
                ;;
            --clear-cache|-c)
                ACTION="clear"
                shift
                ;;
            --test|-t)
                ACTION="test"
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --permissions, -p   Set full permissions on web paths (default)"
                echo "  --ownership, -o     Set ownership of web paths to real user"
                echo "  --show, -s          Show current web path permissions status"
                echo "  --test, -t          Test real user access to web paths"
                echo "  --clear-cache, -c   Clear permissions cache only"
                echo "  --help, -h          Show this help message"
                echo ""
                echo "Note: When run directly, this script always forces re-run (bypasses cache)"
                echo "      When called from dd.sh, it respects cache to avoid redundant operations"
                echo ""
                echo "What this script does:"
                echo "  1. Detects real-login user (non-root) via SUDO_USER or active sessions"
                echo "  2. Changes ownership of web paths to real user"
                echo "  3. Sets directory permissions to 755 (rwxr-xr-x)"
                echo "  4. Sets file permissions to 644 (rw-r--r--)"
                echo "  5. Ensures parent directories are traversable"
                exit 0
                ;;
            *)
                echo -e "\033[31m[ERROR] Unknown option: $1\033[0m"
                echo "Run with --help for usage information"
                exit 1
                ;;
        esac
    done

    # Execute based on action
    case "$ACTION" in
        permissions)
            echo -e "\033[36m[ACTION] Setting full access permissions (force mode)\033[0m"
            echo ""
            set_webpath_execute_permissions "$FORCE_MODE"
            ;;
        ownership)
            echo -e "\033[36m[ACTION] Setting ownership to real user\033[0m"
            echo ""
            set_webpath_ownership
            ;;
        show)
            show_webpath_permissions
            ;;
        test)
            echo -e "\033[36m[ACTION] Testing real user access to web paths\033[0m"
            echo ""
            if [ -z "$ACTUAL_DESKTOP_USER" ]; then
                detect_actual_desktop_user
            fi
            test_user_access "$ACTUAL_DESKTOP_USER"
            ;;
        clear)
            echo -e "\033[36m[ACTION] Clearing permissions cache\033[0m"
            clear_webpath_permissions_cache
            ;;
    esac

    echo ""
    echo -e "\033[32m[COMPLETE] Action completed successfully\033[0m"
fi
