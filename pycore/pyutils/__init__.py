"""
pyutils - Utility modules for device management, streaming, control, etc.

This module provides the core utilities used by all applications.

Quick Imports:
    from pycore.pyutils import DeviceManager, DeviceState
    from pycore.pyutils import H264Decoder, FMP4EncoderComplete
    from pycore.pyutils import ADBManager, ADBDevice
    from pycore.pyutils import TouchEvent, KeyEvent
    from pycore.pyutils import GroupController, AllSyncStrategy
    from pycore.pyutils import WebSocketManager
"""

# Device Manager (centralized singleton)
from .device_manager import DeviceManager, DeviceState

# ADB utilities
from .adb import ADBManager, ADBDevice

# Control utilities
from .control import TouchEvent, KeyEvent, MessageBuilder

# Group control
from .group import (
    GroupController,
    SyncStrategy,
    AllSyncStrategy,
    TouchOnlySyncStrategy,
    SyncEvent
)

# Stream utilities
from .stream import (
    VideoDecoder,
    H264Decoder,
    FMP4Encoder,
    VideoFrame,
    VideoFormat,
    VideoStreamHandler,
    H264Config,
)

# Import complete FMP4 encoder if available
try:
    from .stream import FMP4EncoderComplete, H264Frame
    __all__ = [
        # Device Management
        'DeviceManager',
        'DeviceState',

        # ADB
        'ADBManager',
        'ADBDevice',

        # Control
        'TouchEvent',
        'KeyEvent',
        'MessageBuilder',

        # Group
        'GroupController',
        'SyncStrategy',
        'AllSyncStrategy',
        'TouchOnlySyncStrategy',
        'SyncEvent',

        # Stream
        'VideoDecoder',
        'H264Decoder',
        'FMP4Encoder',
        'FMP4EncoderComplete',
        'H264Frame',
        'VideoFrame',
        'VideoFormat',
        'VideoStreamHandler',
        'H264Config',
    ]
except ImportError:
    __all__ = [
        # Device Management
        'DeviceManager',
        'DeviceState',

        # ADB
        'ADBManager',
        'ADBDevice',

        # Control
        'TouchEvent',
        'KeyEvent',
        'MessageBuilder',

        # Group
        'GroupController',
        'SyncStrategy',
        'AllSyncStrategy',
        'TouchOnlySyncStrategy',
        'SyncEvent',

        # Stream
        'VideoDecoder',
        'H264Decoder',
        'FMP4Encoder',
        'VideoFrame',
        'VideoFormat',
        'VideoStreamHandler',
        'H264Config',
    ]

# API utilities (optional, may not be needed by all apps)
try:
    from .api import WebSocketManager
    __all__.append('WebSocketManager')
except ImportError:
    pass

__version__ = '1.0.0'
