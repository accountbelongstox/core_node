#!/bin/bash
SCRIPT_INDEX="93"

PHP_INSTALL_STEP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PHP_INSTALL_COMMON_DIR="$(cd "$PHP_INSTALL_STEP_DIR/../../common" && pwd)"
PHP_INSTALL_DEBIAN_COM_DIR="$(cd "$PHP_INSTALL_STEP_DIR/../debian_com" && pwd)"
PHP_INSTALL_PLANE=""

source "$PHP_INSTALL_COMMON_DIR/gvar_common.sh"
source "$PHP_INSTALL_COMMON_DIR/php_install_parts_common.sh"
source "$PHP_INSTALL_COMMON_DIR/web_access_common.sh"
source "$PHP_INSTALL_COMMON_DIR/php_link_common.sh"
source "$PHP_INSTALL_COMMON_DIR/composer_install_common.sh"
source "$PHP_INSTALL_COMMON_DIR/php_system_install_common.sh"
source "$PHP_INSTALL_COMMON_DIR/php_swoole_common.sh"
source "$PHP_INSTALL_DEBIAN_COM_DIR/php_common_functions.sh"

php_install_arguments_read "$@"
if [ "$PHP_INSTALL_PARTS_VALID" != "yes" ]; then
    echo "[$SCRIPT_INDEX] [ERROR] unknown part in '$PHP_INSTALL_PARTS'; valid: $PHP_INSTALL_PARTS_ALL"
else
    web_access_config_ensure
    PHP_INSTALL_PLANE="$(php_runtime_plane)"

    if [ "$(php_install_part_selected runtime)" = "yes" ]; then
        if [ "$PHP_INSTALL_PLANE" = "frankenphp" ]; then
            source "$PHP_INSTALL_COMMON_DIR/frankenphp_install_pipeline.sh"
            frankenphp_install_pipeline "${PHP_INSTALL_PASSTHROUGH[@]}"
        else
            php_system_packages_ensure
        fi
    fi
    if [ "$(php_install_part_selected runtime)" = "yes" ] \
        || [ "$(php_install_part_selected swoole)" = "yes" ] \
        || [ "$(php_install_part_selected config)" = "yes" ]; then
        ensure_single_php_link
    fi
    if [ "$(php_install_part_selected swoole)" = "yes" ]; then
        if [ "$PHP_INSTALL_PLANE" = "frankenphp" ]; then
            echo "[$SCRIPT_INDEX] swoole skipped: frankenphp plane embeds its Octane app server"
        else
            php_swoole_ensure
        fi
    fi
    if [ "$(php_install_part_selected config)" = "yes" ]; then
        php_configuration_ensure "[$SCRIPT_INDEX]"
    fi
    if [ "$(php_install_part_selected composer)" = "yes" ]; then
        composer_install_ensure "${PHP_INSTALL_PASSTHROUGH[@]}"
    fi
fi
