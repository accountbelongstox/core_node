"""
pycore.pyadb - ADB Communication Module

Centralized ADB command wrapper and device management.
All ADB operations should go through this module for consistency.

Key Features:
- Zero configuration (adb_path parameter-based)
- Stateless operations (pure functions)
- Full USB and WiFi support
- Comprehensive error handling
- Type-safe interfaces

Usage:
    from pycore.pyadb import ADBManager, ADBDevice

    devices = ADBManager.list_devices()
    ADBManager.execute_shell("ABC123", "input tap 500 1000")
"""

from .adb_manager import ADBManager
from .adb_device import ADBDevice
from .adb_types import ADBDeviceState, ADBConnectionType
from .adb_commands import ADBCommands

__all__ = [
    'ADBManager',
    'ADBDevice',
    'ADBDeviceState',
    'ADBConnectionType',
    'ADBCommands',
]

__version__ = '1.0.0'
