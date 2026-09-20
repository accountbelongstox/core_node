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
    if gpu_present; then return 0; fi
    for dev in /sys/bus/pci/devices/*; do
        [[ -r "$dev/vendor" && -r "$dev/class" ]] || continue
        if [[ "$(cat "$dev/vendor" 2>/dev/null)" == "0x10de" ]]; then
            case "$(cat "$dev/class" 2>/dev/null)" in
                0x03*) return 0 ;;
            esac
        fi
    done
    if command -v lspci >/dev/null 2>&1 \
        && lspci 2>/dev/null | grep -iqE 'vga|3d|display' \
        && lspci 2>/dev/null | grep -iq nvidia; then
        return 0
    fi
    [[ -d /proc/driver/nvidia ]] && return 0
    return 1
}
