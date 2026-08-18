#!/bin/bash
# Script: 94_install_composer.sh
# Description: Dedicated Composer installation with fine-grained PHP 8.5 dependency repair
# Author: System Administrator
# Version: 3.0

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_INDEX="[94_COMPOSER]"

# Source dependencies
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
LINUX_PATH_FUNCTION="$PARENT_DIR_LEVEL_2/common/linux_path_function.sh"
LARAVEL_INSTALLER_PACKAGE="laravel/installer"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Source PHP common variables and functions
source "$PARENT_DIR_LEVEL_1/debian_com/php_common_vars.sh"
source "$PARENT_DIR_LEVEL_1/debian_com/php_common_functions.sh"

# Configuration - using variables from php_common_vars.sh
PHP_BINARY="$TARGET_LINK_PATH"
COMPOSER_PATH_DIR="$(dirname "$COMPOSER_TARGET_PATH")"

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

# Get Composer version from original binary
get_composer_version() {
    if [ -f "${COMPOSER_TARGET_PATH}.original" ] && [ -x "${COMPOSER_TARGET_PATH}.original" ]; then
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
        echo "false"
        return
    fi

    local IFS=.
    local ver1=($version1)
    local ver2=($version2)

    for ((i=0; i<3; i++)); do
        local num1=${ver1[i]:-0}
        local num2=${ver2[i]:-0}

        if ((num1 > num2)); then
            echo "true"
            return
        elif ((num1 < num2)); then
            echo "false"
            return
        fi
    done

    echo "true"
}

# Check if Composer has deprecation warnings (indicates old version)
check_composer_errors() {
    local test_output
    test_output=$(COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 "$PHP_BINARY" -d open_basedir= "${COMPOSER_TARGET_PATH}.original" --version 2>&1)

    if echo "$test_output" | grep -qi "deprecated\|warning\|error"; then
        echo "true"
    else
        echo "false"
    fi
}

# Get current PHP version
get_current_php_version() {
    if [ -x "$PHP_BINARY" ]; then
        "$PHP_BINARY" -v 2>/dev/null | grep -oP 'PHP \K[0-9]+\.[0-9]+\.[0-9]+' | head -n1 || echo "unknown"
    else
        echo "not_found"
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

write_composer_safe_wrapper() {
    echo -e "${CYAN}$SCRIPT_INDEX Repairing composer-safe wrapper...${NC}"
    $USE_SUDO tee "$COMPOSER_SAFE_PATH" > /dev/null << 'EOF'
#!/bin/bash
# Global Composer wrapper that handles root warnings and open_basedir restrictions
# Usage: composer-safe [composer-arguments]

export COMPOSER_ALLOW_SUPERUSER=1
export COMPOSER_NO_INTERACTION=1

exec /usr/local/bin/php -d "open_basedir=none" /usr/local/bin/composer.original "$@"
EOF
    $USE_SUDO chmod +x "$COMPOSER_SAFE_PATH"
}

write_composer_main_wrapper() {
    echo -e "${CYAN}$SCRIPT_INDEX Repairing Composer wrapper...${NC}"
    $USE_SUDO tee "$COMPOSER_TARGET_PATH" > /dev/null << 'EOF'
#!/bin/bash
# Composer wrapper with automatic environment handling

if [ "$EUID" -eq 0 ]; then
    export COMPOSER_ALLOW_SUPERUSER=1
    export COMPOSER_NO_INTERACTION=1
fi

exec /usr/local/bin/php -d "open_basedir=none" /usr/local/bin/composer.original "$@"
EOF
    $USE_SUDO chmod +x "$COMPOSER_TARGET_PATH"
}

repair_composer_wrappers() {
    if [ ! -f "$COMPOSER_TARGET_PATH" ] || [ ! -x "$COMPOSER_TARGET_PATH" ]; then
        write_composer_main_wrapper
        if [ ! -f "$COMPOSER_TARGET_PATH" ] || [ ! -x "$COMPOSER_TARGET_PATH" ]; then
            echo -e "${RED}$SCRIPT_INDEX Composer wrapper is unavailable after repair${NC}"
        fi
    else
        echo -e "${GREEN}$SCRIPT_INDEX Composer wrapper is already ready${NC}"
    fi

    if [ ! -f "$COMPOSER_SAFE_PATH" ] || [ ! -x "$COMPOSER_SAFE_PATH" ]; then
        write_composer_safe_wrapper
        if [ ! -f "$COMPOSER_SAFE_PATH" ] || [ ! -x "$COMPOSER_SAFE_PATH" ]; then
            echo -e "${RED}$SCRIPT_INDEX composer-safe wrapper is unavailable after repair${NC}"
        fi
    else
        echo -e "${GREEN}$SCRIPT_INDEX composer-safe wrapper is already ready${NC}"
    fi
}

repair_composer_path() {
    echo -e "${CYAN}$SCRIPT_INDEX Ensuring Composer is in PATH...${NC}"
    bash "$LINUX_PATH_FUNCTION" addpath "$COMPOSER_PATH_DIR" || true
    echo -e "${GREEN}$SCRIPT_INDEX Composer PATH repair completed: $COMPOSER_PATH_DIR${NC}"
}

install_laravel_installer() {
    local composer_bin_dir=""
    local composer_home="${COMPOSER_HOME:-}"
    local laravel_binary=""
    local update_stamp=""
    local current_week=""

    if command -v git >/dev/null 2>&1; then
        $USE_SUDO git config --global --add safe.directory '*' 2>/dev/null || true
    fi

    composer_bin_dir="$(COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 "$COMPOSER_TARGET_PATH" global config bin-dir --absolute --no-ansi 2>/dev/null | awk '/^\// { path=$0 } END { print path }')"
    if [ -z "$composer_bin_dir" ]; then
        if [ -z "$composer_home" ]; then
            composer_home="$HOME/.config/composer"
        fi
        composer_bin_dir="$composer_home/vendor/bin"
    fi
    laravel_binary="$composer_bin_dir/laravel"

    if [ ! -x "$laravel_binary" ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX Installing Laravel Installer (latest, Laravel 13 capable)...${NC}"
        COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 "$COMPOSER_TARGET_PATH" global require "$LARAVEL_INSTALLER_PACKAGE" --no-interaction || true
    else
        echo -e "${GREEN}$SCRIPT_INDEX Laravel Installer is already installed${NC}"
    fi

    # Idempotent weekly refresh: keeps the global installer on the latest
    # release (the one that scaffolds Laravel 13). The stamp file makes the
    # update run at most once per week instead of hitting the network on every
    # invocation.
    update_stamp="/usr/local/etc/.laravel_installer_update_stamp"
    current_week="$(date +%G-W%V)"
    if [ -x "$laravel_binary" ] && [ "$(cat "$update_stamp" 2>/dev/null)" != "$current_week" ]; then
        echo -e "${CYAN}$SCRIPT_INDEX Refreshing Laravel Installer (weekly, idempotent)...${NC}"
        if COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 "$COMPOSER_TARGET_PATH" global update "$LARAVEL_INSTALLER_PACKAGE" --no-interaction; then
            echo "$current_week" | $USE_SUDO tee "$update_stamp" > /dev/null
        else
            echo -e "${YELLOW}$SCRIPT_INDEX Laravel Installer update failed; keeping the installed version${NC}"
        fi
    fi

    if [ ! -x "$laravel_binary" ]; then
        echo -e "${RED}$SCRIPT_INDEX Laravel Installer binary is unavailable after installation${NC}"
        return
    fi

    echo -e "${CYAN}$SCRIPT_INDEX Ensuring Laravel Installer is in PATH...${NC}"
    bash "$LINUX_PATH_FUNCTION" addpath "$composer_bin_dir" || true
    echo -e "${GREEN}$SCRIPT_INDEX Laravel Installer PATH repair completed: $composer_bin_dir${NC}"
}

# Check command line arguments
FORCE_REINSTALL=false
if [ "$1" = "--force" ] || [ "$1" = "-f" ]; then
    FORCE_REINSTALL=true
    echo -e "${YELLOW}$SCRIPT_INDEX Force reinstall requested${NC}"
elif [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX Composer Installation Script for PHP 8.5 (Server Edition)${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX Version: 3.0 - Fine-Grained Repair${NC}"
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}Usage: $0 [options]${NC}"
    echo -e "${CYAN}${NC}"
    echo -e "${CYAN}Options:${NC}"
    echo -e "${CYAN}  --force, -f    Force reinstall the Composer core binary${NC}"
    echo -e "${CYAN}  --help, -h     Show this help message${NC}"
    echo -e "${CYAN}${NC}"
    echo -e "${CYAN}This script will:${NC}"
    echo -e "${CYAN}  1. Install the Composer core binary only when missing or forced${NC}"
    echo -e "${CYAN}  2. Repair each missing Composer wrapper independently${NC}"
    echo -e "${CYAN}  3. Repair Composer and Laravel PATH entries independently${NC}"
    echo -e "${CYAN}  4. Install Laravel Installer when missing and refresh it weekly (Laravel 13 capable)${NC}"
    echo -e "${CYAN}${NC}"
    echo -e "${CYAN}Fine-Grained Repair Features:${NC}"
    echo -e "${CYAN}  - Composer core binary existence check${NC}"
    echo -e "${CYAN}  - Independent main and safe wrapper repair${NC}"
    echo -e "${CYAN}  - Independent Composer PATH repair${NC}"
    echo -e "${CYAN}  - Independent Laravel binary and PATH repair${NC}"
    echo -e "${CYAN}${NC}"
    echo -e "${CYAN}Created files:${NC}"
    echo -e "${CYAN}  /usr/local/bin/composer            (main wrapper)${NC}"
    echo -e "${CYAN}  $COMPOSER_SAFE_PATH       (explicit safe wrapper)${NC}"
    echo -e "${CYAN}  /usr/local/bin/composer.original   (original Composer binary)${NC}"
    echo -e "${CYAN}  /usr/local/etc/.composer_php_version (PHP version tracking)${NC}"
    echo -e "${CYAN}${NC}"
    echo -e "${CYAN}Server-Optimized Features:${NC}"
    echo -e "${CYAN}  �?Automatic retry on download failures${NC}"
    echo -e "${CYAN}  �?Non-interactive mode by default${NC}"
    echo -e "${CYAN}  �?Root user handling without prompts${NC}"
    echo -e "${CYAN}  �?Comprehensive error detection${NC}"
    echo -e "${CYAN}============================================================================${NC}"
    exit 0
fi

# Simple installation check
main() {
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX Composer Installation for PHP 8.5 (Server Edition)${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX Version: 3.0 - Fine-Grained Repair${NC}"
    echo -e "${CYAN}============================================================================${NC}"

    # Check PHP 8.5 availability
    if [ ! -x "$PHP_BINARY" ]; then
        echo -e "${RED}$SCRIPT_INDEX PHP ${PHP_VERSION} not found at $PHP_BINARY${NC}"
        echo -e "${YELLOW}$SCRIPT_INDEX Please run 43_ensure_php85_intelligent.sh first${NC}"
        return
    fi

    if ! "$PHP_BINARY" --version | grep -q "PHP ${PHP_VERSION}"; then
        echo -e "${RED}$SCRIPT_INDEX $PHP_BINARY is not PHP ${PHP_VERSION}${NC}"
        return
    fi

    local php_version=$(get_current_php_version)
    echo -e "${GREEN}$SCRIPT_INDEX PHP $php_version confirmed at $PHP_BINARY${NC}"

    # Independent Composer core-binary check
    local current_version=$(get_composer_version)
    local auto_fix_needed=false

    if [ "$FORCE_REINSTALL" = true ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX [FORCE MODE] Force reinstall requested${NC}"
        auto_fix_needed=true
    elif [ -f "${COMPOSER_TARGET_PATH}.original" ] && [ -x "${COMPOSER_TARGET_PATH}.original" ]; then
        echo -e "${GREEN}$SCRIPT_INDEX Composer core binary is already present (version: $current_version)${NC}"
        echo -e "${GREEN}$SCRIPT_INDEX �?Original: ${COMPOSER_TARGET_PATH}.original${NC}"
        echo -e "${GREEN}$SCRIPT_INDEX �?PHP version tracking: $php_version${NC}"
        repair_composer_wrappers
        repair_composer_path
        install_laravel_installer
        return
    else
        echo -e "${YELLOW}$SCRIPT_INDEX Composer core binary is missing or broken, proceeding with installation${NC}"
        auto_fix_needed=true
    fi

    if [ "$auto_fix_needed" = false ]; then
        return
    fi

    # Show environment configuration
    if [ "$EUID" -eq 0 ]; then
        echo -e "${CYAN}$SCRIPT_INDEX Root user detected - Composer warnings will be automatically handled${NC}"
        echo -e "${CYAN}$SCRIPT_INDEX Environment: COMPOSER_ALLOW_SUPERUSER=1, COMPOSER_NO_INTERACTION=1${NC}"
    else
        echo -e "${CYAN}$SCRIPT_INDEX Non-interactive mode enabled: COMPOSER_NO_INTERACTION=1${NC}"
    fi

    # Download and install the Composer core binary only
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
            echo -e "${GREEN}$SCRIPT_INDEX �?Download successful${NC}"
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
        return
    fi

    # Verify the installer's authenticity BEFORE executing it as root (it runs below with
    # open_basedir=none). Composer publishes the expected SHA-384 of composer-setup.php at
    # https://composer.github.io/installer.sig; a mismatch means a corrupted or tampered
    # download (TLS-MITM, CDN/DNS compromise) -- refuse to run it. Mirrors the SHA256
    # verification ensure_php_compat_libs_from_apt_repository_manager applies to .debs.
    local expected_sig actual_sig
    expected_sig="$(curl -fsSL https://composer.github.io/installer.sig 2>/dev/null | tr -d '[:space:]')"
    actual_sig="$("$PHP_BINARY" -r "echo hash_file('sha384', 'composer-setup.php');" 2>/dev/null)"
    if [ -z "$expected_sig" ]; then
        echo -e "${RED}$SCRIPT_INDEX Could not fetch the Composer installer signature; refusing to run an unverified installer as root${NC}"
        cd "$original_dir"; rm -rf "$temp_dir"; return
    fi
    if [ "$expected_sig" != "$actual_sig" ]; then
        echo -e "${RED}$SCRIPT_INDEX Composer installer SHA-384 mismatch (expected ${expected_sig:0:16}..., got ${actual_sig:0:16}...); aborting${NC}"
        cd "$original_dir"; rm -rf "$temp_dir"; return
    fi
    echo -e "${GREEN}$SCRIPT_INDEX Composer installer SHA-384 verified${NC}"

    # Install with open_basedir disabled and environment variables set
    echo -e "${CYAN}$SCRIPT_INDEX Installing Composer with PHP 8.5 compatibility...${NC}"
    local install_output
    install_output=$($USE_SUDO COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 "$PHP_BINARY" -d "open_basedir=none" composer-setup.php --install-dir="$COMPOSER_PATH_DIR" --filename=composer.original 2>&1)
    local install_status=$?

    if [ $install_status -eq 0 ]; then
        echo -e "${GREEN}$SCRIPT_INDEX �?Composer installed successfully${NC}"

        # Show installed version
        local installed_version=$($USE_SUDO COMPOSER_ALLOW_SUPERUSER=1 "$PHP_BINARY" -d "open_basedir=none" "${COMPOSER_TARGET_PATH}.original" --version 2>/dev/null | grep -oP 'Composer version \K[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
        echo -e "${GREEN}$SCRIPT_INDEX �?Installed version: $installed_version${NC}"

        if ! version_compare "$installed_version" "$MIN_COMPOSER_VERSION"; then
            echo -e "${RED}$SCRIPT_INDEX WARNING: Installed version $installed_version may be too old for PHP 8.5${NC}"
            echo -e "${YELLOW}$SCRIPT_INDEX Minimum recommended: $MIN_COMPOSER_VERSION${NC}"
        fi
    else
        echo -e "${RED}$SCRIPT_INDEX Composer installation failed${NC}"
        echo -e "${RED}$SCRIPT_INDEX Error output:${NC}"
        echo "$install_output"
        cd "$original_dir"
        rm -rf "$temp_dir"
        return
    fi

    # Make executable
    $USE_SUDO chmod +x "${COMPOSER_TARGET_PATH}.original"

    # Clean up temp directory
    cd "$original_dir"
    rm -rf "$temp_dir"

    repair_composer_wrappers

    # Verify all wrappers are working correctly
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX [VERIFICATION] Testing all components...${NC}"
    echo -e "${CYAN}============================================================================${NC}"

    local all_checks_passed=true

    # Test main composer wrapper
    echo -e "${CYAN}$SCRIPT_INDEX Testing main composer wrapper...${NC}"
    if COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 "$COMPOSER_TARGET_PATH" --version >/dev/null 2>&1; then
        echo -e "${GREEN}$SCRIPT_INDEX �?Main composer wrapper: OK${NC}"
    else
        echo -e "${RED}$SCRIPT_INDEX �?Main composer wrapper: FAILED${NC}"
        all_checks_passed=false
    fi

    # Test composer-safe wrapper
    echo -e "${CYAN}$SCRIPT_INDEX Testing composer-safe wrapper...${NC}"
    if COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 "$COMPOSER_SAFE_PATH" --version >/dev/null 2>&1; then
        echo -e "${GREEN}$SCRIPT_INDEX �?Composer-safe wrapper: OK${NC}"
    else
        echo -e "${RED}$SCRIPT_INDEX �?Composer-safe wrapper: FAILED${NC}"
        all_checks_passed=false
    fi

    # Test original composer binary
    echo -e "${CYAN}$SCRIPT_INDEX Testing original composer binary...${NC}"
    if COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1 "$PHP_BINARY" -d open_basedir= "${COMPOSER_TARGET_PATH}.original" --version >/dev/null 2>&1; then
        echo -e "${GREEN}$SCRIPT_INDEX �?Original composer binary: OK${NC}"
    else
        echo -e "${RED}$SCRIPT_INDEX �?Original composer binary: FAILED${NC}"
        all_checks_passed=false
    fi

    # Check for deprecation warnings
    echo -e "${CYAN}$SCRIPT_INDEX Checking for deprecation warnings...${NC}"
    if check_composer_errors; then
        echo -e "${GREEN}$SCRIPT_INDEX �?No deprecation warnings detected${NC}"
    else
        echo -e "${YELLOW}$SCRIPT_INDEX ! Deprecation warnings present (may need newer Composer version)${NC}"
    fi

    if [ "$all_checks_passed" = false ]; then
        echo -e "${RED}$SCRIPT_INDEX [FAIL] Some verification checks failed${NC}"
        return
    fi

    # Store PHP version metadata
    store_php_version

    repair_composer_path
    install_laravel_installer

    # Final verification with environment variables
    local final_version=$(get_composer_version)
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX ✓✓�?INSTALLATION SUCCESSFUL ✓✓�?{NC}"
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX �?Composer Version: $final_version${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX �?PHP Version: $(get_current_php_version)${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX �?Main wrapper: $COMPOSER_TARGET_PATH${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX �?Safe wrapper: $COMPOSER_SAFE_PATH${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX �?Original binary: ${COMPOSER_TARGET_PATH}.original${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX �?PHP tracking file: $PHP_VERSION_TRACK_FILE${NC}"
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX Usage:${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX   composer --version         (auto-handles root + open_basedir)${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX   composer-safe --version    (explicit safe wrapper)${NC}"
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${YELLOW}$SCRIPT_INDEX Features:${NC}"
    echo -e "${YELLOW}$SCRIPT_INDEX   �?Automatic root warning suppression${NC}"
    echo -e "${YELLOW}$SCRIPT_INDEX   �?open_basedir=none for maximum compatibility${NC}"
    echo -e "${YELLOW}$SCRIPT_INDEX   - Fine-grained binary and PATH repair${NC}"
    echo -e "${CYAN}============================================================================${NC}"
}

# Execute main function
# PHP-runtime plane gate (DESIGN_20260817_2115 PART_0 §0.7): Composer is
# installed against the ACTIVE plane's PHP CLI. Both planes expose it at
# the same path (/usr/local/bin/php): the system plane's alternatives link
# (apt PHP 8.5) or the frankenphp plane's php-cli shim (embedded PHP) - so
# the installer below stays plane-agnostic. The shim is ensured here
# because this step may run before 32 on a fresh plane.
# shellcheck source=/dev/null
source "$PARENT_DIR_LEVEL_2/common/octane_service_manager.sh"
# shellcheck source=/dev/null
source "$PARENT_DIR_LEVEL_2/common/frankenphp_manager.sh"
if [ "$(php_runtime_plane)" = "frankenphp" ]; then
    echo -e "${CYAN}$SCRIPT_INDEX PHP runtime plane: frankenphp (composer targets the embedded PHP CLI shim)${NC}"
    fm_ensure_php_cli_shim
fi

main "$@"
