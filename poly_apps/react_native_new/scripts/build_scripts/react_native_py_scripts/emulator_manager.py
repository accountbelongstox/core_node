"""
Android Emulator Manager
Scans for Android emulator path only - NO command execution
Shell will execute emulator commands
"""

import os
import platform
from pathlib import Path
from typing import Optional


def get_emulator_path() -> Optional[Path]:
    """
    Scan for Android emulator executable path only

    Returns:
        Path to emulator executable, or None if not found
    """
    system = platform.system()

    if system == 'Windows':
        # Windows paths
        possible_paths = [
            Path(os.environ.get('LOCALAPPDATA', '')) / 'Android' / 'Sdk' / 'emulator' / 'emulator.exe',
            Path(os.environ.get('ANDROID_HOME', '')) / 'emulator' / 'emulator.exe',
            Path(os.environ.get('ANDROID_SDK_ROOT', '')) / 'emulator' / 'emulator.exe',
        ]
    else:
        # Linux/Mac paths
        possible_paths = [
            Path.home() / 'Android' / 'Sdk' / 'emulator' / 'emulator',
            Path(os.environ.get('ANDROID_HOME', '')) / 'emulator' / 'emulator',
            Path(os.environ.get('ANDROID_SDK_ROOT', '')) / 'emulator' / 'emulator',
            Path('/usr/local/android-sdk/emulator/emulator'),
        ]

    for path in possible_paths:
        if path.exists():
            return path

    return None


def store_emulator_info():
    """
    Find emulator path and store in file variable system
    Shell will execute 'emulator -list-avds' command
    """
    from global_var_manager import GlobalVarManager

    print("[Emulator] Scanning for Android emulator...")

    # Find emulator executable path
    emulator_path = get_emulator_path()

    gvm = GlobalVarManager(namespace=None)

    if emulator_path:
        print(f"[Emulator] Found: {emulator_path}")
        gvm.set("EMULATOR_PATH", str(emulator_path))
        # Shell will execute: emulator -list-avds
        gvm.set("EMULATOR_SCAN_REQUIRED", "true")
    else:
        print("[Emulator] Not found in common locations")
        gvm.set("EMULATOR_SCAN_REQUIRED", "false")


if __name__ == '__main__':
    # Test
    store_emulator_info()
