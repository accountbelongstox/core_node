#!/usr/bin/env bash
# Shared PyTorch wheel install using the centralized CUDA index.

_torch_cuda_install_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v torch_cuda_index_url >/dev/null 2>&1; then
    # shellcheck source=base_libs/cuda_index.sh
    . "$_torch_cuda_install_dir/base_libs/cuda_index.sh"
fi
if ! command -v gpu_present >/dev/null 2>&1; then
    # shellcheck source=base_libs/lib_gpu.sh
    . "$_torch_cuda_install_dir/base_libs/lib_gpu.sh"
fi
if ! command -v tcg_ensure_torch_build >/dev/null 2>&1; then
    . "$_torch_cuda_install_dir/torch_cpu_guard.sh"
fi

PYCORE_TORCH_STACK_READY=0

install_pycore_torch_stack() {
    local py="$1"
    local prefix="${2:-}"
    local idx=""
    local probe_output=""
    PYCORE_TORCH_STACK_READY=0
    idx="$(torch_cuda_index_url)"
    echo "${prefix}[..] ensuring canonical torch build (index: ${idx}) ..."
    TCG_PYTHON="$py" tcg_ensure_torch_build
    tcg_load_runtime_state "$py"
    if [[ "$TCG_CACHE_HIT" -eq 1 ]]; then
        echo "${prefix}[idempotent] reusing pyservice torch/CUDA validation."
        if gpu_present; then
            [[ "$TCG_CACHED_USABLE" == "true" ]] && PYCORE_TORCH_STACK_READY=1
        elif [[ "$TCG_CACHED_STATE" == "None" ]]; then
            PYCORE_TORCH_STACK_READY=1
        fi
        return
    fi
    probe_output="$("$py" -c "import torch, torchaudio; print('__TORCH_STACK_READY__')" 2>/dev/null)"
    if [[ "$probe_output" == *"__TORCH_STACK_READY__"* ]]; then
        PYCORE_TORCH_STACK_READY=1
    fi
    if gpu_present; then
        tcg_torch_cuda_usable "$py" || true
        if [[ "$TCG_LAST_USABLE" != "true" ]]; then
            echo "${prefix}[!] NVIDIA GPU detected but torch.cuda.is_available() is false." >&2
            PYCORE_TORCH_STACK_READY=0
        fi
    fi
}
