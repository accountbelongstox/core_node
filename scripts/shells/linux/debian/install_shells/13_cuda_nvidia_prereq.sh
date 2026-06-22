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
# 13_cuda_nvidia_prereq.sh - NVIDIA driver + CUDA Toolkit prerequisite (idempotent).
# Runs before 13_ensure_python.sh so the torch guard can pick the GPU build.
#   1. Skip entirely when there is NO NVIDIA GPU (CPU-only host).
#   2. Ensure kernel build prerequisites (gcc/make/headers/dkms).
#   3. Best-effort ensure the NVIDIA driver (Debian/Kali: nvidia-detect+nvidia-driver)
#      when nvidia-smi is not yet working. A reboot may be needed for it to load.
#   4. Ensure the CUDA toolkit (pinned 12.2.2) via the shared, Kali-aware installer
#      scripts/shells/linux/common/install_cuda_toolkit.sh.

# Variable declarations (top of file)
SCRIPT_INDEX="13"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
CUDA_TOOLKIT_LIB="$PARENT_DIR_LEVEL_2/common/install_cuda_toolkit.sh"
OS_ID=""

# Source global variables
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"

cnp_have() { command -v "$1" >/dev/null 2>&1; }

# 0 if an NVIDIA GPU is physically present (driver not required for detection).
cnp_gpu_present() {
    if cnp_have nvidia-smi && nvidia-smi -L >/dev/null 2>&1; then return 0; fi
    if cnp_have lspci && lspci 2>/dev/null | grep -iqE 'vga|3d|display' && lspci 2>/dev/null | grep -iq nvidia; then return 0; fi
    [ -d /proc/driver/nvidia ] && return 0
    return 1
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
    $USE_SUDO apt-get install -y gcc make dkms "linux-headers-$(uname -r)" >/dev/null 2>&1 \
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
            $USE_SUDO apt-get install -y nvidia-detect nvidia-driver >/dev/null 2>&1 \
                || echo "[$SCRIPT_INDEX] WARN: nvidia-driver install failed (enable non-free repos, then re-run). Continuing to toolkit."
            ;;
        ubuntu)
            echo "[$SCRIPT_INDEX] Installing NVIDIA driver via ubuntu-drivers (autoinstall)..."
            $USE_SUDO ubuntu-drivers autoinstall >/dev/null 2>&1 \
                || $USE_SUDO apt-get install -y nvidia-driver-535 >/dev/null 2>&1 \
                || echo "[$SCRIPT_INDEX] WARN: driver autoinstall failed (continuing to toolkit)."
            ;;
        *)
            echo "[$SCRIPT_INDEX] Unknown distro '$OS_ID'; skipping automatic driver install (install the NVIDIA driver manually)."
            ;;
    esac
fi

# Step 4: CUDA toolkit (pinned), via the shared Kali-aware installer.
if [ -s "$CUDA_TOOLKIT_LIB" ]; then
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
