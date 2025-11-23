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

# Fix All Permissions Script
# This script scans all installed software and fixes permissions to allow all users access

# Script identification and path setup
SCRIPT_INDEX="999"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables and common functions
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Declare variables
SCRIPT_TEMP_DIR=$(create_script_temp_dir "999_fix_all_permissions")
LOG_FILE="$SCRIPT_TEMP_DIR/fix_permissions_$(date +%Y%m%d_%H%M%S).log"

# Logging function
log_message() {
    local message="$1"
    echo "[$SCRIPT_INDEX][$(date '+%Y-%m-%d %H:%M:%S')] $message" | tee -a "$LOG_FILE"
}

# Main function
main() {
    print_header_from_common_functions "Fix All Installation Permissions"

    log_message "Starting comprehensive permission fix for all installations..."

    # 1. Migrate old installations
    print_step_from_common_functions "Step 1: Migrating old installations from dev_ubuntu24 to _ubuntu_24"
    migrate_all_old_installations_from_common_functions 2>&1 | tee -a "$LOG_FILE"

    # 2. Update wrapper scripts
    print_step_from_common_functions "Step 2: Updating wrapper scripts"
    update_wrapper_script_paths_from_common_functions "/usr/local/super_scripts" "dev_ubuntu24" "_ubuntu_24" 2>&1 | tee -a "$LOG_FILE"

    # 3. Fix NPM permissions
    if command -v npm >/dev/null 2>&1; then
        print_step_from_common_functions "Step 3: Fixing NPM global permissions"
        fix_npm_global_permissions_from_common_functions 2>&1 | tee -a "$LOG_FILE"
    else
        log_message "NPM not installed, skipping NPM permission fix"
    fi

    # 4. Fix permissions for common installation directories
    print_step_from_common_functions "Step 4: Fixing permissions for installation directories"

    local install_dirs=(
        "/www/_ubuntu_24"
        "/www/dev_ubuntu24"
        "/usr/local/super_scripts"
        "/usr/local/super_bin"
        "/usr/local/bin"
    )

    for dir in "${install_dirs[@]}"; do
        if [ -d "$dir" ]; then
            log_message "Fixing permissions for: $dir"
            fix_installation_permissions_from_common_functions "$dir" "755" "true" 2>&1 | tee -a "$LOG_FILE"
        else
            log_message "Directory does not exist: $dir (skipping)"
        fi
    done

    # 5. Fix permissions for wrapper scripts
    print_step_from_common_functions "Step 5: Ensuring wrapper scripts are executable"

    if [ -d "/usr/local/super_scripts" ]; then
        find /usr/local/super_scripts -type f -exec chmod +x {} \; 2>/dev/null || true
        log_message "Made all files in /usr/local/super_scripts executable"
    fi

    # 6. Get real user and display
    print_step_from_common_functions "Step 6: Detecting real user"
    local real_user=$(get_real_user_from_common_functions)
    log_message "Real user detected: $real_user"

    # 7. Fix permissions for user-specific directories
    print_step_from_common_functions "Step 7: Fixing user-specific directories"

    local user_home=$(getent passwd "$real_user" | cut -d: -f6)
    if [ -n "$user_home" ] && [ -d "$user_home" ]; then
        local user_dirs=(
            "$user_home/.local/bin"
            "$user_home/.local/share"
            "$user_home/.config"
            "$user_home/.cache"
        )

        for dir in "${user_dirs[@]}"; do
            if [ -d "$dir" ]; then
                log_message "Fixing permissions for: $dir"
                fix_installation_permissions_from_common_functions "$dir" "755" "true" 2>&1 | tee -a "$LOG_FILE"
            fi
        done
    fi

    # 8. Summary
    print_header_from_common_functions "Permission Fix Summary"
    log_message "All permission fixes completed"
    log_message "Real user: $real_user"
    log_message "Log file: $LOG_FILE"

    print_success_from_common_functions "Permission fix completed successfully"
}

# Execute main function
main "$@"
