#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# =============================================================================
# Git Functions
# =============================================================================

# Source constants (backup copy)
source "$DD_HELPER_DIR/constants.sh"

# Build full path from constants
GITPUT_UNIFIED_SCRIPT_PATH="$CORE_NODE_ROOT_DIR/$GITPUT_UNIFIED_SCRIPT_RELATIVE"

# Git Functions
get_git() {
    echo "Starting SAFE git pull operation..."
    echo "Using unified git script for safe pull: $GITPUT_UNIFIED_SCRIPT_PATH"

    # Determine target remote based on region setting
    local selected_region=$(get_global_var "SELECTED_REGION")
    local target_remote="gitee"  # default
    if [ "$selected_region" = "Global" ]; then
        target_remote="github"
    fi

    echo "Target remote: $target_remote (based on region: $selected_region)"

    # Execute safe pull using unified script
    cd "$CORE_NODE_ROOT_DIR"
    bash "$GITPUT_UNIFIED_SCRIPT_PATH" --pull "$target_remote"

    if [ $? -eq 0 ]; then
        echo "Safe git pull operation completed successfully!"
        make_sh_executable
    else
        echo "Safe git pull operation failed. Please check the output above for resolution options."
    fi
}
