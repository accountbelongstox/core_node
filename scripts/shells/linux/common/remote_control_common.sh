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
#   rc_connect_peer          - pick a peer, connect by RDP or SSH
#   rc_show_status           - host/client readiness summary
#   rc_show_help             - manual UI steps + doc links
#   remote_control_common_main <endpoints|controller|host|connect|status|help>
# =============================================================================

if [ "${REMOTE_CONTROL_COMMON_LOADED:-false}" = "true" ]; then
    return 0 2>/dev/null || exit 0
fi
REMOTE_CONTROL_COMMON_LOADED="true"

REMOTE_CONTROL_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REMOTE_CONTROL_ROOT_DIR="$(cd "$REMOTE_CONTROL_COMMON_DIR/../../../.." && pwd)"
# shellcheck source=/dev/null
. "$REMOTE_CONTROL_COMMON_DIR/tailscale_common.sh"

RC_RDP_PORT="3389"
RC_SSH_PORT="22"
RC_TAILSCALE_CIDR="100.64.0.0/10"
RC_TAILSCALE_IFACE="tailscale0"
RC_SHARED_KEY_NAME="id_ed25519"
RC_SHARED_KEY_INSTALLER="$REMOTE_CONTROL_ROOT_DIR/scripts/shells/linux/debian/install_shells/27_install_git_ssh.sh"
RC_GRD_SYSTEM_USER="gnome-remote-desktop"
RC_GRD_TLS_SUBDIR=".local/share/gnome-remote-desktop"
RC_TLS_SUBJECT="/CN=core-node-remote-desktop"
RC_TLS_DAYS="3650"
RC_CLIENT_PACKAGES_V3="freerdp3-x11"
RC_CLIENT_PACKAGES_V2="freerdp2-x11"
RC_CLIENT_EXTRA_PACKAGES="openssh-client remmina remmina-plugin-rdp"
RC_HOST_SSH_PACKAGES="openssh-server"
RC_HOST_XRDP_PACKAGES="xrdp xorgxrdp"
RC_PEER_ROWS=()
RC_RDP_BACKEND=""
RC_LOGIN_PASSWORD=""

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

# GNOME 46+ system mode (remote login, survives reboot) -> GNOME user mode
# (shares the running session) -> xrdp (any X11 desktop, PAM login).
rc_rdp_backend() {
    if rc_grdctl_supports_system; then
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
    rc_apt_install $RC_CLIENT_EXTRA_PACKAGES || echo "  (remmina optional; xfreerdp is enough)"
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
    echo "Remote Windows must allow RDP: run dd.cmd > Windows Management > [T] Tailscale >"
    echo "Remote Control > Allow remote control of this machine (Windows Home cannot host RDP)."
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

rc_enable_host() {
    local user=""
    user="$(rc_target_user)"
    echo "== Allow remote control of this machine (user '$user') =="
    rc_sudo apt-get update -qq
    rc_enable_ssh_host "$user"
    echo ""
    echo "-- Remote desktop (RDP $RC_RDP_PORT) --"
    RC_RDP_BACKEND="$(rc_rdp_backend)"
    echo "  backend: $RC_RDP_BACKEND"
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
    echo ""
    echo "Connect from Windows: mstsc /v:$(net_detect_tailscale_ipv4 2>/dev/null || echo '<tailscale-ip>')  (user '$user', system login password)"
    echo "If a step could not be automated, see Help for the manual UI steps."
}

# ---------------------------------------------------------------------------
# 4) Connect to a peer
# ---------------------------------------------------------------------------

rc_connect_rdp() {
    local ipv4="$1" remote_user="$2" client="" target="" desktop_user="" desktop_uid=""
    client="$(rc_rdp_client_bin)" || { echo "No RDP client; run 'Enable this machine to control remote' first."; return 1; }
    target="$(ts_target_user 2>/dev/null)" || target=""
    desktop_user="${target%% *}"
    desktop_uid="${target##* }"
    echo "\$ $client /v:$ipv4 /u:$remote_user /dynamic-resolution +clipboard /cert:tofu"
    if [ "$(id -u)" -eq 0 ] && [ -n "$desktop_user" ] && [ "$desktop_user" != "root" ]; then
        rc_as_user "$desktop_user" env XDG_RUNTIME_DIR="/run/user/$desktop_uid" \
            DISPLAY="${DISPLAY:-:0}" WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}" \
            "$client" "/v:$ipv4" "/u:$remote_user" /dynamic-resolution +clipboard /cert:tofu
    else
        "$client" "/v:$ipv4" "/u:$remote_user" /dynamic-resolution +clipboard /cert:tofu
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

rc_connect_peer() {
    local choice="" row="" host="" os="" online="" ipv4="" dns="" kind="" remote_user="" mode=""
    echo "== Connect to a Tailscale peer =="
    rc_print_peer_table
    [ "${#RC_PEER_ROWS[@]}" -gt 0 ] || return 0
    printf "Peer number (or a Tailscale IP): "
    read -r choice
    if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -lt "${#RC_PEER_ROWS[@]}" ]; then
        row="${RC_PEER_ROWS[$choice]}"
        IFS=$'\t' read -r host os online ipv4 dns kind <<<"$row"
    elif [[ "$choice" =~ ^100\. ]]; then
        ipv4="$choice"
    else
        echo "Invalid selection."
        return 1
    fi
    printf "Remote username [%s]: " "$(rc_target_user)"
    read -r remote_user
    [ -n "$remote_user" ] || remote_user="$(rc_target_user)"
    printf "Mode: [1] RDP desktop  [2] SSH shell  [1]: "
    read -r mode
    case "$mode" in
        2) rc_connect_ssh "$ipv4" "$remote_user" ;;
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
}

rc_show_help() {
    cat <<EOF
Remote control over Tailscale (Windows 10/11 <-> Debian 12/13, Ubuntu 24.04/26.04)

Automated here:
  Linux host:   openssh-server + shared key, GNOME Remote Desktop (grdctl) or xrdp, ufw on $RC_TAILSCALE_IFACE
  Linux client: freerdp3 (freerdp2 on Debian 12), remmina, openssh-client, shared key
  Windows side: dd.cmd > Windows Management > [T] Tailscale > Remote Control

Manual UI steps when automation is not possible:
  GNOME (Debian/Ubuntu): Settings > System > Remote Desktop (GNOME 46+) or Settings > Sharing >
    Remote Desktop (GNOME 43): enable "Remote Desktop" + "Remote Control", set user/password
    to the login user and login password.
  Windows 10/11 Pro/Enterprise: Settings > System > Remote Desktop > On.
  Windows Home: cannot host RDP -- use SSH (OpenSSH Server) or RustDesk instead.
  Windows Microsoft account: RDP user = the account e-mail, password = account password (not PIN);
    Settings > Accounts > Sign-in options > turn off "Only allow Windows Hello sign-in".
  Tailscale ACL: the default policy allows all devices; custom ACLs must allow tcp:$RC_RDP_PORT and tcp:$RC_SSH_PORT.

Shared key: ~/.ssh/$RC_SHARED_KEY_NAME (decrypted by 27_install_git_ssh.sh / Step5_InstallGitSSH.ps1).

Docs:
  https://gitlab.gnome.org/GNOME/gnome-remote-desktop/-/blob/master/README.md
  https://tailscale.com/kb/1095/secure-rdp-windows
  https://tailscale.com/kb/1193/tailscale-ssh
  https://learn.microsoft.com/windows-server/administration/openssh/openssh_install_firstuse
EOF
}

remote_control_common_main() {
    case "${1:-help}" in
        endpoints) rc_show_endpoints ;;
        controller) rc_enable_controller ;;
        host) rc_enable_host ;;
        connect) rc_connect_peer ;;
        status) rc_show_status ;;
        *) rc_show_help ;;
    esac
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    remote_control_common_main "$@"
fi
