#!/bin/bash

# Fix All Permissions Library
# Common function to fix permissions for all installations

fix_all_permissions_from_common_functions() {
    print_header_from_common_functions "Fix All Installation Permissions"

    print_info_from_common_functions "Starting comprehensive permission fix..."

    # 1. Remove old installations
    print_step_from_common_functions "Step 1: Removing old installation directory"
    migrate_all_old_installations_from_common_functions

    # 2. Fix NPM permissions
    if command -v npm >/dev/null 2>&1; then
        print_step_from_common_functions "Step 2: Fixing NPM global permissions"
        fix_npm_global_permissions_from_common_functions
    else
        print_info_from_common_functions "NPM not installed, skipping NPM permission fix"
    fi

    # 3. Fix permissions for installation directories
    print_step_from_common_functions "Step 3: Fixing permissions for installation directories"

    local install_dirs=(
        "$(map_web_path 'dev_system')"
        "/usr/local/bin"
    )

    for dir in "${install_dirs[@]}"; do
        if [ -d "$dir" ]; then
            print_info_from_common_functions "Fixing permissions for: $dir"
            fix_installation_permissions_from_common_functions "$dir" "755" "true"
        else
            print_info_from_common_functions "Directory does not exist: $dir (skipping)"
        fi
    done

    # 4. Fix user-specific directories
    print_step_from_common_functions "Step 4: Fixing user-specific directories"

    local real_user=$(get_real_user_from_common_functions)
    print_info_from_common_functions "Real user detected: $real_user"

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
                print_info_from_common_functions "Fixing permissions for: $dir"
                fix_installation_permissions_from_common_functions "$dir" "755" "true"
            fi
        done
    fi

    print_success_from_common_functions "Permission fix completed successfully"
    return 0
}
