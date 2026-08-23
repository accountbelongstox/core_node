#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Declare all variables at the beginning of the file
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
SCRIPT_INDEX="[96_PHP85_CONFIG]"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEBIAN_DIR="$(dirname "$SCRIPT_CURRENT_DIR")"
LINUX_DIR="$(dirname "$DEBIAN_DIR")"
COMMON_DIR="$LINUX_DIR/common"
DEBIAN_COM_DIR="$DEBIAN_DIR/debian_com"
FORCE_REFRESH="no"
CONFIG_RUNTIME_PLANE=""
PHP_CONFIGURATION_READY="no"
PHP_RUNTIME_READY="no"
PHP_DEFAULT_READY="no"
PHP_PERMISSIONS_READY="no"
PHP_WEB_SERVER_READY="no"
PHP_ACTIVE_LINK=""
PHP_FRANKENPHP_INI=""
PHP_WWW_ROOT=""
PHP_ARGUMENT=""

source "$COMMON_DIR/gvar_common.sh"
source "$COMMON_DIR/common_functions.sh"
source "$COMMON_DIR/frankenphp_manager.sh"
source "$DEBIAN_COM_DIR/php_common_vars.sh"
source "$DEBIAN_COM_DIR/php_common_functions.sh"

php_configuration_arguments_read() {
    for PHP_ARGUMENT in "$@"; do
        case "$PHP_ARGUMENT" in
            --force|-f) FORCE_REFRESH="yes" ;;
        esac
    done
}

php_configuration_permissions_ensure() {
    PHP_PERMISSIONS_READY="no"
    PHP_WWW_ROOT="$(map_web_path "wwwroot")"
    set_directory_permissions_from_php_common "$PHP_WWW_ROOT" "$SCRIPT_INDEX"
    if [ "$PHP_COMMON_PERMISSION_READY" = "yes" ]; then
        PHP_PERMISSIONS_READY="yes"
    fi
}

php_configuration_frankenphp_ensure() {
    PHP_RUNTIME_READY="no"
    PHP_FRANKENPHP_INI="$(fm_php_ini_dir)/99-core-node.ini"
    fm_php_ini_ensure
    if [ -f "$PHP_FRANKENPHP_INI" ] \
        && grep -Fq 'memory_limit = 512M' "$PHP_FRANKENPHP_INI" \
        && grep -Fq "upload_max_filesize = $PHP_RUNTIME_UPLOAD_MAX_FILESIZE" "$PHP_FRANKENPHP_INI" \
        && grep -Fq "post_max_size = $PHP_RUNTIME_POST_MAX_SIZE" "$PHP_FRANKENPHP_INI" \
        && grep -Fq "max_execution_time = $PHP_RUNTIME_MAX_EXECUTION_TIME" "$PHP_FRANKENPHP_INI" \
        && grep -Fq "max_input_time = $PHP_RUNTIME_MAX_INPUT_TIME" "$PHP_FRANKENPHP_INI"; then
        PHP_RUNTIME_READY="yes"
    fi
}

php_configuration_system_default_ensure() {
    PHP_DEFAULT_READY="no"
    PHP_ACTIVE_LINK="$(readlink -f /etc/alternatives/php 2>/dev/null)"
    if [ -f "$PHP_BIN" ] && [ "$PHP_ACTIVE_LINK" != "$PHP_BIN" ]; then
        $USE_SUDO update-alternatives --install /usr/bin/php php "$PHP_BIN" "$PHP_ALT_PRIORITY"
        $USE_SUDO update-alternatives --set php "$PHP_BIN"
    fi
    PHP_ACTIVE_LINK="$(readlink -f /etc/alternatives/php 2>/dev/null)"
    if [ -f "$PHP_BIN" ] && [ "$PHP_ACTIVE_LINK" = "$PHP_BIN" ]; then
        PHP_DEFAULT_READY="yes"
    fi
}

php_configuration_system_ensure() {
    PHP_RUNTIME_READY="no"
    configure_php_for_laravel_from_php_common "$SCRIPT_INDEX"
    php_configuration_system_default_ensure
    if [ "$PHP_DEFAULT_READY" = "yes" ] && [ "$PHP_COMMON_LARAVEL_CONFIG_READY" = "yes" ]; then
        PHP_RUNTIME_READY="yes"
    fi
}

php_configuration_web_server_ensure() {
    PHP_WEB_SERVER_READY="yes"
}

php_configuration_ensure() {
    php_configuration_arguments_read "$@"
    web_access_config_ensure
    CONFIG_RUNTIME_PLANE="$(php_runtime_plane)"
    echo -e "${CYAN}$SCRIPT_INDEX PHP ${PHP_VERSION} configuration convergence (plane: $CONFIG_RUNTIME_PLANE, force: $FORCE_REFRESH)${NC}"

    if [ "$CONFIG_RUNTIME_PLANE" = "frankenphp" ]; then
        php_configuration_frankenphp_ensure
    else
        php_configuration_system_ensure
    fi
    php_configuration_permissions_ensure
    php_configuration_web_server_ensure

    PHP_CONFIGURATION_READY="no"
    if [ "$PHP_RUNTIME_READY" = "yes" ] \
        && [ "$PHP_PERMISSIONS_READY" = "yes" ] \
        && [ "$PHP_WEB_SERVER_READY" = "yes" ]; then
        PHP_CONFIGURATION_READY="yes"
        echo -e "${GREEN}$SCRIPT_INDEX PHP configuration is canonical${NC}"
    else
        echo -e "${RED}$SCRIPT_INDEX PHP configuration remains incomplete${NC}"
    fi
}

php_configuration_ensure "$@"
