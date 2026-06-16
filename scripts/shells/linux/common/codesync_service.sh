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
# codesync_service.sh - systemd helper for the standalone Code Sync daemon
#                       (Linux only).
# ============================================================================
#
# Installs/manages a systemd unit that runs the lightweight, stdlib-only Code
# Sync daemon (no UI, no pycore, no prerequisite install) in the foreground. It
# REUSES the existing infrastructure, exactly like pycore_service.sh:
#   - common/gvar_common.sh            -> detect_system_user(), USE_SUDO
#   - common/debian_service_manager.sh -> create_systemd_service()
#
# Both SOURCEABLE and RUNNABLE:
#   source codesync_service.sh                       # exposes codesync_service_* funcs
#   bash   codesync_service.sh <install|start|stop|restart|status|uninstall>
#
# `install --prompt` asks before installing (default YES), then installs, starts,
# and prints how to follow the logs. This is what `pyservice.sh codesync`
# (no subcommand) calls.
#
# The unit it creates:
#   [Service]
#   ExecStart=/bin/bash <REPO_ROOT>/pyservice.sh codesync run
#   WorkingDirectory=<REPO_ROOT>
#   User=<real desktop user>
#   Restart=always
#
# Service name (systemd unit): codesync
# ============================================================================

# --- Variable declarations (rule 5) -------------------------------------- #
CODESYNC_SERVICE_NAME="codesync"
CODESYNC_SERVICE_DESC="Code Sync (headless, stdlib-only)"
CODESYNC_SVC_SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
# This file lives at scripts/shells/linux/common/, so repo root is 4 dirs up.
CODESYNC_REPO_ROOT="$(cd "$CODESYNC_SVC_SCRIPT_DIR/../../../.." && pwd)"
CODESYNC_SVC_EXEC_START="/bin/bash $CODESYNC_REPO_ROOT/pyservice.sh codesync run"
CODESYNC_SVC_USER=""
CODESYNC_DEBIAN_MGR="$CODESYNC_SVC_SCRIPT_DIR/debian_service_manager.sh"
CODESYNC_GVAR_COMMON="$CODESYNC_SVC_SCRIPT_DIR/gvar_common.sh"

# --- Source reusable infrastructure -------------------------------------- #
if ! type detect_system_user >/dev/null 2>&1; then
    if [ -f "$CODESYNC_GVAR_COMMON" ]; then
        # shellcheck source=/dev/null
        source "$CODESYNC_GVAR_COMMON"
    fi
fi

if ! type create_systemd_service >/dev/null 2>&1; then
    if [ -f "$CODESYNC_DEBIAN_MGR" ]; then
        # shellcheck source=/dev/null
        source "$CODESYNC_DEBIAN_MGR"
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
codesync_resolve_user() {
    local resolved=""
    if type detect_system_user >/dev/null 2>&1; then
        resolved="$(detect_system_user 2>/dev/null)"
    fi
    if [ -z "$resolved" ] || [ "$resolved" = "root" ]; then
        if [ -n "${SUDO_USER:-}" ] && [ "${SUDO_USER}" != "root" ]; then
            resolved="$SUDO_USER"
        fi
    fi
    if [ -z "$resolved" ]; then
        resolved="$(whoami 2>/dev/null || echo root)"
    fi
    CODESYNC_SVC_USER="$resolved"
    echo "$resolved"
}

# --- Default-YES confirmation prompt ------------------------------------- #
codesync_prompt_yes() {
    local msg="$1" reply=""
    # Non-interactive override: CODESYNC_SERVICE_ASSUME_YES=1 -> yes without asking.
    case "${CODESYNC_SERVICE_ASSUME_YES:-}" in [Yy1]*) return 0 ;; esac
    if [ -t 0 ] && [ -r /dev/tty ]; then
        printf '%s [Y/n] ' "$msg" > /dev/tty
        read -r reply < /dev/tty || reply=""
    fi
    case "$reply" in
        [Nn]*) return 1 ;;
        *)     return 0 ;;   # default = YES (empty input included)
    esac
}

# --- Print how to view the service logs ---------------------------------- #
codesync_print_logs_help() {
    echo "------------------------------------------------------------"
    echo "[codesync-service] View the Code Sync logs:"
    echo "    journalctl -u ${CODESYNC_SERVICE_NAME} -f                 # live follow"
    echo "    journalctl -u ${CODESYNC_SERVICE_NAME} -n 200 --no-pager  # last 200 lines"
    echo "    systemctl status ${CODESYNC_SERVICE_NAME} --no-pager      # current status"
    echo "[codesync-service] File-sync activity logs also go to:"
    echo "    ~/.core_node/data/code_sync_logs/"
    echo "------------------------------------------------------------"
}

# --- Print the unit we would create (verifiable on non-systemd boxes) ----- #
codesync_print_unit() {
    codesync_resolve_user >/dev/null
    echo "------------------------------------------------------------"
    echo "[codesync-service] systemd unit to be created: ${CODESYNC_SERVICE_NAME}.service"
    echo "------------------------------------------------------------"
    echo "[Unit]"
    echo "Description=$CODESYNC_SERVICE_DESC"
    echo "After=network.target"
    echo ""
    echo "[Service]"
    echo "Type=simple"
    echo "User=$CODESYNC_SVC_USER"
    echo "WorkingDirectory=$CODESYNC_REPO_ROOT"
    echo "ExecStart=$CODESYNC_SVC_EXEC_START"
    echo "Restart=always"
    echo "------------------------------------------------------------"
}

# --- install: (optional prompt) create + enable + start + log help ------- #
codesync_service_install() {
    local do_prompt=0
    if [ "${1:-}" = "--prompt" ]; then
        do_prompt=1
        shift || true
    fi

    if [ "$do_prompt" -eq 1 ]; then
        if ! codesync_prompt_yes "[codesync-service] Add Code Sync to the system service (systemd) and start it now?"; then
            echo "[codesync-service] Not installed. Run it in the foreground anytime with:"
            echo "    bash $CODESYNC_REPO_ROOT/pyservice.sh codesync run"
            echo "[codesync-service] Or install the system service later with:"
            echo "    bash $CODESYNC_REPO_ROOT/pyservice.sh codesync install"
            return 0
        fi
    fi

    codesync_resolve_user >/dev/null
    echo "[codesync-service] Installing systemd service '$CODESYNC_SERVICE_NAME' ..."
    codesync_print_unit

    if ! command -v systemctl >/dev/null 2>&1; then
        echo "[codesync-service] systemctl not found; cannot install a systemd service here."
        echo "[codesync-service] (Expected on non-Linux/non-systemd hosts, e.g. Git-Bash/WSL-without-systemd.)"
        echo "[codesync-service] Run it in the foreground instead:"
        echo "    bash $CODESYNC_REPO_ROOT/pyservice.sh codesync run"
        return 1
    fi

    if type create_systemd_service >/dev/null 2>&1; then
        # create_systemd_service(name, description, exec_command, working_dir, user, [restart])
        create_systemd_service \
            "$CODESYNC_SERVICE_NAME" \
            "$CODESYNC_SERVICE_DESC" \
            "$CODESYNC_SVC_EXEC_START" \
            "$CODESYNC_REPO_ROOT" \
            "$CODESYNC_SVC_USER" \
            "always"
    else
        echo "[codesync-service] create_systemd_service unavailable; cannot create unit." >&2
        return 1
    fi

    echo "[codesync-service] Enabling and starting '$CODESYNC_SERVICE_NAME' ..."
    $USE_SUDO systemctl enable "$CODESYNC_SERVICE_NAME" 2>/dev/null || true
    $USE_SUDO systemctl start "$CODESYNC_SERVICE_NAME"
    codesync_service_status
    codesync_print_logs_help
}

# --- run-prompt: offer to install as a service, else fall back to foreground -#
# Used by `pyservice.sh codesync run`. Exit codes:
#   0  -> installed + started as a systemd service (caller should exit)
#   10 -> run the daemon in the FOREGROUND instead (caller runs it)
#   other -> install error (caller should exit with it)
# When there is no controlling TTY (e.g. the daemon was started BY the systemd
# unit, whose ExecStart is `pyservice.sh codesync run`), the prompt is SKIPPED and
# 10 is returned, so the unit runs the foreground daemon and never re-installs.
codesync_service_run_prompt() {
    if [ ! -t 0 ] || [ ! -r /dev/tty ]; then
        return 10
    fi
    if [ -n "${CODESYNC_NO_SERVICE_PROMPT:-}" ]; then
        return 10
    fi
    if ! command -v systemctl >/dev/null 2>&1; then
        echo "[codesync-service] systemd not available here; running in the foreground."
        return 10
    fi
    if codesync_prompt_yes "[codesync-service] Add Code Sync to the system service (systemd) and run it in the background?"; then
        codesync_service_install
        return $?
    fi
    echo "[codesync-service] Running Code Sync in the foreground (Ctrl-C to stop)."
    return 10
}

# --- start / stop / restart ---------------------------------------------- #
codesync_service_start() {
    echo "[codesync-service] Starting '$CODESYNC_SERVICE_NAME' ..."
    if ! command -v systemctl >/dev/null 2>&1; then
        echo "[codesync-service] systemctl not found; nothing to start here."
        return 1
    fi
    $USE_SUDO systemctl start "$CODESYNC_SERVICE_NAME"
    codesync_service_status
}

codesync_service_stop() {
    echo "[codesync-service] Stopping '$CODESYNC_SERVICE_NAME' ..."
    if ! command -v systemctl >/dev/null 2>&1; then
        echo "[codesync-service] systemctl not found; nothing to stop here."
        return 1
    fi
    $USE_SUDO systemctl stop "$CODESYNC_SERVICE_NAME"
    echo "[codesync-service] Stopped."
}

codesync_service_restart() {
    echo "[codesync-service] Restarting '$CODESYNC_SERVICE_NAME' ..."
    if ! command -v systemctl >/dev/null 2>&1; then
        echo "[codesync-service] systemctl not found; nothing to restart here."
        return 1
    fi
    $USE_SUDO systemctl restart "$CODESYNC_SERVICE_NAME"
    codesync_service_status
}

# --- status -------------------------------------------------------------- #
codesync_service_status() {
    if ! command -v systemctl >/dev/null 2>&1; then
        echo "[codesync-service] systemctl not found; cannot report status here."
        return 1
    fi
    echo "[codesync-service] Status of '$CODESYNC_SERVICE_NAME':"
    $USE_SUDO systemctl status "$CODESYNC_SERVICE_NAME" --no-pager || true
}

# --- uninstall: stop + disable + remove unit ----------------------------- #
codesync_service_uninstall() {
    echo "[codesync-service] Uninstalling systemd service '$CODESYNC_SERVICE_NAME' ..."
    if ! command -v systemctl >/dev/null 2>&1; then
        echo "[codesync-service] systemctl not found; nothing to uninstall here."
        return 1
    fi
    $USE_SUDO systemctl stop "$CODESYNC_SERVICE_NAME" 2>/dev/null || true
    $USE_SUDO systemctl disable "$CODESYNC_SERVICE_NAME" 2>/dev/null || true
    local unit_file="/etc/systemd/system/${CODESYNC_SERVICE_NAME}.service"
    if [ -f "$unit_file" ]; then
        $USE_SUDO rm -f "$unit_file"
        echo "[codesync-service] Removed $unit_file"
    fi
    $USE_SUDO systemctl daemon-reload 2>/dev/null || true
    echo "[codesync-service] Uninstalled."
}

# --- usage --------------------------------------------------------------- #
codesync_service_usage() {
    cat <<EOF
codesync_service.sh - manage the Code Sync systemd service (Linux only)

Usage: bash codesync_service.sh <command>

Commands:
  install [--prompt]  Create, enable and start the '${CODESYNC_SERVICE_NAME}' service
                      (--prompt asks first, default YES)
  start               Start the service
  stop                Stop the service
  restart             Restart the service
  status              Show the service status
  uninstall           Stop, disable and remove the service unit
  help                Show this help

Unit ExecStart: $CODESYNC_SVC_EXEC_START
Working dir   : $CODESYNC_REPO_ROOT
EOF
}

# --- CLI dispatch (guarded: only runs when executed directly) ------------ #
codesync_service_dispatch() {
    local cmd="${1:-help}"
    shift || true
    case "$cmd" in
        install)     codesync_service_install     "$@" ;;
        run-prompt)  codesync_service_run_prompt  "$@" ;;
        start)       codesync_service_start       "$@" ;;
        stop)      codesync_service_stop      "$@" ;;
        restart)   codesync_service_restart   "$@" ;;
        status)    codesync_service_status    "$@" ;;
        uninstall) codesync_service_uninstall "$@" ;;
        help|--help|-h) codesync_service_usage ;;
        *)
            echo "[codesync-service] Unknown command: $cmd" >&2
            codesync_service_usage
            return 1
            ;;
    esac
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    codesync_service_dispatch "$@"
fi
