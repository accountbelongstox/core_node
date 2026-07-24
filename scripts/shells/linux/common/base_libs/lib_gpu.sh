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
    local smi=""
    local output=""
    if [[ "${TORCH_FORCE_CUDA:-0}" == "1" ]]; then
        output="GPU 0: forced"
    elif [[ "${CUDA_VISIBLE_DEVICES:-}" != "-1" ]]; then
        smi="$(command -v nvidia-smi 2>/dev/null || true)"
        if [[ -n "$smi" ]]; then
            output="$("$smi" -L 2>/dev/null || true)"
        fi
    fi
    [[ "$output" == *"GPU "* ]]
}
