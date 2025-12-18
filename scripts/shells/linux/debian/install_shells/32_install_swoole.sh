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

# Script: 32_install_swoole.sh
# Description: Install Swoole extension for PHP 8.5 and Laravel Octane support
# PHP Version: 8.5 (Upgraded from 8.4)
# Swoole Version: 6.x (Compiled from master for PHP 8.5 compatibility)
# Laravel Octane: v2.13.x (Requires compatibility patch for Swoole 6.x)
# Compatibility: Automatically applies Octane/Swoole 6.x patch after installation
# Author: System Administrator
# Version: 1.1

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_INDEX="[32_SWOOLE]"

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_1/debian_com/php_common_vars.sh"

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}$SCRIPT_INDEX PHP Swoole Extension Installation${NC}"
echo -e "${CYAN}========================================${NC}"

check_swoole_installed() {
    echo -e "${BLUE}$SCRIPT_INDEX Checking Swoole installation...${NC}"

    # Get dynamic extension directory from PHP
    local ext_dir=$(php -r "echo ini_get('extension_dir');" 2>/dev/null)
    local swoole_so="$ext_dir/swoole.so"

    echo -e "${CYAN}$SCRIPT_INDEX PHP extension directory: $ext_dir${NC}"

    if [ -f "$swoole_so" ]; then
        echo -e "${GREEN}$SCRIPT_INDEX Swoole extension file exists: $swoole_so${NC}"

        if php -m 2>/dev/null | grep -q "swoole"; then
            local swoole_version=$(php -r "echo phpversion('swoole');" 2>/dev/null || echo "unknown")
            echo -e "${GREEN}$SCRIPT_INDEX Swoole module loaded in CLI: $swoole_version${NC}"
        else
            echo -e "${YELLOW}$SCRIPT_INDEX Swoole extension exists but not loaded in CLI${NC}"
            echo -e "${YELLOW}$SCRIPT_INDEX This may indicate configuration issue${NC}"
        fi

        return 0
    else
        echo -e "${YELLOW}$SCRIPT_INDEX Swoole extension file not found: $swoole_so${NC}"
        return 1
    fi
}

check_swoole_configuration() {
    echo -e "${BLUE}$SCRIPT_INDEX Checking Swoole configuration files...${NC}"

    local config_valid=true
    local swoole_ini="/etc/php/8.5/mods-available/swoole.ini"

    if [ ! -f "$swoole_ini" ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX Configuration file missing: $swoole_ini${NC}"
        config_valid=false
    else
        echo -e "${GREEN}$SCRIPT_INDEX Configuration file exists: $swoole_ini${NC}"
    fi

    # Only check CLI - FPM is not installed when using Swoole
    for sapi in cli; do
        local link="/etc/php/8.5/$sapi/conf.d/20-swoole.ini"
        if [ ! -L "$link" ]; then
            echo -e "${YELLOW}$SCRIPT_INDEX Symlink missing for $sapi: $link${NC}"
            config_valid=false
        else
            echo -e "${GREEN}$SCRIPT_INDEX Symlink exists for $sapi: $link${NC}"
        fi
    done

    if $config_valid; then
        echo -e "${GREEN}$SCRIPT_INDEX All Swoole configuration files are valid${NC}"
        return 0
    else
        echo -e "${YELLOW}$SCRIPT_INDEX Some Swoole configuration files need repair${NC}"
        return 1
    fi
}

ensure_php_symlink() {
    echo -e "${BLUE}$SCRIPT_INDEX Ensuring PHP 8.5 symlink exists...${NC}"

    if [ ! -f "/usr/bin/php" ] || ! /usr/bin/php -v 2>/dev/null | grep -q "PHP 8.5"; then
        echo -e "${YELLOW}$SCRIPT_INDEX PHP 8.5 symlink missing or incorrect, fixing...${NC}"

        if [ -f "/usr/bin/php8.5" ]; then
            $USE_SUDO update-alternatives --remove-all php 2>/dev/null || true
            $USE_SUDO update-alternatives --install /usr/bin/php php /usr/bin/php8.5 84
            $USE_SUDO update-alternatives --set php /usr/bin/php8.5
            echo -e "${GREEN}$SCRIPT_INDEX PHP 8.5 set as default${NC}"
        else
            echo -e "${RED}$SCRIPT_INDEX PHP 8.5 binary not found at /usr/bin/php8.5${NC}"
            echo -e "${YELLOW}$SCRIPT_INDEX Please run 31_ensure_php84_intelligent.sh first${NC}"
            return 1
        fi
    else
        echo -e "${GREEN}$SCRIPT_INDEX PHP 8.5 symlink already exists${NC}"
    fi

    if /usr/bin/php -v 2>/dev/null | grep -q "PHP 8.5"; then
        echo -e "${GREEN}$SCRIPT_INDEX ï¿?PHP 8.5 is available at /usr/bin/php${NC}"
        return 0
    else
        echo -e "${RED}$SCRIPT_INDEX Failed to set PHP 8.5 as default${NC}"
        return 1
    fi
}

uninstall_old_swoole() {
    echo -e "${BLUE}$SCRIPT_INDEX Checking for existing Swoole installation...${NC}"

    local swoole_version=$(php -r "echo phpversion('swoole');" 2>/dev/null)

    if [ -n "$swoole_version" ] && [ "$swoole_version" != "false" ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX Found existing Swoole version: $swoole_version${NC}"
        echo -e "${CYAN}$SCRIPT_INDEX Removing old Swoole installation...${NC}"

        # Try pecl uninstall first
        if command -v pecl >/dev/null 2>&1; then
            echo -e "${CYAN}$SCRIPT_INDEX Attempting PECL uninstall...${NC}"
            echo "" | $USE_SUDO pecl uninstall swoole 2>/dev/null || true
        fi

        # Remove swoole.so from extension directory
        local ext_dir=$(php -r "echo ini_get('extension_dir');" 2>/dev/null)
        if [ -n "$ext_dir" ] && [ -f "$ext_dir/swoole.so" ]; then
            echo -e "${CYAN}$SCRIPT_INDEX Removing $ext_dir/swoole.so${NC}"
            $USE_SUDO rm -f "$ext_dir/swoole.so"
        fi

        # Remove swoole.ini configuration
        local swoole_ini="/etc/php/8.5/mods-available/swoole.ini"
        if [ -f "$swoole_ini" ]; then
            echo -e "${CYAN}$SCRIPT_INDEX Removing $swoole_ini${NC}"
            $USE_SUDO rm -f "$swoole_ini"
        fi

        # Remove symlinks
        for sapi in cli fpm; do
            local link="/etc/php/8.5/$sapi/conf.d/20-swoole.ini"
            if [ -L "$link" ]; then
                echo -e "${CYAN}$SCRIPT_INDEX Removing $link${NC}"
                $USE_SUDO rm -f "$link"
            fi
        done

        # Verify removal
        if php -m 2>/dev/null | grep -q "swoole"; then
            echo -e "${YELLOW}$SCRIPT_INDEX Warning: Swoole still loaded, may require PHP restart${NC}"
        else
            echo -e "${GREEN}$SCRIPT_INDEX Old Swoole removed successfully${NC}"
        fi
    else
        echo -e "${CYAN}$SCRIPT_INDEX No existing Swoole installation found${NC}"
    fi

    return 0
}

install_swoole_dependencies() {
    echo -e "${BLUE}$SCRIPT_INDEX Installing Swoole build dependencies...${NC}"

    local deps=(
        "php8.5-dev"
        "php-pear"
        "build-essential"
        "libssl-dev"
        "libcurl4-openssl-dev"
        "libpcre3-dev"
        "libpq-dev"
    )

    $USE_SUDO apt-get update -qq
    $USE_SUDO apt-get install -y "${deps[@]}"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}$SCRIPT_INDEX Dependencies installed${NC}"

        ensure_php_symlink || return 1

        return 0
    else
        echo -e "${RED}$SCRIPT_INDEX Failed to install dependencies${NC}"
        return 1
    fi
}

install_swoole_pecl() {
    echo -e "${BLUE}$SCRIPT_INDEX Installing Swoole...${NC}"

    # Check PHP version
    local php_ver=$(php -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;" 2>/dev/null)
    
    # For PHP 8.5+, install from source (master) as PECL version is incompatible
    # Note: Swoole 6.x requires compatibility patch for Laravel Octane v2.13.x
    # The patch will be automatically applied by octane_swoole_compat_fixer.php
    if [[ "$php_ver" == "8.5" ]]; then
        echo -e "${YELLOW}$SCRIPT_INDEX PHP 8.5 detected. Building Swoole from source (master branch)...${NC}"
        echo -e "${CYAN}$SCRIPT_INDEX Note: Swoole 6.x will be patched for Octane v2.13.x compatibility${NC}"

        if ! command -v git >/dev/null 2>&1; then
            $USE_SUDO apt-get install -y git
        fi

        # Use GLOBAL_TEMP_DIR from gvar_common.sh
        local build_dir="$GLOBAL_TEMP_DIR/swoole-src-build-$$"
        rm -rf "$build_dir"

        echo -e "${CYAN}$SCRIPT_INDEX Cloning Swoole repository...${NC}"
        git clone --depth 1 https://github.com/swoole/swoole-src.git "$build_dir"
        
        if [ ! -d "$build_dir" ]; then
            echo -e "${RED}$SCRIPT_INDEX Failed to clone repository${NC}"
            return 1
        fi
        
        # Save current directory
        local original_dir=$(pwd)
        cd "$build_dir"
        
        echo -e "${CYAN}$SCRIPT_INDEX Compiling Swoole...${NC}"
        phpize
        ./configure --enable-openssl --enable-swoole-curl --enable-mysqlnd
        make -j$(nproc)
        
        if [ $? -ne 0 ]; then
            echo -e "${RED}$SCRIPT_INDEX Build failed${NC}"
            cd "$original_dir"
            return 1
        fi
        
        $USE_SUDO make install
        local install_status=$?
        
        cd "$original_dir"
        rm -rf "$build_dir"
        
        if [ $install_status -eq 0 ]; then
            echo -e "${GREEN}$SCRIPT_INDEX Swoole installed from source${NC}"
            return 0
        else
            echo -e "${RED}$SCRIPT_INDEX Installation failed${NC}"
            return 1
        fi
    fi

    # Fallback to PECL for older versions
    echo -e "${BLUE}$SCRIPT_INDEX Installing via PECL...${NC}"
    if ! command -v pecl >/dev/null 2>&1; then
        echo -e "${RED}$SCRIPT_INDEX PECL not found, installing php-pear...${NC}"
        $USE_SUDO apt-get install -y php-pear
    fi

    echo -e "${CYAN}$SCRIPT_INDEX Running: pecl install --force swoole${NC}"
    echo "" | $USE_SUDO pecl install --force swoole

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}$SCRIPT_INDEX Swoole installed via PECL${NC}"
        return 0
    else
        echo -e "${RED}$SCRIPT_INDEX PECL installation failed${NC}"
        return 1
    fi
}

enable_swoole_extension() {
    echo -e "${BLUE}$SCRIPT_INDEX Enabling Swoole extension...${NC}"

    local swoole_ini="/etc/php/8.5/mods-available/swoole.ini"

    if [ ! -f "$swoole_ini" ]; then
        echo -e "${CYAN}$SCRIPT_INDEX Creating $swoole_ini${NC}"
        echo "extension=swoole.so" | $USE_SUDO tee "$swoole_ini" > /dev/null
    fi

    $USE_SUDO phpenmod -v 8.5 swoole

    # Only check CLI - FPM is not installed when using Swoole
    for sapi in cli; do
        local link="/etc/php/8.5/$sapi/conf.d/20-swoole.ini"
        if [ ! -L "$link" ]; then
            echo -e "${CYAN}$SCRIPT_INDEX Creating symlink for $sapi${NC}"
            $USE_SUDO ln -sf "$swoole_ini" "$link"
        fi
    done

    echo -e "${GREEN}$SCRIPT_INDEX Swoole extension enabled${NC}"
    return 0
}

restart_php_fpm() {
    echo -e "${BLUE}$SCRIPT_INDEX [SKIPPED] PHP-FPM restart not needed - Using Swoole${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX Swoole runs independently, no FPM service required${NC}"
    # PHP-FPM is not installed when using Swoole with Laravel Octane
    return 0
}

verify_swoole() {
    echo -e "${BLUE}$SCRIPT_INDEX Verifying Swoole installation...${NC}"

    if php -m | grep -q "swoole"; then
        local swoole_version=$(php -r "echo phpversion('swoole');" 2>/dev/null || echo "unknown")
        echo -e "${GREEN}$SCRIPT_INDEX ï¿?Swoole installed successfully${NC}"
        echo -e "${GREEN}$SCRIPT_INDEX   Version: $swoole_version${NC}"

        echo ""
        echo -e "${CYAN}$SCRIPT_INDEX Swoole configuration:${NC}"
        php --ri swoole | head -20

        return 0
    else
        echo -e "${RED}$SCRIPT_INDEX ï¿?Swoole verification failed${NC}"
        return 1
    fi
}

check_octane_compatibility() {
    echo ""
    echo -e "${BLUE}$SCRIPT_INDEX Checking Laravel Octane compatibility...${NC}"

    # Get Laravel root using map_web_path
    local laravel_root=$(map_web_path "core_node" "poly_apps/laravel_main")

    if [ ! -d "$laravel_root" ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX Laravel not found at: $laravel_root, skipping compatibility check${NC}"
        return 0
    fi

    local fixer_script="$laravel_root/app/Support/OctaneSwooleCompatFixer.php"

    if [ ! -f "$fixer_script" ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX Compatibility fixer not found, skipping${NC}"
        return 0
    fi

    php "$fixer_script" "$laravel_root"

    return 0
}

main() {
    echo -e "${BLUE}$SCRIPT_INDEX Starting Swoole installation/configuration check...${NC}"
    echo ""

    local swoole_installed=false
    local config_valid=false

    check_swoole_installed && swoole_installed=true
    check_swoole_configuration && config_valid=true

    echo ""

    if $swoole_installed && $config_valid; then
        echo -e "${GREEN}$SCRIPT_INDEX Swoole is fully configured and working${NC}"

        # Check Swoole version and compatibility
        local swoole_version=$(php -r "echo phpversion('swoole');" 2>/dev/null)
        echo -e "${CYAN}$SCRIPT_INDEX Swoole version: $swoole_version${NC}"

        # Run compatibility check for Octane
        check_octane_compatibility

        echo -e "${GREEN}$SCRIPT_INDEX Nothing to do${NC}"
        exit 0
    elif $swoole_installed && ! $config_valid; then
        echo -e "${YELLOW}$SCRIPT_INDEX Swoole module is loaded but configuration needs repair${NC}"
        echo -e "${CYAN}$SCRIPT_INDEX Repairing Swoole configuration...${NC}"
        echo ""

        enable_swoole_extension || exit 1
        restart_php_fpm
        verify_swoole || exit 1
        check_octane_compatibility

        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}$SCRIPT_INDEX Swoole configuration repaired${NC}"
        echo -e "${GREEN}========================================${NC}"
    elif ! $swoole_installed && $config_valid; then
        echo -e "${YELLOW}$SCRIPT_INDEX Configuration exists but Swoole module not loaded${NC}"
        echo -e "${CYAN}$SCRIPT_INDEX This may indicate extension file is missing or PHP-FPM needs restart${NC}"
        echo -e "${CYAN}$SCRIPT_INDEX Reinstalling Swoole...${NC}"
        echo ""

        uninstall_old_swoole
        install_swoole_dependencies || exit 1
        install_swoole_pecl || exit 1
        enable_swoole_extension || exit 1
        restart_php_fpm
        verify_swoole || exit 1
        check_octane_compatibility

        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}$SCRIPT_INDEX Swoole reinstalled${NC}"
        echo -e "${GREEN}========================================${NC}"
    else
        echo -e "${YELLOW}$SCRIPT_INDEX Swoole not installed${NC}"
        echo -e "${CYAN}$SCRIPT_INDEX Performing fresh installation...${NC}"
        echo ""

        uninstall_old_swoole
        install_swoole_dependencies || exit 1
        install_swoole_pecl || exit 1
        enable_swoole_extension || exit 1
        restart_php_fpm
        verify_swoole || exit 1
        check_octane_compatibility

        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}$SCRIPT_INDEX Swoole installation completed${NC}"
        echo -e "${GREEN}========================================${NC}"
    fi

    echo ""
    echo -e "${CYAN}Next steps:${NC}"
    echo -e "  1. Install Laravel Octane: composer require laravel/octane"
    echo -e "  2. Publish config: php artisan octane:install --server=swoole"
    echo -e "  3. Start server: php artisan octane:start"
    echo ""
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
