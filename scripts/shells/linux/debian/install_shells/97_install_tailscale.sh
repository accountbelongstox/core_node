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
#   ./97_install_tailscale.sh   # Normal installation (no arguments)
#
# Optional global variables (set via the selector / set_var):
#   INSTALL_TAILSCALE        true|false  - whether to install (default true)
#   TAILSCALE_AUTHKEY        <key>       - if set, the node is brought up and
#                                          authenticated non-interactively
#   TAILSCALE_ADVERTISE_ROUTES <cidrs>   - comma separated subnets to advertise
#                                          to the tailnet (e.g. 192.168.1.0/24),
#                                          turning this host into a subnet router
#
# This script is idempotent: re-running it skips the package install when
# Tailscale is present and re-applies the desired service / "tailscale up"
# state without destroying existing configuration.
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
SCRIPT_INDEX="97"
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
# GNOME Shell quick-settings toggle (extensions.gnome.org pk / uuid).
TAILSCALE_GS_EXTENSION_PK="9193"
TAILSCALE_GS_EXTENSION_UUID="tailscale-gnome-qs@tailscale-qs.github.io"
TAILSCALE_GS_EXTENSION_NAME="Tailscale QS"

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

# Install the Tailscale package when missing. Prefer the official one-line
# installer (it picks the right repo for Debian/Ubuntu); fall back to the
# explicit apt repo with a hosted-codename mapping for Kali and any host the
# installer can't resolve. Idempotent: an existing installation is kept as-is.
install_tailscale_package() {
    if is_tailscale_installed; then
        print_info_from_common_functions "Tailscale package already installed; skipping package install"
        return 0
    fi

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

# Enable and start the tailscaled daemon. Idempotent: `enable --now` converges
# both the boot-time and the running state and is a no-op when already there;
# a single restart retries a unit left in a failed/dead state.
enable_tailscale_daemon() {
    print_step_from_common_functions "Enabling tailscaled daemon..."

    $USE_SUDO systemctl enable --now "$TAILSCALE_SERVICE" 2>/dev/null || true
    sleep 2

    if $USE_SUDO systemctl is-active --quiet "$TAILSCALE_SERVICE"; then
        print_success_from_common_functions "tailscaled is running"
        return 0
    fi

    print_info_from_common_functions "tailscaled not active; attempting one restart..."
    $USE_SUDO systemctl restart "$TAILSCALE_SERVICE" 2>/dev/null || true
    sleep 2

    if $USE_SUDO systemctl is-active --quiet "$TAILSCALE_SERVICE"; then
        print_success_from_common_functions "tailscaled is running (after restart)"
        return 0
    fi

    print_warning_from_common_functions "tailscaled is not active; check: systemctl status $TAILSCALE_SERVICE"
    return 1
}

# Run `tailscale up` with the desired flags. Newer tailscaled versions reject a
# flag change that does not mention every non-default setting ("changing
# settings via 'tailscale up' requires mentioning all non-default flags"); on
# that exact failure retry once with --reset so the node converges to exactly
# the desired flag set. Idempotent: a no-op when the state already matches.
tailscale_up_with_reset_fallback() {
    local up_output
    up_output="$($USE_SUDO tailscale up "$@" 2>&1)"
    if [ $? -eq 0 ]; then
        [ -n "$up_output" ] && echo "$up_output"
        return 0
    fi
    [ -n "$up_output" ] && echo "$up_output"
    if printf '%s' "$up_output" | grep -q "non-default flags"; then
        print_info_from_common_functions "Flag drift detected; re-applying with --reset..."
        $USE_SUDO tailscale up --reset "$@"
        return $?
    fi
    return 1
}

# Bring the node onto the tailnet.
# - With TAILSCALE_AUTHKEY: fully non-interactive authentication.
# - Without it: print the login URL / manual command (interactive browser login
#   is required). Never runs a blocking `tailscale up` while logged out, so
#   orchestrated runs cannot hang waiting for a browser.
bring_tailscale_up() {
    local up_args=("--accept-routes")
    local backend_state status_text login_url current_operator op_session op_user

    # The desktop user is made the tailscale operator (rootless control, used
    # by the GNOME extension). It must be part of the declared flag set or
    # every `tailscale up` -- including the --reset fallback -- would drift /
    # wipe it ("requires mentioning all non-default flags").
    op_session="$(resolve_graphical_session 2>/dev/null)" && {
        op_user="$(printf '%s' "$op_session" | awk '{print $1}')"
        [ -n "$op_user" ] && up_args+=("--operator=$op_user")
    }

    if [[ -n "$TAILSCALE_ADVERTISE_ROUTES" ]]; then
        up_args+=("--advertise-routes=$TAILSCALE_ADVERTISE_ROUTES")
        print_info_from_common_functions "Advertising local subnets: $TAILSCALE_ADVERTISE_ROUTES"
        # Subnet routing requires IP forwarding on the host.
        $USE_SUDO sysctl -w net.ipv4.ip_forward=1 >/dev/null 2>&1 || true
        $USE_SUDO sysctl -w net.ipv6.conf.all.forwarding=1 >/dev/null 2>&1 || true
    fi

    if [[ -n "$TAILSCALE_AUTHKEY" ]]; then
        print_step_from_common_functions "Authenticating node with provided auth key..."
        if tailscale_up_with_reset_fallback --authkey="$TAILSCALE_AUTHKEY" "${up_args[@]}"; then
            print_success_from_common_functions "Node joined the tailnet"
            return 0
        fi
        print_error_from_common_functions "tailscale up failed with provided auth key"
        return 1
    fi

    # Auth state from the daemon, not from `tailscale status` exit code (status
    # exits 0 even when logged out, which previously made this branch block on
    # an interactive `tailscale up`).
    backend_state="$($USE_SUDO tailscale status --json 2>/dev/null | sed -n 's/.*"BackendState": *"\([^"]*\)".*/\1/p' | head -n1)"
    if [ -z "$backend_state" ]; then
        status_text="$($USE_SUDO tailscale status 2>&1)"
        if printf '%s' "$status_text" | grep -q "Logged out"; then
            backend_state="NeedsLogin"
        else
            backend_state="Running"
        fi
    fi

    if [ "$backend_state" = "Running" ]; then
        print_info_from_common_functions "Node already authenticated; re-applying settings..."
        # Headless fallback: when no graphical session was resolved above, still
        # mention an operator already stored in prefs -- the --reset fallback
        # would otherwise silently DROP it and break rootless extension control.
        if ! printf '%s\n' "${up_args[@]}" | grep -q '^--operator='; then
            current_operator="$($USE_SUDO tailscale debug prefs 2>/dev/null | sed -n 's/.*"OperatorUser": *"\([^"]*\)".*/\1/p' | head -n1)"
            if [ -n "$current_operator" ]; then
                up_args+=("--operator=$current_operator")
            fi
        fi
        tailscale_up_with_reset_fallback "${up_args[@]}" || true
        return 0
    fi

    print_warning_from_common_functions "No auth key provided and node is not yet authenticated (state: $backend_state)."
    login_url="$($USE_SUDO tailscale status 2>&1 | sed -n 's/.*\(https:\/\/login\.tailscale\.com\/[^ ]*\).*/\1/p' | head -n1)"
    if [ -n "$login_url" ]; then
        print_info_from_common_functions "Open this URL in a browser to authorize this machine:"
        echo "  $login_url"
        open_tailscale_login_url "$login_url"
    fi
    print_info_from_common_functions "Or complete the connection manually by running:"
    echo "  sudo tailscale up ${up_args[*]}"
    return 0
}

# Echo "<user> <uid> <x11|wayland>" for the first active graphical session.
# list-sessions does not print the session type, so each candidate session is
# probed via show-session.
resolve_graphical_session() {
    command -v loginctl >/dev/null 2>&1 || return 1
    local sid suser stype suid
    for sid in $(loginctl list-sessions --no-legend 2>/dev/null | awk '{print $1}'); do
        stype="$(loginctl show-session "$sid" -p Type --value 2>/dev/null)"
        case "$stype" in
            x11|wayland) ;;
            *) continue ;;
        esac
        suser="$(loginctl show-session "$sid" -p Name --value 2>/dev/null)"
        suid="$(id -u "$suser" 2>/dev/null)"
        [ -n "$suser" ] && [ -n "$suid" ] || continue
        printf '%s %s %s\n' "$suser" "$suid" "$stype"
        return 0
    done
    return 1
}

# Open the Tailscale login URL in the desktop user's default browser so
# authorization needs no copy/paste. Best-effort, Debian/Ubuntu desktops: only
# fires when an active graphical session (x11/wayland via loginctl) and
# xdg-open exist; headless servers skip silently. Runs detached so the
# installer never waits on the browser.
open_tailscale_login_url() {
    local url="$1" session session_user session_type session_uid
    [ -n "$url" ] || return 0
    command -v xdg-open >/dev/null 2>&1 || return 0
    session="$(resolve_graphical_session)" || return 0
    session_user="$(printf '%s' "$session" | awk '{print $1}')"
    session_uid="$(printf '%s' "$session" | awk '{print $2}')"
    session_type="$(printf '%s' "$session" | awk '{print $3}')"
    print_info_from_common_functions "Opening login URL in $session_user's browser ($session_type session)..."
    if [ "$session_type" = "wayland" ]; then
        $USE_SUDO -u "$session_user" env \
            XDG_RUNTIME_DIR="/run/user/$session_uid" \
            DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$session_uid/bus" \
            WAYLAND_DISPLAY="wayland-0" \
            xdg-open "$url" >/dev/null 2>&1 &
    else
        $USE_SUDO -u "$session_user" env \
            XDG_RUNTIME_DIR="/run/user/$session_uid" \
            DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$session_uid/bus" \
            DISPLAY=":0" \
            xdg-open "$url" >/dev/null 2>&1 &
    fi
    return 0
}

# Install/enable the GNOME Shell quick-settings toggle ("Tailscale QS") from
# extensions.gnome.org for the logged-in desktop user. Idempotent: presence is
# judged by the on-disk extension dir plus the gsettings enabled-extensions
# list -- NOT by `gnome-extensions list`, because a running GNOME Shell on
# Wayland only re-scans the extensions directory at startup, so the D-Bus view
# stays empty until the user re-logs in. The download is matched to the running
# Shell major version. Also sets the user as the tailscale operator (required
# by the extension for rootless control). Skips silently on headless or
# non-GNOME hosts.
install_tailscale_gnome_extension() {
    command -v gnome-shell >/dev/null 2>&1 || return 0
    command -v gnome-extensions >/dev/null 2>&1 || return 0
    command -v gsettings >/dev/null 2>&1 || return 0
    command -v curl >/dev/null 2>&1 || return 0

    local session suser suid shome ext_dir shell_major info_json download_url zip_file
    local enabled_list new_enabled_list
    session="$(resolve_graphical_session)" || return 0
    suser="$(printf '%s' "$session" | awk '{print $1}')"
    suid="$(printf '%s' "$session" | awk '{print $2}')"
    shome="$(getent passwd "$suser" | cut -d: -f6)"
    [ -n "$shome" ] || return 0
    ext_dir="$shome/.local/share/gnome-shell/extensions/$TAILSCALE_GS_EXTENSION_UUID"
    local -a user_env=(env "XDG_RUNTIME_DIR=/run/user/$suid" "DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$suid/bus")

    if [ -f "$ext_dir/metadata.json" ]; then
        print_info_from_common_functions "GNOME extension '$TAILSCALE_GS_EXTENSION_NAME' already installed"
    else
        shell_major="$(gnome-shell --version 2>/dev/null | awk '{print $NF}' | cut -d. -f1)"
        if [ -z "$shell_major" ]; then
            print_warning_from_common_functions "Cannot determine GNOME Shell version; skipping extension install"
            return 0
        fi

        print_step_from_common_functions "Installing GNOME extension '$TAILSCALE_GS_EXTENSION_NAME' (Shell $shell_major) for $suser..."
        info_json="$(curl -fsSL "https://extensions.gnome.org/extension-info/?pk=$TAILSCALE_GS_EXTENSION_PK&shell_version=$shell_major" 2>/dev/null)"
        download_url="$(printf '%s' "$info_json" | sed -n 's/.*"download_url": *"\([^"]*\)".*/\1/p' | head -n1)"
        if [ -z "$download_url" ]; then
            print_warning_from_common_functions "No '$TAILSCALE_GS_EXTENSION_NAME' build for GNOME Shell $shell_major; skipping extension install"
            return 0
        fi

        zip_file="$(mktemp /tmp/tailscale-qs.XXXXXX.zip)"
        chmod 0644 "$zip_file"
        if ! curl -fsSL "https://extensions.gnome.org$download_url" -o "$zip_file" 2>/dev/null; then
            print_warning_from_common_functions "Failed to download '$TAILSCALE_GS_EXTENSION_NAME'; skipping extension install"
            rm -f "$zip_file"
            return 0
        fi

        if $USE_SUDO -u "$suser" "${user_env[@]}" gnome-extensions install --force "$zip_file" 2>/dev/null; then
            print_success_from_common_functions "GNOME extension '$TAILSCALE_GS_EXTENSION_NAME' installed"
        else
            print_warning_from_common_functions "gnome-extensions install failed; skipping extension install"
            rm -f "$zip_file"
            return 0
        fi
        rm -f "$zip_file"
    fi

    # Enable persistently via gsettings (survives the fact that the running
    # Shell has not re-scanned yet); live-enable on top when the Shell already
    # sees the extension (e.g. after a re-login). An empty list is re-read once
    # before writing: a cold dconf-service can briefly report the schema
    # default (@as []), and writing on that basis would clobber the user's
    # existing enabled extensions.
    enabled_list="$($USE_SUDO -u "$suser" "${user_env[@]}" gsettings get org.gnome.shell enabled-extensions 2>/dev/null)"
    if [ -z "$enabled_list" ] || [ "$enabled_list" = "@as []" ]; then
        sleep 1
        enabled_list="$($USE_SUDO -u "$suser" "${user_env[@]}" gsettings get org.gnome.shell enabled-extensions 2>/dev/null)"
    fi
    if printf '%s' "$enabled_list" | grep -q "$TAILSCALE_GS_EXTENSION_UUID"; then
        print_info_from_common_functions "GNOME extension '$TAILSCALE_GS_EXTENSION_NAME' already enabled"
    else
        case "$enabled_list" in
            ""|"@as []") new_enabled_list="['$TAILSCALE_GS_EXTENSION_UUID']" ;;
            *) new_enabled_list="${enabled_list%]}, '$TAILSCALE_GS_EXTENSION_UUID']" ;;
        esac
        if $USE_SUDO -u "$suser" "${user_env[@]}" gsettings set org.gnome.shell enabled-extensions "$new_enabled_list" 2>/dev/null; then
            print_success_from_common_functions "GNOME extension '$TAILSCALE_GS_EXTENSION_NAME' enabled (quick settings toggle appears after next login on Wayland)"
        else
            print_warning_from_common_functions "Failed to enable '$TAILSCALE_GS_EXTENSION_NAME' via gsettings"
        fi
    fi
    $USE_SUDO -u "$suser" "${user_env[@]}" gnome-extensions enable "$TAILSCALE_GS_EXTENSION_UUID" 2>/dev/null || true

    # The extension talks to tailscaled without root; make the desktop user the
    # tailscale operator (idempotent).
    $USE_SUDO tailscale set --operator="$suser" >/dev/null 2>&1 || true
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
    install_tailscale_gnome_extension
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
    # of blocking or consuming a later step's stdin. Timeout-bounded on a TTY.
    if [ "${DD_AUTO_CONTINUE:-}" = "true" ] || [ "${DD_AUTO_CONTINUE:-}" = "1" ]; then response=""; elif [ -t 0 ] && [ -r /dev/tty ]; then read -r -t 30 response < /dev/tty || response=""; else response=""; fi

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
        print_info_from_common_functions "Tailscale is already installed; re-applying configuration..."
    fi

    install_tailscale
    exit $?
}

# Run main function (no arguments supported)
main
