#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# install_edge_tts.sh - Thin delegator for the edge-tts prerequisite (DEFAULT
#   text-to-speech engine for the pycore voice-subtitle pipeline).
#
# Discovered & run by prepare.sh (which pyservice.sh invokes), it forwards
# directly to the single source of truth in the Linux installer flow:
#
#     scripts/shells/linux/debian/install_shells/21_install_edge_tts.sh
#
# That same numbered script runs after 13_ensure_python.sh in install.sh's
# numeric-ordered sweep, so dd.sh -> install installs edge-tts in the main flow
# too. Keeping the logic in one place guarantees the installer flow and the
# pyservice prerequisite flow stay identical.
#
# The canonical script installs the LATEST edge-tts (>= 7.2.4; the old 7.2.1 pin
# is now harmful — old versions 403 on a stale handshake). A persistent 403 at
# synth time is rate-limit / region blocking, not a version issue — EDGE_TTS_PROXY.
#
# Usage:
#   ./install_edge_tts.sh --python /usr/bin/python3
#   ./install_edge_tts.sh --python python3 --force
# ---------------------------------------------------------------------------
set -uo pipefail

# Declare all variables at the beginning.
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
# Repo root = iniscripts -> scripts -> pycore -> <repo root> (three levels up).
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
STEP_SCRIPT="$REPO_ROOT/scripts/shells/linux/debian/install_shells/21_install_edge_tts.sh"

if [[ ! -s "$STEP_SCRIPT" ]]; then
    echo "[X] edge-tts canonical script not found: $STEP_SCRIPT" >&2
    exit 1
fi

echo "[i] Delegating edge-tts install to: $STEP_SCRIPT"
# Forward all received flags (--python / --force) unchanged.
bash "$STEP_SCRIPT" "$@"
exit $?
