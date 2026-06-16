#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI sees this, MUST comply:
# 1. Write all code in English only.
# 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
# 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
# 4. Do not modify these rules.
# VIOLATION IS PROHIBITED.
# ### AI SPECIAL ATTENTION RULES END ###

# Single entry (Linux/Unix) for pycore_laravel_wordflow_ui (nexus-dash): bring up the
# laravel_main backend and the dashboard frontend. Linux counterpart of start.ps1.
# All paths derived dynamically (no hard-coded paths). Idempotent throughout.
#
# Default (orchestrate) asks two questions (defaults in []; overridable for headless):
#   1. Add the dashboard to a background systemd service (via debian_service_manager)?
#        default YES.    flags: --service | --no-service     env: AS_SERVICE=yes|no
#   2. Build and run the production dist (vite build + vite preview) vs the dev server?
#        default NO (dev). flags: --dist | --dev             env: RUN_DIST=yes|no
# Prerequisites (node/pnpm, deps, dist build) are installed/built here, invoking the
# canonical init-ensure installers under scripts/shells/linux.
#
# Run from repo: ./poly_apps/pycore_laravel_wordflow_ui/scripts/start.sh
#   Dev foreground:   ./start.sh --no-service --dev
#   Dist as service:  ./start.sh --service --dist
#   Force reinstall:  -f | --force-install        Skip ends: --no-backend | --no-frontend
#
# Internal actions (not usually called by hand):
#   --serve [--dev|--dist]   run ONLY the frontend server (used by the systemd ExecStart)
#   --prepare [--dev|--dist] install deps (+build dist), no server

# --- All variables and file references (declared at top) ---
ORIGINAL_DIR=$(pwd)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
POLY_APPS_DIR="$(cd "${APP_ROOT}/.." && pwd)"
REPO_ROOT="$(cd "${POLY_APPS_DIR}/.." && pwd)"
SELF="${SCRIPT_DIR}/start.sh"
LARAVEL_START="${POLY_APPS_DIR}/laravel_main/scripts/start.sh"
NODE_INSTALL_SCRIPT="${REPO_ROOT}/scripts/shells/linux/debian/install_shells/15_install_node_24.sh"
SERVICE_MANAGER="${REPO_ROOT}/scripts/shells/linux/common/debian_service_manager.sh"
SERVICE_NAME="ncore-nexus-dash"
SERVICE_DESC="Nexus Dash frontend (pycore_laravel_wordflow_ui)"
SERVICE_CPU="${SERVICE_CPU:-100%}"
SERVICE_MEM="${SERVICE_MEM:-1G}"
LOG_DIR="${REPO_ROOT}/.data/logs"
LARAVEL_LOG="${LOG_DIR}/laravel_main.start.log"
PACKAGE_JSON="${APP_ROOT}/package.json"
NODE_MODULES="${APP_ROOT}/node_modules"
VITE_BIN="${APP_ROOT}/node_modules/vite/bin/vite.js"
DIST_DIR="${APP_ROOT}/dist"
DIST_INDEX="${APP_ROOT}/dist/index.html"
# Fixed dashboard dev port (no env files). Matches config/constants.ts
# DEFAULT_FRONTEND_PORT and vite.config.ts; overridable only via the PORT env var.
DEV_PORT="${PORT:-13054}"
DEV_URL="http://localhost:${DEV_PORT}"
ACTION="orchestrate"
RUN_MODE=""
RUN_DIST="${RUN_DIST:-}"
AS_SERVICE="${AS_SERVICE:-}"
RUN_BACKEND=1
RUN_FRONTEND=1
FORCE_INSTALL="${FORCE_INSTALL:-}"
PNPM_BIN=""
NEED_INSTALL=""
NEED_BUILD=""
SUDO=""
GVDIR=""
EXEC_CMD=""
ARG=""
LARAVEL_PID=""
IDX=0
HEALTH_HTML=""
HEALTH_CSS=""
IP_LIST=""
IP=""

# Restore initial directory on any exit (normal, error, Ctrl+C)
trap 'cd "$ORIGINAL_DIR" 2>/dev/null || true' EXIT

# --- Logging helpers ---
log()  { printf '[nexus-dash] %s\n' "$1"; }
warn() { printf '[nexus-dash] %s\n' "$1"; }
err()  { printf '[nexus-dash] %s\n' "$1" >&2; }

# --- Prompt helpers (read from the controlling TTY; honor non-interactive) ---
# DEFAULT YES: empty / anything but n -> yes. No TTY -> yes.
ask_default_yes() {
    local msg="$1" reply=""
    if [ -t 0 ] && [ -r /dev/tty ]; then
        printf '%s [Y/n] ' "$msg" > /dev/tty
        read -r reply < /dev/tty || reply=""
    fi
    case "$reply" in [Nn]*) return 1 ;; *) return 0 ;; esac
}
# DEFAULT NO: empty / anything but y -> no. No TTY -> no.
ask_default_no() {
    local msg="$1" reply=""
    if [ -t 0 ] && [ -r /dev/tty ]; then
        printf '%s [y/N] ' "$msg" > /dev/tty
        read -r reply < /dev/tty || reply=""
    fi
    case "$reply" in [Yy]*) return 0 ;; *) return 1 ;; esac
}

# Resolve pnpm into PNPM_BIN: PATH -> corepack -> node init-ensure installer.
resolve_pnpm() {
    PNPM_BIN=""
    hash -r 2>/dev/null || true
    if command -v pnpm >/dev/null 2>&1; then PNPM_BIN="$(command -v pnpm)"; return 0; fi
    if command -v corepack >/dev/null 2>&1; then
        corepack enable >/dev/null 2>&1 || true
        corepack prepare pnpm@latest --activate >/dev/null 2>&1 || true
        hash -r 2>/dev/null || true
        if command -v pnpm >/dev/null 2>&1; then PNPM_BIN="$(command -v pnpm)"; return 0; fi
    fi
    return 1
}

# Ensure node + pnpm are available (installs node via the canonical .sh if missing).
ensure_node_pnpm() {
    if resolve_pnpm; then log "Using pnpm: $PNPM_BIN"; return 0; fi
    if ! node --version >/dev/null 2>&1 && [ -f "$NODE_INSTALL_SCRIPT" ]; then
        if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then SUDO="sudo"; else SUDO=""; fi
        GVDIR="${CORE_NODE_DATA_DIR:-/var/_core_node}/global_var"
        $SUDO mkdir -p "$GVDIR" 2>/dev/null || true
        printf 'true\n' | $SUDO tee "$GVDIR/INSTALL_NODE" >/dev/null 2>&1 || true
        log "node/pnpm not found. Invoking node init-ensure installer (INSTALL_NODE=true):"
        log "  $NODE_INSTALL_SCRIPT"
        bash "$NODE_INSTALL_SCRIPT" || warn "node init-ensure installer reported failure (continuing)."
        hash -r 2>/dev/null || true
        resolve_pnpm || true
    fi
    if [ -z "$PNPM_BIN" ]; then
        err "pnpm not found on PATH. Install: npm i -g pnpm  OR  corepack enable && corepack prepare pnpm@latest --activate"
        exit 1
    fi
    log "Using pnpm: $PNPM_BIN"
}

# True when the dev toolchain (vite) is present under node_modules.
vite_ready() { [ -f "$VITE_BIN" ]; }

# Idempotent dependency install (skips when node_modules + vite are present).
ensure_deps() {
    if [ ! -f "$PACKAGE_JSON" ]; then err "package.json not found at: $PACKAGE_JSON"; exit 1; fi
    NEED_INSTALL="$FORCE_INSTALL"
    if [ -z "$NEED_INSTALL" ]; then
        if [ ! -d "$NODE_MODULES" ]; then
            NEED_INSTALL=1
        elif [ -z "$(ls -A "$NODE_MODULES" 2>/dev/null)" ]; then
            NEED_INSTALL=1
        elif ! vite_ready; then
            warn "node_modules present but dev toolchain incomplete (vite missing); running pnpm install."
            NEED_INSTALL=1
        fi
    fi
    if [ -n "$NEED_INSTALL" ]; then
        log "Installing pnpm dependencies (idempotent)..."
        cd "$APP_ROOT" || exit 1
        if ! pnpm install; then err "pnpm install failed."; exit 1; fi
        if ! vite_ready; then
            err "pnpm install finished but vite is still missing. Remove node_modules + pnpm-lock.yaml, then re-run with --force-install."
            exit 1
        fi
        log "Dependencies ready."
        cd "$ORIGINAL_DIR" || true
    else
        log "Dependencies look complete; skipping install. Use --force-install to reinstall."
    fi
}

# Build the production dist once (only when missing or forced).
build_dist() {
    NEED_BUILD=""
    if [ -n "$FORCE_INSTALL" ] || [ ! -f "$DIST_INDEX" ]; then NEED_BUILD=1; fi
    if [ -n "$NEED_BUILD" ]; then
        log "Building production dist (pnpm run build -> vite build)..."
        cd "$APP_ROOT" || exit 1
        if ! pnpm run build; then err "pnpm run build failed."; exit 1; fi
        cd "$ORIGINAL_DIR" || true
    else
        log "dist/ present at ${DIST_DIR}; skipping build. Use --force-install to rebuild."
    fi
    if [ ! -f "$DIST_INDEX" ]; then err "dist build missing index.html at: $DIST_INDEX"; exit 1; fi
}

# True when a HEALTHY dashboard server already answers on DEV_PORT (HTML +
# compiled Tailwind v4 CSS). A stale v3/PostCSS server serves HTML but breaks
# /themes/index.css, so it must NOT be treated as healthy.
dashboard_healthy() {
    command -v curl >/dev/null 2>&1 || return 1
    HEALTH_HTML="$(curl -fsS --max-time 2 "http://localhost:${DEV_PORT}/pycore-manager" 2>/dev/null)" || return 1
    printf '%s' "$HEALTH_HTML" | grep -q 'Nexus Dash' || return 1
    HEALTH_CSS="$(curl -fsS --max-time 5 "http://localhost:${DEV_PORT}/themes/index.css" 2>/dev/null)" || return 1
    [ "${#HEALTH_CSS}" -ge 10000 ] || return 1
    if printf '%s' "$HEALTH_CSS" | grep -qE '@tailwind[[:space:]]+(base|components|utilities)'; then return 1; fi
    return 0
}

# Free DEV_PORT before starting (idempotent restart). Stops only stale dev
# servers (vite/node/pnpm); a non-dev holder is reported, never killed.
free_dev_port() {
    local port="$1" pids="" pid="" cmd=""
    if command -v ss >/dev/null 2>&1; then
        pids=$(ss -ltnpH 2>/dev/null | grep -E "[:.]${port}[[:space:]]" | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
    fi
    if [ -z "$pids" ] && command -v lsof >/dev/null 2>&1; then
        pids=$(lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null | sort -u)
    fi
    [ -z "$pids" ] && return 0
    for pid in $pids; do
        cmd=$(ps -p "$pid" -o args= 2>/dev/null)
        if printf '%s' "$cmd" | grep -qiE 'vite|node|pnpm'; then
            warn "Freeing port ${port}: stopping stale dev server PID ${pid}"
            kill "$pid" 2>/dev/null || true
        else
            warn "Port ${port} held by non-dev PID ${pid}: ${cmd}"
        fi
    done
    sleep 1
    if command -v ss >/dev/null 2>&1 && ss -ltnH 2>/dev/null | grep -qE "[:.]${port}[[:space:]]"; then return 1; fi
    if command -v lsof >/dev/null 2>&1 && [ -n "$(lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null)" ]; then return 1; fi
    return 0
}

# Print accessible URLs (LAN, excluding loopback).
print_urls() {
    if command -v ip >/dev/null 2>&1; then
        IP_LIST=$(ip -4 addr show 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -vE '^127\.|^0\.')
    elif command -v hostname >/dev/null 2>&1; then
        IP_LIST=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -vE '^127\.|^0\.|^$')
    fi
    log "Accessible URLs (ready to copy):"
    log "  ${DEV_URL}"
    if [ -n "$IP_LIST" ]; then
        for IP in $IP_LIST; do log "  http://${IP}:${DEV_PORT}"; done
    fi
}

# Foreground server (dev vite or built-dist preview). Frees the port first.
serve_dashboard() {
    if ! free_dev_port "$DEV_PORT"; then
        err "Port ${DEV_PORT} is still in use. Stop the holder, or start on another port: PORT=<other> bash $SELF"
        exit 1
    fi
    print_urls
    cd "$APP_ROOT" || exit 1
    if [ "$RUN_MODE" = "dist" ]; then
        log "Serving production dist (pnpm exec vite preview --port ${DEV_PORT} --strictPort --host 0.0.0.0)"
        pnpm exec vite preview --port "$DEV_PORT" --strictPort --host 0.0.0.0
    else
        log "Starting dev server (pnpm exec vite --port ${DEV_PORT} --strictPort --host 0.0.0.0)"
        pnpm exec vite --port "$DEV_PORT" --strictPort --host 0.0.0.0
    fi
}

# Register (or update) the dashboard systemd service via debian_service_manager.
# Writes /etc/systemd/system -> needs root; falls back to sudo. The service file
# is composed by create_systemd_service (resource limits + auto restart).
register_dashboard_service() {
    local exec_cmd="$1"
    if [ ! -f "$SERVICE_MANAGER" ]; then err "debian_service_manager not found: $SERVICE_MANAGER"; return 1; fi
    if [ "$(id -u)" -eq 0 ]; then
        # Isolate the manager's top-level side effects (it sources gvar_common.sh)
        # in a subshell so they cannot leak into this script.
        (
            # shellcheck disable=SC1090
            source "$SERVICE_MANAGER"
            create_systemd_service "$SERVICE_NAME" "$SERVICE_DESC" "$exec_cmd" "$APP_ROOT" "root" "always" "10s" "$SERVICE_CPU" "$SERVICE_MEM"
        ) || return 1
        systemctl enable "$SERVICE_NAME" >/dev/null 2>&1 || true
        systemctl restart "$SERVICE_NAME" || return 1
        systemctl status "$SERVICE_NAME" --no-pager -l || true
        return 0
    fi
    if command -v sudo >/dev/null 2>&1; then
        sudo bash -c '
            source "$1"
            create_systemd_service "$2" "$3" "$4" "$5" root always 10s "$6" "$7"
            systemctl enable "$2" >/dev/null 2>&1 || true
            systemctl restart "$2"
            systemctl status "$2" --no-pager -l || true
        ' _ "$SERVICE_MANAGER" "$SERVICE_NAME" "$SERVICE_DESC" "$exec_cmd" "$APP_ROOT" "$SERVICE_CPU" "$SERVICE_MEM"
        return $?
    fi
    err "Need root (or sudo) to register a systemd service. Re-run as root."
    return 1
}

# --- Parse arguments ---
for ARG in "$@"; do
    case "$ARG" in
        --serve) ACTION="serve" ;;
        --prepare) ACTION="prepare" ;;
        -f|--force-install) FORCE_INSTALL=1 ;;
        --dist) RUN_DIST="yes" ;;
        --dev) RUN_DIST="no" ;;
        --service) AS_SERVICE="yes" ;;
        --no-service) AS_SERVICE="no" ;;
        --no-backend) RUN_BACKEND="" ;;
        --no-frontend) RUN_FRONTEND="" ;;
    esac
done

log "Original directory: $ORIGINAL_DIR"
log "Working directory:  $APP_ROOT"

# =====================================================================
# Internal actions: serve (systemd ExecStart) and prepare (no server).
# These never prompt and never touch the backend.
# =====================================================================
if [ "$ACTION" = "serve" ] || [ "$ACTION" = "prepare" ]; then
    if [ "$RUN_DIST" = "yes" ]; then RUN_MODE="dist"; else RUN_MODE="dev"; fi
    log "Action: ${ACTION} | mode: ${RUN_MODE}"
    ensure_node_pnpm
    ensure_deps
    [ "$RUN_MODE" = "dist" ] && build_dist
    if [ "$ACTION" = "prepare" ]; then
        log "Prepare complete (${RUN_MODE} mode). Not starting a server."
        exit 0
    fi
    serve_dashboard
    exit $?
fi

# =====================================================================
# Default: orchestrate (prompts + backend + frontend).
# =====================================================================
if [ ! -f "$LARAVEL_START" ]; then
    err "Laravel start script not found: $LARAVEL_START (backend launch will be skipped)"
    RUN_BACKEND=""
fi

# Resolve the two choices (prompt only when not already set by flag/env).
if [ -z "$AS_SERVICE" ]; then
    if ask_default_yes "Add the dashboard to a background systemd service (via debian_service_manager)?"; then
        AS_SERVICE="yes"
    else
        AS_SERVICE="no"
    fi
fi
if [ -z "$RUN_DIST" ]; then
    if ask_default_no "Build and run the production dist (vite build + vite preview) instead of the dev server?"; then
        RUN_DIST="yes"
    else
        RUN_DIST="no"
    fi
fi
if [ "$RUN_DIST" = "yes" ]; then RUN_MODE="dist"; else RUN_MODE="dev"; fi

log "Frontend mode: $( [ "$RUN_MODE" = dist ] && echo 'PRODUCTION dist (vite build -> vite preview)' || echo 'DEV server (vite, hot reload)' )"
log "Background service: ${AS_SERVICE}"

# Launch plan
log "Launch plan:"
IDX=0
if [ -n "$RUN_BACKEND" ]; then
    IDX=$((IDX + 1)); log "  [$IDX] laravel_main backend -> $LARAVEL_START  [background -> $LARAVEL_LOG]"
fi
if [ -n "$RUN_FRONTEND" ]; then
    IDX=$((IDX + 1))
    if [ "$AS_SERVICE" = "yes" ]; then
        log "  [$IDX] nexus-dash frontend (${RUN_MODE}) -> systemd service ${SERVICE_NAME}"
    else
        log "  [$IDX] nexus-dash frontend (${RUN_MODE}) -> foreground"
    fi
fi

# Backend: launch in background (idempotent; laravel start.sh reuses the port).
if [ -n "$RUN_BACKEND" ]; then
    mkdir -p "$LOG_DIR" 2>/dev/null || true
    log "Launching laravel_main backend in background..."
    nohup bash "$LARAVEL_START" > "$LARAVEL_LOG" 2>&1 &
    LARAVEL_PID=$!
    log "laravel_main backend PID: $LARAVEL_PID  (logs: $LARAVEL_LOG)"
    log "  Tail: tail -f \"$LARAVEL_LOG\"   Stop: kill $LARAVEL_PID"
fi

# Frontend
if [ -n "$RUN_FRONTEND" ]; then
    if [ "$AS_SERVICE" = "yes" ]; then
        # Prerequisites FIRST (node/pnpm via init-ensure, deps, dist build) so the
        # service start is fast and offline-safe.
        log "Preparing frontend prerequisites..."
        ensure_node_pnpm
        ensure_deps
        [ "$RUN_MODE" = "dist" ] && build_dist
        # Compose + register the service that runs ONLY the frontend (--serve).
        EXEC_CMD="bash ${SELF} --serve --${RUN_MODE}"
        log "Registering systemd service ${SERVICE_NAME} (ExecStart: ${EXEC_CMD})..."
        if register_dashboard_service "$EXEC_CMD"; then
            log "Service ${SERVICE_NAME} registered and started."
            log "  Manage: systemctl {status|restart|stop} ${SERVICE_NAME}"
            log "  Logs:   journalctl -u ${SERVICE_NAME} -f"
        else
            err "Service registration failed. Run the frontend manually: bash $SELF --serve --${RUN_MODE}"
            exit 1
        fi
    else
        # Foreground (Ctrl+C to stop). Skip if a healthy server is already up.
        ensure_node_pnpm
        ensure_deps
        [ "$RUN_MODE" = "dist" ] && build_dist
        if dashboard_healthy; then
            log "Dashboard already running on ${DEV_URL} - skipping launch."
        else
            log "Launching nexus-dash frontend in foreground (Ctrl+C to stop)..."
            serve_dashboard
        fi
    fi
else
    log "Frontend skipped (--no-frontend). Backend (if started) keeps running in background."
fi

cd "$ORIGINAL_DIR" || true
