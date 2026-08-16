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
RUSTDESK_INSTALL_INFO_SCRIPT="$CORE_NODE_ROOT_DIR/scripts/shells/linux/debian/server_manager/rustdesk_install_info.sh"

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
    
    local natgateway_script="$CORE_NODE_ROOT_DIR/scripts/shells/linux/debian/install_shells/102_natgateway.sh"
    
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
        echo "  bash $CORE_NODE_ROOT_DIR/scripts/shells/linux/debian/install_shells/126_setup_gnome_rdp.sh"
    fi

    echo ""
    echo "Press Enter to continue..."
    read
}

# Function to show RustDesk Server install info (Key, ports, IPs)
show_rustdesk_install_info() {
    echo "RustDesk Server Install Info"
    echo ""
    if [ -s "$RUSTDESK_INSTALL_INFO_SCRIPT" ]; then
        bash "$RUSTDESK_INSTALL_INFO_SCRIPT"
    else
        echo "Error: Script not found at: $RUSTDESK_INSTALL_INFO_SCRIPT"
    fi
    echo ""
    echo "Press Enter to continue..."
    read
}

# Function to show APP Install menu (single-package install from 120 list)
show_app_install_menu() {
    local app_install_script="$CORE_NODE_ROOT_DIR/scripts/shells/linux/menu_itemshells/app_install_menu.sh"
    if [ -s "$app_install_script" ]; then
        bash "$app_install_script"
    else
        echo "Error: app_install_menu.sh not found at $app_install_script"
    fi
    echo ""
    read -r -p "Press Enter to continue..."
}

# Slim GPU->CPU: run the torch + onnxruntime CPU guards (idempotent). On a host with
# no NVIDIA GPU these switch CUDA builds back to CPU and purge nvidia-* wheels,
# reclaiming disk; with a GPU (or already CPU) they no-op. See common/*_cpu_guard.sh.
slim_gpu_to_cpu() {
    printf "\033c"
    echo "=========================================="
    echo "GPU -> CPU Slim (reclaim CUDA disk on no-GPU hosts)"
    echo "=========================================="
    echo ""
    local torch_guard="$CORE_NODE_ROOT_DIR/scripts/shells/linux/common/torch_cpu_guard.sh"
    local onnx_guard="$CORE_NODE_ROOT_DIR/scripts/shells/linux/common/onnxruntime_cpu_guard.sh"

    if [ -f "$torch_guard" ]; then
        echo "[1/2] PyTorch CPU/GPU guard ..."
        bash "$torch_guard"
    else
        echo "Error: torch guard not found at: $torch_guard"
    fi
    echo ""
    if [ -f "$onnx_guard" ]; then
        echo "[2/2] ONNX Runtime CPU/GPU guard ..."
        bash "$onnx_guard"
    else
        echo "Error: onnxruntime guard not found at: $onnx_guard"
    fi
    echo ""
    echo "GPU -> CPU slim complete."
    echo "Press Enter to continue..."
    read
}

# Opt-in CUDA Toolkit install (GPU hosts). Delegates to the idempotent installer
# in common/install_cuda_toolkit.sh: apt where a candidate exists, else the
# pinned NVIDIA .run local installer (Kali path, with the libxml2 shim).
install_cuda_toolkit_menu() {
    printf "\033c"
    echo "=========================================="
    echo "Install CUDA Toolkit (nvcc)"
    echo "=========================================="
    echo ""
    local cuda_installer="$CORE_NODE_ROOT_DIR/scripts/shells/linux/common/install_cuda_toolkit.sh"
    if [ -f "$cuda_installer" ]; then
        bash "$cuda_installer"
    else
        echo "Error: CUDA installer not found at: $cuda_installer"
    fi
    echo ""
    echo "Press Enter to continue..."
    read
}

# Run as root (direct if already root, else via sudo). Shared by the slim actions.
_slim_sudo() { if [ "$(id -u)" -eq 0 ]; then "$@"; else sudo "$@"; fi; }

# --- core cleanups (no prompts; reused by individual items AND Server Slim) ---

# Remove dev/desktop snaps (flutter, dotnet-sdk, docker, chromium, android-studio)
# + orphan base snaps. Idempotent: skips snaps that aren't installed; snap refuses to
# remove a base still in use, so only truly-orphan bases drop. Leaves snapd / core.
_do_snap_slim() {
    if ! command -v snap >/dev/null 2>&1; then
        echo "snap is not installed; nothing to slim."
        return 0
    fi
    local s app_snaps=(flutter dotnet-sdk docker chromium android-studio)
    for s in "${app_snaps[@]}"; do
        if snap list "$s" >/dev/null 2>&1; then
            echo "Removing snap: $s"
            _slim_sudo snap remove --purge "$s" 2>/dev/null || _slim_sudo snap remove "$s" 2>/dev/null || true
        fi
    done
    local base_snaps
    base_snaps=$(snap list 2>/dev/null | awk 'NR>1 && $1 ~ /^core[0-9]+$/ {print $1}')
    for s in $base_snaps; do
        echo "Attempting to remove base snap (kept if still in use): $s"
        _slim_sudo snap remove --purge "$s" 2>/dev/null || _slim_sudo snap remove "$s" 2>/dev/null || echo "  ($s still in use or busy; kept)"
    done
}

# Block + remove Apache via the shared guard (apt pin -1 + purge). Idempotent.
_do_block_apache() {
    local guard="$CORE_NODE_ROOT_DIR/scripts/shells/linux/common/apache_block_guard.sh"
    if [ -f "$guard" ]; then
        bash "$guard"
    else
        echo "Error: apache_block_guard.sh not found at: $guard"
    fi
}

# Remove code-server (snap or apt), its service, install dirs (/usr/lib/code-server
# etc.) and per-user data. Idempotent. There is no repo installer (it is installed
# externally via code-server.dev), so removal is purely a cleanup.
_do_remove_code_server() {
    echo "Removing code-server ..."
    if command -v snap >/dev/null 2>&1 && snap list code-server >/dev/null 2>&1; then
        _slim_sudo snap remove --purge code-server 2>/dev/null || true
    fi
    if command -v dpkg >/dev/null 2>&1 && dpkg -l 2>/dev/null | grep -q "^ii.*code-server"; then
        _slim_sudo apt-get remove --purge -y code-server 2>/dev/null || true
    fi
    if command -v systemctl >/dev/null 2>&1; then
        _slim_sudo systemctl stop code-server 2>/dev/null || true
        _slim_sudo systemctl disable code-server 2>/dev/null || true
    fi
    _slim_sudo rm -rf /usr/lib/code-server /usr/local/lib/code-server /opt/code-server 2>/dev/null || true
    _slim_sudo rm -f /usr/bin/code-server /usr/local/bin/code-server 2>/dev/null || true
    rm -rf "$HOME/.config/code-server" "$HOME/.local/share/code-server" 2>/dev/null || true
    echo "code-server removed."
}

# Remove LibreOffice (+ unoconv, which depends on it) and drop /usr/lib/libreoffice.
# Idempotent.
_do_remove_libreoffice() {
    echo "Removing LibreOffice + unoconv ..."
    if command -v dpkg >/dev/null 2>&1 && dpkg -l 2>/dev/null | grep -q "^ii.*libreoffice"; then
        _slim_sudo apt-get remove --purge -y 'libreoffice*' unoconv 2>/dev/null || true
        _slim_sudo apt-get autoremove --purge -y 2>/dev/null || true
    fi
    _slim_sudo rm -rf /usr/lib/libreoffice 2>/dev/null || true
    echo "LibreOffice removed."
}

# --- individual menu wrappers (clear + core + pause) -------------------------
snap_slim() {
    printf "\033c"
    echo "=== Snap Slim (dev/desktop snaps + orphan bases) ==="
    echo ""
    _do_snap_slim
    echo ""
    echo "Remaining snaps:"; snap list 2>/dev/null || true
    echo ""
    echo "Press Enter to continue..."
    read
}

block_and_remove_apache() {
    printf "\033c"
    echo "=== Block & Remove Apache (nginx is the web server) ==="
    echo ""
    _do_block_apache
    echo ""
    echo "Press Enter to continue..."
    read
}

# One-shot: remove ALL desktop/dev bloat at once (the "同时清理" item).
server_slim_all() {
    printf "\033c"
    echo "=========================================="
    echo "Server Slim - remove desktop/dev bloat"
    echo "  snaps + code-server + LibreOffice + Apache"
    echo "=========================================="
    echo ""
    echo "[1/4] Snaps ..."
    _do_snap_slim
    echo ""
    echo "[2/4] code-server ..."
    _do_remove_code_server
    echo ""
    echo "[3/4] LibreOffice ..."
    _do_remove_libreoffice
    echo ""
    echo "[4/4] Apache ..."
    _do_block_apache
    echo ""
    echo "Server slim complete."
    echo ""
    echo "Press Enter to continue..."
    read
}

# One-click scan: recursively find directories > 1GB, drilled to depth 5. Each line
# is tagged with its path level (number of components). Levels 3-5 are the drill-down
# targets; a big dir shallower than level 3 is shown at its own (minimum) level, and
# the recursion is capped at level 5 ("max however many levels there are, up to 5").
# Uses `du -x` (single filesystem) so it skips /proc, /sys, /dev and other mounts.
scan_large_paths() {
    printf "\033c"
    echo "=========================================="
    echo "Scan Large Paths (> 1GB, depth up to 5)"
    echo "=========================================="
    local root="${1:-/}"
    if ! command -v du >/dev/null 2>&1; then
        echo "du is not available; cannot scan."
        echo ""
        echo "Press Enter to continue..."
        read
        return 0
    fi
    echo "Root: $root  (single filesystem; apparent disk usage)"
    echo "Scanning - this can take a while on a large tree ..."
    echo ""
    # -x: stay on one filesystem; --threshold=1G: only >= 1GB; --max-depth=5: cap depth.
    # Sort largest-first; tag each with its level (slash count, root = L0).
    du -x -h --threshold=1G --max-depth=5 "$root" 2>/dev/null \
        | sort -rh \
        | awk -F'\t' '{
              p=$2; lvl=gsub(/\//,"/",p); if ($2=="/") lvl=0;
              printf "  [L%d] %-9s %s\n", lvl, $1, $2;
          }'
    echo ""
    echo "Levels 3-5 are the drill-down targets; shallower big dirs show at their own level."
    echo ""
    echo "Press Enter to continue..."
    read
}

# Remove desktop apps that bloat a server: code-server + LibreOffice. Idempotent.
remove_desktop_apps() {
    printf "\033c"
    echo "=== Remove LibreOffice + code-server (desktop bloat) ==="
    echo ""
    _do_remove_code_server
    echo ""
    _do_remove_libreoffice
    echo ""
    echo "Press Enter to continue..."
    read
}

# Cap all *.log under /var/_core_node to 10MB each (in place, inode preserved) and
# install a periodic timer so they stay bounded regardless of the writer. The shared
# runtime base /var/_core_node is where xrdp_monitor, mcp_chrome, etc. append logs.
cap_var_core_node_logs() {
    printf "\033c"
    echo "=== Cap /var/_core_node log sizes (each *.log > 10MB trimmed) ==="
    echo ""
    local guard="$CORE_NODE_ROOT_DIR/scripts/shells/linux/common/log_size_cap.sh"
    if [ -f "$guard" ]; then
        bash "$guard" /var/_core_node
        bash "$guard" --install-timer
    else
        echo "Error: log_size_cap.sh not found at: $guard"
    fi
    echo ""
    echo "Press Enter to continue..."
    read
}

# Slim & Disk Cleanup sub-submenu: groups the disk/bloat tools (scan + the slim
# actions) so they don't clutter the top Linux Management menu.
show_slim_disk_submenu() {
    local selected=0
    local total=9
    local old_settings=$(stty -g)
    stty -icanon -echo
    trap 'stty "$old_settings"' RETURN

    local menu_items=(
        "Scan Large Paths (> 1GB, depth up to 5)"
        "Server Slim - ALL (snaps + code-server + LibreOffice + Apache)"
        "GPU -> CPU Slim (reclaim CUDA disk on no-GPU hosts)"
        "GPU: Install CUDA Toolkit (nvcc, GPU hosts; apt else .run)"
        "Snap Slim (remove dev/desktop snaps + orphan bases)"
        "Remove LibreOffice + code-server"
        "Block & Remove Apache (pin -1 + purge)"
        "Cap /var/_core_node log sizes (>10MB trim + timer)"
        "Back to Linux Management"
    )

    while true; do
        printf "\033c"
        echo "=========================================="
        echo "Slim & Disk Cleanup"
        echo "=========================================="
        echo "Select an option (Up/Down to move, Enter to select):"
        echo "Press Ctrl+C to go back"
        echo ""

        for i in "${!menu_items[@]}"; do
            if [ "$i" -eq "$selected" ]; then
                printf "\033[47m\033[30m> %-56s\033[0m\n" "${menu_items[$i]}"
            else
                printf "  %-56s\n" "${menu_items[$i]}"
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
                    0) scan_large_paths ;;
                    1) server_slim_all ;;
                    2) slim_gpu_to_cpu ;;
                    3) install_cuda_toolkit_menu ;;
                    4) snap_slim ;;
                    5) remove_desktop_apps ;;
                    6) block_and_remove_apache ;;
                    7) cap_var_core_node_logs ;;
                    8) return 0 ;;
                esac

                stty -icanon -echo
                ;;
        esac
    done
}

# Function to show Linux system tools submenu
show_linux_system_tools_submenu() {
    local selected=0
    local total=10
    local old_settings=$(stty -g)
    local char=""
    local seq=""
    local menu_items=(
        "Disable Ubuntu Automatic Updates"
        "Permissions Repair Menu"
        "NAT Gateway Configuration"
        "Restart GNOME Remote Desktop (Fix RDP Connection)"
        "Clear and Re-decrypt Secret Keys"
        "Show System Information"
        "RustDesk Server Install Info (Key & Ports)"
        "APP Install"
        "Slim & Disk Cleanup (scan + GPU/Snap/Apache/Server slim)"
        "Back to Linux Management"
    )

    stty -icanon -echo
    trap 'stty "$old_settings"' RETURN
    
    while true; do
        printf "\033c"
        echo "=========================================="
        echo "Linux System Tools"
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

        char=$(dd bs=1 count=1 2>/dev/null)

        case "$char" in
            $'\x1B')
                seq=""
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
                        show_rustdesk_install_info
                        ;;
                    7)
                        show_app_install_menu
                        ;;
                    8)
                        show_slim_disk_submenu
                        ;;
                    9)
                        return 0
                        ;;
                esac

                stty -icanon -echo
                ;;
        esac
    done
}

linux_managed_user_is_valid() {
    local username="$1"

    [[ "$username" =~ ^[a-z_][a-z0-9_-]{0,31}$ ]] || return 1
    system_user_is_excluded "$username" && return 1
    return 0
}

list_linux_managed_users() {
    local username=""
    local uid=""
    local home_dir=""
    local shell=""

    echo "Managed regular users:"
    while IFS=: read -r username _ uid _ _ home_dir shell; do
        [ "$uid" -ge 1000 ] 2>/dev/null || continue
        [ "$uid" -lt 65534 ] 2>/dev/null || continue
        linux_managed_user_is_valid "$username" || continue
        case "$shell" in
            */nologin|*/false) continue ;;
        esac
        printf "  %-20s uid=%-6s home=%s\n" "$username" "$uid" "$home_dir"
    done < <(getent passwd)
}

add_linux_managed_user() {
    local username=""
    local confirm=""

    printf "New username: "
    read -r username
    if ! linux_managed_user_is_valid "$username"; then
        echo "Invalid or reserved username: $username"
        return 1
    fi
    if id "$username" >/dev/null 2>&1; then
        echo "User already exists: $username"
        return 1
    fi
    printf "Create user '%s' with a home directory? [y/N]: " "$username"
    read -r confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || return 0
    $USE_SUDO useradd -m -U -s /bin/bash "$username"
    echo "User created: $username"
}

delete_linux_managed_user() {
    local username=""
    local confirm=""
    local active_user=""

    list_linux_managed_users
    echo ""
    printf "Username to delete (home directory will be preserved): "
    read -r username
    if ! linux_managed_user_is_valid "$username" || ! system_user_candidate_is_active_regular "$username"; then
        echo "Managed user not found: $username"
        return 1
    fi
    active_user="$(id -un 2>/dev/null || true)"
    if [ "$active_user" = "root" ] && system_user_candidate_is_active_regular "${SUDO_USER:-}"; then
        active_user="$SUDO_USER"
    elif [ "$active_user" = "root" ]; then
        active_user="$(who 2>/dev/null | awk 'NF { print $1; exit }')"
    fi
    if [ "$username" = "$active_user" ]; then
        echo "Refusing to delete the active user: $username"
        return 1
    fi
    printf "Type DELETE to remove account '%s': " "$username"
    read -r confirm
    [ "$confirm" = "DELETE" ] || return 0
    $USE_SUDO userdel "$username"
    echo "User account deleted; home directory preserved: $username"
}

show_linux_user_management_menu() {
    local choice=""

    while true; do
        printf "\033c"
        echo "=========================================="
        echo "Linux User Management"
        echo "=========================================="
        list_linux_managed_users
        echo ""
        echo "1) Add User"
        echo "2) Delete User"
        echo "3) Back to Linux Management"
        printf "Select an option [1-3]: "
        read -r choice
        case "$choice" in
            1) add_linux_managed_user ;;
            2) delete_linux_managed_user ;;
            3|q|Q|"") return 0 ;;
            *) echo "Invalid option: $choice" ;;
        esac
        echo ""
        echo "Press Enter to continue..."
        read -r
    done
}

# Function to show the consolidated Linux management submenu.
show_linux_management_submenu() {
    local selected=0
    local total=12
    local old_settings="$(stty -g)"
    local char=""
    local seq=""
    local menu_items=(
        "Install and Test Environment"
        "Git Management"
        "System Information & Variables"
        "Unified App Manager"
        "Set Special Software Environment Variables (like AI)"
        "Service Manager (Redis/PostgreSQL/Docker/MySQL/Nginx/SSH)"
        "Management & Backup"
        "AI & MCP Management (status/install/sync 8 tools)"
        "Push to git [all]"
        "User Management"
        "Linux System Tools"
        "Exit Linux Management"
    )

    stty -icanon -echo
    trap 'stty "$old_settings"' RETURN
    while true; do
        printf "\033c"
        echo "=========================================="
        echo "Linux Management"
        echo "=========================================="
        echo "Select an option (Up/Down to move, Enter to select):"
        echo "Press Ctrl+C to go back"
        echo ""
        for i in "${!menu_items[@]}"; do
            if [ "$i" -eq "$selected" ]; then
                printf "\033[47m\033[30m> %-68s\033[0m\n" "${menu_items[$i]}"
            else
                printf "  %-68s\n" "${menu_items[$i]}"
            fi
        done
        char="$(dd bs=1 count=1 2>/dev/null)"
        case "$char" in
            $'\x1B')
                seq=""
                read -r -t 0.1 -d '' seq
                case "$seq" in
                    '[A') ((selected--)); [ "$selected" -lt 0 ] && selected=$((total - 1)) ;;
                    '[B') ((selected++)); [ "$selected" -ge "$total" ] && selected=0 ;;
                esac
                ;;
            '')
                stty "$old_settings"
                printf "\033c"
                case "$selected" in
                    0) bash "$INSTALL_TEST_MENU_SCRIPT_PATH" ;;
                    1) show_git_management_menu ;;
                    2) bash "$SYSTEM_INFO_SCRIPT_PATH" ;;
                    3) (cd "$CORE_NODE_ROOT_DIR" && bash "$UNIFIED_MANAGER_SCRIPT_PATH") ;;
                    4) show_special_software_env_menu ;;
                    5) show_service_manager ;;
                    6) show_management_and_backup ;;
                    7) handle_menu_action "show_ai_mcp_management" "default" "AI_MCP_MENU" ;;
                    8) handle_menu_action "push_git" "all" "GIT_PUSH_TARGET" ;;
                    9) show_linux_user_management_menu ;;
                    10) show_linux_system_tools_submenu ;;
                    11) return 0 ;;
                esac
                stty -icanon -echo
                ;;
        esac
    done
}
