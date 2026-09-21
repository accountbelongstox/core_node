#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# pyservice.sh - Service entry point for the Pycore Module Caller
#                (Linux / macOS / Git-Bash / WSL).
#
# This is ONLY an entry point (same role as pyservice.ps1 on Windows: repo-root
# entry -> shared logic). All implementation lives in the common code area:
#   scripts/shells/linux/common/pyservice_entry.sh
# which runs the prerequisite installers and launches pycore/pycore_module_caller.py.
#
# Usage:
#   ./pyservice.sh 1                     # current local UI mode (default)
#   ./pyservice.sh 2                     # Relay UI intermediary mode
#   ./pyservice.sh 1 --no-install        # skip prereqs, just launch
#   ./pyservice.sh --port 8000 --debug   # launch on port 8000 in debug mode
#   ./pyservice.sh --no-reload           # disable backend hot-reload (.py -> restart)
#   ./pyservice.sh --only -- --whisper-model base   # only run prereqs
#
# Subcommands: run (default) | config | codesync | install | start | stop |
#   restart | status | uninstall | help.  Full documentation: `pyservice.sh help`
#   and the header of scripts/shells/linux/common/pyservice_entry.sh.
# ---------------------------------------------------------------------------
set -uo pipefail

# Resolve this script's directory (repo root), following symlinks.
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
PYSERVICE_ENTRY="$SCRIPT_DIR/scripts/shells/linux/common/pyservice_entry.sh"

if [[ ! -f "$PYSERVICE_ENTRY" ]]; then
    echo "[X] Shared entry implementation not found: $PYSERVICE_ENTRY" >&2
    exit 1
fi

export PYSERVICE_REPO_ROOT="$SCRIPT_DIR"
exec bash "$PYSERVICE_ENTRY" "$@"
