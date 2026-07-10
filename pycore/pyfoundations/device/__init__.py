"""
pyfoundations.device - thin re-export of the canonical pyutils.device package.

The canonical device implementation lives in pycore.pyutils.device. This shim
preserves backward-compatible imports (DeviceInfo, Resolution, ServerParams,
VideoCodec, AndroidDevice, ScrcpyDevice) per the pkg-dedup-canonical rule.

Note: this package previously tried to import from local .device_info /
.server_params / .android_device / .scrcpy_device modules that do not exist
here, so it was unimportable. Re-exporting from pyutils.device fixes that.

Dependencies:
- pycore.pyutils.device (canonical device/ADB implementation)

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

from pycore.pyutils.device import (
    DeviceInfo,
    Resolution,
    ServerParams,
    VideoCodec,
    AndroidDevice,
    ScrcpyDevice,
)

__all__ = [
    'DeviceInfo',
    'Resolution',
    'ServerParams',
    'VideoCodec',
    'AndroidDevice',
    'ScrcpyDevice'
]

__version__ = '1.0.0'
