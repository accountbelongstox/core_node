#!/usr/bin/env bash
# torch_cuda_index.sh — single source of truth for the DRIVER-MATCHED PyTorch CUDA wheel
# index URL. A wheel built for a CUDA NEWER than the driver supports fails
# torch.cuda.is_available() ("driver too old") and triggers an endless reinstall loop, so
# pick the HIGHEST published wheel whose CUDA version <= the driver's CUDA version
# (nvidia-smi "CUDA Version: X.Y"). Mirrors the Python resolver
# pycore/pyfoundations/third_party.py::_resolve_pytorch_cuda_index_url().
#
# Driver -> max CUDA (NVIDIA CUDA compatibility): 550 -> 12.4, 560 -> 12.6, 570 -> 12.8,
# 580 -> 13.0. Env PYTORCH_CUDA_INDEX_URL overrides the whole choice.
#
# Usage:  . torch_cuda_index.sh ; url="$(torch_cuda_index_url)"
torch_cuda_index_url() {
    if [ -n "${PYTORCH_CUDA_INDEX_URL:-}" ]; then printf '%s' "$PYTORCH_CUDA_INDEX_URL"; return 0; fi
    local tag="cu124" ver major minor cv   # cu124 default: driver >= 550 / CUDA 12.4 (verified py3.13 wheels)
    if command -v nvidia-smi >/dev/null 2>&1; then
        ver="$(nvidia-smi 2>/dev/null | grep -o 'CUDA Version: [0-9.]*' | head -1)"
        ver="${ver#CUDA Version: }"
        major="${ver%%.*}"
        minor="${ver#*.}"; minor="${minor%%.*}"
        if [ -n "$major" ] && [ "$major" -eq "$major" ] 2>/dev/null; then
            cv=$(( major * 100 + ${minor:-0} ))
            if   [ "$cv" -ge 1300 ]; then tag="cu130"
            elif [ "$cv" -ge 1208 ]; then tag="cu128"
            elif [ "$cv" -ge 1206 ]; then tag="cu126"
            elif [ "$cv" -ge 1204 ]; then tag="cu124"
            elif [ "$cv" -ge 1201 ]; then tag="cu121"
            elif [ "$cv" -ge 1108 ]; then tag="cu118"
            fi
        fi
    fi
    printf '%s' "https://download.pytorch.org/whl/$tag"
}
