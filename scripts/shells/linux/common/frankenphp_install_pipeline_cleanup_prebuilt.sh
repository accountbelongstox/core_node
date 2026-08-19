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
source "$SCRIPT_CURRENT_DIR/frankenphp_manager.sh"

FRANKENPHP_INSTALL_INDEX="$FRANKENPHP_INSTALL_PIPELINE_CLEANUP_PREBUILT_INDEX"

frankenphp_install_pipeline_cleanup_prebuilt() {
    fm_unlink_frankenphp_runtime
    if [ -L "$FRANKENPHP_INSTALL_RUNTIME_LINK_PATH" ]; then
        rm -f "$FRANKENPHP_INSTALL_RUNTIME_LINK_PATH"
        echo "[${FRANKENPHP_INSTALL_INDEX}] runtime link removed: ${FRANKENPHP_INSTALL_RUNTIME_LINK_PATH}"
    else
        echo "[${FRANKENPHP_INSTALL_INDEX}] runtime link not present: ${FRANKENPHP_INSTALL_RUNTIME_LINK_PATH}"
    fi
}

if [[ "${BASH_SOURCE[0]}" = "${0}" ]]; then
    frankenphp_install_pipeline_cleanup_prebuilt "$@"
fi
