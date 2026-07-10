#!/bin/bash
# Tailscale Installation Script
#
# Installs Tailscale - a zero-config mesh VPN that connects this machine to a
# private "tailnet", giving secure local-network style access between peers.
#
# Prerequisites:
#   - curl (automatically installed)
#   - systemd (tailscaled runs as a systemd service)
#
# Usage:
#   ./65_install_tailscale.sh   # Normal installation (no arguments)
#
# Optional global variables (set via the selector / set_var):
#   INSTALL_TAILSCALE        true|false  - whether to install (default true)
#   TAILSCALE_AUTHKEY        <key>       - if set, the node is brought up and
#                                          authenticated non-interactively
#   TAILSCALE_ADVERTISE_ROUTES <cidrs>   - comma separated subnets to advertise
#                                          to the tailnet (e.g. 192.168.1.0/24),
#                                          turning this host into a subnet router
#
# This script is idempotent: re-running it upgrades the package and re-applies
# the desired "tailscale up" state without destroying existing configuration.
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
SCRIPT_INDEX="64"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source global variables and shared helpers
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/installation_library.sh"
source "$PARENT_DIR_LEVEL_2/common/firewall_manager.sh"
source "$PARENT_DIR_LEVEL_2/common/desktop_shortcut_manager.sh"

# Initialize global variables
init_global_vars

# Declare variables
INSTALL_MODE=$(get_var "INSTALL_MODE" "base")
INSTALL_TAILSCALE=$(get_var "INSTALL_TAILSCALE" "true")
SELECTED_REGION=$(get_var "SELECTED_REGION")
TAILSCALE_AUTHKEY=$(get_var "TAILSCALE_AUTHKEY")
TAILSCALE_ADVERTISE_ROUTES=$(get_var "TAILSCALE_ADVERTISE_ROUTES")

# Tailscale configuration
TAILSCALE_INSTALL_URL="https://tailscale.com/install.sh"
TAILSCALE_SERVICE="tailscaled"

# Ensure sudo is available and set USE_SUDO
if command -v sudo >/dev/null 2>&1; then
    USE_SUDO="sudo"
else
    USE_SUDO=""
fi

# Colors for output
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Check if Tailscale is already installed
is_tailscale_installed() {
    if command -v tailscale >/dev/null 2>&1; then
        return 0  # Installed
    fi
    return 1  # Not installed
}

# Ensure curl is present (required by the official installer)
ensure_curl() {
    if command -v curl >/dev/null 2>&1; then
        return 0
    fi
    print_step_from_common_functions "Installing curl (required for Tailscale installer)..."
    $USE_SUDO apt-get update -qq
    $USE_SUDO apt-get install -y curl
}

# Resolve the (vendor, codename) of an OFFICIALLY HOSTED Tailscale apt repo for
# this host. Tailscale hosts debian {bullseye,bookworm,trixie} and ubuntu
# {bionic,focal,jammy,noble} but NO 'kali' path (verified: pkgs.tailscale.com/
# stable/kali/* -> 404), so Kali/Parrot and any unhosted codename map to the
# closest hosted Debian/Ubuntu suite. Echoes "<vendor> <codename>".
resolve_tailscale_repo() {
    local id="" codename="" idlike="" vendor="" glibc=""
    if [ -r /etc/os-release ]; then
        id="$(. /etc/os-release 2>/dev/null; printf '%s' "${ID:-}")"
        codename="$(. /etc/os-release 2>/dev/null; printf '%s' "${VERSION_CODENAME:-}")"
        idlike="$(. /etc/os-release 2>/dev/null; printf '%s' "${ID_LIKE:-}")"
    fi
    id="$(printf '%s' "$id" | tr '[:upper:]' '[:lower:]')"
    case "$id" in
        ubuntu) vendor="ubuntu" ;;
        debian) vendor="debian" ;;
        *) case " $idlike " in *ubuntu*) vendor="ubuntu" ;; *) vendor="debian" ;; esac ;;
    esac
    if [ "$vendor" = "debian" ]; then
        case "$codename" in
            bullseye|bookworm|trixie) : ;;
            *)  # Kali rolling / sid / unknown -> trixie on a post-t64 glibc, else bookworm.
                glibc="$(getconf GNU_LIBC_VERSION 2>/dev/null | awk '{print $NF}')"
                if [ -n "$glibc" ] && dpkg --compare-versions "$glibc" ge 2.38 2>/dev/null; then
                    codename="trixie"
                else
                    codename="bookworm"
                fi ;;
        esac
    else
        case "$codename" in
            bionic|focal|jammy|noble) : ;;
            *) codename="noble" ;;   # Ubuntu 18.04-24.04 hosted; newer/unknown -> noble
        esac
    fi
    printf '%s %s\n' "$vendor" "$codename"
}

# Fallback installer: add the OFFICIAL Tailscale apt repository directly (the path
# Tailscale documents at https://tailscale.com/kb/1187/install-debian-bookworm and
# the per-distro pages). Used when the one-line installer cannot resolve the OS
# (notably Kali). Idempotent: keyring/list overwritten, apt install is idempotent.
install_tailscale_apt_repo() {
    local repo vendor codename keyring listfile base
    repo="$(resolve_tailscale_repo)"
    vendor="${repo%% *}"; codename="${repo##* }"
    keyring="/usr/share/keyrings/tailscale-archive-keyring.gpg"
    listfile="/etc/apt/sources.list.d/tailscale.list"
    base="https://pkgs.tailscale.com/stable/$vendor/$codename"
    print_step_from_common_functions "Adding official Tailscale apt repo: $vendor/$codename"
    if ! curl -fsSL "$base.noarmor.gpg" | $USE_SUDO tee "$keyring" >/dev/null 2>&1; then
        print_error_from_common_functions "Failed to fetch Tailscale signing key ($base.noarmor.gpg)"
        return 1
    fi
    if ! curl -fsSL "$base.tailscale-keyring.list" | $USE_SUDO tee "$listfile" >/dev/null 2>&1; then
        print_error_from_common_functions "Failed to fetch Tailscale repo list ($base.tailscale-keyring.list)"
        return 1
    fi
    $USE_SUDO apt-get update -qq || true
    $USE_SUDO apt-get install -y tailscale
}

# Install / upgrade the Tailscale package. Prefer the official one-line installer
# (it picks the right repo for Debian/Ubuntu); fall back to the explicit apt repo
# with a hosted-codename mapping for Kali and any host the installer can't resolve.
install_tailscale_package() {
    print_step_from_common_functions "Installing Tailscale via official installer..."
    print_info_from_common_functions "Region: ${SELECTED_REGION:-unknown} (official repo is used for all regions)"

    if curl -fsSL "$TAILSCALE_INSTALL_URL" | $USE_SUDO sh 2>/dev/null && command -v tailscale >/dev/null 2>&1; then
        print_success_from_common_functions "Tailscale package installed (official installer)"
        return 0
    fi

    print_warning_from_common_functions "Official installer did not install Tailscale (e.g. Kali is unsupported by it); using the apt repository directly..."
    if install_tailscale_apt_repo && command -v tailscale >/dev/null 2>&1; then
        print_success_from_common_functions "Tailscale package installed (apt repository)"
        return 0
    fi

    print_error_from_common_functions "Tailscale installation failed (installer + apt repo)"
    return 1
}

# Enable and start the tailscaled daemon
enable_tailscale_daemon() {
    print_step_from_common_functions "Enabling tailscaled daemon..."

    $USE_SUDO systemctl enable "$TAILSCALE_SERVICE" 2>/dev/null || true
    $USE_SUDO systemctl start "$TAILSCALE_SERVICE" 2>/dev/null || true
    sleep 2

    if $USE_SUDO systemctl is-active --quiet "$TAILSCALE_SERVICE"; then
        print_success_from_common_functions "tailscaled is running"
        return 0
    fi

    print_warning_from_common_functions "tailscaled is not active; check: systemctl status $TAILSCALE_SERVICE"
    return 1
}

# Bring the node onto the tailnet.
# - With TAILSCALE_AUTHKEY: fully non-interactive authentication.
# - Without it: print the manual command (interactive browser login is required).
bring_tailscale_up() {
    local up_args=("--accept-routes")

    if [[ -n "$TAILSCALE_ADVERTISE_ROUTES" ]]; then
        up_args+=("--advertise-routes=$TAILSCALE_ADVERTISE_ROUTES")
        print_info_from_common_functions "Advertising local subnets: $TAILSCALE_ADVERTISE_ROUTES"
        # Subnet routing requires IP forwarding on the host.
        $USE_SUDO sysctl -w net.ipv4.ip_forward=1 >/dev/null 2>&1 || true
        $USE_SUDO sysctl -w net.ipv6.conf.all.forwarding=1 >/dev/null 2>&1 || true
    fi

    if [[ -n "$TAILSCALE_AUTHKEY" ]]; then
        print_step_from_common_functions "Authenticating node with provided auth key..."
        if $USE_SUDO tailscale up --authkey="$TAILSCALE_AUTHKEY" "${up_args[@]}"; then
            print_success_from_common_functions "Node joined the tailnet"
            return 0
        fi
        print_error_from_common_functions "tailscale up failed with provided auth key"
        return 1
    fi

    # Already authenticated from a previous run? Re-apply flags non-destructively.
    if $USE_SUDO tailscale status >/dev/null 2>&1; then
        print_info_from_common_functions "Node already authenticated; re-applying settings..."
        $USE_SUDO tailscale up "${up_args[@]}" 2>/dev/null || true
        return 0
    fi

    print_warning_from_common_functions "No auth key provided and node is not yet authenticated."
    print_info_from_common_functions "Complete the connection manually by running:"
    echo "  sudo tailscale up ${up_args[*]}"
    print_info_from_common_functions "Then open the printed URL in a browser to authorize this machine."
    return 0
}

# Display connection / access information
display_tailscale_info() {
    print_header_from_common_functions "Tailscale Status"

    local ts_version
    ts_version=$(tailscale version 2>/dev/null | head -n1 || echo "unknown")
    print_info_from_common_functions "Version: $ts_version"

    local ts_ip
    ts_ip=$($USE_SUDO tailscale ip -4 2>/dev/null | head -n1 || echo "")
    if [[ -n "$ts_ip" ]]; then
        print_success_from_common_functions "This node's Tailscale IP:"
        echo -e "${GREEN}  $ts_ip${NC}"
    else
        print_info_from_common_functions "No Tailscale IP assigned yet (node not authenticated)."
    fi

    echo ""
    print_info_from_common_functions "Useful commands:"
    echo "  sudo tailscale up            # connect / re-authenticate"
    echo "  sudo tailscale status        # list peers on the tailnet"
    echo "  sudo tailscale ip -4         # show this node's IP"
    echo "  sudo tailscale down          # disconnect from the tailnet"
    echo ""
}

# Create a cross-desktop-environment shortcut (app menu + every user's desktop)
# via the shared desktop_shortcut_manager. Exec points at a tiny installed helper
# so the .desktop Exec field stays simple/spec-clean. Idempotent.
create_tailscale_desktop_shortcut() {
    local helper="/usr/local/bin/tailscale-panel"
    command -v tailscale >/dev/null 2>&1 || return 0
    if ! command -v create_desktop_shortcut_from_desktop_shortcut_manager >/dev/null 2>&1; then
        print_warning_from_common_functions "desktop_shortcut_manager not loaded; skipping shortcut"
        return 0
    fi
    print_step_from_common_functions "Creating Tailscale desktop shortcut (all desktop environments)..."
    $USE_SUDO tee "$helper" >/dev/null <<'EOF'
#!/bin/sh
# Tailscale quick panel (opened from the desktop / menu shortcut).
echo "==================  Tailscale  =================="
tailscale status 2>&1 || true
echo
echo "Connect:     sudo tailscale up"
echo "Disconnect:  sudo tailscale down"
echo "This IP:     tailscale ip -4"
echo "Admin:       https://login.tailscale.com/admin"
echo
exec "${SHELL:-/bin/sh}"
EOF
    $USE_SUDO chmod 0755 "$helper" 2>/dev/null || true

    create_desktop_shortcut_from_desktop_shortcut_manager \
        --id "tailscale" \
        --name "Tailscale" \
        --generic "Mesh VPN" \
        --comment "Show Tailscale status and connect to your tailnet" \
        --exec "$helper" \
        --icon "network-vpn" \
        --categories "Network;System;" \
        --keywords "vpn;tailscale;mesh;wireguard;network;" \
        --terminal \
        --desktop all
}

# Main installation function
install_tailscale() {
    print_header_from_common_functions "Installing Tailscale"

    if ! ensure_curl; then
        print_error_from_common_functions "curl is required but could not be installed"
        return 1
    fi

    if ! install_tailscale_package; then
        return 1
    fi

    enable_tailscale_daemon          # systemd enable+start = auto-start on every boot
    create_tailscale_desktop_shortcut
    bring_tailscale_up

    print_success_from_common_functions "Tailscale installation completed"
    display_tailscale_info
    return 0
}

# Disable Tailscale when INSTALL_TAILSCALE is false
disable_tailscale_service() {
    if ! is_tailscale_installed; then
        print_info_from_common_functions "Tailscale is not installed"
        return 0
    fi

    print_warning_from_common_functions "INSTALL_TAILSCALE is set to false"
    echo -n "Do you want to disconnect and disable Tailscale? (y/N) [N]: "
    # Non-interactive (piped/orchestrated) run: default to N (keep as-is) instead
    # of blocking or consuming a later step's stdin.
    if [ -t 0 ] && [ -r /dev/tty ]; then read -r response < /dev/tty || response=""; else response=""; fi

    case "$response" in
        [yY]|[yY][eE][sS])
            print_step_from_common_functions "Disconnecting from tailnet..."
            $USE_SUDO tailscale down 2>/dev/null || true

            print_step_from_common_functions "Stopping and disabling tailscaled..."
            $USE_SUDO systemctl stop "$TAILSCALE_SERVICE" 2>/dev/null || true
            $USE_SUDO systemctl disable "$TAILSCALE_SERVICE" 2>/dev/null || true

            print_success_from_common_functions "Tailscale service disabled"
            print_info_from_common_functions "To re-enable: sudo systemctl enable --now $TAILSCALE_SERVICE && sudo tailscale up"
            ;;
        *)
            print_info_from_common_functions "Keeping Tailscale as is"
            ;;
    esac
    return 0
}

# Main script execution
main() {
    if [[ "$INSTALL_TAILSCALE" == "false" ]]; then
        print_header_from_common_functions "Tailscale Installation Script"
        print_warning_from_common_functions "INSTALL_TAILSCALE is set to false"
        print_info_from_common_functions "Tailscale installation is disabled in configuration"
        echo ""
        disable_tailscale_service
        exit 0
    fi

    print_header_from_common_functions "Tailscale Installation Script"

    if is_tailscale_installed; then
        print_info_from_common_functions "Tailscale is already installed; upgrading and re-applying configuration..."
    fi

    install_tailscale
    exit $?
}

# Run main function (no arguments supported)
main
