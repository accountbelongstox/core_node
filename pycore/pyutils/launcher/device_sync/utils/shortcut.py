# -*- coding: utf-8 -*-
"""
Create Desktop Shortcut for Device Sync

This creates a desktop shortcut that launches Device Sync in background mode.
"""

import sys
import os
from pathlib import Path
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


def create_desktop_shortcut():
    """Create desktop shortcut for Device Sync."""
    try:
        pass
    except ImportError:
        ColorPrint.plain("Error: pywin32 not installed")
        ColorPrint.plain("Install with: pip install pywin32")
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
        ColorPrint.plain(f"Warning: pythonw.exe not found, using {pythonw_exe.name}")

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

    ColorPrint.plain(f"Shortcut created: {shortcut_path}")
    ColorPrint.plain(f"Target: {pythonw_exe}")
    ColorPrint.plain(f"Arguments: {arguments}")
    ColorPrint.plain("\nDouble-click to start Device Sync in background")

    return True


if __name__ == '__main__':
    ColorPrint.plain("Creating Device Sync Desktop Shortcut...")
    ColorPrint.plain("=" * 60)

    if create_desktop_shortcut():
        ColorPrint.plain("\nSuccess! Shortcut created on desktop")
        ColorPrint.plain("Double-click 'Device Sync' to start")
    else:
        ColorPrint.plain("\nFailed to create shortcut")
        ColorPrint.plain("You can still run manually with:")
        ColorPrint.plain("  python -m pycore.pyutils.launcher.device_sync")

    input("\nPress Enter to exit...")
