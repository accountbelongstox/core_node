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

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="$2"; shift 2 ;;
        --force)  FORCE=1;     shift   ;;
        *) echo "[!] Unknown argument: $1" >&2; shift ;;
    esac
done

# Shared torch CPU/GPU guard ("外挂"): used to GPU-gate easyocr below. easyocr
# depends on torch; on a GPU-less host plain install pulls the default CUDA torch +
# ~4.3G nvidia-*, so we ensure the CPU build first (and repair after). Idempotent.
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")")" && pwd)"
TORCH_GUARD="$SCRIPT_DIR/../torch_cpu_guard.sh"
run_torch_guard() {
    [[ -f "$TORCH_GUARD" ]] || return 0
    bash "$TORCH_GUARD" --python "$PYTHON" "$@" || true
}

py_has_module() {
    "$PYTHON" -c "import importlib.util,sys; sys.exit(0 if importlib.util.find_spec('$1') else 1)" 2>/dev/null
}

echo "============================================================"
echo " Installing local OCR engines (easyocr)"
echo "============================================================"
echo "  python : $PYTHON"

# Windows-native OCR is unavailable off Windows; note and move on.
echo "[i] windows-native OCR (WinRT) is Windows-only; skipping on this platform."

# --- EasyOCR ------------------------------------------------------------- #
# NO --upgrade (don't fight a satisfied/locked opencv); skip-marker so a failed
# OPTIONAL install doesn't retry on every boot (--force clears it).
EASYOCR_SKIP="${CORE_NODE_CACHE_DIR:-/var/_core_node/cache}/ocr/.easyocr_skip"
if py_has_module easyocr && [[ "$FORCE" -eq 0 ]]; then
    echo "[OK] easyocr already installed; skipping."
    rm -f "$EASYOCR_SKIP" 2>/dev/null || true
elif [[ -f "$EASYOCR_SKIP" && "$FORCE" -eq 0 ]]; then
    echo "[skip] easyocr was already attempted and failed (cnocr covers OCR). Use --force to retry."
else
    # GPU gate (idempotent): ensure the CORRECT torch build is present BEFORE easyocr.
    # On a GPU-less host this installs/keeps the CPU build, so easyocr's resolver finds
    # torch satisfied and does NOT pull the default CUDA torch + ~4.3G nvidia-*.
    run_torch_guard
    echo "[..] pip install easyocr ..."
    if { "$PYTHON" -m pip install --break-system-packages easyocr 2>/dev/null || "$PYTHON" -m pip install easyocr; } && py_has_module easyocr; then
        echo "[OK] easyocr installed."
        rm -f "$EASYOCR_SKIP" 2>/dev/null || true
        # Idempotent safety net: if easyocr still forced a CUDA torch, switch it back to CPU.
        run_torch_guard --repair-only
    else
        mkdir -p "$(dirname "$EASYOCR_SKIP")"
        echo "easyocr install failed; skipped on subsequent boots. Delete this file or use --force to retry." > "$EASYOCR_SKIP"
        echo "[!] easyocr install failed; marked to skip future boots. cnocr/ai-vision still work."
    fi
fi

# Non-fatal by design: cnocr + ai-vision remain even if easyocr is absent.
exit 0
