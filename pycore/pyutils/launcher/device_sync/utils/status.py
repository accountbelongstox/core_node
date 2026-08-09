# -*- coding: utf-8 -*-
"""
Device Sync - Status and Diagnostics Utilities

Combined functionality from check_status.py and diagnose.py.
Provides status checking and diagnostic tools for Device Sync.
"""

import sys
import os
import socket
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.commander import exec_silent, exec_realtime
from pycore.pyfoundations.pygvar import TMP_DIR
from pathlib import Path

from pycore.pyfoundations.third_party.api import get_third_package_pystray



def check_ipc_server(verbose=True):
    """
    Check if IPC server is running.

    Args:
        verbose: Print status messages

    Returns:
        True if IPC server is running
    """
    if verbose:
        ColorPrint.plain("[Check] Testing IPC server connection...")

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        result = sock.connect_ex(('127.0.0.1', 45678))
        sock.close()

        if result == 0:
            if verbose:
                ColorPrint.plain("    ✓ IPC server is RUNNING")
                ColorPrint.plain("    → Device Sync is active")
            return True
        else:
            if verbose:
                ColorPrint.plain("    ✗ IPC server NOT responding")
                ColorPrint.plain("    → Device Sync is NOT running")
            return False
    except Exception as e:
        if verbose:
            ColorPrint.plain(f"    ✗ Error: {e}")
        return False


def check_pystray(verbose=True):
    """
    Check if pystray is installed.

    Args:
        verbose: Print status messages

    Returns:
        True if pystray is installed
    """
    if verbose:
        ColorPrint.plain("[Check] Testing pystray availability...")

    try:
        pystray = get_third_package_pystray()
        if verbose:
            ColorPrint.plain("    ✓ pystray is installed")
        return True
    except ImportError:
        if verbose:
            ColorPrint.plain("    ✗ pystray NOT installed")
            ColorPrint.plain("    → Install with: pip install pystray pillow")
        return False


def check_process(verbose=True):
    """
    Check if Device Sync process is running.

    Args:
        verbose: Print status messages

    Returns:
        True if process is running
    """
    if verbose:
        ColorPrint.plain("[Check] Checking for Device Sync process...")

    try:
        if sys.platform == 'win32':
            # Windows
            result = exec_silent(
                ['tasklist', '/FI', 'IMAGENAME eq pythonw.exe', '/FO', 'CSV'],
                capture_output=True,
                text=True,
                encoding='utf-8'
            )

            if 'pythonw.exe' in result.stdout:
                if verbose:
                    count = result.stdout.count('pythonw.exe')
                    ColorPrint.plain(f"    ✓ Found {count} pythonw.exe process(es)")
                return True
            else:
                if verbose:
                    ColorPrint.plain("    ✗ No pythonw.exe process found")
                return False
        else:
            # Linux
            result = exec_silent(
                ['pgrep', '-f', 'device_sync'],
                capture_output=True,
                text=True
            )

            if result.return_code == 0:
                if verbose:
                    ColorPrint.plain("    ✓ Device Sync process found")
                return True
            else:
                if verbose:
                    ColorPrint.plain("    ✗ No device_sync process found")
                return False
    except Exception as e:
        if verbose:
            ColorPrint.plain(f"    ✗ Error: {e}")
        return False


def view_log():
    """Display log file contents."""
    ColorPrint.plain("[Check] Checking log files...")

    log_dir = TMP_DIR / 'device_sync'
    launcher_log = log_dir / 'device_sync_launcher.log'
    main_log = log_dir / 'device_sync.log'

    found_any = False

    # Check launcher log
    if launcher_log.exists():
        ColorPrint.plain(f"    ✓ Launcher log found: {launcher_log}")
        found_any = True

        ColorPrint.plain()
        ColorPrint.plain("=" * 60)
        ColorPrint.plain("LAUNCHER LOG (from launcher.py startup)")
        ColorPrint.plain("=" * 60)

        try:
            with open(launcher_log, 'r', encoding='utf-8') as f:
                content = f.read()

            if content.strip():
                ColorPrint.plain(content)
            else:
                ColorPrint.plain("    (Log file is empty)")

            ColorPrint.plain()
            ColorPrint.plain("=" * 60)
            ColorPrint.plain()

        except Exception as e:
            ColorPrint.plain(f"    ✗ Failed to read launcher log: {e}")
    else:
        ColorPrint.plain(f"    ✗ Launcher log NOT found: {launcher_log}")

    ColorPrint.plain()

    # Check main log
    if main_log.exists():
        ColorPrint.plain(f"    ✓ Main log found: {main_log}")
        found_any = True

        ColorPrint.plain()
        ColorPrint.plain("=" * 60)
        ColorPrint.plain("DEVICE SYNC MAIN LOG (from background process)")
        ColorPrint.plain("=" * 60)

        try:
            with open(main_log, 'r', encoding='utf-8') as f:
                content = f.read()

            if content.strip():
                ColorPrint.plain(content)
            else:
                ColorPrint.plain("    (Log file is empty)")

            ColorPrint.plain()
            ColorPrint.plain("=" * 60)
            ColorPrint.plain()

        except Exception as e:
            ColorPrint.plain(f"    ✗ Failed to read main log: {e}")
    else:
        ColorPrint.plain(f"    ✗ Main log NOT found: {main_log}")

    if not found_any:
        ColorPrint.plain()
        ColorPrint.plain("    → No log files found")
        ColorPrint.plain("    → Logs are only created when running in background mode")


def check_status():
    """
    Run basic status check (simple mode).

    This is the simpler version from check_status.py.
    """
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


def diagnose():
    """
    Run full diagnostics (detailed mode).

    This is the more detailed version from diagnose.py.
    """
    ColorPrint.plain()
    ColorPrint.plain("=" * 60)
    ColorPrint.plain("Device Sync - Diagnostic Tool")
    ColorPrint.plain("=" * 60)
    ColorPrint.plain()

    # Run checks
    ipc_running = check_ipc_server()
    ColorPrint.plain()

    pystray_available = check_pystray()
    ColorPrint.plain()

    process_running = check_process()
    ColorPrint.plain()

    # View log
    view_log()

    # Summary
    ColorPrint.plain()
    ColorPrint.plain("=" * 60)
    ColorPrint.plain("SUMMARY")
    ColorPrint.plain("=" * 60)
    ColorPrint.plain()

    if ipc_running and pystray_available:
        ColorPrint.plain("✓ Device Sync is RUNNING")
        ColorPrint.plain()
        ColorPrint.plain("Tray icon should be visible in:")
        ColorPrint.plain("  Windows: System tray (bottom-right, click ^ icon)")
        ColorPrint.plain()
        ColorPrint.plain("If you don't see the icon:")
        ColorPrint.plain("  1. Click the ^ arrow in system tray")
        ColorPrint.plain("  2. Look for 'Device Sync' icon")
        ColorPrint.plain("  3. Right-click icon to open menu")
        ColorPrint.plain()

    elif ipc_running and not pystray_available:
        ColorPrint.plain("⚠ Device Sync is running WITHOUT tray icon")
        ColorPrint.plain()
        ColorPrint.plain("To enable tray icon, install pystray:")
        ColorPrint.plain("  pip install pystray pillow")
        ColorPrint.plain()

    else:
        ColorPrint.plain("✗ Device Sync is NOT running")
        ColorPrint.plain()
        ColorPrint.plain("To start Device Sync:")
        ColorPrint.plain()
        ColorPrint.plain("  Method 1 - Debug mode (see all output):")
        ColorPrint.plain("    cd D:\\programing\\core_node\\pycore\\pyutils\\launcher\\device_sync")
        ColorPrint.plain("    start_debug.bat")
        ColorPrint.plain()
        ColorPrint.plain("  Method 2 - Background mode:")
        ColorPrint.plain("    python -m pycore.pyutils.launcher.launcher")
        ColorPrint.plain("    Select option [2] - Launch Device Sync Only")
        ColorPrint.plain()
        ColorPrint.plain("  Method 3 - Direct launch:")
        ColorPrint.plain("    python -m pycore.pyutils.launcher.device_sync")
        ColorPrint.plain()

    ColorPrint.plain("=" * 60)
    ColorPrint.plain()


def main_status():
    """Entry point for status check."""
    check_status()


def main_diagnose():
    """Entry point for diagnostics."""
    diagnose()
    input("Press Enter to exit...")


if __name__ == '__main__':
    # Run diagnostics if executed directly
    main_diagnose()
