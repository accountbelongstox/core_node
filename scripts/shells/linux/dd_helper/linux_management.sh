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
# VIOLATION OF THESE RULES IS STRICTLY FORBIDDEN
# ### AI SPECIAL ATTENTION RULES END ###

# =============================================================================
# Linux Management Functions
# =============================================================================

# Source constants (backup copy)
source "$DD_HELPER_DIR/constants.sh"

# Build full paths from constants
DISABLE_UBUNTU_AUTO_UPDATES_SCRIPT_PATH="$CORE_NODE_ROOT_DIR/$DISABLE_UBUNTU_AUTO_UPDATES_SCRIPT_RELATIVE"
PERMISSIONS_REPAIR_MENU_SCRIPT="$DD_HELPER_DIR/permissions_repair_menu.sh"

# Function to disable Ubuntu automatic updates
disable_ubuntu_auto_updates() {
    echo "Disabling Ubuntu automatic updates..."
    echo "This will prevent kernel updates that may cause graphics driver issues."
    echo ""
    
    if [ -s "$DISABLE_UBUNTU_AUTO_UPDATES_SCRIPT_PATH" ]; then
        bash "$DISABLE_UBUNTU_AUTO_UPDATES_SCRIPT_PATH"
        if [ $? -eq 0 ]; then
            echo "Ubuntu automatic updates disabled successfully"
        else
            echo "Failed to disable Ubuntu automatic updates"
        fi
    else
        echo "Error: Script not found at: $DISABLE_UBUNTU_AUTO_UPDATES_SCRIPT_PATH"
        return 1
    fi
    
    echo ""
    echo "Press Enter to continue..."
    read
}

# Function to show permissions repair menu
show_permissions_repair_menu() {
    echo "Opening Permissions Repair Menu..."
    echo ""
    
    if [ -s "$PERMISSIONS_REPAIR_MENU_SCRIPT" ]; then
        source "$PERMISSIONS_REPAIR_MENU_SCRIPT"
        run_permissions_repair_menu "$CORE_NODE_ROOT_DIR"
    else
        echo "Error: Permissions repair menu script not found at: $PERMISSIONS_REPAIR_MENU_SCRIPT"
        echo ""
        echo "Press Enter to continue..."
        read
        return 1
    fi
}

# Function to manage NAT Gateway
manage_natgateway() {
    echo "NAT Gateway Configuration"
    echo ""
    
    local natgateway_script="$CORE_NODE_ROOT_DIR/scripts/shells/linux/debian/install_shells/101_natgateway.sh"
    
    if [ ! -f "$natgateway_script" ]; then
        echo "Error: NAT gateway script not found at: $natgateway_script"
        echo ""
        echo "Press Enter to continue..."
        read
        return
    fi
    
    echo "Launching NAT Gateway configuration..."
    echo ""
    
    if [ ! -x "$natgateway_script" ]; then
        chmod +x "$natgateway_script"
    fi
    
    bash "$natgateway_script"
    
    local exit_code=$?
    echo ""
    
    if [ $exit_code -eq 0 ]; then
        echo "NAT Gateway configuration completed successfully."
    else
        echo "NAT Gateway configuration exited with code: $exit_code"
    fi
    
    echo ""
    echo "Press Enter to continue..."
    read
}

# Function to show system information
show_system_information() {
    echo ""
    echo "System Information:"
    echo "==================="
    if [ -s /etc/os-release ]; then
        . /etc/os-release
        echo "OS: $PRETTY_NAME"
        echo "Version: $VERSION"
        echo "Kernel: $(uname -r)"
        echo "Architecture: $(uname -m)"
    fi
    echo ""
    echo "Memory:"
    free -h
    echo ""
    echo "Disk Usage:"
    df -h | grep -E "^/dev/"
    echo ""
    echo "Press Enter to continue..."
    read
}

# Function to restart GNOME Remote Desktop and fix connection issues
restart_gnome_rdp() {
    echo ""
    echo "=========================================="
    echo "GNOME Remote Desktop Connection Repair"
    echo "=========================================="
    echo ""

    # Check if desktop environment exists
    if [ "${HAS_DESKTOP_ENVIRONMENT:-false}" != "true" ]; then
        echo "Error: No desktop environment detected."
        echo "GNOME Remote Desktop requires a desktop system."
        echo ""
        echo "Press Enter to continue..."
        read
        return 1
    fi

    # Detect desktop user
    local TARGET_USER="${ACTUAL_DESKTOP_USER:-$(whoami)}"

    echo "Detected user: $TARGET_USER"
    echo ""

    # Verify user exists
    if ! id "$TARGET_USER" &>/dev/null; then
        echo "Error: User $TARGET_USER does not exist"
        echo ""
        read -p "Enter username to repair: " TARGET_USER
        if ! id "$TARGET_USER" &>/dev/null; then
            echo "Error: User $TARGET_USER does not exist"
            echo ""
            echo "Press Enter to continue..."
            read
            return 1
        fi
    fi

    # Check if user is logged in
    local USER_UID=$(id -u "$TARGET_USER" 2>/dev/null)
    local DBUS_SESSION=$(pgrep -u "$TARGET_USER" gnome-session 2>/dev/null | head -1)

    echo "Step 1: Checking desktop session status..."
    if [ -z "$DBUS_SESSION" ]; then
        echo "  [WARNING] User $TARGET_USER is NOT logged in to desktop"
        echo ""
        echo "GNOME Remote Desktop requires the user to be logged in."
        echo "Please log in to the desktop first, then run this repair again."
        echo ""
        echo "Press Enter to continue..."
        read
        return 1
    fi

    echo "  [OK] Desktop session found (PID: $DBUS_SESSION)"

    # Get D-Bus session address
    local DBUS_ADDRESS=$(tr '\0' '\n' < /proc/$DBUS_SESSION/environ 2>/dev/null | grep '^DBUS_SESSION_BUS_ADDRESS=' | cut -d= -f2-)

    if [ -z "$DBUS_ADDRESS" ]; then
        echo "  [ERROR] Failed to detect D-Bus session address"
        echo ""
        echo "Press Enter to continue..."
        read
        return 1
    fi

    echo "  [OK] D-Bus session detected"
    echo ""

    # Step 2: Stop the service
    echo "Step 2: Stopping GNOME Remote Desktop service..."
    if sudo -u "$TARGET_USER" DBUS_SESSION_BUS_ADDRESS="$DBUS_ADDRESS" XDG_RUNTIME_DIR="/run/user/$USER_UID" \
        systemctl --user stop gnome-remote-desktop 2>/dev/null; then
        echo "  [OK] Service stopped"
    else
        echo "  [WARNING] Service may not have been running"
    fi
    echo ""

    # Step 3: Restart the service
    echo "Step 3: Starting GNOME Remote Desktop service..."
    if sudo -u "$TARGET_USER" DBUS_SESSION_BUS_ADDRESS="$DBUS_ADDRESS" XDG_RUNTIME_DIR="/run/user/$USER_UID" \
        systemctl --user start gnome-remote-desktop 2>/dev/null; then
        echo "  [OK] Service started"
    else
        echo "  [ERROR] Failed to start service"
        echo ""
        echo "Trying to enable and start..."
        sudo -u "$TARGET_USER" DBUS_SESSION_BUS_ADDRESS="$DBUS_ADDRESS" XDG_RUNTIME_DIR="/run/user/$USER_UID" \
            systemctl --user enable gnome-remote-desktop 2>/dev/null
        sudo -u "$TARGET_USER" DBUS_SESSION_BUS_ADDRESS="$DBUS_ADDRESS" XDG_RUNTIME_DIR="/run/user/$USER_UID" \
            systemctl --user start gnome-remote-desktop 2>/dev/null
    fi
    echo ""

    # Step 4: Verify RDP status
    echo "Step 4: Checking RDP status..."
    local rdp_status=$(sudo -u "$TARGET_USER" DBUS_SESSION_BUS_ADDRESS="$DBUS_ADDRESS" XDG_RUNTIME_DIR="/run/user/$USER_UID" \
        grdctl status 2>/dev/null)

    if echo "$rdp_status" | grep -q "RDP.*enabled"; then
        echo "  [OK] RDP is enabled"

        # Show connection information
        echo ""
        echo "=========================================="
        echo "Connection Information"
        echo "=========================================="
        echo "Username: $TARGET_USER"
        echo "Port: 3389"
        echo ""
        echo "Available IP addresses:"
        hostname -I | tr ' ' '\n' | grep -v '^$' | sed 's/^/  /'
        echo ""

        # Auto-detect primary IP
        local PRIMARY_IP=$(hostname -I | awk '{print $1}')

        echo "Quick .rdp file template (save as linux.rdp):"
        echo "-------------------------------------------"
        cat << EOF
full address:s:$PRIMARY_IP
username:s:$TARGET_USER
enablecredsspsupport:i:0
authentication level:i:0
negotiate security layer:i:0
prompt for credentials:i:1
redirectclipboard:i:1
EOF
        echo "-------------------------------------------"
        echo ""
        echo "[SUCCESS] GNOME Remote Desktop is ready!"
    else
        echo "  [WARNING] RDP may not be enabled"
        echo ""
        echo "RDP Status:"
        echo "$rdp_status"
        echo ""
        echo "To enable RDP, run:"
        echo "  bash $CORE_NODE_ROOT_DIR/scripts/shells/linux/debian/install_shells/125_setup_gnome_rdp.sh"
    fi

    echo ""
    echo "Press Enter to continue..."
    read
}

# Function to show Linux management submenu
show_linux_management_submenu() {
    local selected=0
    local total=7
    local old_settings=$(stty -g)
    stty -icanon -echo
    trap 'stty "$old_settings"' RETURN

    local menu_items=(
        "Disable Ubuntu Automatic Updates"
        "Permissions Repair Menu"
        "NAT Gateway Configuration"
        "Restart GNOME Remote Desktop (Fix RDP Connection)"
        "Clear and Re-decrypt Secret Keys"
        "Show System Information"
        "Back to Main Menu"
    )
    
    while true; do
        printf "\033c"
        echo "=========================================="
        echo "Linux Management Menu"
        echo "=========================================="
        echo "Select an option (Up/Down to move, Enter to select):"
        echo "Press Ctrl+C to go back"
        echo ""

        for i in "${!menu_items[@]}"; do
            if [ "$i" -eq "$selected" ]; then
                printf "\033[47m\033[30m> %-40s\033[0m\n" "${menu_items[$i]}"
            else
                printf "  %-40s\n" "${menu_items[$i]}"
            fi
        done

        local char
        char=$(dd bs=1 count=1 2>/dev/null)

        case "$char" in
            $'\x1B')
                read -r -t 0.1 -d '' seq
                case "$seq" in
                    '[A')
                        ((selected--))
                        [ "$selected" -lt 0 ] && selected=$((total - 1))
                        ;;
                    '[B')
                        ((selected++))
                        [ "$selected" -ge "$total" ] && selected=0
                        ;;
                esac
                ;;
            '')
                stty "$old_settings"
                printf "\033c"

                case "$selected" in
                    0)
                        disable_ubuntu_auto_updates
                        ;;
                    1)
                        show_permissions_repair_menu
                        ;;
                    2)
                        manage_natgateway
                        ;;
                    3)
                        restart_gnome_rdp
                        ;;
                    4)
                        clear_and_redecrypt_secrets
                        ;;
                    5)
                        show_system_information
                        ;;
                    6)
                        return 0
                        ;;
                esac

                stty -icanon -echo
                ;;
        esac
    done
}
