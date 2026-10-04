#!/usr/bin/env bash
SCRIPT_INDEX="149"
# ---------------------------------------------------------------------------
# 149_install_device_tools.sh - Optional Android device-control tools for pycore.
#
# Invoked sequentially by prepare_pycore_prerequisites.sh (pyservice; scripts never call siblings).
# Installs the system binaries pycore uses to talk to / mirror Android devices:
#   - adb     -> Android Debug Bridge on PATH (apt)
#   - scrcpy  -> the official Genymobile static release (adb, scrcpy, scrcpy-server)
#                in <cache_root.linux>/scrcpy (ext4, never NTFS; contract
#                paths.drive_layout.scrcpy_bundle_dir), the bundle pycore resolves (pycore never
#                downloads it). Source: https://github.com/Genymobile/scrcpy/releases
#                (scrcpy-linux-x86_64-v<version>.tar.gz, sha256 from the release's SHA256SUMS.txt).
#
# IDEMPOTENT: adb is skipped when on PATH; the bundle is skipped when adb, scrcpy and
# scrcpy-server are present in the bundle dir. --force reinstalls both.
#
# Usage:  ./149_install_device_tools.sh [--python <py>] [--force]
#         (--python is accepted but unused: these are system binaries, not pip pkgs.)
# ---------------------------------------------------------------------------
set -uo pipefail

FORCE=0
PYTHON_BIN="python3"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_NODE_ROOT="$(cd "$SCRIPT_CURRENT_DIR/../../../../.." && pwd)"
SCRCPY_VERSION=""
SCRCPY_FILES=(adb scrcpy scrcpy-server)
. "$SCRIPT_CURRENT_DIR/../../common/shared_cache_env.sh"
SCRCPY_VERSION="$(sc_get versions.scrcpy)"
if [[ -z "$SCRCPY_VERSION" ]]; then
    echo "[install_device_tools] [!] service contract is missing versions.scrcpy." >&2
    exit 1
fi
SCRCPY_RELEASE_BASE="https://github.com/Genymobile/scrcpy/releases/download/v${SCRCPY_VERSION}"
SCRCPY_ARCHIVE="scrcpy-linux-x86_64-v${SCRCPY_VERSION}.tar.gz"
SCRCPY_DIR="${SCRCPY_HOME:?SCRCPY_HOME is not set by shared_cache_env.sh}"

# Accept prepare_pycore_prerequisites.sh's --python (unused here);
# honor --force to reinstall when present.
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

# sudo prefix (root -> none; else sudo when available).
SUDO=""
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then SUDO="sudo"; fi

scrcpy_bundle_ready() {
    local name
    for name in "${SCRCPY_FILES[@]}"; do
        [[ -s "$SCRCPY_DIR/$name" ]] || return 1
    done
}

install_adb() {
    if command -v adb >/dev/null 2>&1 && [[ "$FORCE" -eq 0 ]]; then
        echo "[install_device_tools] [OK] adb already present; skipping."
        return 0
    fi
    command -v apt-get >/dev/null 2>&1 || { echo "[install_device_tools] [!] apt-get not found; install adb manually (apt install adb)." >&2; return 1; }
    echo "[install_device_tools] [..] apt-get install adb"
    $SUDO apt-get update -qq || return 1
    $SUDO apt-get install -y adb || return 1
}

install_scrcpy_bundle() {
    local work expected actual extracted name
    if scrcpy_bundle_ready && [[ "$FORCE" -eq 0 ]]; then
        echo "[install_device_tools] [OK] scrcpy bundle present: $SCRCPY_DIR"
        return 0
    fi
    command -v curl >/dev/null 2>&1 || { echo "[install_device_tools] [!] curl not found." >&2; return 1; }
    work="$(mktemp -d)" || return 1
    echo "[install_device_tools] [..] downloading $SCRCPY_ARCHIVE"
    curl -fL --retry 5 --retry-delay 2 --retry-all-errors --connect-timeout 30 \
        -o "$work/$SCRCPY_ARCHIVE" "$SCRCPY_RELEASE_BASE/$SCRCPY_ARCHIVE" || { rm -rf "$work"; return 1; }
    curl -fsSL --retry 5 --connect-timeout 30 -o "$work/SHA256SUMS.txt" "$SCRCPY_RELEASE_BASE/SHA256SUMS.txt" || { rm -rf "$work"; return 1; }
    expected="$(awk -v f="$SCRCPY_ARCHIVE" '$2 == f || $2 == "*" f {print $1; exit}' "$work/SHA256SUMS.txt")"
    actual="$(sha256sum "$work/$SCRCPY_ARCHIVE" | awk '{print $1}')"
    if [[ -z "$expected" || "$expected" != "$actual" ]]; then
        echo "[install_device_tools] [!] sha256 mismatch for $SCRCPY_ARCHIVE (expected '${expected:-none}', got '$actual')." >&2
        rm -rf "$work"
        return 1
    fi
    mkdir -p "$work/x" && tar -xzf "$work/$SCRCPY_ARCHIVE" -C "$work/x" || { rm -rf "$work"; return 1; }
    extracted="$(find "$work/x" -mindepth 1 -maxdepth 1 -type d | head -n1)"
    [[ -n "$extracted" ]] || { echo "[install_device_tools] [!] archive has no top directory." >&2; rm -rf "$work"; return 1; }
    $SUDO mkdir -p "$SCRCPY_DIR" && $SUDO cp -a "$extracted"/. "$SCRCPY_DIR"/ || { rm -rf "$work"; return 1; }
    rm -rf "$work"
    $SUDO chmod -R a+rX "$SCRCPY_DIR"
    for name in adb scrcpy; do $SUDO chmod a+rx "$SCRCPY_DIR/$name"; done
    scrcpy_bundle_ready || { echo "[install_device_tools] [!] bundle incomplete after extract: $SCRCPY_DIR" >&2; return 1; }
    echo "[install_device_tools] [OK] scrcpy v$SCRCPY_VERSION installed: $SCRCPY_DIR"
}

failed=0
install_adb || failed=1
install_scrcpy_bundle || failed=1
if [[ "$failed" -eq 1 ]]; then
    echo "[install_device_tools] [!] device tools incomplete; will retry next run." >&2
    exit 1
fi
echo "[install_device_tools] [OK] device tools ready."
