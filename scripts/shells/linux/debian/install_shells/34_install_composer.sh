#!/bin/bash
# Script: 34_install_composer.sh
# Description: Dedicated Composer installation with PHP 8.4 and strong auto-correction
# Author: System Administrator
# Version: 2.0

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_INDEX="[34_COMPOSER]"

# Source dependencies
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Source PHP common variables and functions
source "$PARENT_DIR_LEVEL_1/debian_com/php_common_vars.sh"
source "$PARENT_DIR_LEVEL_1/debian_com/php_common_functions.sh"

# Configuration - using variables from php_common_vars.sh
PHP_BINARY="/usr/local/bin/php"

# Version requirements
MIN_COMPOSER_VERSION_MAJOR=2
MIN_COMPOSER_VERSION_MINOR=7
MIN_COMPOSER_VERSION_PATCH=0
MIN_COMPOSER_VERSION="2.7.0"

# PHP version tracking file
PHP_VERSION_TRACK_FILE="/usr/local/etc/.composer_php_version"

# Set Composer environment based on user privileges
if [ "$EUID" -eq 0 ]; then
    # Auto-allow Composer to run as root without interactive prompt
    export COMPOSER_ALLOW_SUPERUSER=1
    export COMPOSER_NO_INTERACTION=1
    echo -e "${YELLOW}$SCRIPT_INDEX Running as root - Composer warnings automatically handled${NC}"
else
    # Ensure non-interactive mode for consistency
    export COMPOSER_NO_INTERACTION=1
fi

# Check if original Composer binary exists and is working
is_original_composer_working() {
    if [ -f "${COMPOSER_TARGET_PATH}.original" ] && [ -x "${COMPOSER_TARGET_PATH}.original" ]; then
        # Test original composer binary directly
        if COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 "$PHP_BINARY" -d open_basedir= "${COMPOSER_TARGET_PATH}.original" --version >/dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# Check if wrapper exists and is working
is_composer_wrapper_working() {
    if [ -f "$COMPOSER_TARGET_PATH" ] && [ -x "$COMPOSER_TARGET_PATH" ]; then
        # Check if it's a wrapper (contains "#!/bin/bash" and "composer.original")
        if head -n 1 "$COMPOSER_TARGET_PATH" | grep -q "#!/bin/bash" && grep -q "composer.original" "$COMPOSER_TARGET_PATH"; then
            # Test wrapper functionality
            if COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 "$COMPOSER_TARGET_PATH" --version >/dev/null 2>&1; then
                return 0
            fi
        fi
    fi
    return 1
}

# Get Composer version from original binary
get_composer_version() {
    if is_original_composer_working; then
        COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 "$PHP_BINARY" -d open_basedir= "${COMPOSER_TARGET_PATH}.original" --version 2>/dev/null | grep -oP 'Composer version \K[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown"
    else
        echo "not_installed"
    fi
}

# Compare version strings (returns 0 if version1 >= version2)
version_compare() {
    local version1=$1
    local version2=$2

    if [ "$version1" = "unknown" ] || [ "$version1" = "not_installed" ]; then
        return 1
    fi

    local IFS=.
    local ver1=($version1)
    local ver2=($version2)

    for ((i=0; i<3; i++)); do
        local num1=${ver1[i]:-0}
        local num2=${ver2[i]:-0}

        if ((num1 > num2)); then
            return 0
        elif ((num1 < num2)); then
            return 1
        fi
    done

    return 0
}

# Check if Composer has deprecation warnings (indicates old version)
check_composer_errors() {
    local test_output
    test_output=$(COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 "$PHP_BINARY" -d open_basedir= "${COMPOSER_TARGET_PATH}.original" --version 2>&1)

    if echo "$test_output" | grep -qi "deprecated\|warning\|error"; then
        return 1
    fi
    return 0
}

# Get current PHP version
get_current_php_version() {
    if [ -x "$PHP_BINARY" ]; then
        "$PHP_BINARY" -v 2>/dev/null | grep -oP 'PHP \K[0-9]+\.[0-9]+\.[0-9]+' | head -n1 || echo "unknown"
    else
        echo "not_found"
    fi
}

# Get stored PHP version
get_stored_php_version() {
    if [ -f "$PHP_VERSION_TRACK_FILE" ]; then
        cat "$PHP_VERSION_TRACK_FILE" 2>/dev/null || echo "unknown"
    else
        echo "not_stored"
    fi
}

# Store current PHP version
store_php_version() {
    local php_version=$(get_current_php_version)
    if [ "$php_version" != "unknown" ] && [ "$php_version" != "not_found" ]; then
        $USE_SUDO mkdir -p "$(dirname "$PHP_VERSION_TRACK_FILE")"
        echo "$php_version" | $USE_SUDO tee "$PHP_VERSION_TRACK_FILE" > /dev/null
        echo -e "${GREEN}$SCRIPT_INDEX Stored PHP version: $php_version${NC}"
    fi
}

# Check if PHP version changed
is_php_version_changed() {
    local current_version=$(get_current_php_version)
    local stored_version=$(get_stored_php_version)

    if [ "$stored_version" = "not_stored" ]; then
        return 0
    fi

    if [ "$current_version" != "$stored_version" ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX PHP version changed: $stored_version -> $current_version${NC}"
        return 0
    fi

    return 1
}

# Strong correction check - determines if reinstall is needed
needs_correction() {
    local reason=""

    # Check 1: Composer binary location
    if [ ! -f "$COMPOSER_TARGET_PATH" ]; then
        reason="Composer binary missing at $COMPOSER_TARGET_PATH"
        echo -e "${YELLOW}$SCRIPT_INDEX [CORRECTION NEEDED] $reason${NC}"
        return 0
    fi

    # Check 2: Original binary location
    if [ ! -f "${COMPOSER_TARGET_PATH}.original" ]; then
        reason="Original Composer binary missing"
        echo -e "${YELLOW}$SCRIPT_INDEX [CORRECTION NEEDED] $reason${NC}"
        return 0
    fi

    # Check 3: Installation completeness
    if ! is_composer_installation_complete; then
        reason="Incomplete installation (wrapper or original binary not working)"
        echo -e "${YELLOW}$SCRIPT_INDEX [CORRECTION NEEDED] $reason${NC}"
        return 0
    fi

    # Check 4: Version compatibility
    local current_version=$(get_composer_version)
    if ! version_compare "$current_version" "$MIN_COMPOSER_VERSION"; then
        reason="Composer version $current_version is too old (requires >= $MIN_COMPOSER_VERSION for PHP 8.4)"
        echo -e "${YELLOW}$SCRIPT_INDEX [CORRECTION NEEDED] $reason${NC}"
        return 0
    fi

    # Check 5: Deprecation warnings
    if ! check_composer_errors; then
        reason="Composer showing deprecation warnings (old version incompatible with PHP 8.4)"
        echo -e "${YELLOW}$SCRIPT_INDEX [CORRECTION NEEDED] $reason${NC}"
        return 0
    fi

    # Check 6: PHP version changed
    if is_php_version_changed; then
        reason="PHP version changed, Composer needs reinstallation"
        echo -e "${YELLOW}$SCRIPT_INDEX [CORRECTION NEEDED] $reason${NC}"
        return 0
    fi

    # Check 7: Wrapper script integrity
    if [ ! -f "/usr/local/bin/composer-safe" ]; then
        reason="composer-safe wrapper missing"
        echo -e "${YELLOW}$SCRIPT_INDEX [CORRECTION NEEDED] $reason${NC}"
        return 0
    fi

    return 1
}

# Check if Composer installation is complete and working
is_composer_installation_complete() {
    # Both original binary and wrapper must exist and work
    if is_original_composer_working && is_composer_wrapper_working; then
        return 0
    fi
    return 1
}

# Check command line arguments
FORCE_REINSTALL=false
if [ "$1" = "--force" ] || [ "$1" = "-f" ]; then
    FORCE_REINSTALL=true
    echo -e "${YELLOW}$SCRIPT_INDEX Force reinstall requested${NC}"
elif [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX Composer Installation Script for PHP 8.4 (Server Edition)${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX Version: 2.0 - With Strong Auto-Correction${NC}"
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}Usage: $0 [options]${NC}"
    echo -e "${CYAN}${NC}"
    echo -e "${CYAN}Options:${NC}"
    echo -e "${CYAN}  --force, -f    Force reinstall and recreate all wrappers${NC}"
    echo -e "${CYAN}  --help, -h     Show this help message${NC}"
    echo -e "${CYAN}${NC}"
    echo -e "${CYAN}This script will:${NC}"
    echo -e "${CYAN}  1. Install/update Composer >= $MIN_COMPOSER_VERSION for PHP 8.4${NC}"
    echo -e "${CYAN}  2. Create wrapper scripts to handle root warnings and open_basedir${NC}"
    echo -e "${CYAN}  3. Verify all components are working correctly${NC}"
    echo -e "${CYAN}  4. Track PHP version for automatic correction${NC}"
    echo -e "${CYAN}${NC}"
    echo -e "${CYAN}Auto-Correction Features:${NC}"
    echo -e "${CYAN}  â€?Detects old/incompatible Composer versions${NC}"
    echo -e "${CYAN}  â€?Reinstalls if PHP version changes${NC}"
    echo -e "${CYAN}  â€?Fixes missing/broken wrapper scripts${NC}"
    echo -e "${CYAN}  â€?Checks for deprecation warnings${NC}"
    echo -e "${CYAN}  â€?Validates installation completeness${NC}"
    echo -e "${CYAN}${NC}"
    echo -e "${CYAN}Created files:${NC}"
    echo -e "${CYAN}  /usr/local/bin/composer            (main wrapper)${NC}"
    echo -e "${CYAN}  /usr/local/bin/composer-safe       (explicit safe wrapper)${NC}"
    echo -e "${CYAN}  /usr/local/bin/composer.original   (original Composer binary)${NC}"
    echo -e "${CYAN}  /usr/local/etc/.composer_php_version (PHP version tracking)${NC}"
    echo -e "${CYAN}${NC}"
    echo -e "${CYAN}Server-Optimized Features:${NC}"
    echo -e "${CYAN}  â€?Automatic retry on download failures${NC}"
    echo -e "${CYAN}  â€?Non-interactive mode by default${NC}"
    echo -e "${CYAN}  â€?Root user handling without prompts${NC}"
    echo -e "${CYAN}  â€?Comprehensive error detection${NC}"
    echo -e "${CYAN}============================================================================${NC}"
    exit 0
fi

# Simple installation check
main() {
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX Composer Installation for PHP 8.4 (Server Edition)${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX Version: 2.0 - With Strong Auto-Correction${NC}"
    echo -e "${CYAN}============================================================================${NC}"

    # Check PHP 8.4 availability
    if [ ! -x "$PHP_BINARY" ]; then
        echo -e "${RED}$SCRIPT_INDEX PHP 8.4 not found at $PHP_BINARY${NC}"
        echo -e "${YELLOW}$SCRIPT_INDEX Please run 31_ensure_php84_intelligent.sh first${NC}"
        exit 1
    fi

    if ! "$PHP_BINARY" --version | grep -q "PHP 8.4"; then
        echo -e "${RED}$SCRIPT_INDEX $PHP_BINARY is not PHP 8.4${NC}"
        exit 1
    fi

    local php_version=$(get_current_php_version)
    echo -e "${GREEN}$SCRIPT_INDEX PHP $php_version confirmed at $PHP_BINARY${NC}"

    # Strong correction check
    local current_version=$(get_composer_version)
    local auto_fix_needed=false

    if [ "$FORCE_REINSTALL" = true ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX [FORCE MODE] Force reinstall requested${NC}"
        auto_fix_needed=true
    elif needs_correction; then
        echo -e "${YELLOW}$SCRIPT_INDEX [AUTO-CORRECTION] Issues detected, automatic reinstall triggered${NC}"
        auto_fix_needed=true
    elif [ "$current_version" != "not_installed" ] && is_composer_installation_complete; then
        echo -e "${GREEN}$SCRIPT_INDEX âœ?Composer $current_version is properly installed and working${NC}"
        echo -e "${GREEN}$SCRIPT_INDEX âœ?Location: $COMPOSER_TARGET_PATH (wrapper)${NC}"
        echo -e "${GREEN}$SCRIPT_INDEX âœ?Original: ${COMPOSER_TARGET_PATH}.original${NC}"
        echo -e "${GREEN}$SCRIPT_INDEX âœ?Safe wrapper: /usr/local/bin/composer-safe${NC}"
        echo -e "${GREEN}$SCRIPT_INDEX âœ?PHP version tracking: $php_version${NC}"
        echo -e "${CYAN}$SCRIPT_INDEX All checks passed - no corrections needed${NC}"
        exit 0
    else
        echo -e "${YELLOW}$SCRIPT_INDEX Composer not found or incomplete, proceeding with installation${NC}"
        auto_fix_needed=true
    fi

    if [ "$auto_fix_needed" = false ]; then
        exit 0
    fi

    # Show environment configuration
    if [ "$EUID" -eq 0 ]; then
        echo -e "${CYAN}$SCRIPT_INDEX Root user detected - Composer warnings will be automatically handled${NC}"
        echo -e "${CYAN}$SCRIPT_INDEX Environment: COMPOSER_ALLOW_SUPERUSER=1, COMPOSER_NO_INTERACTION=1${NC}"
    else
        echo -e "${CYAN}$SCRIPT_INDEX Non-interactive mode enabled: COMPOSER_NO_INTERACTION=1${NC}"
    fi

    # Strong cleanup - remove all composer-related files to ensure clean state
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX [CLEANUP] Removing all existing Composer installations...${NC}"
    echo -e "${CYAN}============================================================================${NC}"

    $USE_SUDO rm -f "$COMPOSER_TARGET_PATH" 2>/dev/null || true
    $USE_SUDO rm -f "${COMPOSER_TARGET_PATH}.original" 2>/dev/null || true
    $USE_SUDO rm -f "/usr/local/bin/composer-safe" 2>/dev/null || true
    $USE_SUDO rm -f "/usr/local/bin/composer-php84" 2>/dev/null || true
    $USE_SUDO rm -f "/usr/bin/composer" 2>/dev/null || true
    $USE_SUDO rm -f "/usr/local/bin/composer.phar" 2>/dev/null || true

    echo -e "${GREEN}$SCRIPT_INDEX âœ?Cleanup completed${NC}"

    # Download and install Composer
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX [INSTALLATION] Downloading latest Composer (>= $MIN_COMPOSER_VERSION)${NC}"
    echo -e "${CYAN}============================================================================${NC}"

    # Create temp directory
    local temp_dir=$(mktemp -d)
    local original_dir=$(pwd)
    cd "$temp_dir"

    # Download installer with retry logic
    local download_attempts=0
    local max_attempts=3
    local download_success=false

    while [ $download_attempts -lt $max_attempts ]; do
        download_attempts=$((download_attempts + 1))
        echo -e "${CYAN}$SCRIPT_INDEX Downloading Composer installer (attempt $download_attempts/$max_attempts)...${NC}"

        if curl -fsSL "$COMPOSER_DOWNLOAD_URL" -o composer-setup.php 2>/dev/null; then
            download_success=true
            echo -e "${GREEN}$SCRIPT_INDEX âœ?Download successful${NC}"
            break
        else
            echo -e "${YELLOW}$SCRIPT_INDEX Download attempt $download_attempts failed${NC}"
            sleep 2
        fi
    done

    if [ "$download_success" = false ]; then
        echo -e "${RED}$SCRIPT_INDEX Failed to download Composer installer after $max_attempts attempts${NC}"
        cd "$original_dir"
        rm -rf "$temp_dir"
        exit 1
    fi

    # Install with open_basedir disabled and environment variables set
    echo -e "${CYAN}$SCRIPT_INDEX Installing Composer with PHP 8.4 compatibility...${NC}"
    local install_output
    install_output=$($USE_SUDO COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 "$PHP_BINARY" -d "open_basedir=none" composer-setup.php --install-dir=/usr/local/bin --filename=composer 2>&1)
    local install_status=$?

    if [ $install_status -eq 0 ]; then
        echo -e "${GREEN}$SCRIPT_INDEX âœ?Composer installed successfully${NC}"

        # Show installed version
        local installed_version=$($USE_SUDO COMPOSER_ALLOW_SUPERUSER=1 "$PHP_BINARY" -d "open_basedir=none" /usr/local/bin/composer --version 2>/dev/null | grep -oP 'Composer version \K[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
        echo -e "${GREEN}$SCRIPT_INDEX âœ?Installed version: $installed_version${NC}"

        if ! version_compare "$installed_version" "$MIN_COMPOSER_VERSION"; then
            echo -e "${RED}$SCRIPT_INDEX WARNING: Installed version $installed_version may be too old for PHP 8.4${NC}"
            echo -e "${YELLOW}$SCRIPT_INDEX Minimum recommended: $MIN_COMPOSER_VERSION${NC}"
        fi
    else
        echo -e "${RED}$SCRIPT_INDEX Composer installation failed${NC}"
        echo -e "${RED}$SCRIPT_INDEX Error output:${NC}"
        echo "$install_output"
        cd "$original_dir"
        rm -rf "$temp_dir"
        exit 1
    fi

    # Make executable
    $USE_SUDO chmod +x "$COMPOSER_TARGET_PATH"

    # Clean up temp directory
    cd "$original_dir"
    rm -rf "$temp_dir"

    # Ensure we have the original composer binary
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX [WRAPPER CREATION] Setting up wrapper scripts...${NC}"
    echo -e "${CYAN}============================================================================${NC}"

    if [ ! -f "${COMPOSER_TARGET_PATH}.original" ]; then
        echo -e "${CYAN}$SCRIPT_INDEX Moving Composer to original location...${NC}"
        $USE_SUDO mv "$COMPOSER_TARGET_PATH" "${COMPOSER_TARGET_PATH}.original"
        echo -e "${GREEN}$SCRIPT_INDEX âœ?Original binary saved${NC}"
    fi

    # Create global wrapper to handle root warnings and open_basedir
    echo -e "${CYAN}$SCRIPT_INDEX Creating composer-safe wrapper...${NC}"
    $USE_SUDO tee /usr/local/bin/composer-safe > /dev/null << 'EOF'
#!/bin/bash
# Global Composer wrapper that handles root warnings and open_basedir restrictions
# Usage: composer-safe [composer-arguments]

# Auto-handle root user warnings
export COMPOSER_ALLOW_SUPERUSER=1
export COMPOSER_NO_INTERACTION=1

# Execute original composer with open_basedir disabled for maximum compatibility
# This wrapper directly calls the original composer binary, not the wrapper
# open_basedir is set to none to allow access to all system directories
exec /usr/local/bin/php -d "open_basedir=none" /usr/local/bin/composer.original "$@"
EOF
    $USE_SUDO chmod +x /usr/local/bin/composer-safe

    # Create main composer wrapper
    echo -e "${CYAN}$SCRIPT_INDEX Creating composer wrapper for better compatibility...${NC}"
    $USE_SUDO tee "$COMPOSER_TARGET_PATH" > /dev/null << 'EOF'
#!/bin/bash
# Composer wrapper with automatic environment handling

# Auto-handle root user warnings
if [ "$EUID" -eq 0 ]; then
    export COMPOSER_ALLOW_SUPERUSER=1
    export COMPOSER_NO_INTERACTION=1
fi

# Execute original composer with open_basedir disabled for maximum compatibility
# open_basedir is set to none to allow access to all system directories
exec /usr/local/bin/php -d "open_basedir=none" /usr/local/bin/composer.original "$@"
EOF
    $USE_SUDO chmod +x "$COMPOSER_TARGET_PATH"

    # Verify all wrappers are working correctly
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX [VERIFICATION] Testing all components...${NC}"
    echo -e "${CYAN}============================================================================${NC}"

    local all_checks_passed=true

    # Test main composer wrapper
    echo -e "${CYAN}$SCRIPT_INDEX Testing main composer wrapper...${NC}"
    if COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 "$COMPOSER_TARGET_PATH" --version >/dev/null 2>&1; then
        echo -e "${GREEN}$SCRIPT_INDEX âœ?Main composer wrapper: OK${NC}"
    else
        echo -e "${RED}$SCRIPT_INDEX âœ?Main composer wrapper: FAILED${NC}"
        all_checks_passed=false
    fi

    # Test composer-safe wrapper
    echo -e "${CYAN}$SCRIPT_INDEX Testing composer-safe wrapper...${NC}"
    if COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 /usr/local/bin/composer-safe --version >/dev/null 2>&1; then
        echo -e "${GREEN}$SCRIPT_INDEX âœ?Composer-safe wrapper: OK${NC}"
    else
        echo -e "${RED}$SCRIPT_INDEX âœ?Composer-safe wrapper: FAILED${NC}"
        all_checks_passed=false
    fi

    # Test original composer binary
    echo -e "${CYAN}$SCRIPT_INDEX Testing original composer binary...${NC}"
    if COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 "$PHP_BINARY" -d open_basedir= "${COMPOSER_TARGET_PATH}.original" --version >/dev/null 2>&1; then
        echo -e "${GREEN}$SCRIPT_INDEX âœ?Original composer binary: OK${NC}"
    else
        echo -e "${RED}$SCRIPT_INDEX âœ?Original composer binary: FAILED${NC}"
        all_checks_passed=false
    fi

    # Check for deprecation warnings
    echo -e "${CYAN}$SCRIPT_INDEX Checking for deprecation warnings...${NC}"
    if check_composer_errors; then
        echo -e "${GREEN}$SCRIPT_INDEX âœ?No deprecation warnings detected${NC}"
    else
        echo -e "${YELLOW}$SCRIPT_INDEX ! Deprecation warnings present (may need newer Composer version)${NC}"
    fi

    if [ "$all_checks_passed" = false ]; then
        echo -e "${RED}$SCRIPT_INDEX [FAIL] Some verification checks failed${NC}"
        exit 1
    fi

    # Store PHP version for future correction checks
    store_php_version

    # Final verification with environment variables
    local final_version=$(get_composer_version)
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX âœ“âœ“âœ?INSTALLATION SUCCESSFUL âœ“âœ“âœ?{NC}"
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX âœ?Composer Version: $final_version${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX âœ?PHP Version: $(get_current_php_version)${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX âœ?Main wrapper: $COMPOSER_TARGET_PATH${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX âœ?Safe wrapper: /usr/local/bin/composer-safe${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX âœ?Original binary: ${COMPOSER_TARGET_PATH}.original${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX âœ?PHP tracking file: $PHP_VERSION_TRACK_FILE${NC}"
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX Usage:${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX   composer --version         (auto-handles root + open_basedir)${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX   composer-safe --version    (explicit safe wrapper)${NC}"
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${YELLOW}$SCRIPT_INDEX Features:${NC}"
    echo -e "${YELLOW}$SCRIPT_INDEX   â€?Automatic root warning suppression${NC}"
    echo -e "${YELLOW}$SCRIPT_INDEX   â€?open_basedir=none for maximum compatibility${NC}"
    echo -e "${YELLOW}$SCRIPT_INDEX   â€?PHP version tracking for auto-correction${NC}"
    echo -e "${YELLOW}$SCRIPT_INDEX   â€?Automatic reinstall on version/error detection${NC}"
    echo -e "${CYAN}============================================================================${NC}"
}

# Execute main function
main "$@"
