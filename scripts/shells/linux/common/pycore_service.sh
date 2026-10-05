#!/bin/bash

# ============================================================================
# pycore_service.sh - systemd helper for the Pycore Module Caller (Linux only)
# ============================================================================
#
# A self-contained helper that installs/manages a systemd unit running pycore
# headless (no UI, no prereq install) in the foreground. It REUSES the existing
# infrastructure:
#   - common/gvar_common.sh        -> detect_system_user(), USE_SUDO
#   - common/systemd_service_manager.sh -> create_systemd_service(),
#                                         remove_ncore_service(),
#                                         check_service_status()
#
# Both SOURCEABLE and RUNNABLE:
#   source pycore_service.sh                       # exposes pycore_service_* funcs
#   bash   pycore_service.sh <install|start|stop|restart|status|uninstall>
#
# The unit it creates:
#   [Service]
#   ExecStartPre=+/bin/bash <common>/pyservice_www_permissions.sh (as root)
#   ExecStart=[session env] /bin/bash <REPO_ROOT>/pyservice.sh run --no-ui --no-install
#   (backend hot reload on: dev_reload.py re-execs the worker on a saved .py)
# plus the root companion unit core-node-owner-guard (owner_guard_service.sh).
#   WorkingDirectory=<REPO_ROOT>
#   User=<real desktop user>
#   Restart=always
#   CPUWeight/IOWeight/MemoryMax (systemd_service_manager "interactive" profile)
# When the resolved user has an active desktop session, ExecStart is prefixed
# with XDG_RUNTIME_DIR/DBUS_SESSION_BUS_ADDRESS/DISPLAY/WAYLAND_DISPLAY (turned
# into Environment= lines) so the worker can export terminal text and show
# notifications. Service mode runs without a tray (PYCORE_NO_TRAY=1 is always
# added); headless installs get that env only.
#
# Service name (systemd unit): pycore
# ============================================================================

# --- Variable declarations (rule 5) -------------------------------------- #
PYCORE_SERVICE_DESC="Pycore Module Caller (headless)"
PYCORE_SVC_SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
# This file lives at scripts/shells/linux/common/, so repo root is 4 dirs up.
PYCORE_REPO_ROOT="$(cd "$PYCORE_SVC_SCRIPT_DIR/../../../.." && pwd)"
PYCORE_SVC_RUN_COMMAND="/bin/bash $PYCORE_REPO_ROOT/pyservice.sh run --no-ui --no-install"
PYCORE_SVC_EXEC_START="$PYCORE_SVC_RUN_COMMAND"
# Service mode never starts the tray; the desktop session env stays for terminal export and notifications.
PYCORE_SVC_NO_TRAY_ENV="PYCORE_NO_TRAY=1"
# "+" runs the idempotent data-root ownership repair as root although the unit
# runs as User=<desktop user>, so every (re)start hands root remnants back.
PYCORE_SVC_EXEC_START_PRE="+/bin/bash $PYCORE_SVC_SCRIPT_DIR/pyservice_www_permissions.sh"
# "+" also allows the RPC port in the firewall as root when rpcLanBind is on.
PYCORE_SVC_LAN_FIREWALL_SCRIPT="$PYCORE_SVC_SCRIPT_DIR/pyservice_lan_firewall.sh"
PYCORE_SVC_USER=""
PYCORE_DEBIAN_MGR="$PYCORE_SVC_SCRIPT_DIR/systemd_service_manager.sh"
PYCORE_GVAR_COMMON="$PYCORE_SVC_SCRIPT_DIR/gvar_common.sh"
# Root companion unit of the pyservice family: continuous root-owned handback.
PYCORE_OWNER_GUARD_SERVICE="$PYCORE_SVC_SCRIPT_DIR/owner_guard_service.sh"
PYCORE_RUNTIME_SERVICE_POLICY="$PYCORE_SVC_SCRIPT_DIR/runtime_service_policy.sh"

# --- Source reusable infrastructure -------------------------------------- #
# gvar_common.sh provides detect_system_user() and USE_SUDO. Source it only if
# not already present so a parent (dd.sh) that already sourced it is respected.
if ! type detect_system_user >/dev/null 2>&1; then
    if [ -f "$PYCORE_GVAR_COMMON" ]; then
        # shellcheck source=/dev/null
        source "$PYCORE_GVAR_COMMON"
    fi
fi

# systemd_service_manager.sh provides create_systemd_service / remove_ncore_service
# / check_service_status. It sources gvar_common.sh itself if needed.
if ! type create_systemd_service >/dev/null 2>&1; then
    if [ -f "$PYCORE_DEBIAN_MGR" ]; then
        # shellcheck source=/dev/null
        source "$PYCORE_DEBIAN_MGR"
    fi
fi

source "$PYCORE_RUNTIME_SERVICE_POLICY"
PYCORE_SERVICE_NAME="$CORE_RUNTIME_PYCORE_SERVICE"

# USE_SUDO may not be set if gvar_common.sh was unavailable; default it safely.
if [ -z "${USE_SUDO+x}" ]; then
    if command -v sudo >/dev/null 2>&1; then
        USE_SUDO="sudo"
    else
        USE_SUDO=""
    fi
fi

# --- Resolve the real (desktop) user the unit should run as -------------- #
pycore_resolve_user() {
    local resolved=""
    # Prefer the project's shared detector when available.
    if type detect_system_user >/dev/null 2>&1; then
        resolved="$(detect_system_user 2>/dev/null)"
    fi
    # Fall back to $SUDO_USER, then whoami.
    if [ -z "$resolved" ] || [ "$resolved" = "root" ]; then
        if [ -n "${SUDO_USER:-}" ] && [ "${SUDO_USER}" != "root" ]; then
            resolved="$SUDO_USER"
        fi
    fi
    if [ -z "$resolved" ]; then
        resolved="$(whoami 2>/dev/null || echo root)"
    fi
    PYCORE_SVC_USER="$resolved"
    echo "$resolved"
}

# --- Build ExecStart with desktop session env ---------------------------- #
# Terminal text export and desktop notifications need the desktop user's session
# (D-Bus session bus, display). A systemd unit gets NO session env, so
# when the resolved user has an active session, bake DISPLAY/WAYLAND_DISPLAY/
# XDG_RUNTIME_DIR/DBUS_SESSION_BUS_ADDRESS into the unit. create_systemd_service
# turns leading KEY=VALUE pairs of the exec command into Environment= lines.
pycore_build_exec_start() {
    local prefix=""
    prefix="$(systemd_desktop_session_env "$PYCORE_SVC_USER")"
    if [ -n "$prefix" ]; then
        echo "[pycore-service] Desktop session detected for '$PYCORE_SVC_USER'; unit gets session env (tray disabled in service mode)."
    fi
    prefix="$PYCORE_SVC_NO_TRAY_ENV${prefix:+ $prefix}"
    if [ "$PYCORE_SVC_USER" != "root" ]; then
        prefix="CORE_NODE_DATA_OWNER=$PYCORE_SVC_USER${prefix:+ $prefix}"
    fi
    PYCORE_SVC_EXEC_START="${prefix:+$prefix }$PYCORE_SVC_RUN_COMMAND"
    PYCORE_SVC_EXEC_START_PRE="$PYCORE_SVC_EXEC_START_PRE"$'
'"+/bin/bash $PYCORE_SVC_LAN_FIREWALL_SCRIPT $PYCORE_SVC_USER"
}

# --- Print the unit we would create (verifiable on non-systemd boxes) ----- #
pycore_print_unit() {
    pycore_resolve_user >/dev/null
    pycore_build_exec_start
    echo "------------------------------------------------------------"
    echo "[pycore-service] systemd unit to be created: ${PYCORE_SERVICE_NAME}.service"
    echo "------------------------------------------------------------"
    echo "[Unit]"
    echo "Description=$PYCORE_SERVICE_DESC"
    echo "After=network.target"
    echo ""
    echo "[Service]"
    echo "Type=simple"
    echo "User=$PYCORE_SVC_USER"
    echo "WorkingDirectory=$PYCORE_REPO_ROOT"
    printf 'ExecStartPre=%s
' "${PYCORE_SVC_EXEC_START_PRE%%$'
'*}" "${PYCORE_SVC_EXEC_START_PRE#*$'
'}"
    echo "ExecStart=$PYCORE_SVC_EXEC_START"
    echo "Restart=always"
    systemd_interactive_resource_lines
    echo "------------------------------------------------------------"
}

# --- install: create + enable + start ------------------------------------ #
pycore_service_install() {
    pycore_resolve_user >/dev/null
    pycore_build_exec_start
    # Permission foundation first, on every host (headless too): the owner guard
    # hands everything root creates back to the real user from now on.
    bash "$PYCORE_OWNER_GUARD_SERVICE" install
    if [ "$IS_HEADLESS_SERVER" = true ]; then
        echo "[pycore-service] Headless server detected; pycore must remain stopped."
        runtime_service_policy_converge_pycore
    else
        echo "[pycore-service] Installing systemd service '$PYCORE_SERVICE_NAME' ..."
        pycore_print_unit

        if ! command -v systemctl >/dev/null 2>&1; then
            echo "[pycore-service] systemctl not found; cannot install a systemd service here."
            echo "[pycore-service] (This is expected on non-Linux/non-systemd hosts.)"
        elif type create_systemd_service >/dev/null 2>&1; then
            create_systemd_service \
                "$PYCORE_SERVICE_NAME" \
                "$PYCORE_SERVICE_DESC" \
                "$PYCORE_SVC_EXEC_START" \
                "$PYCORE_REPO_ROOT" \
                "$PYCORE_SVC_USER" \
                "always" "10s" "" "" "" "" "yes" "" "" "" "no" \
                "$SYSTEMD_RESOURCE_PROFILE_INTERACTIVE" \
                "$PYCORE_SVC_EXEC_START_PRE"
            echo "[pycore-service] Enabling and starting '$PYCORE_SERVICE_NAME' ..."
            $USE_SUDO systemctl enable "$PYCORE_SERVICE_NAME" 2>/dev/null || true
            $USE_SUDO systemctl start "$PYCORE_SERVICE_NAME"
            pycore_service_status
        else
            echo "[pycore-service] create_systemd_service unavailable; cannot create unit." >&2
        fi
    fi
}

# --- start / stop / restart ---------------------------------------------- #
pycore_service_start() {
    if [ "$IS_HEADLESS_SERVER" = true ]; then
        echo "[pycore-service] Headless server detected; keeping pycore stopped."
        runtime_service_policy_converge_pycore
    else
        echo "[pycore-service] Starting '$PYCORE_SERVICE_NAME' ..."
        if command -v systemctl >/dev/null 2>&1; then
            $USE_SUDO systemctl start "$PYCORE_SERVICE_NAME"
            pycore_service_status
        else
            echo "[pycore-service] systemctl not found; nothing to start here."
        fi
    fi
}

pycore_service_stop() {
    echo "[pycore-service] Stopping '$PYCORE_SERVICE_NAME' ..."
    if ! command -v systemctl >/dev/null 2>&1; then
        echo "[pycore-service] systemctl not found; nothing to stop here."
        return 1
    fi
    $USE_SUDO systemctl stop "$PYCORE_SERVICE_NAME"
    echo "[pycore-service] Stopped."
}

pycore_service_restart() {
    if [ "$IS_HEADLESS_SERVER" = true ]; then
        echo "[pycore-service] Headless server detected; keeping pycore stopped."
        runtime_service_policy_converge_pycore
    else
        echo "[pycore-service] Restarting '$PYCORE_SERVICE_NAME' ..."
        if command -v systemctl >/dev/null 2>&1; then
            $USE_SUDO systemctl restart "$PYCORE_SERVICE_NAME"
            pycore_service_status
        else
            echo "[pycore-service] systemctl not found; nothing to restart here."
        fi
    fi
}

# --- status -------------------------------------------------------------- #
pycore_service_status() {
    if ! command -v systemctl >/dev/null 2>&1; then
        echo "[pycore-service] systemctl not found; cannot report status here."
        return 1
    fi
    # Prefer the shared helper, but it adds an 'ncore-' prefix, so call systemctl
    # directly for the bare 'pycore' unit name.
    echo "[pycore-service] Status of '$PYCORE_SERVICE_NAME':"
    $USE_SUDO systemctl status "$PYCORE_SERVICE_NAME" --no-pager || true
    bash "$PYCORE_OWNER_GUARD_SERVICE" status
}

# --- uninstall: disable + remove unit, then stop -------------------------- #
# The tray toggle runs this from inside the pycore unit, whose cgroup the stop
# kills: disable, rm and daemon-reload come first, and the stop is queued
# (--no-block) last, so the unit is gone from boot even if this script dies.
pycore_service_uninstall() {
    local unit_file="/etc/systemd/system/${PYCORE_SERVICE_NAME}.service"

    echo "[pycore-service] Uninstalling systemd service '$PYCORE_SERVICE_NAME' ..."
    if ! command -v systemctl >/dev/null 2>&1; then
        echo "[pycore-service] systemctl not found; nothing to uninstall here."
        return 1
    fi
    $USE_SUDO systemctl disable "$PYCORE_SERVICE_NAME" 2>/dev/null || true
    if [ -f "$unit_file" ]; then
        $USE_SUDO rm -f "$unit_file"
        echo "[pycore-service] Removed $unit_file"
    fi
    $USE_SUDO systemctl daemon-reload 2>/dev/null || true
    echo "[pycore-service] Uninstalled; stopping the running unit."
    $USE_SUDO systemctl stop --no-block "$PYCORE_SERVICE_NAME" 2>/dev/null || true
}

# --- usage --------------------------------------------------------------- #
pycore_service_usage() {
    cat <<EOF
pycore_service.sh - manage the pycore systemd service (Linux only)

Usage: bash pycore_service.sh <command>

Commands:
  install     Create, enable and start the '${PYCORE_SERVICE_NAME}' systemd service
  start       Start the service
  stop        Stop the service
  restart     Restart the service
  status      Show the service status
  uninstall   Stop, disable and remove the service unit
  help        Show this help

Unit ExecStart: $PYCORE_SVC_EXEC_START
Working dir   : $PYCORE_REPO_ROOT
EOF
}

# --- CLI dispatch (guarded: only runs when executed directly) ------------ #
pycore_service_dispatch() {
    local cmd="${1:-help}"
    shift || true
    case "$cmd" in
        install)   pycore_service_install   "$@" ;;
        start)     pycore_service_start     "$@" ;;
        stop)      pycore_service_stop      "$@" ;;
        restart)   pycore_service_restart   "$@" ;;
        status)    pycore_service_status    "$@" ;;
        uninstall) pycore_service_uninstall "$@" ;;
        help|--help|-h) pycore_service_usage ;;
        *)
            echo "[pycore-service] Unknown command: $cmd" >&2
            pycore_service_usage
            return 1
            ;;
    esac
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    pycore_service_dispatch "$@"
fi
