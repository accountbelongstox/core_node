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

# Python prerequisite packages installer (Linux - Debian/Ubuntu/Kali).
#
# Runs immediately AFTER 13_ensure_python.sh (pip confirmed) and 11_cuda_nvidia_prereq.sh
# (CUDA/driver when GPU present). Installs captcha/AI backend deps into $VENV_PYTHON3:
#   - torch + torchvision + torchaudio + ultralytics (YOLO) - one resolver pass
#   - paddlepaddle (CPU or GPU, driver-matched) + paddleocr + paddlex
#   - shared backend deps (fastapi, opencv, numpy, ...)
#
# GPU/CPU: torch_cpu_guard.sh and paddle_cpu_guard.sh auto-select the correct wheel
# index from nvidia-smi; CPU-only hosts never pull CUDA/nvidia-* stacks.
# Python: 3.12 or 3.13 - whichever the system / venv provides (13_ensure_python).
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
source "$PARENT_DIR_LEVEL_2/common/pycore_package_policy_install.sh"

PIPLOCK_LIB="$PARENT_DIR_LEVEL_2/common/base_libs/pip_lock.sh"
. "$PIPLOCK_LIB"

TARGET_PY=""
REQUESTED_PYTHON=""
PY_VERSION=""
PIP_SYSFLAGS=()
OCR_BUNDLE=()
BACKEND_BUNDLE=()
TORCH_BUNDLE=()
YOLO_BUNDLE=()
OPENCV_PACKAGE="${AI_OPENCV_PACKAGE:-opencv-python}"
OPENCV_COMPATIBLE_PACKAGES=()
TORCH_IMPORTS="${AI_TORCH_IMPORTS:-torch,torchvision,torchaudio,ultralytics}"
PADDLE_IMPORTS="${AI_PADDLE_IMPORTS:-paddle,paddleocr,paddlex}"
BACKEND_IMPORTS="${AI_BACKEND_COMMON_IMPORTS:-fastapi,uvicorn,psutil,cv2,PIL,numpy,scipy,pyclipper,shapely,websocket}"
IFS=',' read -ra OCR_BUNDLE <<< "${AI_OCR_PACKAGES:-paddleocr,paddlex}"
IFS=',' read -ra BACKEND_BUNDLE <<< "${AI_BACKEND_COMMON_PACKAGES:-fastapi,uvicorn[standard],psutil,opencv-python,pillow,numpy,scipy,pyclipper,shapely,websocket-client}"
IFS=',' read -ra TORCH_BUNDLE <<< "${AI_TORCH_HEALTH_PACKAGES:-torch,torchvision,torchaudio},${AI_YOLO_PACKAGES:-ultralytics}"
IFS=',' read -ra YOLO_BUNDLE <<< "${AI_YOLO_PACKAGES:-ultralytics}"
IFS=',' read -ra OPENCV_COMPATIBLE_PACKAGES <<< "${AI_OPENCV_COMPATIBLE_PACKAGES:-opencv-python,opencv-python-headless,opencv-contrib-python,opencv-contrib-python-headless}"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) REQUESTED_PYTHON="${2:-}"; shift 2 ;;
        --force) shift ;;
        *) shift ;;
    esac
done

ipp_resolve_pip_flags() {
    PIP_SYSFLAGS=()
    if ! venv_is_venv_from_common "$TARGET_PY"; then
        PIP_SYSFLAGS=(--break-system-packages --no-user)
    fi
}

ipp_resolve_target_python() {
    local candidate=""
    local version_marker=""
    if [[ -n "$REQUESTED_PYTHON" && -x "$REQUESTED_PYTHON" ]]; then
        TARGET_PY="$REQUESTED_PYTHON"
        return
    fi
    TARGET_PY="$VENV_PYTHON3"
    if [ -n "$TARGET_PY" ] && [ -x "$TARGET_PY" ]; then
        return
    fi
    for candidate in python3.13 python3.12 python3 python; do
        if command -v "$candidate" >/dev/null 2>&1; then
            version_marker="$("$candidate" -c 'import sys; print("__PYTHON_SUPPORTED__" if sys.version_info[:2] in ((3, 12), (3, 13)) else "__PYTHON_UNSUPPORTED__")' 2>/dev/null)"
        fi
        if [[ "$version_marker" == *"__PYTHON_SUPPORTED__"* ]]; then
            TARGET_PY="$candidate"
            return
        fi
    done
}

ipp_verify_pip_ready() {
    if [ ! -f "$VENV_PIP" ]; then
        echo "[$SCRIPT_INDEX] [ERROR] pip binary not found at $VENV_PIP."
        echo "[$SCRIPT_INDEX]        Run 13_ensure_python.sh first."
    else
        local pip_ver
        pip_ver="$("$VENV_PIP" --version 2>&1 | awk '{print $2}')"
        echo "[$SCRIPT_INDEX] pip ready: $pip_ver"
    fi
}

ipp_report_cuda_state() {
    if tcg_gpu_present; then
        local cuda_ver="" policy_tag=""
        cuda_ver="$(cuda_driver_version)"
        [[ -n "$cuda_ver" ]] && cuda_ver="CUDA Version: $cuda_ver"
        policy_tag="$(cuda_policy_tag)"
        if [[ -n "$policy_tag" ]]; then
            echo "[$SCRIPT_INDEX] NVIDIA GPU detected ${cuda_ver:+($cuda_ver)} - unified $policy_tag policy."
            echo "[$SCRIPT_INDEX]   torch  -> $(torch_cuda_index_url)"
            echo "[$SCRIPT_INDEX]   paddle -> $(paddle_cuda_index_url)"
        else
            echo "[$SCRIPT_INDEX] NVIDIA GPU detected but no common CUDA tier supports this driver; incompatible GPU packages are skipped."
        fi
    else
        echo "[$SCRIPT_INDEX] No NVIDIA GPU - CPU wheels for torch and paddle."
    fi
}

ipp_imports_healthy() {
    local modules="$1"
    PYCORE_IMPORT_MODULES="$modules" "$TARGET_PY" - <<'PY' >/dev/null 2>&1
import importlib
import os

for name in os.environ["PYCORE_IMPORT_MODULES"].split(","):
    if name.strip():
        importlib.import_module(name.strip())
PY
}

ipp_modules_present() {
    local modules="$1" probe_output
    probe_output="$(PYCORE_IMPORT_MODULES="$modules" "$TARGET_PY" - <<'PY' 2>/dev/null
import importlib.util
import os

missing = [
    name.strip()
    for name in os.environ["PYCORE_IMPORT_MODULES"].split(",")
    if name.strip() and importlib.util.find_spec(name.strip()) is None
]
print("__MODULES_PRESENT__" if not missing else "__MODULES_MISSING__")
PY
    )"
    [[ "$probe_output" == *"__MODULES_PRESENT__"* ]]
}

ipp_requirements_ready() {
    local requirement=""
    local all_ready=true
    for requirement in "$@"; do
        if ! pcpi_requirement_satisfied "$TARGET_PY" "$requirement"; then
            all_ready=false
            break
        fi
    done
    if [ "$all_ready" = true ]; then
        echo "true"
    else
        echo "false"
    fi
}

ipp_torch_bundle_ready() {
    ipp_requirements_ready "${TORCH_BUNDLE[@]}"
}

ipp_deps_bundle_ready() {
    if [ "$(ipp_requirements_ready "${OCR_BUNDLE[@]}" "${BACKEND_BUNDLE[@]}")" = "true" ] && pcg_paddle_dist_present "$TARGET_PY"; then
        echo "true"
    else
        echo "false"
    fi
}

ipp_report_import_failures() {
    local modules="$1" label="$2" module=""
    local -a candidates=() failed=()
    IFS=',' read -ra candidates <<< "$modules"
    for module in "${candidates[@]}"; do
        if ! ipp_imports_healthy "$module"; then
            failed+=("$module")
        fi
    done
    if [[ ${#failed[@]} -gt 0 ]]; then
        echo "[$SCRIPT_INDEX]        $label: ${failed[*]}"
    fi
}

ipp_report_missing_modules() {
    local modules="$1" label="$2" module=""
    local -a candidates=() missing=()
    IFS=',' read -ra candidates <<< "$modules"
    for module in "${candidates[@]}"; do
        if ! ipp_modules_present "$module"; then
            missing+=("$module")
        fi
    done
    if [[ ${#missing[@]} -gt 0 ]]; then
        echo "[$SCRIPT_INDEX]        $label: ${missing[*]}"
    fi
}

ipp_sync_opencv_distribution() {
    local package="" installed_package=""
    for package in "${OPENCV_COMPATIBLE_PACKAGES[@]}"; do
        if "$VENV_PIP" show "$package" >/dev/null 2>&1; then
            installed_package="$package"
            break
        fi
    done
    if [[ -n "$installed_package" ]] && pcpi_import_present "$TARGET_PY" cv2; then
        echo "[$SCRIPT_INDEX] [SKIP] OpenCV is provided by $installed_package"
        return 0
    fi
    if [[ -n "$installed_package" ]]; then
        echo "[$SCRIPT_INDEX] OpenCV metadata exists but cv2 is unavailable; asking pip to repair $installed_package ..."
        vpip "$VENV_PIP" install "${PIP_SYSFLAGS[@]}" "$installed_package" \
            && pcpi_import_present "$TARGET_PY" cv2
        return
    fi
    echo "[$SCRIPT_INDEX] OpenCV is missing; installing $OPENCV_PACKAGE ..."
    vpip "$VENV_PIP" install "${PIP_SYSFLAGS[@]}" "$OPENCV_PACKAGE" \
        && pcpi_import_present "$TARGET_PY" cv2
}

ipp_install_torch_yolo_bundle() {
    echo "[$SCRIPT_INDEX] Ensuring canonical torch build (CPU/GPU guard)..."
    TCG_PYTHON="$TARGET_PY" tcg_ensure_torch_build
    if [ "$(ipp_torch_bundle_ready)" = "true" ]; then
        echo "[$SCRIPT_INDEX] [SKIP] torch/torchvision/torchaudio/ultralytics already present"
        return
    fi
    echo "[$SCRIPT_INDEX] Installing ultralytics (YOLO) with torch bundle..."
    echo "[$SCRIPT_INDEX] $VENV_PIP install ${PIP_SYSFLAGS[*]} ${YOLO_BUNDLE[*]}"
    vpip "$VENV_PIP" install "${PIP_SYSFLAGS[@]}" "${YOLO_BUNDLE[@]}"
    if [ "$(ipp_torch_bundle_ready)" != "true" ]; then
        echo "[$SCRIPT_INDEX] Rechecking the torch package group after dependency installation..."
        TCG_PYTHON="$TARGET_PY" tcg_ensure_torch_build
    fi
    if [ "$(ipp_torch_bundle_ready)" != "true" ]; then
        echo "[$SCRIPT_INDEX] [ERROR] torch bundle remains incomplete after repair."
        ipp_report_import_failures "$TORCH_IMPORTS" "failed imports"
    fi
}

ipp_install_paddle_ocr_bundle() {
    echo "[$SCRIPT_INDEX] Ensuring canonical paddle build (CPU/GPU guard)..."
    PCG_PYTHON="$TARGET_PY" pcg_ensure_paddle_build
    if [ "$(ipp_deps_bundle_ready)" = "true" ]; then
        echo "[$SCRIPT_INDEX] [SKIP] paddle ecosystem + backend deps already importable"
        return
    fi
    echo "[$SCRIPT_INDEX] Installing paddleocr + paddlex + backend deps (single resolver pass)..."
    echo "[$SCRIPT_INDEX] $VENV_PIP install ${PIP_SYSFLAGS[*]} ${OCR_BUNDLE[*]} ${BACKEND_BUNDLE[*]}"
    vpip "$VENV_PIP" install "${PIP_SYSFLAGS[@]}" "${OCR_BUNDLE[@]}" "${BACKEND_BUNDLE[@]}"
    if [ "$(ipp_deps_bundle_ready)" != "true" ]; then
        echo "[$SCRIPT_INDEX] [ERROR] paddle/backend bundle remains unhealthy after repair."
        ipp_report_import_failures "$PADDLE_IMPORTS" "failed core imports"
        ipp_report_missing_modules "$BACKEND_IMPORTS" "missing backend modules"
    fi
}

echo "[$SCRIPT_INDEX] ============================================================"
echo "[$SCRIPT_INDEX] Install python prerequisite packages (captcha/AI backends)"
echo "[$SCRIPT_INDEX] ============================================================"

if ipp_resolve_target_python; then
    PY_VERSION="$("$TARGET_PY" --version 2>&1)"
    echo "[$SCRIPT_INDEX] Target interpreter: $TARGET_PY ($PY_VERSION)"
    ipp_resolve_pip_flags
    echo ""
else
    echo "[$SCRIPT_INDEX] [ERROR] no Python 3.12/3.13 found (VENV_PYTHON3=$VENV_PYTHON3)."
    echo "[$SCRIPT_INDEX]        Run 13_ensure_python.sh first."
fi

if [[ -n "$TARGET_PY" ]] && [ -f "$VENV_PIP" ]; then
    ipp_verify_pip_ready
    ipp_report_cuda_state
    echo ""
    ipp_install_torch_yolo_bundle
    echo ""
    ipp_install_paddle_ocr_bundle
    echo ""
    install_pycore_package_policy "$TARGET_PY" "[$SCRIPT_INDEX]"
    echo ""
    ensure_shared_transformers_from_common_functions "$TARGET_PY"
    echo ""
    ipp_sync_opencv_distribution
    echo ""

    echo "[$SCRIPT_INDEX] Verifying core imports and backend module availability..."
    if [ "$(ipp_torch_bundle_ready)" = "true" ] && [ "$(ipp_deps_bundle_ready)" = "true" ]; then
        echo "[$SCRIPT_INDEX] [OK] all prerequisite packages are ready in $TARGET_PY"
    else
        echo "[$SCRIPT_INDEX] [WARN] some required packages remain unavailable:"
        ipp_report_import_failures "$TORCH_IMPORTS" "failed torch imports"
        ipp_report_import_failures "$PADDLE_IMPORTS" "failed paddle imports"
        ipp_report_missing_modules "$BACKEND_IMPORTS" "missing backend modules"
        echo "[$SCRIPT_INDEX]        Re-run this script to resume the idempotent repair."
    fi
fi

echo ""
echo "[$SCRIPT_INDEX] Python prerequisite packages step completed."
