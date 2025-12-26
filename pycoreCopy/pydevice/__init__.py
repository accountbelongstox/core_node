"""
pycore.pydevice - Android Device Abstraction Module

Provides high-level abstractions for Android devices and scrcpy server management.

Key Features:
- AndroidDevice class for device lifecycle management
- ServerParams for scrcpy server configuration
- ConnectionManager for intelligent connection handling
- DeviceInfo for comprehensive device metadata

Usage:
    from pycore.pydevice import AndroidDevice, ServerParams, ConnectionManager

    params = ServerParams(max_size=720, bit_rate=8000000)
    manager = ConnectionManager()
    device = await manager.connect_usb("ABC123", params)
"""

from .device_info import DeviceInfo, Resolution, VideoCodec
from .server_params import ServerParams
from .android_device import AndroidDevice
from .connection_manager import ConnectionManager, ConnectionType, ConnectionState

__all__ = [
    'DeviceInfo',
    'Resolution',
    'VideoCodec',
    'ServerParams',
    'AndroidDevice',
    'ConnectionManager',
    'ConnectionType',
    'ConnectionState',
]

__version__ = '1.0.0'
