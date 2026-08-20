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
FRANKENPHP_INSTALL_INDEX="93-install-cleanup-system"

source "$SCRIPT_CURRENT_DIR/frankenphp_install_modes.sh"
source "$SCRIPT_CURRENT_DIR/gvar_common.sh"
source "$SCRIPT_CURRENT_DIR/frankenphp_manager.sh"

frankenphp_install_pipeline_cleanup_apt() {
    local package=""
    local selected_variant=""
    local packages_absent="yes"

    selected_variant="$(fm_variant)"
    if [ "$selected_variant" = "$FRANKENPHP_INSTALL_MODE_APT" ]; then
        echo "[${FRANKENPHP_INSTALL_INDEX}] apt payload retained: it is the selected owner"
        return
    fi
    if [ "$(fm_runtime_contract_ready "$selected_variant")" != "yes" ]; then
        echo "[${FRANKENPHP_INSTALL_INDEX}] [WARN] apt retirement skipped: selected runtime contract is not committed"
        return
    fi

    if [ -L /etc/systemd/system/frankenphp.service ] \
        && [ "$(readlink /etc/systemd/system/frankenphp.service 2>/dev/null)" = "/dev/null" ]; then
        $USE_SUDO rm -f /etc/systemd/system/frankenphp.service
    fi
    $USE_SUDO systemctl daemon-reload >/dev/null 2>&1
    $USE_SUDO systemctl stop frankenphp.service >/dev/null 2>&1
    $USE_SUDO systemctl disable frankenphp.service >/dev/null 2>&1

    for package in "${FRANKENPHP_APT_PACKAGES[@]}"; do
        if [ "$(fm_apt_package_installed "$package")" = "yes" ]; then
            echo "[${FRANKENPHP_INSTALL_INDEX}] retiring non-owner apt package: ${package}"
            $USE_SUDO apt-get purge -y "$package"
        fi
        if [ "$(fm_apt_package_installed "$package")" = "yes" ]; then
            packages_absent="no"
            echo "[${FRANKENPHP_INSTALL_INDEX}] [WARN] apt package remains installed: ${package}"
        else
            echo "[${FRANKENPHP_INSTALL_INDEX}] apt package absent: ${package}"
        fi
    done

    if [ "$packages_absent" != "yes" ]; then
        echo "[${FRANKENPHP_INSTALL_INDEX}] [WARN] repo retained while owned packages remain"
        return
    fi

    if [ -f "$FRANKENPHP_APT_SOURCES_FILE" ]; then
        echo "[${FRANKENPHP_INSTALL_INDEX}] removing repo sources: ${FRANKENPHP_APT_SOURCES_FILE}"
        $USE_SUDO rm -f "$FRANKENPHP_APT_SOURCES_FILE"
    fi
    if [ -f "$FRANKENPHP_APT_KEY_PATH" ]; then
        echo "[${FRANKENPHP_INSTALL_INDEX}] removing repo keyring: ${FRANKENPHP_APT_KEY_PATH}"
        $USE_SUDO rm -f "$FRANKENPHP_APT_KEY_PATH"
    fi
}

if [[ "${BASH_SOURCE[0]}" = "${0}" ]]; then
    frankenphp_install_pipeline_cleanup_apt "$@"
fi
