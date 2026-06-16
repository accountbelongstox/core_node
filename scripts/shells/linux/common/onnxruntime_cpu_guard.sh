#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# onnxruntime_cpu_guard.sh - Idempotent ONNX Runtime CPU/GPU build guard (Linux).
#
# THE PROBLEM: `onnxruntime-gpu` pulls nvidia CUDA/cuDNN wheels and is mutually
# exclusive with the CPU `onnxruntime`. On a host with NO NVIDIA GPU it is dead
# weight (and OCR via cnocr wants the CPU runtime there anyway). cnocr / other
# OCR paths can install onnxruntime-gpu, so a GPU runtime can appear on a GPU-less
# box - hence this guard, reused at the same key points as torch_cpu_guard.sh.
#
# THE GUARD - ONE idempotent routine, safe to call on every boot / install step:
#   NO GPU + onnxruntime-gpu installed -> uninstall it, ensure CPU onnxruntime,
#                                         and purge orphaned nvidia-* / triton wheels.
#   NO GPU + only CPU onnxruntime      -> no-op.
#   GPU present                        -> no-op (the in-process OcrInitializer installs
#                                         the GPU runtime with the right CUDA DLLs when
#                                         OCR actually runs).
#
# Safe to SOURCE (use the ocg_* functions) or RUN directly. Introduced at:
#   - scripts/shells/linux/debian/install_shells/13_ensure_python.sh (install time)
#   - pycore/scripts/iniscripts/prepare.sh (after every prerequisite install, repair-only)
# Python in-process counterpart (same policy, during OCR init):
#   pycore/pyfoundations/third_party.py OcrInitializer::_ensure_onnx_runtime_switch()
#
# Usage:
#   bash onnxruntime_cpu_guard.sh                  # repair now (python3)
#   bash onnxruntime_cpu_guard.sh --python /path   # use a specific interpreter
#   bash onnxruntime_cpu_guard.sh --repair-only    # never install CPU runtime when none present
#   source onnxruntime_cpu_guard.sh; ocg_ensure_onnx_runtime
#
# Env overrides (TORCH_FORCE_CUDA is shared with torch_cpu_guard.sh):
#   TORCH_FORCE_CUDA=1 / OCG_FORCE_GPU=1   treat as GPU present (keep onnxruntime-gpu)
#   OCG_PYTHON=<path>                      interpreter (same as --python)
#   OCG_REPAIR_ONLY=1                      same as --repair-only
# ---------------------------------------------------------------------------

OCG_GPU_PKG="onnxruntime-gpu"
OCG_CPU_PKG="onnxruntime"

# Resolve a python interpreter (env/arg/python3/python). Echoes the path; 1 if none.
ocg_resolve_python() {
    local p="${OCG_PYTHON:-}"
    if [[ -n "$p" ]]; then printf '%s' "$p"; return 0; fi
    for p in python3 python; do
        if command -v "$p" >/dev/null 2>&1; then command -v "$p"; return 0; fi
    done
    return 1
}

# 0 if an NVIDIA GPU is usable (or forced), 1 otherwise.
ocg_gpu_present() {
    [[ "${TORCH_FORCE_CUDA:-0}" == "1" || "${OCG_FORCE_GPU:-0}" == "1" ]] && return 0
    command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi -L >/dev/null 2>&1
}

# 0 if pip package $2 is installed for interpreter $1.
ocg_pkg_installed() {
    "$1" -m pip show "$2" >/dev/null 2>&1
}

# Uninstall every nvidia-* / triton wheel (orphaned after dropping onnxruntime-gpu).
ocg_purge_nvidia_wheels() {
    local py="$1" pkgs
    pkgs="$("$py" -m pip list --format=freeze 2>/dev/null | sed 's/==.*//' | grep -iE '^(nvidia-|triton$)' | tr '\n' ' ')"
    if [[ -n "${pkgs// /}" ]]; then
        echo "[onnx-guard] Removing orphaned CUDA wheels: $pkgs"
        "$py" -m pip uninstall -y $pkgs >/dev/null 2>&1 || true
    fi
}

# THE idempotent switch routine. OCG_REPAIR_ONLY=1 -> never install CPU runtime when none present.
ocg_ensure_onnx_runtime() {
    local py gpu_installed cpu_installed repair_only="${OCG_REPAIR_ONLY:-0}"
    if ! py="$(ocg_resolve_python)"; then
        echo "[onnx-guard] No python interpreter found; skipping." >&2
        return 0
    fi

    if ocg_gpu_present; then
        echo "[onnx-guard] GPU present; leaving ONNX runtime to the in-process OCR initializer."
        return 0
    fi

    ocg_pkg_installed "$py" "$OCG_GPU_PKG" && gpu_installed=1 || gpu_installed=0
    ocg_pkg_installed "$py" "$OCG_CPU_PKG" && cpu_installed=1 || cpu_installed=0

    if (( gpu_installed )); then
        echo "[onnx-guard] No GPU but $OCG_GPU_PKG installed -> switching to CPU $OCG_CPU_PKG + purging nvidia-*."
        "$py" -m pip uninstall -y "$OCG_GPU_PKG" >/dev/null 2>&1 || true
        if (( ! cpu_installed )); then
            "$py" -m pip install --break-system-packages --ignore-installed "$OCG_CPU_PKG" || true
        fi
        ocg_purge_nvidia_wheels "$py"
        return 0
    fi

    if (( cpu_installed )); then
        echo "[onnx-guard] No GPU, $OCG_CPU_PKG already active; ok."
    elif [[ "$repair_only" == "1" ]]; then
        echo "[onnx-guard] No GPU, no ONNX runtime installed -> nothing to repair."
    else
        echo "[onnx-guard] No GPU, no ONNX runtime -> installing CPU $OCG_CPU_PKG."
        "$py" -m pip install --break-system-packages --ignore-installed "$OCG_CPU_PKG" || true
    fi
    return 0
}

# Direct execution: parse flags and run the switch.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --python)      OCG_PYTHON="$2"; shift 2 ;;
            --repair-only) OCG_REPAIR_ONLY=1; shift ;;
            *) shift ;;
        esac
    done
    ocg_ensure_onnx_runtime
fi
