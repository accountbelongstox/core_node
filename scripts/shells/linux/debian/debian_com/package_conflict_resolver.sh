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

# Package Conflict Resolver
# Universal script to detect and resolve package conflicts
# Usage: package_conflict_resolver.sh <package_id> <exec_name> <install_method>

SCRIPT_INDEX="[PKG_CONFLICT]"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALLATION_LIBRARY_PATH="$(dirname "$(dirname "$SCRIPT_CURRENT_DIR")")/common/installation_library.sh"

# Source required libraries
source "$INSTALLATION_LIBRARY_PATH"

# Check required parameters
if [ -z "$1" ] || [ -z "$2" ]; then
    log_error "Usage: $0 <package_id> <exec_name> [install_method]"
    exit 1
fi

PACKAGE_ID="$1"
EXEC_NAME="$2"
INSTALL_METHOD="${3:-npm}"

# Detect if command is installed via different package manager
detect_conflict() {
    if ! command_exists "$EXEC_NAME"; then
        log_install "No existing installation found for: $EXEC_NAME"
        return 0
    fi

    local cmd_path=$(which "$EXEC_NAME" 2>/dev/null)
    log_install "Found existing installation: $cmd_path"

    local conflict_detected=false
    local conflict_source=""

    # Check if installed via snap
    if [[ "$cmd_path" == /snap/* ]] && [ "$INSTALL_METHOD" != "snap" ]; then
        log_warning "Detected snap installation, but target method is: $INSTALL_METHOD"
        conflict_detected=true
        conflict_source="snap"
        CONFLICT_SNAP=true
    fi

    # Check if installed via apt
    if $USE_SUDO dpkg -l 2>/dev/null | grep -q "^ii.*$EXEC_NAME"; then
        if [ "$INSTALL_METHOD" != "apt" ]; then
            log_warning "Detected apt installation, but target method is: $INSTALL_METHOD"
            conflict_detected=true
            conflict_source="apt"
            CONFLICT_APT=true
        fi
    fi

    # Check if installed via flatpak
    if command_exists flatpak && $USE_SUDO flatpak list 2>/dev/null | grep -q "$EXEC_NAME"; then
        if [ "$INSTALL_METHOD" != "flatpak" ]; then
            log_warning "Detected flatpak installation, but target method is: $INSTALL_METHOD"
            conflict_detected=true
            conflict_source="flatpak"
            CONFLICT_FLATPAK=true
        fi
    fi

    # Check if installed via npm (different from target package)
    if [ "$INSTALL_METHOD" = "npm" ]; then
        local npm_prefix=$($USE_SUDO npm config get prefix 2>/dev/null)
        local npm_modules="$npm_prefix/lib/node_modules"

        # Check if binary exists but points to different package
        if [ -L "$npm_prefix/bin/$EXEC_NAME" ]; then
            local link_target=$(readlink "$npm_prefix/bin/$EXEC_NAME")
            if [[ "$link_target" != *"$PACKAGE_ID"* ]]; then
                log_warning "Detected npm binary linked to different package"
                conflict_detected=true
                conflict_source="npm_different"
                CONFLICT_NPM_DIFF=true
            fi
        fi
    fi

    if [ "$conflict_detected" = true ]; then
        log_warning "Package conflict detected: $EXEC_NAME is from $conflict_source"
        return 1
    fi

    return 0
}

# Remove snap package
remove_snap_package() {
    if ! command_exists snap; then
        return 0
    fi

    log_install "Removing snap package: $EXEC_NAME"

    if $USE_SUDO snap remove "$EXEC_NAME" 2>/dev/null; then
        log_success "Successfully removed snap package"
        return 0
    else
        log_warning "Failed to remove snap package"
        return 1
    fi
}

# Remove apt package
remove_apt_package() {
    log_install "Removing apt package: $EXEC_NAME"

    if $USE_SUDO apt remove -y "$EXEC_NAME" 2>/dev/null; then
        log_success "Successfully removed apt package"
        # Also autoremove dependencies
        $USE_SUDO apt autoremove -y 2>/dev/null || true
        return 0
    else
        log_warning "Failed to remove apt package"
        return 1
    fi
}

# Remove flatpak package
remove_flatpak_package() {
    if ! command_exists flatpak; then
        return 0
    fi

    log_install "Removing flatpak package: $EXEC_NAME"

    if $USE_SUDO flatpak uninstall -y "$EXEC_NAME" 2>/dev/null; then
        log_success "Successfully removed flatpak package"
        return 0
    else
        log_warning "Failed to remove flatpak package"
        return 1
    fi
}

# Remove conflicting npm package
remove_npm_package() {
    local npm_prefix=$($USE_SUDO npm config get prefix 2>/dev/null)

    log_install "Removing conflicting npm package for: $EXEC_NAME"

    # Find which package provides this binary
    if [ -L "$npm_prefix/bin/$EXEC_NAME" ]; then
        local link_target=$(readlink "$npm_prefix/bin/$EXEC_NAME")
        local package_path=$(echo "$link_target" | sed 's|/bin/.*||' | sed 's|.*/node_modules/||')

        if [ -n "$package_path" ] && [ "$package_path" != "$PACKAGE_ID" ]; then
            log_install "Found conflicting package: $package_path"

            if $USE_SUDO npm uninstall -g "$package_path" --force 2>/dev/null; then
                log_success "Successfully uninstalled conflicting npm package"
                return 0
            else
                log_warning "Failed to uninstall conflicting npm package"
                return 1
            fi
        fi
    fi

    # If no specific package found, just remove the binary
    $USE_SUDO rm -f "$npm_prefix/bin/$EXEC_NAME" 2>/dev/null || true
    return 0
}

# Clean up residual files after conflict resolution
cleanup_residual_files() {
    log_install "Cleaning up residual files..."

    local cleanup_paths=(
        "/usr/local/bin/$EXEC_NAME"
        "/usr/bin/$EXEC_NAME"
        "/usr/local/super_scripts/$EXEC_NAME"
        "/usr/local/super_scripts/$EXEC_NAME.sh"
    )

    for file_path in "${cleanup_paths[@]}"; do
        if [ -L "$file_path" ] || [ -f "$file_path" ]; then
            log_install "Removing residual file: $file_path"
            $USE_SUDO rm -f "$file_path" 2>/dev/null || true
        fi
    done

    log_success "Residual cleanup completed"
}

# Verify conflict resolution
verify_resolution() {
    log_install "Verifying conflict resolution..."

    if command_exists "$EXEC_NAME"; then
        local cmd_path=$(which "$EXEC_NAME" 2>/dev/null)
        log_error "Command still exists after conflict resolution: $cmd_path"
        return 1
    fi

    log_success "Conflict resolution verified: $EXEC_NAME removed"
    return 0
}

# Main conflict resolution function
main() {
    log_install "Starting conflict check for: $EXEC_NAME"

    # Initialize conflict flags
    CONFLICT_SNAP=false
    CONFLICT_APT=false
    CONFLICT_FLATPAK=false
    CONFLICT_NPM_DIFF=false

    # Detect conflicts
    detect_conflict
    local has_conflict=$?

    if [ $has_conflict -eq 0 ]; then
        log_success "No conflicts detected, installation can proceed"
        exit 0
    fi

    log_warning "Package conflicts detected, resolving..."

    # Resolve snap conflict
    if [ "$CONFLICT_SNAP" = true ]; then
        remove_snap_package
        sleep 1
    fi

    # Resolve apt conflict
    if [ "$CONFLICT_APT" = true ]; then
        remove_apt_package
        sleep 1
    fi

    # Resolve flatpak conflict
    if [ "$CONFLICT_FLATPAK" = true ]; then
        remove_flatpak_package
        sleep 1
    fi

    # Resolve npm conflict
    if [ "$CONFLICT_NPM_DIFF" = true ]; then
        remove_npm_package
        sleep 1
    fi

    # Clean up residual files
    cleanup_residual_files

    # Wait for filesystem sync
    sleep 2

    # Verify resolution
    verify_resolution
    local verification_result=$?

    if [ $verification_result -eq 0 ]; then
        log_success "Conflict resolution completed successfully"
        exit 0
    else
        log_error "Conflict resolution failed, manual intervention required"
        exit 1
    fi
}

# Run main function
main "$@"
