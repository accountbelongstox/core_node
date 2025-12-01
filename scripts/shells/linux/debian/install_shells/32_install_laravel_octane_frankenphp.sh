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

# Script: 32_install_laravel_octane_frankenphp.sh
# Description: Install Laravel Octane with FrankenPHP (recommended over Swoole)
# Author: System Administrator
# Version: 1.0
#
# FrankenPHP advantages:
# - No PHP extension needed (binary auto-downloaded)
# - Modern features: HTTP/2, HTTP/3, early hints, Brotli, Zstandard
# - Written in Go, high performance
# - No API version conflicts
# - Easier maintenance

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_INDEX="[32_OCTANE]"

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}$SCRIPT_INDEX Laravel Octane with FrankenPHP${NC}"
echo -e "${CYAN}========================================${NC}"

check_php_installed() {
    echo -e "${BLUE}$SCRIPT_INDEX Checking PHP installation...${NC}"

    if ! command -v php >/dev/null 2>&1; then
        echo -e "${RED}$SCRIPT_INDEX PHP not found${NC}"
        echo -e "${YELLOW}$SCRIPT_INDEX Please run 31_ensure_php85_intelligent.sh first${NC}"
        return 1
    fi

    local php_version=$(php -v | head -n1)
    echo -e "${GREEN}$SCRIPT_INDEX PHP is installed: $php_version${NC}"

    if ! php -v | grep -q "PHP 8.5"; then
        echo -e "${YELLOW}$SCRIPT_INDEX Warning: PHP 8.5 recommended for best compatibility${NC}"
    fi

    return 0
}

check_composer_installed() {
    echo -e "${BLUE}$SCRIPT_INDEX Checking Composer installation...${NC}"

    if ! command -v composer >/dev/null 2>&1; then
        echo -e "${RED}$SCRIPT_INDEX Composer not found${NC}"
        echo -e "${YELLOW}$SCRIPT_INDEX Please run 34_install_composer.sh first${NC}"
        return 1
    fi

    local composer_version=$(composer --version | head -n1)
    echo -e "${GREEN}$SCRIPT_INDEX Composer is installed: $composer_version${NC}"
    return 0
}

remove_old_swoole() {
    echo -e "${BLUE}$SCRIPT_INDEX Checking for old Swoole installations...${NC}"

    # Remove old Swoole extension files from PHP 8.4
    if [ -f "/usr/lib/php/20240924/swoole.so" ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX Found old Swoole extension from PHP 8.4${NC}"
        $USE_SUDO rm -f /usr/lib/php/20240924/swoole.so
        echo -e "${GREEN}$SCRIPT_INDEX Removed old Swoole extension${NC}"
    fi

    # Disable Swoole configuration if exists
    if [ -f "/etc/php/8.5/mods-available/swoole.ini" ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX Disabling Swoole configuration${NC}"
        $USE_SUDO phpdismod -v 8.5 swoole 2>/dev/null || true
        echo -e "${GREEN}$SCRIPT_INDEX Swoole configuration disabled${NC}"
    fi

    echo -e "${GREEN}$SCRIPT_INDEX Old Swoole cleanup completed${NC}"
    return 0
}

show_installation_guide() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX Installation Instructions${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
    echo -e "${YELLOW}Navigate to your Laravel project directory and run:${NC}"
    echo ""
    echo -e "${GREEN}1. Install Laravel Octane:${NC}"
    echo -e "   ${CYAN}composer require laravel/octane${NC}"
    echo ""
    echo -e "${GREEN}2. Install FrankenPHP server:${NC}"
    echo -e "   ${CYAN}php artisan octane:install --server=frankenphp${NC}"
    echo ""
    echo -e "${GREEN}3. Start the server:${NC}"
    echo -e "   ${CYAN}php artisan octane:start --server=frankenphp${NC}"
    echo ""
    echo -e "${GREEN}4. For production with more workers:${NC}"
    echo -e "   ${CYAN}php artisan octane:start --server=frankenphp --workers=4 --max-requests=1000${NC}"
    echo ""
    echo -e "${BLUE}FrankenPHP Features:${NC}"
    echo -e "  - HTTP/2 and HTTP/3 support"
    echo -e "  - Early hints for better performance"
    echo -e "  - Brotli and Zstandard compression"
    echo -e "  - No PHP extension needed"
    echo -e "  - Automatic binary download and installation"
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo ""
    echo -e "${YELLOW}Alternative servers (if needed):${NC}"
    echo -e "  - RoadRunner: ${CYAN}php artisan octane:install --server=roadrunner${NC}"
    echo -e "  - Swoole: ${CYAN}Run 32_install_swoole.sh first${NC}"
    echo ""
}

main() {
    echo -e "${BLUE}$SCRIPT_INDEX Starting Laravel Octane (FrankenPHP) setup check...${NC}"
    echo ""

    # Check prerequisites
    if ! check_php_installed; then
        exit 1
    fi
    echo ""

    if ! check_composer_installed; then
        exit 1
    fi
    echo ""

    # Remove old Swoole if exists
    remove_old_swoole
    echo ""

    # Show installation guide
    show_installation_guide

    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}$SCRIPT_INDEX Setup check completed${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${CYAN}$SCRIPT_INDEX Prerequisites are met. Follow the instructions above to install Octane.${NC}"
    echo ""
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
