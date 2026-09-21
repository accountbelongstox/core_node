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
#   3b. An ACTIVE driver below every unified policy tier is upgraded from
#      NVIDIA's official CUDA repo (no reboot here; CPU wheels until reboot).
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
CNP_NEWEST_ROW=""
CNP_INSTALLED_DRIVER=""
CNP_TARGET_DRIVER=""
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

# NVIDIA CUDA network repo id for this distro ("" when there is no mapping).
cnp_nvidia_repo_id() {
    local version_id=""
    [ "$(cnp_os_id)" = "debian" ] || { printf '%s' ""; return 0; }
    version_id="$(. /etc/os-release 2>/dev/null; echo "${VERSION_ID%%.*}")"
    case "$version_id" in
        13|12) printf '%s' "debian${version_id}" ;;
        *) printf '%s' "" ;;
    esac
}

# Package field for the pin stanzas: native names PLUS one :<arch> variant per
# configured foreign arch. Under apt 3.0 an unqualified glob only matches the
# native arch, so i386 driver libs would float to another branch and break the
# Multi-Arch: same lockstep (amd64/i386 must share one version).
cnp_nvidia_pin_packages() {
    # libnvcuvid*/libnvoptix* belong to the driver branch but lack "nvidia" in
    # their names (lib-nv-cuvid / lib-nv-optix), so *nvidia* misses them.
    local base="*nvidia* libcuda* libnvcuvid* libnvoptix* firmware-nvidia-gsp cuda-* xserver-xorg-video-nvidia"
    local arch="" name="" out="$base"
    for arch in $(dpkg --print-foreign-architectures 2>/dev/null); do
        for name in $base; do out="$out $name:$arch"; done
    done
    printf '%s' "$out"
}

# Idempotently enable NVIDIA's official CUDA network repo (cuda-keyring package
# drops the signed keyring + source list). Preferences: the NVIDIA namespace is
# pinned at 600 so exact-version dependency chains (e.g. nvidia-kernel-open-dkms
# -> firmware-nvidia-gsp = same version) resolve inside the repo even when the
# distro ships an older firmware at the default 500; every other package stays
# at 100 so the repo can never outrank the distro.
cnp_ensure_nvidia_cuda_repo() {
    local repo_id="$1"
    local base_url="https://developer.download.nvidia.com/compute/cuda/repos/${repo_id}/x86_64"
    local keyring_deb="cuda-keyring_1.1-1_all.deb"
    local list_file="/etc/apt/sources.list.d/cuda-${repo_id}-x86_64.list"
    local pref_file="/etc/apt/preferences.d/nvidia-cuda-repo-pin"
    local tmp_deb=""
    if [ ! -f "$list_file" ]; then
        echo "[$SCRIPT_INDEX] Enabling NVIDIA official CUDA repo ($repo_id)..."
        tmp_deb="$(mktemp --suffix=.deb)"
        if ! curl -fSL "$base_url/$keyring_deb" -o "$tmp_deb"; then
            echo "[$SCRIPT_INDEX] WARN: cuda-keyring download failed; cannot enable the NVIDIA repo." >&2
            rm -f "$tmp_deb"
            return 1
        fi
        if ! $USE_SUDO dpkg -i "$tmp_deb"; then
            echo "[$SCRIPT_INDEX] WARN: cuda-keyring install failed; cannot enable the NVIDIA repo." >&2
            rm -f "$tmp_deb"
            return 1
        fi
        rm -f "$tmp_deb"
    fi
    printf 'Package: %s\nPin: origin "developer.download.nvidia.com"\nPin-Priority: 600\n\nPackage: *\nPin: origin "developer.download.nvidia.com"\nPin-Priority: 100\n' "$(cnp_nvidia_pin_packages)" | $USE_SUDO tee "$pref_file" >/dev/null
    $USE_SUDO apt-get update || echo "[$SCRIPT_INDEX] WARN: apt-get update failed after enabling the NVIDIA repo."
    return 0
}

# Pick the newest version within the OLDEST driver branch that satisfies the
# policy target (closest to the policy's pinned driver, not the newest feature
# branch). Echoes the apt version string; 1 when nothing satisfies the target.
cnp_pick_driver_version() {
    local target="$1" ver="" best_branch="" best_in_branch=""
    local -a versions
    mapfile -t versions < <(apt-cache madison nvidia-driver 2>/dev/null | awk '{print $3}' | grep -E '^[0-9]')
    for ver in "${versions[@]}"; do
        dpkg --compare-versions "$ver" ge "$target" 2>/dev/null || continue
        if [ -z "$best_branch" ] || [ "${ver%%.*}" -lt "$best_branch" ]; then best_branch="${ver%%.*}"; fi
    done
    [ -n "$best_branch" ] || return 1
    for ver in "${versions[@]}"; do
        [ "${ver%%.*}" = "$best_branch" ] || continue
        if [ -z "$best_in_branch" ] || dpkg --compare-versions "$ver" gt "$best_in_branch"; then best_in_branch="$ver"; fi
    done
    [ -n "$best_in_branch" ] || return 1
    printf '%s' "$best_in_branch"
}

# Upgrade the active-but-too-old driver from NVIDIA's official repo so it
# satisfies the newest unified policy tier. Never reboots: the new module loads
# on the next boot; until then wheel selection deterministically resolves CPU.
cnp_upgrade_driver_for_policy() {
    local newest_row="$1" target_driver="" installed_version="" repo_id="" picked_version=""
    IFS=':' read -r _ _ _ _ target_driver <<< "$newest_row"
    installed_version="$(dpkg-query -W -f='${Version}' nvidia-driver 2>/dev/null || true)"
    if [ "${NVIDIA_DRIVER_UPGRADE:-1}" = "0" ]; then
        echo "[$SCRIPT_INDEX] NVIDIA_DRIVER_UPGRADE=0 -> skipping driver upgrade (target >= $target_driver)."
        return 0
    fi
    repo_id="$(cnp_nvidia_repo_id)"
    if [ -z "$repo_id" ]; then
        echo "[$SCRIPT_INDEX] WARN: no NVIDIA CUDA repo mapping for this distro; upgrade the driver manually to >= $target_driver." >&2
        return 0
    fi
    cnp_ensure_nvidia_cuda_repo "$repo_id" || return 0
    picked_version="$(cnp_pick_driver_version "$target_driver")"
    if [ -z "$picked_version" ]; then
        echo "[$SCRIPT_INDEX] WARN: no nvidia-driver version >= $target_driver visible in the NVIDIA repo." >&2
        return 0
    fi
    # Version-glob pin (binary package names, not src: pins): forces the WHOLE
    # dependency closure to the selected branch. NVIDIA's src:-based pinning
    # metapackage does not register under apt 3.0, so the solver would mix
    # branches without this.
    printf 'Package: %s\nPin: version %s\nPin-Priority: 1000\n\nPackage: %s\nPin: origin "developer.download.nvidia.com"\nPin-Priority: 600\n\nPackage: *\nPin: origin "developer.download.nvidia.com"\nPin-Priority: 100\n' "$(cnp_nvidia_pin_packages)" "${picked_version%%-*}-*" "$(cnp_nvidia_pin_packages)" | $USE_SUDO tee /etc/apt/preferences.d/nvidia-cuda-repo-pin >/dev/null
    # nvidia-driver-cuda ships /usr/bin/nvidia-smi in the 590 packaging (the
    # old nvidia-driver-bin is gone and nvidia-smi is a transitional dummy);
    # the whole GPU/CPU chain reads the driver CUDA version from nvidia-smi,
    # so it is ensured on BOTH the upgrade and the pending-reboot paths.
    if [ -n "$installed_version" ] && [ -n "$target_driver" ] \
        && dpkg --compare-versions "$installed_version" ge "$target_driver"; then
        echo "[$SCRIPT_INDEX] Driver $installed_version already satisfies the unified policy (>= $target_driver); pending reboot to load."
        $USE_SUDO apt-get install -y nvidia-driver-cuda \
            || echo "[$SCRIPT_INDEX] WARN: nvidia-driver-cuda (nvidia-smi provider) install failed." >&2
        return 0
    fi
    echo "[$SCRIPT_INDEX] Active driver CUDA ($(cuda_driver_version)) is below every unified policy tier."
    echo "[$SCRIPT_INDEX] Selected driver version: $picked_version (oldest branch satisfying >= $target_driver; a REBOOT is required afterwards)."
    $USE_SUDO apt-get install -y "nvidia-driver=$picked_version" nvidia-driver-cuda \
        || echo "[$SCRIPT_INDEX] WARN: driver upgrade failed (continuing to toolkit)." >&2
    installed_version="$(dpkg-query -W -f='${Version}' nvidia-driver 2>/dev/null || true)"
    if [ -n "$installed_version" ] && [ -n "$target_driver" ] \
        && dpkg --compare-versions "$installed_version" ge "$target_driver"; then
        echo "[$SCRIPT_INDEX] Driver $installed_version installed; it loads after REBOOT. Until then the GPU/CPU chain deterministically selects CPU wheels."
    fi
}

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
CNP_NEWEST_ROW="$(cuda_policy_newest_row)"
IFS=':' read -r _ _ _ _ CNP_TARGET_DRIVER <<< "$CNP_NEWEST_ROW"
CNP_INSTALLED_DRIVER="$(dpkg-query -W -f='${Version}' nvidia-driver 2>/dev/null || true)"
if cnp_have nvidia-smi && nvidia-smi >/dev/null 2>&1; then
    echo "[$SCRIPT_INDEX] Driver already active: $(nvidia-smi -L 2>/dev/null | head -1)"
    # Step 3b: an ACTIVE driver can still be too old for every unified policy
    # tier (cuda_policy_tag resolves empty). Upgrade it from NVIDIA's official
    # repo instead of letting the wheel chain degrade to CPU.
    if cuda_policy_driver_below_tiers; then
        cnp_upgrade_driver_for_policy "$CNP_NEWEST_ROW"
    fi
elif [ -n "$CNP_INSTALLED_DRIVER" ] && [ -n "$CNP_TARGET_DRIVER" ] \
    && dpkg --compare-versions "$CNP_INSTALLED_DRIVER" ge "$CNP_TARGET_DRIVER"; then
    # A policy-satisfying driver is already installed but nvidia-smi does not
    # work yet: pending reboot, or the nvidia-smi provider package is missing.
    # Route to the policy path (ensures nvidia-driver-cuda), never nvidia-detect.
    echo "[$SCRIPT_INDEX] Driver $CNP_INSTALLED_DRIVER installed but nvidia-smi is not working yet (pending reboot or missing provider)."
    cnp_upgrade_driver_for_policy "$CNP_NEWEST_ROW"
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
