#!/usr/bin/env bash
# cuda_index.sh - SINGLE source of truth for driver-matched CUDA wheel index URLs.
#
# Replaces the former torch_cuda_index.sh + paddle_cuda_index.sh. The two consumers
# need DIFFERENT tag tables (torch ships cu121/cu124/cu128; paddle ships cu129 but no
# cu124/cu120 for cp313), so each keeps its own tag map + base URL - but they SHARE one
# nvidia-smi driver-version probe (cuda_driver_cv). A wheel built for a CUDA NEWER than
# the driver supports fails is_available()/init ("driver too old") and triggers an endless
# reinstall loop, so each table picks the HIGHEST published tag whose CUDA version <= the
# driver's CUDA version (nvidia-smi "CUDA Version: X.Y").
#
#   cuda_driver_cv()        -> numeric driver CUDA, e.g. 1204 ("" if no nvidia-smi)
#   torch_cuda_index_url()  -> https://download.pytorch.org/whl/<tag>      (env PYTORCH_CUDA_INDEX_URL)
#   paddle_cuda_index_url() -> https://www.paddlepaddle.org.cn/packages/stable/<tag>/ (env PADDLE_CUDA_INDEX_URL)
#
# Defaults: torch=cu124 (driver>=550 / CUDA 12.4, verified py3.13 wheels); paddle=cu126.
# Mirrors the Python resolver pycore/pyfoundations/third_party.py::_resolve_pytorch_cuda_index_url().
#
# Usage:  . cuda_index.sh ; url="$(torch_cuda_index_url)"; padd="$(paddle_cuda_index_url)"

# Numeric driver CUDA version (major*100+minor), e.g. 1204 for 12.4. Empty when nvidia-smi
# is absent (CPU-only host) - callers fall back to their default tag.
cuda_driver_cv() {
    local ver major minor
    if ! command -v nvidia-smi >/dev/null 2>&1; then printf '%s' ""; return 0; fi
    ver="$(nvidia-smi 2>/dev/null | grep -o 'CUDA Version: [0-9.]*' | head -1)"
    ver="${ver#CUDA Version: }"
    major="${ver%%.*}"
    minor="${ver#*.}"; minor="${minor%%.*}"
    if [ -n "$major" ] && [ "$major" -eq "$major" ] 2>/dev/null; then
        printf '%s' "$(( major * 100 + ${minor:-0} ))"
    fi
}

# PyTorch driver-matched wheel index URL. Tags: cu118/cu121/cu124/cu126/cu128/cu130.
torch_cuda_index_url() {
    if [ -n "${PYTORCH_CUDA_INDEX_URL:-}" ]; then printf '%s' "$PYTORCH_CUDA_INDEX_URL"; return 0; fi
    local tag="cu124" cv
    cv="$(cuda_driver_cv)"
    if [ -n "$cv" ] && [ "$cv" -eq "$cv" ] 2>/dev/null; then
        if   [ "$cv" -ge 1300 ]; then tag="cu130"
        elif [ "$cv" -ge 1208 ]; then tag="cu128"
        elif [ "$cv" -ge 1206 ]; then tag="cu126"
        elif [ "$cv" -ge 1204 ]; then tag="cu124"
        elif [ "$cv" -ge 1201 ]; then tag="cu121"
        elif [ "$cv" -ge 1108 ]; then tag="cu118"
        fi
    fi
    printf '%s' "https://download.pytorch.org/whl/$tag"
}

# PaddlePaddle driver-matched GPU wheel index URL. Tags: cu118/cu126/cu129/cu130 only
# (paddle 3.x publishes NO cu121/cu124/cu120 cp313 wheel), so a 12.4 driver correctly
# lands on cu118 - cu126+ need a newer driver. See memory paddle-cu118-forced-py313.
paddle_cuda_index_url() {
    if [ -n "${PADDLE_CUDA_INDEX_URL:-}" ]; then printf '%s' "$PADDLE_CUDA_INDEX_URL"; return 0; fi
    local tag="cu126" cv
    cv="$(cuda_driver_cv)"
    if [ -n "$cv" ] && [ "$cv" -eq "$cv" ] 2>/dev/null; then
        if   [ "$cv" -ge 1300 ]; then tag="cu130"
        elif [ "$cv" -ge 1209 ]; then tag="cu129"
        elif [ "$cv" -ge 1206 ]; then tag="cu126"
        elif [ "$cv" -ge 1108 ]; then tag="cu118"
        fi
    fi
    printf '%s' "https://www.paddlepaddle.org.cn/packages/stable/${tag}/"
}
