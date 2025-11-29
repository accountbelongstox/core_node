# -*- coding: utf-8 -*-
"""
Device Sync - Status Checker

Check if Device Sync is running and diagnose issues.
"""

import sys
import socket
import subprocess

def check_ipc_server():
    """Check if IPC server is running."""
    print("[Check] Testing IPC server connection...")

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        result = sock.connect_ex(('127.0.0.1', 45678))
        sock.close()

        if result == 0:
            print("[Check] ✓ IPC server is running (Device Sync is active)")
            return True
        else:
            print("[Check] ✗ IPC server not responding (Device Sync not running)")
            return False
    except Exception as e:
        print(f"[Check] ✗ Failed to check IPC: {e}")
        return False

def check_pystray():
    """Check if pystray is installed."""
    print("[Check] Testing pystray availability...")

    try:
        import pystray
        print("[Check] ✓ pystray is installed")
        return True
    except ImportError:
        print("[Check] ✗ pystray not installed")
        print("[Check]   Install with: pip install pystray pillow")
        return False

def check_process():
    """Check if Device Sync process is running."""
    print("[Check] Checking for Device Sync process...")

    try:
        if sys.platform == 'win32':
            # Windows
            result = subprocess.run(
                ['tasklist', '/FI', 'IMAGENAME eq pythonw.exe'],
                capture_output=True,
                text=True
            )

            if 'pythonw.exe' in result.stdout:
                print("[Check] ✓ Background Python process found (pythonw.exe)")
                return True
            else:
                print("[Check] ✗ No pythonw.exe process found")
                return False
        else:
            # Linux
            result = subprocess.run(
                ['pgrep', '-f', 'device_sync'],
                capture_output=True,
                text=True
            )

            if result.returncode == 0:
                print("[Check] ✓ Device Sync process found")
                return True
            else:
                print("[Check] ✗ No device_sync process found")
                return False
    except Exception as e:
        print(f"[Check] ✗ Failed to check process: {e}")
        return False

def main():
    """Run all checks."""
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

if __name__ == '__main__':
    main()
