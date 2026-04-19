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
if [[ -d "$CORE_NODE_ROOT/webclaude_group" ]]; then
WEBCLAUDE_DATA_DIR="${WEBCLAUDE_DATA_DIR:-$CORE_NODE_ROOT/webclaude_group/.data}"
  mkdir -p "$WEBCLAUDE_DATA_DIR/cache"
fi
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

WC_SVC_HELPER=""
if [[ -d "$CORE_NODE_ROOT/webclaude_group" ]]; then
  WC_SVC_HELPER="$CORE_NODE_ROOT/webclaude_group/scripts/lib/webclaude_linux_service.sh"
fi
if [[ -f "$WC_SVC_HELPER" ]]; then
  # shellcheck source=/dev/null
  source "$WC_SVC_HELPER"
  _q_py=$(printf %q "$(command -v python3)")
  _q_cn=$(printf %q "$CORE_NODE_ROOT")
  if [ "$DEV_MODE" = true ]; then
    _q_dev=$(printf %q "$APP_ROOT/scripts/dev_reload.py")
    SVC_EXEC="/bin/bash -lc 'cd ${_q_cn} && exec ${_q_py} -u ${_q_dev}'"
    if wc_offer_systemd_service "webclaude-host" "WebClaude Claude Host (dev reload)" "$CORE_NODE_ROOT" "$SVC_EXEC" ""; then
      exit 0
    fi
  else
    SVC_EXEC="/bin/bash -lc 'cd ${_q_cn} && exec ${_q_py} -u pymain.py app=claude_host'"
    if wc_offer_systemd_service "webclaude-host" "WebClaude Claude Host" "$CORE_NODE_ROOT" "$SVC_EXEC" ""; then
      exit 0
    fi
  fi
fi

if [ "$DEV_MODE" = true ]; then
  echo "[INFO] Starting in dev mode with hot-reload..."
  python3 -u "$APP_ROOT/scripts/dev_reload.py"
else
  python3 -u pymain.py app=claude_host
fi
