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
# Official docs consulted (verified 2026-09-27):
#   CLI reference:          https://tailscale.com/docs/reference/tailscale-cli
#   tailscaled service:     https://tailscale.com/kb/1278/tailscaled
#   Device web interface:   https://tailscale.com/kb/1325/device-web-interface
#   Quad100:                https://tailscale.com/kb/1381/what-is-quad100
#   Admin console:          https://tailscale.com/docs/how-to/quickstart
#   Linux install:          https://tailscale.com/kb/1031/install-linux
#   status --json fields:   https://pkg.go.dev/tailscale.com/ipn/ipnstate
#
# Public API:
#   is_tailscale_installed          - CLI present (command -v tailscale)
#   ts_service_unit_exists          - tailscaled.service known to systemd
#   ts_service_active_state         - systemctl is-active tailscaled (stdout)
#   ts_service_enabled_state        - systemctl is-enabled tailscaled (stdout)
#   ts_backend_state                - status --json .BackendState (stdout)
#   ts_show_status                  - human-readable install/service/IP summary
#   ts_show_devices                 - every tailnet device (table + detail)
#   ts_restart_service               - sudo systemctl restart tailscaled
#   ts_show_panel                   - print + best-effort open the admin/local panels
#   ts_show_help                    - dispatcher usage + doc links
#   tailscale_common_main "$@"      - dispatcher: status|devices|restart|panel|help
#
# Direct call: `bash tailscale_common.sh <status|devices|restart|panel|help>`.
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

# Best-effort `xdg-open` for one URL. Root sessions cannot reach a desktop
# user's browser (Chrome/Chromium refuse to run as root), so a root caller
# re-invokes it as the seated loginctl session owner; a non-root caller opens
# it directly. Silent no-op when there is no desktop/browser to open it with.
ts_open_url() {
    local url="$1" target_uid="" target_user=""

    command -v xdg-open >/dev/null 2>&1 || return 0
    if [ "$(id -u)" -ne 0 ]; then
        xdg-open "$url" >/dev/null 2>&1 &
        return 0
    fi
    target_uid="$(loginctl list-sessions --no-legend 2>/dev/null | awk '$4 != "" && $4 != "-" {print $2; exit}')"
    [ -n "$target_uid" ] || return 0
    target_user="$(id -un "$target_uid" 2>/dev/null)"
    [ -n "$target_user" ] || return 0
    sudo -u "$target_user" env \
        XDG_RUNTIME_DIR="/run/user/$target_uid" \
        DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$target_uid/bus" \
        DISPLAY="${DISPLAY:-:0}" \
        WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}" \
        xdg-open "$url" >/dev/null 2>&1 &
    return 0
}

# Print (and, on a desktop session, open) the two documented panels: the
# cloud admin console (every device in the tailnet) and the local device web
# interface (Quad100, this device only, tailscaled >= v1.56). The local UI is
# opened only once the backend is Running (the device-web-interface doc: "the
# daemon must be running and connected"), matching the Windows counterpart
# (Show-TailscalePanel's BackendState -eq Running gate).
ts_show_panel() {
    local backend=""

    echo "Tailnet admin console (all devices, cloud panel):"
    echo "  $TAILSCALE_ADMIN_CONSOLE_URL"
    echo ""
    echo "Local device web interface (this device only, Quad100 on port 80):"
    echo "  $TAILSCALE_LOCAL_WEB_URL"
    echo ""

    if [ "${HAS_DESKTOP_ENVIRONMENT:-false}" = "true" ] && command -v xdg-open >/dev/null 2>&1; then
        echo "Opening the admin console in the default browser..."
        ts_open_url "$TAILSCALE_ADMIN_CONSOLE_URL"
        backend="unknown"
        is_tailscale_installed && backend="$(ts_backend_state)"
        if [ "$backend" = "Running" ]; then
            echo "Opening the local device web interface in the default browser..."
            ts_open_url "$TAILSCALE_LOCAL_WEB_URL"
        else
            echo "Local device web interface needs the daemon connected (state: $backend); skipped. It serves $TAILSCALE_LOCAL_WEB_URL once Tailscale is Running (v1.56.0+)."
        fi
    else
        echo "No desktop session detected; open the URLs above manually."
    fi

    echo ""
    echo "Other panels documented by Tailscale:"
    echo "  tailscale status --web --listen $TAILSCALE_STATUS_WEB_LISTEN   # local read-only HTML status page"
    echo "  tailscale web --listen localhost:8088                         # foreground web UI (Ctrl+C to stop)"
    echo "  sudo tailscale set --webclient                                # expose the web UI at <TailscaleIP>:5252"
}

ts_show_help() {
    cat <<EOF
Tailscale management (Linux) - direct-call dispatcher usage:
  tailscale_common.sh status    Install/service/backend state, IPs, version
  tailscale_common.sh devices   List every tailnet device (table + detail)
  tailscale_common.sh restart   sudo systemctl restart $TAILSCALE_SERVICE
  tailscale_common.sh panel     Print + open the admin console and local (Quad100) panels
  tailscale_common.sh help      This message

Menu: dd.sh > Linux Management > Linux System Tools > Tailscale Management.
Install/uninstall: scripts/shells/linux/debian/install_shells/97_install_tailscale.sh.

Official docs:
  CLI reference:        https://tailscale.com/docs/reference/tailscale-cli
  tailscaled service:   https://tailscale.com/kb/1278/tailscaled
  Device web interface: https://tailscale.com/kb/1325/device-web-interface
  Admin console:        https://tailscale.com/docs/how-to/quickstart
  Linux install:        https://tailscale.com/kb/1031/install-linux
EOF
}

tailscale_common_main() {
    case "${1:-help}" in
        status) ts_show_status ;;
        devices) ts_show_devices ;;
        restart) ts_restart_service ;;
        panel) ts_show_panel ;;
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
