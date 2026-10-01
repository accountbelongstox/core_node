#!/usr/bin/env bash
SCRIPT_INDEX="125"
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
#     3. cnocr    - package from the central policy; CnSTD/CnOCR weights installed here.
#
# On Linux the highest available engine is easyocr (then cnocr, then the
# AI-vision fallback). IDEMPOTENT: packages install only when missing and weights are
# fetched only when absent (pycore never downloads OCR models at runtime).
# Weights: EasyOCR via easyocr's own downloader (https://www.jaided.ai/easyocr/documentation/),
# CnSTD/CnOCR from the breezedeus Hugging Face repos (https://cnocr.readthedocs.io/zh-cn/stable/models/),
# into EASYOCR_MODULE_PATH/model, CNSTD_HOME and CNOCR_HOME (shared cache).
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
source "$COMMON_DIR/tts_install_assets_common.sh"
source "$COMMON_DIR/base_libs/lib_gpu.sh"
. "$COMMON_DIR/shared_cache_env.sh"
: "${EASYOCR_MODULE_PATH:?EASYOCR_MODULE_PATH is not set; the shared cache is not writable}"
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

ocr_gpu_args=()
gpu_hardware_present && ocr_gpu_args=(--gpu)
ocr_failed=0
ocr_models_prefetch "$PYTHON" "[ocr] " easyocr || ocr_failed=1
ocr_models_prefetch "$PYTHON" "[ocr] " cn || ocr_failed=1
if [[ "${#ocr_gpu_args[@]}" -gt 0 ]]; then
    ocr_models_prefetch "$PYTHON" "[ocr] " cn --gpu || ocr_failed=1
fi
if [[ "$ocr_failed" -eq 1 ]]; then
    echo "[ocr] [!] OCR model download incomplete; will retry next run." >&2
    exit 1
fi
echo "[ocr] [OK] OCR weights present (EasyOCR: ${EASYOCR_MODULE_PATH}/model)."
