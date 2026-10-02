#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# pyservice_entry.sh - Shared implementation of the Pycore service entry point
#                      (Linux / macOS / Git-Bash / WSL).
#
# This is the COMMON CODE AREA for the repo-root entry `pyservice.sh`, which is
# only a thin launcher (like Windows: repo-root entry -> shared logic here).
# Never invoke this file directly from user docs; use ./pyservice.sh.
#
# It:
#   1. PREREQUISITES: runs scripts/shells/linux/common/prepare_pycore_prerequisites.sh,
#      the heavy third-party packages that are more convenient to set up from a
#      shell (e.g. whisper). This complements pycore/pyfoundations/third_party.py
#      (which fast-detects/installs lighter packages at import time). Skip with
#      --no-install.
#   2. LAUNCH: starts pycore/pycore_module_caller.py (the worker, which lives
#      inside the pycore package, not at the repo root).
#
# Both the prerequisite script and the worker are invoked through paths RELATIVE
# to the repo root, so the repo can live anywhere.
#
# NOTE: /pycore-manager/queue-center is served BY pycore (proxying laravel_main's
# /assist/overview), never a direct web connection -- keep it and laravel_main's
# /laravel-manager#/task-center aligned when either side's task categories change.
#
# Usage (via ./pyservice.sh):
#   ./pyservice.sh 1                     # current local UI mode (default)
#   ./pyservice.sh 2                     # Relay UI intermediary mode
#   ./pyservice.sh 1 --no-install        # skip prereqs, just launch
#   ./pyservice.sh --port 8000 --debug   # launch on port 8000 in debug mode
#   ./pyservice.sh --no-reload           # disable backend hot-reload (.py -> restart)
#   ./pyservice.sh --only -- --whisper-model base   # only run prereqs (args after
#                                                     # `--` go to prepare.sh)
#   ./pyservice.sh colab                 # Google Colab VM: Relay agent (mode 2) with
#   ./pyservice.sh kaggle                # persisted caches (notebook_runtime.sh); the
#                                        # cell first runs pycore/bootstrap/notebook_boot.py
#   ./pyservice.sh colab --export-identity   # encrypt the Relay device identity
#
# Subcommands: run (default) | config | install | start | stop | restart |
#   status | uninstall | help.  The service subcommands are Linux/systemd only.
#
# ---------------------------------------------------------------------------
# Headless config CLI:  pyservice.sh config ...  -> python -m pycore.pyservice_cli
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
#   - System settings      : <core_node_data_dir>/config/user_data.json  (system_settings section)
#   - Code-sync role/peers  : pycore/pyutils/codesync/code_sync_peers.json  (committed)
#
# ---------------------------------------------------------------------------
# systemd service (Linux):  sudo ./pyservice.sh install|start|stop|restart|status|uninstall
# ---------------------------------------------------------------------------
# `install` delegates to scripts/shells/linux/common/pycore_service.sh (part of
# the dd.sh call chain; reuses debian_service_manager.sh). The unit runs headless:
#   ExecStart=/bin/bash <repo>/pyservice.sh run --no-ui --no-install   (hot reload on)
#   + root companion unit core-node-owner-guard (root-created entries -> real user)
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
# page is served and no Qt window is created, so the worker is effectively an
# RPC server - configure it with `pyservice config ...`. On a desktop session
# (X11 or Wayland) the worker also registers a system tray
# (AppIndicator/StatusNotifierItem on GNOME, pystray fallback); it must run as
# the desktop session user - the drop-privileges handoff below guarantees that
# even when this entry was started from a root shell.
# ---------------------------------------------------------------------------
set -uo pipefail
export PYCORE_HTTP_EVENTS_ENABLED=1

# Resolve the repo root. This file lives at scripts/shells/linux/common/, four
# levels below the root. The repo-root entry (pyservice.sh) may pass
# PYSERVICE_REPO_ROOT explicitly; otherwise self-locate.
if [[ -n "${PYSERVICE_REPO_ROOT:-}" && -d "${PYSERVICE_REPO_ROOT:-}" ]]; then
    SCRIPT_DIR="$(cd "$PYSERVICE_REPO_ROOT" && pwd)"
else
    SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")/../../../.." && pwd)"
fi
PY_SERVICE_COMMAND="${1:-}"
RUNTIME_ENVIRONMENT_SCRIPT="$SCRIPT_DIR/scripts/shells/linux/common/runtime_environment.sh"
FS_PERM_HELPERS_SCRIPT="$SCRIPT_DIR/scripts/shells/linux/common/fs_perm_helpers.sh"
CLIENT_KEY_COMMON_SCRIPT="$SCRIPT_DIR/scripts/shells/linux/common/client_key_common.sh"
NOTEBOOK_RUNTIME_SCRIPT="$SCRIPT_DIR/scripts/shells/linux/common/notebook_runtime.sh"
NOTEBOOK_PLATFORM=""
NOTEBOOK_EXPORT_IDENTITY=0

# Hosted notebook platform token (colab | kaggle): peeked before the runtime
# environment loads, because it relocates CORE_NODE_DATA_DIR and the caches to
# the notebook persist root that every later step reads.
for __ps_arg in "$@"; do
    case "$__ps_arg" in
        --) break ;;
        colab|kaggle) NOTEBOOK_PLATFORM="$__ps_arg" ;;
    esac
done
unset __ps_arg
if [[ -n "$NOTEBOOK_PLATFORM" ]]; then
    source "$NOTEBOOK_RUNTIME_SCRIPT"
    notebook_prepare_environment "$NOTEBOOK_PLATFORM"
fi

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
# model download lands in one shared tree. On a dual-boot machine whose web data
# disk ROOT is mounted at /www (NTFS), that tree is the SAME one Windows uses
# (D:\www\cache == /www/www/cache -- ONE EXTRA LEVEL because /www == D:\ root),
# so models download once for both OSes (weights are device-agnostic: GPU and
# CPU runs share them); otherwise the native /var/_core_node/cache.
if [[ "$PY_SERVICE_COMMAND" != "codesync" ]]; then
    if [[ -n "$NOTEBOOK_PLATFORM" ]]; then
        notebook_bind_model_cache
    fi
    source "$SCRIPT_DIR/scripts/shells/linux/common/shared_cache_env.sh"
fi

# Empty: the worker binds pycore's contract loopback default. A LAN host is
# honoured by pycore only with the system setting rpcLanBind=true (K7).
BIND_HOST=""
PORT="59000"
RPC_PORT="59000"
DEBUG=0
RELOAD=1
NO_INSTALL=0
NO_SERVICE_PROMPT=0
ONLY=0
NO_UI=0
TTS_SELFCHECK=0
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
WORKER_ENV_ARGS=()
ROOT_SPOOL_MODULE="pycore.pyctl.agent_history.root_spool_main"

# --- locate a Python 3 interpreter --------------------------------------- #
# Defined early so subcommands (config) can reuse it before the run path.
resolve_python() {
    # Prefer the project venv built by 13_install_default_python.sh ($COMPILE_DIR/python3_venv):
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
  ./pyservice.sh [1|2|colab|kaggle|SUBCOMMAND] [options]

Modes:
  1            Current local UI mode (default)
  2            Relay UI intermediary mode

Hosted notebook platforms (imply mode 2, --no-ui, --no-reload):
  colab        Google Colab VM: outbound-only Relay agent to Laravel. Config,
               Relay identity and model/pip caches persist under
               /content/drive/MyDrive/core_node_notebook, decrypted secrets
               backed up there; only kokoro and qwen3tts are installed/scheduled.
  kaggle       Kaggle notebook VM; persist root /kaggle/working/core_node_notebook.
               Secrets in .secret_keys/already_encrypted are decrypted with one
               password: \$CORE_NODE_SECRET_PASSWORD or a terminal prompt.
               Override the persist root with \$NOTEBOOK_PERSIST_DIR.
               Cell: %run <repo>/pycore/bootstrap/notebook_boot.py colab
                     !bash <repo>/pyservice.sh colab
               (the kernel step mounts Drive, offers a 5 s re-decrypt and
               resolves the password from the notebook secrets)
               Third-party AI keys/services are off; translation and AI run on
               local models (Ollama + config/service_contract.json
               local_ai.translate_model, installed by default).

Subcommands:
  run          Launch the service (default if no subcommand is given)
  config       Edit/show headless config via the cross-platform Python CLI
               (forwards remaining args to: python -m pycore.pyservice_cli config)
  codesync     Standalone Code Sync host (frozen: retired, repositories sync with gitsync).
               Manual commands first repair the repository for the regular user,
               using root privileges; root is used without an explicit regular caller.
               (no subcommand)            -> if the service runs: prompt to disable it
                                             (default N), else prompt to add+start it
               install|uninstall|start|stop|restart|status -> manage that service
               disable|enable             -> idempotent stop+disable / enable+start (unit kept)
               run|show|role|peers|distribute|skip-update   -> unified CLI
               (e.g. ./pyservice.sh codesync   /   ./pyservice.sh codesync run)
  install      Install + enable + start the pycore background service (systemd unit
               'pycore', no tray; Windows: .\pyservice.ps1 install). Idempotent.
               Prerequisites alone: --only
  start        Start the pycore background service
  stop         Stop the pycore background service
  restart      Restart the pycore background service
  status       Show the pycore background service status
  uninstall    Stop + disable + remove the pycore background service
  help         Show this help (also -h / --help)

Options (apply to 'run'):
  --host HOST      Host the RPC server binds to (default: loopback; a LAN host
                   also needs: pyservice.sh config system set --key rpcLanBind --value true)
  --port PORT      Port the RPC server binds to (default: 59000)
  --debug          Enable the worker's debug mode
  --no-reload      Disable backend hot-reload (watch .py -> restart; ON by default)
  --reload         (legacy alias; hot-reload is already the default)
  --no-install     Skip all shell prerequisite installers
  --no-service-prompt  Do not offer the background-service install [Y/n] (interactive run
                   offers it when the service is absent; an installed service is
                   ensured running and reported instead of a second foreground worker)
  --only           Run ONLY the prerequisite step, then exit
  --no-ui          Do not launch the dashboard UI; use legacy /web/subtitle
  --ui-build       Build the dashboard UI and serve it (vite preview)
  --ui-port PORT   Port the UI server listens on (default: 13054)
  --tts-selfcheck  Run the TTS batch self-check as a STANDALONE step before the
                   worker starts: probe each engine (kokoro, parler, chattts,
                   gptsovits, qwen3tts) with RAM/GPU memory gates, generate a
                   real batch sample, log resource before/after, then release
                   memory/GPU; the worker (RPC + services) starts only after
                   it exits and pins the global TTS runtime profile.
                   Same as exporting TTS_STARTUP_SELFCHECK=1.
  --include NAME   (after --) Run only the named prerequisite, e.g. ollama
  PYCORE_LOCAL_AI_INSTALL=1  Install the local AI translation runtime (Ollama +
                   translation model) on any host; default on colab|kaggle
  --export-identity  With colab|kaggle: encrypt the claimed Relay device identity
                   to .secret_keys/already_encrypted/PYCORE_RELAY_DEVICE_IDENTITY_1.js
                   (commit it; later VMs restore it), then exit
  -h, --help       Show this help (also works as: run --help)
  --               Everything after a bare -- is forwarded to prepare.sh

Examples:
  ./pyservice.sh 1                            # run current local UI mode
  ./pyservice.sh 2                            # run Relay UI intermediary mode
  ./pyservice.sh 1 --no-ui --port 8000        # run on port 8000, legacy UI
  ./pyservice.sh 1 --port 8000                # run mode 1 on a custom port
  ./pyservice.sh 1 --no-install               # run without prerequisite installers
  ./pyservice.sh 1 --tts-selfcheck            # probe/batch-test each TTS engine, then serve
  ./pyservice.sh colab                        # run on Google Colab as the Relay agent
  ./pyservice.sh kaggle --no-install          # run on Kaggle, skipping installers
  ./pyservice.sh colab --export-identity      # encrypt the Relay device identity
  ./pyservice.sh config --show                # show headless config
  ./pyservice.sh install                      # install + start the background service
  ./pyservice.sh status                       # show the background service status
  ./pyservice.sh --only -- --whisper-model base  # only prereqs (args after -- -> prepare.sh)
  ./pyservice.sh --only -- --include ollama   # install only the local AI translation runtime
EOF
}

# --- subcommand peek ----------------------------------------------------- #
# Only NON-run subcommands are consumed positionally here, because they own
# and forward the remaining args (config/codesync) or hand off to helpers
# (install/start/...). Everything else defaults to CMD=run and is parsed by
# the run loop below, which walks the FULL argument list and matches each
# token against the whole parameter library - so mode (1/2), the literal
# `run` token, help, and every option can be STACKED in any order instead of
# having to sit at a fixed position.
CMD="run"
case "${1:-}" in
    config|codesync|install|start|stop|restart|status|uninstall)
        CMD="$1"; shift ;;
    help|-h|--help)
        print_usage; exit 0 ;;
esac

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
# the worker need (DISPLAY/WAYLAND/XDG_RUNTIME_DIR/DBUS/HOME). Before the
# worker launches, privileges are DROPPED back to $SUDO_USER when a desktop
# session exists - the tray can only register on the user's own session bus.
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
             XDG_SESSION_TYPE XDG_CURRENT_DESKTOP DESKTOP_SESSION XAUTHORITY \
             HOME PYTHONUSERBASE PYCORE_UI_URL PYCORE_UI_PORT PYCORE_API_BASE \
             LARAVEL_WORKER_API_URL PORT TTS_STARTUP_SELFCHECK CORE_NODE_DATA_OWNER \
             NOTEBOOK_PERSIST_DIR; do
        [ -n "${!v:-}" ] && env_args+=("$v=${!v}")
    done
    env_args+=("SUDO_USER=${SUDO_USER:-$(whoami)}")
    echo "[i] Elevating to root (sudo) so all subsequent steps run privileged ..."
    exec sudo env "${env_args[@]}" bash "$0" "$@"
}
_pyservice_maybe_elevate "${ORIGINAL_ARGS[@]}"

# Idempotent permission repair of the mapped web data root (CORE_NODE_WWW_BASE:
# /www/www on dual-boot NTFS, /www on native Linux). The worker below is DROPPED
# to the desktop user so the tray can register on the D-Bus session bus, so any
# root-owned remnant under the data root (left by a previous privileged run)
# fails with EACCES - e.g. audio_orchestration task writes. Runs only in root
# context (post-elevation); the helper self-skips otherwise and never blocks
# startup (full-tree repair is stamp-guarded and backgrounded).
# CORE_NODE_DATA_OWNER pins the real user once for every root child below
# (installers, root spool helper, a root worker): pycore data_owner.py creates
# their entries owned by that user.
if [[ "$(id -u)" == "0" ]]; then
    source "$FS_PERM_HELPERS_SCRIPT"
    resolve_active_permission_owner >/dev/null
    if [[ "$ACTIVE_PERMISSION_USER" != "root" ]]; then
        export CORE_NODE_DATA_OWNER="$ACTIVE_PERMISSION_USER"
    fi
fi
case "$CMD" in
    run|install|start|restart)
        bash "$SCRIPT_DIR/scripts/shells/linux/common/pyservice_www_permissions.sh" || true
        ;;
esac

# AI SAFETY: Do not modify the `./pyservice.sh codesync` dispatch chain unless
# the user explicitly requests that specific change. This is a compatibility
# entry point for Debian/Ubuntu and Windows CodeSync service management.
#
# Frozen: Code Sync is retired; repositories sync with `gitsync`. Not updated by refactors unless explicitly requested.
# codesync -> STANDALONE Code Sync. Dispatched HERE, before the
# prerequisite-install step. Manual
# commands first apply the repository owner and mode-777 policy.
#   * no subcommand          -> offer to add Code Sync to the systemd service
#                               (prompt, default YES), then start it + show logs.
#   * install|uninstall|start|stop|restart|status -> manage that systemd service.
#   * run|show|role|peers|distribute|skip-update  -> the unified CLI
#     (pycore/pyservice_cli.py) via the bootstrap file; `run` starts the
#     codesync-only RPC host serving the shared Code Sync route table.
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
            # No subcommand: offer to disable a running Code Sync service
            # (default N; dd gitsync also syncs code), then the install prompt.
            CS_RC=0
            bash "$CS_MGR" disable-prompt || CS_RC=$?
            if [[ "$CS_RC" -eq 11 ]]; then
                exit 0
            fi
            exec bash "$CS_MGR" install --prompt
            ;;
        install|uninstall|start|stop|restart|status|disable|enable|disable-prompt|apply-policy)
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
            exec "$PY" pycore/bootstrap/codesync_boot.py run "$@"
            ;;
        *)
            # show | role | peers | distribute | skip-update -> stdlib CLI.
            if ! PY="$(resolve_codesync_python)"; then
                echo "[X] Python 3 was NOT found; cannot run 'codesync'." >&2
                exit 1
            fi
            cd "$SCRIPT_DIR"
            exec "$PY" pycore/bootstrap/codesync_boot.py "$@"
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
    exec "$PY" -m pycore.pyservice_cli config "$@"
fi

# service subcommands -> hand off to the Linux systemd helper.
case "$CMD" in
    install|start|stop|restart|status|uninstall)
        exec bash "$SCRIPT_DIR/scripts/shells/linux/common/pycore_service.sh" "$CMD" "$@"
        ;;
esac

# From here on CMD == run. Walk the FULL argument list and match every token
# against the whole parameter library; recognized tokens STACK in any order
# (mode digit, the literal `run`, options, help). A bare `--` still ends
# parsing and forwards the rest to prepare.sh.
while [[ $# -gt 0 ]]; do
    case "$1" in
        run)          shift ;;
        colab|kaggle) shift ;;
        --export-identity) NOTEBOOK_EXPORT_IDENTITY=1; shift ;;
        [0-9]*)       SERVICE_MODE="$1"; shift ;;
        --host)       BIND_HOST="$2"; shift 2 ;;
        --port)       PORT="$2";      shift 2 ;;
        --debug)      DEBUG=1;        shift   ;;
        --no-reload)  RELOAD=0;       shift   ;;
        --reload)     RELOAD=1;       shift   ;;
        --no-install) NO_INSTALL=1; shift ;;
        --no-service-prompt) NO_SERVICE_PROMPT=1; shift ;;
        --only)       ONLY=1;         shift   ;;
        --no-ui)      NO_UI=1;        shift   ;;
        --ui-build)   UI_BUILD=1;     shift   ;;
        --ui-port)    UI_PORT="$2";   shift 2 ;;
        --tts-selfcheck) TTS_SELFCHECK=1; shift ;;
        -h|--help|help) print_usage; exit 0 ;;
        --)           shift; PREPARE_ARGS+=("$@"); break ;;
        *) echo "[!] Unknown argument: $1" >&2; shift ;;
    esac
done

# A notebook VM has no inbound access or desktop: always the Relay agent.
if [[ -n "$NOTEBOOK_PLATFORM" ]]; then
    SERVICE_MODE="2"
    RELOAD=0
elif [[ "$NOTEBOOK_EXPORT_IDENTITY" -eq 1 ]]; then
    echo "[!] --export-identity requires a notebook platform: colab or kaggle" >&2
    exit 2
fi

case "$SERVICE_MODE" in
    1) ;;
    2) NO_UI=1 ;;
    *) echo "[!] Invalid service mode: $SERVICE_MODE" >&2; exit 2 ;;
esac

# Keep RPC_PORT in sync with the parsed --port. It is only re-assigned inside
# the dashboard-UI branch below, so without this line `run --no-ui --port N`
# silently reverted the worker to the default 59000.
RPC_PORT="$PORT"

if [[ "$IS_HEADLESS_SERVER" == true && -z "$NOTEBOOK_PLATFORM" ]]; then
    echo "[i] Headless server detected; Pycore runtime is disabled by server policy."
    exit 0
fi

if [[ "$NOTEBOOK_EXPORT_IDENTITY" -eq 1 ]]; then
    notebook_export_relay_identity
    exit $?
fi

# --- background service offer / ensure ------------------------------------- #
# Interactive foreground run: service absent -> offer install (default YES);
# service installed -> ensure it runs and report it instead of starting a second
# worker on the same port. Skipped for the unit's own run (INVOCATION_ID), no TTY (scripts keep the foreground takeover),
# notebooks, --only, --no-service-prompt and mode 2.
PYCORE_SERVICE_UNIT="pycore"
PYCORE_SERVICE_MANAGER="$SCRIPT_DIR/scripts/shells/linux/common/pycore_service.sh"
PYCORE_SERVICE_PROMPT_TIMEOUT=30
offer_pycore_service() {
    local answer="" unit_load="" unit_active=""
    [[ -z "${INVOCATION_ID:-}" && "$NO_SERVICE_PROMPT" -eq 0 && "$ONLY" -eq 0 \
        && -z "$NOTEBOOK_PLATFORM" && "$SERVICE_MODE" == "1" ]] || return 0
    command -v systemctl >/dev/null 2>&1 || return 0
    [[ -t 0 && -r /dev/tty ]] || return 0
    unit_load="$(systemctl show -p LoadState --value "$PYCORE_SERVICE_UNIT" 2>/dev/null)"
    if [[ "$unit_load" == "loaded" ]]; then
        unit_active="$(systemctl is-active "$PYCORE_SERVICE_UNIT" 2>/dev/null)"
        if [[ "$unit_active" != "active" ]]; then
            echo "[..] pycore service is installed but not running; starting it ..."
            bash "$PYCORE_SERVICE_MANAGER" start
        else
            echo "[OK] pycore service is already running (systemctl status $PYCORE_SERVICE_UNIT)."
        fi
        echo "[i] Not starting a second foreground worker. Stop it first: ./pyservice.sh stop (or use --no-service-prompt)."
        exit 0
    fi
    source "$SCRIPT_DIR/scripts/shells/linux/common/prompt_common.sh"
    prompt_read_default answer "y" "$PYCORE_SERVICE_PROMPT_TIMEOUT" "[?] Install pycore as a background service? [Y/n] "
    case "$answer" in
        [Nn]*) echo "[i] Running in the foreground (service not installed)."; return 0 ;;
    esac
    exec bash "$PYCORE_SERVICE_MANAGER" install
}
offer_pycore_service

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
echo "[i] pyservice run - run \`pyservice.sh help\` for all commands (host=${BIND_HOST:-loopback} port=$PORT mode=$SERVICE_MODE ui=$UI_MODE platform=${NOTEBOOK_PLATFORM:-local} prerequisites=$([[ "$NO_INSTALL" -eq 1 ]] && echo skipped || echo enabled) tts-selfcheck=$([[ "$TTS_SELFCHECK" -eq 1 || "${TTS_STARTUP_SELFCHECK:-0}" == "1" ]] && echo on || echo off))"

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

# --- 0) secrets: notebook VMs decrypt every secret up front (no later TTY)
#        and restore the claimed Relay device identity; then the shared client
#        key (signs every Laravel machine call; idempotent).
if [[ -n "$NOTEBOOK_PLATFORM" ]]; then
    notebook_decrypt_secrets
    notebook_restore_relay_identity
fi
source "$CLIENT_KEY_COMMON_SCRIPT"
client_key_ensure_ready

# --- 1) prerequisites ---------------------------------------------------- #
# prepare_pycore_prerequisites.sh runs the numbered installers. Every one is IDEMPOTENT
# and self-REPAIRING, so this step is safe to re-run on every boot and heals drift: the
# Bucket-A LLM stack shares ONE pinned transformers (never --upgrade) and Bucket-B engines
# with incompatible pins (qwen3tts, melotts, gptsovits - each in its own isolated per-engine
# venv; melotts/gptsovits build opt-in only) never touch the main interpreter. See
# development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md Section 5 & Section 7.
# A notebook VM starts without venvs or system packages: its first run always
# installs (initializing the persist-root caches); later runs honor --no-install.
if [[ -n "$NOTEBOOK_PLATFORM" ]]; then
    notebook_check_connectivity
    if [[ "$NOTEBOOK_INTERNET_OK" == false && "$NO_INSTALL" -eq 0 ]]; then
        echo "[NOTEBOOK] No outbound internet: skipping the prerequisite installers; the next run with internet installs them."
        NO_INSTALL=1
    elif [[ "$NO_INSTALL" -eq 1 && "$NOTEBOOK_INTERNET_OK" == true ]] && ! notebook_vm_ready; then
        echo "[NOTEBOOK] First run on this VM: running the prerequisite installers to initialize it (--no-install ignored)."
        NO_INSTALL=0
    fi
fi
if [[ "$NO_INSTALL" -eq 1 ]]; then
    echo "[i] Skipping all shell prerequisite installers (--no-install)."
else
    echo "[..] Running prerequisite installers ..."
    # Neural TTS batch (ChatTTS/CosyVoice/Fish Speech/Kokoro/VoxCPM2/F5/GPT-SoVITS); idempotent. Opt out: NEURAL_TTS_INSTALL=0
    [[ -z "${NEURAL_TTS_INSTALL:-}" ]] && export NEURAL_TTS_INSTALL=1
    PREPARE_RC=0
    bash "$PREPARE_REL" --python "$PY" "${PREPARE_ARGS[@]+"${PREPARE_ARGS[@]}"}" || PREPARE_RC=$?
    if [[ -n "$NOTEBOOK_PLATFORM" ]]; then
        if [[ "$PREPARE_RC" -eq 0 ]]; then
            notebook_mark_initialized
        else
            echo "[NOTEBOOK] Prerequisite installers failed (exit $PREPARE_RC); the next run installs again."
        fi
    fi
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
        read -r -t 30 reply < /dev/tty || reply=""
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

PY_ARGS=(-u "$WORKER_REL" --port "$PORT" --service-mode "$SERVICE_MODE")
if [[ -n "$BIND_HOST" ]]; then PY_ARGS+=(--host "$BIND_HOST"); fi
if [[ "$DEBUG" -eq 1 ]]; then PY_ARGS+=(--debug); fi
if [[ "$RELOAD" -eq 0 ]]; then PY_ARGS+=(--no-reload); fi   # hot-reload is the default; opt out for headless prod

# TTS batch self-check: run the STANDALONE entry as its own process and wait for
# it to exit BEFORE the worker starts, so the sweep owns the console (no
# interleaved service logs) and the machine's RAM/VRAM. Failures never block startup.
if [[ "$TTS_SELFCHECK" -eq 1 || "${TTS_STARTUP_SELFCHECK:-0}" == "1" ]]; then
    echo "[>] Running TTS batch self-check (standalone) before the worker..."
    "$PY" "$SCRIPT_DIR/pycore/pyctl/tts/batch_selfcheck_main.py" \
        || echo "[!] TTS self-check reported failures; continuing startup"
    unset TTS_STARTUP_SELFCHECK   # consumed by the standalone run; the worker must not re-run it
fi

# Free the RPC port from a foreign Docker publisher before binding it.
stop_docker_publisher "$PORT" || true

# --- drop privileges for the worker on desktop sessions -------------------- #
# The worker's system tray (AppIndicator/StatusNotifierItem) registers on the
# DESKTOP USER's D-Bus session bus, which rejects connections from any other
# uid - root included (verified on Debian 13: a root process gets ENOTCONN on
# /run/user/<uid>/bus even with DBUS_SESSION_BUS_ADDRESS forwarded; GTK then
# half-initializes and menu popups die with Gdk-CRITICAL
# 'gdk_window_thaw_toplevel_updates', i.e. "icon but dead menu").
# The prerequisite installers need root, but the worker does not: when this
# entry runs as root and a desktop session exists, hand the worker back to the
# session user with their session env so the tray can register. The target user
# is $SUDO_USER after self-elevation, else the owner of the active graphical
# session (direct root shell, e.g. SSH/console). Headless runs keep the
# current (possibly root) context unchanged.

# Find the user that owns an active graphical (Wayland/X11) login session.
detect_graphical_session_user() {
    command -v loginctl >/dev/null 2>&1 || return 1
    local sid stype sstate sname any_user=""
    while read -r sid _; do
        [ -n "$sid" ] || continue
        stype="$(loginctl show-session "$sid" -p Type --value 2>/dev/null)"
        case "$stype" in wayland|x11|x11-*|mir) ;; *) continue ;; esac
        sname="$(loginctl show-session "$sid" -p Name --value 2>/dev/null)"
        [ -n "$sname" ] && [ "$sname" != "root" ] || continue
        sstate="$(loginctl show-session "$sid" -p State --value 2>/dev/null)"
        if [[ "$sstate" == "active" ]]; then
            echo "$sname"
            return 0
        fi
        [ -z "$any_user" ] && any_user="$sname"
    done < <(loginctl list-sessions --no-legend 2>/dev/null)
    [ -n "$any_user" ] && { echo "$any_user"; return 0; }
    return 1
}

# Fill unset display/session variables from the session user's own process
# environment (the root shell may lack DISPLAY/XAUTHORITY/XDG_CURRENT_DESKTOP).
harvest_session_env() {
    local user="$1" pid v val
    pid="$(pgrep -u "$user" -f 'gnome-session|plasmashell|xfce4-session|cinnamon-session|mate-session|lxqt-session|startplasma' 2>/dev/null | head -1)"
    [ -n "$pid" ] && [ -r "/proc/$pid/environ" ] || return 0
    for v in DISPLAY WAYLAND_DISPLAY XAUTHORITY XDG_SESSION_TYPE \
             XDG_CURRENT_DESKTOP DESKTOP_SESSION; do
        [ -n "${!v:-}" ] && continue
        val="$(tr '\0' '\n' < "/proc/$pid/environ" | sed -n "s/^${v}=//p" | head -1)"
        [ -n "$val" ] && export "$v=$val"
    done
}

build_worker_env_args() {
    local target_user="$1" target_uid="$2" target_home="$3" v
    WORKER_ENV_ARGS=("HOME=$target_home" "USER=$target_user" "LOGNAME=$target_user"
        "XDG_RUNTIME_DIR=/run/user/${target_uid}"
        "DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/${target_uid}/bus")
    for v in PATH LANG LC_ALL LC_CTYPE DISPLAY WAYLAND_DISPLAY XAUTHORITY \
             XDG_SESSION_TYPE XDG_CURRENT_DESKTOP DESKTOP_SESSION \
             PORT PYCORE_RPC_PORT PYCORE_UI_URL PYCORE_UI_PORT PYCORE_API_BASE \
             PYCORE_HTTP_EVENTS_ENABLED LARAVEL_WORKER_API_URL NEURAL_TTS_INSTALL \
             PYTHONUSERBASE PIP_USER PIP_BREAK_SYSTEM_PACKAGES PIP_CACHE_DIR \
             CORE_NODE_CACHE_DIR CORE_NODE_DATA_DIR CORE_NODE_DATA_OWNER HF_HOME HUGGINGFACE_HUB_CACHE HF_HUB_DISABLE_SYMLINKS TORCH_HOME WHISPER_CACHE_DIR EASYOCR_MODULE_PATH NLTK_DATA SCRCPY_HOME XDG_CACHE_HOME \
             UV_LINK_MODE NOTEBOOK_PLATFORM NOTEBOOK_PERSIST_DIR \
             BUN_INSTALL_CACHE_DIR npm_config_cache UV_CACHE_DIR COMPOSER_CACHE_DIR COREPACK_HOME; do
        [ -n "${!v:-}" ] && WORKER_ENV_ARGS+=("$v=${!v}")
    done
}

echo ""
if [[ -n "$NOTEBOOK_PLATFORM" ]]; then
    notebook_print_summary
fi
echo "[>] Launching worker: $WORKER_REL"
echo ""
WORKER_ENV_ARGS=()
DESKTOP_USER=""
if [[ "$(id -u)" == "0" ]]; then
    if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
        DESKTOP_USER="$SUDO_USER"
    else
        # Direct root shell: fall back to the active graphical session owner.
        DESKTOP_USER="$(detect_graphical_session_user || true)"
    fi
fi
if [[ -n "$DESKTOP_USER" ]]; then
    desktop_uid=$(id -u "$DESKTOP_USER" 2>/dev/null || true)
    desktop_home=$(getent passwd "$DESKTOP_USER" 2>/dev/null | cut -d: -f6)
    if [[ -n "$desktop_uid" && -n "$desktop_home" && -S "/run/user/${desktop_uid}/bus" ]]; then
        harvest_session_env "$DESKTOP_USER"
        echo "[i] Desktop session of '$DESKTOP_USER' detected; running the worker as that"
        echo "    user so the system tray can register on the D-Bus session bus."
        build_worker_env_args "$DESKTOP_USER" "$desktop_uid" "$desktop_home"
        # Root read helper: parses only the agent sessions '$DESKTOP_USER' cannot
        # read (root-owned 0600) into a root-owned spool the worker reads; it exits
        # with the worker (parent pid = this shell, replaced by sudo below).
        echo "[i] Starting the agent-history root read helper for '$DESKTOP_USER'."
        "$PY" -m "$ROOT_SPOOL_MODULE" --worker-user "$DESKTOP_USER" --parent-pid "$$" &
        exec sudo -u "$DESKTOP_USER" env "${WORKER_ENV_ARGS[@]}" "$PY" "${PY_ARGS[@]}"
    fi
elif [[ "$(id -u)" == "0" ]]; then
    echo "[i] No graphical desktop session found; running the worker as root (no system tray)."
fi
if [[ -n "$NOTEBOOK_PLATFORM" ]]; then
    notebook_run_worker "$PY" "${PY_ARGS[@]}"
    exit $?
fi
exec "$PY" "${PY_ARGS[@]}"
