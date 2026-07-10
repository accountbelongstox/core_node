#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Python prerequisite packages installer (Linux — Debian/Ubuntu/Kali).
#
# Runs immediately AFTER 13_ensure_python.sh (pip confirmed) and 13_cuda_nvidia_prereq.sh
# (CUDA/driver when GPU present). Installs captcha/AI backend deps into $VENV_PYTHON3:
#   - torch + torchvision + torchaudio + ultralytics (YOLO) — one resolver pass
#   - paddlepaddle (CPU or GPU, driver-matched) + paddleocr + paddlex
#   - shared backend deps (fastapi, opencv, numpy, …)
#
# GPU/CPU: torch_cpu_guard.sh and paddle_cpu_guard.sh auto-select the correct wheel
# index from nvidia-smi; CPU-only hosts never pull CUDA/nvidia-* stacks.
# Python: 3.12 or 3.13 — whichever the system / venv provides (13_ensure_python).
# Idempotent: each bundle skips when imports already succeed.

SCRIPT_INDEX="14"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/venv_python_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/torch_cpu_guard.sh"
source "$PARENT_DIR_LEVEL_2/common/paddle_cpu_guard.sh"

PIPLOCK_LIB="$PARENT_DIR_LEVEL_2/common/base_libs/pip_lock.sh"
[ -f "$PIPLOCK_LIB" ] && . "$PIPLOCK_LIB"
command -v vpip >/dev/null 2>&1 || vpip() { "$@"; }

TARGET_PY=""
PY_VERSION=""
PIP_SYSFLAGS=()
OCR_BUNDLE=("paddleocr>=3.7.0" "paddlex>=3.7.0")
BACKEND_BUNDLE=("fastapi" "uvicorn[standard]" "psutil" "opencv-contrib-python" "pillow" "numpy" "scipy" "pyclipper" "shapely" "websocket-client")
TORCH_PROBE="import torch, torchvision, torchaudio, ultralytics"
OCR_PROBE="import paddleocr, paddlex"
DEPS_PROBE="import paddle, paddleocr, paddlex, fastapi, uvicorn, psutil, cv2, PIL, numpy, scipy, pyclipper, shapely, websocket"
ALL_PROBE="import torch, torchvision, torchaudio, ultralytics, paddle, paddleocr, paddlex, fastapi, uvicorn, psutil, cv2, PIL, numpy, scipy, pyclipper, shapely, websocket"

ipp_resolve_pip_flags() {
    PIP_SYSFLAGS=()
    if ! venv_is_venv_from_common "$TARGET_PY"; then
        PIP_SYSFLAGS=(--break-system-packages --no-user)
    fi
}

ipp_resolve_target_python() {
    TARGET_PY="$VENV_PYTHON3"
    if [ -n "$TARGET_PY" ] && [ -x "$TARGET_PY" ]; then
        return 0
    fi
    local candidate=""
    for candidate in python3.13 python3.12 python3 python; do
        if command -v "$candidate" >/dev/null 2>&1 \
            && "$candidate" -c 'import sys; sys.exit(0 if sys.version_info[:2] in ((3, 12), (3, 13)) else 1)' 2>/dev/null; then
            TARGET_PY="$candidate"
            return 0
        fi
    done
    return 1
}

ipp_verify_pip_ready() {
    if ! "$TARGET_PY" -m pip --version >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] [ERROR] pip is not available for $TARGET_PY."
        echo "[$SCRIPT_INDEX]        Run 13_ensure_python.sh first."
        return 1
    fi
    local pip_ver
    pip_ver="$("$TARGET_PY" -m pip --version 2>&1 | awk '{print $2}')"
    echo "[$SCRIPT_INDEX] pip ready: $pip_ver"
    return 0
}

ipp_report_cuda_state() {
    if tcg_gpu_present; then
        local cuda_ver=""
        if command -v nvidia-smi >/dev/null 2>&1; then
            cuda_ver="$(nvidia-smi 2>/dev/null | grep -o 'CUDA Version: [0-9.]*' | head -1)"
        fi
        echo "[$SCRIPT_INDEX] NVIDIA GPU detected ${cuda_ver:+($cuda_ver)} — GPU wheels when driver supports them."
    else
        echo "[$SCRIPT_INDEX] No NVIDIA GPU — CPU wheels for torch and paddle."
    fi
}

ipp_install_torch_yolo_bundle() {
    if "$TARGET_PY" -c "$TORCH_PROBE" >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] [SKIP] torch/torchvision/torchaudio/ultralytics already importable"
        return 0
    fi
    echo "[$SCRIPT_INDEX] Ensuring torch build (CPU/GPU guard)..."
    TCG_PYTHON="$TARGET_PY" tcg_ensure_torch_build
    echo "[$SCRIPT_INDEX] Installing ultralytics (YOLO) with torch bundle..."
    echo "[$SCRIPT_INDEX] $TARGET_PY -m pip install --upgrade ${PIP_SYSFLAGS[*]} ultralytics"
    if ! vpip "$TARGET_PY" -m pip install --upgrade "${PIP_SYSFLAGS[@]}" ultralytics; then
        echo "[$SCRIPT_INDEX] [ERROR] ultralytics install failed."
        return 1
    fi
    if ! "$TARGET_PY" -c "$TORCH_PROBE" >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] Upgrading torch/torchvision/torchaudio together (version sync)..."
        if ! vpip "$TARGET_PY" -m pip install --upgrade "${PIP_SYSFLAGS[@]}" torch torchvision torchaudio ultralytics; then
            echo "[$SCRIPT_INDEX] [ERROR] torch bundle install failed."
            return 1
        fi
    fi
    return 0
}

ipp_install_paddle_ocr_bundle() {
    if "$TARGET_PY" -c "$DEPS_PROBE" >/dev/null 2>&1; then
        echo "[$SCRIPT_INDEX] [SKIP] paddle ecosystem + backend deps already importable"
        return 0
    fi
    echo "[$SCRIPT_INDEX] Ensuring paddle build (CPU/GPU guard)..."
    PCG_PYTHON="$TARGET_PY" pcg_ensure_paddle_build
    echo "[$SCRIPT_INDEX] Installing paddleocr + paddlex + backend deps (single resolver pass)..."
    echo "[$SCRIPT_INDEX] $TARGET_PY -m pip install ${PIP_SYSFLAGS[*]} ${OCR_BUNDLE[*]} ${BACKEND_BUNDLE[*]}"
    if ! vpip "$TARGET_PY" -m pip install "${PIP_SYSFLAGS[@]}" "${OCR_BUNDLE[@]}" "${BACKEND_BUNDLE[@]}"; then
        echo "[$SCRIPT_INDEX] [ERROR] paddleocr/backend bundle install failed."
        return 1
    fi
    return 0
}

echo "[$SCRIPT_INDEX] ============================================================"
echo "[$SCRIPT_INDEX] Install python prerequisite packages (captcha/AI backends)"
echo "[$SCRIPT_INDEX] ============================================================"

if ! ipp_resolve_target_python; then
    echo "[$SCRIPT_INDEX] [ERROR] no Python 3.12/3.13 found (VENV_PYTHON3=$VENV_PYTHON3)."
    echo "[$SCRIPT_INDEX]        Run 13_ensure_python.sh first."
    exit 1
fi

PY_VERSION="$("$TARGET_PY" --version 2>&1)"
echo "[$SCRIPT_INDEX] Target interpreter: $TARGET_PY ($PY_VERSION)"
ipp_resolve_pip_flags
echo ""

if ! ipp_verify_pip_ready; then
    exit 1
fi
ipp_report_cuda_state
echo ""

if ! ipp_install_torch_yolo_bundle; then
    exit 1
fi
echo ""

if ! ipp_install_paddle_ocr_bundle; then
    exit 1
fi
echo ""

echo "[$SCRIPT_INDEX] Verifying all imports..."
if "$TARGET_PY" -c "$ALL_PROBE" >/dev/null 2>&1; then
    echo "[$SCRIPT_INDEX] [OK] all prerequisite packages importable in $TARGET_PY"
else
    echo "[$SCRIPT_INDEX] [WARN] some imports failed:"
    "$TARGET_PY" -c "$ALL_PROBE" 2>&1 | tail -8
    echo "[$SCRIPT_INDEX]        Re-run this script or install the missing package manually."
fi

echo ""
echo "[$SCRIPT_INDEX] Python prerequisite packages step completed."
