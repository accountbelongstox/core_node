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
#   - scripts/shells/linux/debian/install_shells/14_install_python_prereq_packages.sh
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
PCG_PADDLE_VERSION="${PCG_PADDLE_VERSION:-3.3.1}"

_PCG_PIPLOCK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/base_libs/pip_lock.sh"
[ -f "$_PCG_PIPLOCK" ] && . "$_PCG_PIPLOCK"
command -v vpip >/dev/null 2>&1 || vpip() { "$@"; }

_PCG_CUDAIDX="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/base_libs/cuda_index.sh"
[ -f "$_PCG_CUDAIDX" ] && . "$_PCG_CUDAIDX"
command -v paddle_cuda_index_url >/dev/null 2>&1 || paddle_cuda_index_url() { printf '%s' "https://www.paddlepaddle.org.cn/packages/stable/cu126/"; }

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
    [[ "${PADDLE_FORCE_CUDA:-0}" == "1" ]] && return 0
    command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi -L >/dev/null 2>&1
}

# Echo paddle build state: "" (missing), "cpu", or "gpu".
pcg_paddle_build_state() {
    local py="$1"
    "$py" - <<'PY' 2>/dev/null
import sys
try:
    import paddle
    sys.stdout.write("gpu" if paddle.device.is_compiled_with_cuda() else "cpu")
except Exception:
    sys.stdout.write("")
PY
}

# 0 when a GPU paddle build can see at least one CUDA device.
pcg_paddle_cuda_usable() {
    local py="$1"
    "$py" - >/dev/null 2>&1 <<'PY'
import sys
try:
    import paddle
    sys.exit(0 if paddle.device.is_compiled_with_cuda() and paddle.device.cuda.device_count() > 0 else 1)
except Exception:
    sys.exit(1)
PY
}

pcg_uninstall_paddle_packages() {
    local py="$1"
    vpip "$py" -m pip uninstall -y paddlepaddle paddlepaddle-gpu >/dev/null 2>&1 || true
}

pcg_install_cpu_paddle() {
    local py="$1" flags=()
    read -ra flags <<< "$(pcg_pip_sysflags "$py")"
    # Plain install: no --ignore-installed/--force-reinstall. Paddle's deps (numpy>=1.21,
    # protobuf, pillow, ...) are loosely pinned and already satisfied by the venv / inherited
    # system site-packages, so pip skips them; force-reinstall re-downloaded + reinstalled
    # numpy/protobuf/pillow every run, churning shared deps and racing the torch bundle. The
    # build-switch path calls pcg_uninstall_paddle_packages first, so this still swaps cleanly.
    vpip "$py" -m pip install "${flags[@]}" \
        --index-url "$PCG_CPU_INDEX_URL" "paddlepaddle==${PCG_PADDLE_VERSION}" || true
}

pcg_install_gpu_paddle() {
    local py="$1" flags=() idx
    read -ra flags <<< "$(pcg_pip_sysflags "$py")"
    idx="$(paddle_cuda_index_url)"
    # Plain install (see pcg_install_cpu_paddle): also avoids re-downloading the nvidia-cu11
    # stack already satisfied by a prior pass.
    vpip "$py" -m pip install "${flags[@]}" \
        --index-url "$idx" "paddlepaddle-gpu==${PCG_PADDLE_VERSION}" || true
}

pcg_ensure_paddle_build() {
    local py state repair_only="${PCG_REPAIR_ONLY:-0}"
    if ! py="$(pcg_resolve_python)"; then
        echo "[paddle-guard] No python interpreter found; skipping." >&2
        return 0
    fi
    state="$(pcg_paddle_build_state "$py")"

    if pcg_gpu_present; then
        if [[ -z "$state" ]]; then
            if [[ "$repair_only" == "1" ]]; then
                echo "[paddle-guard] GPU present, paddle missing (repair-only) -> nothing to repair."
            else
                echo "[paddle-guard] GPU present, paddle missing -> installing driver-matched GPU build."
                pcg_install_gpu_paddle "$py"
            fi
            return 0
        fi
        if [[ "$state" == "cpu" ]]; then
            echo "[paddle-guard] GPU present but paddle is CPU build -> switching to GPU build."
            pcg_uninstall_paddle_packages "$py"
            pcg_install_gpu_paddle "$py"
            return 0
        fi
        if pcg_paddle_cuda_usable "$py"; then
            echo "[paddle-guard] GPU present, paddle GPU build usable on this driver; no change."
        else
            echo "[paddle-guard] GPU present but paddle GPU build cannot init -> reinstalling ($(paddle_cuda_index_url))."
            pcg_uninstall_paddle_packages "$py"
            pcg_install_gpu_paddle "$py"
        fi
        return 0
    fi

    case "$state" in
        "")
            if [[ "$repair_only" == "1" ]]; then
                echo "[paddle-guard] No GPU, paddle not installed -> nothing to repair."
            else
                echo "[paddle-guard] No GPU, paddle missing -> installing CPU build."
                pcg_install_cpu_paddle "$py"
            fi
            ;;
        "cpu")
            echo "[paddle-guard] No GPU, paddle already CPU build; ok."
            ;;
        "gpu")
            echo "[paddle-guard] No GPU but paddle GPU build -> switching to CPU build."
            pcg_uninstall_paddle_packages "$py"
            pcg_install_cpu_paddle "$py"
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
