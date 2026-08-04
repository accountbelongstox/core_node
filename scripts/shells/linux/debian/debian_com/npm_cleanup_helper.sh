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

# NPM Cleanup Helper
# Universal cleanup script for npm package installation issues
# Usage: npm_cleanup_helper.sh <package_id> [app_name]

SCRIPT_INDEX="[NPM_CLEANUP]"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALLATION_LIBRARY_PATH="$(dirname "$(dirname "$SCRIPT_CURRENT_DIR")")/common/installation_library.sh"

# Source required libraries
source "$INSTALLATION_LIBRARY_PATH"

# Check if package_id is provided
if [ -z "$1" ]; then
    log_error "Usage: $0 <package_id> [app_name]"
    exit 1
fi

PACKAGE_ID="$1"
APP_NAME="${2:-$PACKAGE_ID}"

# Get npm configuration
get_npm_config() {
    NPM_PREFIX=$($USE_SUDO npm config get prefix 2>/dev/null || echo "/usr/local")
    NPM_GLOBAL_MODULES="$NPM_PREFIX/lib/node_modules"
    NPM_BIN="$NPM_PREFIX/bin"
    NPM_CACHE=$($USE_SUDO npm config get cache 2>/dev/null || echo "$HOME/.npm")
}

# Stop related processes
stop_related_processes() {
    local exec_name=$(echo "$PACKAGE_ID" | sed 's/.*\///' | sed 's/@.*//')

    if pgrep -f "$exec_name" >/dev/null 2>&1; then
        log_warning "Stopping related processes for: $exec_name"
        pkill -f "$exec_name" 2>/dev/null || true
        sleep 1
    fi
}

# Remove orphaned binaries
remove_orphaned_binaries() {
    local exec_name=$(echo "$PACKAGE_ID" | sed 's/.*\///' | sed 's/@.*//')
    local removed_count=0

    local bin_locations=(
        "$NPM_BIN/$exec_name"
        "/usr/local/bin/$exec_name"
        "/usr/local/super_scripts/$exec_name"
        "/usr/local/super_scripts/$exec_name.sh"
    )

    for bin_path in "${bin_locations[@]}"; do
        if [ -L "$bin_path" ] || [ -f "$bin_path" ]; then
            log_install "Removing orphaned binary: $bin_path"
            $USE_SUDO rm -f "$bin_path" 2>/dev/null || true
            ((removed_count++))
        fi
    done

    if [ $removed_count -gt 0 ]; then
        log_success "Removed $removed_count orphaned binary(ies)"
    fi
}

# Try npm uninstall
try_npm_uninstall() {
    log_install "Attempting npm uninstall for: $PACKAGE_ID"

    if $USE_SUDO npm list -g "$PACKAGE_ID" >/dev/null 2>&1; then
        if timeout 60 $USE_SUDO npm uninstall -g "$PACKAGE_ID" --force 2>/dev/null; then
            log_success "Successfully uninstalled via npm"
            return 0
        else
            log_warning "npm uninstall failed, will try direct removal"
            return 1
        fi
    else
        log_install "Package not listed in npm, skipping uninstall"
        return 0
    fi
}

# Remove package directory directly
remove_package_directory() {
    local package_dir="$NPM_GLOBAL_MODULES/$PACKAGE_ID"

    if [ ! -d "$package_dir" ]; then
        log_install "Package directory does not exist: $package_dir"
        return 0
    fi

    log_install "Removing package directory: $package_dir"
    log_install "[SAFE_PATH] package_dir=$package_dir"

    # Try normal removal first
    if $USE_SUDO rm -rf "$package_dir" 2>/dev/null; then
        log_success "Successfully removed package directory"
        return 0
    else
        log_warning "Normal removal failed, trying with permission fix..."

        # Refuse chmod/chown on system or dangerous paths
        _safe_pkg=false
        if [ -n "$package_dir" ] && [[ "$package_dir" == /* ]]; then
            case "$package_dir" in
                /|/usr|/usr/*|/etc|/etc/*|/bin|/bin/*|/sbin|/sbin/*|/lib|/lib/*|/var) ;;
                *) _safe_pkg=true ;;
            esac
        fi
        if [ "$_safe_pkg" = true ]; then
            repair_owned_tree_777 "$package_dir" || true
        else
            log_warning "Refusing chmod/chown on system or invalid path: $package_dir"
        fi

        if $USE_SUDO rm -rf "$package_dir" 2>/dev/null; then
            log_success "Successfully removed package directory after permission fix"
            return 0
        else
            log_error "Failed to remove package directory: $package_dir"
            return 1
        fi
    fi
}

# Clean staging directory
clean_staging_directory() {
    local staging_dir="$NPM_GLOBAL_MODULES/.staging"

    if [ ! -d "$staging_dir" ]; then
        log_install "No staging directory found"
        return 0
    fi

    log_install "Cleaning staging directory: $staging_dir"

    if $USE_SUDO rm -rf "$staging_dir" 2>/dev/null; then
        log_success "Successfully cleaned staging directory"
        return 0
    else
        log_warning "Failed to clean staging directory"
        return 1
    fi
}

# Clean package-specific cache
clean_package_cache() {
    log_install "Cleaning npm cache for: $PACKAGE_ID"

    # Clean entire cache (safer for resolving conflicts)
    if $USE_SUDO npm cache clean --force 2>/dev/null; then
        log_success "Successfully cleaned npm cache"
        return 0
    else
        log_warning "npm cache clean failed, trying manual cleanup..."

        if [ -d "$NPM_CACHE" ]; then
            $USE_SUDO rm -rf "$NPM_CACHE/_cacache" 2>/dev/null || true
            $USE_SUDO rm -rf "$NPM_CACHE/_logs" 2>/dev/null || true
            log_success "Manually cleaned cache directories"
        fi
        return 0
    fi
}

# Verify cleanup
verify_cleanup() {
    local package_dir="$NPM_GLOBAL_MODULES/$PACKAGE_ID"
    local staging_dir="$NPM_GLOBAL_MODULES/.staging"
    local issues_found=0

    if [ -d "$package_dir" ]; then
        log_error "Package directory still exists: $package_dir"
        ((issues_found++))
    fi

    if [ -d "$staging_dir" ]; then
        log_warning "Staging directory still exists: $staging_dir"
        ((issues_found++))
    fi

    return $issues_found
}

# Main cleanup function
main() {
    log_install "Starting cleanup for: $APP_NAME ($PACKAGE_ID)"

    # Get npm configuration
    get_npm_config

    # Step 1: Stop related processes
    stop_related_processes

    # Step 2: Remove orphaned binaries
    remove_orphaned_binaries

    # Step 3: Try npm uninstall
    try_npm_uninstall

    # Step 4: Remove package directory directly
    remove_package_directory

    # Step 5: Clean staging directory
    clean_staging_directory

    # Step 6: Clean package cache
    clean_package_cache

    # Wait for filesystem sync
    sleep 1

    # Step 7: Verify cleanup
    verify_cleanup
    local verification_result=$?

    if [ $verification_result -eq 0 ]; then
        log_success "Cleanup completed successfully for: $APP_NAME"
        exit 0
    else
        log_warning "Cleanup completed with $verification_result issue(s)"
        log_warning "Manual cleanup may be required"
        exit 1
    fi
}

# Run main function
main "$@"
