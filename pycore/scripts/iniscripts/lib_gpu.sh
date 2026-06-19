#!/bin/bash
# Shared GPU/CUDA detection for the iniscripts installers -- the ONE shell-side
# source of truth, mirroring the canonical PYTHON detector:
#   pycore/pyfoundations/pybasecommon/compute_caps.py  ->  CUDADetector
# (nvidia-smi + CUDA env vars, no third-party deps; honors TORCH_FORCE_CUDA).
#
# NOT an installer (prepare.sh only runs install_*.sh), so it is never auto-run.
# Source it from any installer:
#     . "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib_gpu.sh"
#     gpu_present && echo "GPU"

# 0 (true) when an NVIDIA GPU is usable, 1 otherwise.
gpu_present() {
    [[ "${TORCH_FORCE_CUDA:-0}" == "1" ]] && return 0
    [[ "${CUDA_VISIBLE_DEVICES:-}" == "-1" ]] && return 1
    command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi -L >/dev/null 2>&1
}
