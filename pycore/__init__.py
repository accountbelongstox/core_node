# -*- coding: utf-8 -*-
# Documentation: ../py_auto/DEVELOPMENT_GUIDE.md
from pycore.pyutils import FMP4EncoderComplete, H264Frame
from pycore.pyutils import WebSocketManager
"""
Main package file for pytools.
"""

from pycore.pyfoundations.pybasecommon.encyclopedia import ENCYCLOPEDIA


# Convenience function to get GPU info from cache
def get_gpu_info():
    """
    Get cached GPU information

    Returns:
        dict: GPU information or None if not available
    """
    return ENCYCLOPEDIA.get("pycore_gpu_info")


# ============================================================================
# Convenient Top-Level Exports
# ============================================================================

# Foundation components
from pycore.pyfoundations import (
    ColorPrint,
    ENCYCLOPEDIA,
    EventBus,
    EventTypes,
    Event,
    UserDataStore,
    get_user_data_store,
)

# Global variable manager (now in pygvar)
from pycore.pygvar import GlobalVarManager

# Thread communication bus
from pycore.pyfoundations.thread_bus import THREAD_BUS

# Device structures and ADB utilities (unified in pyutils.device)
from pycore.pyutils.device import (
    AndroidDevice,
    ScrcpyDevice,
    DeviceInfo,
    ServerParams,
    VideoCodec,
    ADBManager,
    ADBDevice,
)

# Utility components
from pycore.pyutils import (
    DeviceManager,
    DeviceState,
    TouchEvent,
    KeyEvent,
    MessageBuilder,
    GroupController,
    AllSyncStrategy,
    TouchOnlySyncStrategy,
    H264Decoder,
    FMP4Encoder,
    VideoFrame,
    VideoFormat,
    VideoStreamHandler,
    H264Config,
)

# Optional imports
try:
except ImportError:
    pass

try:
except ImportError:
    pass

__version__ = '1.0.0'

__all__ = [
    # Dependency management
    'get_gpu_info',

    # Foundation
    'ColorPrint',
    'ENCYCLOPEDIA',
    'EventBus',
    'EventTypes',
    'Event',
    'UserDataStore',
    'get_user_data_store',
    'GlobalVarManager',
    'THREAD_BUS',

    # Device structures
    'AndroidDevice',
    'ScrcpyDevice',
    'DeviceInfo',
    'ServerParams',
    'VideoCodec',

    # Device management
    'DeviceManager',
    'DeviceState',

    # ADB
    'ADBManager',
    'ADBDevice',

    # Control
    'TouchEvent',
    'KeyEvent',
    'MessageBuilder',

    # Group control
    'GroupController',
    'AllSyncStrategy',
    'TouchOnlySyncStrategy',

    # Streaming
    'H264Decoder',
    'FMP4Encoder',
    'VideoFrame',
    'VideoFormat',
    'VideoStreamHandler',
    'H264Config',
]
