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
#   ./pyservice.sh --only -- --whisper-model base   # only run prereqs (args after
#                                                     # `--` go to prepare.sh)
# ---------------------------------------------------------------------------
set -euo pipefail

# Resolve this script's directory (repo root), following symlinks.
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"

BIND_HOST="0.0.0.0"
PORT="59000"
DEBUG=0
NO_INSTALL=0
ONLY=0
PREPARE_ARGS=()

# Parse args; everything after a bare `--` is forwarded to prepare.sh.
while [[ $# -gt 0 ]]; do
    case "$1" in
        --host)       BIND_HOST="$2"; shift 2 ;;
        --port)       PORT="$2";      shift 2 ;;
        --debug)      DEBUG=1;        shift   ;;
        --no-install) NO_INSTALL=1;   shift   ;;
        --only)       ONLY=1;         shift   ;;
        --)           shift; PREPARE_ARGS+=("$@"); break ;;
        *) echo "[!] Unknown argument: $1" >&2; shift ;;
    esac
done

# --- locate a Python 3 interpreter --------------------------------------- #
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

echo "======================================================"
echo " Pycore Service - entry point"
echo "======================================================"

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

# --- 2) launch the worker ------------------------------------------------ #
PY_ARGS=(-u "$WORKER_REL" --host "$BIND_HOST" --port "$PORT")
if [[ "$DEBUG" -eq 1 ]]; then PY_ARGS+=(--debug); fi

echo ""
echo "[>] Launching worker: $WORKER_REL"
echo ""
exec "$PY" "${PY_ARGS[@]}"
