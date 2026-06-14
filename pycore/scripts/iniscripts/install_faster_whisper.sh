#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# install_faster_whisper.sh - Thin delegator for the faster-whisper prerequisite
#   (DEFAULT STT engine for the pycore "Video Extraction" feature).
#
# Discovered & run by prepare.sh (which pyservice.sh invokes), it forwards
# directly to the single source of truth in the Linux installer flow:
#
#     scripts/shells/linux/debian/install_shells/14_install_faster_whisper.sh
#
# That same Step script runs right after 13_ensure_python.sh in install.sh's
# numeric-ordered sweep, so dd.sh -> install installs faster-whisper immediately
# after Python. Keeping the logic in one place guarantees the installer flow and
# the pyservice prerequisite flow stay identical.
#
# Usage:
#   ./install_faster_whisper.sh --python /usr/bin/python3
#   ./install_faster_whisper.sh --python python3 --model base
#   ./install_faster_whisper.sh --force
# ---------------------------------------------------------------------------
set -uo pipefail

# Declare all variables at the beginning.
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
# Repo root = iniscripts -> scripts -> pycore -> <repo root> (three levels up).
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
STEP_SCRIPT="$REPO_ROOT/scripts/shells/linux/debian/install_shells/14_install_faster_whisper.sh"

if [[ ! -s "$STEP_SCRIPT" ]]; then
    echo "[X] faster-whisper Step script not found: $STEP_SCRIPT" >&2
    exit 1
fi

echo "[i] Delegating faster-whisper install to: $STEP_SCRIPT"
# Forward all received flags (--python / --model / --force) unchanged.
bash "$STEP_SCRIPT" "$@"
exit $?
