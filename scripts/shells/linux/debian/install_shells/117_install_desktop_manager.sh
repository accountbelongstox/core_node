#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# install_desktop_manager.sh - Prerequisite installer for the UNIFIED dashboard
#   UI (poly_apps/pycore_laravel_wordnew_ui — its pycore-manager end is what the PySide6
#   webview loads via PYCORE_UI_URL). Runs `pnpm install` once (idempotent) to
#   pre-warm deps before the run step starts the Vite dev server.
#
#   The legacy standalone app pycore/pyctl/desktop/desktop-manager is SUPERSEDED
#   and no longer installed here (code is kept but unused).
#
# Invoked by prepare_pycore_prerequisites.sh (pyservice). The UI is OPTIONAL: if pnpm is missing this skips
# with a warning (the service still runs; PySide6 falls back to /web/subtitle).
# pyservice.sh's run step also installs deps on demand, so this just pre-warms.
#
# Usage:
#   ./install_desktop_manager.sh --python python3        # --python ignored (Node prereq)
#   ./install_desktop_manager.sh --force                 # reinstall node_modules
# ---------------------------------------------------------------------------
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
# iniscripts -> common -> linux -> shells -> scripts -> core_node (repo root, five up) -> poly_apps/pycore_laravel_wordnew_ui
UI_DIR="$(cd "$SCRIPT_DIR/../../../../.." && pwd)/poly_apps/pycore_laravel_wordnew_ui"

FORCE=0
while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) shift 2 ;;     # accepted for prepare_pycore_prerequisites.sh compatibility; unused
        --force)  FORCE=1; shift ;;
        *) shift ;;
    esac
done

echo "============================================================"
echo " Installing Dashboard UI deps (pnpm) - pycore_laravel_wordnew_ui"
echo "============================================================"

if [[ ! -f "$UI_DIR/package.json" ]]; then
    echo "[skip] pycore_laravel_wordnew_ui not found at $UI_DIR"; exit 0
fi
if ! command -v pnpm >/dev/null 2>&1; then
    echo "[skip] pnpm not found on PATH. UI is optional; install Node 18+ and pnpm to enable it."
    echo "       (npm install -g pnpm)"
    exit 0
fi
if [[ -d "$UI_DIR/node_modules" && "$FORCE" -eq 0 ]]; then
    echo "[OK] node_modules present; skipping pnpm install."; exit 0
fi

echo "[..] pnpm install in $UI_DIR ..."
( cd "$UI_DIR" && pnpm install ) || { echo "[!] pnpm install error; UI may not start."; exit 0; }
echo "[OK] Dashboard UI dependencies installed."
exit 0
