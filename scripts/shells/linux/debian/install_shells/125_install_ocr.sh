#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# install_ocr.sh - Prerequisite installer for the local OCR engines (Linux/Mac).
#
# Discovered & run by prepare_pycore_prerequisites.sh before pycore_module_caller.py launches. Sets up
# the LOCAL OCR engines for the voice-subtitle screenshot pipeline.
#
# Engine priority (orchestrator: pycore.pyutils.ocr.ocr_orchestrator):
#     1. windows  - Windows.Media.Ocr (WinRT). WINDOWS ONLY; not installable on
#                   Linux/Mac, so this script skips it here.
#     2. easyocr  - torch/GPU OCR (torch is already present in this env).
#     3. cnocr    - installed/loaded lazily by third_party.py; not handled here.
#
# On Linux the highest available engine is easyocr (then cnocr, then the
# AI-vision fallback). IDEMPOTENT: easyocr is skipped when it already imports.
#
# Usage:
#   ./install_ocr.sh --python /usr/bin/python3
#   ./install_ocr.sh --python python3 --force
# ---------------------------------------------------------------------------
set -uo pipefail

PYTHON="python3"
FORCE=0
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
COMMON_DIR="$SCRIPT_DIR/../../common"
TORCH_GUARD="$COMMON_DIR/torch_cpu_guard.sh"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="$2"; shift 2 ;;
        --force)  FORCE=1;     shift   ;;
        *) echo "[!] Unknown argument: $1" >&2; shift ;;
    esac
done

# Shared torch CPU/GPU guard ("wai gua"): used to GPU-gate easyocr below. easyocr
# depends on torch; on a GPU-less host plain install pulls the default CUDA torch +
# ~4.3G nvidia-*, so we ensure the CPU build first (and repair after). Idempotent.
source "$COMMON_DIR/pycore_package_policy_install.sh"
run_torch_guard() {
    bash "$TORCH_GUARD" --python "$PYTHON" "$@"
}

echo "============================================================"
echo " Installing local OCR engines (easyocr)"
echo "============================================================"
echo "  python : $PYTHON"

# Windows-native OCR is unavailable off Windows; note and move on.
echo "[i] windows-native OCR (WinRT) is Windows-only; skipping on this platform."

# Install only missing OCR distributions from the central policy, then recheck the
# shared torch ABI without forcing package replacement.
run_torch_guard
install_pycore_package_policy "$PYTHON" "[ocr]" ocr
run_torch_guard --repair-only

# Non-fatal by design: cnocr + ai-vision remain even if easyocr is absent.
