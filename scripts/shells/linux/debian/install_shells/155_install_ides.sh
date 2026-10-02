#!/bin/bash
# Usage: 155_install_ides.sh [--only cursor|vscode|antigravity[,...]] [--refresh|--cleanup] [--yes]
# Default: idempotent install of every IDE (installed ones are refreshed and only
# upgraded on a known newer version). --refresh re-asserts launchers, update
# shims, desktop entries, URL handlers and IME config without downloading;
# --cleanup removes the selection; --yes answers the install/upgrade prompts
# with yes (used by the menu icon's launch-time upgrade, ide_update_launcher.sh).

SCRIPT_INDEX="155"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/installation_library.sh"
source "$PARENT_DIR_LEVEL_2/common/desktop_shortcut_manager.sh"
source "$PARENT_DIR_LEVEL_2/common/app_resource_limit.sh"
source "$PARENT_DIR_LEVEL_2/common/desktop_browser_bridge.sh"
source "$PARENT_DIR_LEVEL_2/common/desktop_electron_ime_compat.sh"
source "$PARENT_DIR_LEVEL_2/common/ide_package_common.sh"
source "$PARENT_DIR_LEVEL_2/common/cursor_install_backend_common.sh"
source "$PARENT_DIR_LEVEL_2/common/vscode_install_backend_common.sh"
source "$PARENT_DIR_LEVEL_2/common/antigravity_install_backend_common.sh"

IDE_ALL="cursor vscode antigravity"
IDE_SELECTED=""
IDE_ACTION="install"
IDE_FAILED=""
IDE_NAME=""

ide_parse_args() {
    local item
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --only)
                for item in ${2//,/ }; do
                    case " $IDE_ALL " in
                        *" $item "*) IDE_SELECTED="$IDE_SELECTED $item" ;;
                        *) print_error_from_common_functions "Unknown IDE '$item' (expected: $IDE_ALL)"; exit 1 ;;
                    esac
                done
                shift 2
                ;;
            refresh|--refresh|reload|--reload) IDE_ACTION="refresh"; shift ;;
            cleanup|--cleanup|remove|--remove|uninstall|--uninstall) IDE_ACTION="cleanup"; shift ;;
            -y|--yes) IDE_ASSUME_YES=true; shift ;;
            *) shift ;;
        esac
    done
    [[ -n "$IDE_SELECTED" ]] || IDE_SELECTED="$IDE_ALL"
}

ide_run() {
    case "$IDE_ACTION" in
        install) "${1}_main_install" ;;
        refresh) "${1}_refresh" ;;
        cleanup) "${1}_cleanup" ;;
    esac
}

ide_parse_args "$@"
print_header_from_common_functions "[$SCRIPT_INDEX] IDE installation ($IDE_ACTION: $IDE_SELECTED)"

for IDE_NAME in $IDE_SELECTED; do
    ide_run "$IDE_NAME" || IDE_FAILED="$IDE_FAILED $IDE_NAME"
done

if [[ -n "$IDE_FAILED" ]]; then
    print_error_from_common_functions "[$SCRIPT_INDEX] Failed:$IDE_FAILED"
    exit 1
fi
print_success_from_common_functions "[$SCRIPT_INDEX] IDE $IDE_ACTION completed:$IDE_SELECTED"
