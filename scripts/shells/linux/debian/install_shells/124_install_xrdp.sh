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
            *)
                echo "Unknown option: $1"
                echo "Usage: $0 [--force] [--cleanup]"
                exit 1
                ;;
        esac
    done
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

# Configure XRDP
configure_xrdp() {
    print_step_from_common_functions "Configuring XRDP..."

    # Backup original configuration
    if [[ -f "$XRDP_CONFIG_FILE" ]] && [[ ! -f "${XRDP_CONFIG_FILE}.backup" ]]; then
        $USE_SUDO cp "$XRDP_CONFIG_FILE" "${XRDP_CONFIG_FILE}.backup"
        print_info_from_common_functions "Backed up original configuration"
    fi

    # Set port in xrdp.ini
    $USE_SUDO sed -i "s/^port=.*/port=$XRDP_PORT/" "$XRDP_CONFIG_FILE"

    # Enable certificate-based encryption
    $USE_SUDO sed -i 's/^security_layer=.*/security_layer=negotiate/' "$XRDP_CONFIG_FILE"
    $USE_SUDO sed -i 's/^crypt_level=.*/crypt_level=high/' "$XRDP_CONFIG_FILE"

    # Fix color depth issues (set to 24-bit for compatibility)
    if grep -q "^\[Xorg\]" "$XRDP_CONFIG_FILE"; then
        $USE_SUDO sed -i '/^\[Xorg\]/,/^\[/s/^param=.*/param=-depth\nparam=24\nparam=-dpi\nparam=96/' "$XRDP_CONFIG_FILE" 2>/dev/null || true
    fi

    # Configure session manager
    if [[ -f "$XRDP_SESMAN_CONFIG" ]]; then
        # Allow root login (user can disable this manually for security)
        $USE_SUDO sed -i 's/^AllowRootLogin=.*/AllowRootLogin=true/' "$XRDP_SESMAN_CONFIG" 2>/dev/null || true
        # Allow multiple sessions per user
        $USE_SUDO sed -i 's/^MaxSessions=.*/MaxSessions=10/' "$XRDP_SESMAN_CONFIG" 2>/dev/null || true
    fi

    # Add xrdp user to ssl-cert group for certificate access
    $USE_SUDO adduser xrdp ssl-cert 2>/dev/null || true

    # Fix X11 wrapper permissions (critical for XORG mode)
    print_step_from_common_functions "Configuring X11 permissions..."
    local xwrapper_config="/etc/X11/Xwrapper.config"
    if [[ -f "$xwrapper_config" ]]; then
        $USE_SUDO cp "$xwrapper_config" "${xwrapper_config}.backup" 2>/dev/null || true
    fi

    # Allow anybody to start X server (required for xrdp user)
    $USE_SUDO bash -c "cat > $xwrapper_config" <<'EOF'
# Xwrapper.config - Allow xrdp to start X server
# This is required for XRDP to work properly
allowed_users=anybody
needs_root_rights=yes
EOF
    print_success_from_common_functions "X11 permissions configured"

    # Create PolicyKit rule for colord (prevents authentication popup/disconnect)
    print_step_from_common_functions "Configuring PolicyKit permissions..."
    local polkit_dir="/etc/polkit-1/localauthority/50-local.d"
    local polkit_rule="$polkit_dir/45-allow-colord.pkla"

    $USE_SUDO mkdir -p "$polkit_dir"
    $USE_SUDO bash -c "cat > $polkit_rule" <<'EOF'
[Allow Colord All Users]
Identity=unix-user:*
Action=org.freedesktop.color-manager.create-device;org.freedesktop.color-manager.create-profile;org.freedesktop.color-manager.delete-device;org.freedesktop.color-manager.delete-profile;org.freedesktop.color-manager.modify-device;org.freedesktop.color-manager.modify-profile
ResultAny=no
ResultInactive=no
ResultActive=yes
EOF
    print_success_from_common_functions "PolicyKit permissions configured"

    # Create .xsession file for users if not exists
    local xsession_file="$HOME/.xsession"
    if [[ ! -f "$xsession_file" ]]; then
        # Detect available desktop sessions
        local desktop_session=""
        if command -v gnome-session >/dev/null 2>&1; then
            desktop_session="gnome-session"
        elif command -v startxfce4 >/dev/null 2>&1; then
            desktop_session="startxfce4"
        elif command -v startkde >/dev/null 2>&1; then
            desktop_session="startkde"
        elif command -v startlxde >/dev/null 2>&1; then
            desktop_session="startlxde"
        fi

        if [[ -n "$desktop_session" ]]; then
            echo "$desktop_session" > "$xsession_file"
            chmod +x "$xsession_file"
            print_info_from_common_functions "Created .xsession file with: $desktop_session"
        fi
    fi

    # Create .xsessionrc for environment variables (helps with session stability)
    local xsessionrc_file="$HOME/.xsessionrc"
    if [[ ! -f "$xsessionrc_file" ]]; then
        cat > "$xsessionrc_file" <<'EOF'
# XRDP session environment
export XDG_SESSION_TYPE=x11
export XDG_SESSION_CLASS=user
export XDG_RUNTIME_DIR=/run/user/$(id -u)
export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u)/bus
EOF
        chmod +x "$xsessionrc_file"
        print_info_from_common_functions "Created .xsessionrc with session environment"
    fi

    print_success_from_common_functions "XRDP configured successfully"
    return 0
}

# Configure firewall for XRDP
configure_firewall() {
    print_step_from_common_functions "Configuring firewall for XRDP..."

    # Use firewall_manager.sh library to handle firewall configuration
    # This automatically detects and configures UFW, firewalld, or iptables
    # If no firewall is active, it does nothing (never installs a firewall)
    if firewall_allow_port "$XRDP_PORT" "tcp" "XRDP Remote Desktop"; then
        print_success_from_common_functions "Firewall configured successfully for port $XRDP_PORT/tcp"
    else
        print_warning_from_common_functions "Firewall configuration may have issues, but port may still be accessible"
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

    # Get XRDP version
    local xrdp_version=$(xrdp --version 2>&1 | grep -oP 'xrdp version \K[0-9.]+' || echo "unknown")

    # Save installation info
    save_installation_info "$xrdp_version"

    print_success_from_common_functions "XRDP installation completed successfully!"

    # Display RDP access information
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

        echo -n "Reinstall XRDP? (y/N): "
        read -r response
        case "$response" in
            [yY]|[yY][eE][sS])
                print_info_from_common_functions "Reinstalling XRDP..."
                cleanup_xrdp
                return 0
                ;;
            *)
                print_info_from_common_functions "Keeping existing installation"

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
