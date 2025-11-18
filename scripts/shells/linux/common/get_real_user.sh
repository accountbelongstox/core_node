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
# Real User Detection Helper Script
# =============================================================================
#
# Synopsis:
#     Bash wrapper for Python get_real_user() function
#
# Description:
#     This script provides a simple bash interface to the Python get_real_user()
#     function from pycore.pyfoundations.system_info module.
#
# Usage:
#     # Source this file to get helper functions
#     source /path/to/get_real_user.sh
#
#     # Get real user
#     real_user=$(get_real_user)
#
#     # Get real user home directory
#     real_user_home=$(get_real_user_home)
#
#     # Get real user Downloads directory
#     real_user_downloads=$(get_real_user_downloads)
#
#     # Or use directly without sourcing:
#     real_user=$(bash /path/to/get_real_user.sh)
#
# Returns:
#     When executed directly: Prints the real username
#     When sourced: Provides helper functions
# =============================================================================

# Function: Get real (non-root) user
# Uses Python helper from pycore.pyfoundations.system_info
get_real_user() {
    python3 -c "from pycore.pyfoundations.system_info import get_real_user; print(get_real_user())" 2>/dev/null || echo "ubuntu"
}

# Function: Get real user home directory
get_real_user_home() {
    python3 -c "from pycore.pyfoundations.system_info import get_real_user_home; print(get_real_user_home())" 2>/dev/null || echo "/home/ubuntu"
}

# Function: Get real user Downloads directory
get_real_user_downloads() {
    python3 -c "from pycore.pyfoundations.system_info import get_real_user_downloads; print(get_real_user_downloads())" 2>/dev/null || echo "/home/ubuntu/Downloads"
}

# If script is executed directly (not sourced), print the real user
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    get_real_user
fi
