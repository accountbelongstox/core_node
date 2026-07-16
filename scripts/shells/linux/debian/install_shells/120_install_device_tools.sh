#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# install_device_tools.sh - Optional Android device-control tools for pycore.
#
# Invoked sequentially by prepare_pycore_prerequisites.sh (pyservice; scripts never call siblings).
# Installs the optional system binaries pycore
# uses to talk to / mirror Android devices:
#   - adb     -> Android Debug Bridge (device discovery, shell, file transfer)
#   - scrcpy  -> screen mirroring / control of a connected device
#
# These are OPTIONAL: pycore's scrcpy_init.py can self-download a scrcpy build as
# a fallback, so a missing apt or a failed install is non-fatal - the service
# still runs, just without the system-provided binaries.
#
# IDEMPOTENT: each binary is skipped when already on PATH.
# Cross-distro: the `adb` (android-tools-adb -> adb) and `scrcpy` apt packages
# ship on Debian 11-13, Ubuntu 18.04-26.04 and Kali (distro main repos).
#
# Usage:  ./install_device_tools.sh [--python <py>] [--force]
#         (--python is accepted but unused: these are system binaries, not pip pkgs.)
# ---------------------------------------------------------------------------
set -uo pipefail

FORCE=0

# Accept (and ignore) prepare_pycore_prerequisites.sh's --python; honor --force to reinstall when present.
while [[ $# -gt 0 ]]; do
    case "$1" in
        --python) shift 2 2>/dev/null || shift ;;
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

echo "[install_device_tools] [..] apt-get install: ${NEED[*]}"
$SUDO apt-get update -qq 2>/dev/null || true
if $SUDO apt-get install -y "${NEED[@]}" >/dev/null 2>&1; then
    echo "[install_device_tools] [OK] device tools installed: ${NEED[*]}"
else
    echo "[install_device_tools] [!] failed to apt-install ${NEED[*]}; pycore's scrcpy_init.py self-download is the fallback."
fi

# Non-fatal by design: the service runs regardless of what got installed.
exit 0
