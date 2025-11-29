# -*- coding: utf-8 -*-
"""
Device Sync - Diagnostic Tool

Checks Device Sync status and displays log file.
"""

import sys
import os
import socket
import subprocess
from pathlib import Path
import tempfile


def print_header(text):
    """Print formatted header."""
    print()
    print("=" * 60)
    print(text)
    print("=" * 60)
    print()


def check_ipc_server():
    """Check if IPC server is running."""
    print("[1] Checking IPC Server (Port 45678)...")

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        result = sock.connect_ex(('127.0.0.1', 45678))
        sock.close()

        if result == 0:
            print("    ✓ IPC server is RUNNING")
            print("    → Device Sync is active")
            return True
        else:
            print("    ✗ IPC server NOT responding")
            print("    → Device Sync is NOT running")
            return False
    except Exception as e:
        print(f"    ✗ Error: {e}")
        return False


def check_pystray():
    """Check if pystray is installed."""
    print("[2] Checking pystray library...")

    try:
        import pystray
        print("    ✓ pystray is installed")
        return True
    except ImportError:
        print("    ✗ pystray NOT installed")
        print("    → Install with: pip install pystray pillow")
        return False


def check_process():
    """Check if Device Sync process is running."""
    print("[3] Checking for pythonw.exe process...")

    try:
        result = subprocess.run(
            ['tasklist', '/FI', 'IMAGENAME eq pythonw.exe', '/FO', 'CSV'],
            capture_output=True,
            text=True,
            encoding='utf-8'
        )

        if 'pythonw.exe' in result.stdout:
            # Count processes
            count = result.stdout.count('pythonw.exe')
            print(f"    ✓ Found {count} pythonw.exe process(es)")
            return True
        else:
            print("    ✗ No pythonw.exe process found")
            return False
    except Exception as e:
        print(f"    ✗ Error: {e}")
        return False


def view_log():
    """Display log file contents."""
    print("[4] Checking log files...")

    log_dir = Path(tempfile.gettempdir()) / 'device_sync'
    launcher_log = log_dir / 'device_sync_launcher.log'
    main_log = log_dir / 'device_sync.log'

    found_any = False

    # Check launcher log
    if launcher_log.exists():
        print(f"    ✓ Launcher log found: {launcher_log}")
        found_any = True

        print()
        print_header("LAUNCHER LOG (from launcher.py startup)")

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
        print_header("DEVICE SYNC MAIN LOG (from background process)")

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


def main():
    """Run diagnostics."""
    print_header("Device Sync - Diagnostic Tool")

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
    print_header("SUMMARY")

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


if __name__ == '__main__':
    main()
    input("Press Enter to exit...")
