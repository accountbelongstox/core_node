#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###
#
# 11_cuda_nvidia_prereq.sh - NVIDIA driver + CUDA Toolkit prerequisite (idempotent).
# Runs before 13_install_default_python.sh so the torch guard can pick the GPU build.
#   1. Skip entirely when there is NO NVIDIA GPU (CPU-only host).
#   2. Ensure kernel build prerequisites (gcc/make/headers/dkms).
#   3. Best-effort ensure the NVIDIA driver (Debian/Kali: nvidia-detect+nvidia-driver)
#      when nvidia-smi is not yet working. A reboot may be needed for it to load.
#   4. Ensure the CUDA toolkit selected by the unified runtime policy.
#      scripts/shells/linux/common/install_cuda_toolkit.sh.

# Variable declarations (top of file)
SCRIPT_INDEX="11"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
CUDA_TOOLKIT_LIB="$PARENT_DIR_LEVEL_2/common/install_cuda_toolkit.sh"
CUDA_POLICY_LIB="$PARENT_DIR_LEVEL_2/common/base_libs/cuda_index.sh"
CUDA_POLICY_TAG=""
OS_ID=""
PYTHON="python3"
FORCE=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON="$2"; shift 2 ;;
        --force)  FORCE=1; shift ;;
        *) echo "[$SCRIPT_INDEX] Unknown argument: $1" >&2; shift ;;
    esac
done

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$CUDA_POLICY_LIB"

cnp_have() { command -v "$1" >/dev/null 2>&1; }

# 0 if an NVIDIA GPU is physically present (driver not required for detection).
# Delegates to the ONE shared detector (base_libs/lib_gpu.sh via gvar_common.sh).
cnp_gpu_present() {
    gpu_hardware_present
}

# nvidia-driver lives in the non-free apt component (Debian/Kali). Enable
# contrib/non-free/non-free-firmware idempotently (classic one-line sources.list
# AND deb822 .sources, the Debian 13 default) when no candidate is visible.
cnp_ensure_nonfree_components() {
    local comp src changed=0
    # apt-cache show can succeed on a pure referral entry with NO candidate; the
    # policy Candidate line is the authoritative "is it installable" check.
    if apt-cache policy nvidia-driver 2>/dev/null | grep -qE 'Candidate: [0-9]'; then return 0; fi
    echo "[$SCRIPT_INDEX] nvidia-driver not visible; enabling contrib/non-free/non-free-firmware components..."
    if cnp_have add-apt-repository; then
        for comp in contrib non-free non-free-firmware; do
            $USE_SUDO add-apt-repository -y "$comp" >/dev/null 2>&1 && changed=1 || true
        done
    fi
    for src in /etc/apt/sources.list /etc/apt/sources.list.d/*.list; do
        [ -f "$src" ] || continue
        $USE_SUDO sed -i -E '/^[[:space:]]*deb[[:space:]]/ {
            /(^|[[:space:]])contrib([[:space:]]|$)/! s/$/ contrib/
            /(^|[[:space:]])non-free-firmware([[:space:]]|$)/! s/$/ non-free-firmware/
            /(^|[[:space:]])non-free([[:space:]]|$)/! s/$/ non-free/
        }' "$src" && changed=1
    done
    for src in /etc/apt/sources.list.d/*.sources; do
        [ -f "$src" ] || continue
        $USE_SUDO sed -i -E '/^Components:/ {
            /(^|[[:space:]])contrib([[:space:]]|$)/! s/$/ contrib/
            /(^|[[:space:]])non-free-firmware([[:space:]]|$)/! s/$/ non-free-firmware/
            /(^|[[:space:]])non-free([[:space:]]|$)/! s/$/ non-free/
        }' "$src" && changed=1
    done
    if [ "$changed" -eq 1 ]; then
        $USE_SUDO apt-get update || echo "[$SCRIPT_INDEX] WARN: apt-get update failed after component change."
    fi
}

cnp_os_id() { [ -r /etc/os-release ] && (. /etc/os-release 2>/dev/null; echo "${ID:-}") || echo ""; }

echo "=================================================="
echo " [$SCRIPT_INDEX] NVIDIA driver + CUDA toolkit prerequisite"
echo "=================================================="

if ! cnp_gpu_present; then
    echo "[$SCRIPT_INDEX] No NVIDIA GPU detected -> skipping CUDA/driver (CPU-only host)."
    exit 0
fi
echo "[$SCRIPT_INDEX] NVIDIA GPU detected."

OS_ID="$(cnp_os_id)"

# Step 2: kernel build prerequisites (idempotent; apt is no-op when present).
if cnp_have apt-get; then
    echo "[$SCRIPT_INDEX] Ensuring kernel build prerequisites (gcc/make/headers/dkms)..."
    $USE_SUDO apt-get install -y gcc make dkms "linux-headers-$(uname -r)" \
        || echo "[$SCRIPT_INDEX] WARN: some build prerequisites could not be installed (continuing)."
fi

# Step 3: NVIDIA driver (best-effort) only when nvidia-smi is not already working.
if cnp_have nvidia-smi && nvidia-smi >/dev/null 2>&1; then
    echo "[$SCRIPT_INDEX] Driver already active: $(nvidia-smi -L 2>/dev/null | head -1)"
else
    case "$OS_ID" in
        kali|debian)
            echo "[$SCRIPT_INDEX] Installing NVIDIA driver from the distro repo (nvidia-detect, nvidia-driver)..."
            echo "[$SCRIPT_INDEX] NOTE: requires the 'non-free'/'non-free-firmware' apt components; a REBOOT may be needed for the driver to load."
            cnp_ensure_nonfree_components
            $USE_SUDO apt-get install -y nvidia-detect nvidia-driver \
                || echo "[$SCRIPT_INDEX] WARN: nvidia-driver install failed (enable non-free repos, then re-run). Continuing to toolkit."
            ;;
        ubuntu)
            echo "[$SCRIPT_INDEX] Installing NVIDIA driver via ubuntu-drivers (autoinstall)..."
            $USE_SUDO ubuntu-drivers autoinstall \
                || echo "[$SCRIPT_INDEX] WARN: driver autoinstall failed (continuing to toolkit)."
            ;;
        *)
            echo "[$SCRIPT_INDEX] Unknown distro '$OS_ID'; skipping automatic driver install (install the NVIDIA driver manually)."
            ;;
    esac
fi

# Step 4: canonical CUDA toolkit, only after the driver exposes a supported tier.
CUDA_POLICY_TAG="$(cuda_policy_tag 2>/dev/null || true)"
if [[ -z "$CUDA_POLICY_TAG" ]]; then
    echo "[$SCRIPT_INDEX] CUDA toolkit deferred: driver is inactive or has no common Torch/Paddle CUDA tier."
elif [ -s "$CUDA_TOOLKIT_LIB" ]; then
    echo "[$SCRIPT_INDEX] Unified CUDA policy: $CUDA_POLICY_TAG (toolkit $(cuda_policy_field toolkit "$CUDA_POLICY_TAG"))."
    echo "[$SCRIPT_INDEX] Ensuring CUDA toolkit via: $CUDA_TOOLKIT_LIB"
    # shellcheck source=/dev/null
    source "$CUDA_TOOLKIT_LIB"
    if command -v cti_ensure_cuda_toolkit >/dev/null 2>&1; then
        cti_ensure_cuda_toolkit || echo "[$SCRIPT_INDEX] WARN: CUDA toolkit install reported errors (see log)."
    else
        echo "[$SCRIPT_INDEX] ERROR: cti_ensure_cuda_toolkit not found after sourcing the installer." >&2
    fi
else
    echo "[$SCRIPT_INDEX] ERROR: CUDA toolkit installer not found at: $CUDA_TOOLKIT_LIB" >&2
fi

echo "[$SCRIPT_INDEX] NVIDIA/CUDA prerequisite step complete."
