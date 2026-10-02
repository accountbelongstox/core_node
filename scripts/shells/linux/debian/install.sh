#!/bin/bash

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR="$(dirname "$SCRIPT_CURRENT_DIR")"
SHELLS_DIR="$PARENT_DIR"

# Source gvar_common.sh from parent directory - use relative path
source "${PARENT_DIR}/common/gvar_common.sh"

selector_common_file="${SHELLS_DIR}/common/selector_common.sh"
source "${PARENT_DIR}/common/install_item_runner.sh"
echo "INSTALL_SHELLS_DIR: $INSTALL_SHELLS_DIR"

# Main execution
echo "Core Node Installation Script"
echo
# Run selector to get configuration
if ! "$selector_common_file"; then
    echo "Server configuration cancelled."
    exit 0
fi

# Get the selected mode after selector runs
INSTALL_MODE=$(get_var "INSTALL_MODE")
echo "Selected options:"
echo "  Installation mode: $INSTALL_MODE"
echo

# Note: a service switched OFF in the selector is not installed at all
# (INSTALL_* follows the START_* toggles; the apt repo is skipped/removed too).
echo "Services will be installed, START_* variables control service startup..."

# The selector above is the only interactive step. From here on the chain runs
# unattended: every prompt_read_default call returns its documented default
# immediately instead of waiting on the TTY.
export DD_AUTO_CONTINUE=true

run_item_key="$(get_var "$RUN_ITEM_VAR" "")"
if [ -n "$run_item_key" ]; then
    set_var "$RUN_ITEM_VAR" ""
    run_item_file="$(find_item_file "$run_item_key")" || {
        echo "No menu item file for: $run_item_key" >&2
        exit 1
    }
    "$run_item_file"
    exit $?
fi

execute_installation_scripts

echo
echo "Installation completed successfully!"
