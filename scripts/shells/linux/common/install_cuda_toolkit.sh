#!/usr/bin/env bash
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
# install_cuda_toolkit.sh - Install the toolkit selected by the unified CUDA policy.
#
# Kali-rolling reality (see the manual install log this encodes):
#   - apt `nvidia-cuda-toolkit` / `nvidia-cuda-dev` are obsoleted (replaced by
#     libcu++-dev) and `cuda-toolkit` is NOT in the Kali repos -> apt cannot install it.
#   - the official .run local installer's `cuda-installer` binary needs libxml2.so.2,
#     but Kali ships libxml2.so.16 -> "cannot open shared object file: libxml2.so.2".
#   - Kali's gcc can be newer than the selected CUDA toolkit expects -> use --override.
#     fails unless `--override` is passed.
#   - /tmp can be too small for the ~6G extraction -> a large --tmpdir is required.
#
# Therefore on Kali (and any host without an NVIDIA CUDA apt repo) we use the
# official .run local installer with: a SCOPED libxml2 shim via LD_LIBRARY_PATH (no
# permanent system-wide symlink), a large POSIX --tmpdir, and
# `--silent --toolkit --override`. Idempotent: skips when nvcc is already present.
#
# Usage: bash install_cuda_toolkit.sh        # install/repair now
#        source install_cuda_toolkit.sh; cti_ensure_cuda_toolkit

set -u

# --- Variable declarations (top of file) ---
CTI_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CTI_CUDA_POLICY_LIB="$CTI_SCRIPT_DIR/base_libs/cuda_index.sh"
[[ -f "$CTI_CUDA_POLICY_LIB" ]] && source "$CTI_CUDA_POLICY_LIB"
CTI_POLICY_TAG="$(cuda_policy_tag 2>/dev/null || true)"
CTI_POLICY_VERSION="$(cuda_policy_field toolkit "$CTI_POLICY_TAG" 2>/dev/null || true)"
CTI_POLICY_DRIVER="$(cuda_policy_field toolkit_driver "$CTI_POLICY_TAG" 2>/dev/null || true)"
CTI_DEFAULT_ROW="${AI_CUDA_TIERS%%,*}"
IFS=':' read -r CTI_DEFAULT_TAG CTI_DEFAULT_MINIMUM CTI_DEFAULT_MAJOR CTI_DEFAULT_VERSION CTI_DEFAULT_DRIVER CTI_DEFAULT_PADDLE <<< "$CTI_DEFAULT_ROW"
CTI_CUDA_VERSION="${CUDA_TOOLKIT_VERSION:-${CTI_POLICY_VERSION:-$CTI_DEFAULT_VERSION}}"
CTI_CUDA_SHORT="$(echo "$CTI_CUDA_VERSION" | cut -d. -f1,2)"
CTI_CUDA_DRIVER="${CUDA_RUN_DRIVER:-${CTI_POLICY_DRIVER:-$CTI_DEFAULT_DRIVER}}"
CTI_RUN_FILE="cuda_${CTI_CUDA_VERSION}_${CTI_CUDA_DRIVER}_linux.run"
CTI_RUN_URL="https://developer.download.nvidia.com/compute/cuda/${CTI_CUDA_VERSION}/local_installers/${CTI_RUN_FILE}"
CTI_CUDA_HOME="/usr/local/cuda-${CTI_CUDA_SHORT}"
CTI_NVCC="${CTI_CUDA_HOME}/bin/nvcc"
CTI_MIN_FREE_GB="${CUDA_MIN_FREE_GB:-10}"

cti_have() { command -v "$1" >/dev/null 2>&1; }
cti_sudo() { if [ "$(id -u)" -eq 0 ]; then "$@"; else sudo "$@"; fi; }
cti_os_id() { local id=""; [ -r /etc/os-release ] && id="$(. /etc/os-release 2>/dev/null; echo "${ID:-}")"; echo "$id"; }

# Free whole-GB on the filesystem backing a dir (walk up to nearest existing parent).
cti_free_gb() {
    local p="$1"
    while [ -n "$p" ] && [ "$p" != "/" ] && [ ! -d "$p" ]; do p="$(dirname "$p")"; done
    df -BG --output=avail "$p" 2>/dev/null | tail -1 | tr -dc '0-9'
}

# True when a path is on a POSIX filesystem (the .run extraction + exec bits do NOT
# work reliably on NTFS/exFAT/FUSE).
cti_is_posix_fs() {
    case "$(findmnt -n -o FSTYPE --target "$1" 2>/dev/null | head -1)" in
        ext2|ext3|ext4|xfs|btrfs|zfs|reiserfs|jfs|f2fs|tmpfs) return 0 ;;
        *) return 1 ;;
    esac
}

# Pick a POSIX scratch dir with enough free space for download + extraction.
cti_pick_scratch() {
    local d free
    for d in /var/tmp/cuda_install /opt/cuda_install "${HOME:-/root}/cuda_install" /tmp/cuda_install; do
        cti_sudo mkdir -p "$d" 2>/dev/null || mkdir -p "$d" 2>/dev/null || continue
        cti_is_posix_fs "$d" || continue
        free="$(cti_free_gb "$d")"
        [ -n "$free" ] && [ "$free" -ge "$CTI_MIN_FREE_GB" ] && { echo "$d"; return 0; }
    done
    return 1
}

# Create a scoped libxml2.so.2 symlink (pointing at the newest installed libxml2)
# inside $1, so the cuda-installer binary resolves it via LD_LIBRARY_PATH without a
# permanent system-wide symlink.
cti_make_libxml2_shim() {
    local shim_dir="$1" real=""
    real="$(ldconfig -p 2>/dev/null | grep -oE '/[^ ]*/libxml2\.so\.[0-9]+' | sort -V | tail -1)"
    [ -z "$real" ] && real="$(ls -1 /usr/lib/*/libxml2.so.* /usr/lib/libxml2.so.* 2>/dev/null | sort -V | tail -1)"
    if [ -n "$real" ] && [ -e "$real" ]; then
        ln -sf "$real" "$shim_dir/libxml2.so.2" 2>/dev/null || cti_sudo ln -sf "$real" "$shim_dir/libxml2.so.2" 2>/dev/null || true
        echo "[RUN] libxml2 shim: $shim_dir/libxml2.so.2 -> $real"
    else
        echo "[RUN] WARN: no libxml2.so.* found to shim; installer may fail to load libxml2.so.2."
    fi
}

# Persist CUDA PATH + LD_LIBRARY_PATH via /etc/profile.d (idempotent).
cti_setup_env() {
    local pf="/etc/profile.d/cuda.sh"
    if [ ! -f "$pf" ] || ! grep -q "${CTI_CUDA_HOME}/bin" "$pf" 2>/dev/null; then
        printf 'export PATH=%s/bin:$PATH\nexport LD_LIBRARY_PATH=%s/lib64:${LD_LIBRARY_PATH:-}\n' \
            "$CTI_CUDA_HOME" "$CTI_CUDA_HOME" | cti_sudo tee "$pf" >/dev/null 2>&1 || true
        echo "[OK] Wrote CUDA env to $pf"
    fi
}

cti_ensure_cuda_toolkit() {
    local os scratch run_path shim_dir free ver toolkit_package
    echo "============================================================"
    echo " CUDA Toolkit prerequisite installer (pinned ${CTI_CUDA_VERSION})"
    echo "============================================================"

    # Idempotent skip only when the active nvcc matches the canonical minor.
    if [ -x "$CTI_NVCC" ] || cti_have nvcc; then
        ver="$( { "$CTI_NVCC" --version 2>/dev/null || nvcc --version 2>/dev/null; } | grep -i release | head -1)"
        if [[ "$ver" == *"release $CTI_CUDA_SHORT"* ]]; then
            echo "[SKIP] Canonical CUDA toolkit already installed: $(command -v nvcc 2>/dev/null || echo "$CTI_NVCC")"
            [ -n "$ver" ] && echo "       $ver"
            cti_setup_env
            return 0
        fi
        echo "[INFO] Active nvcc differs from policy $CTI_CUDA_SHORT; installing the canonical toolkit alongside it."
    fi

    os="$(cti_os_id)"

    # Path A: versioned cuda-toolkit package when an NVIDIA CUDA apt repo is configured
    # (typical on Ubuntu/Debian with the network repo). Kali has none -> skip.
    toolkit_package="cuda-toolkit-${CTI_CUDA_SHORT//./-}"
    if [ "$os" != "kali" ] && cti_have apt-get && apt-cache show "$toolkit_package" >/dev/null 2>&1; then
        echo "[APT] NVIDIA CUDA repo detected -> installing $toolkit_package..."
        if cti_sudo apt-get install -y "$toolkit_package" && { cti_have nvcc || [ -x "$CTI_NVCC" ]; }; then
            echo "[OK] CUDA toolkit installed via apt."
            cti_setup_env
            return 0
        fi
        echo "[APT] apt install did not yield nvcc; falling back to the .run installer."
    fi

    # Path B: official local .run installer (Kali + any host without the apt repo).
    echo "[RUN] apt cuda-toolkit unavailable -> using the official .run local installer."
    if ! scratch="$(cti_pick_scratch)"; then
        echo "[ERROR] No POSIX scratch dir with >=${CTI_MIN_FREE_GB}G free for the CUDA .run" >&2
        echo "        (~4G download + ~6G extraction). Free space or set CUDA_MIN_FREE_GB lower." >&2
        return 1
    fi
    free="$(cti_free_gb "$scratch")"
    echo "[RUN] Scratch/tmpdir: $scratch (free ${free}G, POSIX)"
    run_path="$scratch/$CTI_RUN_FILE"

    # Download (resumable + cached; re-fetch only if missing/truncated).
    if [ ! -s "$run_path" ] || [ "$(stat -c %s "$run_path" 2>/dev/null || echo 0)" -lt 1000000000 ]; then
        echo "[RUN] Downloading $CTI_RUN_URL (~4G)..."
        if cti_have curl; then
            cti_sudo curl -fL --retry 3 -C - -o "$run_path" "$CTI_RUN_URL" || { echo "[ERROR] download failed" >&2; return 1; }
        elif cti_have wget; then
            cti_sudo wget -c -O "$run_path" "$CTI_RUN_URL" || { echo "[ERROR] download failed" >&2; return 1; }
        else
            echo "[ERROR] neither curl nor wget available for download" >&2; return 1
        fi
    else
        echo "[RUN] Using cached installer: $run_path"
    fi

    # Scoped libxml2 shim (Kali ships libxml2.so.16; installer wants .so.2).
    shim_dir="$scratch/_libshim"
    cti_sudo mkdir -p "$shim_dir" 2>/dev/null || mkdir -p "$shim_dir" 2>/dev/null || true
    cti_make_libxml2_shim "$shim_dir"

    echo "[RUN] Installing CUDA toolkit: --silent --toolkit --override (tmpdir=$scratch)"
    # --toolkit  : toolkit only (driver comes from apt nvidia-driver, not the .run)
    # --override : bypass the gcc/version compatibility check (Kali gcc is newer)
    # --silent   : non-interactive
    cti_sudo env LD_LIBRARY_PATH="$shim_dir:${LD_LIBRARY_PATH:-}" \
        sh "$run_path" --silent --toolkit --override --tmpdir="$scratch" \
        || echo "[RUN] WARN: .run returned non-zero (libxml2 'no version information' is benign); verifying nvcc..."

    if [ -x "$CTI_NVCC" ]; then
        echo "[OK] CUDA toolkit installed: $CTI_NVCC"
        "$CTI_NVCC" --version 2>/dev/null | grep -i release | head -1
        cti_setup_env
        return 0
    fi
    echo "[ERROR] CUDA toolkit install did not produce $CTI_NVCC. See /var/log/cuda-installer.log" >&2
    return 1
}

# Allow standalone execution.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    cti_ensure_cuda_toolkit "$@"
fi
