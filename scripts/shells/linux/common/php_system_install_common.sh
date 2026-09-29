#!/bin/bash

# System (nginx plane) PHP package convergence: the php-cli + extension set
# declared in debian_com/php_common_vars.sh, plus single extra extensions.
# Detection is by binary/module existence (`php -m`); installed -> no apt call.
# Results flow through PHP_SYSTEM_* state variables, never exit codes.

if [ "${PHP_SYSTEM_INSTALL_COMMON_LOADED:-false}" = "true" ]; then
    return
fi
PHP_SYSTEM_INSTALL_COMMON_LOADED="true"

PHP_SYSTEM_INSTALL_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PHP_SYSTEM_APT_REPOSITORY_MANAGER="$PHP_SYSTEM_INSTALL_COMMON_DIR/apt_repository_manager.sh"
PHP_SYSTEM_MISSING_PACKAGES=()
PHP_SYSTEM_PACKAGES_READY="no"
PHP_SYSTEM_EXTENSION_READY="no"
PHP_SYSTEM_EXTENSION_PACKAGE=""
PHP_SYSTEM_EXTENSION_MODULE=""
PHP_SYSTEM_BIN=""
PHP_SYSTEM_MODULES=""
PHP_SYSTEM_OS_ID=""
PHP_SYSTEM_OS_CODENAME=""

source "$PHP_SYSTEM_INSTALL_COMMON_DIR/gvar_common.sh"
source "$PHP_SYSTEM_INSTALL_COMMON_DIR/common_functions.sh"
source "$PHP_SYSTEM_INSTALL_COMMON_DIR/../debian/debian_com/php_common_vars.sh"

php_system_binary_resolve() {
    local candidate=""

    PHP_SYSTEM_BIN=""
    PHP_SYSTEM_MODULES=""
    for candidate in "/usr/bin/php${PHP_VERSION}" /usr/local/bin/php /usr/bin/php; do
        if [ -x "$candidate" ]; then
            PHP_SYSTEM_BIN="$candidate"
            PHP_SYSTEM_MODULES="$("$candidate" -m 2>/dev/null)"
            break
        fi
    done
}

php_system_module_loaded() {
    if [ -n "$PHP_SYSTEM_MODULES" ] && printf '%s\n' "$PHP_SYSTEM_MODULES" | grep -qixF -- "$1"; then
        echo "yes"
    else
        echo "no"
    fi
}

php_system_missing_probe() {
    local package=""
    local key=""
    local module=""

    PHP_SYSTEM_MISSING_PACKAGES=()
    php_system_binary_resolve
    if [ ! -x "/usr/bin/php${PHP_VERSION}" ]; then
        PHP_SYSTEM_MISSING_PACKAGES=("${PHP85_CORE_PACKAGES[@]}")
        PHP_SYSTEM_MODULES=""
    fi
    for package in "${CORE_EXTENSIONS[@]}"; do
        key="${package#php${PHP_VERSION}-}"
        module="${EXTENSION_MAP[$key]:-$key}"
        if [ "$(php_system_module_loaded "$module")" != "yes" ]; then
            PHP_SYSTEM_MISSING_PACKAGES+=("$package")
        fi
    done
}

php_system_extension_probe() {
    PHP_SYSTEM_MISSING_PACKAGES=()
    php_system_binary_resolve
    if [ "$(php_system_module_loaded "$PHP_SYSTEM_EXTENSION_MODULE")" != "yes" ]; then
        PHP_SYSTEM_MISSING_PACKAGES=("$PHP_SYSTEM_EXTENSION_PACKAGE")
    fi
}

php_system_apt_install() {
    $USE_SUDO apt-get update -qq || true
    $USE_SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y "$@" || true
}

php_system_repository_ensure() {
    PHP_SYSTEM_OS_ID="$( . /etc/os-release 2>/dev/null; echo "$ID" )"
    PHP_SYSTEM_OS_CODENAME="$( . /etc/os-release 2>/dev/null; echo "$VERSION_CODENAME" )"
    print_step_from_common_functions "Ensuring the PHP apt repository (Debian Sury / Ubuntu PPA) for ${PHP_SYSTEM_OS_ID:-unknown} ${PHP_SYSTEM_OS_CODENAME:-unknown}"
    source "$PHP_SYSTEM_APT_REPOSITORY_MANAGER"
    add_php_repository_permanent_from_apt_repository_manager \
        "$PHP_SYSTEM_OS_ID" "$PHP_SYSTEM_OS_CODENAME" "true"
}

php_system_install_missing() {
    local probe_function="$1"
    local package=""
    local key=""

    print_step_from_common_functions "Installing via apt: ${PHP_SYSTEM_MISSING_PACKAGES[*]}"
    php_system_apt_install "${PHP_SYSTEM_MISSING_PACKAGES[@]}"
    for package in "${PHP_SYSTEM_MISSING_PACKAGES[@]}"; do
        key="${package#php${PHP_VERSION}-}"
        $USE_SUDO phpenmod -v "$PHP_VERSION" "$key" "${EXTENSION_MAP[$key]:-$key}" >/dev/null 2>&1 || true
    done
    "$probe_function"
}

php_system_converge() {
    local probe_function="$1"

    "$probe_function"
    if [ "${#PHP_SYSTEM_MISSING_PACKAGES[@]}" -gt 0 ]; then
        php_system_install_missing "$probe_function"
    fi
    if [ "${#PHP_SYSTEM_MISSING_PACKAGES[@]}" -gt 0 ]; then
        php_system_repository_ensure
        php_system_install_missing "$probe_function"
    fi
}

php_system_packages_ensure() {
    PHP_SYSTEM_PACKAGES_READY="no"
    php_system_converge php_system_missing_probe
    if [ "${#PHP_SYSTEM_MISSING_PACKAGES[@]}" -eq 0 ]; then
        PHP_SYSTEM_PACKAGES_READY="yes"
        print_success_from_common_functions "System PHP ${PHP_VERSION} packages and extensions present"
    else
        print_error_from_common_functions "System PHP packages still missing: ${PHP_SYSTEM_MISSING_PACKAGES[*]}"
    fi
}

php_system_extension_ensure() {
    PHP_SYSTEM_EXTENSION_PACKAGE="$1"
    PHP_SYSTEM_EXTENSION_MODULE="$2"
    PHP_SYSTEM_EXTENSION_READY="no"
    php_system_converge php_system_extension_probe
    if [ "${#PHP_SYSTEM_MISSING_PACKAGES[@]}" -eq 0 ]; then
        PHP_SYSTEM_EXTENSION_READY="yes"
    else
        print_error_from_common_functions "PHP extension ${PHP_SYSTEM_EXTENSION_MODULE} unavailable after installing ${PHP_SYSTEM_EXTENSION_PACKAGE}"
    fi
}
