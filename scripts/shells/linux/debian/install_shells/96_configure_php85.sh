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

# Script: 96_configure_php85.sh
# Description: PHP 8.5 configuration and web server integration
# Author: System Administrator
# Version: 1.0
# Design: Based on SHELL_INSTALLATION_DEVELOPMENT_GUIDE.md principles
#
# ============================================================================
# IMPORTANT: RELATIONSHIP WITH ServerManagerV1PHPConfigFixer.php
# ============================================================================
#
# This shell script is the INSTALLATION-TIME equivalent of the PHP runtime
# configuration fixer located at:
#
#   Relative path from this file: ../../../../poly_apps/laravel_main/app/Apps/ServerManagerV1/ServerManagerV1Utils/ServerManagerV1PHPConfigFixer.php
#   Absolute path: /www/programing/core_node/poly_apps/laravel_main/app/Apps/ServerManagerV1/ServerManagerV1Utils/ServerManagerV1PHPConfigFixer.php
#
# PURPOSE AND INTENT:
# ------------------
# Both scripts serve the SAME CRITICAL PURPOSE: ensuring PHP-FPM can access
# Laravel files by configuring open_basedir settings correctly based on the
# current environment and path mapping.
#
# This shell script (96_configure_php85.sh):
#   - Used during system installation and setup
#   - Can be run manually or via installation scripts
#   - Uses gvar_common.sh for path mapping (map_web_path function)
#   - Modifies /etc/php/8.5/cli/php.ini and /etc/php/8.5/fpm/php.ini
#   - Modifies /etc/php/8.5/fpm/pool.d/www.conf via php_common_functions.sh
#   - Requires sudo/root privileges
#
# ServerManagerV1PHPConfigFixer.php:
#   - Used as a RUNTIME PRE-REQUISITE before any ServerManagerV1 operations
#   - Called automatically from Laravel Artisan commands or API endpoints
#   - Uses PathMapper for path mapping (must match gvar_common.sh logic)
#   - Modifies the same PHP configuration files
#   - Requires appropriate file permissions (may need sudo for file operations)
#
# PATH MAPPING CONSISTENCY REQUIREMENT:
# -------------------------------------
# Both scripts MUST use IDENTICAL path mapping logic. The path mapping is
# implemented in two places that MUST be kept in sync:
#
# Shell script path mapping:
#   - Uses: gvar_common.sh -> map_web_path() -> get_base_data_directory()
#   - Location: ../../common/gvar_common.sh (relative to this file)
#
# PHP class path mapping:
#   - Uses: PathMapper::mapWebPath() -> getBaseDataDirectory()
#   - Location: ../../../../poly_apps/laravel_main/app/Providers/PathMapper.php
#
# The path mapping logic MUST produce the same results:
#   - WSL environment: /mnt/d/programing/core_node/poly_apps/laravel_main
#   - Production:      /www/programing/core_node/poly_apps/laravel_main
#   - Development:     (same as WSL or production based on environment detection)
#
# KEY DIFFERENCES:
# ----------------
# 1. Configuration Files Modified:
#    Shell script: /etc/php/8.5/cli/php.ini, /etc/php/8.5/fpm/php.ini,
#                  /etc/php/8.5/fpm/pool.d/www.conf
#    PHP class:    Same files (via php_common_functions.sh and direct modification)
#
# 2. Execution Context:
#    Shell script: Runs during installation, can be run manually
#    PHP class:    Runs as pre-requisite before ServerManagerV1 operations
#
# 3. Path Mapping Source:
#    Shell script: gvar_common.sh map_web_path()
#    PHP class:    PathMapper::mapWebPath()
#
# SYNC REQUIREMENTS (CRITICAL):
# -----------------------------
# If you modify ANY of the following, you MUST update the corresponding files:
#
# [ ] gvar_common.sh map_web_path() changes
#     -> Update PathMapper::mapWebPath() in PathMapper.php
#
# [ ] PathMapper::mapWebPath() changes
#     -> Update gvar_common.sh map_web_path()
#
# [ ] 96_configure_php85.sh changes (especially open_basedir handling)
#     -> Update ServerManagerV1PHPConfigFixer.php comments and logic
#
# [ ] ServerManagerV1PHPConfigFixer.php changes
#     -> Update 96_configure_php85.sh comments (this file)
#
# [ ] php_common_functions.sh configure_php_fpm_pool_from_php_common() changes
#     -> Update ServerManagerV1PHPConfigFixer::fixPHPFpmPoolConfig()
#
# MODIFICATION CHECKLIST:
# -----------------------
# When modifying this file, ensure you also check/update:
# [ ] ServerManagerV1PHPConfigFixer.php (relative path: ../../../../poly_apps/laravel_main/app/Apps/ServerManagerV1/ServerManagerV1Utils/ServerManagerV1PHPConfigFixer.php)
# [ ] gvar_common.sh (relative path: ../../common/gvar_common.sh)
# [ ] PathMapper.php (relative path: ../../../../poly_apps/laravel_main/app/Providers/PathMapper.php)
# [ ] php_common_functions.sh (relative path: ../debian_com/php_common_functions.sh)
#
# ============================================================================

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script identification
SCRIPT_INDEX="[96_PHP85_CONFIG]"

# Source global variables for constraint checking
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Source PHP common variables and functions
source "$PARENT_DIR_LEVEL_1/debian_com/php_common_vars.sh"
source "$PARENT_DIR_LEVEL_1/debian_com/php_common_functions.sh"


# Check for force refresh flag
FORCE_REFRESH=false
if [ "$1" = "--force" ] || [ "$1" = "-f" ]; then
    FORCE_REFRESH=true
    echo -e "${YELLOW}$SCRIPT_INDEX Force refresh mode enabled${NC}"
fi

# Check if Nginx is enabled for configuration - derived from the [W] plane
# mutex constant (legacy INSTALL_NGINX key is retired; frankenphp plane
# never configures the nginx frontend).
INSTALL_NGINX="false"
[ "$(web_server_plane)" = "nginx" ] && INSTALL_NGINX="true"
echo -e "${CYAN}$SCRIPT_INDEX INSTALL_NGINX: $INSTALL_NGINX (plane: $(web_server_plane))${NC}"

# Configuration variables are now sourced from php_common_vars.sh

# Configure PHP-FPM - DISABLED (using Swoole)
configure_php_fpm() {
    echo -e "${BLUE}$SCRIPT_INDEX [INFO] Skipping PHP-FPM configuration - Using Swoole with Laravel Octane${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX PHP-FPM is not needed when using Swoole${NC}"
    return 0
}

# Configure PHP for Laravel and system access - now using PHP common function
#
# IMPORTANT: This function must match the behavior of ServerManagerV1PHPConfigFixer::fixPHPIniFiles()
#
# RELATIONSHIP WITH ServerManagerV1PHPConfigFixer.php:
# =====================================================
#
# This function calls configure_php_for_laravel_from_php_common() which:
#   - Removes open_basedir restrictions from /etc/php/8.5/cli/php.ini
#   - Sets open_basedir = none in CLI php.ini
#
# Note: FPM php.ini is NOT configured since we use Swoole instead of FPM
#
# This matches ServerManagerV1PHPConfigFixer::fixPHPIniFiles() behavior.
#
# See: ../../../../poly_apps/laravel_main/app/Apps/ServerManagerV1/ServerManagerV1Utils/ServerManagerV1PHPConfigFixer.php
#
# Both must produce the same result: open_basedir restrictions disabled to allow
# Laravel files to be accessed regardless of path mapping changes.
configure_php_for_laravel() {
    configure_php_for_laravel_from_php_common "$SCRIPT_INDEX"

    # Verify open_basedir configuration
    # This verification ensures the configuration matches what ServerManagerV1PHPConfigFixer
    # would produce, maintaining consistency between installation-time and runtime fixes.
    verify_open_basedir_config_from_php_common "$SCRIPT_INDEX"
}

# Set directory permissions for Laravel - now using PHP common function
set_directory_permissions() {
    # Use path mapping from gvar_common.sh to support WSL Windows directories
    local www_root=$(map_web_path "wwwroot")
    set_directory_permissions_from_php_common "$www_root" "$SCRIPT_INDEX"
}

# 4.5 Setup PHP 8.5 as default - Following test_phpdoc.txt exactly
setup_php_default() {
    echo -e "${BLUE}$SCRIPT_INDEX [CONFIG] Setting up PHP 8.5 as default...${NC}"

    # Step 1: List installed PHP versions (as per documentation)
    echo -e "${YELLOW}$SCRIPT_INDEX Step 1: Listing installed PHP versions...${NC}"
    if [ -d "/etc/php" ]; then
        ls /etc/php
    fi

    # Step 2: Set PHP 8.5 as default system version (as per documentation)
    echo -e "${YELLOW}$SCRIPT_INDEX Step 2: Setting PHP 8.5 as default system version...${NC}"

    # Find PHP 8.5 binary
    local php85_binary="$PHP_BIN"
    if [ -f "$php85_binary" ] && [ -x "$php85_binary" ]; then
        echo -e "${GREEN}$SCRIPT_INDEX Found PHP 8.5 binary: $php85_binary${NC}"

        # Remove all existing PHP alternatives first to ensure clean state
        echo -e "${YELLOW}$SCRIPT_INDEX Removing all existing PHP alternatives...${NC}"
        $USE_SUDO update-alternatives --remove-all php 2>/dev/null || true

        # Use update-alternatives as per documentation
        echo -e "${YELLOW}$SCRIPT_INDEX Adding only PHP ${PHP_VERSION} to alternatives...${NC}"
        if $USE_SUDO update-alternatives --install /usr/bin/php php "$php85_binary" "$PHP_ALT_PRIORITY"; then
            echo -e "${GREEN}$SCRIPT_INDEX PHP ${PHP_VERSION} added to alternatives with priority ${PHP_ALT_PRIORITY}${NC}"

            # Explicitly set PHP 8.5 as the default
            $USE_SUDO update-alternatives --set php "$php85_binary" 2>/dev/null || true
            echo -e "${GREEN}$SCRIPT_INDEX PHP 8.5 explicitly set as default${NC}"
        else
            echo -e "${RED}$SCRIPT_INDEX Failed to set PHP 8.5 as default${NC}"
            return 1
        fi

        # Verify the default
        local current_php=$(readlink /etc/alternatives/php 2>/dev/null || echo "not found")
        echo -e "${CYAN}$SCRIPT_INDEX Current PHP default: $current_php${NC}"

        if [ "$current_php" = "/usr/bin/php8.5" ]; then
            echo -e "${GREEN}$SCRIPT_INDEX PHP 8.5 is now the system default �?{NC}"
        else
            echo -e "${YELLOW}$SCRIPT_INDEX PHP 8.5 default verification failed${NC}"
        fi
    else
        echo -e "${RED}$SCRIPT_INDEX PHP 8.5 binary not found: $php85_binary${NC}"
        return 1
    fi

    # Step 3: Verify PHP version (as per documentation)
    echo -e "${YELLOW}$SCRIPT_INDEX Step 3: Verifying PHP version...${NC}"
    if command -v php >/dev/null 2>&1; then
        local php_version=$(php -v | head -1 | cut -d' ' -f2)
        echo -e "${GREEN}$SCRIPT_INDEX Current PHP version: $php_version${NC}"

        if [[ "$php_version" == "8.5"* ]]; then
            echo -e "${GREEN}$SCRIPT_INDEX PHP 8.5 is active and working �?{NC}"
        else
            echo -e "${YELLOW}$SCRIPT_INDEX PHP version mismatch: expected 8.5.x, got $php_version${NC}"
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
        # Drive the check from the canonical REQUIRED_EXTENSIONS/EXTENSION_MAP so this
        # step verifies exactly the modules step 31 installs (no divergent hardcoded list).
        echo -e "${CYAN}$SCRIPT_INDEX Key modules status:${NC}"
        for ext in "${REQUIRED_EXTENSIONS[@]}"; do
            local module="${EXTENSION_MAP[$ext]:-$ext}"
            if php -m 2>/dev/null | grep -qi "^${module}$"; then
                echo -e "${GREEN}$SCRIPT_INDEX   $module: [OK]${NC}"
            else
                echo -e "${YELLOW}$SCRIPT_INDEX   $module: [Missing]${NC}"
            fi
        done
    fi

    # Step 5: Verify no other PHP versions are in alternatives
    echo -e "${YELLOW}$SCRIPT_INDEX Step 5: Verifying alternatives configuration...${NC}"
    if update-alternatives --query php >/dev/null 2>&1; then
        local alternatives_list=$(update-alternatives --list php 2>/dev/null || echo "")
        local alternatives_count=$(echo "$alternatives_list" | wc -l)

        if [ $alternatives_count -eq 1 ] && echo "$alternatives_list" | grep -q "php8.5"; then
            echo -e "${GREEN}$SCRIPT_INDEX Only PHP 8.5 is in alternatives �?{NC}"
        else
            echo -e "${YELLOW}$SCRIPT_INDEX Warning: Multiple PHP versions in alternatives:${NC}"
            echo "$alternatives_list"
        fi
    fi

    echo -e "${GREEN}$SCRIPT_INDEX PHP 8.5 default setup completed successfully${NC}"
}

# Update Nginx configuration - now using PHP common function
update_nginx_config() {
    update_nginx_config_from_php_common "8.5" "$SCRIPT_INDEX"
}

# Update Caddy configuration - now using PHP common function
update_caddy_config() {
    update_caddy_config_from_php_common "8.5" "$SCRIPT_INDEX"
}

# MAIN EXECUTION

main() {
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}$SCRIPT_INDEX PHP 8.5 Configuration System (Precision Repair Mode)${NC}"
    echo -e "${CYAN}============================================================================${NC}"

    if [ "$FORCE_REFRESH" = true ]; then
        echo -e "${YELLOW}$SCRIPT_INDEX Force refreshing PHP 8.5 configuration...${NC}"
    else
        echo -e "${YELLOW}$SCRIPT_INDEX Starting PHP 8.5 configuration...${NC}"
    fi

    echo -e "${CYAN}$SCRIPT_INDEX [PRECISION MODE] Running ALL configuration steps regardless of current state${NC}"

    # Step 1: Configure PHP-FPM (ALWAYS run - 精细化修复第1�?
    echo -e "${BLUE}$SCRIPT_INDEX [STEP 1/5] Configuring PHP-FPM...${NC}"
    configure_php_fpm || {
        echo -e "${YELLOW}$SCRIPT_INDEX PHP-FPM configuration completed with warnings${NC}"
    }

    # Step 2: Configure PHP for Laravel (ALWAYS run - 精细化修复第2�?
    echo -e "${BLUE}$SCRIPT_INDEX [STEP 2/5] Configuring PHP for Laravel...${NC}"
    configure_php_for_laravel || {
        echo -e "${YELLOW}$SCRIPT_INDEX PHP Laravel configuration completed with warnings${NC}"
    }

    # Step 3: Set directory permissions (ALWAYS run - 精细化修复第3�?
    echo -e "${BLUE}$SCRIPT_INDEX [STEP 3/5] Setting directory permissions...${NC}"
    set_directory_permissions || {
        echo -e "${YELLOW}$SCRIPT_INDEX Directory permissions set with warnings${NC}"
    }

    # Step 4: Set PHP 8.5 as default (ALWAYS run - 精细化修复第4�?
    echo -e "${BLUE}$SCRIPT_INDEX [STEP 4/5] Setting PHP 8.5 as default...${NC}"
    setup_php_default || {
        echo -e "${YELLOW}$SCRIPT_INDEX PHP 8.5 default setup completed with warnings${NC}"
    }

    # Step 5: Update web server configurations (ALWAYS check - 精细化修复第5�?
    echo -e "${BLUE}$SCRIPT_INDEX [STEP 5/5] Updating web server configurations...${NC}"
    if [ "$INSTALL_NGINX" = "true" ]; then
        update_nginx_config || {
            echo -e "${YELLOW}$SCRIPT_INDEX Nginx configuration completed with warnings${NC}"
        }
    else
        echo -e "${CYAN}$SCRIPT_INDEX Nginx not enabled, skipping Nginx config${NC}"
    fi

    # Check for Caddy (if installed)
    if command -v caddy >/dev/null 2>&1; then
        echo -e "${CYAN}$SCRIPT_INDEX Caddy detected, updating Caddy configuration...${NC}"
        update_caddy_config || {
            echo -e "${YELLOW}$SCRIPT_INDEX Caddy configuration completed with warnings${NC}"
        }
    else
        echo -e "${CYAN}$SCRIPT_INDEX Caddy not detected, skipping Caddy config${NC}"
    fi

    echo -e "${GREEN}$SCRIPT_INDEX [SUCCESS] All PHP 8.5 configuration steps completed${NC}"
}

# PHP-runtime plane gate (DESIGN_20260817_2115 PART_0 §0.7): plane-aware
# config targets. frankenphp plane configures the Caddyfile-adjacent PHP
# ini (scan dir exported as PHP_INI_SCAN_DIR by the runtime branch) and
# keeps the plane-invariant Laravel directory permissions - NO /etc/php
# edits, NO alternatives. The system plane keeps the classic flow below.
CONFIG_RUNTIME_PLANE=""
# shellcheck source=/dev/null
source "$PARENT_DIR_LEVEL_2/common/octane_service_manager.sh"
# shellcheck source=/dev/null
source "$PARENT_DIR_LEVEL_2/common/frankenphp_manager.sh"
CONFIG_RUNTIME_PLANE="$(php_runtime_plane)"
if [ "$CONFIG_RUNTIME_PLANE" = "frankenphp" ]; then
    echo -e "${CYAN}$SCRIPT_INDEX PHP runtime plane: frankenphp (Caddyfile-adjacent ini)${NC}"
    fm_php_ini_ensure
    set_directory_permissions || {
        echo -e "${YELLOW}$SCRIPT_INDEX Directory permissions set with warnings${NC}"
    }
    echo -e "${GREEN}$SCRIPT_INDEX FrankenPHP plane PHP configured: ini scan dir $(fm_php_ini_dir) (runtime exports PHP_INI_SCAN_DIR)${NC}"
    exit 0
fi

# Execute main function
main "$@"
