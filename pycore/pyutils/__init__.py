"""
pyutils - Utility modules for device management, streaming, control, etc.

This module provides comprehensive utilities for callmodule and all applications.
All utilities are safely imported with availability flags for graceful degradation.

Quick Imports:
    from pycore.pyutils import ocr_manager, OCR_AVAILABLE
    from pycore.pyutils import edge_tts_manager, EDGE_TTS_AVAILABLE
    from pycore.pyutils import ADBManager, DEVICE_CONTROL_AVAILABLE
    from pycore.pyutils import get_available_utilities
"""

# ============================================================================
# OCR Utilities
# ============================================================================
try:
    from pycore.pyutils.ocr.ocr_manager import ocr_manager
    OCR_AVAILABLE = True
except Exception as e:
    ocr_manager = None
    OCR_AVAILABLE = False

# ============================================================================
# Device Manager (Legacy compatibility)
# ============================================================================
try:
    from pycore.pyutils.device_manager import DeviceManager, DeviceState
    DEVICE_MANAGER_AVAILABLE = True
except Exception:
    DeviceManager = None
    DeviceState = None
    DEVICE_MANAGER_AVAILABLE = False

# ============================================================================
# TTS Utilities
# ============================================================================
try:
    from pycore.pyutils.edge_tts import edge_tts_manager
    EDGE_TTS_AVAILABLE = True
except Exception:
    edge_tts_manager = None
    EDGE_TTS_AVAILABLE = False

try:
    from pycore.pyutils.azure_speech import azure_speech_manager
    AZURE_SPEECH_AVAILABLE = True
except Exception:
    azure_speech_manager = None
    AZURE_SPEECH_AVAILABLE = False

# ============================================================================
# Device Control Utilities
# ============================================================================
try:
    from pycore.pyutils.device import ADBManager, ADBDevice
    from pycore.pyutils.control import TouchEvent, KeyEvent, MessageBuilder
    DEVICE_CONTROL_AVAILABLE = True
except Exception:
    ADBManager = None
    ADBDevice = None
    TouchEvent = None
    KeyEvent = None
    MessageBuilder = None
    DEVICE_CONTROL_AVAILABLE = False

# ============================================================================
# Group Control
# ============================================================================
try:
    from pycore.pyutils.group import (
        GroupController,
        SyncStrategy,
        AllSyncStrategy,
        TouchOnlySyncStrategy,
        SyncEvent
    )
    GROUP_CONTROL_AVAILABLE = True
except Exception:
    GroupController = None
    SyncStrategy = None
    AllSyncStrategy = None
    TouchOnlySyncStrategy = None
    SyncEvent = None
    GROUP_CONTROL_AVAILABLE = False

# ============================================================================
# Video Stream Utilities
# ============================================================================
try:
    from pycore.pyutils.video_stream import (
        VideoDecoder,
        H264Decoder,
        FMP4Encoder,
        VideoFrame,
        VideoFormat,
        VideoStreamHandler,
        H264Config,
        FMP4EncoderComplete,
        H264Frame
    )
    VIDEO_STREAM_AVAILABLE = True
except Exception:
    VideoDecoder = None
    H264Decoder = None
    FMP4Encoder = None
    VideoFrame = None
    VideoFormat = None
    VideoStreamHandler = None
    H264Config = None
    FMP4EncoderComplete = None
    H264Frame = None
    VIDEO_STREAM_AVAILABLE = False

# ============================================================================
# Media Compression Utilities
# ============================================================================
try:
    from pycore.pyutils.media_compressor import (
        MediaCompressor,
        get_media_compressor,
        CompressionStats,
        CompressionTask,
        QueueStats,
    )
    MEDIA_COMPRESSOR_AVAILABLE = True
except Exception:
    MediaCompressor = None
    get_media_compressor = None
    CompressionStats = None
    CompressionTask = None
    QueueStats = None
    MEDIA_COMPRESSOR_AVAILABLE = False

# ============================================================================
# Device Sync Utilities
# ============================================================================
try:
    from pycore.pyutils.launcher.device_sync import (
        SimplePrimaryServer,
        SimpleClient,
        SimpleDeviceScanner,
        get_global_config as get_device_sync_config
    )
    DEVICE_SYNC_AVAILABLE = True
except Exception:
    SimplePrimaryServer = None
    SimpleClient = None
    SimpleDeviceScanner = None
    get_device_sync_config = None
    DEVICE_SYNC_AVAILABLE = False

# ============================================================================
# Browser Utilities
# ============================================================================
try:
    from pycore.pyutils.pybrowser import browser_manager
    BROWSER_AVAILABLE = True
except Exception:
    browser_manager = None
    BROWSER_AVAILABLE = False

# ============================================================================
# Web Server Utilities
# ============================================================================
try:
    from pycore.pyutils.web import web_server_manager
    WEB_SERVER_AVAILABLE = True
except Exception:
    web_server_manager = None
    WEB_SERVER_AVAILABLE = False

# ============================================================================
# YOLO (Ultralytics) Utilities
# ============================================================================
try:
    from pycore.pyutils.ultralytics import yolo_manager
    YOLO_AVAILABLE = True
except Exception:
    yolo_manager = None
    YOLO_AVAILABLE = False

# ============================================================================
# MCP (Model Context Protocol) Utilities
# ============================================================================
try:
    from pycore.pyutils.mcp import mcp_server_manager
    MCP_AVAILABLE = True
except Exception:
    mcp_server_manager = None
    MCP_AVAILABLE = False

# ============================================================================
# RPC Utilities
# ============================================================================
try:
    from pycore.pyutils.rpc import rpc_manager
    RPC_AVAILABLE = True
except Exception:
    rpc_manager = None
    RPC_AVAILABLE = False

try:
    from pycore.pyutils.wsrpc import wsrpc_manager
    WSRPC_AVAILABLE = True
except Exception:
    wsrpc_manager = None
    WSRPC_AVAILABLE = False

# ============================================================================
# Native UI Framework (Conditional - avoid loading GUI dependencies by default)
# ============================================================================
NATIVE_UI_AVAILABLE = False
try:
    # Only import if explicitly requested via environment variable
    import os
    if os.getenv('PYUTILS_LOAD_GUI', '0') == '1':
        from pycore.pyutils.native_ui import (
            UIConfig,
            SignalType,
            Signal,
            WindowState,
            SignalManager,
            TaskTimer,
            TimerTask,
            MainThreadExecutor,
            StartupWindow,
            ColorPrintCapture,
            launch_app_with_startup,
        )
        NATIVE_UI_AVAILABLE = True
    else:
        # Stub out GUI components
        UIConfig = None
        SignalType = None
        Signal = None
        WindowState = None
        SignalManager = None
        TaskTimer = None
        TimerTask = None
        MainThreadExecutor = None
        StartupWindow = None
        ColorPrintCapture = None
        launch_app_with_startup = None
except Exception:
    UIConfig = None
    SignalType = None
    Signal = None
    WindowState = None
    SignalManager = None
    TaskTimer = None
    TimerTask = None
    MainThreadExecutor = None
    StartupWindow = None
    ColorPrintCapture = None
    launch_app_with_startup = None
    NATIVE_UI_AVAILABLE = False

# ============================================================================
# Utility Functions
# ============================================================================

def get_available_utilities():
    """
    Get a dictionary of all available utilities and their status.
    
    Returns:
        dict: Utility names mapped to availability status (True/False)
    
    Example:
        >>> from pycore.pyutils import get_available_utilities
        >>> utils = get_available_utilities()
        >>> if utils['ocr']:
        ...     from pycore.pyutils import ocr_manager
    """
    return {
        'ocr': OCR_AVAILABLE,
        'edge_tts': EDGE_TTS_AVAILABLE,
        'azure_speech': AZURE_SPEECH_AVAILABLE,
        'device_manager': DEVICE_MANAGER_AVAILABLE,
        'device_control': DEVICE_CONTROL_AVAILABLE,
        'group_control': GROUP_CONTROL_AVAILABLE,
        'video_stream': VIDEO_STREAM_AVAILABLE,
        'media_compressor': MEDIA_COMPRESSOR_AVAILABLE,
        'device_sync': DEVICE_SYNC_AVAILABLE,
        'browser': BROWSER_AVAILABLE,
        'web_server': WEB_SERVER_AVAILABLE,
        'yolo': YOLO_AVAILABLE,
        'mcp': MCP_AVAILABLE,
        'rpc': RPC_AVAILABLE,
        'wsrpc': WSRPC_AVAILABLE,
        'native_ui': NATIVE_UI_AVAILABLE,
    }


# ============================================================================
# Exports
# ============================================================================

__all__ = [
    # Utility functions
    'get_available_utilities',
    
    # OCR
    'ocr_manager',
    'OCR_AVAILABLE',
    
    # TTS
    'edge_tts_manager',
    'EDGE_TTS_AVAILABLE',
    'azure_speech_manager',
    'AZURE_SPEECH_AVAILABLE',
    
    # Device Manager (Legacy)
    'DeviceManager',
    'DeviceState',
    'DEVICE_MANAGER_AVAILABLE',
    
    # Device Control
    'ADBManager',
    'ADBDevice',
    'TouchEvent',
    'KeyEvent',
    'MessageBuilder',
    'DEVICE_CONTROL_AVAILABLE',
    
    # Group Control
    'GroupController',
    'SyncStrategy',
    'AllSyncStrategy',
    'TouchOnlySyncStrategy',
    'SyncEvent',
    'GROUP_CONTROL_AVAILABLE',
    
    # Video Stream
    'VideoDecoder',
    'H264Decoder',
    'FMP4Encoder',
    'VideoFrame',
    'VideoFormat',
    'VideoStreamHandler',
    'H264Config',
    'FMP4EncoderComplete',
    'H264Frame',
    'VIDEO_STREAM_AVAILABLE',
    
    # Media Compression
    'MediaCompressor',
    'get_media_compressor',
    'CompressionStats',
    'CompressionTask',
    'QueueStats',
    'MEDIA_COMPRESSOR_AVAILABLE',
    
    # Device Sync
    'SimplePrimaryServer',
    'SimpleClient',
    'SimpleDeviceScanner',
    'get_device_sync_config',
    'DEVICE_SYNC_AVAILABLE',
    
    # Browser
    'browser_manager',
    'BROWSER_AVAILABLE',
    
    # Web Server
    'web_server_manager',
    'WEB_SERVER_AVAILABLE',
    
    # YOLO
    'yolo_manager',
    'YOLO_AVAILABLE',
    
    # MCP
    'mcp_server_manager',
    'MCP_AVAILABLE',
    
    # RPC
    'rpc_manager',
    'RPC_AVAILABLE',
    'wsrpc_manager',
    'WSRPC_AVAILABLE',
    
    # Native UI (conditional)
    'UIConfig',
    'SignalType',
    'Signal',
    'WindowState',
    'SignalManager',
    'TaskTimer',
    'TimerTask',
    'MainThreadExecutor',
    'StartupWindow',
    'ColorPrintCapture',
    'launch_app_with_startup',
    'NATIVE_UI_AVAILABLE',
]

__version__ = '2.0.0'
