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

source "$SCRIPT_CURRENT_DIR/installation_methods.sh"


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
