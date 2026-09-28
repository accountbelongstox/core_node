#!/bin/bash
# Shared NVIDIA driver upgrade notice (evidence-driven, idempotent) - Linux mirror of
# scripts/shells/win/win_common/NvidiaDriverUpgradeNoticeCommon.ps1.
#
# pycore service processes have been hard-killed by NVIDIA driver-layer faults
# (nvcuda64.dll access violations on Windows; NVRM Xid errors and libcuda
# segfaults on Linux): a native crash bypasses Python entirely, so the console
# shows no traceback and no shutdown lines - the service just disappears.
# Code-side isolation (memory_gate nvidia-smi probe, lazy torch) bounds the
# blast radius, but the driver itself still needs a manual upgrade.
#
# Source this file and call nvidia_driver_upgrade_notice from any script; it
# watches the kernel log (journalctl -k, dmesg fallback) for NVRM Xid errors
# and nvidia/libcuda segfaults inside a recent window and prints upgrade
# guidance. Idempotency: the notice is recorded per (driver version, latest
# crash timestamp) in the shared file-backed global-var store, so a re-run
# stays silent until the driver version changes or a NEWER crash appears.
# GPU-less hosts are skipped via the shared GPU policy
# (base_libs/lib_gpu.sh -> gpu_present).
#
# It never installs anything. Works on Debian 13 (trixie) / Ubuntu 26.04
# (systemd journal; dmesg fallback for non-systemd hosts).
# Skip switch: NVIDIA_DRIVER_NOTICE_SKIP=1

NVIDIA_DRIVER_NOTICE_VAR_KEY="NVIDIA_DRIVER_UPGRADE_NOTICE"
NVIDIA_DRIVER_NOTICE_CRASH_WINDOW_DAYS=14
NVIDIA_DRIVER_NOTICE_DOWNLOAD_URL="https://www.nvidia.com/Download/index.aspx"

_nvidia_notice_common_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v gpu_present >/dev/null 2>&1; then
    # shellcheck source=base_libs/lib_gpu.sh
    . "$_nvidia_notice_common_dir/base_libs/lib_gpu.sh"
fi
if ! command -v set_global_var >/dev/null 2>&1; then
    # shellcheck source=global_var_store.sh
    . "$_nvidia_notice_common_dir/global_var_store.sh"
fi

nvidia_driver_upgrade_notice() {
    local prefix="${1:-[nvidia-driver-notice]}"
    local sudo_cmd="${USE_SUDO:-}"
    local smi="" driver_version="" kernel_log="" crash_lines="" crash_count=0
    local latest_crash="" marker_stamp="" marker=""

    if [[ "${NVIDIA_DRIVER_NOTICE_SKIP:-0}" == "1" ]]; then
        echo "$prefix [i] NVIDIA_DRIVER_NOTICE_SKIP=1 -> skipping."
        return 1
    fi
    if ! gpu_present; then
        echo "$prefix [i] no NVIDIA GPU (shared GPU policy) -> skipping."
        return 1
    fi
    if [[ -z "$sudo_cmd" && "$(id -u)" -ne 0 ]] && command -v sudo >/dev/null 2>&1; then
        sudo_cmd="sudo"
    fi

    smi="$(command -v nvidia-smi 2>/dev/null || true)"
    if [[ -n "$smi" ]]; then
        driver_version="$("$smi" --query-gpu=driver_version --format=csv,noheader 2>/dev/null | head -n1 | tr -d '\r' | xargs 2>/dev/null || true)"
    fi
    echo "$prefix  driver: ${driver_version:-unknown}"

    # Crash evidence: NVRM Xid errors and nvidia/libcuda segfaults in the kernel
    # log (the Linux counterpart of WER nvcuda*.dll APPCRASH entries).
    if command -v journalctl >/dev/null 2>&1; then
        kernel_log="$($sudo_cmd journalctl -k --since "$NVIDIA_DRIVER_NOTICE_CRASH_WINDOW_DAYS days ago" --no-pager -o short-iso 2>/dev/null || journalctl -k --since "$NVIDIA_DRIVER_NOTICE_CRASH_WINDOW_DAYS days ago" --no-pager -o short-iso 2>/dev/null || true)"
    fi
    if [[ -z "$kernel_log" ]] && command -v dmesg >/dev/null 2>&1; then
        kernel_log="$($sudo_cmd dmesg -T 2>/dev/null || dmesg -T 2>/dev/null || true)"
    fi
    crash_lines="$(printf '%s\n' "$kernel_log" | grep -iE 'NVRM: Xid|nvidia.*segfault|segfault.*(libcuda|nvcuda)' || true)"
    if [[ -z "$crash_lines" ]]; then
        echo "$prefix [OK] no NVRM Xid / libcuda crash lines in the last $NVIDIA_DRIVER_NOTICE_CRASH_WINDOW_DAYS days; driver looks stable."
        return 1
    fi
    crash_count="$(printf '%s\n' "$crash_lines" | grep -c . || true)"
    latest_crash="$(printf '%s\n' "$crash_lines" | tail -n1 | awk '{print $1, $2}')"
    echo "$prefix [!] $crash_count NVRM/libcuda crash line(s) in the last $NVIDIA_DRIVER_NOTICE_CRASH_WINDOW_DAYS days; latest: ${latest_crash:-unknown}" >&2

    # Idempotency marker: one notice per (driver version, latest crash) state.
    marker_stamp="driver=${driver_version:-unknown};crash=${latest_crash:-unknown}"
    marker="$(get_global_var "$NVIDIA_DRIVER_NOTICE_VAR_KEY" "")"
    if [[ "$marker" == "$marker_stamp" ]]; then
        echo "$prefix [idempotent] notice already shown for this driver/crash state -> skipping."
        return 1
    fi

    echo "$prefix [!] ACTION: upgrade the NVIDIA driver (current: ${driver_version:-unknown})." >&2
    echo "$prefix     NVIDIA driver faults kill python processes without any console message." >&2
    echo "$prefix     Debian/Ubuntu: apt install nvidia-driver  (or $NVIDIA_DRIVER_NOTICE_DOWNLOAD_URL; install, reboot, this notice clears itself)" >&2
    set_global_var "$NVIDIA_DRIVER_NOTICE_VAR_KEY" "$marker_stamp" "false" >/dev/null 2>&1 || true
    return 0
}
