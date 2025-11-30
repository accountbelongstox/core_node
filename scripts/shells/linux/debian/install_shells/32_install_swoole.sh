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
# Description: Install Swoole extension for PHP 8.4 and Laravel Octane support
# Author: System Administrator
# Version: 1.0

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

    local swoole_so="/usr/lib/php/20240924/swoole.so"

    if [ -f "$swoole_so" ]; then
        echo -e "${GREEN}$SCRIPT_INDEX Swoole extension file exists: $swoole_so${NC}"

        if php -m | grep -q "swoole"; then
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
    local swoole_ini="/etc/php/8.4/mods-available/swoole.ini"

    if [ ! -f "$swoole_ini" ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX Configuration file missing: $swoole_ini${NC}"
        config_valid=false
    else
        echo -e "${GREEN}$SCRIPT_INDEX Configuration file exists: $swoole_ini${NC}"
    fi

    for sapi in cli fpm; do
        local link="/etc/php/8.4/$sapi/conf.d/20-swoole.ini"
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

install_swoole_dependencies() {
    echo -e "${BLUE}$SCRIPT_INDEX Installing Swoole build dependencies...${NC}"

    local deps=(
        "php8.4-dev"
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
        return 0
    else
        echo -e "${RED}$SCRIPT_INDEX Failed to install dependencies${NC}"
        return 1
    fi
}

install_swoole_pecl() {
    echo -e "${BLUE}$SCRIPT_INDEX Installing Swoole via PECL...${NC}"

    if ! command -v pecl >/dev/null 2>&1; then
        echo -e "${RED}$SCRIPT_INDEX PECL not found, installing php-pear...${NC}"
        $USE_SUDO apt-get install -y php-pear
    fi

    echo -e "${CYAN}$SCRIPT_INDEX Running: pecl install swoole${NC}"
    echo "" | $USE_SUDO pecl install swoole

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

    local swoole_ini="/etc/php/8.4/mods-available/swoole.ini"

    if [ ! -f "$swoole_ini" ]; then
        echo -e "${CYAN}$SCRIPT_INDEX Creating $swoole_ini${NC}"
        echo "extension=swoole.so" | $USE_SUDO tee "$swoole_ini" > /dev/null
    fi

    $USE_SUDO phpenmod -v 8.4 swoole

    for sapi in cli fpm; do
        local link="/etc/php/8.4/$sapi/conf.d/20-swoole.ini"
        if [ ! -L "$link" ]; then
            echo -e "${CYAN}$SCRIPT_INDEX Creating symlink for $sapi${NC}"
            $USE_SUDO ln -sf "$swoole_ini" "$link"
        fi
    done

    echo -e "${GREEN}$SCRIPT_INDEX Swoole extension enabled${NC}"
    return 0
}

restart_php_fpm() {
    echo -e "${BLUE}$SCRIPT_INDEX Restarting PHP-FPM...${NC}"

    if systemctl is-active --quiet php8.4-fpm; then
        $USE_SUDO systemctl restart php8.4-fpm
        echo -e "${GREEN}$SCRIPT_INDEX PHP-FPM restarted${NC}"
    else
        echo -e "${YELLOW}$SCRIPT_INDEX PHP-FPM not running, skipping restart${NC}"
    fi
}

verify_swoole() {
    echo -e "${BLUE}$SCRIPT_INDEX Verifying Swoole installation...${NC}"

    if php -m | grep -q "swoole"; then
        local swoole_version=$(php -r "echo phpversion('swoole');" 2>/dev/null || echo "unknown")
        echo -e "${GREEN}$SCRIPT_INDEX âœ?Swoole installed successfully${NC}"
        echo -e "${GREEN}$SCRIPT_INDEX   Version: $swoole_version${NC}"

        echo ""
        echo -e "${CYAN}$SCRIPT_INDEX Swoole configuration:${NC}"
        php --ri swoole | head -20

        return 0
    else
        echo -e "${RED}$SCRIPT_INDEX âœ?Swoole verification failed${NC}"
        return 1
    fi
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
        echo -e "${GREEN}$SCRIPT_INDEX Nothing to do${NC}"
        exit 0
    elif $swoole_installed && ! $config_valid; then
        echo -e "${YELLOW}$SCRIPT_INDEX Swoole module is loaded but configuration needs repair${NC}"
        echo -e "${CYAN}$SCRIPT_INDEX Repairing Swoole configuration...${NC}"
        echo ""

        enable_swoole_extension || exit 1
        restart_php_fpm
        verify_swoole || exit 1

        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}$SCRIPT_INDEX Swoole configuration repaired${NC}"
        echo -e "${GREEN}========================================${NC}"
    elif ! $swoole_installed && $config_valid; then
        echo -e "${YELLOW}$SCRIPT_INDEX Configuration exists but Swoole module not loaded${NC}"
        echo -e "${CYAN}$SCRIPT_INDEX This may indicate extension file is missing or PHP-FPM needs restart${NC}"
        echo -e "${CYAN}$SCRIPT_INDEX Reinstalling Swoole...${NC}"
        echo ""

        install_swoole_dependencies || exit 1
        install_swoole_pecl || exit 1
        enable_swoole_extension || exit 1
        restart_php_fpm
        verify_swoole || exit 1

        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}$SCRIPT_INDEX Swoole reinstalled${NC}"
        echo -e "${GREEN}========================================${NC}"
    else
        echo -e "${YELLOW}$SCRIPT_INDEX Swoole not installed${NC}"
        echo -e "${CYAN}$SCRIPT_INDEX Performing fresh installation...${NC}"
        echo ""

        install_swoole_dependencies || exit 1
        install_swoole_pecl || exit 1
        enable_swoole_extension || exit 1
        restart_php_fpm
        verify_swoole || exit 1

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
