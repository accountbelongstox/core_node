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
    from pycore.pyutils import MediaCompressor, get_media_compressor, CompressionStats
    from pycore.pyutils import NativeUIFramework, UIConfig, SignalType, create_ui_framework
"""

# Device Manager (centralized singleton)
from pycore.pyutils.device_manager import DeviceManager, DeviceState

# ADB utilities
from pycore.pyutils.adb import ADBManager, ADBDevice

# Control utilities
from pycore.pyutils.control import TouchEvent, KeyEvent, MessageBuilder

# Group control
from pycore.pyutils.group import (
    GroupController,
    SyncStrategy,
    AllSyncStrategy,
    TouchOnlySyncStrategy,
    SyncEvent
)

# Stream utilities
from pycore.pyutils.stream import (
    VideoDecoder,
    H264Decoder,
    FMP4Encoder,
    VideoFrame,
    VideoFormat,
    VideoStreamHandler,
    H264Config,
)

# Media compression utilities
from pycore.pyutils.media_compressor import (
    MediaCompressor,
    get_media_compressor,
    CompressionStats,
    CompressionTask,
    QueueStats,
)

# Import complete FMP4 encoder - import directly, let error propagate if unavailable
from pycore.pyutils.stream import FMP4EncoderComplete, H264Frame

# API utilities
from pycore.pyutils.api import WebSocketManager

# Native UI Framework
from pycore.pyutils.native_ui import (
    NativeUIFramework,
    UIConfig,
    SignalType,
    Signal,
    WindowState,
    SignalManager,
    CustomTitleBar,
    create_ui_framework,
    TaskTimer,
    TimerTask,
    MainThreadExecutor
)

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

    # Media Compression
    'MediaCompressor',
    'get_media_compressor',
    'CompressionStats',
    'CompressionTask',
    'QueueStats',

    # WebSocket
    'WebSocketManager',

    # Native UI
    'NativeUIFramework',
    'UIConfig',
    'SignalType',
    'Signal',
    'WindowState',
    'SignalManager',
    'CustomTitleBar',
    'create_ui_framework',
    'TaskTimer',
    'TimerTask',
    'MainThreadExecutor'
]

__version__ = '1.0.0'
