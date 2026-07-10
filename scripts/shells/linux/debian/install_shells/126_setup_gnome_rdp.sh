#!/bin/bash
# GNOME Remote Desktop Settings UI Opener
# Opens GNOME Remote Desktop settings UI (no system changes)
#
# Usage:
#   ./127_setup_gnome_rdp.sh   # Prompt to open settings UI (desktop only)

# Script paths
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Default user - use detected desktop user
TARGET_USER="${ACTUAL_DESKTOP_USER:-ubuntu}"

# Cache file for UI prompt choice
CACHE_DIR="$HOME/.cache/core_node"
CACHE_FILE="$CACHE_DIR/125_rdp_ui_prompted"

# Ensure cache directory exists
mkdir -p "$CACHE_DIR"

print_header_from_common_functions "GNOME Remote Desktop Settings"

# Check if running on desktop system
if [ "$HAS_DESKTOP_ENVIRONMENT" != "true" ]; then
    print_info_from_common_functions "No desktop environment detected (server mode)."
    print_info_from_common_functions "GNOME Remote Desktop is designed for desktop systems only."
    exit 0
fi

print_info_from_common_functions "Desktop environment detected: $DESKTOP_ENVIRONMENT"

# Verify user exists
if ! id "$TARGET_USER" &>/dev/null; then
    print_error_from_common_functions "User $TARGET_USER does not exist"
    exit 1
fi

# Open Remote Desktop Settings UI (no system changes)
open_rdp_settings_ui() {
    print_step_from_common_functions "Opening GNOME Remote Desktop settings UI..."
    
    # Check if user is logged in
    USER_UID=$(id -u "$TARGET_USER")
    DBUS_SESSION=$(pgrep -u "$TARGET_USER" gnome-session | head -1)
    
    if [ -z "$DBUS_SESSION" ]; then
        print_warning_from_common_functions "User $TARGET_USER is not logged in to desktop"
        print_info_from_common_functions "Cannot open settings UI without active desktop session"
        print_info_from_common_functions "Please log in to the desktop first"
        return 1
    fi
    
    # Get D-Bus session address
    DBUS_ADDRESS=$(tr '\0' '\n' < /proc/$DBUS_SESSION/environ 2>/dev/null | grep '^DBUS_SESSION_BUS_ADDRESS=' | cut -d= -f2-)
    
    if [ -z "$DBUS_ADDRESS" ]; then
        print_error_from_common_functions "Failed to detect D-Bus session address"
        return 1
    fi
    
    # Try to open remote desktop settings panel
    # Method 1: Try gnome-control-center sharing (most common and direct)
    if command -v gnome-control-center &>/dev/null; then
        print_info_from_common_functions "Opening GNOME Settings (Sharing panel)..."
        sudo -u "$TARGET_USER" DBUS_SESSION_BUS_ADDRESS="$DBUS_ADDRESS" XDG_RUNTIME_DIR="/run/user/$USER_UID" \
            DISPLAY=:0 gnome-control-center sharing >/dev/null 2>&1 &
        
        sleep 2
        
        if pgrep -u "$TARGET_USER" gnome-control-center >/dev/null; then
            print_success_from_common_functions "GNOME Settings opened successfully"
            print_info_from_common_functions "Navigate to 'Remote Desktop' section in the Sharing panel"
            return 0
        fi
    fi
    
    # Method 2: Try opening Settings app directly (fallback)
    if command -v gnome-settings &>/dev/null; then
        print_info_from_common_functions "Opening GNOME Settings..."
        sudo -u "$TARGET_USER" DBUS_SESSION_BUS_ADDRESS="$DBUS_ADDRESS" XDG_RUNTIME_DIR="/run/user/$USER_UID" \
            DISPLAY=:0 gnome-settings >/dev/null 2>&1 &
        sleep 2
        if pgrep -u "$TARGET_USER" gnome-settings >/dev/null || pgrep -u "$TARGET_USER" gnome-control-center >/dev/null; then
            print_success_from_common_functions "GNOME Settings opened"
            print_info_from_common_functions "Please navigate to: Settings → Sharing → Remote Desktop"
            return 0
        fi
    fi
    
    # Method 3: Try using xdg-open (generic desktop file opener)
    if command -v xdg-open &>/dev/null; then
        print_info_from_common_functions "Attempting to open via xdg-open..."
        sudo -u "$TARGET_USER" DBUS_SESSION_BUS_ADDRESS="$DBUS_ADDRESS" XDG_RUNTIME_DIR="/run/user/$USER_UID" \
            DISPLAY=:0 xdg-open "settings://sharing" >/dev/null 2>&1 &
        sleep 2
        if pgrep -u "$TARGET_USER" gnome-control-center >/dev/null; then
            print_success_from_common_functions "GNOME Settings opened via xdg-open"
            return 0
        fi
    fi
    
    # Fallback: Provide manual instructions
    print_warning_from_common_functions "Could not automatically open settings UI"
    echo ""
    print_info_from_common_functions "Please manually open GNOME Settings:"
    echo "  1. Press Super key (Windows key) or click Activities"
    echo "  2. Search for 'Settings' or 'Sharing'"
    echo "  3. Open 'Settings' → 'Sharing' → 'Remote Desktop'"
    echo ""
    print_info_from_common_functions "Or run from terminal (as user $TARGET_USER):"
    echo "  gnome-control-center sharing"
    return 1
}

# Check cache and prompt user
if [ -f "$CACHE_FILE" ]; then
    # Cache exists - default to N (skip)
    echo ""
    read -r -p "Open GNOME Remote Desktop settings UI? [y/N] " user_input
    user_input=${user_input:-N}
    
    if [[ "$user_input" =~ ^[Yy]$ ]]; then
        open_rdp_settings_ui
    else
        print_info_from_common_functions "Skipped opening settings UI"
    fi
else
    # No cache - default to Y (open)
    echo ""
    read -r -p "Open GNOME Remote Desktop settings UI? [Y/n] " user_input
    user_input=${user_input:-Y}
    
    if [[ "$user_input" =~ ^[Yy]$ ]]; then
        if open_rdp_settings_ui; then
            # Create cache file to remember user choice
            touch "$CACHE_FILE"
        fi
    else
        print_info_from_common_functions "Skipped opening settings UI"
    fi
fi
