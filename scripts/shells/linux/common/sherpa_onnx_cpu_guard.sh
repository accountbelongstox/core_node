#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# sherpa_onnx_cpu_guard.sh - Idempotent sherpa-onnx CPU/GPU build guard (Linux).
#
# THE PROBLEM: `pip install sherpa-onnx` installs the CPU wheel by DEFAULT (pulls
# no CUDA libs). The GPU build is a version-tagged wheel from a separate flat index
#   pip install "sherpa-onnx==<ver>+cuda12.cudnn9" -f https://k2-fsa.github.io/sherpa/onnx/cuda.html
# that ALSO needs the system CUDA Toolkit + cuDNN. On a host with NO NVIDIA GPU the
# GPU build is dead weight and may not even import. So unlike torch (whose default
# wheel IS CUDA), sherpa-onnx can only become a GPU build by an explicit opt-in --
# this guard enforces that invariant in both directions:
#   NO GPU  -> ensure the CPU wheel; if a stray '+cuda' build is installed, switch
#             it back to CPU. A CPU host can NEVER end up on the GPU build.
#   GPU + SHERPA_ONNX_CUDA_SPEC set -> install that exact '+cuda' wheel from the
#             CUDA flat index. (No spec -> leave the CPU build: it runs fine on a
#             GPU box, and the TTS path uses the CPU provider anyway, so we never
#             GUESS a CUDA/cuDNN-specific wheel version.)
#   Already correct -> no-op.
#
# Mirrors scripts/shells/linux/common/{torch,onnxruntime}_cpu_guard.sh and is
# reused at the same key points:
#   - scripts/shells/linux/debian/install_shells/22_install_tts_offline.sh (install)
#   - pycore/scripts/iniscripts/prepare.sh                                 (repair-only)
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
#   SHERPA_ONNX_CUDA_SPEC=<ver+cudaXX...>  GPU build version to install when GPU present
#   SOG_CUDA_INDEX_URL=<url>               CUDA flat index (default k2-fsa cuda.html)
#   SOG_PYTHON=<path>                      interpreter (same as --python)
#   SOG_REPAIR_ONLY=1                      same as --repair-only
# ---------------------------------------------------------------------------

SOG_PKG="sherpa-onnx"
SOG_DEFAULT_CUDA_INDEX_URL="https://k2-fsa.github.io/sherpa/onnx/cuda.html"

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
    "$1" -m pip show "$SOG_PKG" >/dev/null 2>&1
}

# Echo the installed sherpa-onnx version string (e.g. "1.13.3+cuda12.cudnn9"), or "".
sog_installed_version() {
    "$1" -m pip show "$SOG_PKG" 2>/dev/null | sed -n 's/^Version:[[:space:]]*//p' | head -n1
}

# 0 if the installed build is a GPU ('+cuda') wheel.
sog_installed_is_cuda() {
    local ver
    ver="$(sog_installed_version "$1")"
    [[ "${ver,,}" == *"+cuda"* ]]
}

# THE idempotent build guard. SOG_REPAIR_ONLY=1 -> never install when missing.
sog_ensure_sherpa_onnx() {
    local py repair_only="${SOG_REPAIR_ONLY:-0}"
    local cuda_spec="${SHERPA_ONNX_CUDA_SPEC:-}"
    local cuda_index="${SOG_CUDA_INDEX_URL:-$SOG_DEFAULT_CUDA_INDEX_URL}"
    if ! py="$(sog_resolve_python)"; then
        echo "[sherpa-guard] No python interpreter found; skipping." >&2
        return 0
    fi

    if sog_gpu_present; then
        # GPU host: only act when an explicit CUDA spec is provided (we never guess a
        # CUDA/cuDNN-specific wheel version). Otherwise leave whatever is installed.
        if [[ -n "$cuda_spec" ]]; then
            local ver; ver="$(sog_installed_version "$py")"
            if [[ "$ver" == "$cuda_spec" ]]; then
                echo "[sherpa-guard] GPU present, sherpa-onnx already '$cuda_spec'; ok."
            else
                echo "[sherpa-guard] GPU present -> installing CUDA build '$cuda_spec' from $cuda_index."
                "$py" -m pip install --break-system-packages --ignore-installed \
                    "${SOG_PKG}==${cuda_spec}" -f "$cuda_index" || \
                    echo "[sherpa-guard] CUDA build install failed (needs system CUDA Toolkit + cuDNN)."
            fi
        else
            if sog_pkg_installed "$py"; then
                echo "[sherpa-guard] GPU present, no SHERPA_ONNX_CUDA_SPEC -> keeping current build (CPU build runs on GPU too)."
            elif [[ "$repair_only" != "1" ]]; then
                echo "[sherpa-guard] GPU present, no spec, sherpa-onnx missing -> installing CPU build (set SHERPA_ONNX_CUDA_SPEC for the GPU wheel)."
                "$py" -m pip install --break-system-packages --ignore-installed "$SOG_PKG" || true
            fi
        fi
        return 0
    fi

    # No GPU -> the CPU build is the ONLY valid one.
    if sog_pkg_installed "$py"; then
        if sog_installed_is_cuda "$py"; then
            echo "[sherpa-guard] No GPU but sherpa-onnx is a CUDA build ($(sog_installed_version "$py")) -> switching to the CPU wheel."
            "$py" -m pip install --break-system-packages --ignore-installed --force-reinstall "$SOG_PKG" || true
        else
            echo "[sherpa-guard] No GPU, sherpa-onnx already the CPU build; ok."
        fi
    elif [[ "$repair_only" == "1" ]]; then
        echo "[sherpa-guard] No GPU, sherpa-onnx not installed -> nothing to repair."
    else
        echo "[sherpa-guard] No GPU, sherpa-onnx missing -> installing the CPU build."
        "$py" -m pip install --break-system-packages --ignore-installed "$SOG_PKG" || true
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
