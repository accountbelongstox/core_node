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
#   gpu_present          -> GPU usable NOW (driver loaded; runtime/model decisions)
#   gpu_hardware_present -> NVIDIA GPU physically present (driver NOT required;
#                           install-time wheel/model selection so a pre-driver or
#                           pre-reboot host still gets the CUDA build)
#   GPU-mode principle: gpu_hardware_present -> CUDA build + LARGE model; else CPU build + small model.

# Run-scoped detection cache. The pyservice orchestrator
# (prepare_pycore_prerequisites.sh) probes ONCE per run and exports
# PYCORE_GPU_PRESENT / PYCORE_GPU_HARDWARE_PRESENT so every child installer in the
# chain reuses the result instead of re-spawning nvidia-smi / re-scanning sysfs.
# A script run STANDALONE finds them unset and detects on its own (then memoizes
# in-process), so no script ever requires these variables. Explicit overrides
# (TORCH_FORCE_CUDA, CUDA_VISIBLE_DEVICES=-1) always win over the cache.
_GPU_PRESENT_CACHE=""
_GPU_HW_PRESENT_CACHE=""

# 0 (true) when an NVIDIA GPU is usable, 1 otherwise.
gpu_present() {
    local smi=""
    local output=""
    if [[ "${TORCH_FORCE_CUDA:-0}" == "1" ]]; then
        return 0
    fi
    if [[ "${CUDA_VISIBLE_DEVICES:-}" == "-1" ]]; then
        return 1
    fi
    if [[ -n "$_GPU_PRESENT_CACHE" ]]; then
        [[ "$_GPU_PRESENT_CACHE" == "1" ]]
        return
    fi
    if [[ -n "${PYCORE_GPU_PRESENT:-}" ]]; then
        _GPU_PRESENT_CACHE="$PYCORE_GPU_PRESENT"
        [[ "$_GPU_PRESENT_CACHE" == "1" ]]
        return
    fi
    smi="$(command -v nvidia-smi 2>/dev/null || true)"
    if [[ -n "$smi" ]]; then
        output="$("$smi" -L 2>/dev/null || true)"
    fi
    if [[ "$output" == *"GPU "* ]]; then
        _GPU_PRESENT_CACHE="1"
        return 0
    fi
    _GPU_PRESENT_CACHE="0"
    return 1
}

# 0 (true) when an NVIDIA GPU is PHYSICALLY present, 1 otherwise.
# Driver-independent: a freshly installed driver only works after reboot, so
# nvidia-smi alone false-negatives on real GPU hosts and would lock the
# torch/paddle guards to CPU wheels forever. Detection order:
#   TORCH_FORCE_CUDA=1 -> true; a working nvidia-smi -> true; sysfs PCI scan
#   (vendor 0x10de + display class 0x03xxxx) -> true; lspci fallback;
#   /proc/driver/nvidia. Linux-only paths no-op elsewhere.
gpu_hardware_present() {
    local dev=""
    if [[ "${TORCH_FORCE_CUDA:-0}" == "1" ]]; then return 0; fi
    if [[ -n "$_GPU_HW_PRESENT_CACHE" ]]; then
        [[ "$_GPU_HW_PRESENT_CACHE" == "1" ]]
        return
    fi
    if [[ -n "${PYCORE_GPU_HARDWARE_PRESENT:-}" ]]; then
        _GPU_HW_PRESENT_CACHE="$PYCORE_GPU_HARDWARE_PRESENT"
        [[ "$_GPU_HW_PRESENT_CACHE" == "1" ]]
        return
    fi
    if gpu_present; then
        _GPU_HW_PRESENT_CACHE="1"
        return 0
    fi
    for dev in /sys/bus/pci/devices/*; do
        [[ -r "$dev/vendor" && -r "$dev/class" ]] || continue
        if [[ "$(cat "$dev/vendor" 2>/dev/null)" == "0x10de" ]]; then
            case "$(cat "$dev/class" 2>/dev/null)" in
                0x03*) _GPU_HW_PRESENT_CACHE="1"; return 0 ;;
            esac
        fi
    done
    if command -v lspci >/dev/null 2>&1 \
        && lspci 2>/dev/null | grep -iqE 'vga|3d|display' \
        && lspci 2>/dev/null | grep -iq nvidia; then
        _GPU_HW_PRESENT_CACHE="1"
        return 0
    fi
    if [[ -d /proc/driver/nvidia ]]; then
        _GPU_HW_PRESENT_CACHE="1"
        return 0
    fi
    _GPU_HW_PRESENT_CACHE="0"
    return 1
}
