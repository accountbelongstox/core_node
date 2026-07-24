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

# NPM Pre-Installation Checker
# Universal pre-installation check and auto-fix script for npm packages
# Usage: npm_pre_install_checker.sh <package_id> <app_name>

SCRIPT_INDEX="[NPM_PRE_CHECK]"
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

# Check if npm is available
check_npm_available() {
    if ! command_exists npm; then
        log_error "npm is not installed"
        return 1
    fi
    return 0
}

# Detect package installation issues
detect_installation_issues() {
    local package_dir="$NPM_GLOBAL_MODULES/$PACKAGE_ID"
    local issues_found=0

    # Check 1: Incomplete installation (directory exists but corrupted)
    if [ -d "$package_dir" ]; then
        if [ ! -f "$package_dir/package.json" ]; then
            log_warning "Detected incomplete installation: package.json missing"
            ((issues_found++))
            ISSUE_INCOMPLETE_INSTALL=true
        fi
    fi

    # Check 2: Staging directory exists (previous installation interrupted)
    if [ -d "$NPM_GLOBAL_MODULES/.staging" ]; then
        log_warning "Detected npm staging directory (interrupted installation)"
        ((issues_found++))
        ISSUE_STAGING_EXISTS=true
    fi

    # Check 3: Permission issues
    if [ -d "$package_dir" ]; then
        if [ ! -w "$package_dir" ]; then
            log_warning "Detected permission issue: cannot write to package directory"
            ((issues_found++))
            ISSUE_PERMISSION=true
        fi
    fi

    # Check 4: Binary exists but module doesn't
    local exec_name=$(echo "$PACKAGE_ID" | sed 's/.*\///' | sed 's/@.*//')
    if [ -f "$NPM_BIN/$exec_name" ] && [ ! -d "$package_dir" ]; then
        log_warning "Detected orphaned binary: $NPM_BIN/$exec_name"
        ((issues_found++))
        ISSUE_ORPHANED_BINARY=true
    fi

    return $issues_found
}

# Main check function
main() {
    log_install "Running pre-installation check for: $PACKAGE_ID"

    # Initialize issue flags
    ISSUE_INCOMPLETE_INSTALL=false
    ISSUE_STAGING_EXISTS=false
    ISSUE_PERMISSION=false
    ISSUE_ORPHANED_BINARY=false

    # Check npm availability
    if ! check_npm_available; then
        log_error "Cannot proceed: npm not available"
        exit 1
    fi

    # Get npm configuration
    get_npm_config

    # Detect issues
    detect_installation_issues
    local issue_count=$?

    if [ $issue_count -eq 0 ]; then
        log_success "No issues detected, installation can proceed safely"
        exit 0
    fi

    log_warning "Detected $issue_count issue(s), running auto-fix..."

    # Run cleanup helper if needed
    if [ "$ISSUE_INCOMPLETE_INSTALL" = true ] || \
       [ "$ISSUE_STAGING_EXISTS" = true ] || \
       [ "$ISSUE_ORPHANED_BINARY" = true ]; then
        log_install "Running npm cleanup helper..."
        bash "$SCRIPT_CURRENT_DIR/npm_cleanup_helper.sh" "$PACKAGE_ID" "$APP_NAME"
    fi

    # Run permission fixer if needed
    if [ "$ISSUE_PERMISSION" = true ]; then
        log_install "Running npm permission fixer..."
        bash "$SCRIPT_CURRENT_DIR/npm_permission_fixer.sh"
    fi

    log_success "Pre-installation check and fix completed"
    exit 0
}

# Run main function
main "$@"
