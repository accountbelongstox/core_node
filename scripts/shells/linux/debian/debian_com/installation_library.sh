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

# Source required files
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

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
        "npm")
            # Check if npm package exists in registry
            log_install "Validating NPM package: $package_id"
            if npm info "$package_id" >/dev/null 2>&1; then
                log_success "NPM package $package_id exists"
                return 0
            else
                log_error "NPM package $package_id not found in registry"
                return 1
            fi
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
    if eval "$snap_install_cmd"; then
        log_success "Successfully installed $app_name via SNAP"
        return 0
    else
        # Check if error is due to confinement requirement and fallback is enabled
        local snap_error_output=$(eval "$snap_install_cmd" 2>&1 || true)
        if [[ "$snap_error_output" == *"classic"* ]] && [[ "$snap_error_output" == *"confinement"* ]]; then
            log_warning "Snap package requires classic confinement, retrying with --classic flag"
            if $USE_SUDO snap install "$package_id" --classic; then
                log_success "Successfully installed $app_name via SNAP with classic confinement"
                return 0
            fi
        fi
        log_error "Failed to install $app_name via SNAP"
        return 1
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
        if $USE_SUDO apt install -y flatpak; then
            log_success "flatpak installed successfully"
            # Add flathub repository
            $USE_SUDO flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo || log_warning "Failed to add flathub repository"
        else
            log_error "Failed to install flatpak"
            return 1
        fi
    fi

    # Install flatpak package
    if $USE_SUDO flatpak install -y flathub "$package_id"; then
        log_success "Successfully installed $app_name via FLATPAK"
        return 0
    else
        log_error "Failed to install $app_name via FLATPAK"
        return 1
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
install_via_npm() {
    local package_id="$1"
    local app_name="$2"

    log_install "Installing $app_name via NPM: $package_id"

    # Check if npm is installed
    if ! command_exists npm; then
        log_install "Installing Node.js and npm first..."
        $USE_SUDO apt update
        if $USE_SUDO apt install -y nodejs npm; then
            log_success "Node.js and npm installed successfully"
        else
            log_error "Failed to install Node.js and npm"
            return 1
        fi
    fi

    # Validate package exists before attempting installation
    if ! validate_package_exists "npm" "$package_id" "$app_name"; then
        log_error "Skipping $app_name - package not found in NPM registry"
        return 2
    fi

    # Install npm package globally with timeout and retry logic
    local max_retries=2
    local retry_count=0

    while [ $retry_count -lt $max_retries ]; do
        if timeout 300 $USE_SUDO npm install -g "$package_id"; then
            log_success "Successfully installed $app_name via NPM"
            return 0
        else
            ((retry_count++))
            if [ $retry_count -lt $max_retries ]; then
                log_warning "NPM installation failed, retry $retry_count/$max_retries..."
                sleep 2
            fi
        fi
    done

    log_error "Failed to install $app_name via NPM after $max_retries retries"
    return 1
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
    
    # Download and execute install script
    if curl -fsSL "$package_url" | $USE_SUDO bash; then
        log_success "Successfully installed $app_name via CURL"
        return 0
    else
        log_error "Failed to install $app_name via CURL"
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

    # Try method 1: Using apt-key add (older systems)
    if wget -qO- "$gpg_key_url" | $USE_SUDO apt-key add -; then
        log_success "Microsoft GPG key added successfully"
    else
        log_warning "apt-key method failed, trying keyring method..."

        # Try method 2: Using gpg with keyrings directory
        if wget -qO- "$gpg_key_url" | $USE_SUDO gpg --dearmor | $USE_SUDO tee "$gpg_key_file" > /dev/null; then
            log_success "Microsoft GPG key installed to keyring"

            # Create sources list entry with keyring reference
            log_install "Adding Microsoft repository with keyring..."
            if ! echo "deb [arch=amd64,arm64,armhf signed-by=$gpg_key_file] https://packages.microsoft.com/repos/code stable main" | $USE_SUDO tee /etc/apt/sources.list.d/vscode.list > /dev/null; then
                log_error "Failed to add Microsoft repository"
                return 1
            fi
        else
            log_error "Failed to install Microsoft GPG key using both methods"
            return 1
        fi
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

    case "$method" in
        "apt")
            install_via_apt "$package_id" "$app_name"
            ;;
        "snap")
            install_via_snap "$package_id" "$app_name"
            ;;
        "flatpak")
            install_via_flatpak "$package_id" "$app_name"
            ;;
        "web")
            install_via_web "$package_id" "$app_name"
            ;;
        "npm")
            install_via_npm "$package_id" "$app_name"
            ;;
        "pipx")
            install_via_pipx "$package_id" "$app_name"
            ;;
        "uv")
            install_via_uv "$package_id" "$app_name"
            ;;
        "uv_tool")
            install_via_uv_tool "$package_id" "$app_name"
            ;;
        "uvx")
            install_via_uvx "$package_id" "$app_name"
            ;;
        "curl")
            install_via_curl "$package_id" "$app_name"
            ;;
        "microsoft_apt")
            install_via_microsoft_apt "$package_id" "$app_name"
            ;;
        *)
            log_error "Unknown installation method: $method"
            return 1
            ;;
    esac
}

# Export functions for use by other scripts
export -f install_via_apt install_via_snap install_via_flatpak install_via_web
export -f install_via_npm install_via_pipx install_via_uv install_via_uv_tool
export -f install_via_uvx install_via_curl install_via_microsoft_apt universal_install
export -f log_install log_success log_error log_warning command_exists validate_package_exists
export -f is_snap_package is_command_from_snap force_cleanup_package needs_cleanup_before_install
