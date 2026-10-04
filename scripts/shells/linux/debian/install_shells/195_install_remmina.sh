#!/usr/bin/env bash
SCRIPT_INDEX="195"
# ---------------------------------------------------------------------------
# 195_install_remmina.sh - Idempotent installer for the Remmina remote-desktop
#   client (RDP/VNC/SSH GUI). It is the single owner of the Remmina package
#   list: the window launcher (pycore/pyutils/launcher) and the remote-control
#   menu (common/remote_control_common.sh) both call it.
#
# Installs only what is missing: remmina, remmina-plugin-rdp, remmina-plugin-vnc
# (shared-desktop connections to Windows VNC hosts), remmina-plugin-secret
# (passwords in the desktop keyring). Desktop systems
# only (a headless host skips). NON-FATAL: an unavailable package leaves the
# rest installed. Debian 13 / Ubuntu 26.04 / Kali (apt).
#
# Usage:
#   ./195_install_remmina.sh            # ensure installed (no-op when present)
#   ./195_install_remmina.sh --force    # reinstall even if present
# ---------------------------------------------------------------------------
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

set -uo pipefail

REMMINA_BINARY="remmina"
REMMINA_PACKAGES=(remmina remmina-plugin-rdp remmina-plugin-vnc remmina-plugin-secret)
FORCE=0
SUDO=""
NEED=()
INSTALLABLE=()
pkg=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --force) FORCE=1; shift ;;
        *) shift ;;
    esac
done

echo "[$SCRIPT_INDEX] Remmina installation (ensure)"

if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" && "${HAS_DESKTOP_ENVIRONMENT:-false}" != "true" ]]; then
    echo "[i] no desktop environment detected; skipping Remmina (GUI application)."
    exit 0
fi

if ! command -v apt-get >/dev/null 2>&1; then
    echo "[i] apt-get not found (non-Debian); skipping. Install Remmina manually."
    exit 0
fi

for pkg in "${REMMINA_PACKAGES[@]}"; do
    if [[ "$FORCE" -eq 0 ]] && dpkg-query -W -f='${Status}' "$pkg" 2>/dev/null | grep -q "install ok installed"; then
        echo "[OK] $pkg already installed; skipping."
    else
        NEED+=("$pkg")
    fi
done

if [[ ${#NEED[@]} -eq 0 ]] && command -v "$REMMINA_BINARY" >/dev/null 2>&1; then
    echo "[OK] Remmina already satisfied: $(command -v "$REMMINA_BINARY")"
    exit 0
fi

if [[ "$(id -u)" -ne 0 ]]; then
    command -v sudo >/dev/null 2>&1 && SUDO="sudo"
fi

$SUDO env DEBIAN_FRONTEND=noninteractive apt-get update >/dev/null 2>&1 || true
for pkg in "${NEED[@]}"; do
    if apt-cache show "$pkg" >/dev/null 2>&1; then
        INSTALLABLE+=("$pkg")
    else
        echo "[i] no apt candidate for $pkg; skipped."
    fi
done

if [[ ${#INSTALLABLE[@]} -eq 0 ]]; then
    echo "[!] none of the missing Remmina packages is available from apt (${NEED[*]})."
elif echo "[..] apt-get install: ${INSTALLABLE[*]}" && $SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y "${INSTALLABLE[@]}" >/dev/null 2>&1; then
    echo "[OK] Remmina packages installed: ${INSTALLABLE[*]}"
else
    echo "[!] Some Remmina packages failed to install (${INSTALLABLE[*]})."
fi

if command -v "$REMMINA_BINARY" >/dev/null 2>&1; then
    echo "[OK] Remmina ready: $(command -v "$REMMINA_BINARY")"
else
    echo "[!] Remmina binary not found after install."
fi
exit 0
