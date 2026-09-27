#!/bin/bash

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRANKENPHP_INSTALL_INDEX="93-install-cleanup-compile"

source "$SCRIPT_CURRENT_DIR/frankenphp_install_modes.sh"
source "$SCRIPT_CURRENT_DIR/frankenphp_manager.sh"

frankenphp_install_pipeline_cleanup_compile() {
    local selected_variant=""
    local artifact=""

    selected_variant="$(fm_variant)"
    if [ "$selected_variant" = "$FRANKENPHP_INSTALL_MODE_COMPILE" ]; then
        echo "[${FRANKENPHP_INSTALL_INDEX}] compiled payload retained: it is the selected owner"
        return
    fi
    if [ "$(fm_runtime_contract_ready "$selected_variant")" != "yes" ]; then
        echo "[${FRANKENPHP_INSTALL_INDEX}] [WARN] compiled retirement skipped: selected runtime contract is not committed"
        return
    fi
    for artifact in "$FRANKENPHP_COMPILED_BINARY_PATH" "$FRANKENPHP_COMPILED_CANDIDATE_PATH" \
        "${FRANKENPHP_COMPILED_BINARY_PATH}.previous" "${FRANKENPHP_COMPILED_BINARY_PATH}${FRANKENPHP_BACKUP_SUFFIX}"; do
        if [ -f "$artifact" ]; then
            $USE_SUDO rm -f "$artifact"
            echo "[${FRANKENPHP_INSTALL_INDEX}] retired compiled artifact: ${artifact}"
        fi
    done
    if [ ! -e "$FRANKENPHP_COMPILED_BINARY_PATH" ] && [ ! -e "$FRANKENPHP_COMPILED_CANDIDATE_PATH" ]; then
        echo "[${FRANKENPHP_INSTALL_INDEX}] compiled runtime payload absent"
    fi
}

if [[ "${BASH_SOURCE[0]}" = "${0}" ]]; then
    frankenphp_install_pipeline_cleanup_compile "$@"
fi
