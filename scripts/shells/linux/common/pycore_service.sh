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
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

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
#   ExecStart=/bin/bash <REPO_ROOT>/pyservice.sh run --no-ui --no-install --no-reload
#   WorkingDirectory=<REPO_ROOT>
#   User=<real desktop user>
#   Restart=always
#
# Service name (systemd unit): pycore
# ============================================================================

# --- Variable declarations (rule 5) -------------------------------------- #
PYCORE_SERVICE_NAME="pycore"
PYCORE_SERVICE_DESC="Pycore Module Caller (headless)"
PYCORE_SVC_SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
# This file lives at scripts/shells/linux/common/, so repo root is 4 dirs up.
PYCORE_REPO_ROOT="$(cd "$PYCORE_SVC_SCRIPT_DIR/../../../.." && pwd)"
PYCORE_SVC_EXEC_START="/bin/bash $PYCORE_REPO_ROOT/pyservice.sh run --no-ui --no-install --no-reload"
PYCORE_SVC_USER=""
PYCORE_DEBIAN_MGR="$PYCORE_SVC_SCRIPT_DIR/systemd_service_manager.sh"
PYCORE_GVAR_COMMON="$PYCORE_SVC_SCRIPT_DIR/gvar_common.sh"

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

# --- Print the unit we would create (verifiable on non-systemd boxes) ----- #
pycore_print_unit() {
    pycore_resolve_user >/dev/null
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
    echo "ExecStart=$PYCORE_SVC_EXEC_START"
    echo "Restart=always"
    echo "------------------------------------------------------------"
}

# --- install: create + enable + start ------------------------------------ #
pycore_service_install() {
    pycore_resolve_user >/dev/null
    echo "[pycore-service] Installing systemd service '$PYCORE_SERVICE_NAME' ..."
    pycore_print_unit

    if ! command -v systemctl >/dev/null 2>&1; then
        echo "[pycore-service] systemctl not found; cannot install a systemd service here."
        echo "[pycore-service] (This is expected on non-Linux/non-systemd hosts.)"
        return 1
    fi

    if type create_systemd_service >/dev/null 2>&1; then
        # create_systemd_service(name, description, exec_command, working_dir, user, [restart])
        create_systemd_service \
            "$PYCORE_SERVICE_NAME" \
            "$PYCORE_SERVICE_DESC" \
            "$PYCORE_SVC_EXEC_START" \
            "$PYCORE_REPO_ROOT" \
            "$PYCORE_SVC_USER" \
            "always"
    else
        echo "[pycore-service] create_systemd_service unavailable; cannot create unit." >&2
        return 1
    fi

    echo "[pycore-service] Enabling and starting '$PYCORE_SERVICE_NAME' ..."
    $USE_SUDO systemctl enable "$PYCORE_SERVICE_NAME" 2>/dev/null || true
    $USE_SUDO systemctl start "$PYCORE_SERVICE_NAME"
    pycore_service_status
}

# --- start / stop / restart ---------------------------------------------- #
pycore_service_start() {
    echo "[pycore-service] Starting '$PYCORE_SERVICE_NAME' ..."
    if ! command -v systemctl >/dev/null 2>&1; then
        echo "[pycore-service] systemctl not found; nothing to start here."
        return 1
    fi
    $USE_SUDO systemctl start "$PYCORE_SERVICE_NAME"
    pycore_service_status
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
    echo "[pycore-service] Restarting '$PYCORE_SERVICE_NAME' ..."
    if ! command -v systemctl >/dev/null 2>&1; then
        echo "[pycore-service] systemctl not found; nothing to restart here."
        return 1
    fi
    $USE_SUDO systemctl restart "$PYCORE_SERVICE_NAME"
    pycore_service_status
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
}

# --- uninstall: stop + disable + remove unit ----------------------------- #
pycore_service_uninstall() {
    echo "[pycore-service] Uninstalling systemd service '$PYCORE_SERVICE_NAME' ..."
    if ! command -v systemctl >/dev/null 2>&1; then
        echo "[pycore-service] systemctl not found; nothing to uninstall here."
        return 1
    fi
    $USE_SUDO systemctl stop "$PYCORE_SERVICE_NAME" 2>/dev/null || true
    $USE_SUDO systemctl disable "$PYCORE_SERVICE_NAME" 2>/dev/null || true
    local unit_file="/etc/systemd/system/${PYCORE_SERVICE_NAME}.service"
    if [ -f "$unit_file" ]; then
        $USE_SUDO rm -f "$unit_file"
        echo "[pycore-service] Removed $unit_file"
    fi
    $USE_SUDO systemctl daemon-reload 2>/dev/null || true
    echo "[pycore-service] Uninstalled."
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
