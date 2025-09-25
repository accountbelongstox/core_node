#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Declare all variables at the beginning of the file
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Script: 32_configure_php84.sh
# Description: PHP 8.4 configuration and web server integration
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
SCRIPT_INDEX="[32_PHP84_CONFIG]"

# Source global variables for constraint checking
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
source "$PARENT_DIR_LEVEL_2/LGar.sh"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Source PHP common variables and functions
source "$PARENT_DIR_LEVEL_1/debian_com/php_common_vars.sh"
source "$PARENT_DIR_LEVEL_1/debian_com/php_common_functions.sh"

# USE_SUDO is now sourced from gvar_common.sh

# Check for force refresh flag
FORCE_REFRESH=false
if [ "$1" = "--force" ] || [ "$1" = "-f" ]; then
    FORCE_REFRESH=true
    echo -e "${YELLOW}$SCRIPT_INDEX Force refresh mode enabled${NC}"
fi

# Check if PHP installation is enabled
INSTALL_PHP=$(get_var "INSTALL_PHP")
if [ "$INSTALL_PHP" != "true" ]; then
    echo -e "${YELLOW}$SCRIPT_INDEX PHP installation is disabled (INSTALL_PHP: $INSTALL_PHP). Skipping configuration.${NC}"
    exit 0
fi

# Check if Nginx is enabled for configuration
INSTALL_NGINX=$(get_global_var "INSTALL_NGINX" "false")
echo -e "${CYAN}$SCRIPT_INDEX INSTALL_NGINX: $INSTALL_NGINX${NC}"

# Configuration variables are now sourced from php_common_vars.sh

# Configure PHP-FPM - now using PHP common function
configure_php_fpm() {
    echo -e "${BLUE}$SCRIPT_INDEX [CONFIG] Configuring PHP-FPM pool...${NC}"
    
    # Ensure socket directory exists
    ensure_socket_directory_from_php_common "/run/php/php8.4-fpm.sock" "$SCRIPT_INDEX"
    
    # Configure PHP-FPM pool
    configure_php_fpm_pool_from_php_common "8.4" "/run/php/php8.4-fpm.sock" "$SCRIPT_INDEX"
    
    # Restart PHP-FPM service to apply changes
    echo -e "${YELLOW}$SCRIPT_INDEX Restarting PHP-FPM service...${NC}"
    if $USE_SUDO systemctl restart php8.4-fpm; then
        echo -e "${GREEN}$SCRIPT_INDEX PHP-FPM service restarted successfully${NC}"
    else
        echo -e "${YELLOW}$SCRIPT_INDEX PHP-FPM service restart failed, but continuing...${NC}"
    fi
    
    # Verify socket after restart
    verify_php_fpm_socket_from_php_common "/run/php/php8.4-fpm.sock" "$SCRIPT_INDEX"
}

    # Configure PHP for Laravel and system access - now using PHP common function
    configure_php_for_laravel() {
        configure_php_for_laravel_from_php_common "$SCRIPT_INDEX"
        
        # Verify open_basedir configuration
        verify_open_basedir_config_from_php_common "$SCRIPT_INDEX"
    }

# Set directory permissions for Laravel - now using PHP common function
set_directory_permissions() {
    set_directory_permissions_from_php_common "/www/wwwroot" "$SCRIPT_INDEX"
}

# 4.5 Setup PHP 8.4 as default - Following test_phpdoc.txt exactly
setup_php_default() {
    echo -e "${BLUE}$SCRIPT_INDEX [CONFIG] Setting up PHP 8.4 as default...${NC}"

    # Step 1: List installed PHP versions (as per documentation)
    echo -e "${YELLOW}$SCRIPT_INDEX Step 1: Listing installed PHP versions...${NC}"
    if [ -d "/etc/php" ]; then
        ls /etc/php
    fi

    # Step 2: Set PHP 8.4 as default system version (as per documentation)
    echo -e "${YELLOW}$SCRIPT_INDEX Step 2: Setting PHP 8.4 as default system version...${NC}"

    # Find PHP 8.4 binary
    local php84_binary="/usr/bin/php8.4"
    if [ -f "$php84_binary" ] && [ -x "$php84_binary" ]; then
        echo -e "${GREEN}$SCRIPT_INDEX Found PHP 8.4 binary: $php84_binary${NC}"

        # Use update-alternatives as per documentation
        if $USE_SUDO update-alternatives --install /usr/bin/php php /usr/bin/php8.4 84; then
            echo -e "${GREEN}$SCRIPT_INDEX PHP 8.4 set as default with priority 84${NC}"
        else
            echo -e "${RED}$SCRIPT_INDEX Failed to set PHP 8.4 as default${NC}"
            return 1
        fi

        # Verify the default
        local current_php=$(readlink /etc/alternatives/php 2>/dev/null || echo "not found")
        echo -e "${CYAN}$SCRIPT_INDEX Current PHP default: $current_php${NC}"

        if [ "$current_php" = "/usr/bin/php8.4" ]; then
            echo -e "${GREEN}$SCRIPT_INDEX PHP 8.4 is now the system default${NC}"
        else
            echo -e "${YELLOW}$SCRIPT_INDEX PHP 8.4 default verification failed${NC}"
        fi
    else
        echo -e "${RED}$SCRIPT_INDEX PHP 8.4 binary not found: $php84_binary${NC}"
        return 1
    fi

    # Step 3: Verify PHP version (as per documentation)
    echo -e "${YELLOW}$SCRIPT_INDEX Step 3: Verifying PHP version...${NC}"
    if command -v php >/dev/null 2>&1; then
        local php_version=$(php -v | head -1 | cut -d' ' -f2)
        echo -e "${GREEN}$SCRIPT_INDEX Current PHP version: $php_version${NC}"

        if [[ "$php_version" == "8.4"* ]]; then
            echo -e "${GREEN}$SCRIPT_INDEX PHP 8.4 is active and working${NC}"
        else
            echo -e "${YELLOW}$SCRIPT_INDEX PHP version mismatch: expected 8.4.x, got $php_version${NC}"
        fi
    else
        echo -e "${RED}$SCRIPT_INDEX PHP command not available${NC}"
        return 1
    fi

    # Step 4: Verify PHP modules (as per documentation)
    echo -e "${YELLOW}$SCRIPT_INDEX Step 4: Verifying PHP modules...${NC}"
    if command -v php >/dev/null 2>&1; then
        local module_count=$(php -m 2>/dev/null | wc -l || echo "0")
        echo -e "${GREEN}$SCRIPT_INDEX Active PHP modules count: $module_count${NC}"

        # Show some key modules
        echo -e "${CYAN}$SCRIPT_INDEX Key modules status:${NC}"
        for module in "curl" "mbstring" "xml" "zip" "gd" "mysqli" "opcache"; do
            if php -m 2>/dev/null | grep -qi "^$module$"; then
                echo -e "${GREEN}$SCRIPT_INDEX   $module: [OK]${NC}"
            else
                echo -e "${YELLOW}$SCRIPT_INDEX   $module: [Missing]${NC}"
            fi
        done
    fi

    echo -e "${GREEN}$SCRIPT_INDEX PHP 8.4 default setup completed successfully${NC}"
}

# Update Nginx configuration - now using PHP common function
update_nginx_config() {
    update_nginx_config_from_php_common "8.4" "$SCRIPT_INDEX"
}

# Update Caddy configuration - now using PHP common function
update_caddy_config() {
    update_caddy_config_from_php_common "8.4" "$SCRIPT_INDEX"
}

# MAIN EXECUTION

main() {
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX PHP 8.4 Configuration System${NC}"
    echo -e "${CYAN}============================================================================${NC}"
    
    if [ "$FORCE_REFRESH" = true ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX Force refreshing PHP 8.4 configuration...${NC}"
    else
        echo -e "${YELLOW}$SCRIPT_INDEX Starting PHP 8.4 configuration...${NC}"
    fi

    # Step 1: Configure PHP-FPM
    configure_php_fpm || {
        echo -e "${YELLOW}$SCRIPT_INDEX PHP-FPM configuration completed with warnings${NC}"
    }

    # Step 2: Configure PHP for Laravel (always refresh open_basedir)
    configure_php_for_laravel || {
        echo -e "${YELLOW}$SCRIPT_INDEX PHP Laravel configuration completed with warnings${NC}"
    }

    # Step 3: Set directory permissions
    set_directory_permissions || {
        echo -e "${YELLOW}$SCRIPT_INDEX Directory permissions set with warnings${NC}"
    }

    # Step 4: Set PHP 8.4 as default
    setup_php_default || {
        echo -e "${RED}$SCRIPT_INDEX PHP 8.4 default setup failed${NC}"
        return 1
    }

    # Step 5: Update web server configurations
    if [ "$INSTALL_NGINX" = "true" ]; then
        update_nginx_config || {
            echo -e "${YELLOW}$SCRIPT_INDEX Nginx configuration completed with warnings${NC}"
        }
    fi

    # Check for Caddy (if installed)
    if command -v caddy >/dev/null 2>&1; then
        update_caddy_config || {
            echo -e "${YELLOW}$SCRIPT_INDEX Caddy configuration completed with warnings${NC}"
        }
    fi

    echo -e "${GREEN}$SCRIPT_INDEX PHP 8.4 configuration completed successfully${NC}"
}

# Execute main function
main "$@"
