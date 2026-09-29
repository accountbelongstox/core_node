#!/bin/bash

# =============================================================================
# tailscale_common.sh - shared Tailscale (mesh VPN) management library.
#
# Single source of truth for: install detection, tailscaled systemd state,
# backend connection state, the device/IP listing and the admin/local panels.
# Read-only status queries here (status, ip, version) need no elevation on
# either OS; only the daemon restart needs root. This library never runs
# `tailscale up`/`down`/`set` and never touches the node's login state -- that
# stays in the installer (97_install_tailscale.sh) and the interactive CLI.
#
# Official docs consulted (verified 2026-09-28):
#   CLI reference (up/set/status/web/logout flags): https://tailscale.com/docs/reference/tailscale-cli
#   tailscaled service:     https://tailscale.com/kb/1278/tailscaled
#   Device web interface:   https://tailscale.com/docs/features/client/device-web-interface
#                            (formerly https://tailscale.com/kb/1325/device-web-interface)
#   Quad100:                https://tailscale.com/kb/1381/what-is-quad100
#   Admin console:          https://tailscale.com/docs/how-to/quickstart
#   Linux install:          https://tailscale.com/kb/1031/install-linux
#   status --json fields:   https://pkg.go.dev/tailscale.com/ipn/ipnstate
#   Prefs (debug prefs):    https://pkg.go.dev/tailscale.com/ipn#Prefs
#
# Public API:
#   is_tailscale_installed          - CLI present (command -v tailscale)
#   ts_service_unit_exists          - tailscaled.service known to systemd
#   ts_service_active_state         - systemctl is-active tailscaled (stdout)
#   ts_service_enabled_state        - systemctl is-enabled tailscaled (stdout)
#   ts_backend_state                - status --json .BackendState (stdout)
#   ts_quick_menu_label             - "<INSTALL_TAILSCALE flag>|<backend state>" for the quick menu entry
#   ts_show_status                  - human-readable install/service/IP summary
#   ts_show_devices                 - every tailnet device (table + detail)
#   ts_self_dnsname                 - this node's MagicDNS name without the trailing dot (stdout)
#   ts_show_all_ips                 - this machine's IPs/MagicDNS/LAN IPs + every peer's IPs
#   ts_show_settings                - current `tailscale set`-able prefs (tailscale debug prefs)
#   ts_apply_setting <name> <value> - apply one setting via `tailscale set` (never --reset)
#   ts_restart_service               - sudo systemctl restart tailscaled
#   ts_open_ui                      - print/open admin console + local `tailscale web` UI
#   ts_login / ts_logout            - tailscale up (non-blocking URL capture) / tailscale logout
#   ts_show_help                    - dispatcher usage + doc links
#   tailscale_common_main "$@"      - dispatcher: status|devices|all-ips|settings|set|restart|ui|login|logout|help
#
# Direct call: `bash tailscale_common.sh <status|devices|all-ips|settings|restart|ui|login|logout|help>`.
# Menu entry: scripts/shells/linux/menu_itemshells/tailscale_menu.sh.
# =============================================================================

# Source-once guard: repeated `source` is a no-op.
if [ "${TAILSCALE_COMMON_LOADED:-false}" = "true" ]; then
    return 0 2>/dev/null || exit 0
fi
TAILSCALE_COMMON_LOADED="true"

TAILSCALE_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# net_detect_tailscale_ipv4() (this node's 100.64.0.0/10 address) is the
# existing single source of truth; reused here instead of re-implementing it.
# shellcheck source=/dev/null
. "$TAILSCALE_COMMON_DIR/network_detect_common.sh"

# The single definition of the systemd unit name (Linux rules: define once).
# 97_install_tailscale.sh sources this file and no longer declares its own copy.
TAILSCALE_SERVICE="tailscaled"
TAILSCALE_ADMIN_CONSOLE_URL="https://console.tailscale.com/admin/machines"
TAILSCALE_LOCAL_WEB_URL="http://100.100.100.100"
TAILSCALE_STATUS_WEB_LISTEN="127.0.0.1:8384"
# `tailscale web` (interactive local control UI, distinct from the read-only
# Quad100 device web interface above): https://tailscale.com/docs/reference/tailscale-cli
TAILSCALE_WEB_UI_LISTEN="127.0.0.1:8088"
TAILSCALE_WEB_UI_URL="http://127.0.0.1:8088"
# Settings exposed through the Settings menu / `ts_apply_setting` (name -> `tailscale set` flag).
TAILSCALE_SETTING_NAMES="hostname accept-routes advertise-exit-node exit-node ssh shields-up operator"

# True when the tailscale CLI is on PATH. Moved here from
# 97_install_tailscale.sh (was duplicated) so the installer and the
# management menu share one definition.
is_tailscale_installed() {
    command -v tailscale >/dev/null 2>&1
}

# Privilege prefix for the one write action (service restart): honor a
# caller-set USE_SUDO (gvar_common.sh), else derive it. Empty when already root.
ts_sudo_prefix() {
    if [ "$(id -u)" -eq 0 ]; then
        return 0
    fi
    if [ -n "${USE_SUDO+x}" ]; then
        printf '%s' "$USE_SUDO"
        return 0
    fi
    if command -v sudo >/dev/null 2>&1; then
        printf 'sudo'
    fi
}

# True when systemd knows about tailscaled.service (installed via apt/the
# official installer registers it regardless of enabled/running state).
ts_service_unit_exists() {
    [ -n "$(systemctl list-unit-files "${TAILSCALE_SERVICE}.service" --no-legend 2>/dev/null)" ]
}

# Echoes active/inactive/unknown (systemctl already prints the state to
# stdout regardless of its exit code, so no exit-code return value is needed).
ts_service_active_state() {
    systemctl is-active "$TAILSCALE_SERVICE" 2>/dev/null
}

# Echoes enabled/disabled/static/... the same way.
ts_service_enabled_state() {
    systemctl is-enabled "$TAILSCALE_SERVICE" 2>/dev/null
}

# Echoes the ipn/ipnstate BackendState (NoState|NeedsLogin|NeedsMachineAuth|
# Stopped|Starting|Running), or "unknown" when it cannot be read. Prefers
# python3 (matches the parsing style already used by domain_setup_common.sh);
# falls back to sed so a python3-less host still gets a state.
ts_backend_state() {
    local raw="" state=""
    raw="$(tailscale status --json 2>/dev/null)"
    if [ -z "$raw" ]; then
        printf '%s' "unknown"
        return 0
    fi
    if command -v python3 >/dev/null 2>&1; then
        state="$(printf '%s' "$raw" | python3 -c 'import sys, json
try:
    print(json.load(sys.stdin).get("BackendState", ""))
except Exception:
    pass' 2>/dev/null)"
    fi
    if [ -z "$state" ]; then
        state="$(printf '%s' "$raw" | sed -n 's/.*"BackendState": *"\([^"]*\)".*/\1/p' | head -n1)"
    fi
    printf '%s' "${state:-unknown}"
}

# "<INSTALL_TAILSCALE flag>|<backend state>" for the Linux System Tools quick
# entry ("[T] Tailscale [...]"). Never hangs and needs no elevation:
# is_tailscale_installed is a plain `command -v`, and ts_backend_state already
# degrades to "unknown"/fast when the CLI or daemon is unreachable. get_var
# (gvar_common.sh / global_var_store.sh) is optional here -- this library is
# also usable standalone (direct dispatcher call) where get_var may not exist.
ts_quick_menu_label() {
    local flag="" state=""
    if command -v get_var >/dev/null 2>&1; then
        flag="$(get_var INSTALL_TAILSCALE true 2>/dev/null)"
    fi
    [ -n "$flag" ] || flag="true"
    if is_tailscale_installed; then
        state="$(ts_backend_state)"
    else
        state="not installed"
    fi
    printf '%s|%s' "$flag" "$state"
}

# Human-readable install / service / connection summary.
ts_show_status() {
    local installed="no" version="" backend="unknown" ipv4="" ipv6=""

    echo "== Tailscale status =="
    if is_tailscale_installed; then
        installed="yes"
        version="$(tailscale version 2>/dev/null | head -n1)"
    fi
    echo "CLI installed:  $installed"
    [ -n "$version" ] && echo "Version:        $version"

    if ts_service_unit_exists; then
        echo "Service unit:   ${TAILSCALE_SERVICE}.service (active: $(ts_service_active_state); enabled: $(ts_service_enabled_state))"
    else
        echo "Service unit:   ${TAILSCALE_SERVICE}.service not found"
    fi

    if [ "$installed" = "yes" ]; then
        backend="$(ts_backend_state)"
        ipv4="$(net_detect_tailscale_ipv4 2>/dev/null)"
        ipv6="$(tailscale ip -6 2>/dev/null | head -n1)"
        echo "Backend state:  $backend"
        echo "IPv4:           ${ipv4:-none}"
        echo "IPv6:           ${ipv6:-none}"
        case "$backend" in
            NeedsLogin)
                echo ""
                echo "Node is not authenticated. Connect with: sudo tailscale up"
                ;;
            Stopped)
                echo ""
                echo "Node is stopped. Reconnect with: sudo tailscale up"
                ;;
        esac
    fi
}

# Every tailnet device: the official table, then a parsed detail listing
# (HostName, DNSName, OS, Owner, IPv4/IPv6, Online, LastSeen, ExitNode
# in-use/offered/-, connection path) from `status --json` (.Self + .Peer,
# ipn/ipnstate.PeerStatus fields; Owner from .User[UserID].LoginName) --
# same column set as the Windows counterpart's Get-TailscaleDeviceRow /
# Show-TailscaleDevices (ExitNode distinguishes ExitNode="in-use" from the
# mere ExitNodeOption="offered", not just a yes/no).
ts_show_devices() {
    if ! is_tailscale_installed; then
        echo "Tailscale is not installed; no devices to list."
        return 0
    fi

    echo "== tailscale status (official table) =="
    tailscale status 2>&1
    echo ""

    if ! command -v python3 >/dev/null 2>&1; then
        echo "python3 not found; showing the table above only."
        return 0
    fi

    echo "== Device detail (status --json) =="
    tailscale status --json 2>/dev/null | python3 -c '
import sys, json


def split_ips(peer):
    v4 = v6 = ""
    for ip in peer.get("TailscaleIPs") or []:
        if ":" in ip:
            v6 = v6 or ip
        else:
            v4 = v4 or ip
    return v4, v6


def owner_login(peer, user_map):
    user_id = peer.get("UserID")
    if user_id is None:
        return ""
    entry = user_map.get(str(user_id)) or {}
    return entry.get("LoginName") or ""


def exit_node_label(peer):
    # Distinguishes the exit node currently in use (ExitNode) from a peer
    # that merely offers itself as one (ExitNodeOption) -- same distinction
    # as the Windows counterpart column (in-use / offered / -).
    if peer.get("ExitNode"):
        return "in-use"
    if peer.get("ExitNodeOption"):
        return "offered"
    return "-"


def connection_label(peer):
    if peer.get("CurAddr"):
        return "direct " + peer["CurAddr"]
    if peer.get("PeerRelay"):
        return "peer-relay " + peer["PeerRelay"]
    relay = peer.get("Relay") or ""
    return ("relay \"%s\"" % relay) if relay else "-"


try:
    data = json.load(sys.stdin)
except Exception as exc:
    print("Could not parse status --json: %s" % exc)
    sys.exit(0)

user_map = data.get("User") or {}
nodes = []
self_node = data.get("Self")
if self_node:
    nodes.append(self_node)
for peer in (data.get("Peer") or {}).values():
    nodes.append(peer)

row_fmt = "%-18s %-32s %-8s %-24s %-15s %-26s %-7s %-20s %-9s %s"
print(row_fmt % ("HOSTNAME", "DNS NAME", "OS", "OWNER", "IPV4", "IPV6", "ONLINE", "LAST SEEN", "EXIT NODE", "CONNECTION"))
for peer in nodes:
    v4, v6 = split_ips(peer)
    print(row_fmt % (
        peer.get("HostName", "") or "",
        (peer.get("DNSName", "") or "").rstrip("."),
        peer.get("OS", "") or "",
        owner_login(peer, user_map) or "-",
        v4 or "-",
        v6 or "-",
        "yes" if peer.get("Online") else "no",
        peer.get("LastSeen", "") or "-",
        exit_node_label(peer),
        connection_label(peer),
    ))
' 2>/dev/null || echo "Could not parse status --json output."
}

# This node's MagicDNS name (status --json .Self.DNSName, trailing dot
# stripped); empty when tailscaled cannot report it.
ts_self_dnsname() {
    local dns=""

    command -v tailscale >/dev/null 2>&1 || return 0
    if command -v python3 >/dev/null 2>&1; then
        dns="$(tailscale status --json 2>/dev/null | python3 -c '
import sys, json
try:
    data = json.load(sys.stdin)
    print(((data.get("Self") or {}).get("DNSName") or "").rstrip("."))
except Exception:
    pass' 2>/dev/null)"
    fi
    if [ -z "$dns" ]; then
        dns="$(tailscale status --json 2>/dev/null | sed -n 's/.*"DNSName": *"\([^"]*\)".*/\1/p' | head -1)"
        dns="${dns%.}"
    fi
    printf '%s' "$dns"
}

# All IPs: this machine (Tailscale IPv4/IPv6, MagicDNS name, LAN IPs -- every
# non-Tailscale local IPv4, reusing net_detect_local_ipv4s and excluding the
# 100.64.0.0/10 CGNAT range Tailscale itself uses, same range net_ip_is_private
# already classifies) and every peer (hostname, OS, online, every TailscaleIPs
# entry, exit-node flag), all from `tailscale status --json` (ipn/ipnstate).
ts_show_all_ips() {
    if ! is_tailscale_installed; then
        echo "Tailscale is not installed; no IPs to show."
        return 0
    fi

    local ipv4="" ipv6="" magicdns="" lan_ips="" lan_ips_line=""
    ipv4="$(net_detect_tailscale_ipv4 2>/dev/null)"
    ipv6="$(tailscale ip -6 2>/dev/null | head -n1)"
    magicdns="$(ts_self_dnsname)"
    lan_ips="$(net_detect_local_ipv4s 2>/dev/null | grep -vE '^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.')"
    lan_ips_line="$(printf '%s' "$lan_ips" | tr '\n' ' ' | sed 's/[[:space:]]*$//')"

    echo "== This machine =="
    echo "  Tailscale IPv4:  ${ipv4:-none}"
    echo "  Tailscale IPv6:  ${ipv6:-none}"
    echo "  MagicDNS name:   ${magicdns:-none}"
    echo "  LAN IPs:         ${lan_ips_line:-none}"
    echo ""

    echo "== Peers =="
    if ! command -v python3 >/dev/null 2>&1; then
        echo "python3 not found; run 'tailscale status' for peer IPs."
        return 0
    fi
    tailscale status --json 2>/dev/null | python3 -c '
import sys, json


def exit_node_label(peer):
    if peer.get("ExitNode"):
        return "in-use"
    if peer.get("ExitNodeOption"):
        return "offered"
    return "-"


try:
    data = json.load(sys.stdin)
except Exception as exc:
    print("Could not parse status --json: %s" % exc)
    sys.exit(0)

row_fmt = "%-18s %-8s %-7s %-40s %s"
print(row_fmt % ("HOSTNAME", "OS", "ONLINE", "TAILSCALE IPS", "EXIT NODE"))
for peer in (data.get("Peer") or {}).values():
    ips = ", ".join(peer.get("TailscaleIPs") or []) or "-"
    print(row_fmt % (
        peer.get("HostName", "") or "",
        peer.get("OS", "") or "",
        "yes" if peer.get("Online") else "no",
        ips,
        exit_node_label(peer),
    ))
' 2>/dev/null || echo "Could not parse status --json output."
}

# Restart the tailscaled daemon (does not change up/down or login state).
ts_restart_service() {
    local sudo_prefix="" command_line=""

    if ! is_tailscale_installed; then
        echo "Tailscale is not installed; nothing to restart."
        return 0
    fi
    if ! ts_service_unit_exists; then
        echo "No ${TAILSCALE_SERVICE}.service unit found; nothing to restart."
        return 0
    fi

    sudo_prefix="$(ts_sudo_prefix)"
    command_line="${sudo_prefix:+$sudo_prefix }systemctl restart $TAILSCALE_SERVICE"
    echo ""
    echo "\$ $command_line"
    eval "$command_line"
    echo ""
    echo "Service active state: $(ts_service_active_state)"
}

# Resolve "<user> <uid>" for the seated desktop session (loginctl "seat"
# column set = a real console session), used to run desktop-facing commands
# (xdg-open, `tailscale web`) as the real user instead of root. Already root
# -> that session's user; already a normal user -> the caller itself. Empty
# (return 1) when there is no active seated session (headless).
ts_target_user() {
    local target_uid="" target_user=""
    if [ "$(id -u)" -ne 0 ]; then
        printf '%s %s' "$(id -un)" "$(id -u)"
        return 0
    fi
    target_uid="$(loginctl list-sessions --no-legend 2>/dev/null | awk '$4 != "" && $4 != "-" {print $2; exit}')"
    [ -n "$target_uid" ] || return 1
    target_user="$(id -un "$target_uid" 2>/dev/null)"
    [ -n "$target_user" ] || return 1
    printf '%s %s' "$target_user" "$target_uid"
}

# Best-effort `xdg-open` for one URL. Root sessions cannot reach a desktop
# user's browser (Chrome/Chromium refuse to run as root), so a root caller
# re-invokes it as the seated ts_target_user; a non-root caller opens it
# directly. Silent no-op when there is no desktop/browser to open it with.
ts_open_url() {
    local url="$1" target="" target_user="" target_uid=""

    command -v xdg-open >/dev/null 2>&1 || return 0
    target="$(ts_target_user)" || return 0
    target_user="${target%% *}"
    target_uid="${target##* }"
    if [ "$(id -u)" -eq 0 ] && [ "$target_user" != "root" ]; then
        sudo -u "$target_user" env \
            XDG_RUNTIME_DIR="/run/user/$target_uid" \
            DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$target_uid/bus" \
            DISPLAY="${DISPLAY:-:0}" \
            WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}" \
            xdg-open "$url" >/dev/null 2>&1 &
    else
        xdg-open "$url" >/dev/null 2>&1 &
    fi
    return 0
}

# True when a `tailscale web` local UI process is already listening (idempotent
# guard so "Open UI" never stacks up duplicate background processes).
ts_web_ui_running() {
    pgrep -f "tailscale web .*--listen[= ]$TAILSCALE_WEB_UI_LISTEN" >/dev/null 2>&1 \
        || pgrep -f "tailscale web --listen $TAILSCALE_WEB_UI_LISTEN" >/dev/null 2>&1
}

# Start `tailscale web` (the interactive local control UI: docs.
# reference/tailscale-cli) detached, as the real desktop user when this
# library runs as root (its config lives under that user's runtime dir).
# Idempotent: a no-op when it is already listening.
ts_start_web_ui() {
    local target="" target_user="" target_uid=""

    ts_web_ui_running && return 0
    is_tailscale_installed || return 1

    target="$(ts_target_user)" || target=""
    if [ -n "$target" ] && [ "$(id -u)" -eq 0 ]; then
        target_user="${target%% *}"
        target_uid="${target##* }"
        if [ "$target_user" != "root" ]; then
            sudo -u "$target_user" env XDG_RUNTIME_DIR="/run/user/$target_uid" \
                nohup tailscale web --listen "$TAILSCALE_WEB_UI_LISTEN" \
                >/tmp/tailscale-web-ui.log 2>&1 &
            disown 2>/dev/null || true
            sleep 1
            return 0
        fi
    fi
    nohup tailscale web --listen "$TAILSCALE_WEB_UI_LISTEN" >/tmp/tailscale-web-ui.log 2>&1 &
    disown 2>/dev/null || true
    sleep 1
}

# "Open UI": the tailnet admin console (all devices, cloud panel) plus the
# local `tailscale web` control UI (this device only), opened as the real
# desktop user. On a desktop session both are opened in the default browser;
# headless (no HAS_DESKTOP_ENVIRONMENT / no xdg-open), the URLs are printed
# only -- e.g. for an SSH port-forward (`ssh -L 8088:127.0.0.1:8088 ...`).
# The local UI needs the daemon Running (tailscaled must be connected) so it
# is only started/opened once ts_backend_state reports that.
ts_open_ui() {
    local backend="unknown" has_desktop=""

    echo "Tailnet admin console (all devices, cloud panel):"
    echo "  $TAILSCALE_ADMIN_CONSOLE_URL"
    echo ""

    if ! is_tailscale_installed; then
        echo "Tailscale is not installed; local web UI unavailable."
        return 0
    fi
    backend="$(ts_backend_state)"
    if [ "$backend" = "Running" ]; then
        ts_start_web_ui
        echo "Local web UI (tailscale web, this device only):"
        echo "  $TAILSCALE_WEB_UI_URL"
    else
        echo "Local web UI needs the daemon connected (state: $backend); not started."
        echo "Once connected, start it manually with: tailscale web --listen $TAILSCALE_WEB_UI_LISTEN"
    fi
    echo ""

    has_desktop="false"
    [ "${HAS_DESKTOP_ENVIRONMENT:-false}" = "true" ] && command -v xdg-open >/dev/null 2>&1 && has_desktop="true"
    if [ "$has_desktop" = "true" ]; then
        echo "Opening in the default browser..."
        ts_open_url "$TAILSCALE_ADMIN_CONSOLE_URL"
        [ "$backend" = "Running" ] && ts_open_url "$TAILSCALE_WEB_UI_URL"
    else
        echo "No desktop session detected; open the URL(s) above manually."
    fi

    echo ""
    echo "Other panels documented by Tailscale:"
    echo "  Local device web interface (Quad100, read-only, this device only): $TAILSCALE_LOCAL_WEB_URL"
    echo "  tailscale status --web --listen $TAILSCALE_STATUS_WEB_LISTEN   # local read-only HTML status page"
    echo "  sudo tailscale set --webclient                                # expose the web UI at <TailscaleIP>:5252"
}

# Map a Settings-menu setting name to its `tailscale set` flag name. Returns 1
# for an unknown name (caller reports the error). advertise-exit-node,
# exit-node, ssh, shields-up, accept-routes accept true/false (or an IP/name
# for exit-node; empty clears it); hostname/operator take a free-form value.
ts_setting_flag_for() {
    case "$1" in
        hostname) printf -- '--hostname' ;;
        accept-routes) printf -- '--accept-routes' ;;
        advertise-exit-node) printf -- '--advertise-exit-node' ;;
        exit-node) printf -- '--exit-node' ;;
        ssh) printf -- '--ssh' ;;
        shields-up) printf -- '--shields-up' ;;
        operator) printf -- '--operator' ;;
        *) return 1 ;;
    esac
}

# Current values of the settings above, read from `tailscale debug prefs`
# (ipn.Prefs JSON: Hostname, AcceptRoutes, AdvertiseRoutes, ExitNodeID/IP,
# RunSSH, ShieldsUp, OperatorUser -- https://pkg.go.dev/tailscale.com/ipn#Prefs).
# advertise-exit-node has no dedicated pref field; it is inferred from
# AdvertiseRoutes containing both default routes (0.0.0.0/0 and ::/0).
ts_show_settings() {
    echo "== Tailscale settings (tailscale set) =="
    if ! is_tailscale_installed; then
        echo "Tailscale is not installed."
        return 0
    fi
    if ! command -v python3 >/dev/null 2>&1; then
        echo "python3 not found; inspect prefs manually with: tailscale debug prefs"
        return 0
    fi
    local sudo_prefix=""
    sudo_prefix="$(ts_sudo_prefix)"
    ${sudo_prefix:+$sudo_prefix} tailscale debug prefs 2>/dev/null | python3 -c '
import sys, json

try:
    prefs = json.load(sys.stdin)
except Exception as exc:
    print("Could not parse tailscale debug prefs: %s" % exc)
    sys.exit(0)

routes = prefs.get("AdvertiseRoutes") or []
advertise_exit_node = ("0.0.0.0/0" in routes) and ("::/0" in routes)
exit_node = prefs.get("ExitNodeIP") or prefs.get("ExitNodeID") or ""

rows = [
    ("hostname", prefs.get("Hostname") or "(default)"),
    ("accept-routes", prefs.get("AcceptRoutes")),
    ("advertise-exit-node", advertise_exit_node),
    ("exit-node", exit_node or "(none)"),
    ("ssh", prefs.get("RunSSH")),
    ("shields-up", prefs.get("ShieldsUp")),
    ("operator", prefs.get("OperatorUser") or "(none -- CLI needs sudo)"),
]
for name, value in rows:
    print("  %-20s %s" % (name, value))
' 2>/dev/null || echo "Could not parse tailscale debug prefs output."
    echo ""
    echo "Settings: $TAILSCALE_SETTING_NAMES"
}

# Apply one setting via `tailscale set` (never `up --reset`: this function
# only ever calls `set`, and no caller in this library runs `up --reset`
# without the user explicitly confirming it first).
ts_apply_setting() {
    local name="$1" value="$2" flag="" sudo_prefix=""

    if ! is_tailscale_installed; then
        echo "Tailscale is not installed."
        return 1
    fi
    flag="$(ts_setting_flag_for "$name")" || { echo "Unknown setting: $name (expected one of: $TAILSCALE_SETTING_NAMES)"; return 1; }
    sudo_prefix="$(ts_sudo_prefix)"
    echo "\$ ${sudo_prefix:+$sudo_prefix }tailscale set ${flag}=${value}"
    if [ -n "$sudo_prefix" ]; then
        $sudo_prefix tailscale set "${flag}=${value}"
    else
        tailscale set "${flag}=${value}"
    fi
}

# Non-blocking `tailscale up`: runs it in the background and polls its output
# for the login URL (which normally prints while `up` blocks waiting for
# browser authorization) so the URL can be opened automatically, then waits
# for completion in the foreground -- Ctrl+C stops waiting without killing the
# connection attempt. No-op when already Running.
ts_login() {
    local sudo_prefix="" logfile="" up_pid="" login_url="" waited=0 rc=0

    if ! is_tailscale_installed; then
        echo "Tailscale is not installed."
        return 1
    fi
    if [ "$(ts_backend_state)" = "Running" ]; then
        echo "Already logged in and running (backend state: Running)."
        return 0
    fi

    sudo_prefix="$(ts_sudo_prefix)"
    logfile="$(mktemp /tmp/tailscale-up.XXXXXX.log)"
    echo "Connecting (tailscale up)..."
    if [ -n "$sudo_prefix" ]; then
        $sudo_prefix tailscale up >"$logfile" 2>&1 &
    else
        tailscale up >"$logfile" 2>&1 &
    fi
    up_pid=$!

    while kill -0 "$up_pid" 2>/dev/null && [ -z "$login_url" ] && [ "$waited" -lt 20 ]; do
        login_url="$(sed -n 's/.*\(https:\/\/login\.tailscale\.com\/[^ ]*\).*/\1/p' "$logfile" | head -n1)"
        [ -n "$login_url" ] || { sleep 1; waited=$((waited + 1)); }
    done
    if [ -n "$login_url" ]; then
        echo "Open this URL to authorize this machine:"
        echo "  $login_url"
        ts_open_url "$login_url"
    fi
    echo "Waiting for authorization to complete (Ctrl+C stops waiting here; the connection finishes in the background)..."
    wait "$up_pid"
    rc=$?
    cat "$logfile"
    rm -f "$logfile"
    if [ $rc -eq 0 ]; then
        echo "Login complete (backend state: $(ts_backend_state))."
    else
        echo "tailscale up exited with status $rc."
    fi
    return $rc
}

# `tailscale logout`: deauthenticates this node (distinct from `tailscale
# down`, which only disconnects). Confirmed like the installer's disable path
# (DD_AUTO_CONTINUE-aware, defaults to N on a non-interactive/timed-out read)
# since it requires re-authentication to reconnect.
ts_logout() {
    local sudo_prefix="" response=""

    if ! is_tailscale_installed; then
        echo "Tailscale is not installed."
        return 1
    fi
    echo -n "Log out and deauthenticate this node? (y/N) [N]: "
    if [ "${DD_AUTO_CONTINUE:-}" = "true" ] || [ "${DD_AUTO_CONTINUE:-}" = "1" ]; then
        response=""
    elif [ -t 0 ] && [ -r /dev/tty ]; then
        read -r -t 30 response < /dev/tty || response=""
    else
        response=""
    fi
    case "$response" in
        [yY]|[yY][eE][sS]) ;;
        *) echo "Logout cancelled."; return 0 ;;
    esac

    sudo_prefix="$(ts_sudo_prefix)"
    echo "\$ ${sudo_prefix:+$sudo_prefix }tailscale logout"
    if [ -n "$sudo_prefix" ]; then
        $sudo_prefix tailscale logout
    else
        tailscale logout
    fi
}

# Login/Logout toggle: picks the action from the current backend state so the
# menu can show a single context-sensitive item.
ts_login_logout_toggle() {
    if [ "$(ts_backend_state)" = "Running" ]; then
        ts_logout
    else
        ts_login
    fi
}

ts_show_help() {
    cat <<EOF
Tailscale management (Linux) - direct-call dispatcher usage:
  tailscale_common.sh status        Install/service/backend state, IPs, version
  tailscale_common.sh devices       List every tailnet device (table + detail)
  tailscale_common.sh all-ips       This machine's IPs/MagicDNS/LAN IPs + every peer's IPs
  tailscale_common.sh settings      Show current settings (tailscale debug prefs)
  tailscale_common.sh set <name> <value>   Apply one setting (tailscale set); names: $TAILSCALE_SETTING_NAMES
  tailscale_common.sh restart       sudo systemctl restart $TAILSCALE_SERVICE
  tailscale_common.sh ui            Print + open the admin console and local (tailscale web) UI
  tailscale_common.sh login         tailscale up (non-blocking login URL capture)
  tailscale_common.sh logout        tailscale logout (confirms first)
  tailscale_common.sh help          This message

Menu: dd.sh > Linux Management > Linux System Tools > [T] Tailscale.
Install/uninstall: scripts/shells/linux/debian/install_shells/97_install_tailscale.sh.

Official docs:
  CLI reference:        https://tailscale.com/docs/reference/tailscale-cli
  tailscaled service:   https://tailscale.com/kb/1278/tailscaled
  Device web interface: https://tailscale.com/docs/features/client/device-web-interface
  Admin console:        https://tailscale.com/docs/how-to/quickstart
  Linux install:        https://tailscale.com/kb/1031/install-linux
EOF
}

tailscale_common_main() {
    case "${1:-help}" in
        status) ts_show_status ;;
        devices) ts_show_devices ;;
        all-ips) ts_show_all_ips ;;
        settings) ts_show_settings ;;
        set) ts_apply_setting "$2" "$3" ;;
        restart) ts_restart_service ;;
        ui) ts_open_ui ;;
        login) ts_login ;;
        logout) ts_logout ;;
        help|--help|-h) ts_show_help ;;
        *)
            echo "Unknown action: ${1:-}"
            echo ""
            ts_show_help
            ;;
    esac
}

# Direct-call dispatcher: only fires when this file is executed, not sourced.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    tailscale_common_main "$@"
fi
