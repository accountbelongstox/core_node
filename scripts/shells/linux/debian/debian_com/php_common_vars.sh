#!/bin/bash
# PHP Common Variables for Debian/Ubuntu PHP Installation Scripts
# This file contains shared variables used across PHP-related installation scripts

# Source gvar_common.sh to get map_web_path function
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

# PHP Version Configuration
PHP_VERSION="8.5"
PHP_BINARY_NAME="php"
# NO FPM - using Swoole for Laravel Octane
# PHP_FPM_SERVICE=""  # Not used
# PHP_FPM_SOCKET_PATH=""  # Not used
TARGET_LINK_PATH="/usr/local/bin/php"

# PHP 8.5 specific packages (NO FPM - using Swoole)
# Note: opcache is now a core extension in PHP 8.5, no separate package needed
<<<<<<< HEAD
PHP85_CORE_PACKAGES=(
    "php8.5"
=======
# IMPORTANT: Do NOT include "php8.5" metapackage as it pulls in php8.5-fpm
# We only need CLI for Swoole-based Laravel Octane
PHP85_CORE_PACKAGES=(
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
    "php8.5-cli"
    "php8.5-common"
)

# PHP 8.5 extensions for Laravel support (NO FPM - using Swoole)
# Note: opcache is bundled in PHP 8.5, no php8.5-opcache package exists
<<<<<<< HEAD
CORE_EXTENSIONS=(
    "php8.5-cli"
    "php8.5-common"
=======
# Note: php8.5-cli and php8.5-common are already in PHP85_CORE_PACKAGES, not listed here
CORE_EXTENSIONS=(
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
    "php8.5-mysql"
    "php8.5-sqlite3"
    "php8.5-xml"
    "php8.5-curl"
    "php8.5-zip"
    "php8.5-mbstring"
    "php8.5-gd"
    "php8.5-intl"
    "php8.5-bcmath"
    "php8.5-readline"
)

# Extension mapping: package_name -> module_name
declare -A EXTENSION_MAP=(
    ["curl"]="curl"
    ["mbstring"]="mbstring"
    ["xml"]="xml"
    ["zip"]="zip"
    ["gd"]="gd"
    ["mysql"]="mysqli"
    ["sqlite3"]="sqlite3"
    ["opcache"]="Zend OPcache"
    ["intl"]="intl"
    ["bcmath"]="bcmath"
)

REQUIRED_EXTENSIONS=("curl" "mbstring" "xml" "zip" "gd" "mysql" "sqlite3" "opcache" "intl" "bcmath")

# Laravel Octane Support - PECL Extensions
OCTANE_PECL_EXTENSIONS=(
    "swoole"
    "openswoole"
)

# Octane extension mapping: pecl_name -> module_name
declare -A OCTANE_EXTENSION_MAP=(
    ["swoole"]="swoole"
    ["openswoole"]="openswoole"
)

# PHP State Definitions
declare -A PHP_STATE=(
    ["FULLY_CONFIGURED"]="Fully configured and operational"
    ["MISSING"]="Not installed"
    ["LINKED_WRONG_VERSION"]="Installed but linked to wrong version"
    ["FPM_NOT_RUNNING"]="Installed but FPM not running"
    ["FPM_NOT_INSTALLED"]="Installed but FPM not installed"
    ["EXTENSIONS_MISSING"]="Installed but missing required extensions"
    ["LINKED_BROKEN"]="Installed but symlink is broken"
    ["INSTALLED_NO_LINK"]="Installed but not linked to /usr/local/bin"
)

# Binary detection states
declare -A BINARY_STATES=(
    ["PHP_MISSING"]="PHP binary not found"
    ["PHP_WRONG_VERSION"]="PHP version mismatch"
    ["FPM_NOT_RUNNING"]="PHP-FPM service not running"
    ["FPM_NOT_INSTALLED"]="PHP-FPM not installed"
    ["EXTENSIONS_MISSING"]="Required PHP extensions missing"
    ["LINKED_BROKEN"]="Symlink broken or pointing to wrong version"
    ["COMPOSER_MISSING"]="Composer not found"
)

# Composer Configuration
COMPOSER_TARGET_PATH="/usr/local/bin/composer"
COMPOSER_DOWNLOAD_URL="https://getcomposer.org/installer"
COMPOSER_SAFE_PATH="/usr/local/bin/composer-safe"

# Open Basedir Configuration - Disabled by default for maximum compatibility
# Set to empty string to disable open_basedir restrictions (will be set to "none" in PHP config)
OPEN_BASEDIR_PATHS=""

# PHP Configuration Files (FPM not used - using Swoole)
PHP_INI_FILES=(
    "/etc/php/8.5/cli/php.ini"
)

# Web Server Configuration - Use map_web_path for proper path mapping
NGINX_CONFIG_DIR=$(map_web_path "nginxconfig" "sites-available")
NGINX_ENABLED_DIR=$(map_web_path "nginxconfig" "sites-enabled")
WWW_ROOT=$(map_web_path "wwwroot")

# Function to get open_basedir setting - disabled by default
get_open_basedir_setting() {
    # Return empty string to disable open_basedir restrictions
    echo ""
}

# Function to get minimal open_basedir (for maximum compatibility)
get_minimal_open_basedir() {
    # Return empty string to disable open_basedir restrictions
    echo ""
}
