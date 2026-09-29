#!/bin/bash

# =============================================================================
# Main Functions for dd.sh
# =============================================================================

# Source constants (backup copy)
source "$DD_HELPER_DIR/constants.sh"

determine_global_var_dir() {
    echo "$GLOBAL_VAR_DIR"
    return 0
}
