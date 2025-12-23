"""
Device Management and ADB Utilities (Unified)

Unified device management module providing:
- Android device abstractions (DeviceInfo, ServerParams, AndroidDevice, ScrcpyDevice)
- ADB communication (ADBManager, ADBDevice)
- Tunnel modes (ReverseTunnelMode, ForwardTunnelMode)
- Complete device lifecycle management

This module consolidates device and ADB functionality.

Usage:
    from pycore.pyutils.device import (
        # Device abstractions
        DeviceInfo, Resolution, ServerParams, VideoCodec,
        AndroidDevice, ScrcpyDevice,
        # ADB utilities
        ADBManager, ADBDevice,
        # Tunnel modes
        TunnelMode, ReverseTunnelMode, ForwardTunnelMode, TunnelModeFactory,
        # Exceptions
        ADBException, DeviceNotFoundException
    )

    # ADB operations
    devices = ADBManager.list_devices()

    # Device management
    device = ScrcpyDevice(serial, params, adb_path)
    device.start_server()

    # Tunnel mode selection
    modes = TunnelModeFactory.get_all_modes_by_priority()  # [REVERSE, FORWARD]
"""

# Device abstractions
from .device_info import DeviceInfo, Resolution
from .server_params import ServerParams, VideoCodec
from .android_device import AndroidDevice
from .scrcpy_device import ScrcpyDevice

# Tunnel modes
from .tunnel_mode import (
    TunnelMode,
    ReverseTunnelMode,
    ForwardTunnelMode,
    TunnelModeFactory,
    TunnelConfig,
    REVERSE_MODE,
    FORWARD_MODE,
    ALL_MODES
)

# ADB utilities
from .adb_manager import ADBManager
from .adb_device import ADBDevice
from .adb_exceptions import (
    ADBException,
    DeviceNotFoundException,
    ADBCommandFailedException
)

# Optional: Enhanced ADB types
try:
    from .adb_types import (
        ADBDeviceState,
        ADBConnectionType,
        ADBDeviceBasic,
        ADBExecuteResult,
        ADBDeviceProperties,
        ADBDeviceBattery,
        ADBForwardSpec
    )
    _HAS_ENHANCED_TYPES = True
except ImportError:
    _HAS_ENHANCED_TYPES = False

# Optional: ADB commands
try:
    from .adb_commands import ADBCommands
    _HAS_ADB_COMMANDS = True
except ImportError:
    _HAS_ADB_COMMANDS = False

__all__ = [
    # Device abstractions
    'DeviceInfo',
    'Resolution',
    'VideoCodec',
    'ServerParams',
    'AndroidDevice',
    'ScrcpyDevice',
    # Tunnel modes
    'TunnelMode',
    'ReverseTunnelMode',
    'ForwardTunnelMode',
    'TunnelModeFactory',
    'TunnelConfig',
    'REVERSE_MODE',
    'FORWARD_MODE',
    'ALL_MODES',
    # ADB utilities
    'ADBManager',
    'ADBDevice',
    'ADBException',
    'DeviceNotFoundException',
    'ADBCommandFailedException',
]

# Add enhanced exports if available
if _HAS_ENHANCED_TYPES:
    __all__.extend([
        'ADBDeviceState',
        'ADBConnectionType',
        'ADBDeviceBasic',
        'ADBExecuteResult',
        'ADBDeviceProperties',
        'ADBDeviceBattery',
        'ADBForwardSpec',
    ])

if _HAS_ADB_COMMANDS:
    __all__.append('ADBCommands')

__version__ = '2.0.0'
