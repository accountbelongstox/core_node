"""
pyfoundations.device - Device abstraction module

Features:
- Android device information encapsulation
- scrcpy-server parameter management
- Device lifecycle management

Dependencies:
- pycore.pyutils.adb (for ADB operations)

Example:
    from pycore.pyfoundations.device import DeviceInfo, ServerParams, Resolution

    # Create server parameters
    params = ServerParams(
        max_size=720,
        bit_rate=8000000,
        max_fps=60
    )

    # Device info
    resolution = Resolution(width=1440, height=3120)
    info = DeviceInfo(
        serial="ABC123",
        model="Pixel 6",
        resolution=resolution,
        dpi=560,
        android_version="13",
        sdk_version=33
    )
"""

from pycore.pyfoundations.device.device_info import DeviceInfo, Resolution
from pycore.pyfoundations.device.server_params import ServerParams, VideoCodec
from pycore.pyfoundations.device.android_device import AndroidDevice
from pycore.pyfoundations.device.scrcpy_device import ScrcpyDevice

__all__ = [
    'DeviceInfo',
    'Resolution',
    'ServerParams',
    'VideoCodec',
    'AndroidDevice',
    'ScrcpyDevice'
]

__version__ = '1.0.0'
