#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# sherpa_onnx_cpu_guard.sh - Idempotent sherpa-onnx CPU/GPU build guard (Linux).
#
# Existing sherpa-onnx distributions are preserved on every host. Missing packages
# use the default wheel and pip owns dependency compatibility.
#
# Mirrors scripts/shells/linux/common/{torch,onnxruntime}_cpu_guard.sh and is
# reused at the same key points:
#   - scripts/shells/linux/debian/install_shells/26_install_tts_offline.sh (install)
#   - scripts/shells/linux/common/iniscripts/prepare.sh                                 (repair-only)
# Python in-process counterpart (same policy, at first sherpa import):
#   pycore/pyfoundations/third_party.py::_ensure_sherpa_onnx_cpu_build_when_no_gpu()
#
# Safe to SOURCE (use the sog_* functions) or RUN directly. Usage:
#   bash sherpa_onnx_cpu_guard.sh                  # repair now (python3)
#   bash sherpa_onnx_cpu_guard.sh --python /path   # use a specific interpreter
#   bash sherpa_onnx_cpu_guard.sh --repair-only    # only fix a wrong build; never install when missing
#   source sherpa_onnx_cpu_guard.sh; sog_ensure_sherpa_onnx
#
# Env overrides (TORCH_FORCE_CUDA is shared with the torch/onnx guards):
#   TORCH_FORCE_CUDA=1 / SOG_FORCE_GPU=1   treat as GPU present (keep a '+cuda' build)
#   SOG_PYTHON=<path>                      interpreter (same as --python)
#   SOG_REPAIR_ONLY=1                      same as --repair-only
# ---------------------------------------------------------------------------

SOG_PKG="sherpa-onnx"

# Resolve a python interpreter (env/arg/python3/python). Echoes the path; 1 if none.
sog_resolve_python() {
    local p="${SOG_PYTHON:-}"
    if [[ -n "$p" ]]; then printf '%s' "$p"; return 0; fi
    for p in python3 python; do
        if command -v "$p" >/dev/null 2>&1; then command -v "$p"; return 0; fi
    done
    return 1
}

# 0 if an NVIDIA GPU is usable (or forced), 1 otherwise.
sog_gpu_present() {
    [[ "${TORCH_FORCE_CUDA:-0}" == "1" || "${SOG_FORCE_GPU:-0}" == "1" ]] && return 0
    command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi -L >/dev/null 2>&1
}

# 0 if sherpa-onnx is installed for interpreter $1.
sog_pkg_installed() {
    local metadata=""
    metadata="$("$1" -m pip show "$SOG_PKG" 2>/dev/null || true)"
    [[ "$metadata" == *"Name:"* ]]
}

# THE idempotent build guard. SOG_REPAIR_ONLY=1 -> never install when missing.
sog_ensure_sherpa_onnx() {
    local py repair_only="${SOG_REPAIR_ONLY:-0}"
    if ! py="$(sog_resolve_python)"; then
        echo "[sherpa-guard] No python interpreter found; skipping." >&2
        return 0
    fi

    if sog_pkg_installed "$py"; then
        echo "[sherpa-guard] sherpa-onnx is installed; preserving the current build."
    elif [[ "$repair_only" == "1" ]]; then
        echo "[sherpa-guard] sherpa-onnx is not installed -> nothing to repair."
    else
        echo "[sherpa-guard] sherpa-onnx is missing -> installing the default wheel."
        "$py" -m pip install --break-system-packages "$SOG_PKG" || true
    fi
    return 0
}

# Direct execution: parse flags and run the guard.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --python)      SOG_PYTHON="$2"; shift 2 ;;
            --repair-only) SOG_REPAIR_ONLY=1; shift ;;
            *) shift ;;
        esac
    done
    sog_ensure_sherpa_onnx
fi
