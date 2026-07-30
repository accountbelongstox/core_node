# -*- coding: utf-8 -*-
"""
Device Sync - Status Checker

Check if Device Sync is running and diagnose issues.
"""

import sys
import socket
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.commander import exec_silent, exec_realtime

from pycore.pyfoundations.third_party.api import get_third_package_pystray


def check_ipc_server():
    """Check if IPC server is running."""
    ColorPrint.plain("[Check] Testing IPC server connection...")

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        result = sock.connect_ex(('127.0.0.1', 45678))
        sock.close()

        if result == 0:
            ColorPrint.plain("[Check] ✓ IPC server is running (Device Sync is active)")
            return True
        else:
            ColorPrint.plain("[Check] ✗ IPC server not responding (Device Sync not running)")
            return False
    except Exception as e:
        ColorPrint.plain(f"[Check] ✗ Failed to check IPC: {e}")
        return False

def check_pystray():
    """Check if pystray is installed."""
    ColorPrint.plain("[Check] Testing pystray availability...")

    try:
        pystray = get_third_package_pystray()
        ColorPrint.plain("[Check] ✓ pystray is installed")
        return True
    except ImportError:
        ColorPrint.plain("[Check] ✗ pystray not installed")
        ColorPrint.plain("[Check]   Install with: pip install pystray pillow")
        return False

def check_process():
    """Check if Device Sync process is running."""
    ColorPrint.plain("[Check] Checking for Device Sync process...")

    try:
        if sys.platform == 'win32':
            # Windows
            result = exec_silent(
                ['tasklist', '/FI', 'IMAGENAME eq pythonw.exe'],
                capture_output=True,
                text=True
            )

            if 'pythonw.exe' in result.stdout:
                ColorPrint.plain("[Check] ✓ Background Python process found (pythonw.exe)")
                return True
            else:
                ColorPrint.plain("[Check] ✗ No pythonw.exe process found")
                return False
        else:
            # Linux
            result = exec_silent(
                ['pgrep', '-f', 'device_sync'],
                capture_output=True,
                text=True
            )

            if result.return_code == 0:
                ColorPrint.plain("[Check] ✓ Device Sync process found")
                return True
            else:
                ColorPrint.plain("[Check] ✗ No device_sync process found")
                return False
    except Exception as e:
        ColorPrint.plain(f"[Check] ✗ Failed to check process: {e}")
        return False

def main():
    """Run all checks."""
    ColorPrint.plain("=" * 60)
    ColorPrint.plain("Device Sync - Status Checker")
    ColorPrint.plain("=" * 60)
    ColorPrint.plain()

    # Check 1: IPC Server
    ipc_running = check_ipc_server()
    ColorPrint.plain()

    # Check 2: pystray
    pystray_available = check_pystray()
    ColorPrint.plain()

    # Check 3: Process
    process_running = check_process()
    ColorPrint.plain()

    # Summary
    ColorPrint.plain("=" * 60)
    ColorPrint.plain("Summary:")
    ColorPrint.plain("=" * 60)

    if ipc_running and pystray_available:
        ColorPrint.plain("✓ Device Sync is running")
        ColorPrint.plain("✓ Tray icon should be visible")
        ColorPrint.plain()
        ColorPrint.plain("If you don't see tray icon:")
        ColorPrint.plain("  1. Check Windows system tray (click ^ icon)")
        ColorPrint.plain("  2. Check if icon is hidden in overflow area")
        ColorPrint.plain("  3. Restart Device Sync")
    elif ipc_running and not pystray_available:
        ColorPrint.plain("⚠ Device Sync is running but pystray not installed")
        ColorPrint.plain()
        ColorPrint.plain("To enable tray icon:")
        ColorPrint.plain("  pip install pystray pillow")
    elif not ipc_running:
        ColorPrint.plain("✗ Device Sync is NOT running")
        ColorPrint.plain()
        ColorPrint.plain("To start Device Sync:")
        ColorPrint.plain("  python -m pycore.pyutils.launcher.device_sync")
        ColorPrint.plain()
        ColorPrint.plain("Or use launcher:")
        ColorPrint.plain("  python -m pycore.pyutils.launcher.launcher")
        ColorPrint.plain("  Select option [2] - Launch Device Sync Only")

    ColorPrint.plain("=" * 60)

if __name__ == '__main__':
    main()
