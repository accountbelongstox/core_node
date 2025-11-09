"""
pyutils.adb - ADB Communication Module

Features:
- ADB device management
- File push/pull
- Shell command execution
- Port forwarding

Dependencies:
- Standard library: subprocess, pathlib, typing
- External tool: adb (must be in PATH or specify path)

Example:
    from pycore.pyutils.adb import ADBManager, ADBDevice

    # List devices
    devices = ADBManager.list_devices()
    for device in devices:
        print(device.serial, device.state)

    # Push file
    from pathlib import Path
    ADBManager.push_file(
        "ABC123",
        Path("scrcpy-server.jar"),
        "/data/local/tmp/scrcpy-server.jar"
    )

    # Port forwarding
    ADBManager.forward_port("ABC123", 27183, 27183)
"""

from pycore.pyutils.adb.adb_manager import ADBManager
from pycore.pyutils.adb.adb_device import ADBDevice, DeviceState
from pycore.pyutils.adb.adb_exceptions import (
    ADBException,
    DeviceNotFoundException,
    ADBCommandFailedException
)

__all__ = [
    'ADBManager',
    'ADBDevice',
    'DeviceState',
    'ADBException',
    'DeviceNotFoundException',
    'ADBCommandFailedException'
]

__version__ = '1.0.0'
