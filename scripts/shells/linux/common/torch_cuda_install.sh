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

install_pycore_torch_stack() {
    local py="$1"
    local prefix="${2:-}"
    local idx
    if gpu_present; then
        idx="$(torch_cuda_index_url)"
        echo "${prefix}[..] ensuring torch (CUDA index: ${idx}) ..."
        if command -v vpip >/dev/null 2>&1; then
            vpip "$py" -m pip install torch torchaudio --index-url "$idx" 2>/dev/null \
                || vpip "$py" -m pip install torch torchaudio --index-url "$idx" || true
        else
            "$py" -m pip install torch torchaudio --index-url "$idx" 2>/dev/null \
                || "$py" -m pip install torch torchaudio --index-url "$idx" || true
        fi
    else
        echo "${prefix}[..] ensuring torch (CPU build) ..."
        if command -v vpip >/dev/null 2>&1; then
            vpip "$py" -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu 2>/dev/null \
                || vpip "$py" -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu || true
        else
            "$py" -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu 2>/dev/null \
                || "$py" -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu || true
        fi
    fi
}
