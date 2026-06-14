#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# install_desktop_manager.sh - Prerequisite installer for the Desktop Manager UI
#   (React/Vite) used by the PySide6 webview. Runs `npm install` once (idempotent).
#
# Auto-discovered by prepare.sh. The UI is OPTIONAL: if Node is missing this skips
# with a warning (the service still runs; PySide6 falls back to /web/subtitle).
#
# Usage:
#   ./install_desktop_manager.sh --python python3        # --python ignored (Node prereq)
#   ./install_desktop_manager.sh --force                 # reinstall node_modules
# ---------------------------------------------------------------------------
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
UI_DIR="$SCRIPT_DIR/../../pyctl/desktop/desktop-manager"

FORCE=0
while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) shift 2 ;;     # accepted for prepare.sh compatibility; unused
        --force)  FORCE=1; shift ;;
        *) shift ;;
    esac
done

echo "============================================================"
echo " Installing Desktop Manager UI deps (npm)"
echo "============================================================"

if [[ ! -f "$UI_DIR/package.json" ]]; then
    echo "[skip] desktop-manager not found at $UI_DIR"; exit 0
fi
if ! command -v npm >/dev/null 2>&1; then
    echo "[skip] Node/npm not found on PATH. UI is optional; install Node 18+ to enable it."
    echo "       (apt install nodejs npm  /  brew install node)"
    exit 0
fi
if [[ -d "$UI_DIR/node_modules" && "$FORCE" -eq 0 ]]; then
    echo "[OK] node_modules present; skipping npm install."; exit 0
fi

echo "[..] npm install in $UI_DIR ..."
( cd "$UI_DIR" && npm install ) || { echo "[!] npm install error; UI may not start."; exit 0; }
echo "[OK] UI dependencies installed."
exit 0
