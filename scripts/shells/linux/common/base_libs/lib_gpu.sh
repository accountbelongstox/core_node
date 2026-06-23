#!/bin/bash
# Shared GPU/CUDA detection -- the ONE shell-side source of truth for the WHOLE repo
# (the numbered install_shells via gvar_common.sh, and the pyservice iniscripts),
# mirroring the canonical PYTHON detector:
#   pycore/pyfoundations/pybasecommon/compute_caps.py  ->  CUDADetector
# (nvidia-smi + CUDA env vars, no third-party deps; honors TORCH_FORCE_CUDA).
#
# Lives in scripts/shells/linux/common/base_libs/ so BOTH the numbered installers and the
# pyservice iniscripts source the SAME copy. Defining-only (no side effects), safe under
# `set -u`. gvar_common.sh sources it, so any script that sources gvar_common.sh already
# has gpu_present in scope; iniscripts source it directly.
#
#   gpu_present && echo "GPU"
#   GPU-mode principle: gpu_present -> CUDA build + LARGE model; else CPU build + small model.

# 0 (true) when an NVIDIA GPU is usable, 1 otherwise.
gpu_present() {
    [[ "${TORCH_FORCE_CUDA:-0}" == "1" ]] && return 0
    [[ "${CUDA_VISIBLE_DEVICES:-}" == "-1" ]] && return 1
    command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi -L >/dev/null 2>&1
}
