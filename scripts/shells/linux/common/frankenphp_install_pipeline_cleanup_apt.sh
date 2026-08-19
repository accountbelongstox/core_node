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
source "$SCRIPT_CURRENT_DIR/frankenphp_manager.sh"

FRANKENPHP_INSTALL_INDEX="$FRANKENPHP_INSTALL_PIPELINE_CLEANUP_SYSTEM_INDEX"

frankenphp_install_pipeline_cleanup_apt() {
    fm_unlink_frankenphp_runtime
    local package=""
    local uninstall_packages=()
    local package_count=0

    for package in "${FRANKENPHP_APT_PACKAGES[@]}"; do
        if dpkg -s "$package" 2>/dev/null | grep -q '^Status: install ok installed$'; then
            uninstall_packages+=("$package")
        fi
    done

    package_count="${#uninstall_packages[@]}"
    if [ "$package_count" -eq 0 ]; then
        echo "[${FRANKENPHP_INSTALL_INDEX}] apt packages already absent: ${FRANKENPHP_APT_PACKAGES[*]}"
    else
        echo "[${FRANKENPHP_INSTALL_INDEX}] removing apt packages for system mode cleanup: ${uninstall_packages[*]}"
        $USE_SUDO apt purge -y "${uninstall_packages[@]}"
        $USE_SUDO apt autoremove -y >/dev/null 2>&1 || true
    fi
}

if [[ "${BASH_SOURCE[0]}" = "${0}" ]]; then
    frankenphp_install_pipeline_cleanup_apt "$@"
fi
