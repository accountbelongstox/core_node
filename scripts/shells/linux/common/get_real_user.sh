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
#     Pure Bash real user detection (no hardcoded usernames, with caching)
#
# Description:
#     Detects real user by scanning /home/* directories and finding the most
#     recently modified accessible directory. Results are cached to /tmp for
#     performance. Works in both desktop and non-desktop environments without
#     hardcoding any usernames. Quickly skips inaccessible directories.
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

# Cache configuration - use mapped cache directory
CACHE_DIR=$(map_web_path "cache" "system")
mkdir -p "$CACHE_DIR" 2>/dev/null
CACHE_FILE="$CACHE_DIR/.real_user_cache"

CACHE_TTL=300  # 5 minutes

# Check if cache is valid
is_cache_valid() {
    if [ ! -f "$CACHE_FILE" ]; then
        return 1
    fi

    local cache_time=$(stat -c %Y "$CACHE_FILE" 2>/dev/null || echo 0)
    local current_time=$(date +%s)
    local age=$((current_time - cache_time))

    if [ $age -lt $CACHE_TTL ]; then
        return 0
    fi

    return 1
}

# Read from cache
read_cache() {
    if is_cache_valid; then
        cat "$CACHE_FILE" 2>/dev/null
        return 0
    fi
    return 1
}

# Write to cache
write_cache() {
    local username="$1"
    local user_home="$2"

    if [ -z "$username" ] || [ -z "$user_home" ]; then
        return 1
    fi

    echo "$username|$user_home" > "$CACHE_FILE" 2>/dev/null || true
}

# Detect if running in desktop environment
is_desktop_environment() {
    # Check for common desktop session variables
    if [ -n "$DESKTOP_SESSION" ] || [ -n "$XDG_CURRENT_DESKTOP" ] || [ -n "$GDMSESSION" ]; then
        return 0
    fi

    # Check for running desktop processes (with timeout)
    if timeout 2 pgrep -x "gnome-session|kde-session|xfce4-session|mate-session|cinnamon-session" >/dev/null 2>&1; then
        return 0
    fi

    return 1
}

# Quick accessibility check with timeout
is_dir_accessible() {
    local dir="$1"

    # Quick check - if not readable, skip immediately
    if [ ! -r "$dir" ]; then
        return 1
    fi

    # Try to access with timeout (1 second max)
    if timeout 1 test -r "$dir" 2>/dev/null; then
        return 0
    fi

    return 1
}

# Scan /home directories and find most recently modified accessible one
# Scans up to 3 levels deep, quickly skips inaccessible directories
find_most_recent_home_user() {
    local latest_time=0
    local latest_user=""
    local latest_home=""

    # Scan /home/* directories
    for user_home in /home/*; do
        # Quick checks - fail fast
        if [ ! -d "$user_home" ]; then
            continue
        fi

        # Quick accessibility check with timeout
        if ! is_dir_accessible "$user_home"; then
            continue
        fi

        local username=$(basename "$user_home")

        # Skip if not a valid user (with timeout)
        if ! timeout 1 id "$username" >/dev/null 2>&1; then
            continue
        fi

        # Get modification time (scan up to 3 levels)
        local max_mtime=0
        local depth=0
        local current_dirs=("$user_home")

        while [ $depth -lt 3 ] && [ ${#current_dirs[@]} -gt 0 ]; do
            local next_dirs=()

            for dir in "${current_dirs[@]}"; do
                # Quick skip if not accessible
                if ! is_dir_accessible "$dir"; then
                    continue
                fi

                # Get directory modification time with timeout
                local mtime=$(timeout 1 stat -c %Y "$dir" 2>/dev/null || echo 0)
                if [ "$mtime" -gt "$max_mtime" ]; then
                    max_mtime=$mtime
                fi

                # Collect subdirectories for next level (limit to prevent hanging)
                local subdir_count=0
                for subdir in "$dir"/*; do
                    # Skip if glob didn't match or not a directory
                    if [ ! -e "$subdir" ] || [ ! -d "$subdir" ]; then
                        continue
                    fi

                    # Quick accessibility check
                    if ! is_dir_accessible "$subdir"; then
                        continue
                    fi

                    next_dirs+=("$subdir")
                    subdir_count=$((subdir_count + 1))

                    # Limit subdirectories per level
                    if [ $subdir_count -ge 20 ]; then
                        break
                    fi
                done
            done

            current_dirs=("${next_dirs[@]}")
            depth=$((depth + 1))
        done

        # Update if this home is newer
        if [ "$max_mtime" -gt "$latest_time" ]; then
            latest_time=$max_mtime
            latest_user="$username"
            latest_home="$user_home"
        fi
    done

    if [ -n "$latest_user" ]; then
        echo "$latest_user|$latest_home"
        return 0
    fi

    return 1
}

# Function: Get real (non-root) user with caching
get_real_user() {
    # Try cache first
    local cached=$(read_cache)
    if [ -n "$cached" ]; then
        echo "$cached" | cut -d'|' -f1
        return 0
    fi

    local detected_user=""
    local detected_home=""

    # Non-desktop environment: return current login user
    if ! is_desktop_environment; then
        if [ "$(id -u)" -ne 0 ]; then
            detected_user="$USER"
            detected_home="$HOME"
        elif [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
            detected_user="$SUDO_USER"
            detected_home=$(getent passwd "$SUDO_USER" 2>/dev/null | cut -d: -f6)
        else
            # Scan /home for most recent user
            local result=$(find_most_recent_home_user)
            if [ -n "$result" ]; then
                detected_user=$(echo "$result" | cut -d'|' -f1)
                detected_home=$(echo "$result" | cut -d'|' -f2)
            else
                # Last resort: first non-system user
                detected_user=$(getent passwd | awk -F: '$3 >= 1000 && $3 < 60000 {print $1; exit}')
                if [ -n "$detected_user" ]; then
                    detected_home=$(getent passwd "$detected_user" 2>/dev/null | cut -d: -f6)
                fi
            fi
        fi

        if [ -n "$detected_user" ] && [ -n "$detected_home" ]; then
            write_cache "$detected_user" "$detected_home"
            echo "$detected_user"
        fi
        return 0
    fi

    # Desktop environment: detect real user

    # Priority 1: Not running as root - return current user
    if [ "$(id -u)" -ne 0 ]; then
        detected_user="$USER"
        detected_home="$HOME"
        write_cache "$detected_user" "$detected_home"
        echo "$detected_user"
        return 0
    fi

    # Priority 2: SUDO_USER
    if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
        detected_user="$SUDO_USER"
        detected_home=$(getent passwd "$SUDO_USER" 2>/dev/null | cut -d: -f6)
        if [ -n "$detected_home" ]; then
            write_cache "$detected_user" "$detected_home"
            echo "$detected_user"
            return 0
        fi
    fi

    # Priority 3: User with active desktop session
    for user_home in /home/*; do
        if [ -d "$user_home" ] && is_dir_accessible "$user_home"; then
            local username=$(basename "$user_home")
            if timeout 2 pgrep -u "$username" -x "gnome-session|kde-session|xfce4-session|mate-session|cinnamon-session" >/dev/null 2>&1; then
                detected_user="$username"
                detected_home="$user_home"
                write_cache "$detected_user" "$detected_home"
                echo "$detected_user"
                return 0
            fi
        fi
    done

    # Priority 4: Most recently modified /home directory (scan 3 levels)
    local result=$(find_most_recent_home_user)
    if [ -n "$result" ]; then
        detected_user=$(echo "$result" | cut -d'|' -f1)
        detected_home=$(echo "$result" | cut -d'|' -f2)
        write_cache "$detected_user" "$detected_home"
        echo "$detected_user"
        return 0
    fi

    # Priority 5: First non-system user (UID >= 1000)
    detected_user=$(getent passwd | awk -F: '$3 >= 1000 && $3 < 60000 {print $1; exit}')
    if [ -n "$detected_user" ]; then
        detected_home=$(getent passwd "$detected_user" 2>/dev/null | cut -d: -f6)
        if [ -n "$detected_home" ]; then
            write_cache "$detected_user" "$detected_home"
            echo "$detected_user"
            return 0
        fi
    fi
}

# Function: Get real user home directory
get_real_user_home() {
    # Try cache first
    local cached=$(read_cache)
    if [ -n "$cached" ]; then
        echo "$cached" | cut -d'|' -f2
        return 0
    fi

    local username=$(get_real_user)
    if [ -z "$username" ]; then
        return 1
    fi

    getent passwd "$username" | cut -d: -f6
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
