#!/usr/bin/env bash
SCRIPT_INDEX="149"
# ---------------------------------------------------------------------------
# install_device_tools.sh - Optional Android device-control tools for pycore.
#
# Invoked sequentially by prepare_pycore_prerequisites.sh (pyservice; scripts never call siblings).
# Installs the optional system binaries pycore
# uses to talk to / mirror Android devices:
#   - adb     -> Android Debug Bridge (device discovery, shell, file transfer)
#   - scrcpy  -> screen mirroring / control of a connected device
#
# These are OPTIONAL: when apt cannot provide scrcpy (it is NOT in Debian 13
# trixie), this script invokes pycore's scrcpy_init.py self-download (official
# GitHub static build) as the fallback, so a failed apt install is non-fatal.
#
# IDEMPOTENT: each binary is skipped when already on PATH.
# Cross-distro: the `adb` (android-tools-adb -> adb) and `scrcpy` apt packages
# ship on Debian 11-12, Ubuntu 18.04-26.04 and Kali (distro main repos). scrcpy is
# NOT in Debian 13 trixie, so each package installs independently and a missing one
# triggers the pycore scrcpy_init.py self-download fallback below.
#
# Usage:  ./install_device_tools.sh [--python <py>] [--force]
#         (--python is accepted but unused: these are system binaries, not pip pkgs.)
# ---------------------------------------------------------------------------
set -uo pipefail

FORCE=0
FAILED=()
PYTHON_BIN="python3"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_NODE_ROOT="$(cd "$SCRIPT_CURRENT_DIR/../../../../.." && pwd)"

# Accept prepare_pycore_prerequisites.sh's --python (used for the pycore
# self-download fallback); honor --force to reinstall when present.
while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) PYTHON_BIN="${2:-python3}"; shift 2 2>/dev/null || shift ;;
        --force)  FORCE=1; shift ;;
        *)        shift ;;
    esac
done

echo "============================================================"
echo " Installing Android device-control tools (adb, scrcpy)"
echo "============================================================"

# Idempotent: nothing to do when both are already present (unless --force).
if [[ "$FORCE" -eq 0 ]] && command -v adb >/dev/null 2>&1 && command -v scrcpy >/dev/null 2>&1; then
    echo "[install_device_tools] [OK] adb + scrcpy already present; skipping."
    exit 0
fi

# sudo prefix (root -> none; else sudo when available).
SUDO=""
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then SUDO="sudo"; fi

if ! command -v apt-get >/dev/null 2>&1; then
    echo "[install_device_tools] [!] apt-get not found; cannot auto-install. Install manually: apt install adb scrcpy"
    echo "[install_device_tools] [i] pycore's scrcpy_init.py self-download is the fallback."
    exit 0
fi

# Map each needed binary to its apt package, install only what is missing.
NEED=()
for map in "adb:adb" "scrcpy:scrcpy"; do
    dev_bin="${map%%:*}"
    dev_pkg="${map##*:}"
    if command -v "$dev_bin" >/dev/null 2>&1 && [[ "$FORCE" -eq 0 ]]; then
        echo "[install_device_tools] [OK] $dev_bin already present; skipping."
    else
        NEED+=("$dev_pkg")
    fi
done

if [[ ${#NEED[@]} -eq 0 ]]; then
    echo "[install_device_tools] [OK] device tools already satisfied."
    exit 0
fi

# Install one package at a time: a package missing from the current distro repo
# (e.g. scrcpy is not in Debian 13 trixie) must not block the others.
echo "[install_device_tools] [..] apt-get install: ${NEED[*]}"
$SUDO apt-get update -qq 2>/dev/null || true
for dev_pkg in "${NEED[@]}"; do
    if $SUDO apt-get install -y "$dev_pkg" >/dev/null 2>&1; then
        echo "[install_device_tools] [OK] installed: $dev_pkg"
    else
        echo "[install_device_tools] [!] failed to apt-install $dev_pkg (not in this distro's repos?)"
        FAILED+=("$dev_pkg")
    fi
done
if [[ ${#FAILED[@]} -gt 0 ]]; then
    echo "[install_device_tools] [!] unavailable via apt: ${FAILED[*]}"
fi

# Fallback: pycore's scrcpy_init.py downloads the official static build
# (GitHub release tarball) into the shared data dir. Wired in directly because
# scrcpy has no apt package on Debian 13 trixie.
if [[ " ${FAILED[*]} " == *" scrcpy "* ]] && ! command -v scrcpy >/dev/null 2>&1; then
    echo "[install_device_tools] [..] scrcpy fallback: pycore scrcpy_init self-download (official GitHub release) ..."
    if (cd "$CORE_NODE_ROOT" && PYCORE_SKIP_DEP_CHECK=1 "$PYTHON_BIN" -m pycore.pyutils.device.scrcpy_init); then
        echo "[install_device_tools] [OK] scrcpy available via pycore self-download."
    else
        echo "[install_device_tools] [!] scrcpy self-download failed; pycore retries it lazily on first use."
    fi
fi

# Non-fatal by design: the service runs regardless of what got installed.
exit 0
