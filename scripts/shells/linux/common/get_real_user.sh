#!/bin/bash

# =============================================================================
# Real User Detection Helper Script
# =============================================================================
#
# Synopsis:
#     Active or home-backed regular-user detection with root fallback
#
# Description:
#     Reuses the shared resolver. Explicit callers and active sessions win;
#     root-only execution scores filtered /home users by interactive folders.
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
#
# Caching:
#     Results are cached in mapped web cache directory
#     Cache expires after 300 seconds (5 minutes)
# =============================================================================

# Get script directory and source gvar_common.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Trust-based coding: directly source gvar_common.sh
source "$SCRIPT_DIR/gvar_common.sh"


# Function: Get the active regular user, or root when none is active
get_real_user() {
    detect_system_user
}

# Function: Get real user home directory
get_real_user_home() {
    local username="$(get_real_user)"
    local user_home=""

    if [ -z "$username" ]; then
        return 1
    fi

    user_home="$(getent passwd "$username" 2>/dev/null | cut -d: -f6)"
    [ -n "$user_home" ] || user_home="/root"
    echo "$user_home"
}

# Function: Get real user Downloads directory
get_real_user_downloads() {
    local user_home=$(get_real_user_home)
    if [ -z "$user_home" ]; then
        return 1
    fi

    echo "$user_home/Downloads"
}

# If script is executed directly (not sourced), print the real user
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    get_real_user
fi
