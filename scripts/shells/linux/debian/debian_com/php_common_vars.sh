#!/bin/bash

PHP_COMMON_VARS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PHP_COMMON_VARS_LINUX_DIR="$(dirname "$(dirname "$PHP_COMMON_VARS_DIR")")"

source "$PHP_COMMON_VARS_LINUX_DIR/common/gvar_common.sh"

PHP_VERSION="8.5"
PHP_CONFIG_ROOT=$(map_web_path "php")
PHP_CONFIG_DIR="$PHP_CONFIG_ROOT/$PHP_VERSION"
PHP_ERROR_LOG_PATH="$PHP_CONFIG_DIR/error.log"

# Never add the php${PHP_VERSION} metapackage (it pulls in FPM); CLI only.
PHP85_CORE_PACKAGES=(
    "php${PHP_VERSION}-cli"
    "php${PHP_VERSION}-common"
)

# opcache is bundled in PHP 8.5 (no separate package).
CORE_EXTENSIONS=(
    "php${PHP_VERSION}-mysql"
    "php${PHP_VERSION}-pgsql"
    "php${PHP_VERSION}-sqlite3"
    "php${PHP_VERSION}-xml"
    "php${PHP_VERSION}-curl"
    "php${PHP_VERSION}-zip"
    "php${PHP_VERSION}-mbstring"
    "php${PHP_VERSION}-gd"
    "php${PHP_VERSION}-intl"
    "php${PHP_VERSION}-bcmath"
    "php${PHP_VERSION}-readline"
)

# package suffix -> module name shown by `php -m` (php-pgsql provides pdo_pgsql).
declare -A EXTENSION_MAP=(
    ["curl"]="curl"
    ["mbstring"]="mbstring"
    ["xml"]="xml"
    ["zip"]="zip"
    ["gd"]="gd"
    ["mysql"]="mysqli"
    ["pgsql"]="pdo_pgsql"
    ["sqlite3"]="sqlite3"
    ["intl"]="intl"
    ["bcmath"]="bcmath"
    ["readline"]="readline"
)

PHP_INI_FILES=(
    "$PHP_CONFIG_DIR/cli/php.ini"
)
