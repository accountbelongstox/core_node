#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_CURRENT_DIR/frankenphp_install_modes.sh"
source "$SCRIPT_CURRENT_DIR/gvar_common.sh"
FRANKENPHP_INSTALL_INDEX="$FRANKENPHP_INSTALL_PIPELINE_SYSTEM_INDEX"

frankenphp_install_apt_package_missing() {
    local package=""
    local package_check=""

    package="$1"
    package_check="$(dpkg -s "$package" 2>/dev/null | awk '/^Status: / {print $4}')"
    if [ "$package_check" = "installed" ]; then
        echo "no"
    else
        echo "yes"
    fi
}

frankenphp_install_apt_update() {
    $USE_SUDO apt update
}

frankenphp_install_apt_install() {
    $USE_SUDO apt install -y "${FRANKENPHP_APT_PACKAGES[@]}"
}

frankenphp_install_apt_refresh_report() {
    local package=""
    local installed="no"

    installed="yes"
    for package in "${FRANKENPHP_APT_PACKAGES[@]}"; do
        if [ "$(frankenphp_install_apt_package_missing "$package")" = "yes" ]; then
            installed="no"
            break
        fi
    done

    if [ "$installed" = "yes" ]; then
        echo "[${FRANKENPHP_INSTALL_INDEX}] apt packages already present: ${FRANKENPHP_APT_PACKAGES[*]}"
    else
        echo "[${FRANKENPHP_INSTALL_INDEX}] apt package check: missing package detected"
    fi
}

frankenphp_install_apt() {
    echo "[${FRANKENPHP_INSTALL_INDEX}] Installing FrankenPHP PHP-ZTS packages:"
    echo "  - ${FRANKENPHP_APT_PACKAGES[*]}"

    frankenphp_install_apt_update
    frankenphp_install_apt_install
    frankenphp_install_apt_refresh_report
}

if [[ "${BASH_SOURCE[0]}" = "${0}" ]]; then
    frankenphp_install_apt "$@"
fi
