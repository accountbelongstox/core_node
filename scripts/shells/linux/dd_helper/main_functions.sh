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
# Main Functions for dd.sh
# =============================================================================

# Source constants (backup copy)
source "$DD_HELPER_DIR/constants.sh"

determine_global_var_dir() {
    local default_dir="/usr/core_node/global_var"
    local wsl_users_path="/mnt/c/Users"
    
    [ -d "$wsl_users_path" ] && {
        for user_dir in "$wsl_users_path"/*; do
            [ -d "$user_dir" ] && {
                local potential_dir="$user_dir/.core_node/global_var"
                [ -d "$potential_dir" ] && {
                    echo "$potential_dir"
                    return 0
                }
            }
        done
    }
    
    echo "$default_dir"
    return 0
}

