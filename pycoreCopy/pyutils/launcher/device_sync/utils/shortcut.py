# -*- coding: utf-8 -*-
"""
Create Desktop Shortcut for Device Sync

This creates a desktop shortcut that launches Device Sync in background mode.
"""

import sys
import os
from pathlib import Path


def create_desktop_shortcut():
    """Create desktop shortcut for Device Sync."""
    try:
        import win32com.client
    except ImportError:
        print("Error: pywin32 not installed")
        print("Install with: pip install pywin32")
        return False

    # Get desktop path
    desktop = Path.home() / 'Desktop'

    # Shortcut path
    shortcut_path = desktop / 'Device Sync.lnk'

    # Get Python directory
    python_dir = Path(sys.executable).parent
    pythonw_exe = python_dir / 'pythonw.exe'

    # Fallback to python.exe if pythonw not found
    if not pythonw_exe.exists():
        pythonw_exe = Path(sys.executable)
        print(f"Warning: pythonw.exe not found, using {pythonw_exe.name}")

    # Arguments
    arguments = '-m pycore.pyutils.launcher.device_sync'

    # Working directory
    working_dir = str(python_dir)

    # Icon path (use Python icon or custom)
    device_sync_dir = Path(__file__).parent
    icon_path = device_sync_dir / 'icon.ico'
    if not icon_path.exists():
        icon_path = pythonw_exe  # Use Python icon

    # Create shortcut
    shell = win32com.client.Dispatch("WScript.Shell")
    shortcut = shell.CreateShortCut(str(shortcut_path))
    shortcut.TargetPath = str(pythonw_exe)
    shortcut.Arguments = arguments
    shortcut.WorkingDirectory = working_dir
    shortcut.IconLocation = str(icon_path)
    shortcut.Description = "Device Sync - File Synchronization Tool"
    shortcut.save()

    print(f"Shortcut created: {shortcut_path}")
    print(f"Target: {pythonw_exe}")
    print(f"Arguments: {arguments}")
    print("\nDouble-click to start Device Sync in background")

    return True


if __name__ == '__main__':
    print("Creating Device Sync Desktop Shortcut...")
    print("=" * 60)

    if create_desktop_shortcut():
        print("\nSuccess! Shortcut created on desktop")
        print("Double-click 'Device Sync' to start")
    else:
        print("\nFailed to create shortcut")
        print("You can still run manually with:")
        print("  python -m pycore.pyutils.launcher.device_sync")

    input("\nPress Enter to exit...")
