#!/bin/bash
# Directory, download-discovery, and Node package-manager helpers.

# Directory Migration and Permission Management Functions
# ============================================================================

# Get the active regular user, or root when none is active.
get_real_user_from_common_functions() {
    local real_user=""

    resolve_active_permission_owner >/dev/null
    real_user="$ACTIVE_PERMISSION_USER"
    echo "$real_user"
}

# Migrate from old directory to new directory (from common_functions.sh)
migrate_old_to_new_directory_from_common_functions() {
    local old_base_pattern="$1"  # e.g., "dev_ubuntu24" or "/www/dev_ubuntu24"
    local new_base_pattern="$2"  # e.g., "_ubuntu_24" or "/www/_ubuntu_24"
    local specific_path="${3:-}"  # Optional: specific subdirectory to migrate

    # Resolve full paths
    local old_dir=""
    local new_dir=""
    local www_base=$(map_web_path "www")

    # If patterns don't start with /, assume they're under www
    if [[ "$old_base_pattern" != /* ]]; then
        old_dir="$www_base/$old_base_pattern"
    else
        old_dir="$old_base_pattern"
    fi

    if [[ "$new_base_pattern" != /* ]]; then
        new_dir="$www_base/$new_base_pattern"
    else
        new_dir="$new_base_pattern"
    fi

    # If specific path provided, append it
    if [ -n "$specific_path" ]; then
        old_dir="$old_dir/$specific_path"
        new_dir="$new_dir/$specific_path"
    fi

    # Check if old directory exists
    if [ ! -d "$old_dir" ]; then
        print_debug_from_common_functions "Old directory does not exist: $old_dir"
        return 0
    fi

    # Check if new directory already exists
    if [ -d "$new_dir" ]; then
        print_warning_from_common_functions "New directory already exists: $new_dir"
        print_info_from_common_functions "Merging contents from old directory: $old_dir"

        # Merge: Copy files that don't exist in new directory
        $USE_SUDO rsync -a --ignore-existing "$old_dir/" "$new_dir/"

        print_info_from_common_functions "Removing old directory: $old_dir"
        $USE_SUDO rm -rf "$old_dir"
    else
        print_step_from_common_functions "Migrating: $old_dir -> $new_dir"

        # Create parent directory if needed
        local parent_dir="$(dirname "$new_dir")"
        if [ ! -d "$parent_dir" ]; then
            $USE_SUDO mkdir -p "$parent_dir"
        fi

        # Move the entire directory
        $USE_SUDO mv "$old_dir" "$new_dir"

        print_success_from_common_functions "Migration complete: $new_dir"
    fi

    return 0
}

# Fix permissions for installation directory (from common_functions.sh)
fix_installation_permissions_from_common_functions() {
    local target_path="$1"
    local permission_mode="777"
    local set_owner="${3:-true}"       # Default: set owner to real user
    local real_user=""
    local real_group=""

    if [ ! -e "$target_path" ]; then
        print_warning_from_common_functions "Path does not exist: $target_path"
        return 1
    fi

    print_step_from_common_functions "Fixing permissions for: $target_path"
    print_info_from_common_functions "[SAFE_PATH] target_path=$target_path"

    # Refuse recursive chown/chmod on system or dangerous paths
    if [ -z "$target_path" ] || [[ "$target_path" != /* ]]; then
        print_warning_from_common_functions "Refusing: target_path empty or not absolute"
        return 1
    fi
    case "$target_path" in
        /usr/local|/usr/local/*) ;;
        /|/usr|/usr/*|/etc|/etc/*|/bin|/bin/*|/sbin|/sbin/*|/lib|/lib/*|/var)
            print_warning_from_common_functions "Refusing chown/chmod on system path: $target_path"
            return 1
            ;;
    esac

    real_user="$(get_real_user_from_common_functions)"
    real_group="$(id -gn "$real_user" 2>/dev/null || echo "$real_user")"

    print_info_from_common_functions "Real user: $real_user:$real_group"
    print_info_from_common_functions "Permission mode: $permission_mode"

    if [ "$set_owner" = "true" ]; then
        repair_owned_tree_777 "$target_path" "$real_user" "$real_group" || return $?
    else
        safe_chmod_R "$permission_mode" "$target_path"
    fi

    print_success_from_common_functions "Permissions fixed for: $target_path"
    return 0
}

# Ensure directory exists with correct permissions (from common_functions.sh)
ensure_directory_permissions_from_common_functions() {
    local target_dir="$1"
    local permission_mode="777"
    local set_owner="${3:-true}"       # Default: set owner to real user

    # Create directory if it doesn't exist
    if [ ! -d "$target_dir" ]; then
        print_step_from_common_functions "Creating directory: $target_dir"
        $USE_SUDO mkdir -p "$target_dir"
    fi

    # Fix permissions
    fix_installation_permissions_from_common_functions "$target_dir" "$permission_mode" "$set_owner"

    return 0
}

# Fix NPM global installation permissions (from common_functions.sh)
fix_npm_global_permissions_from_common_functions() {
    print_step_from_common_functions "Fixing NPM global installation permissions"

    # Get npm global prefix
    local npm_prefix=$(npm config get prefix 2>/dev/null || echo "")

    if [ -z "$npm_prefix" ] || [ ! -d "$npm_prefix" ]; then
        print_warning_from_common_functions "NPM global prefix not found or not a directory"
        return 1
    fi

    print_info_from_common_functions "NPM global prefix: $npm_prefix"

    # Fix permissions for bin and lib directories
    if [ -d "$npm_prefix/bin" ]; then
        fix_installation_permissions_from_common_functions "$npm_prefix/bin" "777" "true"
    fi

    if [ -d "$npm_prefix/lib" ]; then
        fix_installation_permissions_from_common_functions "$npm_prefix/lib" "777" "true"
    fi

    # Make all binaries executable
    if [ -d "$npm_prefix/bin" ]; then
        $USE_SUDO find "$npm_prefix/bin" -type f -exec chmod +x {} \; 2>/dev/null || true
    fi

    print_success_from_common_functions "NPM permissions fixed"
    return 0
}

# Update wrapper scripts to use new directory paths (from common_functions.sh)
update_wrapper_script_paths_from_common_functions() {
    local wrapper_dir="${1:-/usr/local/super_scripts}"
    local old_pattern="${2:-}"
    local new_pattern="${3:-_ubuntu_24}"

    if [ ! -d "$wrapper_dir" ]; then
        print_warning_from_common_functions "Wrapper directory does not exist: $wrapper_dir"
        return 0
    fi

    print_step_from_common_functions "Updating wrapper scripts in: $wrapper_dir"

    local updated_count=0

    # Find and update all wrapper scripts
    while IFS= read -r -d '' script_file; do
        if grep -q "$old_pattern" "$script_file" 2>/dev/null; then
            print_info_from_common_functions "Updating: $script_file"
            $USE_SUDO sed -i "s|$old_pattern|$new_pattern|g" "$script_file"
            ((updated_count++))
        fi
    done < <(find "$wrapper_dir" -type f -name "*.sh" -print0 2>/dev/null)

    # Also check files without .sh extension
    while IFS= read -r -d '' script_file; do
        if [ -f "$script_file" ] && [ ! -d "$script_file" ] && grep -q "$old_pattern" "$script_file" 2>/dev/null; then
            print_info_from_common_functions "Updating: $script_file"
            $USE_SUDO sed -i "s|$old_pattern|$new_pattern|g" "$script_file"
            ((updated_count++))
        fi
    done < <(find "$wrapper_dir" -type f ! -name "*.sh" -print0 2>/dev/null)

    print_success_from_common_functions "Updated $updated_count wrapper scripts"
    return 0
}

# ============================================================================
# DOWNLOADS DIRECTORY SEARCH FUNCTIONS
# ============================================================================

# Find all Downloads directories for all users
# Returns: Array of Downloads directory paths
find_all_downloads_dirs_from_common_functions() {
    local search_dirs=()

    # Add current user's Downloads
    if [[ -n "$HOME" ]] && [[ -d "$HOME/Downloads" ]]; then
        search_dirs+=("$HOME/Downloads")
    fi

    # Add all other users' Downloads directories
    if [[ -d "/home" ]]; then
        for user_home in /home/*; do
            if [[ -d "$user_home/Downloads" ]]; then
                search_dirs+=("$user_home/Downloads")
            fi
        done
    fi

    # Add root's Downloads
    if [[ -d "/root/Downloads" ]]; then
        search_dirs+=("/root/Downloads")
    fi

    # Return unique directories
    printf '%s\n' "${search_dirs[@]}" | sort -u
}

# Find a specific file pattern in all Downloads directories
# Usage: find_file_in_downloads_from_common_functions <pattern> [newest|oldest]
# Pattern: Glob pattern to match (e.g., "*.deb", "code_*.deb", "cursor-*.AppImage")
# Sort: "newest" (default) or "oldest" - return newest or oldest matching file
# Returns: Full path to the found file, or empty string if not found
find_file_in_downloads_from_common_functions() {
    local pattern="$1"
    local sort_order="${2:-newest}"  # Default to newest
    local found_files=()

    # Get all Downloads directories
    local search_dirs=($(find_all_downloads_dirs_from_common_functions))

    if [[ ${#search_dirs[@]} -eq 0 ]]; then
        return 1
    fi

    # Search for files matching pattern (case-insensitive)
    for dir in "${search_dirs[@]}"; do
        while IFS= read -r -d '' file; do
            if [[ -f "$file" ]]; then
                found_files+=("$file")
            fi
        done < <(find "$dir" -maxdepth 1 -type f -iname "$pattern" -print0 2>/dev/null)
    done

    if [[ ${#found_files[@]} -eq 0 ]]; then
        return 1
    fi

    # Sort files by modification time
    local sorted_file
    if [[ "$sort_order" == "oldest" ]]; then
        # Oldest first
        sorted_file=$(printf '%s\n' "${found_files[@]}" | xargs -r ls -t -r | head -n 1)
    else
        # Newest first (default)
        sorted_file=$(printf '%s\n' "${found_files[@]}" | xargs -r ls -t | head -n 1)
    fi

    if [[ -n "$sorted_file" ]] && [[ -f "$sorted_file" ]]; then
        echo "$sorted_file"
        return 0
    fi

    return 1
}

# Find multiple files matching a pattern in Downloads directories
# Usage: find_files_in_downloads_from_common_functions <pattern> [max_results]
# Pattern: Glob pattern to match
# Max results: Maximum number of results to return (default: unlimited)
# Returns: Array of file paths, sorted by modification time (newest first)
find_files_in_downloads_from_common_functions() {
    local pattern="$1"
    local max_results="${2:-0}"  # 0 means unlimited
    local found_files=()

    # Get all Downloads directories
    local search_dirs=($(find_all_downloads_dirs_from_common_functions))

    if [[ ${#search_dirs[@]} -eq 0 ]]; then
        return 1
    fi

    # Search for files matching pattern (case-insensitive)
    for dir in "${search_dirs[@]}"; do
        while IFS= read -r -d '' file; do
            if [[ -f "$file" ]]; then
                found_files+=("$file")
            fi
        done < <(find "$dir" -maxdepth 1 -type f -iname "$pattern" -print0 2>/dev/null)
    done

    if [[ ${#found_files[@]} -eq 0 ]]; then
        return 1
    fi

    # Sort by modification time (newest first) and limit results
    if [[ $max_results -gt 0 ]]; then
        printf '%s\n' "${found_files[@]}" | xargs -r ls -t | head -n "$max_results"
    else
        printf '%s\n' "${found_files[@]}" | xargs -r ls -t
    fi

    return 0
}

# Prompt user to download a file and wait for it to appear in Downloads
# Usage: prompt_and_wait_for_download_from_common_functions <url> <pattern> [timeout_seconds]
# URL: Download URL to show to user
# Pattern: File pattern to search for (e.g., "*.deb", "cursor-*.AppImage")
# Timeout: Maximum time to wait in seconds (default: 0 = infinite wait)
# Returns: Path to downloaded file, or returns error code if cancelled
# NOTE: This function loops FOREVER with auto-detection every 2 seconds until file found or user cancels
prompt_and_wait_for_download_from_common_functions() {
    local download_url="$1"
    local file_pattern="$2"
    local timeout_seconds="${3:-0}"  # 0 means infinite wait
    local start_time=$(date +%s)
    local check_interval=2  # Auto-check every 2 seconds
    local last_check=0

    print_step_from_common_functions "Manual download required"
    print_info_from_common_functions "Download URL: $download_url"
    print_info_from_common_functions "Save the file to any /home/*/Downloads directory"
    print_info_from_common_functions "Expected file pattern: $file_pattern"

    # Try to open URL in browser
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$download_url" 2>/dev/null &
    elif command -v open >/dev/null 2>&1; then
        open "$download_url" 2>/dev/null &
    fi

    echo ""
    if [[ $timeout_seconds -gt 0 ]]; then
        print_info_from_common_functions "Auto-scanning every ${check_interval}s (timeout: ${timeout_seconds}s)"
    else
        print_info_from_common_functions "Auto-scanning every ${check_interval}s (waiting indefinitely)"
    fi
    print_info_from_common_functions "Type 'quit' to cancel anytime"
    echo ""

    # Infinite while loop - only exits when file found or user cancels
    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))

        # Auto-check at regular intervals
        if [[ $((current_time - last_check)) -ge $check_interval ]]; then
            local found_file=$(find_file_in_downloads_from_common_functions "$file_pattern" "newest")
            if [[ -n "$found_file" ]] && [[ -f "$found_file" ]]; then
                echo ""
                print_success_from_common_functions "Auto-detected downloaded file: $found_file"
                echo "$found_file"
                return 0
            fi
            last_check=$current_time

            # Show progress every auto-check
            echo "[${elapsed}s] Scanning Downloads directories for: $file_pattern"
        fi

        # Check timeout (if set)
        if [[ $timeout_seconds -gt 0 ]] && [[ $elapsed -ge $timeout_seconds ]]; then
            echo ""
            print_error_from_common_functions "Download timeout after ${timeout_seconds}s"
            return 1
        fi

        # Non-blocking input check (1 second timeout)
        read -r -t 1 user_input 2>/dev/null || true

        if [[ -n "$user_input" ]]; then
            case "${user_input,,}" in
                quit|q|exit|cancel)
                    echo ""
                    print_warning_from_common_functions "Download cancelled by user"
                    return 1
                    ;;
                yes|y|check)
                    # Force immediate check
                    local found_file=$(find_file_in_downloads_from_common_functions "$file_pattern" "newest")
                    if [[ -n "$found_file" ]] && [[ -f "$found_file" ]]; then
                        echo ""
                        print_success_from_common_functions "Found file: $found_file"
                        echo "$found_file"
                        return 0
                    else
                        print_warning_from_common_functions "File not found yet, continuing auto-scan..."
                    fi
                    ;;
            esac
        fi
    done

    # This line should never be reached due to infinite loop
    return 1
}

# ============================================================================
# NODE.JS TOOLS EXECUTION FUNCTIONS
# ============================================================================

# Execute node with absolute path and proper environment
# Usage: run_node_from_common_functions [args...]
# Returns: node exit code
run_node_from_common_functions() {
    # Ensure NODE_BIN is set
    if [[ -z "$NODE_BIN" ]] || [[ ! -x "$NODE_BIN" ]]; then
        # Fallback to system node
        if command -v node >/dev/null 2>&1; then
            node "$@"
            return $?
        else
            echo "Error: Node.js not found. Please install Node.js first." >&2
            return 127
        fi
    fi

    # Execute with absolute path
    "$NODE_BIN" "$@"
    return $?
}

# Execute npm with absolute path and proper environment
# Usage: run_npm_from_common_functions [args...]
# Returns: npm exit code
run_npm_from_common_functions() {
    # Ensure NPM_BIN is set
    if [[ -z "$NPM_BIN" ]] || [[ ! -x "$NPM_BIN" ]]; then
        # Fallback to system npm
        if command -v npm >/dev/null 2>&1; then
            npm "$@"
            return $?
        else
            echo "Error: npm not found. Please install npm first." >&2
            return 127
        fi
    fi

    # Add NODE_BIN_DIR to PATH for this execution
    local old_path="$PATH"
    export PATH="$NODE_BIN_DIR:$PATH"

    # Execute with absolute path
    "$NPM_BIN" "$@"
    local exit_code=$?

    # Restore PATH
    export PATH="$old_path"

    return $exit_code
}

# Execute pnpm with absolute path and proper environment
# Usage: run_pnpm_from_common_functions [args...]
# Returns: pnpm exit code
run_pnpm_from_common_functions() {
    # Idempotency: under no TTY (install scripts, systemd services) pnpm ABORTS its
    # node_modules format-purge (ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY) instead of
    # recreating the tree, which breaks otherwise-idempotent re-runs. Auto-confirm that
    # purge for these programmatic pnpm calls so install/add recreate node_modules and
    # never block. A caller may override by pre-setting npm_config_confirm_modules_purge.
    export npm_config_confirm_modules_purge="${npm_config_confirm_modules_purge:-false}"

    # Ensure PNPM_BIN is set
    if [[ -z "$PNPM_BIN" ]]; then
        # Try to find pnpm in NODE_BIN_DIR
        if [[ -n "$NODE_BIN_DIR" ]] && [[ -x "$NODE_BIN_DIR/pnpm" ]]; then
            PNPM_BIN="$NODE_BIN_DIR/pnpm"
        elif command -v pnpm >/dev/null 2>&1; then
            # Fallback to system pnpm
            pnpm "$@"
            return $?
        else
            echo "Error: pnpm not found. Please install pnpm first (npm install -g pnpm)" >&2
            return 127
        fi
    fi

    # Check if pnpm is installed
    if [[ ! -x "$PNPM_BIN" ]]; then
        # Try fallback
        if command -v pnpm >/dev/null 2>&1; then
            pnpm "$@"
            return $?
        else
            echo "Error: pnpm not found at $PNPM_BIN" >&2
            return 127
        fi
    fi

    # Add NODE_BIN_DIR and PNPM_GLOBAL_BIN_DIR to PATH for this execution
    local old_path="$PATH"
    if [[ -n "$PNPM_GLOBAL_BIN_DIR" ]]; then
        export PATH="$PNPM_GLOBAL_BIN_DIR:$NODE_BIN_DIR:$PATH"
    elif [[ -n "$NODE_BIN_DIR" ]]; then
        export PATH="$NODE_BIN_DIR:$PATH"
    fi

    # Execute with absolute path
    "$PNPM_BIN" "$@"
    local exit_code=$?

    # Restore original PATH
    export PATH="$old_path"
    return $exit_code
}

# Execute yarn with absolute path and proper environment
# Usage: run_yarn_from_common_functions [args...]
# Returns: yarn exit code
run_yarn_from_common_functions() {
    # Ensure YARN_BIN is set
    if [[ -z "$YARN_BIN" ]]; then
        # Try to find yarn in NODE_BIN_DIR
        if [[ -n "$NODE_BIN_DIR" ]] && [[ -x "$NODE_BIN_DIR/yarn" ]]; then
            YARN_BIN="$NODE_BIN_DIR/yarn"
        elif command -v yarn >/dev/null 2>&1; then
            # Fallback to system yarn
            yarn "$@"
            return $?
        else
            echo "Error: yarn not found. Please install yarn first." >&2
            return 127
        fi
    fi

    # Check if yarn is installed
    if [[ ! -x "$YARN_BIN" ]]; then
        # Try fallback
        if command -v yarn >/dev/null 2>&1; then
            yarn "$@"
            return $?
        else
            echo "Error: yarn not found at $YARN_BIN" >&2
            return 127
        fi
    fi

    # Add NODE_BIN_DIR to PATH for this execution
    local old_path="$PATH"
    export PATH="$NODE_BIN_DIR:$PATH"

    # Execute with absolute path
    "$YARN_BIN" "$@"
    local exit_code=$?

    # Restore PATH
    export PATH="$old_path"

    return $exit_code
}

# Execute npx with absolute path and proper environment
# Usage: run_npx_from_common_functions [args...]
# Returns: npx exit code
run_npx_from_common_functions() {
    # Ensure NPX_BIN is set
    if [[ -z "$NPX_BIN" ]] || [[ ! -x "$NPX_BIN" ]]; then
        # Fallback to system npx
        if command -v npx >/dev/null 2>&1; then
            npx "$@"
            return $?
        else
            echo "Error: npx not found. Please install npx first." >&2
            return 127
        fi
    fi

    # Add NODE_BIN_DIR to PATH for this execution
    local old_path="$PATH"
    export PATH="$NODE_BIN_DIR:$PATH"

    # Execute with absolute path
    "$NPX_BIN" "$@"
    local exit_code=$?

    # Restore PATH
    export PATH="$old_path"

    return $exit_code
}

# Ensure pnpm global bin directory is in PATH
# Usage: ensure_pnpm_path_from_common_functions
# Returns: 0 on success, 1 on failure
ensure_pnpm_path_from_common_functions() {
    if [[ -z "$PNPM_GLOBAL_BIN_DIR" ]]; then
        echo "Warning: PNPM_GLOBAL_BIN_DIR not set" >&2
        return 1
    fi

    # Check if already in current PATH
    if echo "$PATH" | grep -q "$PNPM_GLOBAL_BIN_DIR"; then
        return 0
    fi

    # Add to current session
    export PATH="$PNPM_GLOBAL_BIN_DIR:$PATH"

    # Add to /etc/environment for persistence
    if [[ ! -f /etc/environment ]]; then
        echo "PATH=\"$PNPM_GLOBAL_BIN_DIR:$NODE_BIN_DIR:/usr/local/bin:/usr/bin:/bin\"" | $USE_SUDO tee /etc/environment > /dev/null
    else
        # Check if pnpm bin dir is in /etc/environment
        if ! grep -q "$PNPM_GLOBAL_BIN_DIR" /etc/environment 2>/dev/null; then
            local current_path=$(grep "^PATH=" /etc/environment | sed 's/^PATH="//' | sed 's/"$//')
            if [[ -n "$current_path" ]]; then
                # Update existing PATH
                $USE_SUDO sed -i "s|^PATH=\"|PATH=\"$PNPM_GLOBAL_BIN_DIR:|" /etc/environment
            else
                # Add new PATH
                echo "PATH=\"$PNPM_GLOBAL_BIN_DIR:$NODE_BIN_DIR:/usr/local/bin:/usr/bin:/bin\"" | $USE_SUDO tee -a /etc/environment > /dev/null
            fi
        fi
    fi

    # Also ensure NODE_BIN_DIR is in PATH
    if ! echo "$PATH" | grep -q "$NODE_BIN_DIR"; then
        export PATH="$NODE_BIN_DIR:$PATH"

        if [[ -f /etc/environment ]] && ! grep -q "$NODE_BIN_DIR" /etc/environment 2>/dev/null; then
            local current_path=$(grep "^PATH=" /etc/environment | sed 's/^PATH="//' | sed 's/"$//')
            if [[ -n "$current_path" ]]; then
                $USE_SUDO sed -i "s|^PATH=\"|PATH=\"$NODE_BIN_DIR:|" /etc/environment
            fi
        fi
    fi

    return 0
}
