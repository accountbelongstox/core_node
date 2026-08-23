#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# pyservice.sh - Service entry point for the Pycore Module Caller
#                (Linux / macOS / Git-Bash / WSL).
#
# This is ONLY an entry point. It:
#   1. PREREQUISITES: runs scripts/shells/win/main_powershells/PreparePycorePrerequisites.ps1 (Windows)
#      or scripts/shells/linux/common/prepare_pycore_prerequisites.sh (Linux),
#      the heavy third-party packages that are more convenient to set up from a
#      shell (e.g. whisper). This complements pycore/pyfoundations/third_party.py
#      (which fast-detects/installs lighter packages at import time). Skip with
#      --no-install.
#   2. LAUNCH: starts pycore/pycore_module_caller.py (the worker, which lives
#      inside the pycore package, not at the repo root).
#
# Both the prerequisite script and the worker are invoked through paths RELATIVE
# to this script, so the repo can live anywhere.
#
# NOTE: /pycore-manager/queue-center is served BY pycore (proxying laravel_main's
# /assist/overview), never a direct web connection -- keep it and laravel_main's
# /laravel-manager#/task-center aligned when either side's task categories change.
#
# Usage:
#   ./pyservice.sh 1                     # current local UI mode (default)
#   ./pyservice.sh 2                     # Relay UI intermediary mode
#   ./pyservice.sh 1 --no-install        # skip prereqs, just launch
#   ./pyservice.sh --port 8000 --debug   # launch on port 8000 in debug mode
#   ./pyservice.sh --no-reload           # disable backend hot-reload (.py -> restart)
#   ./pyservice.sh --only -- --whisper-model base   # only run prereqs (args after
#                                                     # `--` go to prepare.sh)
#
# Subcommands: run (default) | config | install | start | stop | restart |
#   status | uninstall | help.  The service subcommands are Linux/systemd only.
#
# ---------------------------------------------------------------------------
# Headless config CLI:  pyservice.sh config ...  -> python -m pycore.pyctl.pyservice_cli
# ---------------------------------------------------------------------------
# HTTP-first, file-fallback: while the service is running, edits go through its
# HTTP API and apply live (and broadcast to any open UI); while it is stopped,
# persistent settings are written straight to their files and take effect on the
# next start. Runtime-only toggles (distribute, skip-update) require the running
# service. This is the headless equivalent of the Settings UI + Code Sync page.
#
#   # System settings (theme, lang, accent, blur, ...)
#   pyservice.sh config system get
#   pyservice.sh config system get --key theme
#   pyservice.sh config system set --key theme --value light
#   pyservice.sh config system set --json '{"theme":"dark","lang":"zh"}'
#
#   # Code sync - role / peers (persistent; work offline)
#   pyservice.sh config codesync show
#   pyservice.sh config codesync role [dev]      # print, or set this device's role
#   pyservice.sh config codesync peers list
#   pyservice.sh config codesync peers add --name lab --host 192.168.1.10 --role dev
#   pyservice.sh config codesync peers remove --id 192.168.1.10:59000
#
#   # Code sync - runtime toggles (need the running service)
#   pyservice.sh config codesync distribute on   # dev only: start pushing code
#   pyservice.sh config codesync skip-update on   # client: temporarily reject code
#   pyservice.sh config codesync show --port 59000   # target a non-default port
#
# Config storage:
#   - System settings      : ~/.core_node/config/user_data.json  (system_settings section)
#   - Code-sync role/peers  : pycore/pyutils/codesync/code_sync_peers.json  (committed)
#
# ---------------------------------------------------------------------------
# systemd service (Linux):  sudo ./pyservice.sh install|start|stop|restart|status|uninstall
# ---------------------------------------------------------------------------
# `install` delegates to scripts/shells/linux/common/pycore_service.sh (part of
# the dd.sh call chain; reuses debian_service_manager.sh). The unit runs headless:
#   ExecStart=/bin/bash <repo>/pyservice.sh run --no-ui --no-install --no-reload
#   WorkingDirectory=<repo>   User=<real user>   Restart=always
# On Windows there is no systemd: use the desktop UI's Settings -> Auto-start on
# boot toggle (a native .lnk in the common Startup folder). `config` is cross-platform.
#
# ---------------------------------------------------------------------------
# UI vs headless
# ---------------------------------------------------------------------------
# Desktop / with Node: `run` serves the unified shell poly_apps/pycore_laravel_wordnew_ui
# (its pycore-manager end) at http://localhost:<UI_PORT>/pycore-manager, loaded by
# PySide6 via PYCORE_UI_URL. Backend controllers and replayable events use HTTP
# on :59000. A global floating collapsible log panel is present on every pycore
# page. The old standalone React
# app pycore/pyctl/desktop/desktop-manager (dev server :15654) was superseded by the
# unified shell (poly_apps/pycore_laravel_wordnew_ui) and has been removed.
# Headless Linux (no Node / no display): only the legacy in-process /web/subtitle
# page is served and no Qt window/tray is created (those are Windows-only), so the
# worker is effectively an RPC server - configure it with `pyservice config ...`.
# ---------------------------------------------------------------------------
set -uo pipefail
export PYCORE_HTTP_EVENTS_ENABLED=1

# Resolve this script's directory (repo root), following symlinks.
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
PY_SERVICE_COMMAND="${1:-}"
RUNTIME_ENVIRONMENT_SCRIPT="$SCRIPT_DIR/scripts/shells/linux/common/runtime_environment.sh"

source "$RUNTIME_ENVIRONMENT_SCRIPT"

# Shared Python runtime env (user-base + PIP flags) is exported AFTER resolve_python picks
# the interpreter, because the policy is VENV-AWARE (single source of truth:
# pycore_export_python_env_from_common in venv_python_common.sh, also used by prepare.sh):
# a venv targets itself (PIP_USER=0, NO PYTHONUSERBASE); only a non-venv system python uses
# the all-users shared base /opt/_core_node/pyuserbase. The OLD code exported PYTHONUSERBASE
# UNCONDITIONALLY here, which redirected the venv's user-site to an empty dir and made the
# worker import a stale /usr/local torch -> ~5GB reinstall every launch. Source the helper
# now (lightweight, no gvar dependency); call it once $PY is resolved.
# shellcheck source=/dev/null
if [[ "$PY_SERVICE_COMMAND" != "codesync" ]]; then
    source "$SCRIPT_DIR/scripts/shells/linux/common/venv_python_common.sh"
fi

# Wire the ONE shared, all-users cache location (CORE_NODE_CACHE_DIR + HF_HOME /
# TORCH_HOME / PIP_CACHE_DIR / XDG_CACHE_HOME ...) for the running service so every
# model download lands in /var/_core_node/cache, shared across all users.
if [[ "$PY_SERVICE_COMMAND" != "codesync" ]]; then
    source "$SCRIPT_DIR/scripts/shells/linux/common/shared_cache_env.sh"
fi

BIND_HOST="0.0.0.0"
PORT="59000"
RPC_PORT="59000"
DEBUG=0
RELOAD=1
NO_INSTALL=0
ONLY=0
NO_UI=0
SERVICE_MODE="1"
UI_MODE="dashboard (pycore-manager)"
UI_BUILD=0
UI_PORT="13054"
PREPARE_ARGS=()
UI_DIR="$SCRIPT_DIR/poly_apps/pycore_laravel_wordnew_ui"
UI_START="$SCRIPT_DIR/poly_apps/pycore_laravel_wordnew_ui/scripts/start.sh"
UI_PID=""
UI_READY=0
UI_START_ARGS=()
ORIGINAL_ARGS=("$@")

# --- locate a Python 3 interpreter --------------------------------------- #
# Defined early so subcommands (config) can reuse it before the run path.
resolve_python() {
    # Prefer the project venv built by 13_ensure_python.sh ($COMPILE_DIR/python3_venv):
    # venv_python_common.sh calls it "THE project interpreter", and it is created
    # --system-site-packages (a SUPERSET of the system python). The worker AND the
    # prerequisites must use it - otherwise packages installed INTO the venv (22/96 and the
    # dd.sh numbered sweep) are invisible to a service running under /usr/bin/python3.
    # Resolve it in an ISOLATED subshell with strict mode OFF so sourcing the heavy
    # gvar/venv libs can never abort this `set -euo` entry point. Fall back to the system
    # python3 only when the venv is not built.
    local venv_py="" name
    venv_py="$(
        set +euo pipefail
        source "$SCRIPT_DIR/scripts/shells/linux/common/gvar_common.sh" >/dev/null 2>&1
        source "$SCRIPT_DIR/scripts/shells/linux/common/venv_python_common.sh" >/dev/null 2>&1
        [ -n "${VENV_PYTHON3:-}" ] && [ -x "$VENV_PYTHON3" ] && printf '%s' "$VENV_PYTHON3"
    )" || true
    if [[ -n "$venv_py" && -x "$venv_py" ]]; then
        echo "$venv_py"
        return 0
    fi
    for name in python3 python; do
        if command -v "$name" >/dev/null 2>&1; then
            if "$name" -c 'import sys; sys.exit(0 if sys.version_info[0]==3 else 1)' >/dev/null 2>&1; then
                command -v "$name"
                return 0
            fi
        fi
    done
    return 1
}

# CodeSync is a standalone stdlib daemon. Do not source gvar_common.sh or run
# the full Pycore environment setup just to locate Python; those helpers may
# probe root-owned global files and invoke sudo on locked-down Debian/Ubuntu
# service users. Any Python 3 interpreter is sufficient for CodeSync.
resolve_codesync_python() {
    local name candidate
    for name in python3 python; do
        candidate="$(command -v "$name" 2>/dev/null || true)"
        if [ -n "$candidate" ] && "$candidate" -c 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)' >/dev/null 2>&1; then
            echo "$candidate"
            return 0
        fi
    done
    return 1
}

# --- usage --------------------------------------------------------------- #
print_usage() {
    cat <<EOF
pyservice.sh - entry point for the Pycore Module Caller

Usage:
  ./pyservice.sh [1|2|SUBCOMMAND] [options]

Modes:
  1            Current local UI mode (default)
  2            Relay UI intermediary mode

Subcommands:
  run          Launch the service (default if no subcommand is given)
  config       Edit/show headless config via the cross-platform Python CLI
               (forwards remaining args to: python -m pycore.pyctl.pyservice_cli config)
  codesync     Standalone Code Sync (stdlib only; no prereqs, no pycore import).
               Manual commands first repair the repository for the regular user,
               using root privileges; root is used without an explicit regular caller.
               (no subcommand)            -> prompt to add+start the systemd service
               install|uninstall|start|stop|restart|status -> manage that service
               run|show|role|peers|distribute|skip-update   -> stdlib CLI
               (e.g. ./pyservice.sh codesync   /   ./pyservice.sh codesync run)
  install      Install + enable + start the pycore systemd service (Linux only)
  start        Start the pycore systemd service (Linux only)
  stop         Stop the pycore systemd service (Linux only)
  restart      Restart the pycore systemd service (Linux only)
  status       Show the pycore systemd service status (Linux only)
  uninstall    Stop + disable + remove the pycore systemd service (Linux only)
  help         Show this help (also -h / --help)

Options (apply to 'run'):
  --host HOST      Host the RPC v2 server binds to (default: 0.0.0.0)
  --port PORT      Port the RPC v2 server binds to (default: 59000)
  --debug          Enable the worker's debug mode
  --no-reload      Disable backend hot-reload (watch .py -> restart; ON by default)
  --reload         (legacy alias; hot-reload is already the default)
  --no-install     Skip all shell prerequisite installers
  --only           Run ONLY the prerequisite step, then exit
  --no-ui          Do not launch the dashboard UI; use legacy /web/subtitle
  --ui-build       Build the dashboard UI and serve it (vite preview)
  --ui-port PORT   Port the UI server listens on (default: 13054)
  --               Everything after a bare -- is forwarded to prepare.sh

Examples:
  ./pyservice.sh 1                            # run current local UI mode
  ./pyservice.sh 2                            # run Relay UI intermediary mode
  ./pyservice.sh 1 --no-ui --port 8000        # run on port 8000, legacy UI
  ./pyservice.sh 1 --port 8000                # run mode 1 on a custom port
  ./pyservice.sh 1 --no-install               # run without prerequisite installers
  ./pyservice.sh config --show                # show headless config
  ./pyservice.sh install                      # install the systemd service (Linux)
  ./pyservice.sh --only -- --whisper-model base  # only prereqs (args after -- -> prepare.sh)
EOF
}

# --- subcommand peek ----------------------------------------------------- #
# Peek at the FIRST argument: if it is a known subcommand, consume it as CMD;
# otherwise default to 'run' (so existing flag-first invocations keep working).
CMD="run"
case "${1:-}" in
    1|2)
        SERVICE_MODE="$1"; shift ;;
    [0-9]*)
        SERVICE_MODE="$1"; shift ;;
    run|config|codesync|install|start|stop|restart|status|uninstall)
        CMD="$1"; shift ;;
    help|-h|--help)
        print_usage; exit 0 ;;
esac
if [[ "$CMD" == "run" && "${1:-}" =~ ^[0-9]+$ ]]; then
    SERVICE_MODE="$1"
    shift
fi

# --- self-elevation (Linux) --------------------------------------------- #
# Service subcommands (install/start/stop/...) need root to write systemd
# units under /etc/systemd/system. The foreground `run` needs root for its
# prerequisite installers (apt); BUT the systemd unit's own ExecStart
# (`run --no-ui --no-install`) runs as the real desktop user under User= and
# must NOT re-elevate, so `run` is elevated only when NOT already launched by
# systemd (INVOCATION_ID unset). `config`/`help` remain user-context operations.
# Code Sync performs its own privileged repository-permission preparation before
# returning to the caller context. Re-exec ONCE under sudo at
# the very top so EVERY subsequent command inherits root, preserving the
# original args plus the GUI/session env the tray (AppIndicator/pystray) and
# the worker need (DISPLAY/WAYLAND/XDG_RUNTIME_DIR/DBUS/HOME).
_pyservice_maybe_elevate() {
    [ "$(id -u)" -eq 0 ] && return 0
    [ "$(uname)" = "Linux" ] || return 0
    command -v sudo >/dev/null 2>&1 || return 0
    case "$CMD" in
        install|start|stop|restart|status|uninstall) ;;
        run)
            [ -z "${INVOCATION_ID:-}" ] || return 0
            [[ " $* " == *" --no-install "* ]] && return 0
            ;;
        *) return 0 ;;
    esac
    local env_args=() v
    for v in DISPLAY WAYLAND_DISPLAY XDG_RUNTIME_DIR DBUS_SESSION_BUS_ADDRESS \
             HOME PYTHONUSERBASE PYCORE_UI_URL PYCORE_UI_PORT PYCORE_API_BASE \
             LARAVEL_WORKER_API_URL PORT; do
        [ -n "${!v:-}" ] && env_args+=("$v=${!v}")
    done
    env_args+=("SUDO_USER=${SUDO_USER:-$(whoami)}")
    echo "[i] Elevating to root (sudo) so all subsequent steps run privileged ..."
    exec sudo env "${env_args[@]}" bash "$0" "$@"
}
_pyservice_maybe_elevate "${ORIGINAL_ARGS[@]}"

# AI SAFETY: Do not modify the `./pyservice.sh codesync` dispatch chain unless
# the user explicitly requests that specific change. This is a compatibility
# entry point for Debian/Ubuntu and Windows CodeSync service management.
#
# codesync -> STANDALONE, stdlib-only Code Sync. Dispatched HERE, before the
# prerequisite-install step and without importing the pycore package. Manual
# commands first apply the repository owner and mode-777 policy.
#   * no subcommand          -> offer to add Code Sync to the systemd service
#                               (prompt, default YES), then start it + show logs.
#   * install|uninstall|start|stop|restart|status -> manage that systemd service.
#   * run|show|role|peers|distribute|skip-update  -> the stdlib CLI: the bootstrap
#     is run as a FILE so `codesync` loads as a top-level name (pycore/__init__.py
#     is never executed, no third_party). See pycore/pyutils/codesync/runtime.py.
if [[ "$CMD" == "codesync" ]]; then
    CS_MGR="$SCRIPT_DIR/scripts/shells/linux/common/codesync_service.sh"
    # Every manual Code Sync command first assigns the repository to the active
    # regular user with mode 777, or to root when no regular user is active.
    # The resident systemd child skips this step because installation/start has
    # already prepared the tree and a service process must never invoke sudo.
    if [ -z "${INVOCATION_ID:-}" ]; then
        if ! bash "$CS_MGR" prepare; then
            echo "[codesync-service] Repository permission preparation failed." >&2
            exit 1
        fi
    fi
    case "${1:-}" in
        "")
            # No subcommand: prompt to add Code Sync to the system service.
            exec bash "$CS_MGR" install --prompt
            ;;
        install|uninstall|start|stop|restart|status)
            CS_OP="$1"; shift
            exec bash "$CS_MGR" "$CS_OP" "$@"
            ;;
        run)
            shift
            # Interactively offer to install+run as a system service (default YES);
            # decline -> run the foreground daemon. With NO TTY (the systemd unit's
            # own ExecStart=`codesync run`) the prompt is skipped -> foreground,
            # so the service never re-installs itself.
            # `|| CS_RC=$?` keeps `set -e` from aborting on the non-zero (10) that
            # run-prompt returns to mean "run in the foreground".
            CS_RC=0
            bash "$CS_MGR" run-prompt || CS_RC=$?
            if [[ "$CS_RC" -ne 10 ]]; then
                exit "$CS_RC"   # installed as a service (or install error)
            fi
            if ! PY="$(resolve_codesync_python)"; then
                echo "[X] Python 3 was NOT found; cannot run 'codesync'." >&2
                exit 1
            fi
            cd "$SCRIPT_DIR"
            exec "$PY" pycore/pyutils/codesync_boot.py run "$@"
            ;;
        *)
            # show | role | peers | distribute | skip-update -> stdlib CLI.
            if ! PY="$(resolve_codesync_python)"; then
                echo "[X] Python 3 was NOT found; cannot run 'codesync'." >&2
                exit 1
            fi
            cd "$SCRIPT_DIR"
            exec "$PY" pycore/pyutils/codesync_boot.py "$@"
            ;;
    esac
fi

# config -> hand off to the cross-platform Python CLI (run from repo root).
if [[ "$CMD" == "config" ]]; then
    if ! PY="$(resolve_python)"; then
        echo "[X] Python 3 was NOT found; cannot run 'config'." >&2
        exit 1
    fi
    cd "$SCRIPT_DIR"
    exec "$PY" -m pycore.pyctl.pyservice_cli config "$@"
fi

# service subcommands -> hand off to the Linux systemd helper.
case "$CMD" in
    install|start|stop|restart|status|uninstall)
        exec bash "$SCRIPT_DIR/scripts/shells/linux/common/pycore_service.sh" "$CMD" "$@"
        ;;
esac

# From here on CMD == run. Parse the run flags.
# Parse args; everything after a bare `--` is forwarded to prepare.sh.
while [[ $# -gt 0 ]]; do
    case "$1" in
        --host)       BIND_HOST="$2"; shift 2 ;;
        --port)       PORT="$2";      shift 2 ;;
        --debug)      DEBUG=1;        shift   ;;
        --no-reload)  RELOAD=0;       shift   ;;
        --reload)     RELOAD=1;       shift   ;;
        --no-install) NO_INSTALL=1; shift ;;
        --only)       ONLY=1;         shift   ;;
        --no-ui)      NO_UI=1;        shift   ;;
        --ui-build)   UI_BUILD=1;     shift   ;;
        --ui-port)    UI_PORT="$2";   shift 2 ;;
        --)           shift; PREPARE_ARGS+=("$@"); break ;;
        *) echo "[!] Unknown argument: $1" >&2; shift ;;
    esac
done

case "$SERVICE_MODE" in
    1) ;;
    2) NO_UI=1 ;;
    *) echo "[!] Invalid service mode: $SERVICE_MODE" >&2; exit 2 ;;
esac

if [[ "$IS_HEADLESS_SERVER" == true ]]; then
    echo "[i] Headless server detected; Pycore runtime is disabled by server policy."
    exit 0
fi

echo "======================================================"
echo " Pycore Service - entry point"
echo "======================================================"
if [[ "$SERVICE_MODE" == "2" ]]; then
    UI_MODE="relay"
elif [[ "$NO_UI" -eq 1 ]]; then
    UI_MODE="legacy"
else
    UI_MODE="dashboard (pycore-manager)"
fi
echo "[i] pyservice run - run \`pyservice.sh help\` for all commands (host=$BIND_HOST port=$PORT mode=$SERVICE_MODE ui=$UI_MODE prerequisites=$([[ "$NO_INSTALL" -eq 1 ]] && echo skipped || echo enabled))"

if ! PY="$(resolve_python)"; then
    echo "[X] Python 3 was NOT found. Install it, then re-run:" >&2
    echo "      - apt install python3   (Debian/Ubuntu)" >&2
    echo "      - brew install python   (macOS)" >&2
    exit 1
fi
echo "[OK] Python : $("$PY" --version 2>&1)"
echo "       path : $PY"

# Export the venv-aware Python runtime env (PIP_USER / PYTHONUSERBASE) for BOTH the
# prerequisite install and the worker, identical to prepare.sh's policy (single source of
# truth in venv_python_common.sh). For the project venv this sets PIP_USER=0 and does NOT
# touch PYTHONUSERBASE, so the worker imports torch from the venv/its own user-site instead
# of falling through to a stale /usr/local build.
if type pycore_export_python_env_from_common >/dev/null 2>&1; then
    pycore_export_python_env_from_common "$PY"
fi

PREPARE_REL="scripts/shells/linux/common/prepare_pycore_prerequisites.sh"
WORKER_REL="pycore/pycore_module_caller.py"

cd "$SCRIPT_DIR"

# --- 1) prerequisites ---------------------------------------------------- #
# prepare_pycore_prerequisites.sh runs the numbered installers. Every one is IDEMPOTENT
# and self-REPAIRING, so this step is safe to re-run on every boot and heals drift: the
# Bucket-A LLM stack shares ONE pinned transformers (never --upgrade) and Bucket-B engines
# with incompatible pins (qwen3tts, melotts, gptsovits - each in its own isolated per-engine
# venv; melotts/gptsovits build opt-in only) never touch the main interpreter. See
# development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md Section 5 & Section 7.
if [[ "$NO_INSTALL" -eq 1 ]]; then
    echo "[i] Skipping all shell prerequisite installers (--no-install)."
else
    echo "[..] Running prerequisite installers ..."
    # Neural TTS batch (ChatTTS/CosyVoice/Fish Speech/Kokoro/VoxCPM2/F5/GPT-SoVITS); idempotent. Opt out: NEURAL_TTS_INSTALL=0
    [[ -z "${NEURAL_TTS_INSTALL:-}" ]] && export NEURAL_TTS_INSTALL=1
    bash "$PREPARE_REL" --python "$PY" "${PREPARE_ARGS[@]+"${PREPARE_ARGS[@]}"}"
fi

if [[ "$ONLY" -eq 1 ]]; then
    echo "[OK] Prerequisite step complete (--only); not launching the worker."
    exit 0
fi

# --- port-conflict guard (Docker publishers) ----------------------------- #
# pyservice binds the RPC API ($PORT, default 59000) and the dashboard UI
# ($UI_PORT, default 13054). If a Docker container PUBLISHES one of these host
# ports it surfaces as a docker-proxy holder the normal lsof/kill paths won't
# touch. Offer to stop the owning container and disable its auto-startup
# (default No; keep running). Override: PORT_CONFLICT_AUTO_STOP=yes (pre-confirm).
prompt_default_no() {
    local msg="$1" reply=""
    case "${PORT_CONFLICT_AUTO_STOP:-}" in [Yy]*) return 0 ;; [Nn]*) return 1 ;; esac
    if [ -t 0 ] && [ -r /dev/tty ]; then
        printf '%s [y/N] ' "$msg" > /dev/tty
        read -r reply < /dev/tty || reply=""
    fi
    case "$reply" in [Yy]*) return 0 ;; *) return 1 ;; esac
}
stop_docker_publisher() {
    local port="$1" row="" cid="" cname=""
    command -v docker >/dev/null 2>&1 || return 1
    row=$(docker ps --filter "publish=${port}" --format '{{.ID}} {{.Names}}' 2>/dev/null | head -1)
    [ -n "$row" ] || row=$(${USE_SUDO:-} docker ps --filter "publish=${port}" --format '{{.ID}} {{.Names}}' 2>/dev/null | head -1)
    [ -n "$row" ] || return 1
    cid=$(printf '%s' "$row" | awk '{print $1}')
    cname=$(printf '%s' "$row" | awk '{print $2}')
    echo "[i] Port ${port} is published by Docker container: ${cname:-$cid}"
    if prompt_default_no "[?] Stop container ${cname:-$cid} and disable its auto-startup to free port ${port}?"; then
        echo "[..] Stopping container ${cname:-$cid} ..."
        docker stop "$cid" >/dev/null 2>&1 || ${USE_SUDO:-} docker stop "$cid" >/dev/null 2>&1 || true
        # Disable auto-startup (restart policy -> no)
        docker update --restart=no "$cid" >/dev/null 2>&1 || ${USE_SUDO:-} docker update --restart=no "$cid" >/dev/null 2>&1 || true
        echo "[i] Container ${cname:-$cid} stopped and auto-startup disabled."
        return 0
    fi
    echo "[i] Left container ${cname:-$cid} running; port ${port} still occupied."
    return 1
}

# --- 2) launch the unified dashboard UI (unless --no-ui) ----------------- #
# Delegate frontend lifecycle to its canonical idempotent start script.

if [[ "$SERVICE_MODE" == "2" ]]; then
    echo "[i] Relay UI intermediary mode: local dashboard launch is disabled."
elif [[ "$NO_UI" -eq 1 ]]; then
    echo "[i] --no-ui: using legacy /web/subtitle UI."
elif [[ ! -f "$UI_START" ]]; then
    echo "[i] dashboard start.sh not found; using legacy /web/subtitle UI."
else
    RPC_PORT="$PORT"
    export PORT="$UI_PORT"
    export PYCORE_UI_PORT="$UI_PORT"
    export PYCORE_API_BASE="http://localhost:$RPC_PORT"
    if [[ "$UI_BUILD" -eq 1 ]]; then
        UI_START_ARGS=(--non-interactive --no-backend --dist)
    else
        UI_START_ARGS=(--non-interactive --no-backend --dev)
    fi
    echo "[..] Starting dashboard through $UI_START ..."
    ( cd "$UI_DIR" && bash "$UI_START" "${UI_START_ARGS[@]}" ) &
    export PYCORE_UI_URL="http://localhost:$UI_PORT/pycore-manager"
    echo "[i] Dashboard start dispatched asynchronously: $PYCORE_UI_URL"
fi

# --- 3) launch the worker ------------------------------------------------ #
# Restore PORT to the RPC port so the Python worker (which reads $PORT env var)
# binds to 59000, not 13054 (the Vite UI port that was temporarily exported).
export PORT="${RPC_PORT:-59000}"
export PYCORE_RPC_PORT="$PORT"

# Ensure DISPLAY is set on Linux desktop so the tray (AppIndicator/pystray) can
# connect to the X11/Wayland session. Also forward DBUS_SESSION_BUS_ADDRESS which
# AppIndicator3 needs to register with the system tray (GNOME/Ubuntu/KDE).
if [[ "$(uname)" == "Linux" ]]; then
    if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
        # Try to detect a running display server
        if [[ -e /tmp/.X11-unix/X0 ]]; then
            export DISPLAY=":0"
        fi
    fi
    # XDG_RUNTIME_DIR must be owned by the running uid - GLib and PulseAudio
    # check ownership and warn/fail if it doesn't match. When running as root
    # via sudo, XDG_RUNTIME_DIR is often inherited as /run/user/1001 (the
    # desktop user), which root (uid 0) does not own.
    #
    # DBUS_SESSION_BUS_ADDRESS must point to the desktop user's session bus so
    # AppIndicator3 can register with the system tray panel.
    #
    # Strategy:
    #   XDG_RUNTIME_DIR -> always /run/user/<own_uid> (no ownership mismatch)
    #   DBUS_SESSION_BUS_ADDRESS -> desktop user's bus (to reach the tray)
    my_uid=$(id -u)
    my_runtime="/run/user/${my_uid}"

    # Always force XDG_RUNTIME_DIR to match the running uid.
    # sudo often leaks the invoking user's value (e.g. /run/user/1001 for root).
    if [[ ! -d "$my_runtime" ]]; then
        mkdir -p "$my_runtime" 2>/dev/null || true
        chmod 700 "$my_runtime" 2>/dev/null || true
        chown "${my_uid}:$(id -g)" "$my_runtime" 2>/dev/null || true
    fi
    export XDG_RUNTIME_DIR="$my_runtime"

    # Forward DBUS session bus from the desktop user (needed by AppIndicator3)
    if [[ -z "${DBUS_SESSION_BUS_ADDRESS:-}" ]]; then
        # First try own bus
        if [[ -e "${my_runtime}/bus" ]]; then
            export DBUS_SESSION_BUS_ADDRESS="unix:path=${my_runtime}/bus"
        else
            # Running as root: borrow the desktop user's D-Bus session bus
            local_user=$(w -h 2>/dev/null | awk 'NR==1{print $1}')
            if [[ -n "$local_user" ]] && [[ "$local_user" != "root" ]]; then
                local_uid=$(id -u "$local_user" 2>/dev/null)
                if [[ -n "$local_uid" ]] && [[ -e "/run/user/${local_uid}/bus" ]]; then
                    export DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/${local_uid}/bus"
                fi
            fi
        fi
    fi
fi

PY_ARGS=(-u "$WORKER_REL" --host "$BIND_HOST" --port "$PORT" --service-mode "$SERVICE_MODE")
if [[ "$DEBUG" -eq 1 ]]; then PY_ARGS+=(--debug); fi
if [[ "$RELOAD" -eq 0 ]]; then PY_ARGS+=(--no-reload); fi   # hot-reload is the default; opt out for headless prod

# Free the RPC port from a foreign Docker publisher before binding it.
stop_docker_publisher "$PORT" || true

echo ""
echo "[>] Launching worker: $WORKER_REL"
echo ""
exec "$PY" "${PY_ARGS[@]}"
