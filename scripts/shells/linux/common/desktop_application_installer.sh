#!/bin/bash

# Logging function
log_message() {
    local message="$1"
    echo "[$SCRIPT_INDEX][$(date '+%Y-%m-%d %H:%M:%S')] $message" | tee -a "$LOG_FILE"
}

resolve_pnpm_binary_path() {
    if [ -n "${PNPM_BIN:-}" ] && [ -x "$PNPM_BIN" ]; then
        echo "$PNPM_BIN"
        return
    fi

    if [ -n "${NODE_BIN_DIR:-}" ] && [ -x "$NODE_BIN_DIR/pnpm" ]; then
        echo "$NODE_BIN_DIR/pnpm"
        return
    fi

    command -v pnpm 2>/dev/null || true
}

resolve_pnpm_global_bin_dir() {
    local pnpm_bin="$1"
    local pnpm_global_bin_dir=""

    if [ -n "${PNPM_GLOBAL_BIN_DIR:-}" ] && [ -d "$PNPM_GLOBAL_BIN_DIR" ]; then
        echo "$PNPM_GLOBAL_BIN_DIR"
        return
    fi

    if [ -n "${PNPM_GLOBAL_DIR:-}" ] && [ -d "$PNPM_GLOBAL_DIR/bin" ]; then
        echo "$PNPM_GLOBAL_DIR/bin"
        return
    fi

    if command -v get_var >/dev/null 2>&1; then
        pnpm_global_bin_dir="$(get_var "PNPM_GLOBAL_BIN_DIR" 2>/dev/null || true)"
        if [ -n "$pnpm_global_bin_dir" ] && [ -d "$pnpm_global_bin_dir" ]; then
            echo "$pnpm_global_bin_dir"
            return
        fi
    fi

    if [ -n "$pnpm_bin" ] && [ -x "$pnpm_bin" ]; then
        pnpm_global_bin_dir="$("$pnpm_bin" config get global-bin-dir 2>/dev/null)"
        if [ -n "$pnpm_global_bin_dir" ] && [ -d "$pnpm_global_bin_dir" ]; then
            echo "$pnpm_global_bin_dir"
            return
        fi
    fi

    local fallback_pnpm_binary=""
    fallback_pnpm_binary="$(command -v pnpm 2>/dev/null || true)"
    if [ -n "$fallback_pnpm_binary" ] && [ -x "$fallback_pnpm_binary" ]; then
        pnpm_global_bin_dir="$("$fallback_pnpm_binary" config get global-bin-dir 2>/dev/null)"
        if [ -n "$pnpm_global_bin_dir" ] && [ -d "$pnpm_global_bin_dir" ]; then
            echo "$pnpm_global_bin_dir"
            return
        fi
    fi
}


# Function to install AppImage
install_via_appimage() {
    local download_url="$1"
    local app_name="$2"
    local exec_name="$3"
    local app_id="${4:-${exec_name}}"

    local appimage_dir=$(map_web_path "compile_dir" "applications/appimages")
    local install_dir="$appimage_dir/$exec_name"
    local appimage_file="$install_dir/${exec_name}.AppImage"
    local extracted_dir="$install_dir/extracted"
    local apprun_path="$extracted_dir/squashfs-root/AppRun"

    log_message "Installing $app_name via AppImage from: $download_url"

    # Install libfuse2 dependency (required for AppImage)
    if ! dpkg -l | grep -q "^ii.*libfuse2"; then
        log_message "Installing libfuse2 (required for AppImage)..."
        $USE_SUDO apt-get update -qq
        $USE_SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" libfuse2 2>&1 | tee -a "$LOG_FILE" || log_message "Warning: Failed to install libfuse2"
    fi

    # Create AppImage directory structure
    $USE_SUDO mkdir -p "$install_dir"
    $USE_SUDO mkdir -p "$extracted_dir"

    # Download AppImage
    if $USE_SUDO wget --progress=bar:force -O "$appimage_file" "$download_url" 2>&1 | tee -a "$LOG_FILE"; then
        log_message "AppImage downloaded successfully"
    else
        log_message "Failed to download $app_name AppImage"
        return
    fi

    # Make executable
    $USE_SUDO chmod +x "$appimage_file"

    # Extract AppImage to get icon, desktop file and AppRun
    log_message "Extracting AppImage..."
    # Idempotency: clear any prior extraction so re-runs don't accumulate stale squashfs-root files.
    $USE_SUDO rm -rf "$extracted_dir/squashfs-root" 2>/dev/null || true
    cd "$extracted_dir"
    if $USE_SUDO "$appimage_file" --appimage-extract >/dev/null 2>&1; then
        log_message "AppImage extracted successfully"
    else
        log_message "Warning: AppImage extraction failed, will use AppImage directly"
        # Fall back to using AppImage directly if extraction fails
        apprun_path="$appimage_file"
    fi
    cd - >/dev/null

    # Fix chrome-sandbox permissions if it exists (critical for Electron apps)
    if [ -d "$extracted_dir/squashfs-root" ]; then
        local chrome_sandbox_paths=(
            "$extracted_dir/squashfs-root/chrome-sandbox"
            "$extracted_dir/squashfs-root/usr/lib/chrome-sandbox"
        )

        for sandbox_pattern in "$extracted_dir/squashfs-root/opt/"*"/chrome-sandbox"; do
            chrome_sandbox_paths+=("$sandbox_pattern")
        done

        for sandbox_path in "${chrome_sandbox_paths[@]}"; do
            if [ -f "$sandbox_path" ]; then
                log_message "Fixing chrome-sandbox permissions: $sandbox_path"
                $USE_SUDO chown root:root "$sandbox_path" 2>/dev/null || true
                $USE_SUDO chmod 4755 "$sandbox_path" 2>/dev/null || true
            fi
        done
    fi

    # Get app configuration from linux_applications_list.sh
    local desktop_name="${app_id}_desktop_name"
    local desktop_comment="${app_id}_desktop_comment"
    local desktop_categories="${app_id}_desktop_categories"
    local startup_wm_class="${app_id}_startup_wm_class"
    local need_super="${app_id}_super"
    local need_desktop_icon="${app_id}_need_desktop_icon"

    # Create wrapper script
    local wrapper_script="/usr/local/super_scripts/${exec_name}.sh"
    log_message "Creating wrapper script: $wrapper_script"

    $USE_SUDO mkdir -p "/usr/local/super_scripts"

    # Determine which executable to use (AppRun or AppImage)
    local exec_target=""
    if [ -f "$apprun_path" ] && [ "$apprun_path" != "$appimage_file" ]; then
        exec_target="$apprun_path"
        log_message "Using extracted AppRun: $exec_target"
    else
        exec_target="$appimage_file"
        log_message "Using AppImage directly: $exec_target"
    fi

    if [[ "${!need_super}" == "true" ]]; then
        # Create wrapper with --no-sandbox flag (for apps needing root or sandbox bypass)
        cat << WRAPPER_EOF | $USE_SUDO tee "$wrapper_script" > /dev/null
#!/bin/bash
# ${app_name} Launcher Script (AppImage Installation)
# This script launches the app with --no-sandbox flag

EXEC_PATH="$exec_target"

if [[ ! -f "\$EXEC_PATH" ]]; then
    echo "Error: Executable not found at \$EXEC_PATH"
    echo "Please reinstall ${app_name}"
    exit 1
fi

# Launch with --no-sandbox (required for certain execution contexts)
exec "\$EXEC_PATH" --no-sandbox "\$@"
WRAPPER_EOF
    else
        # Create simple wrapper without --no-sandbox
        cat << WRAPPER_EOF | $USE_SUDO tee "$wrapper_script" > /dev/null
#!/bin/bash
# ${app_name} Launcher Script (AppImage Installation)

EXEC_PATH="$exec_target"

if [[ ! -f "\$EXEC_PATH" ]]; then
    echo "Error: Executable not found at \$EXEC_PATH"
    echo "Please reinstall ${app_name}"
    exit 1
fi

# Launch application
exec "\$EXEC_PATH" "\$@"
WRAPPER_EOF
    fi

    $USE_SUDO chmod +x "$wrapper_script"

    # Create symlink in /usr/local/bin
    $USE_SUDO ln -sf "$wrapper_script" "/usr/local/bin/$exec_name"

    # Find icon
    local icon_path="$exec_name"
    if [ -d "$extracted_dir/squashfs-root" ]; then
        # Try to find icon in multiple common locations
        local found_icon=$(find "$extracted_dir/squashfs-root" \( -name "${exec_name}.png" -o -name "${exec_name}.svg" -o -name "icon.png" -o -name "*.png" \) -type f 2>/dev/null | head -1)
        if [ -n "$found_icon" ]; then
            icon_path="$found_icon"
            log_message "Using icon: $icon_path"
        fi
    fi

    # Create desktop entry
    if [[ "${!need_desktop_icon}" == "true" ]]; then
        # Use desktop_entry_manager.sh for consistent icon creation
        local desktop_manager_script="$PARENT_DIR_LEVEL_1/debian_com/desktop_entry_manager.sh"
        
        if [[ -x "$desktop_manager_script" ]]; then
            log_message "Creating desktop entry via desktop_entry_manager.sh"
            
            # Detect desktop manager user
            local desktop_manager_user="${SUDO_USER:-$USER}"
            local desktop_manager_home="$(getent passwd "$desktop_manager_user" | cut -d: -f6)"
            if [[ -z "$desktop_manager_home" ]] || [[ ! -d "$desktop_manager_home" ]]; then
                desktop_manager_home="$HOME"
            fi
            
            # Run desktop_entry_manager as the actual user (not root)
            local run_cmd=""
            if [[ -n "$desktop_manager_user" ]] && [[ "$desktop_manager_user" != "root" ]] && [[ "$desktop_manager_user" != "$USER" ]]; then
                run_cmd="sudo -u $desktop_manager_user"
            fi
            
            # Use --create-app to generate launcher and desktop entry with pkexec support
            $run_cmd bash "$desktop_manager_script" --create-app \
                "$exec_name" \
                "${!desktop_name:-$app_name}" \
                "$exec_target" \
                "$icon_path" \
                "${!desktop_categories:-Utility}" \
                "${!desktop_comment:-$app_name}" \
                "${!startup_wm_class:-$app_name}" 2>&1 | tee -a "$LOG_FILE"
            
            log_message "Desktop entry created via desktop_entry_manager.sh"
        else
            log_message "Warning: desktop_entry_manager.sh not found, using shared shortcut library"
            # Fallback: create the system-wide menu entry via the shared library.
            # A single /usr/share/applications entry is read by every desktop
            # environment and covers all users, replacing the manual tee + chmod +
            # update-desktop-database below.
            log_message "Creating desktop entry (fallback) via desktop_shortcut_manager.sh: ${exec_name}"
            create_desktop_shortcut_from_desktop_shortcut_manager \
                --id "$exec_name" \
                --name "${!desktop_name:-$app_name}" \
                --exec "$exec_target" \
                --icon "$icon_path" \
                --comment "${!desktop_comment:-$app_name}" \
                --generic "${!desktop_name:-$app_name}" \
                --categories "${!desktop_categories:-Utility;}" \
                --keywords "${exec_name};" \
                --startup-wmclass "${!startup_wm_class:-$app_name}" \
                --extra "StartupNotify=true" 2>&1 | tee -a "$LOG_FILE"
        fi
    else
        # Legacy: apps without need_desktop_icon flag use the shared library.
        # The single /usr/share/applications menu entry it writes is read by every
        # desktop environment and covers all users (StartupNotify=false is the
        # library default, so it is not passed explicitly).
        log_message "Creating desktop entry (legacy) via desktop_shortcut_manager.sh: ${exec_name}"
        create_desktop_shortcut_from_desktop_shortcut_manager \
            --id "$exec_name" \
            --name "${!desktop_name:-$app_name}" \
            --exec "$exec_target" \
            --icon "$icon_path" \
            --comment "${!desktop_comment:-$app_name}" \
            --generic "${!desktop_name:-$app_name}" \
            --categories "${!desktop_categories:-Utility;}" \
            --keywords "${exec_name};" \
            --startup-wmclass "${!startup_wm_class:-$app_name}" 2>&1 | tee -a "$LOG_FILE"
    fi

    log_message "Successfully installed $app_name"
    log_message "Launcher: /usr/local/super_scripts/${exec_name}.sh"
    log_message "Command: $exec_name"

    # Fix permissions for AppImage installation directory
    log_message "Fixing permissions for AppImage installation: $install_dir"
    fix_installation_permissions_from_common_functions "$install_dir" "777" "true" 2>&1 | while IFS= read -r line; do
        log_message "$line"
    done

    # Fix permissions for wrapper script
    if [ -f "$wrapper_script" ]; then
        fix_installation_permissions_from_common_functions "$wrapper_script" "777" "true" 2>&1 | while IFS= read -r line; do
            log_message "$line"
        done
    fi
}




# Function to fix pnpm global binary permissions
fix_pnpm_permissions() {
    log_message "Fixing pnpm global binary permissions..."

    local pnpm_binary=""
    local pnpm_global_bin=""
    local binary_count=0

    pnpm_binary="$(resolve_pnpm_binary_path)"
    pnpm_global_bin="$(resolve_pnpm_global_bin_dir "$pnpm_binary")"

    if [ -n "$pnpm_global_bin" ] && [ -d "$pnpm_global_bin" ]; then
        # Set executable permissions for all binaries in pnpm global bin directory
        $USE_SUDO find "$pnpm_global_bin" -type f -name "*" -exec chmod +x {} \; 2>/dev/null || true
        log_message "Fixed executable permissions for all binaries in: $pnpm_global_bin"

        # Count how many binaries were fixed
        binary_count=$(find "$pnpm_global_bin" -type f -name "*" 2>/dev/null | wc -l)
        log_message "Fixed permissions for $binary_count pnpm global binaries"

        # Use new comprehensive permission fix function
        fix_pnpm_global_permissions_from_common_functions 2>&1 | while IFS= read -r line; do
            log_message "$line"
        done
    else
        log_message "Warning: Could not determine pnpm global bin directory"
    fi
}


# Function to create symlink to /usr/local/bin
create_symlink_usr_local_bin() {
    local exec_name="$1"
    local app_name="${2:-$exec_name}"

    # Find the binary in common locations
    local binary_path=""
    local search_paths=(
        "/usr/bin/$exec_name"
        "/usr/local/bin/$exec_name"
        "$HOME/.local/bin/$exec_name"
        "$HOME/.cargo/bin/$exec_name"
        "/opt/*/bin/$exec_name"
        "/snap/bin/$exec_name"
    )

    for path in "${search_paths[@]}"; do
        # Handle wildcard expansion for /opt/*/bin/
        if [[ "$path" == *"*"* ]]; then
            for expanded_path in $path; do
                if [ -f "$expanded_path" ] && [ -x "$expanded_path" ]; then
                    binary_path="$expanded_path"
                    break 2
                fi
            done
        elif [ -f "$path" ] && [ -x "$path" ]; then
            binary_path="$path"
            break
        fi
    done

    if [ -z "$binary_path" ]; then
        log_message "Binary for $app_name not found in common locations"
        return 1
    fi

    # Create symlink if target doesn't already exist or points elsewhere
    local target_link="/usr/local/bin/$exec_name"
    if [ -L "$target_link" ]; then
        local current_target=$(readlink "$target_link")
        if [ "$current_target" = "$binary_path" ]; then
            log_message "Symlink already exists and is correct: $target_link -> $binary_path"
            return 0
        else
            log_message "Updating existing symlink: $target_link -> $binary_path"
        fi
    fi

    log_message "Creating symlink: $target_link -> $binary_path"
    if $USE_SUDO ln -sf "$binary_path" "$target_link"; then
        log_message "Successfully created symlink for $app_name"
        return 0
    else
        log_message "Failed to create symlink for $app_name"
        return 1
    fi
}

# Function to verify application installation
verify_installation() {
    local exec_name="$1"
    local app_name="$2"
    
    if command_exists "$exec_name"; then
        log_message "$app_name is installed and available in PATH"
        return 0
    else
        log_message "$app_name is not available in PATH"
        return 1
    fi
}

# Function to install single application
install_application() {
    local app_name="$1"
    local package_group="$2"
    local display_name=""
    local exec_name=""
    local install_method=""
    local package_id=""
    local launch_command=""
    local super_command=""
    local snap_confinement=""

    # Handle MCP apps (remove mcp_ prefix for property lookup)
    local lookup_app="$app_name"
    if [[ "$app_name" == mcp_* ]]; then
        lookup_app="${app_name#mcp_}"
    fi

    # Get application properties using the unified structure
    display_name=$(get_app_property "$lookup_app" "name")
    exec_name=$(get_app_property "$lookup_app" "exec")
    install_method=$(get_install_method "$lookup_app")
    case "$install_method" in
        npm|pnpm)
            install_method="pnpm"
            ;;
    esac
    package_id=$(get_package_id "$lookup_app")
    super_command=$(get_app_property "$lookup_app" "super")
    snap_confinement=$(get_snap_confinement "$lookup_app")

    # Skip if no package ID or install method
    if [ -z "$package_id" ] || [ -z "$install_method" ]; then
        log_message "Skipping $app_name - no package ID or install method"
        return 0
    fi

    # Filter out desktop apps on server environments
    if [ "$HAS_DESKTOP_ENVIRONMENT" = false ] || [ "$ENVIRONMENT_TYPE" = "server" ]; then
        local skip_app=false
        # Keep AI and MCP packages installable in all environments.
        if [ "$package_group" != "AI" ] && [ "$package_group" != "MCP" ]; then
            # Filter large models
            if [[ "$lookup_app" == *"ollama"* ]] || [[ "$lookup_app" == *"lmstudio"* ]] || [[ "$lookup_app" == *"gpt4all"* ]]; then
                skip_app=true
            fi
            # Filter browsers
            if [[ "$lookup_app" == *"edge"* ]] || [[ "$lookup_app" == *"chrome"* ]] || [[ "$lookup_app" == *"firefox"* ]]; then
                skip_app=true
            fi
            # Filter IDEs and regular apps
            if [ "$package_group" = "DEV" ] || [ "$package_group" = "APP" ]; then
                # Allow AI-assisted IDEs
                if [[ "$lookup_app" != *"cursor"* ]] && [[ "$lookup_app" != *"windsurf"* ]] && [[ "$lookup_app" != *"cline"* ]]; then
                    skip_app=true
                fi
            fi
        fi
        if [ "$skip_app" = true ]; then
            log_message "Server environment: skipping $display_name"
            return 0
        fi
    fi

    log_message "Installing $display_name..."
    log_message "  Method: $install_method"
    log_message "  Package ID: $package_id"
    log_message "  Executable: $exec_name"

    # Determine if super launch should be used
    local should_use_super=false
    if [ "$package_group" = "DEV" ]; then
        # DEV_PACKAGES with _super="true" use auto-generated command
        if [ "$super_command" = "true" ]; then
            # Auto-generate: sudo $exec_name
            super_command="sudo $exec_name"
            should_use_super=true
        elif [ -n "$super_command" ] && [ "$super_command" != "" ]; then
            # If super_command has a specific value, use it
            should_use_super=true
        fi
    else
        # Other groups only use super if explicitly set (non-empty, non-null)
        if [ -n "$super_command" ] && [ "$super_command" != "" ] && [ "$super_command" != "null" ]; then
            should_use_super=true
        fi
    fi

    # Check if already installed
    if verify_installation "$exec_name" "$display_name"; then
        if [ "$install_method" = "pnpm" ]; then
            log_message "$display_name is already installed. Running pnpm upgrade."
        else
            log_message "$display_name is already installed, repairing links and scripts..."

            # Create or repair launch script if launch command exists (always repair, even if installed)
            if [ -n "$launch_command" ]; then
                log_message "Repairing launch script for $display_name"
                create_launch_script "$lookup_app"
            fi

            # For pnpm packages, refresh the symlink to point directly to pnpm binary
            if [ "$install_method" = "pnpm" ]; then
                log_message "Refreshing pnpm package links for $display_name"
                refresh_npm_package_links "$exec_name" "$lookup_app"
            fi

            return 0
        fi
    fi

    # Handle snap packages with special confinement requirements
    if [ "$install_method" = "snap" ] && [ -n "$snap_confinement" ]; then
        log_message "  Snap Confinement: $snap_confinement"
        # Pass snap_confinement to snap installer via direct call
        install_via_snap "$package_id" "$display_name" "$snap_confinement"
    # Handle AppImage packages with custom installation
    elif [ "$install_method" = "appimage" ]; then
        log_message "  Installing AppImage from: $package_id"
        # Get app configuration for desktop entry creation
        local app_id="${lookup_app}"
        install_via_appimage "$package_id" "$display_name" "$exec_name" "$app_id"
        # AppImage creates its own wrapper, skip setup_super_launch
        should_use_super=false
    else
        # Use universal install function from installation library
        universal_install "$install_method" "$package_id" "$display_name" "$exec_name" || true
    fi

    # Create direct symlink if installation was successful
    if [ "$(verify_installation "$exec_name" "$display_name")" = "true" ]; then
        log_message "Creating launch script for $display_name"
        create_launch_script "$lookup_app"
        
        # For pnpm packages, also refresh the direct symlink
        if [ "$install_method" = "pnpm" ]; then
            refresh_npm_package_links "$exec_name" "$lookup_app"
        fi
        log_message "Successfully installed and verified $display_name"
    else
        log_message "Installation failed or verification failed for $display_name"
    fi
}
