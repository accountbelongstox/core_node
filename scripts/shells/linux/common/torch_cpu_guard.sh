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
#   - scripts/shells/linux/debian/install_shells/13_ensure_python.sh (install time, full mode)
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

# Serialize venv-mutating pip through the shared lock so this guard is safe to run while
# the TTS/LLM parallel groups install concurrently. Defensive: pass-through if lib absent.
_TCG_PIPLOCK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/base_libs/pip_lock.sh"
[ -f "$_TCG_PIPLOCK" ] && . "$_TCG_PIPLOCK"
command -v vpip >/dev/null 2>&1 || vpip() { "$@"; }
# Driver-matched CUDA wheel index (single source of truth) so a GPU install never grabs the
# default "latest" wheel (e.g. cu130) that a 12.4 driver can't run.
_TCG_CUDAIDX="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/base_libs/torch_cuda_index.sh"
[ -f "$_TCG_CUDAIDX" ] && . "$_TCG_CUDAIDX"
command -v torch_cuda_index_url >/dev/null 2>&1 || torch_cuda_index_url() { printf '%s' "https://download.pytorch.org/whl/cu124"; }

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
    local py="$1"
    "$py" - >/dev/null 2>&1 <<'PY'
import sys
try:
    import torch
    sys.exit(0 if torch.cuda.is_available() else 1)
except Exception:
    sys.exit(1)
PY
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
    local py="$1"
    vpip "$py" -m pip install --break-system-packages --ignore-installed --force-reinstall \
        --index-url "$TCG_CPU_INDEX_URL" torch torchvision torchaudio || true
}

# THE idempotent repair routine. TCG_REPAIR_ONLY=1 -> never install when missing.
tcg_ensure_torch_build() {
    local py state repair_only="${TCG_REPAIR_ONLY:-0}"
    if ! py="$(tcg_resolve_python)"; then
        echo "[torch-guard] No python interpreter found; skipping." >&2
        return 0
    fi
    state="$(tcg_torch_cuda_state "$py")"

    if tcg_gpu_present; then
        # --ignore-installed (used below): torch needs mpmath<1.4 but Debian/Ubuntu/Kali ship
        # mpmath 1.4.x in /usr/lib/python3/dist-packages with NO RECORD file, so a plain
        # install aborts with "uninstall-no-record-file". Ignoring installed packages makes
        # pip drop the required mpmath into /usr/local/.../dist-packages (which shadows the
        # apt copy) without touching the dpkg-owned files. Matches tcg_install_cpu_torch.
        if [[ -z "$state" ]]; then
            if [[ "$repair_only" == "1" ]]; then
                echo "[torch-guard] GPU present, torch missing (repair-only) -> nothing to repair."
            else
                echo "[torch-guard] GPU present, torch missing -> installing driver-matched CUDA build."
                vpip "$py" -m pip install --break-system-packages --no-user --ignore-installed \
                    --index-url "$(torch_cuda_index_url)" torch torchvision torchaudio || true
            fi
            return 0
        fi
        if [[ "$state" == "None" ]]; then
            echo "[torch-guard] GPU present, torch is CPU build; no change (CPU build runs on GPU hosts too)."
            return 0
        fi
        # A CUDA build is present. Verify it actually initializes on THIS driver. A wheel built
        # for a CUDA newer than the driver supports (e.g. cu130 on a 12.4 driver) imports but
        # reports is_available()=False and triggers the worker's endless reinstall, so DOWNGRADE
        # it to the driver-matched wheel here instead of reporting it healthy ("no change").
        if tcg_torch_cuda_usable "$py"; then
            echo "[torch-guard] GPU present, torch cuda=$state usable on this driver; no change."
        else
            echo "[torch-guard] GPU present but torch cuda=$state cannot init on this driver -> reinstalling driver-matched wheel ($(torch_cuda_index_url))."
            vpip "$py" -m pip uninstall -y torch torchvision torchaudio >/dev/null 2>&1 || true
            vpip "$py" -m pip install --break-system-packages --no-user --ignore-installed --force-reinstall \
                --index-url "$(torch_cuda_index_url)" torch torchvision torchaudio || true
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
            echo "[torch-guard] No GPU, torch already CPU build; ok."
            ;;
        *)
            echo "[torch-guard] No GPU but CUDA torch (cuda=$state) -> switching to CPU build + purging nvidia-*."
            tcg_install_cpu_torch "$py"
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
