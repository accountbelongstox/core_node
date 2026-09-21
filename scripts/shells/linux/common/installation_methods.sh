#!/bin/bash

# Install via APT
install_via_apt() {
    local package_id="$1"
    local app_name="$2"

    log_install "Installing $app_name via APT: $package_id"

    # Check if not snap package first (cleanup if needed)
    if is_command_from_snap "$package_id"; then
        log_warning "Found $package_id installed via snap, cleaning up first..."
        force_cleanup_package "$package_id" "$app_name"
        sleep 2
    fi

    # Update package list
    log_install "Updating package lists..."
    if timeout 300 $USE_SUDO apt update; then
        log_success "Package lists updated successfully"
    else
        log_warning "Package update timed out or failed, continuing anyway"
    fi

    # Install package
    log_install "Installing package..."
    if timeout 600 $USE_SUDO apt install -y "$package_id"; then
        log_success "Successfully installed $app_name via APT"
        return 0
    else
        log_error "Failed to install $app_name via APT"
        return 1
    fi
}

# Install via SNAP
install_via_snap() {
    local package_id="$1"
    local app_name="$2"
    local snap_confinement="$3"  # Optional: strict or classic

    log_install "Installing $app_name via SNAP: $package_id"

    # Check if snapd is installed
    if ! command_exists snap; then
        log_install "Installing snapd first..."
        $USE_SUDO apt update
        if $USE_SUDO apt install -y snapd; then
            log_success "snapd installed successfully"
            # Enable snap services
            $USE_SUDO systemctl enable --now snapd.socket || log_warning "Failed to enable snapd.socket"
            $USE_SUDO ln -sf /var/lib/snapd/snap /snap 2>/dev/null || true
        else
            log_error "Failed to install snapd"
            return 1
        fi
    fi

    # Build snap install command with confinement if needed
    local snap_install_cmd="$USE_SUDO snap install \"$package_id\""

    # Add confinement flag if specified
    if [ -n "$snap_confinement" ] && [ "$snap_confinement" != "strict" ]; then
        snap_install_cmd="$snap_install_cmd --$snap_confinement"
        log_install "Installing with $snap_confinement confinement mode"
    fi

    # Install snap package
    if eval "$snap_install_cmd" 2>/dev/null; then
        log_success "Successfully installed $app_name via SNAP"
        return 0
    else
        # Capture error output for analysis
        local snap_error_output
        snap_error_output=$(eval "$snap_install_cmd" 2>&1 || true)

        # A previous (or concurrent) run may still be installing this snap;
        # snapd rejects the duplicate with "change in progress". Wait for that
        # in-flight change to finish instead of failing, then verify the result
        # from snap list (idempotent self-heal across overlapping runs).
        if [[ "$snap_error_output" == *"change in progress"* ]]; then
            local change_id=""
            change_id="$($USE_SUDO snap changes 2>/dev/null | awk -v pkg="\"$package_id\"" '$2 == "Doing" && index($0, pkg) {print $1; exit}')"
            if [ -n "$change_id" ]; then
                log_install "Waiting for in-progress snap change #$change_id ($package_id)..."
                timeout 1800 $USE_SUDO snap watch "$change_id" >/dev/null 2>&1 || true
            fi
            if $USE_SUDO snap list 2>/dev/null | grep -q "^$package_id "; then
                log_success "Successfully installed $app_name via SNAP (completed by in-progress change)"
                return 0
            fi
            log_warning "In-progress snap change for $package_id ended but the snap is not installed"
        fi

        # Check if error is due to confinement requirement
        if [[ "$snap_error_output" == *"classic"* ]] && [[ "$snap_error_output" == *"confinement"* ]]; then
            log_warning "Snap package requires classic confinement, retrying with --classic flag"
            if $USE_SUDO snap install "$package_id" --classic 2>/dev/null; then
                log_success "Successfully installed $app_name via SNAP with classic confinement"
                return 0
            else
                log_error "Failed to install $app_name via SNAP even with classic confinement"
                log_error "Error: $snap_error_output"
                return 1
            fi
        else
            log_error "Failed to install $app_name via SNAP"
            log_error "Error: $snap_error_output"
            return 1
        fi
    fi
}

# Install via FLATPAK
install_via_flatpak() {
    local package_id="$1"
    local app_name="$2"

    log_install "Installing $app_name via FLATPAK: $package_id"

    # Check if not snap package first (cleanup if needed)
    if is_command_from_snap "$package_id"; then
        log_warning "Found $package_id installed via snap, cleaning up first..."
        force_cleanup_package "$package_id" "$app_name"
        sleep 2
    fi

    # Check if flatpak is installed
    if ! command_exists flatpak; then
        log_install "Installing flatpak first..."
        $USE_SUDO apt update
        if ! $USE_SUDO env DEBIAN_FRONTEND=noninteractive apt install -y flatpak gnome-software-plugin-flatpak; then
            log_error "Failed to install flatpak"
            return 1
        fi
        log_success "flatpak installed successfully"
    fi

    # Ensure flathub repository is properly configured (system-wide)
    log_install "Configuring flathub repository (system-wide)..."

    # Remove existing flathub if it's corrupted
    $USE_SUDO flatpak remote-delete flathub 2>/dev/null || true

    # Add flathub repository system-wide
    if ! $USE_SUDO flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo; then
        log_warning "Failed to add flathub repository system-wide, trying direct method..."

        # Try alternative method with GPG key
        if ! $USE_SUDO flatpak remote-add --if-not-exists --gpg-import=https://flathub.org/repo/flathub.gpg flathub https://flathub.org/repo/flathub.flatpakrepo; then
            log_error "Failed to add flathub repository with all methods"
            return 1
        fi
    fi

    # Verify flathub repository is accessible
    if ! $USE_SUDO flatpak remote-ls flathub >/dev/null 2>&1; then
        log_warning "Flathub repository not accessible, refreshing..."
        $USE_SUDO flatpak update --appstream 2>/dev/null || true
        sleep 2

        # Try again
        if ! $USE_SUDO flatpak remote-ls flathub >/dev/null 2>&1; then
            log_error "Flathub repository still not accessible after refresh"
        fi
    fi

    log_success "Flathub repository configured successfully"

    # Try to install flatpak package (system-wide first)
    log_install "Installing $app_name from flathub (system-wide)..."
    if $USE_SUDO flatpak install -y flathub "$package_id"; then
        log_success "Successfully installed $app_name via FLATPAK (system-wide)"

        # Fix XDG_DATA_DIRS issue
        log_install "Updating XDG_DATA_DIRS environment..."
        local flatpak_exports="/var/lib/flatpak/exports/share"
        if [ -d "$flatpak_exports" ]; then
            # Add to /etc/environment
            if ! grep -q "$flatpak_exports" /etc/environment 2>/dev/null; then
                log_install "Adding $flatpak_exports to /etc/environment"
                if grep -q "XDG_DATA_DIRS=" /etc/environment 2>/dev/null; then
                    $USE_SUDO sed -i "s|XDG_DATA_DIRS=|XDG_DATA_DIRS=$flatpak_exports:|" /etc/environment
                else
                    echo "XDG_DATA_DIRS=$flatpak_exports:/usr/local/share:/usr/share" | $USE_SUDO tee -a /etc/environment > /dev/null
                fi
            fi
        fi

        # Fix permissions for flatpak installation
        log_install "Fixing permissions for flatpak installation"
        # Fix system flatpak directory
        if [ -d "/var/lib/flatpak/app/$package_id" ]; then
            fix_installation_permissions_from_common_functions "/var/lib/flatpak/app/$package_id" "777" "true" 2>&1 | while IFS= read -r line; do
                log_install "$line"
            done
        fi

        return 0
    else
        log_warning "Failed to install $app_name via FLATPAK (system), trying user mode..."

        # Configure flathub for user mode
        flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo 2>/dev/null || true

        # Try user mode installation
        if flatpak install --user -y flathub "$package_id"; then
            log_success "Successfully installed $app_name via FLATPAK (user mode)"

            # Fix XDG_DATA_DIRS for user installation
            local user_flatpak_exports="$HOME/.local/share/flatpak/exports/share"
            if [ -d "$user_flatpak_exports" ]; then
                log_install "Adding $user_flatpak_exports to XDG_DATA_DIRS"
                if ! grep -q "$user_flatpak_exports" ~/.profile 2>/dev/null; then
                    echo "export XDG_DATA_DIRS=\"$user_flatpak_exports:\$XDG_DATA_DIRS\"" >> ~/.profile
                fi
            fi

            return 0
        else
            log_error "Failed to install $app_name via FLATPAK (both system and user mode)"
            return 1
        fi
    fi
}

# Install via WEB (download .deb packages)
install_via_web() {
    local package_url="$1"
    local app_name="$2"

    log_install "Installing $app_name via WEB download: $package_url"

    # Extract executable name from app_name for snap cleanup
    local exec_name=$(echo "$app_name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]//g')

    # Check if not snap package first (cleanup if needed)
    if is_command_from_snap "$exec_name"; then
        log_warning "Found $exec_name installed via snap, cleaning up first..."
        force_cleanup_package "$exec_name" "$app_name"
        sleep 2
    fi

    # Create temporary directory
    local temp_dir="/tmp/${app_name}_install_$$"
    $USE_SUDO mkdir -p "$temp_dir"
    cd "$temp_dir"
    
    # Download the package
    local package_file="${app_name}.deb"
    if wget -O "$package_file" "$package_url"; then
        log_success "Downloaded $app_name package"
        
        # Install the .deb package
        if $USE_SUDO dpkg -i "$package_file"; then
            log_success "Successfully installed $app_name via WEB"
            # Fix any dependency issues
            $USE_SUDO apt-get install -f -y 2>/dev/null || true
            cd - && $USE_SUDO rm -rf "$temp_dir"
            return 0
        else
            log_warning "dpkg installation failed, trying to fix dependencies..."
            $USE_SUDO apt-get install -f -y
            if $USE_SUDO dpkg -i "$package_file"; then
                log_success "Successfully installed $app_name after fixing dependencies"
                cd - && $USE_SUDO rm -rf "$temp_dir"
                return 0
            else
                log_error "Failed to install $app_name .deb package"
                cd - && $USE_SUDO rm -rf "$temp_dir"
                return 1
            fi
        fi
    else
        log_error "Failed to download $app_name from $package_url"
        cd - && $USE_SUDO rm -rf "$temp_dir"
        return 1
    fi
}

# Install via NPM
# Install Node.js global packages via pnpm (project standard).
# Uses absolute PNPM_BIN from gvar_common (NODE_BIN_DIR/pnpm) so first-run installs
# work before PATH/env is refreshed. METHOD "npm" is a legacy alias for the same path.
install_via_npm() {
    local package_id="$1"
    local app_name="$2"
    local pnpm_bin=""
    local pnpm_run_path=""
    local package_basename=""
    local binary_path=""
    local max_retries=2
    local retry_count=0
    local helper_dir="$DEBIAN_COM_DIR"

    log_install "Installing $app_name via PNPM: $package_id"

    # Absolute path via /usr/local/bin link, gvar constant, and var center
    # (install-time shells may run with a minimal PATH).
    pnpm_bin="$(resolve_tool_bin pnpm 2>/dev/null || true)"
    if [ -z "$pnpm_bin" ]; then
        log_error "pnpm not found. Run 17_install_node_toolchain_26.sh first (installs pnpm next to node)."
        return 1
    fi
    log_install "Using pnpm absolute path: $pnpm_bin"

    if ! validate_package_exists "pnpm" "$package_id" "$app_name"; then
        log_error "Skipping $app_name - package validation failed"
        return 2
    fi

    # Idempotency: under no TTY, pnpm may abort module-dir purge; auto-confirm.
    export npm_config_confirm_modules_purge="${npm_config_confirm_modules_purge:-false}"

    # Ensure PNPM_GLOBAL_BIN_DIR is populated so it gets included in PATH
    if [ -z "${PNPM_GLOBAL_BIN_DIR:-}" ]; then
        if command -v get_var >/dev/null 2>&1; then
            PNPM_GLOBAL_BIN_DIR=$(get_var "PNPM_GLOBAL_BIN_DIR" 2>/dev/null)
        fi
        if [ -z "${PNPM_GLOBAL_BIN_DIR:-}" ] && [ -x "$pnpm_bin" ]; then
            PNPM_GLOBAL_BIN_DIR=$("$pnpm_bin" config get global-bin-dir 2>/dev/null)
        fi
    fi

    pnpm_run_path="${NODE_BIN_DIR:-$(dirname "$pnpm_bin")}:${PNPM_GLOBAL_BIN_DIR:-}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

    # Idempotent skip when already present globally or on PATH. NOTE: pnpm
    # exits 0 for `list -g <pkg>` even when the package is NOT installed (the
    # output is just empty), so the check must match the package name in the
    # output text, not the exit code.
    if env "PATH=$pnpm_run_path" "$pnpm_bin" list -g "$package_id" 2>/dev/null | grep -qF "$package_id"; then
        log_success "$app_name already installed globally via pnpm, skipping add -g"
        return 0
    fi
    package_basename=$(echo "$package_id" | sed 's|.*/||' | sed 's|@.*||')
    if [ -n "${PNPM_GLOBAL_BIN_DIR:-}" ] && [ -x "$PNPM_GLOBAL_BIN_DIR/$package_basename" ]; then
        log_success "$app_name binary already at $PNPM_GLOBAL_BIN_DIR/$package_basename, skipping"
        return 0
    fi
    if command_exists "$package_basename"; then
        log_success "$app_name already on PATH ($(command -v "$package_basename")), skipping"
        return 0
    fi

    bash "$helper_dir/npm_pre_install_checker.sh" "$package_id" "$app_name" 2>/dev/null || true

    while [ $retry_count -lt $max_retries ]; do
        if timeout 300 env "PATH=$pnpm_run_path" "npm_config_confirm_modules_purge=false" \
            "$pnpm_bin" add -g --config.confirm-modules-purge=false "$package_id"; then
            log_success "Successfully installed $app_name via PNPM"

            if [ -n "${PNPM_GLOBAL_BIN_DIR:-}" ] && [ -d "$PNPM_GLOBAL_BIN_DIR" ]; then
                $USE_SUDO find "$PNPM_GLOBAL_BIN_DIR" -type f -exec chmod +x {} \; 2>/dev/null || true
                binary_path="$PNPM_GLOBAL_BIN_DIR/$package_basename"
                if [ -f "$binary_path" ]; then
                    $USE_SUDO chmod +x "$binary_path" 2>/dev/null || true
                    log_success "Executable ready: $binary_path"
                fi
            fi
            return 0
        fi

        log_error "PNPM installation failed on attempt $((retry_count + 1))/$max_retries"
        if [ $retry_count -eq 0 ]; then
            bash "$helper_dir/npm_cleanup_helper.sh" "$package_id" "$app_name" 2>/dev/null || true
            sleep 2
        fi
        retry_count=$((retry_count + 1))
        if [ $retry_count -lt $max_retries ]; then
            log_warning "Retrying pnpm installation..."
        fi
    done

    log_error "Failed to install $app_name via PNPM after $max_retries retries"
    return 1
}

# Alias: explicit pnpm method name (same implementation as install_via_npm).
install_via_pnpm() {
    install_via_npm "$@"
}

# Install via PIPX
install_via_pipx() {
    local package_id="$1"
    local app_name="$2"
    
    log_install "Installing $app_name via PIPX: $package_id"
    
    # Check if pipx is installed
    if ! command_exists pipx; then
        log_install "Installing pipx first..."
        $USE_SUDO apt update
        if $USE_SUDO apt install -y python3-pip; then
            $USE_SUDO pip3 install pipx
            $USE_SUDO pipx ensurepath
            log_success "pipx installed successfully"
        else
            log_error "Failed to install pipx"
            return 1
        fi
    fi
    
    # Install pipx package
    if $USE_SUDO pipx install "$package_id"; then
        log_success "Successfully installed $app_name via PIPX"
        return 0
    else
        log_error "Failed to install $app_name via PIPX"
        return 1
    fi
}

# Install via UV
install_via_uv() {
    local package_id="$1"
    local app_name="$2"
    
    log_install "Installing $app_name via UV: $package_id"
    
    # Check if uv is installed
    if ! command_exists uv; then
        log_install "Installing uv first..."
        if curl -LsSf https://astral.sh/uv/install.sh | sh; then
            source ~/.bashrc
            log_success "uv installed successfully"
        else
            log_error "Failed to install uv"
            return 1
        fi
    fi
    
    # Install uv package
    if $USE_SUDO uv add "$package_id"; then
        log_success "Successfully installed $app_name via UV"
        return 0
    else
        log_error "Failed to install $app_name via UV"
        return 1
    fi
}

# Install via UV TOOL
install_via_uv_tool() {
    local package_id="$1"
    local app_name="$2"

    log_install "Installing $app_name via UV TOOL: $package_id"

    # Install uv tools into shared, world-readable locations. The default
    # (~/.local/share/uv + ~/.local/bin) is root-only when the installer runs
    # as root, leaving the tool unusable for regular users.
    local uv_tool_dir="/usr/local/uv-tools"
    local uv_tool_bin_dir="/usr/local/bin"

    # Check if uv is installed
    if ! command_exists uv; then
        log_install "Installing uv first..."
        if curl -LsSf https://astral.sh/uv/install.sh | sh; then
            source ~/.bashrc
            log_success "uv installed successfully"
        else
            log_error "Failed to install uv"
            return 1
        fi
    fi

    # Heal: drop any copy previously installed under the invoking user's home
    # (e.g. /root/.local/share/uv/tools) so the reinstall lands in the shared
    # tool directory instead of shadowing it. uv normalizes tool names, so
    # uninstall unconditionally (no-op when absent).
    if [ -d "$HOME/.local/share/uv/tools" ]; then
        $USE_SUDO uv tool uninstall "$package_id" 2>/dev/null || true
    fi

    # --force overwrites stale executables/symlinks in the shared bin dir.
    if $USE_SUDO env UV_TOOL_DIR="$uv_tool_dir" UV_TOOL_BIN_DIR="$uv_tool_bin_dir" uv tool install --force "$package_id"; then
        log_success "Successfully installed $app_name via UV TOOL"
        return 0
    else
        log_error "Failed to install $app_name via UV TOOL"
        return 1
    fi
}

# Install via UVX
install_via_uvx() {
    local package_id="$1"
    local app_name="$2"
    
    log_install "Installing $app_name via UVX: $package_id"
    
    # Check if uvx is installed (usually comes with uv)
    if ! command_exists uvx; then
        log_install "Installing uv (includes uvx) first..."
        if curl -LsSf https://astral.sh/uv/install.sh | sh; then
            source ~/.bashrc
            log_success "uv/uvx installed successfully"
        else
            log_error "Failed to install uv/uvx"
            return 1
        fi
    fi
    
    # Install uvx package
    if uvx "$package_id"; then
        log_success "Successfully installed $app_name via UVX"
        return 0
    else
        log_error "Failed to install $app_name via UVX"
        return 1
    fi
}

# Install via CURL
install_via_curl() {
    local package_url="$1"
    local app_name="$2"

    log_install "Installing $app_name via CURL: $package_url"

    # Extract executable name from app_name for snap cleanup
    local exec_name=$(echo "$app_name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]//g')

    # Check if not snap package first (cleanup if needed)
    if is_command_from_snap "$exec_name"; then
        log_warning "Found $exec_name installed via snap, cleaning up first..."
        force_cleanup_package "$exec_name" "$app_name"
        sleep 2
    fi

    # Check if curl is installed
    if ! command_exists curl; then
        log_install "Installing curl first..."
        $USE_SUDO apt update
        if $USE_SUDO apt install -y curl; then
            log_success "curl installed successfully"
        else
            log_error "Failed to install curl"
            return 1
        fi
    fi

    # Save current PATH
    local original_path="$PATH"

    # Use clean PATH with only essential system directories
    # This avoids issues with circular symlinks in custom bin directories
    local clean_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

    log_install "Executing installation script with clean PATH..."
    log_install "Download URL: $package_url"

    # Download and execute install script with clean environment
    if PATH="$clean_path" curl -fsSL "$package_url" | PATH="$clean_path" $USE_SUDO bash; then
        log_success "Successfully installed $app_name via CURL"
        # Restore original PATH
        export PATH="$original_path"
        return 0
    else
        log_error "Failed to install $app_name via CURL"
        log_error "This may be due to network issues or package unavailability"
        # Restore original PATH
        export PATH="$original_path"
        return 1
    fi
}

# Install via Microsoft APT repository
install_via_microsoft_apt() {
    local package_id="$1"
    local app_name="$2"

    log_install "Installing $app_name via Microsoft APT repository"

    # Check if not snap package first (cleanup if needed)
    if is_command_from_snap "$package_id"; then
        log_warning "Found $package_id installed via snap, cleaning up first..."
        force_cleanup_package "$package_id" "$app_name"
        sleep 2
    fi

    # Install required dependencies
    log_install "Installing required dependencies..."
    $USE_SUDO apt update
    $USE_SUDO apt install -y software-properties-common apt-transport-https wget curl gnupg

    # Add Microsoft GPG key with fallback options
    log_install "Adding Microsoft GPG key..."
    local gpg_key_url="https://packages.microsoft.com/keys/microsoft.asc"
    local gpg_key_file="/etc/apt/keyrings/packages.microsoft.gpg"

    # Install the Microsoft (third-party) key into its OWN dedicated keyring file and
    # reference it via signed-by= -- NEVER apt-key (deprecated; trusts the key globally and
    # touches the system keyring). gpg --dearmor --yes is idempotent.
    $USE_SUDO mkdir -p /etc/apt/keyrings 2>/dev/null || true
    if wget -qO- "$gpg_key_url" | $USE_SUDO gpg --dearmor --yes -o "$gpg_key_file" 2>/dev/null; then
        log_success "Microsoft GPG key installed to $gpg_key_file"

        # Create sources list entry with keyring reference (signed-by)
        log_install "Adding Microsoft repository with keyring..."
        if ! echo "deb [arch=amd64,arm64,armhf signed-by=$gpg_key_file] https://packages.microsoft.com/repos/code stable main" | $USE_SUDO tee /etc/apt/sources.list.d/vscode.list > /dev/null; then
            log_error "Failed to add Microsoft repository"
            return 1
        fi
    else
        log_error "Failed to install Microsoft GPG key"
        return 1
    fi

    # Update package list
    log_install "Updating package list..."
    if ! $USE_SUDO apt update 2>&1; then
        log_warning "apt update had issues, but continuing with installation attempt"
    fi

    # Install the package
    log_install "Installing $package_id..."
    if $USE_SUDO apt install -y "$package_id"; then
        log_success "$app_name installed successfully via Microsoft APT"
        return 0
    else
        log_error "Failed to install $app_name via Microsoft APT"
        return 1
    fi
}


# Install via a third-party APT repository (Debian-native, replaces snap).
# spec format: key_url|keyring_name|repo_line|list_name|pin_origin(optional)
# The keyring is stored under /etc/apt/keyrings and referenced with signed-by=;
# apt-key is never used. All steps are idempotent: existing keyrings, list files
# and pin files are only rewritten when their content differs.
install_via_deb_repo() {
    local package_id="$1"
    local app_name="$2"
    local spec="$3"
    local key_url=""
    local keyring_name=""
    local repo_line=""
    local list_name=""
    local pin_origin=""
    local keyring_path=""
    local list_path=""
    local pin_path=""
    local needs_update=false

    log_install "Installing $app_name via APT repository: $package_id"

    key_url="$(printf '%s' "$spec" | cut -d'|' -f1)"
    keyring_name="$(printf '%s' "$spec" | cut -d'|' -f2)"
    repo_line="$(printf '%s' "$spec" | cut -d'|' -f3)"
    list_name="$(printf '%s' "$spec" | cut -d'|' -f4)"
    pin_origin="$(printf '%s' "$spec" | cut -d'|' -f5)"

    if [ -z "$key_url" ] || [ -z "$keyring_name" ] || [ -z "$repo_line" ] || [ -z "$list_name" ]; then
        log_error "Invalid deb_repo spec for $app_name: $spec"
        return 1
    fi

    keyring_path="/etc/apt/keyrings/$keyring_name"
    list_path="/etc/apt/sources.list.d/$list_name"

    $USE_SUDO mkdir -p /etc/apt/keyrings 2>/dev/null || true

    # Install/refresh the repository signing key.
    if [ ! -s "$keyring_path" ]; then
        log_install "Adding repository key: $key_url"
        local key_tmp=""
        key_tmp="$(mktemp /tmp/deb_repo_key.XXXXXX)"
        if ! curl -fsSL "$key_url" -o "$key_tmp"; then
            log_error "Failed to download repository key for $app_name"
            rm -f "$key_tmp"
            return 1
        fi

        case "$key_url" in
            *.deb)
                # Some vendors (e.g. Microsoft) only ship the repo keyring inside
                # a config .deb -- extract the first keyring from it.
                local deb_extract_dir=""
                local extracted_key=""
                deb_extract_dir="$(mktemp -d /tmp/deb_repo_key_x.XXXXXX)"
                if dpkg-deb -x "$key_tmp" "$deb_extract_dir" 2>/dev/null; then
                    extracted_key="$(find "$deb_extract_dir" -name '*.gpg' -type f 2>/dev/null | head -1)"
                fi
                if [ -n "$extracted_key" ]; then
                    $USE_SUDO cp "$extracted_key" "$keyring_path"
                    log_success "Repository key extracted from config deb: $keyring_path"
                    needs_update=true
                else
                    log_error "No keyring found inside config deb for $app_name"
                    rm -rf "$key_tmp" "$deb_extract_dir"
                    return 1
                fi
                rm -rf "$key_tmp" "$deb_extract_dir"
                ;;
            *)
                # ASCII-armored keys need dearmoring; binary keyrings are copied as-is.
                if head -c 40 "$key_tmp" | grep -q "BEGIN PGP"; then
                    if $USE_SUDO gpg --dearmor --yes -o "$keyring_path" "$key_tmp" 2>/dev/null; then
                        log_success "Repository key installed: $keyring_path"
                        needs_update=true
                    else
                        log_error "Failed to dearmor repository key for $app_name"
                        rm -f "$key_tmp"
                        return 1
                    fi
                else
                    $USE_SUDO cp "$key_tmp" "$keyring_path"
                    log_success "Repository key installed: $keyring_path"
                    needs_update=true
                fi
                rm -f "$key_tmp"
                ;;
        esac
    fi

    # Write the sources list entry when missing or changed
    if [ ! -f "$list_path" ] || ! grep -qF "$repo_line" "$list_path" 2>/dev/null; then
        log_install "Writing repository entry: $list_path"
        echo "$repo_line" | $USE_SUDO tee "$list_path" > /dev/null || return 1
        needs_update=true
    fi

    # Optional apt pin (e.g. Mozilla packages must outrank the firefox-esr transition)
    if [ -n "$pin_origin" ]; then
        pin_path="/etc/apt/preferences.d/${list_name%.list}"
        local pin_content="Package: *
Pin: origin $pin_origin
Pin-Priority: 1000"
        if [ ! -f "$pin_path" ] || ! grep -qF "$pin_origin" "$pin_path" 2>/dev/null; then
            log_install "Writing apt pin: $pin_path (origin $pin_origin)"
            printf '%s\n' "$pin_content" | $USE_SUDO tee "$pin_path" > /dev/null || return 1
            needs_update=true
        fi
    fi

    if [ "$needs_update" = true ]; then
        log_install "Updating package lists..."
        timeout 300 $USE_SUDO apt update || log_warning "apt update had issues, continuing anyway"
    fi

    log_install "Installing package: $package_id"
    if timeout 600 $USE_SUDO env DEBIAN_FRONTEND=noninteractive apt install -y "$package_id"; then
        log_success "$app_name installed successfully via APT repository"
        return 0
    else
        log_error "Failed to install $app_name via APT repository"
        return 1
    fi
}

# Install via an official tarball archive (Debian-native, replaces snap).
# package_id is the tarball URL; spec format: dest_dir|exec_relpath
# The archive must contain a single top-level directory, which is stripped.
# Idempotent: an existing dest_dir/exec_relpath binary skips the download.
install_via_tarball() {
    local package_url="$1"
    local app_name="$2"
    local spec="$3"
    local exec_name="$4"
    local dest_dir=""
    local exec_relpath=""
    local archive_path=""
    local binary_path=""

    log_install "Installing $app_name via TARBALL: $package_url"

    dest_dir="$(printf '%s' "$spec" | cut -d'|' -f1)"
    exec_relpath="$(printf '%s' "$spec" | cut -d'|' -f2)"

    if [ -z "$dest_dir" ] || [ -z "$exec_relpath" ]; then
        log_error "Invalid tarball spec for $app_name: $spec"
        return 1
    fi

    binary_path="$dest_dir/$exec_relpath"

    if [ ! -x "$binary_path" ]; then
        archive_path="/var/tmp/$(basename "$package_url").$$.tar.gz"
        log_install "Downloading tarball to: $archive_path"
        if ! wget -c -O "$archive_path" "$package_url"; then
            log_error "Failed to download $app_name tarball"
            rm -f "$archive_path"
            return 1
        fi

        $USE_SUDO rm -rf "$dest_dir"
        $USE_SUDO mkdir -p "$dest_dir"
        log_install "Extracting tarball to: $dest_dir"
        if ! $USE_SUDO tar -xzf "$archive_path" -C "$dest_dir" --strip-components=1; then
            log_error "Failed to extract $app_name tarball"
            rm -f "$archive_path"
            return 1
        fi
        rm -f "$archive_path"
    fi

    if [ ! -x "$binary_path" ]; then
        log_error "Binary not found after extraction: $binary_path"
        return 1
    fi

    if [ -n "$exec_name" ]; then
        $USE_SUDO ln -sf "$binary_path" "/usr/local/bin/$exec_name"
        log_success "Linked /usr/local/bin/$exec_name -> $binary_path"
    fi

    log_success "$app_name installed successfully via TARBALL"
    return 0
}

# Install via the official .deb asset of the latest GitHub release.
# spec format: owner/repo|asset_regex
install_via_github_deb() {
    local package_id="$1"
    local app_name="$2"
    local spec="$3"
    local repo=""
    local asset_regex=""
    local deb_url=""

    log_install "Installing $app_name via GitHub release .deb: $package_id"

    repo="$(printf '%s' "$spec" | cut -d'|' -f1)"
    asset_regex="$(printf '%s' "$spec" | cut -d'|' -f2)"

    if [ -z "$repo" ] || [ -z "$asset_regex" ]; then
        log_error "Invalid github_deb spec for $app_name: $spec"
        return 1
    fi

    log_install "Resolving latest release asset from: $repo"
    deb_url="$(curl -fsSL --connect-timeout 15 --max-time 60 \
        "https://api.github.com/repos/$repo/releases/latest" \
        | grep -o '"browser_download_url": *"[^"]*"' \
        | cut -d'"' -f4 \
        | grep -E "$asset_regex" \
        | head -1)"

    if [ -z "$deb_url" ]; then
        log_error "No .deb asset matching '$asset_regex' in latest $repo release"
        return 1
    fi

    log_install "Resolved .deb: $deb_url"
    install_via_web "$deb_url" "$app_name"
}
