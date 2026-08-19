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

# Prebuilt runner for 93_install_frankenphp:
# delegate all orchestration and prebuilt version parsing to this wrapper.

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_CURRENT_DIR/frankenphp_install_modes.sh"
source "$SCRIPT_CURRENT_DIR/frankenphp_manager.sh"
source "$SCRIPT_CURRENT_DIR/frankenphp_install_prebuilt.sh"

frankenphp_install_pipeline_prebuilt_parse_args() {
    local arg=""
    local normalized_version=""

    for arg in "$@"; do
        case "$arg" in
            --prebuilt-version=*)
                normalized_version="${arg#*=}"
                FRANKENPHP_PREBUILT_VERSION="$normalized_version"
                ;;
            --mode=*)
                ;;
            *)
                :
                ;;
        esac
    done
}

frankenphp_install_pipeline_prebuilt() {
    frankenphp_install_pipeline_prebuilt_parse_args "$@"
    fm_variant_set "$FRANKENPHP_INSTALL_MODE_PREBUILT"
    frankenphp_install_prebuilt
}

if [[ "${BASH_SOURCE[0]}" = "${0}" ]]; then
    frankenphp_install_pipeline_prebuilt "$@"
fi
