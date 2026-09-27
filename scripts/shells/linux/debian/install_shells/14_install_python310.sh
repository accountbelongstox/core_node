#!/bin/bash
SCRIPT_INDEX="14"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_DIR="$(dirname "$(dirname "$SCRIPT_CURRENT_DIR")")/common"
RUNTIME_SELECTION="both"
source "$COMMON_DIR/gvar_common.sh"
source "$COMMON_DIR/common_functions.sh"
source "$COMMON_DIR/isolated_python_install_common.sh"

# Invocation styles:
#   prepare_pycore_prerequisites.sh:  14_install_python310.sh --python <py> [--force]
#   tts_install_assets_common.sh:     14_install_python310.sh --runtime 310|312
#   app_install_menu.sh / manual:     14_install_python310.sh [310|312|both]
while [[ $# -gt 0 ]]; do
    case "$1" in
        --runtime) RUNTIME_SELECTION="${2:-both}"; shift; [ $# -gt 0 ] && shift ;;
        --python)  shift; [ $# -gt 0 ] && shift ;;   # accepted for prepare_pycore_prerequisites.sh compat; unused
        --force)   shift ;;
        310|312|both) RUNTIME_SELECTION="$1"; shift ;;
        *) shift ;;   # ignore unknown extras (prepare_pycore_prerequisites.sh may pass extras)
    esac
done

case "$RUNTIME_SELECTION" in
    310) install_isolated_python_runtime "$PYTHON310_VERSION" ;;
    312) install_isolated_python_runtime "$PYTHON312_VERSION" ;;
    both)
        install_isolated_python_runtime "$PYTHON310_VERSION"
        install_isolated_python_runtime "$PYTHON312_VERSION"
        ;;
    *) print_error_from_common_functions "Unsupported runtime selection: $RUNTIME_SELECTION" ;;
esac
