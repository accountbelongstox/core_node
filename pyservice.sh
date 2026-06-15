#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# pyservice.sh - Service entry point for the Pycore Module Caller
#                (Linux / macOS / Git-Bash / WSL).
#
# This is ONLY an entry point. It:
#   1. PREREQUISITES: runs pycore/scripts/iniscripts/prepare.sh, which installs
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
# Usage:
#   ./pyservice.sh                       # install prereqs, then launch 0.0.0.0:59000
#   ./pyservice.sh --no-install          # skip prereqs, just launch
#   ./pyservice.sh --port 8000 --debug   # launch on port 8000 in debug mode
#   ./pyservice.sh --reload              # dev backend hot-reload (.py -> restart)
#   ./pyservice.sh --only -- --whisper-model base   # only run prereqs (args after
#                                                     # `--` go to prepare.sh)
#
# Subcommands: run (default) | config | install | start | stop | restart |
#   status | uninstall | help.  The service subcommands are Linux/systemd only.
#
# ---------------------------------------------------------------------------
# Headless config CLI:  pyservice.sh config ...  -> python -m pycore.pyutils.pyservice_cli
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
#   - Code-sync role/peers  : pycore/pyutils/device_sync/code_sync_peers.json  (committed)
#
# ---------------------------------------------------------------------------
# systemd service (Linux):  sudo ./pyservice.sh install|start|stop|restart|status|uninstall
# ---------------------------------------------------------------------------
# `install` delegates to scripts/shells/linux/common/pycore_service.sh (part of
# the dd.sh call chain; reuses debian_service_manager.sh). The unit runs headless:
#   ExecStart=/bin/bash <repo>/pyservice.sh run --no-ui --no-install
#   WorkingDirectory=<repo>   User=<real user>   Restart=always
# On Windows there is no systemd: use the desktop UI's Settings -> Auto-start on
# boot toggle (a native .lnk in the common Startup folder). `config` is cross-platform.
#
# ---------------------------------------------------------------------------
# UI vs headless
# ---------------------------------------------------------------------------
# Desktop / with Node: `run` serves the unified shell poly_apps/laravel_dashboard
# (its pycore-manager end) at http://localhost:<UI_PORT>/pycore-manager, loaded by
# PySide6 via PYCORE_UI_URL. Backend is unchanged: rpc_v2 on :59000, a /pyapi
# reverse proxy, and a direct ws://host:59000/rpc/ws log stream (a global floating
# collapsible log panel is present on every pycore page). The old standalone React
# app pycore/pyctl/desktop/desktop-manager (dev server :15654) is superseded/legacy.
# Headless Linux (no Node / no display): only the legacy in-process /web/subtitle
# page is served and no Qt window/tray is created (those are Windows-only), so the
# worker is effectively an RPC server - configure it with `pyservice config ...`.
# ---------------------------------------------------------------------------
set -euo pipefail

# Resolve this script's directory (repo root), following symlinks.
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"

# Shared Python user-base (LINUX ONLY): prerequisites install here (see prepare.sh)
# and the worker must read from the SAME system directory, so packages installed by
# ANY user are visible to the running service. Default /opt/_core_node/pyuserbase (a
# system path every member can access, NOT under the repo); override via
# PYCORE_PYUSERBASE. Exported before both prepare AND the worker launch.
if [[ "$(uname -s)" == "Linux" ]]; then
    : "${PYCORE_PYUSERBASE:=/opt/_core_node/pyuserbase}"
    mkdir -p "$PYCORE_PYUSERBASE" 2>/dev/null || true
    if [[ ! -w "$PYCORE_PYUSERBASE" ]] && command -v sudo >/dev/null 2>&1; then
        sudo -n mkdir -p "$PYCORE_PYUSERBASE" 2>/dev/null || true
        sudo -n chmod 1777 "$PYCORE_PYUSERBASE" 2>/dev/null || true
    fi
    if [[ -w "$PYCORE_PYUSERBASE" ]]; then
        chmod 1777 "$PYCORE_PYUSERBASE" 2>/dev/null || true
        export PYCORE_PYUSERBASE
        export PYTHONUSERBASE="$PYCORE_PYUSERBASE"
    fi
fi

BIND_HOST="0.0.0.0"
PORT="59000"
DEBUG=0
RELOAD=0
NO_INSTALL=0
ONLY=0
NO_UI=0
UI_BUILD=0
UI_PORT="13054"
PREPARE_ARGS=()

# --- locate a Python 3 interpreter --------------------------------------- #
# Defined early so subcommands (config) can reuse it before the run path.
resolve_python() {
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

# --- usage --------------------------------------------------------------- #
print_usage() {
    cat <<EOF
pyservice.sh - entry point for the Pycore Module Caller

Usage:
  ./pyservice.sh [SUBCOMMAND] [options]

Subcommands:
  run          Launch the service (default if no subcommand is given)
  config       Edit/show headless config via the cross-platform Python CLI
               (forwards remaining args to: python -m pycore.pyutils.pyservice_cli config)
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
  --reload         Dev backend hot-reload (watch .py -> restart)
  --no-install     Skip the prerequisite-install step
  --only           Run ONLY the prerequisite step, then exit
  --no-ui          Do not launch the dashboard UI; use legacy /web/subtitle
  --ui-build       Build the dashboard UI and serve it (vite preview)
  --ui-port PORT   Port the UI server listens on (default: 13054)
  --               Everything after a bare -- is forwarded to prepare.sh

Examples:
  ./pyservice.sh                              # run: install prereqs, launch 0.0.0.0:59000
  ./pyservice.sh run --no-ui --port 8000      # run on port 8000, legacy UI
  ./pyservice.sh --port 8000                  # no subcommand == run
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
    run|config|install|start|stop|restart|status|uninstall)
        CMD="$1"; shift ;;
    help|-h|--help)
        print_usage; exit 0 ;;
esac

# config -> hand off to the cross-platform Python CLI (run from repo root).
if [[ "$CMD" == "config" ]]; then
    if ! PY="$(resolve_python)"; then
        echo "[X] Python 3 was NOT found; cannot run 'config'." >&2
        exit 1
    fi
    cd "$SCRIPT_DIR"
    exec "$PY" -m pycore.pyutils.pyservice_cli config "$@"
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
        --reload)     RELOAD=1;       shift   ;;
        --no-install) NO_INSTALL=1;   shift   ;;
        --only)       ONLY=1;         shift   ;;
        --no-ui)      NO_UI=1;        shift   ;;
        --ui-build)   UI_BUILD=1;     shift   ;;
        --ui-port)    UI_PORT="$2";   shift 2 ;;
        --)           shift; PREPARE_ARGS+=("$@"); break ;;
        *) echo "[!] Unknown argument: $1" >&2; shift ;;
    esac
done

echo "======================================================"
echo " Pycore Service - entry point"
echo "======================================================"
echo "[i] pyservice run - run \`pyservice.sh help\` for all commands (host=$BIND_HOST port=$PORT ui=$([[ "$NO_UI" -eq 1 ]] && echo legacy || echo 'dashboard (pycore-manager)'))"

if ! PY="$(resolve_python)"; then
    echo "[X] Python 3 was NOT found. Install it, then re-run:" >&2
    echo "      - apt install python3   (Debian/Ubuntu)" >&2
    echo "      - brew install python   (macOS)" >&2
    exit 1
fi
echo "[OK] Python : $("$PY" --version 2>&1)"
echo "       path : $PY"

PREPARE_REL="pycore/scripts/iniscripts/prepare.sh"
WORKER_REL="pycore/pycore_module_caller.py"

cd "$SCRIPT_DIR"

# --- 1) prerequisites ---------------------------------------------------- #
if [[ "$NO_INSTALL" -eq 1 ]]; then
    echo "[i] Skipping prerequisite install (--no-install)."
else
    echo "[..] Running prerequisite installers ..."
    if ! bash "$PREPARE_REL" --python "$PY" "${PREPARE_ARGS[@]+"${PREPARE_ARGS[@]}"}"; then
        echo "[!] Prerequisite step failed; continuing to launch."
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
    if prompt_default_yes "[?] Stop container ${cname:-$cid} to free port ${port}?"; then
        echo "[..] Stopping container ${cname:-$cid} ..."
        docker stop "$cid" >/dev/null 2>&1 || ${USE_SUDO:-} docker stop "$cid" >/dev/null 2>&1 || true
        return 0
    fi
    echo "[i] Left container ${cname:-$cid} running; port ${port} still occupied."
    return 1
}

# --- 2) launch the unified dashboard UI (unless --no-ui) ----------------- #
# The UI is the pure-Vite shell at poly_apps/laravel_dashboard. It runs as its own
# dev server (pnpm); PySide6 loads it via PYCORE_UI_URL (exported, pointing at the
# pycore-manager end, so the worker child inherits it). Falls back to the legacy
# /web/subtitle UI otherwise.
UI_PID=""
cleanup_ui() {
    if [[ -n "$UI_PID" ]]; then
        pkill -P "$UI_PID" 2>/dev/null || true
        kill "$UI_PID" 2>/dev/null || true
    fi
}
trap cleanup_ui EXIT INT TERM

UI_DIR="$SCRIPT_DIR/poly_apps/laravel_dashboard"
if [[ "$NO_UI" -eq 1 ]]; then
    echo "[i] --no-ui: using legacy /web/subtitle UI."
elif [[ ! -f "$UI_DIR/package.json" ]]; then
    echo "[i] dashboard UI not found; using legacy /web/subtitle UI."
elif ! command -v pnpm >/dev/null 2>&1; then
    echo "[i] pnpm not on PATH; using legacy /web/subtitle UI."
else
    # Free the UI port from a foreign Docker publisher first (host vite servers
    # are processes, not containers -> no-op; the reuse/kill logic below handles those).
    stop_docker_publisher "$UI_PORT" || true
    # Vite reads PORT for its dev-server port; the /pyapi proxy + WS target the
    # running pycore backend via PYCORE_API_BASE.
    export PORT="$UI_PORT"
    export PYCORE_UI_PORT="$UI_PORT"
    export PYCORE_API_BASE="http://localhost:$PORT"
    # Install deps only if missing.
    if [[ ! -d "$UI_DIR/node_modules" ]]; then
        echo "[..] Installing dashboard deps (pnpm install) ..."
        ( cd "$UI_DIR" && pnpm install )
    fi
    # REUSE a healthy dashboard already serving this port (dev mode only):
    # concurrent starts (boot autostart + manual run) must NOT kill each other's
    # dev server — the loser of the worker singleton would leave the winner's
    # webview with ERR_CONNECTION_REFUSED. Require shell HTML plus compiled
    # Tailwind CSS so a stale v3/PostCSS Vite process is never reused.
    UI_REUSE=0
    if [[ "$UI_BUILD" -ne 1 ]]; then
        if curl -fsS --max-time 2 "http://localhost:$UI_PORT/pycore-manager" 2>/dev/null | grep -q 'Nexus Dash'; then
            css_bytes="$(curl -fsS --max-time 5 "http://localhost:$UI_PORT/themes/index.css" 2>/dev/null | wc -c | tr -d ' ')"
            if [[ "${css_bytes:-0}" -ge 10000 ]] && ! curl -fsS --max-time 5 "http://localhost:$UI_PORT/themes/index.css" 2>/dev/null | grep -q '@tailwind base'; then
                UI_REUSE=1
            else
                echo "[!] Dashboard on port $UI_PORT serves HTML but CSS is broken (stale Vite/PostCSS). Will restart it."
            fi
        fi
    fi
    if [[ "$UI_REUSE" -eq 1 ]]; then
        echo "[OK] Reusing dashboard dev server already on http://localhost:$UI_PORT (not restarting it)"
        # UI_PID stays empty: we don't own this server, cleanup_ui must not kill it.
        export PYCORE_UI_URL="http://localhost:$UI_PORT/pycore-manager"
    else
    # Free the UI port FIRST: kill any stale UI server (an old desktop-manager or a
    # prior dashboard) still bound to it — otherwise the webview loads the stale
    # server shadowing this port and the UI "doesn't change".
    if command -v lsof >/dev/null 2>&1; then
        lsof -ti "tcp:$UI_PORT" 2>/dev/null | xargs -r kill -9 2>/dev/null || true
    elif command -v fuser >/dev/null 2>&1; then
        fuser -k "${UI_PORT}/tcp" 2>/dev/null || true
    fi
    if [[ "$UI_BUILD" -eq 1 ]]; then
        echo "[..] Building dashboard UI (pnpm build) ..."
        ( cd "$UI_DIR" && pnpm build )
        ( cd "$UI_DIR" && NODE_ENV=production pnpm exec vite preview --port "$UI_PORT" --strictPort --host 0.0.0.0 ) &
        UI_PID=$!
    else
        echo "[..] Starting dashboard dev server on http://localhost:$UI_PORT ..."
        # Explicit --port + --strictPort: bind THIS port deterministically rather than
        # silently falling back to a different Vite default, so the webview's
        # PYCORE_UI_URL host always matches the server we just started. (The dashboard's
        # vite.config.ts also defaults to 13054, so a standalone `pnpm dev` matches.)
        ( cd "$UI_DIR" && pnpm exec vite --port "$UI_PORT" --strictPort --host 0.0.0.0 ) &
        UI_PID=$!
    fi
    # Default the PySide6 webview to the pycore-manager end of the shell.
    export PYCORE_UI_URL="http://localhost:$UI_PORT/pycore-manager"
    # Wait (up to ~15s) for the UI to answer before the webview loads it.
    for i in $(seq 1 30); do
        if curl -fsS "http://localhost:$UI_PORT/pycore-manager" >/dev/null 2>&1; then break; fi
        sleep 0.5
    done
    echo "[OK] UI at $PYCORE_UI_URL (pid $UI_PID)"
    fi
fi

# --- 3) launch the worker ------------------------------------------------ #
# NOTE: run (not exec) so the EXIT trap can stop the UI afterwards.
PY_ARGS=(-u "$WORKER_REL" --host "$BIND_HOST" --port "$PORT")
if [[ "$DEBUG" -eq 1 ]]; then PY_ARGS+=(--debug); fi
if [[ "$RELOAD" -eq 1 ]]; then PY_ARGS+=(--reload); fi   # backend hot-reload (watch .py -> os.execv restart)

# Free the RPC port from a foreign Docker publisher before binding it.
stop_docker_publisher "$PORT" || true

echo ""
echo "[>] Launching worker: $WORKER_REL"
echo ""
"$PY" "${PY_ARGS[@]}"
CODE=$?
# Exit code 3 = the worker YIELDED to a newer running instance: that instance is
# (or may be) serving its webview from this UI server — leave it running.
if [[ "$CODE" -eq 3 && -n "$UI_PID" ]]; then
    echo "[i] Worker yielded to a newer instance; leaving UI server running (pid $UI_PID)."
    UI_PID=""
fi
exit $CODE
