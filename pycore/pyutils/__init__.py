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

# ADB utilities (now unified in device module)
from pycore.pyutils.device import ADBManager, ADBDevice

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

# Video Stream utilities
from pycore.pyutils.video_stream import (
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
from pycore.pyutils.video_stream import FMP4EncoderComplete, H264Frame

# API utilities
from pycore.pyutils.api import WebSocketManager

# Native UI Framework - Base Components
from pycore.pyutils.native_ui import (
    UIConfig,
    SignalType,
    Signal,
    WindowState,
    SignalManager,
    TaskTimer,
    TimerTask,
    MainThreadExecutor,
    # Startup window (tkinter, no dependencies)
    StartupWindow,
    ColorPrintCapture,
    launch_app_with_startup,
)

# PySide6 Framework (recommended for main applications)
# Import conditionally to avoid dependency errors if PySide6 not installed
_PYSIDE6_AVAILABLE = False
try:
    from pycore.pyutils.native_ui.pyside6 import (
        PySide6Framework,
        PySide6UIConfig,
        PySide6MainWindow,
        PySide6TitleBar,
        PySide6SystemTray,
        PySide6WebView,
        create_framework as create_pyside6_framework
    )
    _PYSIDE6_AVAILABLE = True
except ImportError:
    pass

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
