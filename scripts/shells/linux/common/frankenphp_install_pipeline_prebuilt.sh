#!/bin/bash

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
    frankenphp_install_prebuilt
}

if [[ "${BASH_SOURCE[0]}" = "${0}" ]]; then
    frankenphp_install_pipeline_prebuilt "$@"
fi
