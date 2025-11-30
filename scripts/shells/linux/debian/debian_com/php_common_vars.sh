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
PHP_FPM_SERVICE="php8.5-fpm"
PHP_FPM_SOCKET_PATH="/run/php/php8.5-fpm.sock"
TARGET_LINK_PATH="/usr/local/bin/php"

# PHP 8.5 specific packages as per documentation
PHP85_CORE_PACKAGES=(
    "php8.5"
    "php8.5-cli"
    "php8.5-fpm"
    "php8.5-common"
)

# PHP 8.5 extensions for Laravel support (used in installation and configuration)
CORE_EXTENSIONS=(
    "php8.5-cli"
    "php8.5-fpm"
    "php8.5-common"
    "php8.5-opcache"
    "php8.5-mysql"
    "php8.5-sqlite3"
    "php8.5-xml"
    "php8.5-curl"
    "php8.5-zip"
    "php8.5-mbstring"
    "php8.5-gd"
    "php8.5-intl"
    "php8.5-bcmath"
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

# PHP Configuration Files
PHP_INI_FILES=(
    "/etc/php/8.5/cli/php.ini"
    "/etc/php/8.5/fpm/php.ini"
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
