#!/bin/bash
# GNOME Remote Desktop Setup for Ubuntu 24.04+
# Uses built-in gnome-remote-desktop instead of xrdp
#
# Usage:
#   ./125_setup_gnome_rdp.sh                 # Setup for detected desktop user
#   ./125_setup_gnome_rdp.sh --user ubuntu   # Setup for specific user
#   ./125_setup_gnome_rdp.sh --disable       # Disable remote desktop
#   ./125_setup_gnome_rdp.sh --status        # Check status

# Script paths
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

# Default user - use detected desktop user
TARGET_USER="${ACTUAL_DESKTOP_USER:-ubuntu}"
ACTION="enable"
RDP_PASSWORD=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --user)
            TARGET_USER="$2"
            shift 2
            ;;
        --password)
            RDP_PASSWORD="$2"
            shift 2
            ;;
        --disable)
            ACTION="disable"
            shift
            ;;
        --status)
            ACTION="status"
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--user USERNAME] [--password PASSWORD] [--disable] [--status]"
            exit 1
            ;;
    esac
done

print_header_from_common_functions "GNOME Remote Desktop Setup"

# Only check desktop environment for enable action
if [ "$ACTION" = "enable" ]; then
    # Check if running on desktop system
    if [ "$HAS_DESKTOP_ENVIRONMENT" != "true" ]; then
        print_info_from_common_functions "No desktop environment detected (server mode)."
        print_info_from_common_functions "GNOME Remote Desktop is designed for desktop systems only."
        print_info_from_common_functions "Skipping installation."
        echo ""
        print_info_from_common_functions "For headless servers, consider:"
        print_info_from_common_functions "  - SSH Remote Access (17_setup_ssh_remote.sh)"
        exit 0
    fi

    print_info_from_common_functions "Desktop environment detected: $DESKTOP_ENVIRONMENT"
fi

# Verify user exists
if ! id "$TARGET_USER" &>/dev/null; then
    print_error_from_common_functions "User $TARGET_USER does not exist"
    exit 1
fi

print_info_from_common_functions "Target user: $TARGET_USER"

# Check status
check_status() {
    print_step_from_common_functions "Checking GNOME Remote Desktop status for user: $TARGET_USER"

    # Check if user is logged in
    USER_UID=$(id -u "$TARGET_USER")
    DBUS_SESSION=$(pgrep -u "$TARGET_USER" gnome-session | head -1)

    if [ -z "$DBUS_SESSION" ]; then
        print_warning_from_common_functions "User $TARGET_USER is not logged in to desktop"
        echo "Cannot check RDP status without active desktop session"
        return 1
    fi

    # Get D-Bus session address
    DBUS_ADDRESS=$(tr '\0' '\n' < /proc/$DBUS_SESSION/environ 2>/dev/null | grep '^DBUS_SESSION_BUS_ADDRESS=' | cut -d= -f2-)

    echo ""
    echo "=== Desktop Session ==="
    echo "User: $TARGET_USER (UID: $USER_UID)"
    echo "Session PID: $DBUS_SESSION"
    echo "D-Bus: ${DBUS_ADDRESS:0:50}..."

    echo ""
    echo "=== Service Status ==="
    sudo -u "$TARGET_USER" DBUS_SESSION_BUS_ADDRESS="$DBUS_ADDRESS" XDG_RUNTIME_DIR="/run/user/$USER_UID" systemctl --user status gnome-remote-desktop 2>/dev/null || echo "Service not running"

    echo ""
    echo "=== RDP Status ==="
    sudo -u "$TARGET_USER" DBUS_SESSION_BUS_ADDRESS="$DBUS_ADDRESS" XDG_RUNTIME_DIR="/run/user/$USER_UID" grdctl status 2>/dev/null || echo "RDP not configured"

    echo ""
    echo "=== Firewall Status ==="
    sudo ufw status | grep 3389 || echo "Port 3389 not in firewall rules"
}

# Check if GNOME Remote Desktop is already configured
is_rdp_configured() {
    # Check if user is logged in
    local user_uid=$(id -u "$TARGET_USER" 2>/dev/null)
    local dbus_session=$(pgrep -u "$TARGET_USER" gnome-session 2>/dev/null | head -1)

    if [ -z "$dbus_session" ]; then
        # User not logged in, check if service exists and is enabled
        if sudo -u "$TARGET_USER" systemctl --user list-unit-files 2>/dev/null | grep -q "gnome-remote-desktop.service.*enabled"; then
            # Service is enabled, assume RDP is configured
            return 0
        fi

        # Also check if RDP configuration files exist
        local user_home=$(getent passwd "$TARGET_USER" | cut -d: -f6)
        if [ -d "$user_home/.local/share/gnome-remote-desktop" ] || \
           [ -f "$user_home/.config/gnome-remote-desktop/rdp-credentials" ]; then
            return 0
        fi

        return 1
    fi

    # User is logged in, check if RDP is enabled
    local dbus_address=$(tr '\0' '\n' < /proc/$dbus_session/environ 2>/dev/null | grep '^DBUS_SESSION_BUS_ADDRESS=' | cut -d= -f2-)

    if [ -n "$dbus_address" ]; then
        if sudo -u "$TARGET_USER" DBUS_SESSION_BUS_ADDRESS="$dbus_address" XDG_RUNTIME_DIR="/run/user/$user_uid" grdctl status 2>/dev/null | grep -q "RDP.*enabled"; then
            return 0
        fi
    fi

    return 1
}

# Prompt user for installation confirmation
prompt_installation() {
    echo ""
    echo "=========================================="
    echo "GNOME Remote Desktop Setup"
    echo "=========================================="
    echo ""

    # Check if already configured
    if is_rdp_configured; then
        print_info_from_common_functions "GNOME Remote Desktop is already configured for user: $TARGET_USER"
        echo ""
        echo "Options:"
        echo "  - Press Enter or 'Y' to skip installation (keep current setup)"
        echo "  - Press 'n' to reinstall/reconfigure"
        echo ""

        local user_input
        read -r -p "Skip installation? [Y/n] " user_input
        user_input=${user_input:-Y}

        if [[ "$user_input" =~ ^[Yy]$ ]]; then
            print_info_from_common_functions "Installation skipped, keeping existing configuration."
            return 1
        else
            print_info_from_common_functions "Proceeding with reinstallation..."
            return 0
        fi
    else
        echo "This will enable remote desktop access for user: $TARGET_USER"
        echo ""
        echo "Features:"
        echo "  - Use native GNOME Remote Desktop (built-in)"
        echo "  - Connect via Windows Remote Desktop (mstsc)"
        echo "  - Port 3389 (standard RDP port)"
        echo "  - Requires user to be logged in"
        echo ""
        echo "Note: User must be logged in to the desktop for RDP to work."
        echo ""

        local user_input
        read -r -p "Enable GNOME Remote Desktop now? [Y/n] " user_input
        user_input=${user_input:-Y}

        if [[ "$user_input" =~ ^[Yy]$ ]]; then
            return 0
        fi

        print_info_from_common_functions "Installation skipped by user choice."
        return 1
    fi
}

# Enable Remote Desktop
enable_rdp() {
    print_step_from_common_functions "Enabling GNOME Remote Desktop for user: $TARGET_USER"

    # Install required packages
    print_step_from_common_functions "Installing required packages..."
    sudo apt-get update -qq
    sudo apt-get install -y gnome-remote-desktop freerdp2-x11

    # Prompt for password if not provided
    if [[ -z "$RDP_PASSWORD" ]]; then
        echo ""
        echo -n "Enter RDP password for user $TARGET_USER (plaintext visible): "
        read RDP_PASSWORD
        echo -n "Confirm password: "
        read RDP_PASSWORD_CONFIRM

        if [[ "$RDP_PASSWORD" != "$RDP_PASSWORD_CONFIRM" ]]; then
            print_error_from_common_functions "Passwords do not match"
            exit 1
        fi
    fi

    # Check if user is logged in to desktop
    print_step_from_common_functions "Checking desktop session..."
    USER_UID=$(id -u "$TARGET_USER")
    DBUS_SESSION=$(pgrep -u "$TARGET_USER" gnome-session | head -1)

    if [ -z "$DBUS_SESSION" ]; then
        print_warning_from_common_functions "User $TARGET_USER is not logged in to desktop!"
        print_info_from_common_functions "GNOME Remote Desktop requires the user to be logged in first."
        print_info_from_common_functions "Please log in to the desktop and run this script again."
        exit 1
    fi

    # Get D-Bus session address
    DBUS_ADDRESS=$(tr '\0' '\n' < /proc/$DBUS_SESSION/environ 2>/dev/null | grep '^DBUS_SESSION_BUS_ADDRESS=' | cut -d= -f2-)

    if [ -z "$DBUS_ADDRESS" ]; then
        print_error_from_common_functions "Failed to detect D-Bus session address"
        print_info_from_common_functions "Try logging out and back in, then run this script again."
        exit 1
    fi

    print_info_from_common_functions "Desktop session detected (PID: $DBUS_SESSION)"

    # Enable RDP via grdctl (as the target user with proper D-Bus environment)
    print_step_from_common_functions "Configuring RDP..."

    # Configure RDP using sudo with environment variables
    # Escape password to handle special characters safely
    local ESCAPED_PASSWORD=$(printf '%s' "$RDP_PASSWORD" | sed "s/'/'\\\\''/g")

    if ! sudo -u "$TARGET_USER" DBUS_SESSION_BUS_ADDRESS="$DBUS_ADDRESS" XDG_RUNTIME_DIR="/run/user/$USER_UID" \
        bash -c "grdctl rdp set-credentials '$TARGET_USER' '$ESCAPED_PASSWORD'"; then
        print_error_from_common_functions "Failed to set RDP credentials"
        exit 1
    fi

    if ! sudo -u "$TARGET_USER" DBUS_SESSION_BUS_ADDRESS="$DBUS_ADDRESS" XDG_RUNTIME_DIR="/run/user/$USER_UID" \
        grdctl rdp enable; then
        print_error_from_common_functions "Failed to enable RDP"
        exit 1
    fi

    # Disable view-only mode to allow remote control
    print_step_from_common_functions "Enabling remote control..."
    if ! sudo -u "$TARGET_USER" DBUS_SESSION_BUS_ADDRESS="$DBUS_ADDRESS" XDG_RUNTIME_DIR="/run/user/$USER_UID" \
        grdctl rdp disable-view-only; then
        print_warning_from_common_functions "Failed to disable view-only mode"
    fi

    # Enable and start service
    if ! sudo -u "$TARGET_USER" DBUS_SESSION_BUS_ADDRESS="$DBUS_ADDRESS" XDG_RUNTIME_DIR="/run/user/$USER_UID" \
        systemctl --user enable gnome-remote-desktop; then
        print_warning_from_common_functions "Failed to enable gnome-remote-desktop service (it may already be enabled)"
    fi

    if ! sudo -u "$TARGET_USER" DBUS_SESSION_BUS_ADDRESS="$DBUS_ADDRESS" XDG_RUNTIME_DIR="/run/user/$USER_UID" \
        systemctl --user restart gnome-remote-desktop; then
        print_error_from_common_functions "Failed to restart gnome-remote-desktop service"
        exit 1
    fi
    print_success_from_common_functions "RDP configuration completed"

    # Configure firewall
    print_step_from_common_functions "Configuring firewall..."
    if command -v ufw &>/dev/null; then
        sudo ufw allow 3389/tcp comment 'GNOME Remote Desktop'
        sudo ufw allow 3389/udp comment 'GNOME Remote Desktop UDP'
    fi

    # Configure TLS certificate trust (workaround for self-signed cert issues)
    print_step_from_common_functions "Configuring TLS certificate..."
    USER_HOME=$(getent passwd "$TARGET_USER" | cut -d: -f6)
    CERT_DIR="$USER_HOME/.local/share/gnome-remote-desktop"

    if [ -d "$CERT_DIR" ]; then
        print_info_from_common_functions "Certificate directory exists: $CERT_DIR"
        if [ -f "$CERT_DIR/rdp-tls.crt" ]; then
            print_info_from_common_functions "Self-signed certificate found"
            print_warning_from_common_functions "Windows may not trust this certificate"
            echo ""
            echo "To fix certificate trust issues on Windows:"
            echo "  1. Use 'mstsc /v:<ip>' without certificate validation"
            echo "  2. Or disable NLA in Windows RDP client settings"
        fi
    fi

    # Display connection info
    echo ""
    print_success_from_common_functions "GNOME Remote Desktop enabled successfully!"
    echo ""
    print_info_from_common_functions "Connection Information:"
    echo "  Username: $TARGET_USER"
    echo "  Password: (the one you just set)"
    echo "  Port: 3389"
    echo ""
    echo "Available IP addresses:"
    hostname -I | tr ' ' '\n' | grep -v '^$' | sed 's/^/  /'
    echo ""

    print_warning_from_common_functions "IMPORTANT: To avoid authentication errors on Windows:"
    echo ""
    echo "Method 1: Disable NLA in RDP connection (Recommended)"
    echo "  1. Open Remote Desktop Connection (mstsc)"
    echo "  2. Enter IP address, click 'Show Options'"
<<<<<<< HEAD
    echo "  3. Go to 'Advanced' tab â†’ 'Settings'"
=======
    echo "  3. Go to 'Advanced' tab â†?'Settings'"
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
    echo "  4. Set authentication to 'Do not connect if authentication fails'"
    echo ""
    echo "Method 2: Create .rdp file with:"

    # Auto-detect primary IP address
    PRIMARY_IP=$(hostname -I | awk '{print $1}')

    cat << EOF
  full address:s:$PRIMARY_IP
  username:s:$TARGET_USER
  enablecredsspsupport:i:0
  authentication level:i:0
  negotiate security layer:i:0
EOF

    echo ""
    echo "Or save the following as linux.rdp and double-click to connect:"
    echo ""

    cat << EOF
screen mode id:i:2
desktopwidth:i:1920
desktopheight:i:1080
session bpp:i:32
full address:s:$PRIMARY_IP
username:s:$TARGET_USER
audiomode:i:0
redirectclipboard:i:1
authentication level:i:0
prompt for credentials:i:1
negotiate security layer:i:0
enablecredsspsupport:i:0
EOF

    echo ""
    print_warning_from_common_functions "CRITICAL: User MUST remain logged in to desktop for RDP to work!"
    echo "  - Do NOT log out"
    echo "  - Locking screen is OK"
    echo "  - System sleep/hibernate will disconnect RDP"
    echo ""
}

# Disable Remote Desktop
disable_rdp() {
    print_step_from_common_functions "Disabling GNOME Remote Desktop for user: $TARGET_USER"

    # Check if user is logged in
    USER_UID=$(id -u "$TARGET_USER")
    DBUS_SESSION=$(pgrep -u "$TARGET_USER" gnome-session | head -1)

    if [ -z "$DBUS_SESSION" ]; then
        print_warning_from_common_functions "User $TARGET_USER is not logged in to desktop"
        print_info_from_common_functions "Will attempt to disable anyway using systemctl..."
        sudo -u "$TARGET_USER" systemctl --user stop gnome-remote-desktop 2>/dev/null || true
        sudo -u "$TARGET_USER" systemctl --user disable gnome-remote-desktop 2>/dev/null || true
        print_success_from_common_functions "Service disabled (if it was running)"
        return 0
    fi

    # Get D-Bus session address
    DBUS_ADDRESS=$(tr '\0' '\n' < /proc/$DBUS_SESSION/environ 2>/dev/null | grep '^DBUS_SESSION_BUS_ADDRESS=' | cut -d= -f2-)

    # Disable with proper environment
    sudo -u "$TARGET_USER" DBUS_SESSION_BUS_ADDRESS="$DBUS_ADDRESS" XDG_RUNTIME_DIR="/run/user/$USER_UID" grdctl rdp disable 2>/dev/null || true
    sudo -u "$TARGET_USER" DBUS_SESSION_BUS_ADDRESS="$DBUS_ADDRESS" XDG_RUNTIME_DIR="/run/user/$USER_UID" systemctl --user stop gnome-remote-desktop 2>/dev/null || true
    sudo -u "$TARGET_USER" DBUS_SESSION_BUS_ADDRESS="$DBUS_ADDRESS" XDG_RUNTIME_DIR="/run/user/$USER_UID" systemctl --user disable gnome-remote-desktop 2>/dev/null || true

    print_success_from_common_functions "GNOME Remote Desktop disabled"
}

# Main execution
case "$ACTION" in
    enable)
        if prompt_installation; then
            enable_rdp
        else
            exit 0
        fi
        ;;
    disable)
        disable_rdp
        ;;
    status)
        check_status
        ;;
esac
