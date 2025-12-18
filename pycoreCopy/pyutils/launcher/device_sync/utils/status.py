# -*- coding: utf-8 -*-
"""
Device Sync - Status and Diagnostics Utilities

Combined functionality from check_status.py and diagnose.py.
Provides status checking and diagnostic tools for Device Sync.
"""

import sys
import os
import socket
from pycore.pyfoundations.pybasecommon import exec_silent, exec_realtime
from pathlib import Path
import tempfile


def check_ipc_server(verbose=True):
    """
    Check if IPC server is running.

    Args:
        verbose: Print status messages

    Returns:
        True if IPC server is running
    """
    if verbose:
        print("[Check] Testing IPC server connection...")

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        result = sock.connect_ex(('127.0.0.1', 45678))
        sock.close()

        if result == 0:
            if verbose:
                print("    ✓ IPC server is RUNNING")
                print("    → Device Sync is active")
            return True
        else:
            if verbose:
                print("    ✗ IPC server NOT responding")
                print("    → Device Sync is NOT running")
            return False
    except Exception as e:
        if verbose:
            print(f"    ✗ Error: {e}")
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
        print("[Check] Testing pystray availability...")

    try:
        import pystray
        if verbose:
            print("    ✓ pystray is installed")
        return True
    except ImportError:
        if verbose:
            print("    ✗ pystray NOT installed")
            print("    → Install with: pip install pystray pillow")
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
        print("[Check] Checking for Device Sync process...")

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
                    print(f"    ✓ Found {count} pythonw.exe process(es)")
                return True
            else:
                if verbose:
                    print("    ✗ No pythonw.exe process found")
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
                    print("    ✓ Device Sync process found")
                return True
            else:
                if verbose:
                    print("    ✗ No device_sync process found")
                return False
    except Exception as e:
        if verbose:
            print(f"    ✗ Error: {e}")
        return False


def view_log():
    """Display log file contents."""
    print("[Check] Checking log files...")

    log_dir = Path(tempfile.gettempdir()) / 'device_sync'
    launcher_log = log_dir / 'device_sync_launcher.log'
    main_log = log_dir / 'device_sync.log'

    found_any = False

    # Check launcher log
    if launcher_log.exists():
        print(f"    ✓ Launcher log found: {launcher_log}")
        found_any = True

        print()
        print("=" * 60)
        print("LAUNCHER LOG (from launcher.py startup)")
        print("=" * 60)

        try:
            with open(launcher_log, 'r', encoding='utf-8') as f:
                content = f.read()

            if content.strip():
                print(content)
            else:
                print("    (Log file is empty)")

            print()
            print("=" * 60)
            print()

        except Exception as e:
            print(f"    ✗ Failed to read launcher log: {e}")
    else:
        print(f"    ✗ Launcher log NOT found: {launcher_log}")

    print()

    # Check main log
    if main_log.exists():
        print(f"    ✓ Main log found: {main_log}")
        found_any = True

        print()
        print("=" * 60)
        print("DEVICE SYNC MAIN LOG (from background process)")
        print("=" * 60)

        try:
            with open(main_log, 'r', encoding='utf-8') as f:
                content = f.read()

            if content.strip():
                print(content)
            else:
                print("    (Log file is empty)")

            print()
            print("=" * 60)
            print()

        except Exception as e:
            print(f"    ✗ Failed to read main log: {e}")
    else:
        print(f"    ✗ Main log NOT found: {main_log}")

    if not found_any:
        print()
        print("    → No log files found")
        print("    → Logs are only created when running in background mode")


def check_status():
    """
    Run basic status check (simple mode).

    This is the simpler version from check_status.py.
    """
    print("=" * 60)
    print("Device Sync - Status Checker")
    print("=" * 60)
    print()

    # Check 1: IPC Server
    ipc_running = check_ipc_server()
    print()

    # Check 2: pystray
    pystray_available = check_pystray()
    print()

    # Check 3: Process
    process_running = check_process()
    print()

    # Summary
    print("=" * 60)
    print("Summary:")
    print("=" * 60)

    if ipc_running and pystray_available:
        print("✓ Device Sync is running")
        print("✓ Tray icon should be visible")
        print()
        print("If you don't see tray icon:")
        print("  1. Check Windows system tray (click ^ icon)")
        print("  2. Check if icon is hidden in overflow area")
        print("  3. Restart Device Sync")
    elif ipc_running and not pystray_available:
        print("⚠ Device Sync is running but pystray not installed")
        print()
        print("To enable tray icon:")
        print("  pip install pystray pillow")
    elif not ipc_running:
        print("✗ Device Sync is NOT running")
        print()
        print("To start Device Sync:")
        print("  python -m pycore.pyutils.launcher.device_sync")
        print()
        print("Or use launcher:")
        print("  python -m pycore.pyutils.launcher.launcher")
        print("  Select option [2] - Launch Device Sync Only")

    print("=" * 60)


def diagnose():
    """
    Run full diagnostics (detailed mode).

    This is the more detailed version from diagnose.py.
    """
    print()
    print("=" * 60)
    print("Device Sync - Diagnostic Tool")
    print("=" * 60)
    print()

    # Run checks
    ipc_running = check_ipc_server()
    print()

    pystray_available = check_pystray()
    print()

    process_running = check_process()
    print()

    # View log
    view_log()

    # Summary
    print()
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print()

    if ipc_running and pystray_available:
        print("✓ Device Sync is RUNNING")
        print()
        print("Tray icon should be visible in:")
        print("  Windows: System tray (bottom-right, click ^ icon)")
        print()
        print("If you don't see the icon:")
        print("  1. Click the ^ arrow in system tray")
        print("  2. Look for 'Device Sync' icon")
        print("  3. Right-click icon to open menu")
        print()

    elif ipc_running and not pystray_available:
        print("⚠ Device Sync is running WITHOUT tray icon")
        print()
        print("To enable tray icon, install pystray:")
        print("  pip install pystray pillow")
        print()

    else:
        print("✗ Device Sync is NOT running")
        print()
        print("To start Device Sync:")
        print()
        print("  Method 1 - Debug mode (see all output):")
        print("    cd D:\\programing\\core_node\\pycore\\pyutils\\launcher\\device_sync")
        print("    start_debug.bat")
        print()
        print("  Method 2 - Background mode:")
        print("    python -m pycore.pyutils.launcher.launcher")
        print("    Select option [2] - Launch Device Sync Only")
        print()
        print("  Method 3 - Direct launch:")
        print("    python -m pycore.pyutils.launcher.device_sync")
        print()

    print("=" * 60)
    print()


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
