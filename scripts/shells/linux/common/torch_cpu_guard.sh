#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# torch_cpu_guard.sh - Idempotent PyTorch CPU/GPU build guard (Linux).
#
# THE PROBLEM: on Linux x86_64, `pip install torch` installs the default CUDA
# wheel, which drags in ~4.3G of nvidia-* CUDA wheels (+1.7G torch). On a host
# with NO NVIDIA GPU that is pure waste. Several install paths pull torch
# transitively (ultralytics, easyocr, faster-whisper), so a CUDA build can
# reappear after ANY of them runs - hence this guard is reused at key points.
#
# THE GUARD - ONE idempotent routine, safe to call on every boot / install step:
#   GPU present  -> ensure torch installed (default/CUDA build); leave as-is.
#   NO GPU       -> ensure torch is the CPU build; a CUDA build is reinstalled
#                   from the CPU index and every orphaned nvidia-* / triton wheel
#                   is uninstalled to reclaim disk.
#   Already correct -> no-op.
#
# Safe to SOURCE (use the tcg_* functions) or RUN directly. Introduced at:
#   - scripts/shells/linux/debian/install_shells/14_install_python_prereq_packages.sh (install time, full mode)
#   - scripts/shells/linux/common/iniscripts/prepare.sh (after every prerequisite install, repair-only)
# Python in-process counterpart (same policy, at import):
#   pycore/pyfoundations/third_party.py::_ensure_torch_cpu_build_when_no_gpu()
#
# Usage:
#   bash torch_cpu_guard.sh                  # repair now (python3)
#   bash torch_cpu_guard.sh --python /path   # use a specific interpreter
#   bash torch_cpu_guard.sh --repair-only    # only fix a wrong build; never install when missing
#   source torch_cpu_guard.sh; tcg_ensure_torch_build
#
# Env overrides:
#   TORCH_FORCE_CUDA=1   treat as GPU present (keep/install the CUDA build)
#   TCG_PYTHON=<path>    interpreter (same as --python)
#   TCG_REPAIR_ONLY=1    same as --repair-only
# ---------------------------------------------------------------------------

TCG_CPU_INDEX_URL="https://download.pytorch.org/whl/cpu"
TCG_TORCH_PACKAGES=(torch torchvision torchaudio)
TCG_TORCH_HEALTH_PACKAGES=(torch torchvision torchaudio)

# Serialize venv-mutating pip through the shared lock so this guard is safe to run while
# the TTS/LLM parallel groups install concurrently.
_TCG_PIPLOCK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/base_libs/pip_lock.sh"
. "$_TCG_PIPLOCK"
# Driver-matched CUDA wheel index (single source of truth) so a GPU install never grabs the
# default "latest" wheel (e.g. cu130) that a 12.4 driver can't run.
_TCG_CUDAIDX="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/base_libs/cuda_index.sh"
. "$_TCG_CUDAIDX"
TCG_CPU_INDEX_URL="${AI_TORCH_CPU_INDEX:-$TCG_CPU_INDEX_URL}"
IFS=',' read -ra TCG_TORCH_PACKAGES <<< "$(canonical_torch_packages_csv)"
IFS=',' read -ra TCG_TORCH_HEALTH_PACKAGES <<< "${AI_TORCH_HEALTH_PACKAGES:-torch,torchvision,torchaudio}"

# Resolve a python interpreter (env/arg/python3/python). Echoes the path; 1 if none.
tcg_resolve_python() {
    local p="${TCG_PYTHON:-}"
    if [[ -n "$p" ]]; then printf '%s' "$p"; return 0; fi
    for p in python3 python; do
        if command -v "$p" >/dev/null 2>&1; then command -v "$p"; return 0; fi
    done
    return 1
}

# 0 if an NVIDIA GPU is usable (or forced via TORCH_FORCE_CUDA), 1 otherwise.
tcg_gpu_present() {
    [[ "${TORCH_FORCE_CUDA:-0}" == "1" ]] && return 0
    command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi -L >/dev/null 2>&1
}

# Echo torch build state for $1=python: "None" (CPU build), a cuda version string
# (CUDA build), or "" (torch not installed / import failed).
tcg_torch_cuda_state() {
    local py="$1"
    "$py" - <<'PY' 2>/dev/null
import sys
try:
    import torch
    sys.stdout.write(str(torch.version.cuda))
except Exception:
    sys.stdout.write("")
PY
}

# 0 if torch is installed AND torch.cuda.is_available() is True for $1=python, else 1.
# A CUDA-build wheel compiled for a CUDA NEWER than the driver supports (e.g. cu130 on a
# 12.4 driver) imports fine but reports is_available()=False ("driver too old"); this is
# the authoritative "does the CUDA build actually work on THIS driver" probe.
tcg_torch_cuda_usable() {
    local py="$1" output=""
    output="$("$py" - 2>/dev/null <<'PY'
try:
    import torch
    print("__CUDA_READY__" if torch.cuda.is_available() else "__CUDA_UNAVAILABLE__")
except Exception:
    print("__CUDA_UNAVAILABLE__")
PY
    )"
    [[ "$output" == *"__CUDA_READY__"* ]]
}

tcg_torch_packages_installed() {
    local py="$1"
    local package=""
    local metadata=""
    local missing=0
    for package in "${TCG_TORCH_HEALTH_PACKAGES[@]}"; do
        metadata="$("$py" -m pip show "$package" 2>/dev/null || true)"
        if [[ "$metadata" != *"Name:"* ]]; then
            missing=1
        fi
    done
    [[ "$missing" -eq 0 ]]
}

tcg_torch_metadata_present() {
    local py="$1"
    local metadata=""
    metadata="$("$py" -m pip show torch 2>/dev/null || true)"
    [[ "$metadata" == *"Name:"* ]]
}

tcg_torch_state_tag() {
    local state="${1:-}" major minor
    major="${state%%.*}"
    minor="${state#*.}"
    minor="${minor%%.*}"
    if [[ "$major" =~ ^[0-9]+$ && "$minor" =~ ^[0-9]+$ ]]; then
        printf 'cu%s%s' "$major" "$minor"
    fi
}

# Uninstall every nvidia-* / triton wheel (orphaned after a CUDA->CPU torch switch).
tcg_purge_nvidia_wheels() {
    local py="$1" pkgs
    pkgs="$("$py" -m pip list --format=freeze 2>/dev/null | sed 's/==.*//' | grep -iE '^(nvidia-|triton$)' | tr '\n' ' ')"
    if [[ -n "${pkgs// /}" ]]; then
        echo "[torch-guard] Removing orphaned CUDA wheels: $pkgs"
        vpip "$py" -m pip uninstall -y $pkgs >/dev/null 2>&1 || true
    fi
}

# Install the CPU build of torch + torchvision + torchaudio from the CPU index.
tcg_install_cpu_torch() {
    local py="$1" force="${2:-0}"
    if [[ "$force" == "1" ]]; then
        vpip "$py" -m pip uninstall -y "${TCG_TORCH_PACKAGES[@]}" >/dev/null 2>&1 || true
    fi
    vpip "$py" -m pip install --break-system-packages \
        --index-url "$TCG_CPU_INDEX_URL" "${TCG_TORCH_PACKAGES[@]}" || true
}

# THE idempotent repair routine. TCG_REPAIR_ONLY=1 -> never install when missing.
tcg_ensure_torch_build() {
    local py state repair_only="${TCG_REPAIR_ONLY:-0}" policy_tag installed_tag index_url
    if ! py="$(tcg_resolve_python)"; then
        echo "[torch-guard] No python interpreter found; skipping." >&2
        return 0
    fi
    state="$(tcg_torch_cuda_state "$py")"
    if [[ -z "$state" ]] && tcg_torch_metadata_present "$py"; then
        echo "[torch-guard] torch metadata is present, but its binary cannot load; preserving it to prevent a reinstall loop."
        return 0
    fi

    if tcg_gpu_present; then
        policy_tag="$(cuda_policy_tag)"
        if [[ -z "$policy_tag" ]]; then
            echo "[torch-guard] GPU present but no common CUDA tier supports this driver; leaving torch unchanged."
            return 0
        fi
        index_url="$(torch_cuda_index_url)"
        if [[ -z "$state" ]]; then
            if [[ "$repair_only" == "1" ]]; then
                echo "[torch-guard] GPU present, torch missing (repair-only) -> nothing to repair."
            else
                echo "[torch-guard] GPU present, torch missing -> installing driver-matched CUDA build."
                vpip "$py" -m pip install --break-system-packages --no-user \
                    --index-url "$index_url" "${TCG_TORCH_PACKAGES[@]}" || true
            fi
            return 0
        fi
        if [[ "$state" == "None" ]]; then
            echo "[torch-guard] GPU present, torch is CPU-only -> switching to canonical $policy_tag."
            vpip "$py" -m pip uninstall -y "${TCG_TORCH_PACKAGES[@]}" >/dev/null 2>&1 || true
            vpip "$py" -m pip install --break-system-packages --no-user \
                --index-url "$index_url" "${TCG_TORCH_PACKAGES[@]}" || true
            return 0
        fi
        installed_tag="$(tcg_torch_state_tag "$state")"
        if [[ "$installed_tag" != "$policy_tag" ]]; then
            echo "[torch-guard] torch cuda=$state differs from canonical $policy_tag -> aligning."
            vpip "$py" -m pip uninstall -y "${TCG_TORCH_PACKAGES[@]}" >/dev/null 2>&1 || true
            vpip "$py" -m pip install --break-system-packages --no-user \
                --index-url "$index_url" "${TCG_TORCH_PACKAGES[@]}" || true
            return 0
        fi
        if ! tcg_torch_packages_installed "$py"; then
            echo "[torch-guard] $installed_tag torch group is incomplete -> repairing from the canonical release group."
            vpip "$py" -m pip install --break-system-packages --no-user \
                --index-url "$index_url" "${TCG_TORCH_PACKAGES[@]}" || true
            return 0
        fi
        if tcg_torch_cuda_usable "$py"; then
            echo "[torch-guard] GPU present, installed $policy_tag torch group is usable; preserving installed versions."
        else
            echo "[torch-guard] Installed $policy_tag torch cannot initialize CUDA; leaving it unchanged to avoid a reinstall loop. Repair the NVIDIA driver/runtime."
        fi
        return 0
    fi

    # No GPU -> want the CPU build.
    case "$state" in
        "")
            if [[ "$repair_only" == "1" ]]; then
                echo "[torch-guard] No GPU, torch not installed -> nothing to repair."
            else
                echo "[torch-guard] No GPU, torch missing -> installing CPU build (avoids ~4.3G nvidia-*)."
                tcg_install_cpu_torch "$py"
            fi
            ;;
        "None")
            if tcg_torch_packages_installed "$py"; then
                echo "[torch-guard] No GPU, installed CPU torch group is usable; preserving installed versions."
            else
                echo "[torch-guard] No GPU, CPU torch group is incomplete -> repairing."
                tcg_install_cpu_torch "$py"
            fi
            ;;
        *)
            echo "[torch-guard] No GPU but CUDA torch (cuda=$state) -> switching to CPU build + purging nvidia-*."
            tcg_install_cpu_torch "$py" 1
            tcg_purge_nvidia_wheels "$py"
            ;;
    esac
    return 0
}

# Direct execution: parse flags and run the repair.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --python)      TCG_PYTHON="$2"; shift 2 ;;
            --repair-only) TCG_REPAIR_ONLY=1; shift ;;
            *) shift ;;
        esac
    done
    tcg_ensure_torch_build
fi
