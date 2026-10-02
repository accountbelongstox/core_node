#!/bin/bash

# =============================================================================
# remote_control_common.sh - cross-OS remote control over Tailscale
# (Windows 10/11 <-> Debian 12/13, Ubuntu 24.04/26.04).
#
# Two channels, both reachable only through the tailnet (100.64.0.0/10):
#   RDP (desktop): host = GNOME Remote Desktop (grdctl) or xrdp; client = xfreerdp/remmina.
#   SSH (shell):   host = openssh-server + the shared decrypted key
#                  (scripts/git/git.ssh.id.ed*.js -> ~/.ssh/id_ed25519, 27_install_git_ssh.sh).
# Password = system login password: xrdp/sshd authenticate through PAM; GNOME RDP
# keeps its own credentials, so they are set to the login password after it is
# verified against /etc/shadow.
#
# Official docs consulted (verified 2026-09-29):
#   GNOME Remote Desktop (grdctl user/system mode): https://gitlab.gnome.org/GNOME/gnome-remote-desktop/-/blob/master/README.md
#   Tailscale SSH (Linux/macOS server only):        https://tailscale.com/kb/1193/tailscale-ssh
#   Tailscale RDP guide:                             https://tailscale.com/kb/1095/secure-rdp-windows
#   xrdp:                                            https://github.com/neutrinolabs/xrdp
#   FreeRDP CLI:                                     https://github.com/FreeRDP/FreeRDP/wiki/CommandLineInterface-(1.1)
#
# Public API:
#   rc_print_peer_table      - numbered Tailscale IP table (self + peers); rc_render_peer_table = cached
#   rc_show_endpoints        - every Tailscale IP (self + peers) with RDP/SSH commands
#   rc_enable_controller     - one-click: this machine can control remote hosts
#   rc_enable_host           - one-click: allow remote hosts to control this machine
#   rc_enable_rdp_host       - one-click (idempotent): RDP host only (GNOME grdctl or xrdp)
#   rc_connect_peer          - one-click: number = RDP, +r = Remmina, +s = SSH (cached user)
#   rc_show_status           - host/client readiness summary
#   rc_show_help             - manual UI steps + doc links
#   rc_vnc_display_fix       - idempotent: full screen + scaled mode on every saved Remmina VNC profile
#   rc_show_menu             - Remote Control numbered menu (Management & Backup, Tailscale)
#   remote_control_common_main <menu|endpoints|controller|host|rdp|connect|vnc-display|status|help>
# =============================================================================

if [ "${REMOTE_CONTROL_COMMON_LOADED:-false}" = "true" ]; then
    return 0 2>/dev/null || exit 0
fi
REMOTE_CONTROL_COMMON_LOADED="true"

REMOTE_CONTROL_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REMOTE_CONTROL_ROOT_DIR="$(cd "$REMOTE_CONTROL_COMMON_DIR/../../../.." && pwd)"
REMOTE_CONTROL_ARROW_MENU_SCRIPT="$REMOTE_CONTROL_COMMON_DIR/arrow_menu.sh"
# shellcheck source=/dev/null
. "$REMOTE_CONTROL_COMMON_DIR/tailscale_common.sh"

RC_RDP_PORT="3389"
RC_VNC_PORT="5900"
RC_SSH_PORT="22"
RC_TAILSCALE_CIDR="100.64.0.0/10"
RC_TAILSCALE_IFACE="tailscale0"
RC_SHARED_KEY_NAME="id_ed25519"
RC_SHARED_KEY_INSTALLER="$REMOTE_CONTROL_ROOT_DIR/scripts/shells/linux/debian/install_shells/27_install_git_ssh.sh"
RC_REMMINA_INSTALLER="$REMOTE_CONTROL_ROOT_DIR/scripts/shells/linux/debian/install_shells/195_install_remmina.sh"
RC_GRD_SYSTEM_USER="gnome-remote-desktop"
RC_GRD_TLS_SUBDIR=".local/share/gnome-remote-desktop"
RC_TLS_SUBJECT="/CN=core-node-remote-desktop"
RC_TLS_DAYS="3650"
RC_CLIENT_PACKAGES_V3="freerdp3-x11"
RC_CLIENT_PACKAGES_V2="freerdp2-x11"
RC_CLIENT_EXTRA_PACKAGES="openssh-client"
RC_HOST_SSH_PACKAGES="openssh-server"
RC_HOST_XRDP_PACKAGES="xrdp xorgxrdp"
RC_PEER_ROWS=()
RC_RDP_BACKEND=""
RC_LOGIN_PASSWORD=""
# Remmina keeps connections (and, via remmina-plugin-secret, passwords in the
# desktop keyring) only for real profiles in the user's data dir; a URI quick
# connect (remmina -c rdp://...) is never saved.
RC_REMMINA_DATA_SUBDIR=".local/share/remmina"
RC_REMMINA_PROFILE_PREFIX="core_node_"
RC_REMMINA_GROUP="Tailscale"
RC_REMMINA_VNC_SUFFIX="_vnc"
# TightVNC cannot resize the Windows desktop to the viewer, so Remmina scales it:
# scale=1 = scaled to the window (aspect kept), viewmode=4 = viewport full screen.
RC_REMMINA_VNC_DISPLAY_OPTIONS=("scale=1" "viewmode=4")
RC_RDP_MODE="${RC_RDP_MODE:-shared}"
RC_REMMINA_PROFILE=""
RC_CONNECT_CACHE_FILE="${XDG_CACHE_HOME:-${CORE_NODE_CACHE_DIR:-$HOME/.cache}}/core_node/rc_connect_users"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

rc_sudo() {
    local sudo_prefix=""
    sudo_prefix="$(ts_sudo_prefix)"
    if [ -n "$sudo_prefix" ]; then
        $sudo_prefix "$@"
    else
        "$@"
    fi
}

# Real (non-root) login user: seated desktop session -> sudo caller -> the
# gvar-detected desktop user -> first regular account -> current user.
rc_target_user() {
    local target="" candidate=""
    target="$(ts_target_user 2>/dev/null)" && candidate="${target%% *}"
    [ -n "$candidate" ] && [ "$candidate" != "root" ] && { printf '%s' "$candidate"; return 0; }
    for candidate in "${SUDO_USER:-}" "${ACTUAL_DESKTOP_USER:-}"; do
        [ -n "$candidate" ] && [ "$candidate" != "root" ] && id "$candidate" >/dev/null 2>&1 && { printf '%s' "$candidate"; return 0; }
    done
    candidate="$(getent passwd | awk -F: '$3 >= 1000 && $3 < 60000 && $7 !~ /(nologin|false)$/ {print $1; exit}')"
    [ -n "$candidate" ] && { printf '%s' "$candidate"; return 0; }
    id -un
}

rc_user_home() {
    getent passwd "$1" | cut -d: -f6
}

rc_apt_install() {
    rc_sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"
}

rc_apt_has_package() {
    [ -n "$(apt-cache policy "$1" 2>/dev/null | awk '/Candidate:/ && $2 != "(none)" {print $2}')" ]
}

rc_pause() {
    echo ""
    echo "Press Enter to continue..."
    read -r
}

# stdin filter: exit 0 when grdctl status shows the RDP section enabled.
rc_status_rdp_enabled() {
    awk '/^[A-Za-z]+:/{in_rdp=($0=="RDP:")} in_rdp && /Status: enabled/{found=1} END{exit !found}'
}

# "HOST<TAB>OS<TAB>ONLINE<TAB>IPV4<TAB>DNSNAME<TAB>SELF" rows (self first) into RC_PEER_ROWS.
rc_load_peer_rows() {
    RC_PEER_ROWS=()
    is_tailscale_installed || return 0
    command -v python3 >/dev/null 2>&1 || return 0
    mapfile -t RC_PEER_ROWS < <(tailscale status --json 2>/dev/null | python3 -c '
import sys, json
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

def row(node, is_self):
    ips = node.get("TailscaleIPs") or []
    v4 = next((ip for ip in ips if ":" not in ip), "")
    if not v4:
        return
    print("\t".join([
        node.get("HostName") or "-",
        (node.get("OS") or "-").lower(),
        "yes" if (is_self or node.get("Online")) else "no",
        v4,
        (node.get("DNSName") or "-").rstrip("."),
        "self" if is_self else "peer",
    ]))

if data.get("Self"):
    row(data["Self"], True)
for peer in (data.get("Peer") or {}).values():
    row(peer, False)
' 2>/dev/null)
}

rc_shared_private_key() {
    local user_home="" candidate=""
    user_home="$(rc_user_home "$(rc_target_user)")"
    for candidate in "$user_home/.ssh/$RC_SHARED_KEY_NAME" "$HOME/.ssh/$RC_SHARED_KEY_NAME" "/etc/ssh/keys/$RC_SHARED_KEY_NAME"; do
        [ -s "$candidate" ] && [ -s "$candidate.pub" ] && { printf '%s' "$candidate"; return 0; }
    done
    return 1
}

# Shared key missing -> offer the existing installer (decrypts + installs it).
rc_ensure_shared_key() {
    local answer=""
    rc_shared_private_key >/dev/null && return 0
    echo "Shared SSH key ($RC_SHARED_KEY_NAME) not found; it is decrypted by 27_install_git_ssh.sh"
    echo "(dd.sh > Linux System Tools > Clear and Re-decrypt Secret Keys also re-creates it)."
    printf "Run 27_install_git_ssh.sh now? [y/N]: "
    read -r answer
    case "$answer" in
        [Yy]*) bash "$RC_SHARED_KEY_INSTALLER" ;;
        *) echo "Skipped; SSH will fall back to the login password." ;;
    esac
    rc_shared_private_key >/dev/null
}

# Verify a password against /etc/shadow via libc crypt(3) (yescrypt/sha512).
rc_password_matches_login() {
    local user="$1" password="$2" hash=""
    hash="$(rc_sudo getent shadow "$user" | cut -d: -f2)"
    case "$hash" in
        ''|'*'|'!'*) return 1 ;;
    esac
    command -v perl >/dev/null 2>&1 || return 0
    [ "$(RC_PW="$password" RC_HASH="$hash" perl -e 'print crypt($ENV{RC_PW}, $ENV{RC_HASH})')" = "$hash" ]
}

# Prompt (hidden) for the login password of <user>, verified, into RC_LOGIN_PASSWORD.
rc_read_login_password() {
    local user="$1" attempt=0 password=""
    RC_LOGIN_PASSWORD=""
    while [ "$attempt" -lt 3 ]; do
        printf "System login password of '%s' (reused as the RDP password): " "$user"
        read -r -s password
        echo ""
        if rc_password_matches_login "$user" "$password"; then
            RC_LOGIN_PASSWORD="$password"
            return 0
        fi
        echo "Password does not match the system login password of '$user'."
        attempt=$((attempt + 1))
    done
    return 1
}

# Run a command as <user> (runuser as root, direct when already that user).
rc_as_user() {
    local user="$1"
    shift
    if [ "$(id -un)" = "$user" ]; then
        "$@"
    elif [ "$(id -u)" -eq 0 ]; then
        runuser -u "$user" -- "$@"
    else
        sudo -u "$user" "$@"
    fi
}

# Run a command as <user> inside their graphical session bus.
rc_run_as_user_session() {
    local user="$1" uid=""
    shift
    uid="$(id -u "$user")"
    rc_as_user "$user" env XDG_RUNTIME_DIR="/run/user/$uid" \
        DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$uid/bus" "$@"
}

rc_make_tls_pair() {
    local dir="$1" owner="$2"
    rc_sudo mkdir -p "$dir"
    if [ ! -s "$dir/tls.key" ] || [ ! -s "$dir/tls.crt" ]; then
        rc_sudo openssl req -new -newkey rsa:4096 -days "$RC_TLS_DAYS" -nodes -x509 \
            -subj "$RC_TLS_SUBJECT" -keyout "$dir/tls.key" -out "$dir/tls.crt" >/dev/null 2>&1
    fi
    rc_sudo chown -R "$owner:" "$dir"
    rc_sudo chmod 600 "$dir/tls.key"
}

# Open RDP/SSH to the tailnet only when ufw is active (no-op otherwise).
rc_allow_firewall_port() {
    local port="$1"
    command -v ufw >/dev/null 2>&1 || return 0
    rc_sudo ufw status 2>/dev/null | grep -q "Status: active" || return 0
    rc_sudo ufw allow in on "$RC_TAILSCALE_IFACE" to any port "$port" proto tcp >/dev/null
    echo "  ufw: allowed tcp/$port on $RC_TAILSCALE_IFACE"
}

rc_grdctl_supports_system() {
    command -v grdctl >/dev/null 2>&1 && grdctl --help 2>&1 | grep -q -- '--system'
}

# Default (RC_RDP_MODE=shared): GNOME user mode when the user has a running
# GNOME session - it shares that live desktop, so local and remote operation
# are simultaneous (Debian's gnome-remote-desktop has no VNC). Otherwise GNOME
# 46+ system mode (remote login on the GDM screen, a separate session, survives
# reboot), then xrdp. RC_RDP_MODE=system forces the remote-login mode.
rc_gnome_session_active() {
    [ -n "$(pgrep -u "$1" -x gnome-shell 2>/dev/null | head -n1)" ]
}

rc_rdp_backend() {
    local user="${1:-}"
    if command -v grdctl >/dev/null 2>&1 && [ "$RC_RDP_MODE" != "system" ] \
        && [ -n "$user" ] && rc_gnome_session_active "$user"; then
        printf 'gnome-user'
    elif rc_grdctl_supports_system; then
        printf 'gnome-system'
    elif command -v grdctl >/dev/null 2>&1 && [ -n "$(pgrep -x gnome-shell 2>/dev/null | head -n1)" ]; then
        printf 'gnome-user'
    else
        printf 'xrdp'
    fi
}

rc_rdp_client_bin() {
    local candidate=""
    for candidate in xfreerdp3 xfreerdp; do
        command -v "$candidate" >/dev/null 2>&1 && { printf '%s' "$candidate"; return 0; }
    done
    return 1
}

# ---------------------------------------------------------------------------
# 1) Endpoints: every Tailscale IP with ready-to-run commands
# ---------------------------------------------------------------------------

rc_print_peer_table() {
    rc_load_peer_rows
    rc_render_peer_table
}

# Renders the cached RC_PEER_ROWS (menu render callback; no Tailscale query).
rc_render_peer_table() {
    local row="" index=0 host="" os="" online="" ipv4="" dns="" kind=""
    echo "== Tailscale IPs =="
    if [ "${#RC_PEER_ROWS[@]}" -eq 0 ]; then
        echo "  (no Tailscale IPs: install/login Tailscale first -- state: $(ts_backend_state))"
        return 0
    fi
    printf "  %-3s %-20s %-8s %-7s %-16s %s\n" "#" "HOSTNAME" "OS" "ONLINE" "TAILSCALE IPV4" "MAGICDNS"
    for row in "${RC_PEER_ROWS[@]}"; do
        IFS=$'\t' read -r host os online ipv4 dns kind <<<"$row"
        [ "$kind" = "self" ] && host="$host (this)"
        printf "  %-3s %-20s %-8s %-7s %-16s %s\n" "$index" "$host" "$os" "$online" "$ipv4" "$dns"
        index=$((index + 1))
    done
}

rc_show_endpoints() {
    local row="" host="" os="" online="" ipv4="" dns="" kind="" user=""
    user="$(rc_target_user)"
    rc_print_peer_table
    echo ""
    echo "== Connect commands =="
    for row in "${RC_PEER_ROWS[@]}"; do
        IFS=$'\t' read -r host os online ipv4 dns kind <<<"$row"
        [ "$kind" = "self" ] && continue
        case "$os" in linux|windows) ;; *) continue ;; esac
        echo "  $host [$os]"
        echo "    From Linux:   xfreerdp3 /v:$ipv4 /u:<user> /dynamic-resolution +clipboard /cert:tofu   |   ssh <user>@$ipv4"
        echo "    From Windows: mstsc /v:$ipv4   |   ssh <user>@$ipv4"
    done
    echo ""
    echo "This machine accepts: RDP $RC_RDP_PORT (user '$user', system login password), SSH $RC_SSH_PORT (shared key or password)."
}

# ---------------------------------------------------------------------------
# 2) Controller: this machine can control remote hosts
# ---------------------------------------------------------------------------

rc_enable_controller() {
    echo "== Enable remote-control client (this machine -> Windows/Linux) =="
    rc_sudo apt-get update -qq
    if rc_apt_has_package "$RC_CLIENT_PACKAGES_V3"; then
        rc_apt_install $RC_CLIENT_PACKAGES_V3
    else
        rc_apt_install $RC_CLIENT_PACKAGES_V2
    fi
    # shellcheck disable=SC2086
    rc_apt_install $RC_CLIENT_EXTRA_PACKAGES || echo "  (openssh-client install failed)"
    bash "$RC_REMMINA_INSTALLER" || echo "  (remmina optional; xfreerdp is enough)"
    if command -v remmina >/dev/null 2>&1; then
        rc_vnc_display_fix missing
    fi
    rc_ensure_shared_key
    echo ""
    echo "  RDP client: $(rc_rdp_client_bin || echo 'not found')"
    echo "  SSH client: $(command -v ssh || echo 'not found')"
    echo "  Shared key: $(rc_shared_private_key || echo 'not installed (password login only)')"
    if [ "$(ts_backend_state)" != "Running" ]; then
        echo ""
        echo "Tailscale is not connected (state: $(ts_backend_state)); use Login in the Tailscale menu."
    fi
    echo ""
    echo "Remote Windows must host VNC (default) or RDP: run dd.cmd > Management & Backup >"
    echo "One-click: allow Linux to control this PC (VNC shared desktop; also works on Windows Home)."
}

# ---------------------------------------------------------------------------
# 3) Host: allow remote control of this machine
# ---------------------------------------------------------------------------

rc_enable_ssh_host() {
    local user="$1" user_home="" key="" pub_line="" auth_file=""
    echo "-- SSH server --"
    command -v sshd >/dev/null 2>&1 || [ -x /usr/sbin/sshd ] || rc_apt_install $RC_HOST_SSH_PACKAGES
    rc_sudo systemctl enable --now ssh >/dev/null 2>&1 || rc_sudo systemctl enable --now sshd >/dev/null 2>&1
    echo "  ssh service: $(systemctl is-active ssh 2>/dev/null || systemctl is-active sshd 2>/dev/null)"
    rc_allow_firewall_port "$RC_SSH_PORT"

    rc_ensure_shared_key || return 0
    key="$(rc_shared_private_key)"
    pub_line="$(head -n1 "$key.pub")"
    user_home="$(rc_user_home "$user")"
    auth_file="$user_home/.ssh/authorized_keys"
    rc_sudo mkdir -p "$user_home/.ssh"
    rc_sudo touch "$auth_file"
    if ! rc_sudo grep -qF "$pub_line" "$auth_file"; then
        printf '%s\n' "$pub_line" | rc_sudo tee -a "$auth_file" >/dev/null
    fi
    rc_sudo chown -R "$user:" "$user_home/.ssh"
    rc_sudo chmod 700 "$user_home/.ssh"
    rc_sudo chmod 600 "$auth_file"
    echo "  shared key authorized for '$user' ($auth_file)"
}

rc_enable_gnome_system_rdp() {
    local user="$1" grd_home=""
    grd_home="$(rc_user_home "$RC_GRD_SYSTEM_USER")"
    [ -n "$grd_home" ] || { echo "  system user $RC_GRD_SYSTEM_USER missing"; return 1; }
    rc_make_tls_pair "$grd_home/$RC_GRD_TLS_SUBDIR" "$RC_GRD_SYSTEM_USER"
    rc_sudo grdctl --system rdp set-tls-key "$grd_home/$RC_GRD_TLS_SUBDIR/tls.key"
    rc_sudo grdctl --system rdp set-tls-cert "$grd_home/$RC_GRD_TLS_SUBDIR/tls.crt"
    rc_sudo grdctl --system rdp set-credentials "$user" "$RC_LOGIN_PASSWORD"
    rc_sudo grdctl --system rdp enable
    rc_sudo systemctl enable --now gnome-remote-desktop.service
    echo "  GNOME Remote Login (system mode): connect, then sign in at the GDM login screen."
}

rc_enable_gnome_user_rdp() {
    local user="$1" user_home=""
    user_home="$(rc_user_home "$user")"
    rc_make_tls_pair "$user_home/$RC_GRD_TLS_SUBDIR" "$user"
    rc_run_as_user_session "$user" grdctl rdp set-tls-key "$user_home/$RC_GRD_TLS_SUBDIR/tls.key"
    rc_run_as_user_session "$user" grdctl rdp set-tls-cert "$user_home/$RC_GRD_TLS_SUBDIR/tls.crt"
    rc_run_as_user_session "$user" grdctl rdp set-credentials "$user" "$RC_LOGIN_PASSWORD"
    if rc_grdctl_supports_system && rc_sudo grdctl --system status 2>/dev/null | rc_status_rdp_enabled; then
        rc_sudo grdctl --system rdp disable
        rc_sudo systemctl disable --now gnome-remote-desktop.service 2>/dev/null || true
        echo "  system-mode (remote login) RDP disabled: port $RC_RDP_PORT now serves the shared desktop."
    fi
    rc_run_as_user_session "$user" grdctl rdp disable-view-only
    rc_run_as_user_session "$user" grdctl rdp enable
    rc_run_as_user_session "$user" systemctl --user enable --now gnome-remote-desktop.service
    echo "  GNOME Desktop Sharing (user mode): shares the logged-in session of '$user'."
    echo "  Keep '$user' logged in (Settings > Users > Automatic Login helps after reboot)."
}

rc_enable_xrdp() {
    if [ "${HAS_DESKTOP_ENVIRONMENT:-}" != "true" ] && [ -z "$(ls /usr/share/xsessions 2>/dev/null)" ]; then
        echo "  No desktop session installed; RDP skipped (SSH still works)."
        echo "  Install a desktop first (e.g. apt install task-xfce-desktop), then rerun."
        return 1
    fi
    # shellcheck disable=SC2086
    rc_apt_install $RC_HOST_XRDP_PACKAGES
    getent group ssl-cert >/dev/null 2>&1 && rc_sudo usermod -aG ssl-cert xrdp
    rc_sudo systemctl enable --now xrdp
    echo "  xrdp: $(systemctl is-active xrdp 2>/dev/null) (PAM login = system password)."
    echo "  Log out locally first: xrdp cannot open a second GNOME session for the same user."
}

# RDP host only. Idempotent: TLS pair generation skips existing files, grdctl
# set-* rewrites the same values, systemctl enable --now is a no-op when done.
rc_enable_rdp_host() {
    local user="$1"
    echo "-- Remote desktop (RDP $RC_RDP_PORT) --"
    RC_RDP_BACKEND="$(rc_rdp_backend "$user")"
    echo "  backend: $RC_RDP_BACKEND"
    case "$RC_RDP_BACKEND" in
        gnome-system)
            rc_sudo grdctl --system status 2>/dev/null | rc_status_rdp_enabled && \
                echo "  already enabled; re-running refreshes TLS/credentials" ;;
        gnome-user)
            rc_run_as_user_session "$user" grdctl status 2>/dev/null | rc_status_rdp_enabled && \
                echo "  already enabled; re-running refreshes TLS/credentials" ;;
    esac
    rc_sudo apt-get update -qq
    case "$RC_RDP_BACKEND" in
        gnome-system|gnome-user)
            if systemctl is-active --quiet xrdp 2>/dev/null; then
                rc_sudo systemctl disable --now xrdp
                echo "  xrdp stopped (port $RC_RDP_PORT is taken over by GNOME Remote Desktop)."
            fi
            if ! rc_read_login_password "$user"; then
                echo "  RDP not configured (login password not verified)."
            elif [ "$RC_RDP_BACKEND" = "gnome-system" ]; then
                rc_enable_gnome_system_rdp "$user"
            else
                rc_enable_gnome_user_rdp "$user"
            fi
            RC_LOGIN_PASSWORD=""
            ;;
        xrdp) rc_enable_xrdp ;;
    esac
    rc_allow_firewall_port "$RC_RDP_PORT"
}

rc_enable_host() {
    local user=""
    user="$(rc_target_user)"
    echo "== Allow remote control of this machine (user '$user') =="
    rc_sudo apt-get update -qq
    rc_enable_ssh_host "$user"
    echo ""
    rc_enable_rdp_host "$user"
    echo ""
    echo "Connect from Windows: mstsc /v:$(net_detect_tailscale_ipv4 2>/dev/null || echo '<tailscale-ip>')  (user '$user', system login password)"
    echo "If a step could not be automated, see Help for the manual UI steps."
}

# ---------------------------------------------------------------------------
# 4) Connect to a peer
# ---------------------------------------------------------------------------

# Last-used remote username per peer hostname (tab-separated "host<TAB>user").
rc_connect_cached_user() {
    local host="$1" line=""
    if [ -n "$host" ] && [ -f "$RC_CONNECT_CACHE_FILE" ]; then
        line="$(grep -F "$host"$'\t' "$RC_CONNECT_CACHE_FILE" 2>/dev/null | tail -1)"
    fi
    if [ -n "$line" ]; then printf '%s' "${line#*$'\t'}"; else rc_target_user; fi
}

rc_connect_cache_user() {
    local host="$1" user="$2"
    [ -n "$host" ] || return 0
    mkdir -p "$(dirname "$RC_CONNECT_CACHE_FILE")"
    grep -vF "$host"$'\t' "$RC_CONNECT_CACHE_FILE" 2>/dev/null > "$RC_CONNECT_CACHE_FILE.tmp" || true
    printf '%s\t%s\n' "$host" "$user" >> "$RC_CONNECT_CACHE_FILE.tmp"
    mv "$RC_CONNECT_CACHE_FILE.tmp" "$RC_CONNECT_CACHE_FILE"
}

# Xauthority for the desktop user's Xwayland display: probe each mutter cookie
# with xdpyinfo, else fall back to the newest file (empty when none found).
# Never reuse the caller's XAUTHORITY: it may be unreadable by the target user.
rc_session_xauthority() {
    local uid="$1" display="${DISPLAY:-:0}" f=""
    if command -v xdpyinfo >/dev/null 2>&1; then
        for f in /run/user/"$uid"/.mutter-Xwaylandauth.*; do
            [ -r "$f" ] || continue
            if env DISPLAY="$display" XAUTHORITY="$f" xdpyinfo >/dev/null 2>&1; then
                printf '%s' "$f"
                return 0
            fi
        done
    fi
    ls -t /run/user/"$uid"/.mutter-Xwaylandauth.* 2>/dev/null | head -1
}

# Run a GUI command in the desktop user's session (direct when already that
# user). The session bus is required for the keyring (saved passwords) and HOME
# for the user's own profiles. As root without a desktop session it refuses:
# a root GUI saves nothing the desktop user can see.
rc_run_gui_as_desktop_user() {
    local target="" desktop_user="" desktop_uid="" desktop_home="" xauth=""
    if [ "$(id -u)" -ne 0 ]; then
        "$@"
        return
    fi
    target="$(ts_target_user 2>/dev/null)" || target=""
    desktop_user="${target%% *}"
    desktop_uid="${target##* }"
    if [ -z "$desktop_user" ] || [ "$desktop_user" = "root" ]; then
        echo "No graphical login session found; log in to the desktop first (GUI tools are not started as root)."
        return 1
    fi
    desktop_home="$(getent passwd "$desktop_user" | cut -d: -f6)"
    xauth="$(rc_session_xauthority "$desktop_uid")"
    rc_as_user "$desktop_user" env -u XDG_DATA_HOME -u XDG_CONFIG_HOME \
        HOME="$desktop_home" USER="$desktop_user" LOGNAME="$desktop_user" \
        XDG_RUNTIME_DIR="/run/user/$desktop_uid" \
        DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$desktop_uid/bus" \
        DISPLAY="${DISPLAY:-:0}" WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}" \
        ${xauth:+XAUTHORITY="$xauth"} "$@"
}

# TCP reachability probe (3s timeout).
rc_port_open() {
    timeout 3 bash -c "echo > /dev/tcp/$1/$2" 2>/dev/null
}

rc_connect_rdp() {
    local ipv4="$1" remote_user="$2" client=""
    client="$(rc_rdp_client_bin)" || { echo "No RDP client; run 'Enable this machine to control remote' first."; return 1; }
    echo "\$ $client /v:$ipv4 /u:$remote_user /dynamic-resolution +clipboard /cert:tofu"
    rc_run_gui_as_desktop_user "$client" "/v:$ipv4" "/u:$remote_user" /dynamic-resolution +clipboard /cert:tofu
}

# One saved Remmina profile per peer (keyed by Tailscale hostname, else IP) in
# the desktop user's data dir; sets RC_REMMINA_PROFILE. Created once, then only
# server/username are refreshed via the official --update-profile, so the
# saved password and any settings changed in Remmina are kept.
rc_remmina_profile_ensure() {
    local key="$1" ipv4="$2" remote_user="$3" protocol="${4:-RDP}"
    local data_dir="" safe_key="" server="$ipv4" suffix="" user_line=""
    if [ "$protocol" = "VNC" ]; then
        server="$ipv4:$RC_VNC_PORT"
        suffix="$RC_REMMINA_VNC_SUFFIX"
    else
        user_line="username=$remote_user"
    fi
    RC_REMMINA_PROFILE=""
    data_dir="$(rc_run_gui_as_desktop_user sh -c 'printf "%s" "$HOME"')" || return 1
    [ -n "$data_dir" ] || return 1
    data_dir="$data_dir/$RC_REMMINA_DATA_SUBDIR"
    safe_key="$(printf '%s' "${key:-$ipv4}" | tr -c 'A-Za-z0-9._-' '_')"
    RC_REMMINA_PROFILE="$data_dir/$RC_REMMINA_PROFILE_PREFIX$safe_key$suffix.remmina"
    if rc_run_gui_as_desktop_user test -f "$RC_REMMINA_PROFILE"; then
        if [ "$protocol" = "VNC" ]; then
            rc_run_gui_as_desktop_user remmina --update-profile "$RC_REMMINA_PROFILE" \
                --set-option "server=$server" >/dev/null 2>&1
            rc_remmina_vnc_display_ensure "$RC_REMMINA_PROFILE" missing
        else
            rc_run_gui_as_desktop_user remmina --update-profile "$RC_REMMINA_PROFILE" \
                --set-option "server=$server" --set-option "username=$remote_user" >/dev/null 2>&1
        fi
        return 0
    fi
    if [ "$protocol" = "VNC" ]; then
        user_line="$(printf '%s\n' "${RC_REMMINA_VNC_DISPLAY_OPTIONS[@]}")"
    fi
    printf '[remmina]\nname=%s\ngroup=%s\nprotocol=%s\nserver=%s\n%s\n' \
        "${key:-$ipv4}${suffix:+ (VNC)}" "$RC_REMMINA_GROUP" "$protocol" "$server" "$user_line" \
        | rc_run_gui_as_desktop_user sh -c 'umask 077 && mkdir -p "$(dirname "$1")" && cat > "$1"' _ "$RC_REMMINA_PROFILE"
}

# Applies RC_REMMINA_VNC_DISPLAY_OPTIONS to one profile: mode "missing" adds only absent keys
# (keeps what the user changed in Remmina), mode "force" sets every key.
rc_remmina_vnc_display_ensure() {
    local profile="$1" mode="${2:-missing}" option="" option_key=""
    for option in "${RC_REMMINA_VNC_DISPLAY_OPTIONS[@]}"; do
        option_key="${option%%=*}"
        if [ "$mode" = "force" ] || ! rc_run_gui_as_desktop_user grep -q "^${option_key}=" "$profile"; then
            rc_run_gui_as_desktop_user remmina --update-profile "$profile" --set-option "$option" >/dev/null 2>&1
        fi
    done
}

# Idempotent repair for "VNC is not full screen": every saved core_node VNC profile opens
# full screen and scaled to fit (a Windows desktop larger than this screen otherwise scrolls).
rc_vnc_display_fix() {
    local mode="${1:-force}" data_dir="" profile="" fixed=0
    local -a profiles=()
    echo "== VNC full screen + scaling (Remmina profiles) =="
    command -v remmina >/dev/null 2>&1 || { echo "remmina not installed; run 'Install clients' first."; return 1; }
    data_dir="$(rc_run_gui_as_desktop_user sh -c 'printf "%s" "$HOME"')" || return 1
    data_dir="$data_dir/$RC_REMMINA_DATA_SUBDIR"
    mapfile -t profiles < <(rc_run_gui_as_desktop_user find "$data_dir" -maxdepth 1 -name "$RC_REMMINA_PROFILE_PREFIX*$RC_REMMINA_VNC_SUFFIX.remmina" 2>/dev/null)
    for profile in "${profiles[@]}"; do
        [ -n "$profile" ] || continue
        rc_remmina_vnc_display_ensure "$profile" "$mode"
        echo "  [OK] $profile (${RC_REMMINA_VNC_DISPLAY_OPTIONS[*]})"
        fixed=$((fixed + 1))
    done
    [ "$fixed" -gt 0 ] || echo "  No saved VNC profile yet; Connect to a peer creates one with these settings."
    echo ""
    rc_vnc_scaling_hint
}

# Viewer-side display hint shared by the fix, connect, client setup and help.
rc_vnc_scaling_hint() {
    echo "VNC display: Right Ctrl+S = toggle scaled mode, Right Ctrl+F = toggle full screen (Remmina host key = Right Ctrl)."
    echo "  Remote resolution = the Windows screen size; TightVNC cannot resize it (no dynamic resolution)."
    echo "  Only part of the screen, no scroll bars: run the one-click on that Windows PC (marks TightVNC DPI-aware)."
    echo "  Text too small: on Windows lower Settings > System > Display > Scale or the resolution."
}

# "<total> VNC profiles, <ok> scaled + full screen" for the status view.
rc_vnc_profile_summary() {
    local data_dir="" profile="" total=0 ok=0
    local -a profiles=()
    command -v remmina >/dev/null 2>&1 || { echo "remmina not installed"; return 0; }
    data_dir="$(rc_run_gui_as_desktop_user sh -c 'printf "%s" "$HOME"' 2>/dev/null)" || { echo "unknown (no desktop session)"; return 0; }
    mapfile -t profiles < <(rc_run_gui_as_desktop_user find "$data_dir/$RC_REMMINA_DATA_SUBDIR" -maxdepth 1 -name "$RC_REMMINA_PROFILE_PREFIX*$RC_REMMINA_VNC_SUFFIX.remmina" 2>/dev/null)
    for profile in "${profiles[@]}"; do
        [ -n "$profile" ] || continue
        total=$((total + 1))
        if rc_run_gui_as_desktop_user grep -q '^scale=1$' "$profile" && rc_run_gui_as_desktop_user grep -q '^viewmode=4$' "$profile"; then
            ok=$((ok + 1))
        fi
    done
    if [ "$ok" -lt "$total" ]; then
        echo "$total VNC profiles, $ok scaled + full screen (run Fix VNC full screen + scaling)"
    else
        echo "$total VNC profiles, $ok scaled + full screen"
    fi
}

# Remmina GUI in the background on the peer's saved profile: it stays open
# after the session disconnects, keeps the connection in its list and saves
# the password when "Save password" is ticked in the sign-in dialog.
rc_connect_remmina() {
    local ipv4="$1" remote_user="$2" key="$3" protocol="${4:-RDP}"
    command -v remmina >/dev/null 2>&1 || { echo "remmina not installed; run 'Enable this machine to control remote' first."; return 1; }
    rc_remmina_profile_ensure "$key" "$ipv4" "$remote_user" "$protocol" || return 1
    echo "\$ remmina -c $RC_REMMINA_PROFILE"
    rc_run_gui_as_desktop_user remmina -c "$RC_REMMINA_PROFILE" >/dev/null 2>&1 &
    disown 2>/dev/null || true
    echo "Remmina launched on the desktop (saved profile; tick \"Save password\" once to keep the password in the keyring)."
    if [ "$protocol" = "VNC" ]; then
        if ! rc_run_gui_as_desktop_user grep -q '^scale=1$' "$RC_REMMINA_PROFILE"; then
            echo "This profile is not in scaled mode (changed in Remmina); run 'Fix VNC full screen + scaling' to restore it."
        fi
        rc_vnc_scaling_hint
    fi
}

rc_connect_ssh() {
    local ipv4="$1" remote_user="$2" key=""
    key="$(rc_shared_private_key)" || key=""
    if [ -n "$key" ]; then
        echo "\$ ssh -i $key $remote_user@$ipv4"
        ssh -i "$key" -o StrictHostKeyChecking=accept-new "$remote_user@$ipv4"
    else
        echo "\$ ssh $remote_user@$ipv4"
        ssh -o StrictHostKeyChecking=accept-new "$remote_user@$ipv4"
    fi
}

# One-click: peer number = Remmina on the shared desktop (default: VNC for a
# Windows peer - local and remote operate simultaneously; RDP for a Linux peer -
# GNOME desktop sharing in user mode), number+'x' = xfreerdp RDP, number+'s' =
# SSH shell (e.g. '0s', '1x'), or a raw 100.x IP. The port is probed first;
# username defaults to the last one used for that host.
rc_connect_peer() {
    local choice="" row="" host="" os="" online="" ipv4="" dns="" kind=""
    local remote_user="" input_user="" mode="remmina" protocol="RDP" index=0 port="" launch_anyway=""
    local peers=()
    echo "== Connect to a Tailscale peer =="
    rc_load_peer_rows
    for row in "${RC_PEER_ROWS[@]}"; do
        IFS=$'\t' read -r host os online ipv4 dns kind <<<"$row"
        [ "$kind" = "self" ] && continue
        case "$os" in linux|windows) ;; *) continue ;; esac
        peers+=("$row")
    done
    if [ "${#peers[@]}" -eq 0 ]; then
        echo "  (no Linux/Windows peers; Tailscale state: $(ts_backend_state))"
        return 0
    fi
    printf "  %-3s %-20s %-8s %-7s %s\n" "#" "HOSTNAME" "OS" "ONLINE" "TAILSCALE IPV4"
    for row in "${peers[@]}"; do
        IFS=$'\t' read -r host os online ipv4 dns kind <<<"$row"
        printf "  %-3s %-20s %-8s %-7s %s\n" "$index" "$host" "$os" "$online" "$ipv4"
        index=$((index + 1))
    done
    printf "Peer number (default Remmina shared desktop; x=xfreerdp RDP, s=SSH; e.g. 1 / 1x / 0s; or a 100.x IP): "
    read -r choice
    case "$choice" in
        *[sS]) mode="ssh"; choice="${choice%[sS]}" ;;
        *[xX]) mode="rdp"; choice="${choice%[xX]}" ;;
        *[rR]) mode="remmina"; choice="${choice%[rR]}" ;;
    esac
    host=""
    os=""
    if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -lt "${#peers[@]}" ]; then
        IFS=$'\t' read -r host os online ipv4 dns kind <<<"${peers[$choice]}"
    elif [[ "$choice" =~ ^100\. ]]; then
        ipv4="$choice"
    else
        echo "Invalid selection."
        return 1
    fi
    port="$RC_RDP_PORT"
    [ "$mode" = "ssh" ] && port="$RC_SSH_PORT"
    if [ "$mode" = "remmina" ] && [ "$os" != "linux" ]; then
        if rc_port_open "$ipv4" "$RC_VNC_PORT"; then
            protocol="VNC"
            port="$RC_VNC_PORT"
        elif rc_port_open "$ipv4" "$RC_RDP_PORT"; then
            echo "  VNC ($RC_VNC_PORT) is not offered by that peer; using RDP, which takes over its local screen."
        else
            protocol="VNC"
            port="$RC_VNC_PORT"
        fi
    fi
    if ! rc_port_open "$ipv4" "$port"; then
        echo ""
        echo "Cannot reach $ipv4:$port -- the remote machine may not be hosting this service yet."
        case "$os" in
            windows)
                echo "On that Windows PC run: dd.cmd > Management & Backup > One-click: allow Linux to control this PC (VNC shared desktop)."
                echo "(Windows Home cannot host RDP, but VNC and OpenSSH Server work there.)"
                ;;
            linux)
                echo "On that Linux machine run: dd.sh > Linux System Tools > Management & Backup > One-click: allow remote control of this machine."
                ;;
            *)
                echo "Enable the service on the remote machine first (RDP $RC_RDP_PORT / SSH $RC_SSH_PORT)."
                ;;
        esac
        echo ""
        printf "Start the remote tool anyway? [Y/n]: "
        read -r launch_anyway
        case "$launch_anyway" in
            [Nn]*) return 1 ;;
        esac
    fi
    remote_user="$(rc_connect_cached_user "$host")"
    if [ "$protocol" = "VNC" ] && [ "$mode" = "remmina" ]; then
        rc_connect_remmina "$ipv4" "$remote_user" "$host" "VNC"
        return $?
    fi
    if [ "$os" = "windows" ]; then
        printf "Remote Windows sign-in user [%s]: " "$remote_user"
    else
        printf "Remote username [%s]: " "$remote_user"
    fi
    read -r input_user
    [ -n "$input_user" ] && remote_user="$input_user"
    rc_connect_cache_user "$host" "$remote_user"
    case "$mode" in
        ssh) rc_connect_ssh "$ipv4" "$remote_user" ;;
        remmina) rc_connect_remmina "$ipv4" "$remote_user" "$host" "$protocol" ;;
        *) rc_connect_rdp "$ipv4" "$remote_user" ;;
    esac
}

# ---------------------------------------------------------------------------
# Status / Help
# ---------------------------------------------------------------------------

rc_show_status() {
    echo "== Remote control status =="
    echo "  Tailscale:      $(ts_backend_state)  IPv4 $(net_detect_tailscale_ipv4 2>/dev/null || echo none)"
    echo "  Login user:     $(rc_target_user)"
    echo "  SSH server:     $(systemctl is-active ssh 2>/dev/null)"
    echo "  xrdp:           $(systemctl is-active xrdp 2>/dev/null)"
    if command -v grdctl >/dev/null 2>&1; then
        if rc_grdctl_supports_system; then
            echo "  GNOME system:   $(rc_sudo grdctl --system status 2>/dev/null | awk -F': *' '/Status/ {print $2; exit}')"
        fi
        echo "  GNOME backend:  $(rc_rdp_backend)"
    fi
    echo "  RDP client:     $(rc_rdp_client_bin || echo 'not installed')"
    echo "  Shared key:     $(rc_shared_private_key || echo 'not installed')"
    echo "  Remmina VNC:    $(rc_vnc_profile_summary)"
}

rc_show_help() {
    cat <<EOF
Remote control over Tailscale (Windows 10/11 <-> Debian 12/13, Ubuntu 24.04/26.04)

Automated here:
  Linux host:   openssh-server + shared key, GNOME Remote Desktop (grdctl) or xrdp, ufw on $RC_TAILSCALE_IFACE
  Linux client: freerdp3 (freerdp2 on Debian 12), remmina, openssh-client, shared key
  Windows side: dd.cmd > Management & Backup > Remote Control
  Connect: peer number = Remmina on the SHARED desktop (default; Windows peer = VNC on
    $RC_VNC_PORT, Linux peer = RDP to the GNOME desktop-sharing session), number+x = xfreerdp
    RDP, number+s = SSH shell (e.g. '1x', '0s'); the port is probed first, and the
    username is remembered per host, so a repeat connection is peer number + Enter + Enter.
  Simultaneous use: the Linux host shares the logged-in GNOME session by default
    (RC_RDP_MODE=system selects the separate GDM remote-login session instead); a
    Windows host shares its console through the VNC service. Plain Windows RDP and
    GNOME remote login open another session and lock/replace the local screen.
  Full screen / scaling (VNC): the Windows screen is sent at its own size (TightVNC cannot resize
    it); Remmina VNC profiles use scale=1 (fit, aspect kept) + viewmode=4 (full screen), added on
    connect when missing and forced by 'Fix VNC full screen + scaling' (vnc-display). In a session:
    Right Ctrl+S = scaled mode, Right Ctrl+F = full screen. Partial image without scroll bars =
    Windows display scaling: the Windows one-click marks TightVNC DPI-aware. Text too small: lower
    the Windows display scale or resolution.

Manual UI steps when automation is not possible:
  GNOME (Debian/Ubuntu): Settings > System > Remote Desktop (GNOME 46+) or Settings > Sharing >
    Remote Desktop (GNOME 43): enable "Remote Desktop" + "Remote Control", set user/password
    to the login user and login password.
  Windows 10/11 Pro/Enterprise: Settings > System > Remote Desktop > On.
  Windows Home: cannot host RDP -- use VNC (default, TightVNC service) or SSH instead.
  Windows Microsoft account: RDP user = the account e-mail, password = account password (not PIN);
    Settings > Accounts > Sign-in options > turn off "Only allow Windows Hello sign-in".
  Tailscale ACL: the default policy allows all devices; custom ACLs must allow tcp:$RC_VNC_PORT, tcp:$RC_RDP_PORT and tcp:$RC_SSH_PORT.

Shared key: ~/.ssh/$RC_SHARED_KEY_NAME (decrypted by 27_install_git_ssh.sh / Step5_InstallGitSSH.ps1).

Docs:
  https://gitlab.gnome.org/GNOME/gnome-remote-desktop/-/blob/master/README.md
  https://tailscale.com/kb/1095/secure-rdp-windows
  https://tailscale.com/kb/1193/tailscale-ssh
  https://learn.microsoft.com/windows-server/administration/openssh/openssh_install_firstuse
EOF
}

rc_run_menu_action() {
    printf "c"
    "$@"
    rc_pause
}

# Every Tailscale IP is printed above the items; each item calls a function above.
rc_show_menu() {
    local menu_items=(
        "-- Let others control this machine --"
        "One-click: allow remote control of this machine (shared desktop + SSH)"
        "-- Control another machine --"
        "Connect to a peer (Windows: VNC shared desktop default; RDP or SSH)"
        "Install clients (Remmina VNC/RDP, xfreerdp, SSH, shared key)"
        "Fix VNC full screen + scaling (saved Remmina VNC profiles)"
        "-- Info --"
        "Endpoints (all Tailscale IPs + connect commands)"
        "Status"
        "Help (manual UI steps + official docs)"
        "Back"
    )

    declare -F numeric_menu_select >/dev/null 2>&1 || . "$REMOTE_CONTROL_ARROW_MENU_SCRIPT"
    while true; do
        rc_load_peer_rows
        numeric_menu_select "Remote Control (Windows <-> Linux over Tailscale)" menu_items 10 rc_render_peer_table
        case "$ARROW_MENU_SELECTED_INDEX" in
            1) rc_run_menu_action rc_enable_host ;;
            3) rc_run_menu_action rc_connect_peer ;;
            4) rc_run_menu_action rc_enable_controller ;;
            5) rc_run_menu_action rc_vnc_display_fix ;;
            7) rc_run_menu_action rc_show_endpoints ;;
            8) rc_run_menu_action rc_show_status ;;
            9) rc_run_menu_action rc_show_help ;;
            *) return 0 ;;
        esac
    done
}

remote_control_common_main() {
    case "${1:-help}" in
        menu) rc_show_menu ;;
        endpoints) rc_show_endpoints ;;
        controller) rc_enable_controller ;;
        host) rc_enable_host ;;
        rdp) rc_enable_rdp_host "$(rc_target_user)" ;;
        connect) rc_connect_peer ;;
        vnc-display) rc_vnc_display_fix ;;
        status) rc_show_status ;;
        *) rc_show_help ;;
    esac
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    remote_control_common_main "$@"
fi
