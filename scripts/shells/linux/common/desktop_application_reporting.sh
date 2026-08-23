#!/bin/bash

# Function to print installation statistics and super launch report
print_installation_report() {
    local total_apps=0
    local installed_apps=0
    local skipped_apps=()
    local super_enabled_apps=()

    log_message ""
    log_message "=========================================="
    log_message "INSTALLATION SUMMARY REPORT"
    log_message "=========================================="

    # Iterate through all package groups to collect statistics
    for group in "BASE" "DEV" "APP" "AI" "MCP"; do
        local apps_in_group
        mapfile -t apps_in_group < <(get_apps_by_package_group "$group")

        for app in "${apps_in_group[@]}"; do
            local lookup_app="$app"
            if [[ "$app" == mcp_* ]]; then
                lookup_app="${app#mcp_}"
            fi

            local exec_name=$(get_app_property "$lookup_app" "exec")
            local app_name=$(get_app_property "$lookup_app" "name")
            local super_cmd=$(get_app_property "$lookup_app" "super")

            ((total_apps++))

            # Check if app is installed
            if command -v "$exec_name" >/dev/null 2>&1; then
                ((installed_apps++))
            else
                skipped_apps+=("$app_name ($exec_name)")
            fi

            # Check if super is enabled for DEV group
            if [ "$group" = "DEV" ] && [ -n "$super_cmd" ] && [ "$super_cmd" != "" ]; then
                super_enabled_apps+=("$app_name ($exec_name)")
            fi
        done
    done

    # Print statistics
    log_message "Total Applications: $total_apps"
    log_message "Installed: $installed_apps"
    log_message "Skipped/Not Installed: $((total_apps - installed_apps))"

    # Print skipped applications
    if [ ${#skipped_apps[@]} -gt 0 ]; then
        log_message ""
        log_message "Skipped Applications (Not Installed):"
        for app in "${skipped_apps[@]}"; do
            log_message "  - $app"
        done
    fi

    # Print failed applications (attempted but installation failed)
    if [ ${#FAILED_APPS[@]} -gt 0 ]; then
        log_message ""
        log_message "Failed Installations (Error Occurred):"
        for app in "${FAILED_APPS[@]}"; do
            log_message "  - $app"
        done
    fi

    # Print unavailable packages (not found in registry)
    if [ ${#SKIPPED_APPS[@]} -gt 0 ]; then
        log_message ""
        log_message "Unavailable Packages (Not Found in Registry):"
        for app in "${SKIPPED_APPS[@]}"; do
            log_message "  - $app"
        done
    fi

    # Print DEV applications with super launch enabled
    log_message ""
    log_message "DEV Applications with Super Launch Support:"
    log_message "  Total with super: ${#super_enabled_apps[@]}"
    for app in "${super_enabled_apps[@]}"; do
        log_message "  - $app"
    done

    # Print actual super launch implementations
    log_message ""
    log_message "Actual Super Launch Implementations:"

    if [ -d "/usr/local/super_bin" ]; then
        local super_bin_files=($(ls -1 /usr/local/super_bin 2>/dev/null || echo ""))
        if [ ${#super_bin_files[@]} -gt 0 ]; then
            log_message "  Files in /usr/local/super_bin (${#super_bin_files[@]}):"
            for file in "${super_bin_files[@]}"; do
                log_message "    - $file"
            done
        else
            log_message "  /usr/local/super_bin is empty"
        fi
    else
        log_message "  /usr/local/super_bin does not exist"
    fi

    log_message ""
    log_message "=========================================="
    
    # Refresh environment variables and shell configuration
    log_message "Refreshing environment variables..."
    refresh_environment
}

# Function to refresh links for a single pnpm package
refresh_npm_package_links() {
    local exec_name="$1"
    local lookup_app="$2"
    
    # Get pnpm global bin directory
    local pnpm_binary=""
    local pnpm_global_bin=""
    local binary_path=""
    
    pnpm_binary="$(resolve_pnpm_binary_path)"
    pnpm_global_bin="$(resolve_pnpm_global_bin_dir "$pnpm_binary")"
    if [ -n "$pnpm_global_bin" ] && [ -d "$pnpm_global_bin" ]; then
        binary_path="$pnpm_global_bin/$exec_name"
    fi
    
    # Fallback to which if pnpm bin directory not available
    if [ -z "$binary_path" ] || [ ! -e "$binary_path" ]; then
        binary_path=$(command -v "$exec_name" 2>/dev/null)
        if [ -z "$binary_path" ]; then
            log_message "Warning: Could not find binary for $exec_name"
            return
        fi
    fi
    
    log_message "Refreshing links for pnpm package: $exec_name"
    
    # Create symbolic link in /usr/local/bin pointing directly to pnpm binary
    local link_path="/usr/local/bin/$exec_name"
    
    # Check if link already points to correct target
    if [ -L "$link_path" ]; then
        local current_target=$(readlink -f "$link_path")
        local real_binary=$(readlink -f "$binary_path")
        
        if [ "$current_target" = "$real_binary" ]; then
            log_message "Link already correct: $link_path -> $binary_path"
            return
        fi
    fi
    
    # Remove existing link/file if it exists
    if [ -e "$link_path" ] || [ -L "$link_path" ]; then
        $USE_SUDO rm -f "$link_path"
        log_message "Removed existing link/file: $link_path"
    fi
    
    # Create new symbolic link directly to pnpm binary
    $USE_SUDO ln -sf "$binary_path" "$link_path"
    log_message "Created symbolic link: $link_path -> $binary_path"
    
    return 0
}

# Function to refresh environment variables and shell configuration
refresh_environment() {
    log_message ""
    log_message "=========================================="
    log_message "REFRESHING PNPM BINARIES AND LAUNCH SCRIPTS"
    log_message "=========================================="
    
    # Create super_scripts directory if it doesn't exist
    if [ ! -d "/usr/local/super_scripts" ]; then
        log_message "Creating /usr/local/super_scripts directory..."
        $USE_SUDO mkdir -p "/usr/local/super_scripts"
        $USE_SUDO chmod 755 "/usr/local/super_scripts"
    fi
    
    # Get pnpm global bin directory
    local pnpm_binary=""
    local pnpm_global_bin=""
    pnpm_binary="$(resolve_pnpm_binary_path)"
    pnpm_global_bin="$(resolve_pnpm_global_bin_dir "$pnpm_binary")"
    if [ -z "$pnpm_global_bin" ] || [ ! -d "$pnpm_global_bin" ]; then
        log_message "Warning: Could not determine pnpm global bin directory"
        return
    fi
    
    log_message "pnpm global bin directory: $pnpm_global_bin"
    
    # Process all AI packages that use pnpm installation method.
    # NOTE: "claude" is excluded here on purpose -- Claude Code is installed and
    # linked by install_shells/171_install_claude_code.sh (native workflow).
    local pnpm_packages=("gemini" "codex" "auggie")
    
    for package in "${pnpm_packages[@]}"; do
        local exec_name=$(get_app_property "$package" "exec")
        local launch_command=$(get_app_property "$package" "launch_command")
        local package_id=$(get_app_property "$package" "package_id")
        
        if [ -n "$exec_name" ] && [ -n "$launch_command" ]; then
            log_message ""
            log_message "Processing $package ($exec_name)..."
            
            # Check if the binary exists in pnpm global bin
            local binary_path="$pnpm_global_bin/$exec_name"
            if [ -f "$binary_path" ]; then
                log_message "Found binary: $binary_path"
                
                # Create launch script in super_scripts
                local script_path="/usr/local/super_scripts/$exec_name"
                log_message "Creating launch script: $script_path"
                
                # Extract the actual command from launch_command (remove "which exec && $USE_SUDO")
                local actual_command=$(echo "$launch_command" | sed 's/which [^&]* && \$USE_SUDO //')

                # For pnpm packages, replace relative paths with absolute paths
                local processed_command="$actual_command"
                if [[ "$launch_command" =~ node[[:space:]]+[^[:space:]]+ ]]; then
                    # Extract the executable name after "node"
                    local node_exec=$(echo "$actual_command" | sed -n 's/.*node[[:space:]]\+\([^[:space:]]\+\).*/\1/p')
                    if [ -n "$node_exec" ]; then
                        # Use absolute path to the pnpm binary (without $@ here, it will be added below)
                        processed_command="node $binary_path"
                    fi
                fi

                # Get itemkey if it exists (optional command argument)
                local itemkey=$(get_itemkey "$package")
                local final_command="$processed_command"
                
                # If itemkey exists, prepend it before user arguments
                if [ -n "$itemkey" ]; then
                    # Add itemkey before user arguments ($@)
                    final_command="$processed_command $itemkey"
                fi

                # Create the script content
                cat > "/tmp/$exec_name" << EOF
#!/bin/bash
# Launch script for $package
# Generated by 153_install_desktop_applications.sh
# Package: $package_id

# Add pnpm global bin to PATH
export PATH="\$PATH:$pnpm_global_bin"

# Execute the launch command
$final_command "\$@"
EOF
                
                # Move script to super_scripts and make executable
                $USE_SUDO mv "/tmp/$exec_name" "$script_path"
                $USE_SUDO chmod +x "$script_path"
                log_message "Created script: $script_path"
                
                # Create symbolic link in /usr/local/bin
                local link_path="/usr/local/bin/$exec_name"
                
                # Remove existing link if it exists
                if [ -L "$link_path" ] || [ -f "$link_path" ]; then
                    $USE_SUDO rm -f "$link_path"
                    log_message "Removed existing link: $link_path"
                fi
                
                # Create new symbolic link
                $USE_SUDO ln -s "$script_path" "$link_path"
                log_message "Created symbolic link: $link_path -> $script_path"
                
            else
                log_message "Binary not found: $binary_path"
            fi
        else
            log_message "Skipping $package: missing exec_name or launch_command"
        fi
    done
    
    log_message ""
    log_message "PNPM binaries refresh completed!"
    log_message "=========================================="
}

