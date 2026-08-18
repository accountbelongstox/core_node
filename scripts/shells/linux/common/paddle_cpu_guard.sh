#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# paddle_cpu_guard.sh - Idempotent PaddlePaddle CPU/GPU build guard (Linux).
#
# On Linux x86_64, `pip install paddlepaddle-gpu` from the wrong CUDA index or
# installing GPU wheels on a CPU-only host wastes disk and breaks OCR. Several
# install paths pull paddle transitively (paddleocr, paddlex), so this guard is
# reused at key points — same policy as torch_cpu_guard.sh.
#
#   GPU present + driver usable -> paddlepaddle-gpu from driver-matched index.
#   NO GPU                      -> paddlepaddle from the CPU index; uninstall GPU pkg.
#   Already correct             -> no-op.
#
# Safe to SOURCE (pcg_* functions) or RUN directly. Python 3.12/3.13 on
# Debian/Ubuntu/Kali (system interpreter or $VENV_PYTHON3 venv). Introduced at:
#   - scripts/shells/linux/debian/install_shells/15_install_python_prereq_packages.sh
#   - scripts/shells/linux/common/iniscripts/prepare.sh (repair-only)
#
# Usage:
#   bash paddle_cpu_guard.sh
#   bash paddle_cpu_guard.sh --python /path
#   bash paddle_cpu_guard.sh --repair-only
#   source paddle_cpu_guard.sh; pcg_ensure_paddle_build
#
# Env overrides:
#   PADDLE_FORCE_CUDA=1   treat as GPU present
#   PCG_PYTHON=<path>     interpreter (same as --python)
#   PCG_REPAIR_ONLY=1     same as --repair-only
# ---------------------------------------------------------------------------

PCG_CPU_INDEX_URL="https://www.paddlepaddle.org.cn/packages/stable/cpu/"
PCG_CPU_PACKAGE="${AI_PADDLE_CPU_PACKAGE:-paddlepaddle}"
PCG_GPU_PACKAGE="${AI_PADDLE_GPU_PACKAGE:-paddlepaddle-gpu}"

_PCG_PIPLOCK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/base_libs/pip_lock.sh"
. "$_PCG_PIPLOCK"

_PCG_CUDAIDX="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/base_libs/cuda_index.sh"
_PCG_LIBGPU="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/base_libs/lib_gpu.sh"
. "$_PCG_CUDAIDX"
. "$_PCG_LIBGPU"
PCG_CPU_INDEX_URL="${AI_PADDLE_CPU_INDEX:-$PCG_CPU_INDEX_URL}"

pcg_resolve_python() {
    local p="${PCG_PYTHON:-}"
    if [[ -n "$p" ]]; then printf '%s' "$p"; return 0; fi
    for p in python3 python; do
        if command -v "$p" >/dev/null 2>&1; then command -v "$p"; return 0; fi
    done
    return 1
}

pcg_pip_sysflags() {
    local py="$1" flags=()
    if [ ! -f "$(dirname "$py")/../pyvenv.cfg" ]; then
        flags=(--break-system-packages --no-user)
    fi
    printf '%s\n' "${flags[@]}"
}

pcg_gpu_present() {
    if [[ "${PADDLE_FORCE_CUDA:-0}" == "1" ]]; then
        TORCH_FORCE_CUDA=1 gpu_present
    else
        gpu_present
    fi
}

# Echo paddle build state: "" (missing), "cpu", or "gpu".
pcg_paddle_build_state() {
    local py="$1" output
    output="$("$py" - <<'PY' 2>/dev/null
import paddle
print("__PADDLE_GPU__" if paddle.device.is_compiled_with_cuda() else "__PADDLE_CPU__")
PY
)"
    [[ "$output" == *"__PADDLE_GPU__"* ]] && { printf '%s' "gpu"; return 0; }
    [[ "$output" == *"__PADDLE_CPU__"* ]] && printf '%s' "cpu"
}

pcg_paddle_dist_present() {
    local py="$1"
    local cpu_metadata=""
    local gpu_metadata=""
    cpu_metadata="$("$py" -m pip show "$PCG_CPU_PACKAGE" 2>/dev/null || true)"
    gpu_metadata="$("$py" -m pip show "$PCG_GPU_PACKAGE" 2>/dev/null || true)"
    [[ "$cpu_metadata" == *"Name:"* || "$gpu_metadata" == *"Name:"* ]]
}

# 0 when a GPU paddle build can see at least one CUDA device.
pcg_paddle_cuda_usable() {
    local py="$1"
    local output=""
    output="$("$py" - 2>/dev/null <<'PY'
try:
    import paddle
    print("__PADDLE_CUDA_READY__" if paddle.device.is_compiled_with_cuda() and paddle.device.cuda.device_count() > 0 else "__PADDLE_CUDA_UNAVAILABLE__")
except Exception:
    print("__PADDLE_CUDA_UNAVAILABLE__")
PY
    )"
    [[ "$output" == *"__PADDLE_CUDA_READY__"* ]]
}

pcg_paddle_cuda_state() {
    local py="$1"
    "$py" - <<'PY' 2>/dev/null
import sys
try:
    import paddle
    sys.stdout.write(str(paddle.version.cuda() or ""))
except Exception:
    sys.stdout.write("")
PY
}

pcg_cuda_state_tag() {
    local state="${1:-}" major minor
    major="${state%%.*}"
    minor="${state#*.}"
    minor="${minor%%.*}"
    if [[ "$major" =~ ^[0-9]+$ && "$minor" =~ ^[0-9]+$ ]]; then
        printf 'cu%s%s' "$major" "$minor"
    fi
}

pcg_uninstall_paddle_packages() {
    local py="$1"
    vpip "$py" -m pip uninstall -y "$PCG_CPU_PACKAGE" "$PCG_GPU_PACKAGE" >/dev/null 2>&1 || true
}

pcg_install_cpu_paddle() {
    local py="$1" flags=()
    read -ra flags <<< "$(pcg_pip_sysflags "$py")"
    # Plain install lets pip preserve satisfied dependencies. The build-switch path removes
    # only the conflicting Paddle distributions before selecting the CPU ABI.
    vpip "$py" -m pip install "${flags[@]}" \
        --index-url "$PCG_CPU_INDEX_URL" "$PCG_CPU_PACKAGE"
}

pcg_install_gpu_paddle() {
    local py="$1" flags=() idx
    read -ra flags <<< "$(pcg_pip_sysflags "$py")"
    idx="$(paddle_cuda_index_url)"
    # The official wheel owns its user-space CUDA dependencies. This does not replace the
    # NVIDIA driver or a system CUDA toolkit, and a healthy installation is never repeated.
    echo "[paddle-guard] Installing the official self-contained Python CUDA runtime dependencies once; this does not replace the NVIDIA driver or system CUDA Toolkit."
    vpip "$py" -m pip install "${flags[@]}" \
        --index-url "$idx" "$PCG_GPU_PACKAGE"
}

pcg_ensure_paddle_build() {
    local py state repair_only="${PCG_REPAIR_ONLY:-0}" policy_tag cuda_state installed_tag dist_present=0
    if ! py="$(pcg_resolve_python)"; then
        echo "[paddle-guard] No python interpreter found; skipping." >&2
        return 0
    fi
    state="$(pcg_paddle_build_state "$py")"
    pcg_paddle_dist_present "$py" && dist_present=1

    if pcg_gpu_present; then
        policy_tag="$(cuda_policy_tag)"
        if [[ -z "$policy_tag" ]]; then
            echo "[paddle-guard] GPU present but no common CUDA tier supports this driver; leaving paddle unchanged."
            return 0
        fi
        if [[ -z "$state" ]]; then
            if [[ "$repair_only" == "1" ]]; then
                echo "[paddle-guard] GPU present, no usable Paddle import (repair-only) -> no package mutation."
            elif [[ "$dist_present" -eq 0 ]]; then
                echo "[paddle-guard] GPU present, Paddle is absent -> installing the driver-compatible GPU wheel and its Python runtime libraries."
                pcg_install_gpu_paddle "$py" || return 1
            else
                echo "[paddle-guard] Paddle metadata is present, but import fails; preserving it to prevent a reinstall loop."
            fi
            return 0
        fi
        if [[ "$state" == "cpu" ]]; then
            echo "[paddle-guard] GPU present but paddle is CPU build -> switching to GPU build."
            pcg_uninstall_paddle_packages "$py"
            pcg_install_gpu_paddle "$py" || return 1
            return 0
        fi
        cuda_state="$(pcg_paddle_cuda_state "$py")"
        installed_tag="$(pcg_cuda_state_tag "$cuda_state")"
        if [[ "$installed_tag" != "$policy_tag" ]]; then
            echo "[paddle-guard] Paddle CUDA ${installed_tag:-unknown} differs from the $policy_tag ABI policy -> aligning."
            pcg_uninstall_paddle_packages "$py"
            pcg_install_gpu_paddle "$py" || return 1
            return 0
        fi
        if pcg_paddle_cuda_usable "$py"; then
            echo "[paddle-guard] GPU present, canonical $policy_tag paddle is usable; no change."
        else
            echo "[paddle-guard] Canonical $policy_tag paddle is installed but CUDA cannot initialize; leaving it unchanged to avoid a reinstall loop."
        fi
        return 0
    fi

    case "$state" in
        "")
            if [[ "$repair_only" == "1" ]]; then
                echo "[paddle-guard] No GPU, no usable Paddle import (repair-only) -> no package mutation."
            elif [[ "$dist_present" -eq 0 ]]; then
                echo "[paddle-guard] No GPU, Paddle is absent -> installing CPU build."
                pcg_install_cpu_paddle "$py" || return 1
            else
                echo "[paddle-guard] Paddle CPU metadata is present, but import fails; preserving it to prevent a reinstall loop."
            fi
            ;;
        "cpu")
            echo "[paddle-guard] No GPU, Paddle is already a CPU build; no change."
            ;;
        "gpu")
            echo "[paddle-guard] No GPU but paddle GPU build -> switching to CPU build."
            pcg_uninstall_paddle_packages "$py"
            pcg_install_cpu_paddle "$py" || return 1
            ;;
    esac
    return 0
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --python)      PCG_PYTHON="$2"; shift 2 ;;
            --repair-only) PCG_REPAIR_ONLY=1; shift ;;
            *) shift ;;
        esac
    done
    pcg_ensure_paddle_build
fi
