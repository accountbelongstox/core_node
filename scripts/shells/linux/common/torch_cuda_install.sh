#!/usr/bin/env bash
# Shared PyTorch wheel install — sources cuda_index.sh (Step9 canonical CUDA index).
# CTranslate2 cu12 libs for faster-whisper stay in 15_install_faster_whisper.sh.

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

install_pycore_torch_stack() {
    local py="$1"
    local prefix="${2:-}"
    local idx=""
    idx="$(torch_cuda_index_url)"
    echo "${prefix}[..] ensuring canonical torch build (index: ${idx}) ..."
    TCG_PYTHON="$py" tcg_ensure_torch_build
    "$py" -c "import torch, torchaudio" >/dev/null 2>&1 || return 1
    if gpu_present && ! tcg_torch_cuda_usable "$py"; then
        echo "${prefix}[!] NVIDIA GPU detected but torch.cuda.is_available() is false." >&2
        return 1
    fi
    return 0
}
