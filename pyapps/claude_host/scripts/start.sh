#!/usr/bin/env bash
# Launch claude_host via core_node's pyapp launcher.
# Installs dependencies if websockets is missing.
#
# Usage:
#   ./start.sh          # Normal start
#   ./start.sh --dev    # Hot-reload mode (auto-restarts on *.py changes)

set -euo pipefail

DEV_MODE=false
for arg in "$@"; do
  case "$arg" in
    --dev) DEV_MODE=true ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CORE_NODE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
PREV_DIR="$(pwd)"

cleanup() {
  cd "$PREV_DIR" || true
}
trap cleanup EXIT INT TERM

cd "$CORE_NODE_ROOT"

if ! command -v python3 >/dev/null 2>&1; then
  echo "[ERROR] python3 not found in PATH."
  exit 1
fi

if ! python3 -c "import websockets" >/dev/null 2>&1; then
  echo "[INFO] Installing dependencies (pip)..."
  python3 -m pip install -q -r "$SCRIPT_DIR/../requirements.txt"
fi

# Detect Debian/Ubuntu and install system dependencies if needed
if command -v apt-get >/dev/null 2>&1; then
  # Debian/Ubuntu detected - ensure python3-venv is available if needed
  if ! dpkg -s python3-venv >/dev/null 2>&1; then
    echo "[INFO] Debian/Ubuntu detected. Consider installing: sudo apt-get install python3-venv"
  fi
elif command -v dnf >/dev/null 2>&1; then
  echo "[INFO] Fedora/RHEL detected."
elif command -v pacman >/dev/null 2>&1; then
  echo "[INFO] Arch Linux detected."
fi

# Show configuration hints
if [ -z "${CENTRAL_SERVER_URL:-}" ] && [ -z "${GATEWAY_URL:-}" ]; then
  echo "[WARN] CENTRAL_SERVER_URL (or GATEWAY_URL) is not set."
fi
if [ -z "${HOST_TOKEN:-}" ]; then
  echo "[WARN] HOST_TOKEN is not set. Authentication with gateway may fail."
fi
if [ -n "${CENTER_SERVER_URL:-}" ]; then
  echo "[INFO] Center server registration enabled: $CENTER_SERVER_URL"
fi

if [ "$DEV_MODE" = true ]; then
  echo "[INFO] Starting in dev mode with hot-reload..."
  python3 -u "$APP_ROOT/scripts/dev_reload.py"
else
  python3 -u scripts/pycore/pymain.py app=claude_host
fi
