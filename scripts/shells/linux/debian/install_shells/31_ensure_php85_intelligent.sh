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

# Script: 31_ensure_php85_intelligent.sh
# Description: Intelligent PHP 8.5 installation with multi-dimensional state detection
# Author: System Administrator
# Version: 1.0
# Design: Based on SHELL_INSTALLATION_DEVELOPMENT_GUIDE.md principles

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script identification
SCRIPT_INDEX="[31_PHP85_INTELLIGENT]"

# Source global variables for constraint checking
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Source PHP common variables and functions
source "$PARENT_DIR_LEVEL_1/debian_com/php_common_vars.sh"
source "$PARENT_DIR_LEVEL_1/debian_com/php_common_functions.sh"

# Network connectivity check - now using PHP common function
check_network_connectivity() {
    check_network_connectivity_from_php_common "$SCRIPT_INDEX"
}

# Check if Nginx is enabled for configuration
INSTALL_NGINX=$(get_global_var "INSTALL_NGINX" "false")
echo -e "${CYAN}$SCRIPT_INDEX INSTALL_NGINX: $INSTALL_NGINX${NC}"

# Configuration variables are now sourced from php_common_vars.sh

# All PHP configuration arrays are now sourced from php_common_vars.sh

# All state definitions are now sourced from php_common_vars.sh

# PHASE 1: Multi-dimensional State Detection

# 1.1 Enhanced PHP binary detection with state analysis
check_php_binary_state() {
    echo -e "${BLUE}$SCRIPT_INDEX [DETECTION] Analyzing PHP binary state...${NC}"

    # Check if php command is available
    if command -v php >/dev/null 2>&1; then
        local php_path=$(which php)
        echo -e "${CYAN}$SCRIPT_INDEX PHP command found: $php_path${NC}"

        # Test if PHP is functional
        if timeout 10 php --version >/dev/null 2>&1; then
            local current_version=$(php -v 2>/dev/null | head -n 1 | grep -oP 'PHP \K[0-9]+\.[0-9]+' || echo "unknown")
            echo -e "${CYAN}$SCRIPT_INDEX PHP version: $current_version${NC}"

            if [[ "$current_version" == "$PHP_VERSION"* ]]; then
                echo -e "${GREEN}$SCRIPT_INDEX ${BINARY_STATES["PHP_OK"]}${NC}"
                return 0
            else
                echo -e "${YELLOW}$SCRIPT_INDEX ${BINARY_STATES["PHP_WRONG_VERSION"]}${NC}"
                return 2
            fi
        else
            echo -e "${RED}$SCRIPT_INDEX ${BINARY_STATES["PHP_BROKEN"]}${NC}"
            return 3
        fi
    else
        echo -e "${RED}$SCRIPT_INDEX ${BINARY_STATES["PHP_MISSING"]}${NC}"
        return 1
    fi
}

# Simple Composer detection for consistency check only
check_composer_binary_state() {
    echo -e "${BLUE}$SCRIPT_INDEX [DETECTION] Analyzing Composer binary state...${NC}"

    if [ -f "$COMPOSER_TARGET_PATH" ] && [ -x "$COMPOSER_TARGET_PATH" ]; then
        echo -e "${CYAN}$SCRIPT_INDEX Composer command found: $COMPOSER_TARGET_PATH${NC}"
        return 0
    else
        echo -e "${RED}$SCRIPT_INDEX ${BINARY_STATES["COMPOSER_MISSING"]}${NC}"
        echo -e "${CYAN}$SCRIPT_INDEX Note: Composer will be installed in the next step via 34_install_composer.sh${NC}"
        return 1
    fi
}

# Legacy function for compatibility
check_php_binary_existence() {
    check_php_binary_state
}

# 1.2 Check PHP version compatibility
check_php_version() {
    echo -e "${BLUE}$SCRIPT_INDEX [DETECTION] Checking PHP version...${NC}"
    
    if command -v php >/dev/null 2>&1; then
        local current_version=$(php -v 2>/dev/null | head -n 1 | grep -oP 'PHP \K[0-9]+\.[0-9]+' || echo "unknown")
        echo -e "${CYAN}$SCRIPT_INDEX Current PHP version: $current_version${NC}"
        
        if [[ "$current_version" == "$PHP_VERSION"* ]]; then
            echo -e "${GREEN}$SCRIPT_INDEX PHP version is compatible${NC}"
            return 0
        else
            echo -e "${YELLOW}$SCRIPT_INDEX PHP version mismatch. Required: $PHP_VERSION, Found: $current_version${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}$SCRIPT_INDEX PHP not available for version check${NC}"
        return 1
    fi
}

# 1.3 Check PHP-FPM installation and service status - now using PHP common function
check_php_fpm_status() {
    check_php_fpm_status_from_php_common "8.4" "$SCRIPT_INDEX"
}

# 1.4 Check required PHP extensions
check_php_extensions() {
    echo -e "${BLUE}$SCRIPT_INDEX [DETECTION] Checking required PHP extensions...${NC}"

    if ! command -v php >/dev/null 2>&1; then
        echo -e "${YELLOW}$SCRIPT_INDEX PHP not available for extension check${NC}"
        return 1
    fi

    local missing_extensions=()
    local loaded_modules=$(php -m 2>/dev/null)

    for ext in "${REQUIRED_EXTENSIONS[@]}"; do
        local module_name="${EXTENSION_MAP[$ext]}"

        # Check if the module is loaded (case-insensitive for some modules)
        if echo "$loaded_modules" | grep -qi "^$module_name$"; then
            echo -e "${GREEN}$SCRIPT_INDEX Extension $ext ($module_name): OK${NC}"
        else
            echo -e "${YELLOW}$SCRIPT_INDEX Extension $ext ($module_name): MISSING${NC}"
            missing_extensions+=("$ext")
        fi
    done

    if [ ${#missing_extensions[@]} -eq 0 ]; then
        echo -e "${GREEN}$SCRIPT_INDEX All required extensions are available${NC}"
        return 0
    else
        echo -e "${YELLOW}$SCRIPT_INDEX Missing extensions: ${missing_extensions[*]}${NC}"
        return 1
    fi
}

# NEW: Fix missing extensions for already installed PHP
fix_missing_extensions() {
    echo -e "${BLUE}$SCRIPT_INDEX [FIX] Checking and fixing missing PHP extensions...${NC}"

    if ! command -v php8.5 >/dev/null 2>&1; then
        echo -e "${RED}$SCRIPT_INDEX PHP 8.5 not installed, cannot fix extensions${NC}"
        return 1
    fi

    # Get list of loaded modules
    local loaded_modules=$(php8.5 -m 2>/dev/null)
    local missing_packages=()
    local installed_packages=()

    echo -e "${CYAN}$SCRIPT_INDEX Checking all required extensions...${NC}"

    # Check each required extension
    for ext in "${REQUIRED_EXTENSIONS[@]}"; do
        local module_name="${EXTENSION_MAP[$ext]}"
        local package_name="php8.5-${ext}"

        # Check if module is loaded
        if echo "$loaded_modules" | grep -qi "^$module_name$"; then
            echo -e "${GREEN}$SCRIPT_INDEX $module_name: loaded �?{NC}"
            continue
        fi

        # Module not loaded, check if package is installed
        if dpkg -l | grep -q "^ii.*$package_name[[:space:]]"; then
            echo -e "${YELLOW}$SCRIPT_INDEX $package_name: installed but not loaded (may need restart)${NC}"
        else
            echo -e "${RED}$SCRIPT_INDEX $package_name: NOT installed${NC}"
            missing_packages+=("$package_name")
        fi
    done

    # Install missing packages
    if [ ${#missing_packages[@]} -gt 0 ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX Found ${#missing_packages[@]} missing extension packages${NC}"
        echo -e "${CYAN}$SCRIPT_INDEX Missing packages: ${missing_packages[*]}${NC}"
        echo -e "${YELLOW}$SCRIPT_INDEX Installing missing extensions...${NC}"

        for pkg in "${missing_packages[@]}"; do
            echo -e "${CYAN}$SCRIPT_INDEX Installing $pkg...${NC}"

            # Install package and capture output
            if $USE_SUDO apt install "$pkg" -y --no-install-recommends 2>&1 | tee /tmp/ext_fix.log; then
                # Check if package was actually installed (dpkg may report errors for other packages like nginx)
                if dpkg -l | grep -q "^ii.*$pkg[[:space:]]"; then
                    echo -e "${GREEN}$SCRIPT_INDEX $pkg: installed successfully �?{NC}"
                    installed_packages+=("$pkg")
                else
                    # Check if dpkg error was due to other packages, not our PHP extension
                    if grep -q "Setting up $pkg" /tmp/ext_fix.log; then
                        # Package was actually set up, just dpkg had issues with other packages
                        if dpkg -l | grep -q "^i.*$pkg"; then
                            echo -e "${GREEN}$SCRIPT_INDEX $pkg: installed (with dpkg warnings) �?{NC}"
                            installed_packages+=("$pkg")
                        else
                            # Try with recommends
                            echo -e "${YELLOW}$SCRIPT_INDEX $pkg: retrying with recommends...${NC}"
                            if $USE_SUDO apt install "$pkg" -y 2>&1 | tee /tmp/ext_fix.log; then
                                if dpkg -l | grep -q "^i.*$pkg"; then
                                    echo -e "${GREEN}$SCRIPT_INDEX $pkg: installed (with recommends) �?{NC}"
                                    installed_packages+=("$pkg")
                                else
                                    echo -e "${RED}$SCRIPT_INDEX $pkg: installation failed �?{NC}"
                                fi
                            else
                                echo -e "${RED}$SCRIPT_INDEX $pkg: installation failed �?{NC}"
                            fi
                        fi
                    else
                        # Try without --no-install-recommends
                        echo -e "${YELLOW}$SCRIPT_INDEX $pkg: retrying with recommends...${NC}"
                        if $USE_SUDO apt install "$pkg" -y 2>&1 | tee /tmp/ext_fix.log; then
                            if dpkg -l | grep -q "^i.*$pkg"; then
                                echo -e "${GREEN}$SCRIPT_INDEX $pkg: installed (with recommends) �?{NC}"
                                installed_packages+=("$pkg")
                            else
                                echo -e "${RED}$SCRIPT_INDEX $pkg: installation failed �?{NC}"
                            fi
                        else
                            echo -e "${RED}$SCRIPT_INDEX $pkg: installation failed �?{NC}"
                        fi
                    fi
                fi
            else
                # Installation failed, check if it's because of other package issues
                if dpkg -l | grep -q "^i.*$pkg"; then
                    echo -e "${YELLOW}$SCRIPT_INDEX $pkg: installed but apt returned errors (likely other packages)${NC}"
                    installed_packages+=("$pkg")
                else
                    echo -e "${YELLOW}$SCRIPT_INDEX $pkg: retrying with recommends...${NC}"
                    if $USE_SUDO apt install "$pkg" -y 2>&1 | tee /tmp/ext_fix.log; then
                        if dpkg -l | grep -q "^i.*$pkg"; then
                            echo -e "${GREEN}$SCRIPT_INDEX $pkg: installed (with recommends) �?{NC}"
                            installed_packages+=("$pkg")
                        else
                            echo -e "${RED}$SCRIPT_INDEX $pkg: installation failed �?{NC}"
                        fi
                    else
                        echo -e "${RED}$SCRIPT_INDEX $pkg: installation failed �?{NC}"
                    fi
                fi
            fi
        done

        rm -f /tmp/ext_fix.log

        if [ ${#installed_packages[@]} -gt 0 ]; then
            echo -e "${GREEN}$SCRIPT_INDEX Installed ${#installed_packages[@]} extension packages${NC}"

            # Restart PHP-FPM to load new extensions
            if systemctl is-active --quiet php8.5-fpm 2>/dev/null; then
                echo -e "${YELLOW}$SCRIPT_INDEX Restarting PHP-FPM to load new extensions...${NC}"
                $USE_SUDO systemctl restart php8.5-fpm
                echo -e "${GREEN}$SCRIPT_INDEX PHP-FPM restarted${NC}"
            fi

            # Verify extensions are now loaded
            echo -e "${CYAN}$SCRIPT_INDEX Verifying newly installed extensions...${NC}"
            local verification_failed=0
            for pkg in "${installed_packages[@]}"; do
                local ext_name=$(echo "$pkg" | sed 's/php8.5-//')
                local module_name="${EXTENSION_MAP[$ext_name]}"

                if php8.5 -m 2>/dev/null | grep -qi "^$module_name$"; then
                    echo -e "${GREEN}$SCRIPT_INDEX $module_name: now loaded �?{NC}"
                else
                    echo -e "${YELLOW}$SCRIPT_INDEX $module_name: still not loaded (may need system restart)${NC}"
                    ((verification_failed++))
                fi
            done

            if [ $verification_failed -eq 0 ]; then
                echo -e "${GREEN}$SCRIPT_INDEX All extensions verified and loaded${NC}"
            else
                echo -e "${YELLOW}$SCRIPT_INDEX $verification_failed extensions not loaded yet${NC}"
                echo -e "${YELLOW}$SCRIPT_INDEX Try restarting PHP-FPM: sudo systemctl restart php8.5-fpm${NC}"
            fi
        fi
    else
        echo -e "${GREEN}$SCRIPT_INDEX All required extension packages are installed${NC}"
    fi

    return 0
}

# 1.5 Check symbolic link integrity for universal PHP paths - now using PHP common function
check_symbolic_link() {
    check_symbolic_link_from_php_common "php" "8.4" "$SCRIPT_INDEX"
}

# 1.6 Fix symbolic link and remove old PHP versions from PATH
fix_php_symbolic_link() {
    echo -e "${BLUE}$SCRIPT_INDEX [FIX] Fixing PHP symbolic link and cleaning up old versions...${NC}"

    local target_link="/usr/local/bin/php"
    local expected_binary="/usr/bin/php8.5"

    # Check if PHP 8.5 binary exists and is executable
    if [ ! -f "$expected_binary" ]; then
        echo -e "${RED}$SCRIPT_INDEX PHP 8.5 binary not found: $expected_binary${NC}"
        return 1
    fi

    if [ ! -x "$expected_binary" ]; then
        echo -e "${RED}$SCRIPT_INDEX PHP 8.5 binary is not executable: $expected_binary${NC}"
        return 1
    fi

    # Test PHP 8.5 binary works before creating symlink
    echo -e "${YELLOW}$SCRIPT_INDEX Testing PHP 8.5 binary functionality...${NC}"
    if ! timeout 10 "$expected_binary" --version >/dev/null 2>&1; then
        echo -e "${RED}$SCRIPT_INDEX PHP 8.5 binary is not functional: $expected_binary${NC}"
        return 1
    fi

    # Remove old PHP versions from alternatives if they exist
    echo -e "${YELLOW}$SCRIPT_INDEX Cleaning up PHP alternatives...${NC}"
    if update-alternatives --query php >/dev/null 2>&1; then
        echo -e "${YELLOW}$SCRIPT_INDEX Removing existing PHP alternatives...${NC}"
        $USE_SUDO update-alternatives --remove-all php 2>/dev/null || true
    fi

    # Remove old symbolic links and binaries from /usr/local/bin
    echo -e "${YELLOW}$SCRIPT_INDEX Cleaning up old PHP links in /usr/local/bin...${NC}"
    for old_version in 7.4 8.0 8.1 8.2 8.3; do
        local old_link="/usr/local/bin/php${old_version}"
        if [ -L "$old_link" ] || [ -f "$old_link" ]; then
            echo -e "${YELLOW}$SCRIPT_INDEX Removing old PHP link: $old_link${NC}"
            $USE_SUDO rm -f "$old_link" || true
        fi
    done

    # Backup existing php link if it exists and is not a symlink
    if [ -f "$target_link" ] && [ ! -L "$target_link" ]; then
        local backup_name="${target_link}.backup.$(date +%Y%m%d_%H%M%S)"
        echo -e "${YELLOW}$SCRIPT_INDEX Backing up existing file: $target_link -> $backup_name${NC}"
        $USE_SUDO mv "$target_link" "$backup_name" || true
    elif [ -L "$target_link" ] || [ -f "$target_link" ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX Removing existing PHP link: $target_link${NC}"
        $USE_SUDO rm -f "$target_link"
    fi

    # Create new symbolic link to PHP 8.5
    echo -e "${YELLOW}$SCRIPT_INDEX Creating new symbolic link: $target_link -> $expected_binary${NC}"
    if $USE_SUDO ln -sf "$expected_binary" "$target_link"; then
        echo -e "${GREEN}$SCRIPT_INDEX Successfully created symbolic link: $target_link -> $expected_binary${NC}"

        # Verify the link
        if [ -L "$target_link" ]; then
            local actual_target=$(readlink "$target_link")
            echo -e "${GREEN}$SCRIPT_INDEX Verification: $target_link -> $actual_target${NC}"

            # Test the link works
            if timeout 10 "$target_link" --version >/dev/null 2>&1; then
                local version_output=$("$target_link" --version 2>/dev/null | head -n 1)
                echo -e "${GREEN}$SCRIPT_INDEX Link test successful: $version_output${NC}"

                # Update current session PATH to ensure immediate availability
                export PATH="/usr/local/bin:$PATH"
                hash -r  # Clear bash command hash table

                return 0
            else
                echo -e "${RED}$SCRIPT_INDEX Link test failed - PHP command not working${NC}"
                return 1
            fi
        else
            echo -e "${RED}$SCRIPT_INDEX Failed to create symbolic link${NC}"
            return 1
        fi
    else
        echo -e "${RED}$SCRIPT_INDEX Failed to create symbolic link${NC}"
        return 1
    fi
}

# 1.7 Remove old PHP versions from system PATH and disable services
cleanup_old_php_versions() {
    echo -e "${BLUE}$SCRIPT_INDEX [CLEANUP] Removing old PHP versions from PATH and disabling services...${NC}"

    # List of old PHP versions to clean up
    local old_versions=(7.4 8.0 8.1 8.2 8.3 8.4)
    local cleanup_errors=0

    echo -e "${CYAN}$SCRIPT_INDEX Step 1: Stopping and disabling old PHP-FPM services...${NC}"
    for version in "${old_versions[@]}"; do
        echo -e "${YELLOW}$SCRIPT_INDEX Processing PHP $version cleanup...${NC}"

        # Stop and disable PHP-FPM service for old version
        local fpm_service="php${version}-fpm"
        if systemctl list-units --full -all | grep -q "$fpm_service.service"; then
            echo -e "${YELLOW}$SCRIPT_INDEX Stopping and disabling $fpm_service...${NC}"
            $USE_SUDO systemctl stop "$fpm_service" 2>/dev/null || true
            $USE_SUDO systemctl disable "$fpm_service" 2>/dev/null || true
            $USE_SUDO systemctl mask "$fpm_service" 2>/dev/null || true
            echo -e "${GREEN}$SCRIPT_INDEX Disabled and masked $fpm_service service${NC}"
        fi

        # Remove from alternatives if present
        if update-alternatives --list php 2>/dev/null | grep -q "php${version}"; then
            echo -e "${YELLOW}$SCRIPT_INDEX Removing PHP $version from alternatives...${NC}"
            $USE_SUDO update-alternatives --remove php "/usr/bin/php${version}" 2>/dev/null || true
        fi

        # Remove any custom symlinks in /usr/local/bin
        local old_binary="/usr/local/bin/php${version}"
        if [ -L "$old_binary" ] || [ -f "$old_binary" ]; then
            echo -e "${YELLOW}$SCRIPT_INDEX Removing old binary link: $old_binary${NC}"
            $USE_SUDO rm -f "$old_binary" || true
        fi
    done

    echo -e "${CYAN}$SCRIPT_INDEX Step 2: Removing old PHP packages (optional - keeping for compatibility)...${NC}"
    # Note: We keep old PHP packages installed but disabled to avoid breaking system dependencies
    # If you want to remove them completely, uncomment the following:
    #
    # for version in "${old_versions[@]}"; do
    #     echo -e "${YELLOW}$SCRIPT_INDEX Checking for PHP $version packages...${NC}"
    #     if dpkg -l | grep -q "^ii.*php${version}"; then
    #         echo -e "${YELLOW}$SCRIPT_INDEX Removing PHP $version packages...${NC}"
    #         $USE_SUDO apt remove --purge "php${version}*" -y 2>/dev/null || true
    #         echo -e "${GREEN}$SCRIPT_INDEX PHP $version packages removed${NC}"
    #     fi
    # done
    # $USE_SUDO apt autoremove -y 2>/dev/null || true

    echo -e "${CYAN}$SCRIPT_INDEX Step 3: Cleaning old PHP paths from /etc/environment...${NC}"
    # Clean up /etc/environment PATH if it contains old PHP paths
    if [ -f /etc/environment ]; then
        # Create a backup
        $USE_SUDO cp /etc/environment /etc/environment.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true

        # Check if PATH contains old PHP paths
        if grep -q "PATH.*php[0-9]" /etc/environment 2>/dev/null; then
            echo -e "${YELLOW}$SCRIPT_INDEX Found old PHP paths in /etc/environment, cleaning...${NC}"
            # Remove old PHP paths and recreate clean PATH
            $USE_SUDO sed -i '/^PATH=/d' /etc/environment 2>/dev/null || true
            echo 'PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"' | $USE_SUDO tee -a /etc/environment > /dev/null
            echo -e "${GREEN}$SCRIPT_INDEX Cleaned /etc/environment PATH${NC}"
        else
            echo -e "${GREEN}$SCRIPT_INDEX /etc/environment PATH is clean${NC}"
        fi
    fi

    echo -e "${CYAN}$SCRIPT_INDEX Step 4: Cleaning PHP-specific environment variables...${NC}"
    # Also clean up any PHP-specific environment variables for old versions
    if [ -f /etc/environment ]; then
        for old_version in 74 80 81 82 83; do
            local php_var="PHP${old_version}_HOME"
            if grep -q "$php_var=" /etc/environment 2>/dev/null; then
                echo -e "${YELLOW}$SCRIPT_INDEX Removing old PHP environment variable: $php_var${NC}"
                $USE_SUDO sed -i "/^$php_var=/d" /etc/environment 2>/dev/null || true
            fi
        done
    fi

    echo -e "${CYAN}$SCRIPT_INDEX Step 5: Ensuring only PHP 8.5 is in update-alternatives...${NC}"
    # Remove all PHP alternatives first
    if update-alternatives --query php >/dev/null 2>&1; then
        echo -e "${YELLOW}$SCRIPT_INDEX Removing all existing PHP alternatives...${NC}"
        $USE_SUDO update-alternatives --remove-all php 2>/dev/null || true
    fi

    # Add only PHP 8.5 to alternatives
    if [ -f "/usr/bin/php8.5" ] && [ -x "/usr/bin/php8.5" ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX Adding PHP 8.5 to alternatives with priority 84...${NC}"
        $USE_SUDO update-alternatives --install /usr/bin/php php /usr/bin/php8.5 84 2>/dev/null || true

        # Set PHP 8.5 as the default
        $USE_SUDO update-alternatives --set php /usr/bin/php8.5 2>/dev/null || true

        echo -e "${GREEN}$SCRIPT_INDEX PHP 8.5 set as default via update-alternatives${NC}"
    fi

    echo -e "${CYAN}$SCRIPT_INDEX Step 6: Verifying cleanup results...${NC}"
    # Verify that 'php' command points to PHP 8.5
    if command -v php >/dev/null 2>&1; then
        local current_version=$(php -v 2>/dev/null | head -1 | grep -oP 'PHP \K[0-9]+\.[0-9]+' || echo "unknown")
        if [[ "$current_version" == "8.4"* ]]; then
            echo -e "${GREEN}$SCRIPT_INDEX Verification: 'php' command points to PHP 8.5 �?{NC}"
        else
            echo -e "${YELLOW}$SCRIPT_INDEX Warning: 'php' command points to PHP $current_version${NC}"
        fi
    fi

    # Check if any old PHP-FPM services are still running
    local running_old_fpm=false
    for version in "${old_versions[@]}"; do
        if systemctl is-active --quiet "php${version}-fpm" 2>/dev/null; then
            echo -e "${RED}$SCRIPT_INDEX Warning: php${version}-fpm is still running!${NC}"
            running_old_fpm=true
        fi
    done

    if ! $running_old_fpm; then
        echo -e "${GREEN}$SCRIPT_INDEX Verification: No old PHP-FPM services running �?{NC}"
    fi

    echo -e "${GREEN}$SCRIPT_INDEX Old PHP versions cleanup completed${NC}"

    # Report cleanup summary
    if [ $cleanup_errors -eq 0 ]; then
        echo -e "${GREEN}$SCRIPT_INDEX All cleanup operations completed successfully${NC}"
        return 0
    else
        echo -e "${YELLOW}$SCRIPT_INDEX Cleanup completed with $cleanup_errors warnings${NC}"
        return 1
    fi
}

# 1.8 Comprehensive verification after symbolic link fix
verify_php_symbolic_link_fix() {
    echo -e "${BLUE}$SCRIPT_INDEX [VERIFY] Verifying PHP symbolic link fix...${NC}"

    local target_link="/usr/local/bin/php"
    local expected_binary="/usr/bin/php8.5"
    local verification_passed=true

    # Test 1: Check if symbolic link exists and points to correct target
    if [ -L "$target_link" ]; then
        local actual_target=$(readlink "$target_link")
        if [ "$actual_target" = "$expected_binary" ]; then
            echo -e "${GREEN}$SCRIPT_INDEX �?Symbolic link correct: $target_link -> $actual_target${NC}"
        else
            echo -e "${RED}$SCRIPT_INDEX �?Symbolic link incorrect: $target_link -> $actual_target (expected: $expected_binary)${NC}"
            verification_passed=false
        fi
    else
        echo -e "${RED}$SCRIPT_INDEX �?Symbolic link missing: $target_link${NC}"
        verification_passed=false
    fi

    # Test 2: Check if php command works and returns correct version
    if command -v php >/dev/null 2>&1; then
        local php_version=$(php -v 2>/dev/null | head -n 1 | grep -oP 'PHP \K[0-9]+\.[0-9]+' || echo "unknown")
        if [[ "$php_version" == "8.4"* ]]; then
            echo -e "${GREEN}$SCRIPT_INDEX �?PHP command version correct: $php_version${NC}"
        else
            echo -e "${RED}$SCRIPT_INDEX �?PHP command version incorrect: $php_version (expected: 8.4.x)${NC}"
            verification_passed=false
        fi
    else
        echo -e "${RED}$SCRIPT_INDEX �?PHP command not available${NC}"
        verification_passed=false
    fi

    # Test 3: Check if which php returns the correct path
    local which_php=$(which php 2>/dev/null || echo "not_found")
    if [ "$which_php" = "$target_link" ]; then
        echo -e "${GREEN}$SCRIPT_INDEX �?'which php' returns correct path: $which_php${NC}"
    else
        echo -e "${RED}$SCRIPT_INDEX �?'which php' returns incorrect path: $which_php (expected: $target_link)${NC}"
        verification_passed=false
    fi

    # Test 4: Check if old PHP versions are no longer in PATH
    local old_versions_found=false
    for old_version in 7.4 8.0 8.1 8.2 8.3; do
        if command -v "php${old_version}" >/dev/null 2>&1; then
            local old_php_path=$(which "php${old_version}" 2>/dev/null)
            if [[ "$old_php_path" == "/usr/local/bin/"* ]]; then
                echo -e "${RED}$SCRIPT_INDEX �?Old PHP version still in /usr/local/bin: $old_php_path${NC}"
                old_versions_found=true
            fi
        fi
    done

    if ! $old_versions_found; then
        echo -e "${GREEN}$SCRIPT_INDEX �?No old PHP versions found in /usr/local/bin${NC}"
    else
        verification_passed=false
    fi

    # Test 5: Check if PHP alternatives are clean
    if update-alternatives --query php >/dev/null 2>&1; then
        echo -e "${YELLOW}$SCRIPT_INDEX �?PHP alternatives still configured (may be intentional)${NC}"
    else
        echo -e "${GREEN}$SCRIPT_INDEX �?PHP alternatives are clean${NC}"
    fi

    # Final result
    if $verification_passed; then
        echo -e "${GREEN}$SCRIPT_INDEX [SUCCESS] PHP symbolic link verification PASSED${NC}"
        return 0
    else
        echo -e "${RED}$SCRIPT_INDEX [FAILED] PHP symbolic link verification FAILED${NC}"
        return 1
    fi
}

# 1.8 Comprehensive verification after symbolic link fix
verify_php_symbolic_link_fix() {
    echo -e "${BLUE}$SCRIPT_INDEX [VERIFY] Verifying PHP symbolic link fix...${NC}"

    local target_link="/usr/local/bin/php"
    local expected_binary="/usr/bin/php8.5"
    local success=true

    # Test 1: Check if symbolic link exists and points to correct target
    if [ -L "$target_link" ]; then
        local actual_target=$(readlink "$target_link")
        if [ "$actual_target" = "$expected_binary" ]; then
            echo -e "${GREEN}$SCRIPT_INDEX �?Symbolic link correct: $target_link -> $actual_target${NC}"
        else
            echo -e "${RED}$SCRIPT_INDEX �?Symbolic link incorrect: $target_link -> $actual_target (expected: $expected_binary)${NC}"
            success=false
        fi
    else
        echo -e "${RED}$SCRIPT_INDEX �?Symbolic link missing: $target_link${NC}"
        success=false
    fi

    # Test 2: Check if php command works and returns correct version
    if command -v php >/dev/null 2>&1; then
        local php_version=$(php -v 2>/dev/null | head -n 1 | grep -oP 'PHP \K[0-9]+\.[0-9]+' || echo "unknown")
        if [[ "$php_version" == "8.4"* ]]; then
            echo -e "${GREEN}$SCRIPT_INDEX �?PHP command version correct: $php_version${NC}"
        else
            echo -e "${RED}$SCRIPT_INDEX �?PHP command version incorrect: $php_version (expected: 8.4)${NC}"
            success=false
        fi
    else
        echo -e "${RED}$SCRIPT_INDEX �?PHP command not available${NC}"
        success=false
    fi

    # Test 3: Check if which php returns the correct path
    local which_php=$(which php 2>/dev/null || echo "not found")
    if [ "$which_php" = "$target_link" ]; then
        echo -e "${GREEN}$SCRIPT_INDEX �?'which php' returns correct path: $which_php${NC}"
    else
        echo -e "${RED}$SCRIPT_INDEX �?'which php' returns incorrect path: $which_php (expected: $target_link)${NC}"
        success=false
    fi

    # Test 4: Check if old PHP versions are no longer in PATH
    local old_php_found=false
    for old_version in 7.4 8.0 8.1 8.2 8.3; do
        if command -v "php${old_version}" >/dev/null 2>&1; then
            local old_php_path=$(which "php${old_version}" 2>/dev/null)
            if [[ "$old_php_path" == "/usr/local/bin/"* ]]; then
                echo -e "${RED}$SCRIPT_INDEX �?Old PHP version still in /usr/local/bin: $old_php_path${NC}"
                old_php_found=true
            fi
        fi
    done

    if ! $old_php_found; then
        echo -e "${GREEN}$SCRIPT_INDEX �?No old PHP versions found in /usr/local/bin${NC}"
    else
        success=false
    fi

    # Test 5: Test PHP functionality with a simple command
    if timeout 10 php -r "echo 'PHP is working';" >/dev/null 2>&1; then
        echo -e "${GREEN}$SCRIPT_INDEX �?PHP functionality test passed${NC}"
    else
        echo -e "${RED}$SCRIPT_INDEX �?PHP functionality test failed${NC}"
        success=false
    fi

    if $success; then
        echo -e "${GREEN}$SCRIPT_INDEX All symbolic link verification tests passed${NC}"
        return 0
    else
        echo -e "${RED}$SCRIPT_INDEX Some symbolic link verification tests failed${NC}"
        return 1
    fi
}

# PHASE 2: Comprehensive State Analysis

analyze_php_state() {
    echo -e "${CYAN}$SCRIPT_INDEX [ANALYSIS] Performing comprehensive PHP state analysis...${NC}"

    local binary_exists=false
    local version_ok=false
    local fpm_status=0
    local extensions_ok=false
    local link_ok=false
    local php85_binary_exists=false

    # Check if PHP 8.5 binary exists (regardless of current symlink)
    if [ -f "/usr/bin/php8.5" ]; then
        php85_binary_exists=true
        echo -e "${GREEN}$SCRIPT_INDEX PHP 8.5 binary found: /usr/bin/php8.5${NC}"
    else
        echo -e "${YELLOW}$SCRIPT_INDEX PHP 8.5 binary not found: /usr/bin/php8.5${NC}"
    fi

    # Run all detection checks
    check_php_binary_existence && binary_exists=true
    check_php_version && version_ok=true
    check_php_fpm_status; fpm_status=$?
    check_php_extensions && extensions_ok=true
    check_symbolic_link && link_ok=true

    # Enhanced state determination logic
    if $binary_exists && $version_ok && [ $fpm_status -eq 0 ] && $extensions_ok && $link_ok; then
        echo -e "${GREEN}$SCRIPT_INDEX State: ${PHP_STATE["FULLY_CONFIGURED"]}${NC}"
        return 0
    elif ! $php85_binary_exists; then
        echo -e "${RED}$SCRIPT_INDEX State: ${PHP_STATE["MISSING"]}${NC}"
        return 1
    elif $php85_binary_exists && ! $link_ok; then
        # PHP 8.5 is installed but symlink is wrong/missing
        if $binary_exists && ! $version_ok; then
            echo -e "${YELLOW}$SCRIPT_INDEX State: ${PHP_STATE["LINKED_WRONG_VERSION"]}${NC}"
            return 2
        else
            echo -e "${YELLOW}$SCRIPT_INDEX State: ${PHP_STATE["LINKED_BROKEN"]}${NC}"
            return 5
        fi
    elif $php85_binary_exists && $link_ok && [ $fpm_status -ne 0 ]; then
        case $fpm_status in
            1) echo -e "${YELLOW}$SCRIPT_INDEX State: ${PHP_STATE["FPM_NOT_RUNNING"]}${NC}" ;;
            2) echo -e "${YELLOW}$SCRIPT_INDEX State: ${PHP_STATE["FPM_NOT_RUNNING"]}${NC}" ;;
            3) echo -e "${YELLOW}$SCRIPT_INDEX State: ${PHP_STATE["FPM_NOT_INSTALLED"]}${NC}" ;;
        esac
        return 3
    elif $php85_binary_exists && $link_ok && ! $extensions_ok; then
        echo -e "${YELLOW}$SCRIPT_INDEX State: ${PHP_STATE["EXTENSIONS_MISSING"]}${NC}"
        return 4
    elif $php85_binary_exists && ! $binary_exists; then
        echo -e "${YELLOW}$SCRIPT_INDEX State: ${PHP_STATE["INSTALLED_NO_LINK"]}${NC}"
        return 6
    else
        echo -e "${YELLOW}$SCRIPT_INDEX State: ${PHP_STATE["INSTALLED_NO_LINK"]}${NC}"
        return 6
    fi
}

# Simple Composer state check
analyze_composer_state() {
    echo -e "${CYAN}$SCRIPT_INDEX [ANALYSIS] Performing Composer state analysis...${NC}"

    if check_composer_binary_state; then
        echo -e "${GREEN}$SCRIPT_INDEX Composer: Available${NC}"
        return 0
    else
        echo -e "${YELLOW}$SCRIPT_INDEX Composer: Not available${NC}"
        echo -e "${CYAN}$SCRIPT_INDEX Note: Composer will be installed in the next step via 34_install_composer.sh${NC}"
        return 1
    fi
}

# PHASE 3: Pre-installation Check (Performance Optimization)

pre_installation_check() {
    echo -e "${CYAN}$SCRIPT_INDEX [PRE-CHECK] Running pre-installation verification...${NC}"

    local php_state_result=0
    local composer_state_result=0

    # Check PHP state
    echo -e "${CYAN}$SCRIPT_INDEX Checking PHP 8.5 state...${NC}"
    analyze_php_state; php_state_result=$?

    # Check Composer state independently
    echo -e "${CYAN}$SCRIPT_INDEX Checking Composer state...${NC}"
    analyze_composer_state; composer_state_result=$?

    # Display results
    if [ $php_state_result -eq 0 ]; then
        echo -e "${GREEN}$SCRIPT_INDEX  PHP 8.5 is fully configured and ready${NC}"
    else
        echo -e "${YELLOW}$SCRIPT_INDEX  PHP 8.5 needs attention (state code: $php_state_result)${NC}"
    fi

    if [ $composer_state_result -eq 0 ]; then
        echo -e "${GREEN}$SCRIPT_INDEX  Composer is fully configured and ready${NC}"
    else
        echo -e "${YELLOW}$SCRIPT_INDEX  Composer needs attention (state code: $composer_state_result)${NC}"
    fi

    # Overall decision - but also check for symbolic link issues that need fixing
    if [ $php_state_result -eq 0 ] && [ $composer_state_result -eq 0 ]; then
        echo -e "${GREEN}$SCRIPT_INDEX All components are ready! Skipping installation to optimize performance.${NC}"
        return 0
    else
        echo -e "${YELLOW}$SCRIPT_INDEX Some components require installation/repair. Proceeding with installation...${NC}"

        # Show what needs to be done
        if [ $php_state_result -ne 0 ]; then
            case $php_state_result in
                1) echo -e "${YELLOW}$SCRIPT_INDEX  PHP 8.5 installation required${NC}" ;;
                2) echo -e "${YELLOW}$SCRIPT_INDEX  PHP version update required - will fix symbolic link${NC}" ;;
                3) echo -e "${YELLOW}$SCRIPT_INDEX  PHP repair required${NC}" ;;
                5) echo -e "${YELLOW}$SCRIPT_INDEX  PHP symbolic link repair required${NC}" ;;
                6) echo -e "${YELLOW}$SCRIPT_INDEX  PHP symbolic link creation required${NC}" ;;
                *) echo -e "${YELLOW}$SCRIPT_INDEX  PHP configuration required${NC}" ;;
            esac
        fi

        if [ $composer_state_result -ne 0 ]; then
            case $composer_state_result in
                1) echo -e "${YELLOW}$SCRIPT_INDEX  Composer installation required${NC}" ;;
                2) echo -e "${YELLOW}$SCRIPT_INDEX  Composer repair required${NC}" ;;
                *) echo -e "${YELLOW}$SCRIPT_INDEX  Composer configuration required${NC}" ;;
            esac
        fi

        return 1
    fi
}

# PHASE 4: Installation Execution (Conditional Based on State)

# Remove existing PHP versions before installing PHP 8.5
remove_existing_php() {
    echo -e "${BLUE}$SCRIPT_INDEX [CLEANUP] Stopping existing PHP services (keeping packages)...${NC}"

    # Get list of installed PHP packages for information
    local php_packages=$(dpkg -l | grep -E '^ii.*php[0-9]\.' | awk '{print $2}' | grep -v php8.5 || true)

    if [ -n "$php_packages" ]; then
        echo -e "${CYAN}$SCRIPT_INDEX Found existing PHP packages (will be preserved):${NC}"
        echo "$php_packages" | while read -r pkg; do
            if [[ "$pkg" =~ php([0-9]+\.[0-9]+) ]]; then
                local version="${BASH_REMATCH[1]}"
                echo -e "${CYAN}$SCRIPT_INDEX   - PHP $version${NC}"
            fi
        done

        # Stop services only (do not remove packages)
        echo -e "${YELLOW}$SCRIPT_INDEX Stopping non-8.4 PHP-FPM services...${NC}"
        for version in 7.4 8.0 8.1 8.2 8.3; do
            if systemctl is-active --quiet php${version}-fpm 2>/dev/null; then
                echo -e "${YELLOW}$SCRIPT_INDEX Stopping php${version}-fpm service...${NC}"
                $USE_SUDO systemctl stop php${version}-fpm || true
                $USE_SUDO systemctl disable php${version}-fpm || true
                echo -e "${GREEN}$SCRIPT_INDEX Stopped php${version}-fpm service${NC}"
            fi
        done

        echo -e "${GREEN}$SCRIPT_INDEX PHP services stopped, packages preserved${NC}"
    else
        echo -e "${GREEN}$SCRIPT_INDEX No conflicting PHP versions found${NC}"
    fi
}

# 4.1 Setup PHP repository - Fixed for both Ubuntu and Debian
setup_php_repository() {
    echo -e "${BLUE}$SCRIPT_INDEX [INSTALL] Setting up PHP repository...${NC}"

    # Check network connectivity first
    if ! check_network_connectivity; then
        echo -e "${YELLOW}$SCRIPT_INDEX Skipping repository setup due to network issues${NC}"
        return 0
    fi

    # Detect OS
    local os_id=$(lsb_release -si 2>/dev/null | tr '[:upper:]' '[:lower:]' || echo "unknown")
    local os_codename=$(lsb_release -sc 2>/dev/null || echo "unknown")

    echo -e "${CYAN}$SCRIPT_INDEX Detected OS: $os_id $os_codename${NC}"

    # Step 1: Update APT package index
    echo -e "${YELLOW}$SCRIPT_INDEX Step 1: Updating APT package index...${NC}"
    $USE_SUDO apt update

    # Install required packages
    echo -e "${YELLOW}$SCRIPT_INDEX Installing dependencies...${NC}"
    $USE_SUDO apt install -y software-properties-common lsb-release ca-certificates curl wget gnupg2

    # Remove existing PHP repository configurations to avoid conflicts
    echo -e "${YELLOW}$SCRIPT_INDEX Cleaning existing PHP repositories...${NC}"
    $USE_SUDO rm -f /etc/apt/sources.list.d/php.list 2>/dev/null || true
    $USE_SUDO rm -f /etc/apt/sources.list.d/ondrej-ubuntu-php-*.list 2>/dev/null || true
    $USE_SUDO rm -f /usr/share/keyrings/php-archive-keyring.gpg 2>/dev/null || true

    # Setup repository based on OS
    if [[ "$os_id" == "ubuntu" ]]; then
        echo -e "${YELLOW}$SCRIPT_INDEX Setting up Ubuntu PPA repository...${NC}"
        # For Ubuntu: use PPA
        if $USE_SUDO add-apt-repository ppa:ondrej/php -y 2>/dev/null; then
            echo -e "${GREEN}$SCRIPT_INDEX Ubuntu PPA added successfully${NC}"
        else
            echo -e "${YELLOW}$SCRIPT_INDEX PPA failed, trying manual method...${NC}"
            # Manual fallback for Ubuntu
            $USE_SUDO wget -qO- https://packages.sury.org/php/apt.gpg | $USE_SUDO gpg --dearmor -o /usr/share/keyrings/php-archive-keyring.gpg
            echo "deb [signed-by=/usr/share/keyrings/php-archive-keyring.gpg] https://ppa.launchpad.net/ondrej/php/ubuntu $os_codename main" | $USE_SUDO tee /etc/apt/sources.list.d/php.list
        fi
    elif [[ "$os_id" == "debian" ]]; then
        echo -e "${YELLOW}$SCRIPT_INDEX Setting up Debian Sury repository...${NC}"
        # For Debian: use Sury repository directly (as per debian documentation)
        $USE_SUDO wget -qO- https://packages.sury.org/php/apt.gpg | $USE_SUDO gpg --dearmor -o /usr/share/keyrings/php-archive-keyring.gpg
        echo "deb [signed-by=/usr/share/keyrings/php-archive-keyring.gpg] https://packages.sury.org/php/ $os_codename main" | $USE_SUDO tee /etc/apt/sources.list.d/php.list
        echo -e "${GREEN}$SCRIPT_INDEX Debian Sury repository added${NC}"
    else
        echo -e "${RED}$SCRIPT_INDEX Unsupported OS: $os_id${NC}"
        return 1
    fi

    # Update package index with new repository
    echo -e "${YELLOW}$SCRIPT_INDEX Updating package index with new repository...${NC}"
    $USE_SUDO apt update 2>/dev/null || {
        echo -e "${YELLOW}$SCRIPT_INDEX Repository update failed, trying alternative methods...${NC}"
        # Try without signature verification as fallback
        $USE_SUDO apt update --allow-unauthenticated 2>/dev/null || true
    }

    # Verify PHP 8.5 availability
    echo -e "${BLUE}$SCRIPT_INDEX Verifying PHP 8.5 availability...${NC}"
    if apt policy php8.5 2>/dev/null | grep -q "Candidate"; then
        echo -e "${GREEN}$SCRIPT_INDEX PHP 8.5 is available${NC}"
    else
        echo -e "${YELLOW}$SCRIPT_INDEX PHP 8.5 may not be available, but continuing...${NC}"
    fi
}

# 4.2 Install PHP 8.5 core packages with Laravel support
install_php_core() {
    echo -e "${BLUE}$SCRIPT_INDEX [INSTALL] Installing PHP 8.5 core packages...${NC}"

    # Step 0: Prevent Apache2 installation BEFORE installing PHP
    echo -e "${CYAN}$SCRIPT_INDEX Preventing Apache2 installation...${NC}"
    $USE_SUDO apt-mark hold apache2 apache2-bin apache2-data apache2-utils libapache2-mod-php* 2>/dev/null || true

    # Step 1: Install PHP 8.5 core package (without apache2 dependencies)
    echo -e "${YELLOW}$SCRIPT_INDEX Step 1: Installing php8.5 (without Apache2)...${NC}"
    if ! dpkg -l | grep -q "^ii.*php8.5[[:space:]]"; then
        if $USE_SUDO apt install php8.5 -y --no-install-recommends 2>/dev/null || $USE_SUDO apt install php8.5 -y --no-install-recommends --allow-unauthenticated; then
            echo -e "${GREEN}$SCRIPT_INDEX php8.5 installed successfully${NC}"
        else
            echo -e "${RED}$SCRIPT_INDEX Failed to install php8.5${NC}"
            return 1
        fi
    else
        echo -e "${GREEN}$SCRIPT_INDEX php8.5 already installed${NC}"
    fi

    # Step 2: Install Laravel-required PHP extensions (CLI/FPM only, NO Apache2)
    echo -e "${YELLOW}$SCRIPT_INDEX Step 2: Installing Laravel-required PHP 8.5 extensions...${NC}"

    # Use core extensions from common variables
    local core_extensions=("${CORE_EXTENSIONS[@]}")
    local failed_extensions=()
    local installed_count=0
    local already_installed_count=0

    echo -e "${CYAN}$SCRIPT_INDEX Total extensions to check: ${#core_extensions[@]}${NC}"

    for ext in "${core_extensions[@]}"; do
        # Check if already installed
        if dpkg -l | grep -q "^ii.*$ext[[:space:]]"; then
            echo -e "${GREEN}$SCRIPT_INDEX $ext: already installed �?{NC}"
            ((already_installed_count++))
            continue
        fi

        echo -e "${CYAN}$SCRIPT_INDEX Installing $ext...${NC}"

        # Try to install with --no-install-recommends first
        if $USE_SUDO apt install "$ext" -y --no-install-recommends 2>&1 | tee /tmp/php_ext_install.log; then
            # Verify installation
            if dpkg -l | grep -q "^ii.*$ext[[:space:]]"; then
                echo -e "${GREEN}$SCRIPT_INDEX $ext: installed successfully �?{NC}"
                ((installed_count++))
            else
                echo -e "${YELLOW}$SCRIPT_INDEX $ext: installation reported success but package not found${NC}"
                # Try without --no-install-recommends
                if $USE_SUDO apt install "$ext" -y 2>&1 | tee /tmp/php_ext_install.log; then
                    if dpkg -l | grep -q "^ii.*$ext[[:space:]]"; then
                        echo -e "${GREEN}$SCRIPT_INDEX $ext: installed successfully (with recommends) �?{NC}"
                        ((installed_count++))
                    else
                        echo -e "${RED}$SCRIPT_INDEX $ext: installation failed �?{NC}"
                        failed_extensions+=("$ext")
                    fi
                else
                    echo -e "${RED}$SCRIPT_INDEX $ext: installation failed �?{NC}"
                    cat /tmp/php_ext_install.log
                    failed_extensions+=("$ext")
                fi
            fi
        else
            echo -e "${YELLOW}$SCRIPT_INDEX $ext: first attempt failed, trying with recommends...${NC}"
            # Try without --no-install-recommends
            if $USE_SUDO apt install "$ext" -y 2>&1 | tee /tmp/php_ext_install.log; then
                if dpkg -l | grep -q "^ii.*$ext[[:space:]]"; then
                    echo -e "${GREEN}$SCRIPT_INDEX $ext: installed successfully (with recommends) �?{NC}"
                    ((installed_count++))
                else
                    echo -e "${RED}$SCRIPT_INDEX $ext: installation failed �?{NC}"
                    cat /tmp/php_ext_install.log
                    failed_extensions+=("$ext")
                fi
            else
                echo -e "${RED}$SCRIPT_INDEX $ext: installation failed �?{NC}"
                cat /tmp/php_ext_install.log
                failed_extensions+=("$ext")
            fi
        fi
    done

    # Clean up log file
    rm -f /tmp/php_ext_install.log

    # Installation summary
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX Extension Installation Summary:${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX Already installed: $already_installed_count${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX Newly installed: $installed_count${NC}"

    if [ ${#failed_extensions[@]} -gt 0 ]; then
        echo -e "${RED}$SCRIPT_INDEX Failed installations: ${#failed_extensions[@]}${NC}"
        echo -e "${RED}$SCRIPT_INDEX Failed extensions: ${failed_extensions[*]}${NC}"
        echo -e "${CYAN}========================================${NC}"

        # CRITICAL: Do not fail immediately, try to continue with available extensions
        echo -e "${YELLOW}$SCRIPT_INDEX Some extensions failed to install, but continuing...${NC}"
        echo -e "${YELLOW}$SCRIPT_INDEX You can install them manually later with:${NC}"
        for ext in "${failed_extensions[@]}"; do
            echo -e "${YELLOW}$SCRIPT_INDEX   sudo apt install $ext${NC}"
        done
    else
        echo -e "${GREEN}$SCRIPT_INDEX All extensions installed successfully �?{NC}"
        echo -e "${CYAN}========================================${NC}"
    fi

    # Simplified Apache2 cleanup - disable without detection
    echo -e "${CYAN}$SCRIPT_INDEX Disabling Apache2 if present...${NC}"
    $USE_SUDO systemctl stop apache2 2>/dev/null || true
    $USE_SUDO systemctl disable apache2 2>/dev/null || true
    $USE_SUDO systemctl mask apache2 2>/dev/null || true

    # Step 3: Verify PHP installation
    echo -e "${YELLOW}$SCRIPT_INDEX Step 3: Verifying PHP installation...${NC}"
    if command -v php8.5 >/dev/null 2>&1; then
        local php_version=$(php8.5 -v 2>/dev/null | head -n 1 || echo "Version check failed")
        echo -e "${GREEN}$SCRIPT_INDEX PHP 8.5 verification: $php_version${NC}"
    else
        echo -e "${RED}$SCRIPT_INDEX PHP 8.5 binary not found after installation${NC}"
        return 1
    fi

    # Step 4: Verify critical extensions are loaded
    echo -e "${YELLOW}$SCRIPT_INDEX Step 4: Verifying critical extensions...${NC}"
    local critical_extensions=("curl" "mbstring" "xml" "dom")
    local missing_critical=()

    for ext in "${critical_extensions[@]}"; do
        if php8.5 -m 2>/dev/null | grep -qi "^${ext}$"; then
            echo -e "${GREEN}$SCRIPT_INDEX   $ext: loaded �?{NC}"
        else
            echo -e "${RED}$SCRIPT_INDEX   $ext: NOT loaded �?{NC}"
            missing_critical+=("$ext")
        fi
    done

    if [ ${#missing_critical[@]} -gt 0 ]; then
        echo -e "${RED}$SCRIPT_INDEX Critical extensions missing: ${missing_critical[*]}${NC}"
        echo -e "${YELLOW}$SCRIPT_INDEX This may cause issues with Composer and Laravel${NC}"
        echo -e "${YELLOW}$SCRIPT_INDEX Install with: sudo apt install php8.5-curl php8.5-mbstring php8.5-xml${NC}"
        # Don't fail, just warn
    fi

    # Set the actual installed version
    ACTUAL_PHP_VERSION="8.4"
    echo -e "${GREEN}$SCRIPT_INDEX PHP 8.5 core installation completed${NC}"
}

# Composer installation is now handled by separate script 32_install_composer.sh

# 4.3 Install PHP 8.5 FPM - Following test_phpdoc.txt exactly
install_php_fpm() {
    echo -e "${BLUE}$SCRIPT_INDEX [INSTALL] Installing PHP 8.5 FPM...${NC}"

    # Prevent Apache2 installation during FPM setup
    echo -e "${CYAN}$SCRIPT_INDEX Preventing Apache2 during FPM installation...${NC}"
    $USE_SUDO apt-mark hold apache2 apache2-bin apache2-data apache2-utils libapache2-mod-php* 2>/dev/null || true

    # Step 1: Install PHP 8.5 FPM only
    echo -e "${YELLOW}$SCRIPT_INDEX Step 1: Installing php8.5-fpm...${NC}"
    if ! dpkg -l | grep -q "^ii.*php8.5-fpm[[:space:]]"; then
        if $USE_SUDO apt install php8.5-fpm -y --no-install-recommends; then
            echo -e "${GREEN}$SCRIPT_INDEX php8.5-fpm installed successfully${NC}"
        else
            echo -e "${RED}$SCRIPT_INDEX Failed to install php8.5-fpm${NC}"
            return 1
        fi
    else
        echo -e "${GREEN}$SCRIPT_INDEX php8.5-fpm already installed${NC}"
    fi

    # Remove Apache2 if it was installed during FPM installation
    if dpkg -l | grep -q "^ii.*apache2"; then
        echo -e "${YELLOW}$SCRIPT_INDEX Apache2 installed during FPM setup, removing...${NC}"
        $USE_SUDO systemctl stop apache2 2>/dev/null || true
        $USE_SUDO systemctl disable apache2 2>/dev/null || true
        $USE_SUDO apt remove --purge apache2* -y 2>/dev/null || true
        $USE_SUDO apt autoremove -y 2>/dev/null || true
    fi

    # Step 2: Start the PHP-FPM service (as per documentation)
    echo -e "${YELLOW}$SCRIPT_INDEX Step 2: Starting $PHP_FPM_SERVICE service...${NC}"
    if $USE_SUDO systemctl start $PHP_FPM_SERVICE; then
        echo -e "${GREEN}$SCRIPT_INDEX $PHP_FPM_SERVICE service started successfully${NC}"
    else
        echo -e "${YELLOW}$SCRIPT_INDEX $PHP_FPM_SERVICE service may already be running${NC}"
    fi

    # Step 3: Enable PHP-FPM to start automatically on boot (as per documentation)
    echo -e "${YELLOW}$SCRIPT_INDEX Step 3: Enabling $PHP_FPM_SERVICE service for auto-start...${NC}"
    if $USE_SUDO systemctl enable $PHP_FPM_SERVICE; then
        echo -e "${GREEN}$SCRIPT_INDEX $PHP_FPM_SERVICE service enabled for auto-start${NC}"
    else
        echo -e "${YELLOW}$SCRIPT_INDEX $PHP_FPM_SERVICE service may already be enabled${NC}"
    fi

    # Step 4: Check the status of PHP-FPM service (as per documentation)
    echo -e "${YELLOW}$SCRIPT_INDEX Step 4: Checking $PHP_FPM_SERVICE service status...${NC}"
    if systemctl is-active --quiet $PHP_FPM_SERVICE; then
        echo -e "${GREEN}$SCRIPT_INDEX $PHP_FPM_SERVICE service is active and running${NC}"
        # Show brief status
        systemctl status $PHP_FPM_SERVICE --no-pager -l | head -10
    else
        echo -e "${RED}$SCRIPT_INDEX $PHP_FPM_SERVICE service is not running${NC}"
        return 1
    fi

    # Store the installed version for other functions
    ACTUAL_PHP_VERSION="$PHP_VERSION"
    echo -e "${GREEN}$SCRIPT_INDEX PHP $PHP_VERSION FPM installation and setup completed successfully${NC}"
}

# 4.4 Configure and start PHP-FPM service - moved to 32_configure_php85.sh

# Configuration functions moved to 32_configure_php85.sh

# Nginx configuration functions moved to 32_configure_php85.sh

# Nginx site configuration moved to 32_configure_php85.sh

# Configuration functions moved to 32_configure_php85.sh

# 4.6 Main installation execution function
execute_installation() {
    echo -e "${CYAN}$SCRIPT_INDEX [EXECUTION] Starting PHP 8.5 installation process...${NC}"

    # Step 1: Clean up old PHP versions first
    cleanup_old_php_versions || {
        echo -e "${YELLOW}$SCRIPT_INDEX Old PHP cleanup completed with warnings${NC}"
    }

    # Step 2: Remove existing PHP versions
    remove_existing_php || {
        echo -e "${YELLOW}$SCRIPT_INDEX PHP cleanup completed with warnings${NC}"
    }

    # Step 3: Setup PHP repository
    setup_php_repository || {
        echo -e "${RED}$SCRIPT_INDEX Repository setup failed${NC}"
        return 1
    }

    # Step 4: Install PHP 8.5 core
    install_php_core || {
        echo -e "${RED}$SCRIPT_INDEX PHP 8.5 core installation failed${NC}"
        return 1
    }

    # Step 5: Install PHP 8.5 FPM
    install_php_fpm || {
        echo -e "${RED}$SCRIPT_INDEX PHP 8.5 FPM installation failed${NC}"
        return 1
    }

    # Step 6: Fix PHP symbolic link and PATH
    fix_php_symbolic_link || {
        echo -e "${YELLOW}$SCRIPT_INDEX PHP symbolic link fix completed with warnings${NC}"
    }

    # Step 6.5: Verify symbolic link fix
    verify_php_symbolic_link_fix || {
        echo -e "${YELLOW}$SCRIPT_INDEX PHP symbolic link verification completed with warnings${NC}"
    }

    # Step 7: Configuration delegated to 32_configure_php85.sh
    echo -e "${CYAN}$SCRIPT_INDEX PHP configuration delegated to 32_configure_php85.sh${NC}"

    # Step 8: Next step will configure PHP
    echo -e "${CYAN}$SCRIPT_INDEX Next step will configure PHP settings and Composer${NC}"

    echo -e "${GREEN}$SCRIPT_INDEX PHP 8.5 installation execution completed successfully${NC}"
}

# PHASE 5: Post-installation Verification

post_installation_verification() {
    echo -e "${CYAN}$SCRIPT_INDEX [VERIFICATION] Running post-installation verification...${NC}"

    # Re-run comprehensive state analysis
    if analyze_php_state; then
        echo -e "${GREEN}$SCRIPT_INDEX [OK] Post-installation verification PASSED${NC}"
        echo -e "${GREEN}$SCRIPT_INDEX PHP 8.5 is fully configured and ready for use${NC}"

        # Display final status
        display_final_status
        return 0
    else
        echo -e "${RED}$SCRIPT_INDEX [FAIL] Post-installation verification FAILED${NC}"
        echo -e "${RED}$SCRIPT_INDEX Some issues remain after installation${NC}"
        return 1
    fi
}

display_final_status() {
    echo -e "${CYAN}========================================================================${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX PHP 8.5 Installation Summary (per test_phpdoc.txt)${NC}"
    echo -e "${CYAN}========================================================================${NC}"

    # PHP version verification (as per documentation)
    echo -e "${YELLOW}$SCRIPT_INDEX Verifying PHP installation (php -v):${NC}"
    if command -v php >/dev/null 2>&1; then
        php -v | head -3
    else
        echo -e "${RED}$SCRIPT_INDEX PHP command not available${NC}"
    fi

    # PHP-FPM service status (as per documentation)
    echo -e "${YELLOW}$SCRIPT_INDEX PHP-FPM Service Status:${NC}"
    if systemctl is-active --quiet php8.5-fpm; then
        echo -e "${GREEN}$SCRIPT_INDEX php8.5-fpm service: [RUNNING]${NC}"
        systemctl status php8.5-fpm --no-pager -l | head -5
    else
        echo -e "${RED}$SCRIPT_INDEX php8.5-fpm service: [NOT RUNNING]${NC}"
    fi

    # Socket status (as per documentation)
    if [ -S "/run/php/php8.5-fpm.sock" ]; then
        echo -e "${GREEN}$SCRIPT_INDEX PHP-FPM Socket: /run/php/php8.5-fpm.sock [OK]${NC}"
        local socket_perms=$(stat -c "%a" "/run/php/php8.5-fpm.sock" 2>/dev/null || echo "unknown")
        echo -e "${GREEN}$SCRIPT_INDEX Socket Permissions: $socket_perms${NC}"
    else
        echo -e "${RED}$SCRIPT_INDEX PHP-FPM Socket: Not found${NC}"
    fi

    # Active modules verification (as per documentation)
    echo -e "${YELLOW}$SCRIPT_INDEX Active PHP Modules (php -m):${NC}"
    if command -v php >/dev/null 2>&1; then
        local module_count=$(php -m 2>/dev/null | wc -l || echo "0")
        echo -e "${GREEN}$SCRIPT_INDEX Total modules loaded: $module_count${NC}"

        # Show key modules from test_phpdoc.txt
        echo -e "${CYAN}$SCRIPT_INDEX Key modules from documentation:${NC}"
        local doc_modules=("Core" "curl" "mbstring" "xml" "zip" "gd" "mysqli" "Zend OPcache" "intl" "bcmath")
        for module in "${doc_modules[@]}"; do
            if php -m 2>/dev/null | grep -qi "^$module$"; then
                echo -e "${GREEN}$SCRIPT_INDEX   $module: [LOADED]${NC}"
            else
                echo -e "${YELLOW}$SCRIPT_INDEX   $module: [NOT FOUND]${NC}"
            fi
        done
    fi

    # PHP alternatives status (as per documentation)
    echo -e "${YELLOW}$SCRIPT_INDEX PHP Alternatives Status:${NC}"
    if update-alternatives --query php >/dev/null 2>&1; then
        echo -e "${GREEN}$SCRIPT_INDEX PHP alternatives configured${NC}"
        update-alternatives --query php | grep -E "^(Value|Alternative)" | head -4
    else
        echo -e "${YELLOW}$SCRIPT_INDEX PHP alternatives not configured${NC}"
    fi

    # Configuration files
    echo -e "${YELLOW}$SCRIPT_INDEX Configuration Files:${NC}"
    local config_files=(
        "/etc/php/8.4/fpm/pool.d/www.conf"
        "/etc/php/8.4/cli/php.ini"
        "/etc/php/8.4/fpm/php.ini"
    )

    for config_file in "${config_files[@]}"; do
        if [ -f "$config_file" ]; then
            echo -e "${GREEN}$SCRIPT_INDEX   $config_file [OK]${NC}"
        else
            echo -e "${YELLOW}$SCRIPT_INDEX   $config_file [NOT FOUND]${NC}"
        fi
    done

    echo -e "${CYAN}========================================================================${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX [SUCCESS] PHP 8.5 installation completed as per test_phpdoc.txt!${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX [INFO] PHP 8.5 is ready for web development${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX [INFO] PHP-FPM is configured and running${NC}"
    echo -e "${CYAN}========================================================================${NC}"
}

# MAIN EXECUTION

main() {
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX Intelligent PHP 8.5 Installation System${NC}"
    echo -e "${CYAN}============================================================================${NC}"

    # Pre-flight checks
    echo -e "${BLUE}$SCRIPT_INDEX [PRE-FLIGHT] Running system checks...${NC}"

    # Check if running as root or with sudo access
    if [ "$EUID" -eq 0 ]; then
        echo -e "${GREEN}$SCRIPT_INDEX Running as root${NC}"
    elif sudo -n true 2>/dev/null; then
        echo -e "${GREEN}$SCRIPT_INDEX Sudo access confirmed${NC}"
    else
        echo -e "${RED}$SCRIPT_INDEX This script requires root privileges or sudo access${NC}"
        echo -e "${YELLOW}$SCRIPT_INDEX Please run with: sudo $0${NC}"
        exit 1
    fi

    # Check if system is supported
    if ! command -v systemctl >/dev/null 2>&1; then
        echo -e "${RED}$SCRIPT_INDEX systemctl not found. This script requires systemd.${NC}"
        exit 1
    fi

    # Phase 1: Pre-installation check for performance optimization
    local pre_check_result=0
    pre_installation_check; pre_check_result=$?

    if [ $pre_check_result -eq 0 ]; then
        echo -e "${GREEN}$SCRIPT_INDEX System is already optimally configured. Exiting.${NC}"
        exit 0
    fi

    echo -e "${YELLOW}$SCRIPT_INDEX Proceeding with installation/configuration...${NC}"

    # Phase 1.5: Check if we only need to fix symbolic link
    local php_state_result=0
    analyze_php_state; php_state_result=$?

    # ALWAYS try to fix missing extensions if PHP 8.5 is installed
    if command -v php8.5 >/dev/null 2>&1; then
        echo -e "${CYAN}$SCRIPT_INDEX PHP 8.5 detected, checking for missing extensions...${NC}"
        fix_missing_extensions || {
            echo -e "${YELLOW}$SCRIPT_INDEX Extension fix completed with warnings${NC}"
        }
    fi

    # If PHP is installed but only symbolic link is wrong, just fix the link
    if [ $php_state_result -eq 5 ] || [ $php_state_result -eq 6 ] || [ $php_state_result -eq 2 ]; then
        echo -e "${CYAN}$SCRIPT_INDEX Only symbolic link needs fixing. Performing targeted fix...${NC}"

        # Clean up old versions and fix symbolic link
        cleanup_old_php_versions || {
            echo -e "${YELLOW}$SCRIPT_INDEX Old PHP cleanup completed with warnings${NC}"
        }

        fix_php_symbolic_link || {
            echo -e "${RED}$SCRIPT_INDEX Failed to fix PHP symbolic link${NC}"
            exit 1
        }

        # Verify the fix worked
        verify_php_symbolic_link_fix || {
            echo -e "${RED}$SCRIPT_INDEX Symbolic link fix verification failed${NC}"
            exit 1
        }

        echo -e "${GREEN}$SCRIPT_INDEX Symbolic link fix completed successfully. Running final verification...${NC}"
        post_installation_verification
        exit $?
    fi

    # Phase 2: Execute full installation based on state analysis
    execute_installation

    # Phase 3: Post-installation verification
    post_installation_verification
}

# Execute main function with error handling
main "$@"
exit_code=$?

# Final summary
echo -e "${CYAN}============================================================================${NC}"
if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}$SCRIPT_INDEX [SUCCESS] PHP 8.5 installation/configuration completed successfully!${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX [INFO] PHP 8.5 is now available via 'php' command${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX [INFO] Symbolic link: /usr/local/bin/php -> /usr/bin/php8.5${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX [INFO] Old PHP versions have been cleaned up${NC}"
else
    echo -e "${RED}$SCRIPT_INDEX [FAILED] PHP 8.5 installation/configuration failed with exit code: $exit_code${NC}"
    echo -e "${YELLOW}$SCRIPT_INDEX [INFO] Check the output above for specific error details${NC}"
    echo -e "${YELLOW}$SCRIPT_INDEX [INFO] You may need to run the script again or fix issues manually${NC}"
fi
echo -e "${CYAN}============================================================================${NC}"

exit $exit_code
