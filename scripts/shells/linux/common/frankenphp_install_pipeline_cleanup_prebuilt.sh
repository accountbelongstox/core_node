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
FRANKENPHP_PREBUILT_BACKUP_SUFFIX=".prebuilt"
FRANKENPHP_INSTALL_INDEX="93-install-cleanup-prebuilt"

source "$SCRIPT_CURRENT_DIR/frankenphp_install_modes.sh"
source "$SCRIPT_CURRENT_DIR/frankenphp_manager.sh"

frankenphp_install_pipeline_cleanup_prebuilt() {
    local selected_variant=""
    local artifact=""

    selected_variant="$(fm_variant)"
    if [ "$selected_variant" = "$FRANKENPHP_INSTALL_MODE_PREBUILT" ]; then
        echo "[${FRANKENPHP_INSTALL_INDEX}] prebuilt payload retained: it is the selected owner"
        return
    fi
    if [ "$(fm_runtime_contract_ready "$selected_variant")" != "yes" ]; then
        echo "[${FRANKENPHP_INSTALL_INDEX}] [WARN] prebuilt retirement skipped: selected runtime contract is not committed"
        return
    fi
    for artifact in "$FRANKENPHP_PREBUILT_BINARY_PATH" "$FRANKENPHP_PREBUILT_CANDIDATE_PATH" \
        "${FRANKENPHP_PREBUILT_BINARY_PATH}.previous" "${FRANKENPHP_PREBUILT_BINARY_PATH}${FRANKENPHP_PREBUILT_BACKUP_SUFFIX}" \
        "$FRANKENPHP_PREBUILT_REQUEST_STATE" "$FRANKENPHP_PREBUILT_READY_STATE"; do
        if [ -f "$artifact" ]; then
            $USE_SUDO rm -f "$artifact"
            echo "[${FRANKENPHP_INSTALL_INDEX}] retired prebuilt artifact: ${artifact}"
        fi
    done
    if [ ! -e "$FRANKENPHP_PREBUILT_BINARY_PATH" ] && [ ! -e "$FRANKENPHP_PREBUILT_CANDIDATE_PATH" ]; then
        echo "[${FRANKENPHP_INSTALL_INDEX}] prebuilt runtime payload absent"
    fi
}

if [[ "${BASH_SOURCE[0]}" = "${0}" ]]; then
    frankenphp_install_pipeline_cleanup_prebuilt "$@"
fi
