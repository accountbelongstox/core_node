#!/bin/bash
# XRDP Remote Desktop Installation Script
#
# Prerequisites:
#   - Desktop environment (GNOME, XFCE, etc.) must be installed
#   - Ubuntu 22.04+ or Debian 11+
#
# Usage:
#   ./124_install_xrdp.sh                    # Normal installation
#   ./124_install_xrdp.sh --force           # Force reinstallation
#   ./124_install_xrdp.sh --cleanup         # Remove XRDP installation
#
# This script installs XRDP - Remote Desktop Protocol server for Linux
# Enables Windows MSTSC (Remote Desktop Connection) to access Linux desktop
# After installation, it will detect all IPs and display available RDP addresses
#

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

# Script identification and path setup
SCRIPT_INDEX="124"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_1/debian_com/installation_library.sh"
source "$PARENT_DIR_LEVEL_2/common/firewall_manager.sh"

# Initialize global variables
init_global_vars

# Declare variables
INSTALL_MODE=$(get_var "INSTALL_MODE" "base")
FORCE_INSTALL=false
CLEANUP_MODE=false

# XRDP configuration
XRDP_PORT="3389"
XRDP_CONFIG_FILE="/etc/xrdp/xrdp.ini"
XRDP_SESMAN_CONFIG="/etc/xrdp/sesman.ini"
XRDP_INSTALLED_FLAG="/var/lib/xrdp/.installed"
XRDP_LOG_ARCHIVE_DIR="/var/_core_node/xorg"
XRDP_LOG_SERVICE_SCRIPT="/usr/local/bin/core_node_xrdp_log_collector.sh"
XRDP_LOG_SERVICE_NAME="xrdp-log-sync"
XRDP_LOG_SERVICE_DESCRIPTION="CoreNode XRDP Log Collector"
DEBIAN_SERVICE_MANAGER="$PARENT_DIR_LEVEL_2/common/debian_service_manager.sh"

# Ensure sudo is available and set USE_SUDO
if command -v sudo >/dev/null 2>&1; then
    USE_SUDO="sudo"
else
    USE_SUDO=""
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force)
                FORCE_INSTALL=true
                shift
                ;;
            --cleanup)
                CLEANUP_MODE=true
                shift
                ;;
            --diagnose)
                diagnose_xrdp
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                echo "Usage: $0 [--force] [--cleanup] [--diagnose]"
                exit 1
                ;;
        esac
    done
}

# Diagnose XRDP connection issues
diagnose_xrdp() {
    print_header_from_common_functions "XRDP Diagnostic Tool"

    echo ""
    print_step_from_common_functions "Checking XRDP service status..."
    $USE_SUDO systemctl status xrdp --no-pager || echo "Service not running"

    echo ""
    print_step_from_common_functions "Checking recent XRDP logs..."
    echo "=== Last 50 lines of syslog (xrdp related) ==="
    $USE_SUDO grep -i "xrdp\|xorgxrdp" /var/log/syslog 2>/dev/null | tail -50 || echo "No syslog entries found"

    echo ""
    echo "=== Last 30 lines of xrdp.log ==="
    $USE_SUDO tail -30 /var/log/xrdp.log 2>/dev/null || echo "/var/log/xrdp.log not found"

    echo ""
    echo "=== Last 30 lines of xrdp-sesman.log ==="
    $USE_SUDO tail -30 /var/log/xrdp-sesman.log 2>/dev/null || echo "/var/log/xrdp-sesman.log not found"

    echo ""
    print_step_from_common_functions "Checking X11 wrapper configuration..."
    if [[ -f "/etc/X11/Xwrapper.config" ]]; then
        echo "=== /etc/X11/Xwrapper.config ==="
        cat /etc/X11/Xwrapper.config
    else
        echo "WARNING: /etc/X11/Xwrapper.config not found!"
    fi

    echo ""
    print_step_from_common_functions "Checking user session files..."
    for user_home in /root /home/*; do
        if [[ -d "$user_home" ]]; then
            local username=$(basename "$user_home")
            if [[ "$user_home" == "/root" ]]; then
                username="root"
            fi

            echo "--- User: $username ($user_home) ---"

            if [[ -f "$user_home/.xsession" ]]; then
                echo ".xsession exists:"
                head -5 "$user_home/.xsession"
            else
                echo "WARNING: .xsession NOT found"
            fi

            if [[ -f "$user_home/.xsessionrc" ]]; then
                echo ".xsessionrc exists: YES"
            else
                echo "WARNING: .xsessionrc NOT found"
            fi
            echo ""
        fi
    done

    echo ""
    print_step_from_common_functions "Checking PolicyKit configuration..."
    if [[ -f "/etc/polkit-1/localauthority/50-local.d/45-allow-colord.pkla" ]]; then
        echo "PolicyKit colord rule: EXISTS"
    else
        echo "WARNING: PolicyKit colord rule NOT found"
    fi

    echo ""
    print_step_from_common_functions "Checking desktop session availability..."
    for cmd in gnome-session startxfce4 startkde startlxde mate-session; do
        if command -v $cmd >/dev/null 2>&1; then
            echo "âœ?$cmd found"
        else
            echo "âœ?$cmd not found"
        fi
    done

    echo ""
    print_success_from_common_functions "Diagnostic complete!"
    echo ""
    print_info_from_common_functions "Common issues and solutions:"
    echo "  1. 'connection closed' after login â†?Check .xsession and desktop session"
    echo "  2. 'authentication required' popup â†?Check PolicyKit rules"
    echo "  3. 'could not start X server' â†?Check Xwrapper.config permissions"
    echo "  4. Black screen â†?Check desktop environment installation"
    echo ""
    echo "To see full logs, run:"
    echo "  sudo tail -f /var/log/xrdp-sesman.log"
    echo ""
}

# Get installed version
get_installed_version() {
    if [[ -f "$XRDP_INSTALLED_FLAG" ]]; then
        grep "^VERSION=" "$XRDP_INSTALLED_FLAG" 2>/dev/null | cut -d= -f2
    fi
}

# Save installation info
save_installation_info() {
    local version="$1"

    $USE_SUDO mkdir -p "$(dirname "$XRDP_INSTALLED_FLAG")"
    cat <<EOF | $USE_SUDO tee "$XRDP_INSTALLED_FLAG" > /dev/null
DATE=$(date '+%Y-%m-%d %H:%M:%S')
VERSION=$version
PORT=$XRDP_PORT
CONFIG=$XRDP_CONFIG_FILE
EOF
}

# Check if XRDP is already installed
is_xrdp_installed() {
    if command -v xrdp >/dev/null 2>&1; then
        return 0  # Installed
    fi
    return 1  # Not installed
}

# Check Ubuntu version
check_ubuntu_version() {
    print_step_from_common_functions "Checking Ubuntu version..."

    if [[ ! -f /etc/os-release ]]; then
        print_error_from_common_functions "Cannot determine OS version"
        return 1
    fi

    source /etc/os-release

    # Extract major version
    local version_id="${VERSION_ID%%.*}"

    if [[ "$ID" == "ubuntu" ]]; then
        if [[ "$version_id" -ge 22 ]]; then
            print_success_from_common_functions "Ubuntu $VERSION_ID detected (supported)"
            return 0
        else
            print_warning_from_common_functions "Ubuntu $VERSION_ID detected (recommended: 22.04+)"
            echo -n "Continue anyway? (y/N): "
            read -r response
            case "$response" in
                [yY]|[yY][eE][sS])
                    return 0
                    ;;
                *)
                    print_error_from_common_functions "Installation cancelled"
                    return 1
                    ;;
            esac
        fi
    elif [[ "$ID" == "debian" ]]; then
        if [[ "$version_id" -ge 11 ]]; then
            print_success_from_common_functions "Debian $VERSION_ID detected (supported)"
            return 0
        else
            print_warning_from_common_functions "Debian $VERSION_ID detected (recommended: 11+)"
            echo -n "Continue anyway? (y/N): "
            read -r response
            case "$response" in
                [yY]|[yY][eE][sS])
                    return 0
                    ;;
                *)
                    print_error_from_common_functions "Installation cancelled"
                    return 1
                    ;;
            esac
        fi
    else
        print_warning_from_common_functions "OS $ID $VERSION_ID may not be fully supported"
        echo -n "Continue anyway? (y/N): "
        read -r response
        case "$response" in
            [yY]|[yY][eE][sS])
                return 0
                ;;
            *)
                print_error_from_common_functions "Installation cancelled"
                return 1
                ;;
        esac
    fi
}

# Check if desktop environment is installed
check_desktop_environment() {
    print_step_from_common_functions "Checking desktop environment..."

    local desktop_sessions=(
        "/usr/share/xsessions"
        "/usr/share/wayland-sessions"
    )

    local found_desktop=false
    local desktop_list=""

    for session_dir in "${desktop_sessions[@]}"; do
        if [[ -d "$session_dir" ]]; then
            local sessions=$(ls -1 "$session_dir"/*.desktop 2>/dev/null | wc -l)
            if [[ $sessions -gt 0 ]]; then
                found_desktop=true
                desktop_list+=$(ls -1 "$session_dir"/*.desktop 2>/dev/null | xargs -n1 basename | sed 's/.desktop//' | tr '\n' ', ')
            fi
        fi
    done

    if [[ "$found_desktop" == true ]]; then
        desktop_list=${desktop_list%,}
        print_success_from_common_functions "Desktop environment detected: $desktop_list"
        return 0
    else
        print_error_from_common_functions "No desktop environment detected"
        print_info_from_common_functions "XRDP requires a desktop environment to function"
        print_info_from_common_functions "Please install a desktop environment first (GNOME, XFCE, KDE, etc.)"
        return 1
    fi
}

# Install required dependencies
install_dependencies() {
    print_step_from_common_functions "Installing required dependencies..."

    # Update package list
    $USE_SUDO apt-get update -qq

    # Essential dependencies for XRDP
    local deps=(
        "xrdp"              # Remote Desktop Protocol server
        "xorgxrdp"          # X.Org drivers for xrdp
        "dbus-x11"          # D-Bus X11 protocol support
        "x11-xserver-utils" # X server utilities
    )

    for dep in "${deps[@]}"; do
        # Extract package name (remove comments)
        local pkg=$(echo "$dep" | awk '{print $1}')

        if ! dpkg -l | grep -q "^ii  $pkg "; then
            print_step_from_common_functions "Installing $pkg..."
            $USE_SUDO apt-get install -y "$pkg"
        else
            print_info_from_common_functions "$pkg is already installed"
        fi
    done

    print_success_from_common_functions "All dependencies installed"
    return 0
}

create_log_collector_script() {
    $USE_SUDO mkdir -p "$XRDP_LOG_ARCHIVE_DIR"
    $USE_SUDO chmod 750 "$XRDP_LOG_ARCHIVE_DIR" 2>/dev/null || true

    $USE_SUDO bash -c "cat > '$XRDP_LOG_SERVICE_SCRIPT'" <<'EOF'
#!/bin/bash
set -uo pipefail
umask 027

LOG_DIR="/var/_core_node/xorg"
SOURCE_FILES=("/var/log/xrdp.log" "/var/log/xrdp-sesman.log")
SOURCE_DIR="/var/log/xrdp"
SYNC_INTERVAL=5

mkdir -p "$LOG_DIR"
chmod 750 "$LOG_DIR" 2>/dev/null || true

log_message() {
    local message="$1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $message" >> "$LOG_DIR/collector.log"
}

copy_file() {
    local src="$1"
    local dest="$2"

    if [[ -f "$src" ]]; then
        if cp "$src" "${dest}.tmp" 2>/dev/null; then
            mv "${dest}.tmp" "$dest"
            chmod 640 "$dest" 2>/dev/null || true
        fi
    fi
}

while true; do
    for src in "${SOURCE_FILES[@]}"; do
        dest="$LOG_DIR/$(basename "$src")"
        copy_file "$src" "$dest"
    done

    if [[ -d "$SOURCE_DIR" ]]; then
        for src in "$SOURCE_DIR"/*.log; do
            [[ -f "$src" ]] || continue
            dest="$LOG_DIR/$(basename "$src")"
            copy_file "$src" "$dest"
        done
    fi

    log_message "XRDP logs synchronized"
    sleep "$SYNC_INTERVAL"
done
EOF

    if [[ $? -ne 0 ]]; then
        print_error_from_common_functions "Failed to create log collector script"
        return 1
    fi

    $USE_SUDO chmod +x "$XRDP_LOG_SERVICE_SCRIPT"
    return 0
}

setup_xrdp_log_service() {
    print_step_from_common_functions "Setting up XRDP log collector service..."

    if [[ ! -f "$DEBIAN_SERVICE_MANAGER" ]]; then
        print_warning_from_common_functions "debian_service_manager.sh not found at $DEBIAN_SERVICE_MANAGER"
        return 1
    fi

    if ! create_log_collector_script; then
        return 1
    fi

    local cpu_limit="5%"
    local memory_limit="150M"

    if $USE_SUDO bash "$DEBIAN_SERVICE_MANAGER" create "$XRDP_LOG_SERVICE_SCRIPT" "$XRDP_LOG_SERVICE_NAME" "$XRDP_LOG_SERVICE_DESCRIPTION" "$cpu_limit" "$memory_limit"; then
        print_success_from_common_functions "XRDP log collector service installed"
        print_info_from_common_functions "Logs mirrored to: $XRDP_LOG_ARCHIVE_DIR"
        return 0
    else
        print_warning_from_common_functions "Failed to configure XRDP log collector service"
        return 1
    fi
}

remove_xrdp_log_service() {
    print_step_from_common_functions "Removing XRDP log collector service..."

    if [[ -f "$DEBIAN_SERVICE_MANAGER" ]]; then
        $USE_SUDO bash "$DEBIAN_SERVICE_MANAGER" remove "$XRDP_LOG_SERVICE_NAME" 2>/dev/null || true
    fi

    $USE_SUDO rm -f "$XRDP_LOG_SERVICE_SCRIPT" 2>/dev/null || true
    print_success_from_common_functions "XRDP log collector service removal complete"
}

restore_xorg_section_if_needed() {
    local backup_file="${XRDP_CONFIG_FILE}.backup"
    local template_source=""
    local needs_restore=0

    if [[ ! -f "$XRDP_CONFIG_FILE" ]]; then
        return 0
    fi

    if ! grep -q '^param=-config' "$XRDP_CONFIG_FILE" 2>/dev/null; then
        needs_restore=1
    fi

    if ! grep -q '^param=xrdp/xorg.conf' "$XRDP_CONFIG_FILE" 2>/dev/null; then
        needs_restore=1
    fi

    if [[ $needs_restore -eq 0 ]]; then
        print_info_from_common_functions "DEBUG: [Xorg] section already contains required parameters"
        return 0
    fi

    if [[ -f "$backup_file" ]]; then
        template_source="$backup_file"
    elif [[ -f "/usr/share/doc/xrdp/examples/xrdp.ini" ]]; then
        template_source="/usr/share/doc/xrdp/examples/xrdp.ini"
    elif [[ -f "/usr/share/xrdp/xrdp.ini" ]]; then
        template_source="/usr/share/xrdp/xrdp.ini"
    fi

    if [[ -z "$template_source" ]]; then
        print_warning_from_common_functions "Unable to restore [Xorg] section: no template file available"
        return 1
    fi

    print_step_from_common_functions "Restoring [Xorg] section in xrdp.ini..."

    if $USE_SUDO python3 - "$XRDP_CONFIG_FILE" "$template_source" <<'PY'; then
import sys
from pathlib import Path

config_path = Path(sys.argv[1])
source_path = Path(sys.argv[2])
section_name = 'xorg'

def normalize(lines):
    normalized = []
    for line in lines:
        if not line.endswith('\n'):
            normalized.append(line + '\n')
        else:
            normalized.append(line)
    return normalized

def extract_section(lines):
    result = []
    inside = False
    header = f'[{section_name}]'
    header_lower = header.lower()
    for line in lines:
        stripped = line.strip().lower()
        if stripped == header_lower:
            inside = True
        if inside:
            if stripped.startswith('[') and stripped != '' and stripped != header_lower and result:
                break
            result.append(line)
    return result

def replace_section(lines, new_section):
    result = []
    inside = False
    replaced = False
    header = f'[{section_name}]'
    header_lower = header.lower()

    for line in lines:
        stripped = line.strip().lower()
        if stripped == header_lower:
            if not replaced:
                result.extend(new_section)
                replaced = True
            inside = True
            continue
        if inside:
            if stripped.startswith('[') and stripped != '':
                inside = False
                result.append(line)
            continue
        result.append(line)

    if not replaced:
        if result and result[-1].strip() != '':
            result.append('\n')
        result.extend(new_section)

    return result

config_lines = normalize(config_path.read_text().splitlines())
source_lines = normalize(source_path.read_text().splitlines())

joined_config = ''.join(config_lines)
if 'param=-config' in joined_config and 'param=xrdp/xorg.conf' in joined_config:
    sys.exit(0)

new_section = extract_section(source_lines)
if not new_section:
    sys.exit(1)

updated_lines = replace_section(config_lines, new_section)
config_path.write_text(''.join(updated_lines))
PY
        print_success_from_common_functions "[Xorg] section restored"
    else
        print_error_from_common_functions "Failed to restore [Xorg] section"
        return 1
    fi

    return 0
}

# Configure XRDP
configure_xrdp() {
    print_step_from_common_functions "Configuring XRDP..."
    print_info_from_common_functions "DEBUG: XRDP config file: $XRDP_CONFIG_FILE"
    print_info_from_common_functions "DEBUG: XRDP sesman config: $XRDP_SESMAN_CONFIG"
    print_info_from_common_functions "DEBUG: XRDP port: $XRDP_PORT"

    # Backup original configuration
    if [[ -f "$XRDP_CONFIG_FILE" ]] && [[ ! -f "${XRDP_CONFIG_FILE}.backup" ]]; then
        $USE_SUDO cp "$XRDP_CONFIG_FILE" "${XRDP_CONFIG_FILE}.backup"
        print_info_from_common_functions "DEBUG: Backed up original configuration to ${XRDP_CONFIG_FILE}.backup"
    else
        print_info_from_common_functions "DEBUG: Backup already exists or config file not found"
    fi

    # Restore a healthy [Xorg] section if previous runs corrupted it
    if ! restore_xorg_section_if_needed; then
        return 1
    fi

    # Set port in xrdp.ini
    print_info_from_common_functions "DEBUG: Setting port to $XRDP_PORT in xrdp.ini"
    $USE_SUDO sed -i "s/^port=.*/port=$XRDP_PORT/" "$XRDP_CONFIG_FILE"

    # Enable certificate-based encryption
    print_info_from_common_functions "DEBUG: Configuring security settings"
    $USE_SUDO sed -i 's/^security_layer=.*/security_layer=negotiate/' "$XRDP_CONFIG_FILE"
    $USE_SUDO sed -i 's/^crypt_level=.*/crypt_level=high/' "$XRDP_CONFIG_FILE"

    # Configure session manager
    if [[ -f "$XRDP_SESMAN_CONFIG" ]]; then
        print_info_from_common_functions "DEBUG: Configuring sesman.ini settings"
        # Allow root login (user can disable this manually for security)
        $USE_SUDO sed -i 's/^AllowRootLogin=.*/AllowRootLogin=true/' "$XRDP_SESMAN_CONFIG" 2>/dev/null || true
        print_info_from_common_functions "DEBUG: AllowRootLogin set to true"
        # Allow multiple sessions per user
        $USE_SUDO sed -i 's/^MaxSessions=.*/MaxSessions=10/' "$XRDP_SESMAN_CONFIG" 2>/dev/null || true
        print_info_from_common_functions "DEBUG: MaxSessions set to 10"
    else
        print_info_from_common_functions "DEBUG: sesman.ini not found at $XRDP_SESMAN_CONFIG"
    fi

    # Add xrdp user to ssl-cert group for certificate access
    print_info_from_common_functions "DEBUG: Adding xrdp user to ssl-cert group"
    $USE_SUDO adduser xrdp ssl-cert 2>/dev/null || true

    # Fix X11 wrapper permissions (critical for XORG mode)
    print_step_from_common_functions "Configuring X11 permissions..."
    local xwrapper_config="/etc/X11/Xwrapper.config"
    print_info_from_common_functions "DEBUG: X11 wrapper config: $xwrapper_config"
    if [[ -f "$xwrapper_config" ]]; then
        $USE_SUDO cp "$xwrapper_config" "${xwrapper_config}.backup" 2>/dev/null || true
        print_info_from_common_functions "DEBUG: Backed up existing X11 wrapper config"
    else
        print_info_from_common_functions "DEBUG: X11 wrapper config does not exist, will create new"
    fi

    # Allow anybody to start X server (required for xrdp user)
    print_info_from_common_functions "DEBUG: Setting allowed_users=anybody in X11 wrapper"
    $USE_SUDO bash -c "cat > $xwrapper_config" <<'EOF'
# Xwrapper.config - Allow xrdp to start X server
# This is required for XRDP to work properly
allowed_users=anybody
needs_root_rights=yes
EOF
    print_success_from_common_functions "X11 permissions configured"
    print_info_from_common_functions "DEBUG: X11 wrapper configuration complete"

    # Create PolicyKit rule for colord (prevents authentication popup/disconnect)
    print_step_from_common_functions "Configuring PolicyKit permissions..."
    local polkit_dir="/etc/polkit-1/localauthority/50-local.d"
    local polkit_rule="$polkit_dir/45-allow-colord.pkla"
    print_info_from_common_functions "DEBUG: PolicyKit directory: $polkit_dir"
    print_info_from_common_functions "DEBUG: PolicyKit rule file: $polkit_rule"

    $USE_SUDO mkdir -p "$polkit_dir"
    print_info_from_common_functions "DEBUG: Created PolicyKit directory"
    $USE_SUDO bash -c "cat > $polkit_rule" <<'EOF'
[Allow Colord All Users]
Identity=unix-user:*
Action=org.freedesktop.color-manager.create-device;org.freedesktop.color-manager.create-profile;org.freedesktop.color-manager.delete-device;org.freedesktop.color-manager.delete-profile;org.freedesktop.color-manager.modify-device;org.freedesktop.color-manager.modify-profile
ResultAny=no
ResultInactive=no
ResultActive=yes
EOF
    print_success_from_common_functions "PolicyKit permissions configured"
    print_info_from_common_functions "DEBUG: PolicyKit colord rule created"

    # Detect available desktop session
    print_step_from_common_functions "Detecting desktop session..."
    local desktop_session=""
    print_info_from_common_functions "DEBUG: Checking for desktop session commands..."
    if command -v gnome-session >/dev/null 2>&1; then
        desktop_session="gnome-session"
        print_info_from_common_functions "DEBUG: Found gnome-session"
    elif command -v startxfce4 >/dev/null 2>&1; then
        desktop_session="startxfce4"
        print_info_from_common_functions "DEBUG: Found startxfce4"
    elif command -v startkde >/dev/null 2>&1; then
        desktop_session="startkde"
        print_info_from_common_functions "DEBUG: Found startkde"
    elif command -v startlxde >/dev/null 2>&1; then
        desktop_session="startlxde"
        print_info_from_common_functions "DEBUG: Found startlxde"
    elif command -v mate-session >/dev/null 2>&1; then
        desktop_session="mate-session"
        print_info_from_common_functions "DEBUG: Found mate-session"
    fi

    if [[ -z "$desktop_session" ]]; then
        print_warning_from_common_functions "No desktop session command detected"
        print_info_from_common_functions "DEBUG: No desktop session commands found in PATH"
    else
        print_info_from_common_functions "Detected desktop session: $desktop_session"
        print_info_from_common_functions "DEBUG: Will use $desktop_session for user sessions"
    fi

    # Create session configuration for ALL existing users (including root)
    print_step_from_common_functions "Creating session files for all users..."
    print_info_from_common_functions "DEBUG: Scanning /etc/passwd for users to configure"

    # Get list of real users (UID >= 1000 or root)
    local users_to_configure=("root")
    while IFS=: read -r username _ uid _ _ homedir _; do
        if [[ $uid -ge 1000 ]] && [[ -d "$homedir" ]]; then
            users_to_configure+=("$username")
            print_info_from_common_functions "DEBUG: Found user: $username (UID: $uid, home: $homedir)"
        fi
    done < /etc/passwd

    print_info_from_common_functions "DEBUG: Total users to configure: ${#users_to_configure[@]}"
    print_info_from_common_functions "DEBUG: Users list: ${users_to_configure[*]}"

    for user in "${users_to_configure[@]}"; do
        local user_home=$(eval echo ~$user)
        print_info_from_common_functions "DEBUG: Processing user: $user (home: $user_home)"

        # Skip if home directory doesn't exist
        if [[ ! -d "$user_home" ]]; then
            print_info_from_common_functions "DEBUG: Skipping $user - home directory does not exist"
            continue
        fi

        print_info_from_common_functions "Configuring session for user: $user"

        # Create .xsession
        local xsession_file="$user_home/.xsession"
        print_info_from_common_functions "DEBUG: Creating .xsession: $xsession_file"
        if [[ -n "$desktop_session" ]]; then
            $USE_SUDO bash -c "cat > $xsession_file" <<EOF
#!/bin/bash
# XRDP session startup
$desktop_session
EOF
            $USE_SUDO chmod +x "$xsession_file"
            $USE_SUDO chown $user:$user "$xsession_file" 2>/dev/null || true
            print_info_from_common_functions "DEBUG: Created .xsession with command: $desktop_session"
        else
            print_info_from_common_functions "DEBUG: Skipped .xsession creation - no desktop session detected"
        fi

        # Create .xsessionrc with comprehensive environment
        local xsessionrc_file="$user_home/.xsessionrc"
        print_info_from_common_functions "DEBUG: Creating .xsessionrc: $xsessionrc_file"
        $USE_SUDO bash -c "cat > $xsessionrc_file" <<'EOF'
#!/bin/bash
# XRDP session environment
export XDG_SESSION_TYPE=x11
export XDG_SESSION_CLASS=user
export XDG_CURRENT_DESKTOP=${XDG_CURRENT_DESKTOP:-GNOME}
export DESKTOP_SESSION=${DESKTOP_SESSION:-gnome}

# Runtime directory
if [ ! -d "/run/user/$(id -u)" ]; then
    mkdir -p "/run/user/$(id -u)" 2>/dev/null || true
fi
export XDG_RUNTIME_DIR=/run/user/$(id -u)

# D-Bus session
export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u)/bus

# Disable problematic features
export GNOME_SHELL_SESSION_MODE=classic
export QT_QPA_PLATFORMTHEME=qt5ct
EOF
        $USE_SUDO chmod +x "$xsessionrc_file"
        $USE_SUDO chown $user:$user "$xsessionrc_file" 2>/dev/null || true
        print_info_from_common_functions "DEBUG: Created .xsessionrc with environment variables"

        # Create .xinitrc as fallback
        local xinitrc_file="$user_home/.xinitrc"
        print_info_from_common_functions "DEBUG: Creating .xinitrc: $xinitrc_file"
        if [[ -n "$desktop_session" ]]; then
            $USE_SUDO bash -c "cat > $xinitrc_file" <<EOF
#!/bin/bash
# XRDP X session
exec $desktop_session
EOF
            $USE_SUDO chmod +x "$xinitrc_file"
            $USE_SUDO chown $user:$user "$xinitrc_file" 2>/dev/null || true
            print_info_from_common_functions "DEBUG: Created .xinitrc with exec $desktop_session"
        else
            print_info_from_common_functions "DEBUG: Skipped .xinitrc creation - no desktop session detected"
        fi
        print_info_from_common_functions "DEBUG: Completed session file creation for user: $user"
    done

    print_success_from_common_functions "Session files created for all users"
    print_info_from_common_functions "DEBUG: All users configured successfully"

    print_success_from_common_functions "XRDP configured successfully"
    return 0
}

# Configure firewall for XRDP
configure_firewall() {
    print_step_from_common_functions "Configuring firewall for XRDP..."
    print_info_from_common_functions "DEBUG: Port to open: $XRDP_PORT/tcp"
    print_info_from_common_functions "DEBUG: Calling firewall_allow_port from firewall_manager.sh"

    # Use firewall_manager.sh library to handle firewall configuration
    # This automatically detects and configures UFW, firewalld, or iptables
    # If no firewall is active, it does nothing (never installs a firewall)
    if firewall_allow_port "$XRDP_PORT" "tcp" "XRDP Remote Desktop"; then
        print_success_from_common_functions "Firewall configured successfully for port $XRDP_PORT/tcp"
        print_info_from_common_functions "DEBUG: Firewall rule added successfully"
    else
        print_warning_from_common_functions "Firewall configuration may have issues, but port may still be accessible"
        print_info_from_common_functions "DEBUG: Firewall configuration returned error or no firewall detected"
    fi

    return 0
}

# Detect all IP addresses
detect_ip_addresses() {
    print_step_from_common_functions "Detecting IP addresses..."

    local ips=()

    # Get all IPv4 addresses
    while IFS= read -r ip; do
        if [[ -n "$ip" ]] && [[ "$ip" != "127.0.0.1" ]]; then
            ips+=("$ip")
        fi
    done < <(hostname -I 2>/dev/null | tr ' ' '\n')

    # Add localhost
    ips+=("127.0.0.1")
    ips+=("localhost")

    # Get public IP
    local public_ip=$(curl -s https://api.ipify.org 2>/dev/null || echo "")
    if [[ -n "$public_ip" ]] && [[ "$public_ip" != "127.0.0.1" ]]; then
        ips+=("$public_ip (public)")
    fi

    echo "${ips[@]}"
}

# Display RDP access information
display_rdp_access_info() {
    print_header_from_common_functions "XRDP Remote Desktop Access Information"

    local ips=($(detect_ip_addresses))

    print_success_from_common_functions "XRDP is now accessible via Windows Remote Desktop (MSTSC) at:"
    echo ""

    for ip in "${ips[@]}"; do
        echo -e "${GREEN}  ${ip}:${XRDP_PORT}${NC}"
    done

    echo ""
    print_info_from_common_functions "How to connect from Windows:"
    echo "  1. Press Win + R and type: mstsc"
    echo "  2. Enter any of the IP addresses above (e.g., 192.168.1.100)"
    echo "  3. Click 'Connect'"
    echo "  4. Enter your Linux username and password"
    echo ""
    print_info_from_common_functions "Default configuration:"
    echo "  - Port: $XRDP_PORT (RDP standard)"
    echo "  - Config: $XRDP_CONFIG_FILE"
    echo "  - Security: TLS/SSL encryption enabled"
    echo ""
    print_warning_from_common_functions "Important notes:"
    echo "  - Ensure firewall allows port $XRDP_PORT"
    echo "  - Use a strong password for your Linux user account"
    echo "  - For remote access, ensure port forwarding is configured on your router"
    echo ""
}

# Start XRDP service
start_xrdp_service() {
    print_step_from_common_functions "Starting XRDP service..."

    # Enable service
    $USE_SUDO systemctl enable xrdp

    # Start service
    $USE_SUDO systemctl restart xrdp

    # Wait for service to start
    sleep 2

    # Check service status
    if $USE_SUDO systemctl is-active --quiet xrdp; then
        print_success_from_common_functions "XRDP service started successfully"
        return 0
    else
        print_error_from_common_functions "Failed to start XRDP service"
        $USE_SUDO systemctl status xrdp --no-pager
        return 1
    fi
}

# Cleanup XRDP installation
cleanup_xrdp() {
    print_header_from_common_functions "Cleaning up XRDP installation"

    # Stop and disable service
    if $USE_SUDO systemctl is-active --quiet xrdp 2>/dev/null; then
        print_step_from_common_functions "Stopping XRDP service..."
        $USE_SUDO systemctl stop xrdp
    fi

    if $USE_SUDO systemctl is-enabled --quiet xrdp 2>/dev/null; then
        print_step_from_common_functions "Disabling XRDP service..."
        $USE_SUDO systemctl disable xrdp
    fi

    # Remove packages
    print_step_from_common_functions "Removing XRDP packages..."
    $USE_SUDO apt-get remove --purge -y xrdp xorgxrdp 2>/dev/null || true
    $USE_SUDO apt-get autoremove -y 2>/dev/null || true

    # Remove configuration files
    if [[ -f "$XRDP_CONFIG_FILE" ]]; then
        print_step_from_common_functions "Removing configuration files..."
        $USE_SUDO rm -rf /etc/xrdp
    fi

    # Remove firewall rule using firewall_manager.sh
    print_step_from_common_functions "Removing firewall rule..."
    firewall_remove_port "$XRDP_PORT" "tcp" 2>/dev/null || true

    # Remove log collection service
    remove_xrdp_log_service

    # Remove installation flag
    if [[ -f "$XRDP_INSTALLED_FLAG" ]]; then
        print_step_from_common_functions "Removing installation flag..."
        $USE_SUDO rm -f "$XRDP_INSTALLED_FLAG"
    fi

    print_success_from_common_functions "XRDP cleanup completed"
    return 0
}

# Main installation function
install_xrdp() {
    print_header_from_common_functions "Installing XRDP Remote Desktop"

    # Check Ubuntu version
    if ! check_ubuntu_version; then
        return 1
    fi

    # Check desktop environment
    if ! check_desktop_environment; then
        return 1
    fi

    # Install dependencies
    if ! install_dependencies; then
        return 1
    fi

    # Configure XRDP
    if ! configure_xrdp; then
        return 1
    fi

    # Configure firewall
    configure_firewall

    # Start service
    if ! start_xrdp_service; then
        return 1
    fi

    # Setup log collection service
    setup_xrdp_log_service

    # Get XRDP version (try multiple methods)
    local xrdp_version="unknown"

    # Method 1: Try xrdp --version
    if command -v xrdp >/dev/null 2>&1; then
        xrdp_version=$(xrdp --version 2>&1 | grep -oP 'xrdp version \K[0-9.]+' 2>/dev/null || echo "")
    fi

    # Method 2: Try xrdp -v
    if [[ -z "$xrdp_version" ]] || [[ "$xrdp_version" == "unknown" ]]; then
        xrdp_version=$(xrdp -v 2>&1 | grep -oP '[0-9]+\.[0-9]+\.[0-9]+' 2>/dev/null | head -n1 || echo "")
    fi

    # Method 3: Check package version with dpkg
    if [[ -z "$xrdp_version" ]] || [[ "$xrdp_version" == "unknown" ]]; then
        xrdp_version=$(dpkg -l xrdp 2>/dev/null | grep "^ii" | awk '{print $3}' | grep -oP '^[0-9]+\.[0-9]+\.[0-9]+' || echo "")
    fi

    # Method 4: Check with apt-cache policy
    if [[ -z "$xrdp_version" ]] || [[ "$xrdp_version" == "unknown" ]]; then
        xrdp_version=$(apt-cache policy xrdp 2>/dev/null | grep "Installed:" | awk '{print $2}' | grep -oP '^[0-9]+\.[0-9]+\.[0-9]+' || echo "")
    fi

    # Fallback: Use package version without regex
    if [[ -z "$xrdp_version" ]] || [[ "$xrdp_version" == "unknown" ]]; then
        xrdp_version=$(dpkg -l xrdp 2>/dev/null | grep "^ii" | awk '{print $3}' || echo "unknown")
    fi

    print_info_from_common_functions "Detected XRDP version: $xrdp_version"

    # Save installation info
    save_installation_info "$xrdp_version"

    print_success_from_common_functions "XRDP installation completed successfully!"

    # Display RDP access information
    display_rdp_access_info

    return 0
}

# Repair XRDP configuration without reinstalling
repair_xrdp_configuration() {
    print_header_from_common_functions "Repairing XRDP Configuration"
    print_info_from_common_functions "This will update all configuration files to fix XORG mode issues"
    echo ""

    # Reconfigure XRDP (all configurations are idempotent)
    print_step_from_common_functions "Updating XRDP configuration..."
    configure_xrdp

    # Reconfigure firewall
    print_step_from_common_functions "Verifying firewall rules..."
    configure_firewall

    # Restart service to apply changes
    print_step_from_common_functions "Restarting XRDP service..."
    $USE_SUDO systemctl restart xrdp 2>/dev/null || start_xrdp_service

    # Ensure log collection service is present
    setup_xrdp_log_service

    # Re-detect and save version
    local xrdp_version="unknown"
    if command -v xrdp >/dev/null 2>&1; then
        xrdp_version=$(xrdp --version 2>&1 | grep -oP 'xrdp version \K[0-9.]+' 2>/dev/null || echo "")
    fi
    if [[ -z "$xrdp_version" ]] || [[ "$xrdp_version" == "unknown" ]]; then
        xrdp_version=$(dpkg -l xrdp 2>/dev/null | grep "^ii" | awk '{print $3}' || echo "unknown")
    fi
    save_installation_info "$xrdp_version"

    print_success_from_common_functions "XRDP configuration repaired successfully!"
    print_info_from_common_functions "All XORG mode fixes have been applied"
    echo ""

    # Display access info
    display_rdp_access_info

    return 0
}

# Interactive cleanup prompt with version check
prompt_cleanup_reinstall() {
    if is_xrdp_installed; then
        print_warning_from_common_functions "XRDP is already installed"

        local installed_version=$(get_installed_version)
        if [[ -n "$installed_version" ]]; then
            print_info_from_common_functions "Installed version: $installed_version"
        else
            print_info_from_common_functions "Version information not available"
        fi

        echo ""
        print_info_from_common_functions "Available actions:"
        echo "  1) Repair configuration (recommended - fixes XORG mode issues)"
        echo "  2) Full reinstall (removes and reinstalls XRDP)"
        echo "  3) Keep current installation and exit"
        echo ""
        echo -n "Select action (1/2/3) [1]: "
        read -r response

        case "$response" in
            2)
                print_info_from_common_functions "Performing full reinstall..."
                cleanup_xrdp
                return 0
                ;;
            3|[nN]|[nN][oO])
                print_info_from_common_functions "Keeping current installation"

                # Check if service is running
                if ! $USE_SUDO systemctl is-active --quiet xrdp; then
                    echo -n "XRDP service is not running. Start it now? (Y/n): "
                    read -r start_response
                    case "$start_response" in
                        [nN]|[nN][oO])
                            ;;
                        *)
                            start_xrdp_service
                            display_rdp_access_info
                            ;;
                    esac
                else
                    display_rdp_access_info
                fi

                return 1
                ;;
            1|""|[yY]|[yY][eE][sS])
                print_info_from_common_functions "Repairing configuration..."
                repair_xrdp_configuration
                return 1
                ;;
            *)
                print_info_from_common_functions "Invalid choice, exiting"
                return 1
                ;;
        esac
    fi
    return 0
}

# Main script execution
main() {
    # Parse arguments
    parse_arguments "$@"

    # Handle cleanup mode
    if [[ "$CLEANUP_MODE" == true ]]; then
        cleanup_xrdp
        exit $?
    fi

    # Check if desktop environment is available (auto-detect from gvar_common.sh)
    if [[ "$HAS_DESKTOP_ENVIRONMENT" != true ]] && [[ "$FORCE_INSTALL" != true ]]; then
        print_info_from_common_functions "XRDP Remote Desktop is only needed in desktop environments"
        print_info_from_common_functions "Current environment: Server/Headless (HAS_DESKTOP_ENVIRONMENT=$HAS_DESKTOP_ENVIRONMENT)"
        print_info_from_common_functions "For server environments, use SSH for remote access"
        print_info_from_common_functions "Skipping XRDP installation"
        exit 0
    fi

    print_header_from_common_functions "XRDP Remote Desktop Installation Script"
    print_info_from_common_functions "This script enables Windows Remote Desktop (MSTSC) access to Linux"
    print_info_from_common_functions "Port: $XRDP_PORT (RDP standard)"
    echo ""

    # Desktop environment: 10-second auto-confirm prompt
    if [[ "$HAS_DESKTOP_ENVIRONMENT" == true ]] && [[ "$FORCE_INSTALL" != true ]]; then
        print_success_from_common_functions "Desktop environment detected!"
        print_info_from_common_functions "XRDP will be installed automatically in 10 seconds..."
        echo -n "Press 'n' to cancel, or wait to continue: "

        # Read with 10-second timeout
        if read -t 10 -n 1 response; then
            echo ""
            case "$response" in
                [nN])
                    print_warning_from_common_functions "Installation cancelled by user"
                    exit 0
                    ;;
            esac
        else
            echo ""
            print_info_from_common_functions "Auto-confirmed, proceeding with installation..."
        fi
    fi

    # Interactive cleanup prompt (unless force install is specified)
    if [[ "$FORCE_INSTALL" != true ]]; then
        if ! prompt_cleanup_reinstall; then
            exit 0
        fi
    fi

    # Run installation
    install_xrdp
    exit $?
}

# Run main function with all arguments
main "$@"
