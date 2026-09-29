#!/bin/bash

# Swoole (Octane server driver) for the system PHP plane. Idempotent: the PECL
# build runs only when swoole.so is missing from the PHP extension directory;
# ini + CLI enablement drift is repaired independently. Results flow through
# PHP_SWOOLE_READY, never exit codes.

if [ "${PHP_SWOOLE_COMMON_LOADED:-false}" = "true" ]; then
    return
fi
PHP_SWOOLE_COMMON_LOADED="true"

PHP_SWOOLE_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$PHP_SWOOLE_COMMON_DIR/gvar_common.sh"
source "$PHP_SWOOLE_COMMON_DIR/common_functions.sh"
source "$PHP_SWOOLE_COMMON_DIR/../debian/debian_com/php_common_vars.sh"
source "$PHP_SWOOLE_COMMON_DIR/php_system_install_common.sh"

PHP_SWOOLE_READY="no"
PHP_SWOOLE_LOADED="no"
PHP_SWOOLE_EXTENSION_DIR=""
PHP_SWOOLE_INI="$PHP_CONFIG_DIR/mods-available/swoole.ini"
PHP_SWOOLE_CLI_LINK="$PHP_CONFIG_DIR/cli/conf.d/20-swoole.ini"
PHP_SWOOLE_BUILD_DEPENDENCIES=(
    "php${PHP_VERSION}-dev"
    "php-pear"
    "build-essential"
    "libssl-dev"
    "libcurl4-openssl-dev"
    "libpcre2-dev"
    "libpq-dev"
)

php_swoole_state_read() {
    php_system_binary_resolve
    PHP_SWOOLE_EXTENSION_DIR=""
    PHP_SWOOLE_LOADED="no"
    if [ -n "$PHP_SYSTEM_BIN" ]; then
        PHP_SWOOLE_EXTENSION_DIR="$("$PHP_SYSTEM_BIN" -r 'echo ini_get("extension_dir");' 2>/dev/null)"
        PHP_SWOOLE_LOADED="$(php_system_module_loaded swoole)"
    fi
}

php_swoole_build() {
    print_step_from_common_functions "Building Swoole via PECL (dependencies: ${PHP_SWOOLE_BUILD_DEPENDENCIES[*]})"
    php_system_apt_install "${PHP_SWOOLE_BUILD_DEPENDENCIES[@]}"
    echo "" | $USE_SUDO pecl install --force swoole
}

php_swoole_enable() {
    if [ ! -f "$PHP_SWOOLE_INI" ]; then
        echo "extension=swoole.so" | $USE_SUDO tee "$PHP_SWOOLE_INI" > /dev/null
    fi
    if [ ! -L "$PHP_SWOOLE_CLI_LINK" ]; then
        $USE_SUDO phpenmod -v "$PHP_VERSION" swoole >/dev/null 2>&1 || true
    fi
    if [ ! -L "$PHP_SWOOLE_CLI_LINK" ]; then
        $USE_SUDO ln -sf "$PHP_SWOOLE_INI" "$PHP_SWOOLE_CLI_LINK"
    fi
}

php_swoole_ensure() {
    PHP_SWOOLE_READY="no"
    php_swoole_state_read
    if [ -n "$PHP_SWOOLE_EXTENSION_DIR" ] && [ ! -f "$PHP_SWOOLE_EXTENSION_DIR/swoole.so" ]; then
        php_swoole_build
        php_swoole_state_read
    fi
    if [ -n "$PHP_SWOOLE_EXTENSION_DIR" ] && [ ! -f "$PHP_SWOOLE_EXTENSION_DIR/swoole.so" ]; then
        print_error_from_common_functions "swoole.so is missing from $PHP_SWOOLE_EXTENSION_DIR after the PECL build; leaving the ini and CLI link untouched"
        return
    fi
    if [ "$PHP_SWOOLE_LOADED" != "yes" ] || [ ! -f "$PHP_SWOOLE_INI" ] || [ ! -L "$PHP_SWOOLE_CLI_LINK" ]; then
        php_swoole_enable
        php_swoole_state_read
    fi
    if [ "$PHP_SWOOLE_LOADED" = "yes" ]; then
        PHP_SWOOLE_READY="yes"
        print_success_from_common_functions "Swoole $("$PHP_SYSTEM_BIN" -r 'echo phpversion("swoole");' 2>/dev/null) loaded in $PHP_SYSTEM_BIN"
    else
        print_error_from_common_functions "Swoole is not loaded by ${PHP_SYSTEM_BIN:-php} (extension dir: ${PHP_SWOOLE_EXTENSION_DIR:-unknown})"
    fi
}
