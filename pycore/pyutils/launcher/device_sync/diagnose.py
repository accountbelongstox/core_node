# -*- coding: utf-8 -*-
"""
Device Sync - Diagnostic Tool

Checks Device Sync status and displays log file.
"""

import sys
import os
import socket
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.commander import exec_silent, exec_realtime
from pycore.pyfoundations.pygvar import TMP_DIR
from pathlib import Path

from pycore.pyfoundations.third_party.api import get_third_package_pystray



def print_header(text):
    """Print formatted header."""
    ColorPrint.plain()
    ColorPrint.plain("=" * 60)
    ColorPrint.plain(text)
    ColorPrint.plain("=" * 60)
    ColorPrint.plain()


def check_ipc_server():
    """Check if IPC server is running."""
    ColorPrint.plain("[1] Checking IPC Server (Port 45678)...")

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        result = sock.connect_ex(('127.0.0.1', 45678))
        sock.close()

        if result == 0:
            ColorPrint.plain("    ✓ IPC server is RUNNING")
            ColorPrint.plain("    → Device Sync is active")
            return True
        else:
            ColorPrint.plain("    ✗ IPC server NOT responding")
            ColorPrint.plain("    → Device Sync is NOT running")
            return False
    except Exception as e:
        ColorPrint.plain(f"    ✗ Error: {e}")
        return False


def check_pystray():
    """Check if pystray is installed."""
    ColorPrint.plain("[2] Checking pystray library...")

    try:
        pystray = get_third_package_pystray()
        ColorPrint.plain("    ✓ pystray is installed")
        return True
    except ImportError:
        ColorPrint.plain("    ✗ pystray NOT installed")
        ColorPrint.plain("    → Install with: pip install pystray pillow")
        return False


def check_process():
    """Check if Device Sync process is running."""
    ColorPrint.plain("[3] Checking for pythonw.exe process...")

    try:
        result = exec_silent(
            ['tasklist', '/FI', 'IMAGENAME eq pythonw.exe', '/FO', 'CSV'],
            capture_output=True,
            text=True,
            encoding='utf-8'
        )

        if 'pythonw.exe' in result.stdout:
            # Count processes
            count = result.stdout.count('pythonw.exe')
            ColorPrint.plain(f"    ✓ Found {count} pythonw.exe process(es)")
            return True
        else:
            ColorPrint.plain("    ✗ No pythonw.exe process found")
            return False
    except Exception as e:
        ColorPrint.plain(f"    ✗ Error: {e}")
        return False


def view_log():
    """Display log file contents."""
    ColorPrint.plain("[4] Checking log files...")

    log_dir = TMP_DIR / 'device_sync'
    launcher_log = log_dir / 'device_sync_launcher.log'
    main_log = log_dir / 'device_sync.log'

    found_any = False

    # Check launcher log
    if launcher_log.exists():
        ColorPrint.plain(f"    ✓ Launcher log found: {launcher_log}")
        found_any = True

        ColorPrint.plain()
        print_header("LAUNCHER LOG (from launcher.py startup)")

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
        print_header("DEVICE SYNC MAIN LOG (from background process)")

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


def main():
    """Run diagnostics."""
    print_header("Device Sync - Diagnostic Tool")

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
    print_header("SUMMARY")

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


if __name__ == '__main__':
    main()
    input("Press Enter to exit...")
