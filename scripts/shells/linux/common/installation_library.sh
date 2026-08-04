#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Do not modify these rules
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Installation Library for Debian-based Systems
# Supports multiple installation methods: apt, snap, flatpak, web, npm, pipx, uv, uvx, curl

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script identification
SCRIPT_INDEX="[INSTALL_LIB]"

# Source required files - use dynamic relative path
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEBIAN_COM_DIR="$(dirname "$SCRIPT_CURRENT_DIR")/debian/debian_com"
source "$SCRIPT_CURRENT_DIR/gvar_common.sh"

# Self-healing: remove git merge conflict markers from apt sources.
# Synced files may contain unresolved <<<<<<< / ======= / >>>>>>> markers
# which cause apt to fail with "Type '<<<<<<<' is not known".
_sanitize_apt_sources() {
    local fixed=0
    for f in /etc/apt/sources.list /etc/apt/sources.list.d/*; do
        [ -f "$f" ] || continue
        if grep -qE '^(<<<<<<<|=======|>>>>>>>)' "$f" 2>/dev/null; then
            sed -i '/^<<<<<<< /d; /^=======/d; /^>>>>>>> /d' "$f" 2>/dev/null && fixed=1
        fi
    done
    [ "$fixed" -eq 1 ] && echo "[SELF-HEAL] Removed git conflict markers from apt sources"
}
_sanitize_apt_sources

# Logging function
log_install() {
    local message="$1"
    echo -e "${BLUE}$SCRIPT_INDEX $message${NC}"
}

log_success() {
    local message="$1"
    echo -e "${GREEN}$SCRIPT_INDEX $message${NC}"
}

log_error() {
    local message="$1"
    echo -e "${RED}$SCRIPT_INDEX $message${NC}"
}

log_warning() {
    local message="$1"
    echo -e "${YELLOW}$SCRIPT_INDEX $message${NC}"
}

# Validate package existence before installation
validate_package_exists() {
    local method="$1"
    local package_id="$2"
    local app_name="$3"

    case "$method" in
        "npm"|"pnpm")
            # Registry check via npm info when available; skip hard-fail if offline.
            log_install "Validating registry package: $package_id"
            local npm_info_bin=""
            if [ -n "${NPM_BIN:-}" ] && [ -x "$NPM_BIN" ]; then
                npm_info_bin="$NPM_BIN"
            elif command -v npm >/dev/null 2>&1; then
                npm_info_bin="$(command -v npm)"
            fi
            if [ -n "$npm_info_bin" ] && "$npm_info_bin" info "$package_id" >/dev/null 2>&1; then
                log_success "Package $package_id exists in registry"
                return 0
            fi
            # Soft-pass: install step will fail loudly if the package is truly missing.
            log_warning "Could not validate $package_id via npm info; proceeding with pnpm install"
            return 0
            ;;
        "apt")
            # Check if apt package exists
            log_install "Validating APT package: $package_id"
            if apt-cache search "^$package_id\$" | grep -q "$package_id"; then
                log_success "APT package $package_id exists"
                return 0
            else
                log_error "APT package $package_id not found"
                return 1
            fi
            ;;
        "snap")
            # Check if snap package exists
            log_install "Validating Snap package: $package_id"
            if snap info "$package_id" >/dev/null 2>&1; then
                log_success "Snap package $package_id exists"
                return 0
            else
                log_error "Snap package $package_id not found in snap store"
                return 1
            fi
            ;;
        *)
            # For other methods, we can't easily validate before installation
            log_warning "Skipping validation for method: $method"
            return 0
            ;;
    esac
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if a command is installed via snap
is_snap_package() {
    local exec_name="$1"
    if command_exists snap; then
        $USE_SUDO snap list 2>/dev/null | grep -q "^$exec_name "
        return $?
    fi
    return 1
}

# Check if a command is from snap (by checking the path)
is_command_from_snap() {
    local exec_name="$1"
    if command_exists "$exec_name"; then
        local cmd_path=$(which "$exec_name" 2>/dev/null)
        [[ "$cmd_path" == /snap/* ]]
        return $?
    fi
    return 1
}

# Force cleanup of a package from all package managers
force_cleanup_package() {
    local exec_name="$1"
    local app_name="$2"

    log_warning "Starting force cleanup for $app_name ($exec_name)"

    # Remove binary symlinks from /usr/local/bin
    if [ -L "/usr/local/bin/$exec_name" ]; then
        log_install "Removing symlink: /usr/local/bin/$exec_name"
        $USE_SUDO rm -f "/usr/local/bin/$exec_name"
    fi

    # Try to remove from snap
    if command_exists snap; then
        if $USE_SUDO snap list 2>/dev/null | grep -q "^$exec_name "; then
            log_install "Removing $exec_name from snap..."
            $USE_SUDO snap remove "$exec_name" 2>/dev/null || log_warning "Failed to remove $exec_name from snap"
        fi

        # Also try common snap package names
        local snap_variants=("${exec_name}-editor" "${exec_name}-community" "${exec_name}-stable")
        for variant in "${snap_variants[@]}"; do
            if $USE_SUDO snap list 2>/dev/null | grep -q "^$variant "; then
                log_install "Removing $variant from snap..."
                $USE_SUDO snap remove "$variant" 2>/dev/null || log_warning "Failed to remove $variant from snap"
            fi
        done
    fi

    # Try to remove from apt
    if command_exists apt; then
        # Check if package is installed via apt
        if $USE_SUDO dpkg -l | grep -q "^ii.*$exec_name"; then
            log_install "Removing $exec_name from apt..."
            $USE_SUDO apt remove -y "$exec_name" 2>/dev/null || log_warning "Failed to remove $exec_name from apt"
        fi

        # Also try common apt package names
        local apt_variants=("${exec_name}-stable" "${exec_name}-community" "${exec_name}-editor")
        for variant in "${apt_variants[@]}"; do
            if $USE_SUDO dpkg -l | grep -q "^ii.*$variant"; then
                log_install "Removing $variant from apt..."
                $USE_SUDO apt remove -y "$variant" 2>/dev/null || log_warning "Failed to remove $variant from apt"
            fi
        done
    fi

    # Try to remove from flatpak
    if command_exists flatpak; then
        if $USE_SUDO flatpak list 2>/dev/null | grep -q "$exec_name"; then
            log_install "Removing $exec_name from flatpak..."
            $USE_SUDO flatpak uninstall -y "$exec_name" 2>/dev/null || log_warning "Failed to remove $exec_name from flatpak"
        fi
    fi

    # Clean up any remaining binaries in common locations
    local cleanup_paths=(
        "/usr/bin/$exec_name"
        "/usr/local/bin/$exec_name"
        "/opt/$exec_name"
        "/snap/bin/$exec_name"
    )

    for path in "${cleanup_paths[@]}"; do
        if [ -f "$path" ] || [ -L "$path" ]; then
            log_install "Removing binary: $path"
            $USE_SUDO rm -f "$path" 2>/dev/null || log_warning "Failed to remove $path"
        fi
    done

    log_success "Force cleanup completed for $app_name"
}

# Check if cleanup is needed before installation
needs_cleanup_before_install() {
    local exec_name="$1"
    local target_method="$2"

    # Only check for web and apt installations
    if [ "$target_method" != "web" ] && [ "$target_method" != "apt" ]; then
        return 1
    fi

    # Check if command exists and is from snap
    if command_exists "$exec_name" && is_command_from_snap "$exec_name"; then
        log_warning "Found $exec_name installed via snap, but target method is $target_method"
        return 0
    fi

    return 1
}

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
        if ! $USE_SUDO DEBIAN_FRONTEND=noninteractive apt install -y flatpak gnome-software-plugin-flatpak; then
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

    # Prefer gvar absolute path (set by 16_install_node_24.sh / gvar_common.sh).
    if [ -n "${PNPM_BIN:-}" ] && [ -x "$PNPM_BIN" ]; then
        pnpm_bin="$PNPM_BIN"
    elif [ -n "${NODE_BIN_DIR:-}" ] && [ -x "$NODE_BIN_DIR/pnpm" ]; then
        pnpm_bin="$NODE_BIN_DIR/pnpm"
    elif command -v pnpm >/dev/null 2>&1; then
        pnpm_bin="$(command -v pnpm)"
    else
        log_error "pnpm not found. Run 16_install_node_24.sh first (installs pnpm next to node)."
        return 1
    fi
    log_install "Using pnpm absolute path: $pnpm_bin"

    if ! validate_package_exists "pnpm" "$package_id" "$app_name"; then
        log_error "Skipping $app_name - package validation failed"
        return 2
    fi

    # Idempotency: under no TTY, pnpm may abort module-dir purge; auto-confirm.
    export npm_config_confirm_modules_purge="${npm_config_confirm_modules_purge:-false}"

    pnpm_run_path="${NODE_BIN_DIR:-$(dirname "$pnpm_bin")}:${PNPM_GLOBAL_BIN_DIR:-}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

    # Idempotent skip when already present globally or on PATH.
    if env "PATH=$pnpm_run_path" "$pnpm_bin" list -g "$package_id" >/dev/null 2>&1; then
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
    
    # Install uv tool
    if $USE_SUDO uv tool install "$package_id"; then
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

# Universal installation function with cleanup support
universal_install() {
    local method="$1"
    local package_id="$2"
    local app_name="$3"
    local exec_name="$4"  # Optional executable name for cleanup

    log_install "Universal install: $app_name using method $method"

    # Perform cleanup if needed (for web and apt installations)
    if [ -n "$exec_name" ] && needs_cleanup_before_install "$exec_name" "$method"; then
        log_warning "Cleanup needed before installing $app_name"
        force_cleanup_package "$exec_name" "$app_name"

        # Wait a moment for cleanup to complete
        sleep 2
    fi

    local install_result=0

    case "$method" in
        "apt")
            install_via_apt "$package_id" "$app_name"
            install_result=$?
            ;;
        "snap")
            install_via_snap "$package_id" "$app_name"
            install_result=$?
            ;;
        "flatpak")
            install_via_flatpak "$package_id" "$app_name"
            install_result=$?
            ;;
        "web")
            install_via_web "$package_id" "$app_name"
            install_result=$?
            ;;
        "npm"|"pnpm")
            install_via_pnpm "$package_id" "$app_name"
            install_result=$?
            if [ $install_result -eq 0 ]; then
                log_install "Fixing pnpm global bin permissions after installation"
                if [ -n "${PNPM_GLOBAL_BIN_DIR:-}" ] && [ -d "$PNPM_GLOBAL_BIN_DIR" ]; then
                    $USE_SUDO find "$PNPM_GLOBAL_BIN_DIR" -type f -exec chmod +x {} \; 2>/dev/null || true
                fi
            fi
            ;;
        "pipx")
            install_via_pipx "$package_id" "$app_name"
            install_result=$?
            ;;
        "uv")
            install_via_uv "$package_id" "$app_name"
            install_result=$?
            ;;
        "uv_tool")
            install_via_uv_tool "$package_id" "$app_name"
            install_result=$?
            ;;
        "uvx")
            install_via_uvx "$package_id" "$app_name"
            install_result=$?
            ;;
        "curl")
            install_via_curl "$package_id" "$app_name"
            install_result=$?
            ;;
        "microsoft_apt")
            install_via_microsoft_apt "$package_id" "$app_name"
            install_result=$?
            ;;
        *)
            log_error "Unknown installation method: $method"
            return 1
            ;;
    esac

    # Fix permissions and create symlinks for installed application if successful
    if [ $install_result -eq 0 ]; then
        local exec_path=""
        local needs_symlink=false

        # Check if command is available in PATH
        if [ -n "$exec_name" ] && command -v "$exec_name" >/dev/null 2>&1; then
            exec_path=$(command -v "$exec_name" 2>/dev/null)
        else
            # Command not in PATH, search common installation locations
            needs_symlink=true
            log_install "Executable $exec_name not found in PATH, searching common locations..."

            local search_paths=(
                "$HOME/.local/bin/$exec_name"
                "$HOME/bin/$exec_name"
                "$HOME/.$exec_name/bin/$exec_name"
                "$HOME/.config/$exec_name/bin/$exec_name"
                "/opt/$exec_name/bin/$exec_name"
                "/opt/$exec_name/$exec_name"
                # snap apps (e.g. beekeeper-studio -> /snap/bin/...), flatpak exports,
                # and standard system bins, so snap/apt/web installs are found too.
                "/snap/bin/$exec_name"
                "/var/lib/flatpak/exports/bin/$exec_name"
                "/usr/local/bin/$exec_name"
                "/usr/bin/$exec_name"
                "/bin/$exec_name"
            )

            # npm-installed global CLIs land in `npm prefix`/bin, which is often NOT
            # on PATH (e.g. /opt/_<os>/node/<ver>/bin), so a tool like auggie would be
            # "not found" even after a successful install. Add that dir to the search.
            if command -v npm >/dev/null 2>&1; then
                local npm_prefix_bin
                npm_prefix_bin="$(npm config get prefix 2>/dev/null)/bin"
                [ -d "$npm_prefix_bin" ] && search_paths+=("$npm_prefix_bin/$exec_name")
            fi

            # Also search for lowercase version if exec_name has uppercase
            local exec_lower=$(echo "$exec_name" | tr '[:upper:]' '[:lower:]')
            if [ "$exec_name" != "$exec_lower" ]; then
                search_paths+=(
                    "$HOME/.$exec_lower/bin/$exec_name"
                    "$HOME/.config/$exec_lower/bin/$exec_name"
                )
            fi

            for search_path in "${search_paths[@]}"; do
                if [ -x "$search_path" ]; then
                    exec_path="$search_path"
                    log_install "Found executable at: $exec_path"
                    break
                fi
            done
        fi

        # Process found executable
        if [ -n "$exec_path" ] && [ -f "$exec_path" ]; then
            # Fix permissions for the executable
            log_install "Fixing permissions for: $exec_path"
            fix_installation_permissions_from_common_functions "$exec_path" "777" "true" 2>&1 | while IFS= read -r line; do
                log_install "$line"
            done

            # If it's a symlink, also fix the target
            if [ -L "$exec_path" ]; then
                local target_path=$(readlink -f "$exec_path" 2>/dev/null)
                if [ -n "$target_path" ] && [ -e "$target_path" ]; then
                    local target_dir=$(dirname "$target_path")
                    log_install "Fixing permissions for target directory: $target_dir"
                    fix_installation_permissions_from_common_functions "$target_dir" "777" "true" 2>&1 | while IFS= read -r line; do
                        log_install "$line"
                    done
                fi
            fi

            # Create symlink to /usr/local/bin if needed
            if [ "$needs_symlink" = true ]; then
                local symlink_path="/usr/local/bin/$exec_name"

                # Remove old symlink if it points to wrong location
                if [ -L "$symlink_path" ]; then
                    local current_target=$(readlink "$symlink_path" 2>/dev/null)
                    if [ "$current_target" != "$exec_path" ]; then
                        log_install "Updating symlink to point to new location"
                        $USE_SUDO rm -f "$symlink_path"
                    fi
                fi

                # Create symlink if it doesn't exist
                if [ ! -e "$symlink_path" ]; then
                    log_install "Creating symlink: $symlink_path -> $exec_path"
                    if $USE_SUDO ln -sf "$exec_path" "$symlink_path"; then
                        log_success "Symlink created successfully"
                        # Verify it works
                        if command -v "$exec_name" >/dev/null 2>&1; then
                            log_success "$exec_name is now available in PATH"
                        fi
                    else
                        log_warning "Failed to create symlink to /usr/local/bin"
                    fi
                else
                    log_install "Symlink already exists: $symlink_path"
                fi
            fi
        elif [ "$needs_symlink" = true ]; then
            log_warning "Could not find $exec_name in common installation locations"
            log_warning "You may need to manually add it to PATH or create a symlink"
        fi

        log_success "Installation completed successfully: $app_name"
    fi

    return $install_result
}

# Export functions for use by other scripts
export -f install_via_apt install_via_snap install_via_flatpak install_via_web
export -f install_via_npm install_via_pnpm install_via_pipx install_via_uv install_via_uv_tool
export -f install_via_uvx install_via_curl install_via_microsoft_apt universal_install
export -f log_install log_success log_error log_warning command_exists validate_package_exists
export -f is_snap_package is_command_from_snap force_cleanup_package needs_cleanup_before_install
