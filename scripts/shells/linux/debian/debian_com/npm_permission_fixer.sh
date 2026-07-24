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

# NPM Permission Fixer
# Universal permission repair script for npm directories
# Usage: npm_permission_fixer.sh

SCRIPT_INDEX="[NPM_PERM_FIX]"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALLATION_LIBRARY_PATH="$(dirname "$(dirname "$SCRIPT_CURRENT_DIR")")/common/installation_library.sh"

# Source required libraries
source "$INSTALLATION_LIBRARY_PATH"

# Get npm configuration
get_npm_config() {
    NPM_PREFIX=$($USE_SUDO npm config get prefix 2>/dev/null || echo "/usr/local")
    NPM_GLOBAL_MODULES="$NPM_PREFIX/lib/node_modules"
    NPM_BIN="$NPM_PREFIX/bin"
    NPM_CACHE=$($USE_SUDO npm config get cache 2>/dev/null || echo "$HOME/.npm")
}

# Detect permission issues
detect_permission_issues() {
    local issues_found=0

    # Check node_modules directory
    if [ -d "$NPM_GLOBAL_MODULES" ]; then
        if [ ! -w "$NPM_GLOBAL_MODULES" ]; then
            log_warning "Cannot write to node_modules directory"
            ((issues_found++))
            ISSUE_MODULES_DIR=true
        fi

        # Check for files with wrong ownership
        local wrong_owner_count=$($USE_SUDO find "$NPM_GLOBAL_MODULES" ! -user root 2>/dev/null | wc -l)
        if [ $wrong_owner_count -gt 0 ]; then
            log_warning "Found $wrong_owner_count files with incorrect ownership"
            ((issues_found++))
            ISSUE_WRONG_OWNER=true
        fi
    fi

    # Check bin directory
    if [ -d "$NPM_BIN" ]; then
        if [ ! -w "$NPM_BIN" ]; then
            log_warning "Cannot write to bin directory"
            ((issues_found++))
            ISSUE_BIN_DIR=true
        fi

        # Check for non-executable binaries
        local non_exec_count=$($USE_SUDO find "$NPM_BIN" -type f ! -perm -111 2>/dev/null | wc -l)
        if [ $non_exec_count -gt 0 ]; then
            log_warning "Found $non_exec_count non-executable binaries"
            ((issues_found++))
            ISSUE_NON_EXEC=true
        fi
    fi

    return $issues_found
}

# Refuse recursive chown/chmod on system paths; allow /usr/local (npm prefix)
_npm_safe_path_for_chown() {
    local path="$1"
    [ -z "$path" ] && return 1
    [[ "$path" != /* ]] && return 1
    case "$path" in
        /|/usr/bin|/usr/bin/*|/usr/sbin|/usr/sbin/*|/usr/lib|/usr/lib/*|/etc|/etc/*|/bin|/bin/*|/sbin|/sbin/*|/lib|/lib/*|/var) return 1 ;;
        *) return 0 ;;
    esac
}

# Fix node_modules directory permissions
fix_modules_directory() {
    if [ ! -d "$NPM_GLOBAL_MODULES" ]; then
        log_install "Creating node_modules directory: $NPM_GLOBAL_MODULES"
        $USE_SUDO mkdir -p "$NPM_GLOBAL_MODULES"
    fi

    log_install "Fixing node_modules directory permissions..."
    log_install "[SAFE_PATH] NPM_GLOBAL_MODULES=$NPM_GLOBAL_MODULES"
    if ! _npm_safe_path_for_chown "$NPM_GLOBAL_MODULES"; then
        log_warning "Refusing chown/chmod on system path: $NPM_GLOBAL_MODULES"
        return 1
    fi

    # Set ownership
    $USE_SUDO chown -R root:root "$NPM_GLOBAL_MODULES" 2>/dev/null || {
        log_warning "Failed to set ownership, trying alternative method..."
        return 1
    }

    # Set directory permissions (755: rwxr-xr-x)
    $USE_SUDO find "$NPM_GLOBAL_MODULES" -type d -exec chmod 755 {} \; 2>/dev/null || {
        log_warning "Failed to set directory permissions"
        return 1
    }

    # Set file permissions (644: rw-r--r--)
    $USE_SUDO find "$NPM_GLOBAL_MODULES" -type f -exec chmod 644 {} \; 2>/dev/null || {
        log_warning "Failed to set file permissions"
        return 1
    }

    log_success "Fixed node_modules directory permissions"
    return 0
}

# Fix bin directory permissions
fix_bin_directory() {
    if [ ! -d "$NPM_BIN" ]; then
        log_install "Creating bin directory: $NPM_BIN"
        $USE_SUDO mkdir -p "$NPM_BIN"
    fi

    log_install "Fixing bin directory permissions..."
    log_install "[SAFE_PATH] NPM_BIN=$NPM_BIN"
    if ! _npm_safe_path_for_chown "$NPM_BIN"; then
        log_warning "Refusing chown on system path: $NPM_BIN"
        return 1
    fi

    # Set ownership
    $USE_SUDO chown -R root:root "$NPM_BIN" 2>/dev/null || {
        log_warning "Failed to set ownership"
        return 1
    }

    # Set directory permissions (755: rwxr-xr-x)
    $USE_SUDO chmod 755 "$NPM_BIN" 2>/dev/null || {
        log_warning "Failed to set directory permissions"
        return 1
    }

    # Set all files as executable (755: rwxr-xr-x)
    $USE_SUDO find "$NPM_BIN" -type f -exec chmod 755 {} \; 2>/dev/null || {
        log_warning "Failed to set executable permissions"
        return 1
    }

    log_success "Fixed bin directory permissions"
    return 0
}

# Fix cache directory permissions
fix_cache_directory() {
    if [ ! -d "$NPM_CACHE" ]; then
        log_install "Cache directory does not exist, skipping"
        return 0
    fi

    log_install "Fixing cache directory permissions..."
    log_install "[SAFE_PATH] NPM_CACHE=$NPM_CACHE"
    if ! _npm_safe_path_for_chown "$NPM_CACHE"; then
        log_warning "Refusing chown/chmod on system path: $NPM_CACHE"
        return 1
    fi

    # Cache directory should be owned by the user running npm
    local cache_owner="root"
    if [ -n "$SUDO_USER" ]; then
        cache_owner="$SUDO_USER"
    fi

    $USE_SUDO chown -R "$cache_owner:$cache_owner" "$NPM_CACHE" 2>/dev/null || {
        log_warning "Failed to set cache ownership"
        return 1
    }

    $USE_SUDO chmod -R 755 "$NPM_CACHE" 2>/dev/null || {
        log_warning "Failed to set cache permissions"
        return 1
    }

    log_success "Fixed cache directory permissions"
    return 0
}

# Fix super_scripts directory permissions (if exists)
fix_super_scripts_directory() {
    local super_scripts_dir="/usr/local/super_scripts"

    if [ ! -d "$super_scripts_dir" ]; then
        return 0
    fi

    log_install "Fixing super_scripts directory permissions..."
    log_install "[SAFE_PATH] super_scripts_dir=$super_scripts_dir"
    if ! _npm_safe_path_for_chown "$super_scripts_dir"; then
        log_warning "Refusing chown/chmod on system path: $super_scripts_dir"
        return 1
    fi

    $USE_SUDO chown -R root:root "$super_scripts_dir" 2>/dev/null || true
    $USE_SUDO chmod -R 755 "$super_scripts_dir" 2>/dev/null || true
    $USE_SUDO find "$super_scripts_dir" -type f -name "*.sh" -exec chmod +x {} \; 2>/dev/null || true

    log_success "Fixed super_scripts directory permissions"
    return 0
}

# Verify permission fixes
verify_permissions() {
    local issues_found=0

    # Verify node_modules is writable
    if [ -d "$NPM_GLOBAL_MODULES" ] && [ ! -w "$NPM_GLOBAL_MODULES" ]; then
        log_error "node_modules directory is still not writable"
        ((issues_found++))
    fi

    # Verify bin directory is writable
    if [ -d "$NPM_BIN" ] && [ ! -w "$NPM_BIN" ]; then
        log_error "bin directory is still not writable"
        ((issues_found++))
    fi

    # Verify binaries are executable
    if [ -d "$NPM_BIN" ]; then
        local non_exec_count=$($USE_SUDO find "$NPM_BIN" -type f ! -perm -111 2>/dev/null | wc -l)
        if [ $non_exec_count -gt 0 ]; then
            log_warning "$non_exec_count binaries are still not executable"
            ((issues_found++))
        fi
    fi

    return $issues_found
}

# Main permission fix function
main() {
    log_install "Starting npm permission check and fix..."

    # Initialize issue flags
    ISSUE_MODULES_DIR=false
    ISSUE_BIN_DIR=false
    ISSUE_WRONG_OWNER=false
    ISSUE_NON_EXEC=false

    # Get npm configuration
    get_npm_config

    log_install "NPM directories:"
    log_install "  Prefix: $NPM_PREFIX"
    log_install "  Modules: $NPM_GLOBAL_MODULES"
    log_install "  Bin: $NPM_BIN"
    log_install "  Cache: $NPM_CACHE"

    # Detect permission issues
    detect_permission_issues
    local issue_count=$?

    if [ $issue_count -eq 0 ]; then
        log_success "No permission issues detected"
        exit 0
    fi

    log_warning "Detected $issue_count permission issue(s), fixing..."

    # Fix node_modules directory
    if [ "$ISSUE_MODULES_DIR" = true ] || [ "$ISSUE_WRONG_OWNER" = true ]; then
        fix_modules_directory
    fi

    # Fix bin directory
    if [ "$ISSUE_BIN_DIR" = true ] || [ "$ISSUE_NON_EXEC" = true ]; then
        fix_bin_directory
    fi

    # Fix cache directory
    fix_cache_directory

    # Fix super_scripts directory
    fix_super_scripts_directory

    # Verify fixes
    verify_permissions
    local verification_result=$?

    if [ $verification_result -eq 0 ]; then
        log_success "All permission issues fixed successfully"
        exit 0
    else
        log_warning "Permission fix completed with $verification_result remaining issue(s)"
        exit 1
    fi
}

# Run main function
main "$@"
