#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# install_tts_offline.sh - Thin delegator for the offline-TTS prerequisite
#   (Sherpa-ONNX + model; MeloTTS opt-in) used as fallbacks by the pycore
#   voice-subtitle pipeline.
#
# Discovered & run by prepare.sh (pyservice). Forwards to the single source of
# truth, which also runs in the dd.sh install flow:
#
#     scripts/shells/linux/debian/install_shells/22_install_tts_offline.sh
#
# Installs sherpa-onnx + a Kokoro (zh/en) model by default. MeloTTS is opt-in
# (--melotts; pins transformers==4.27.4). GPT-SoVITS is not installed (the pycore
# client calls its api server on 127.0.0.1:9880 if present).
#
# Usage:
#   ./install_tts_offline.sh --python /usr/bin/python3
#   ./install_tts_offline.sh --python python3 --melotts --force
# ---------------------------------------------------------------------------
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
STEP_SCRIPT="$REPO_ROOT/scripts/shells/linux/debian/install_shells/22_install_tts_offline.sh"

if [[ ! -s "$STEP_SCRIPT" ]]; then
    echo "[X] offline-TTS canonical script not found: $STEP_SCRIPT" >&2
    exit 1
fi

echo "[i] Delegating offline-TTS install to: $STEP_SCRIPT"
# Forward all received flags (--python / --melotts / --force) unchanged.
bash "$STEP_SCRIPT" "$@"
exit $?
