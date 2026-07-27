# -*- coding: utf-8 -*-
"""Pycore utility facade with lazy, side-effect-free compatibility exports."""

import os
from importlib import import_module
from typing import Dict, Tuple


__version__ = "2.0.0"

_EXPORTS: Dict[str, Tuple[str, str]] = {
    "ocr_manager": ("pycore.pyutils.ocr_cluster", "ocr_manager"),
    "DeviceManager": ("pycore.pyutils.device.device_manager", "DeviceManager"),
    "DeviceState": ("pycore.pyutils.device.device_manager", "DeviceState"),
    "edge_tts_manager": ("pycore.pyutils.edge_tts", "edge_tts_manager"),
    "azure_speech_manager": (
        "pycore.pyutils.azure_speech",
        "azure_speech_manager",
    ),
    "ADBManager": ("pycore.pyutils.device", "ADBManager"),
    "ADBDevice": ("pycore.pyutils.device", "ADBDevice"),
    "TouchEvent": ("pycore.pyutils.control", "TouchEvent"),
    "KeyEvent": ("pycore.pyutils.control", "KeyEvent"),
    "MessageBuilder": ("pycore.pyutils.control", "MessageBuilder"),
    "GroupController": ("pycore.pyutils.group", "GroupController"),
    "SyncStrategy": ("pycore.pyutils.group", "SyncStrategy"),
    "AllSyncStrategy": ("pycore.pyutils.group", "AllSyncStrategy"),
    "TouchOnlySyncStrategy": ("pycore.pyutils.group", "TouchOnlySyncStrategy"),
    "SyncEvent": ("pycore.pyutils.group", "SyncEvent"),
    "type_into_field": ("pycore.pyutils.input.field_input", "type_into_field"),
    "fill_field_with_fallback": (
        "pycore.pyutils.input.field_input",
        "fill_field_with_fallback",
    ),
    "FieldInputSimulator": (
        "pycore.pyutils.input.field_input",
        "FieldInputSimulator",
    ),
    "CLEAR_MODE_REPLACE": (
        "pycore.pyutils.input.field_input",
        "CLEAR_MODE_REPLACE",
    ),
    "CLEAR_MODE_APPEND": (
        "pycore.pyutils.input.field_input",
        "CLEAR_MODE_APPEND",
    ),
    "CLEAR_MODE_NONE": ("pycore.pyutils.input.field_input", "CLEAR_MODE_NONE"),
    "VideoDecoder": ("pycore.pyutils.video_stream", "VideoDecoder"),
    "H264Decoder": ("pycore.pyutils.video_stream", "H264Decoder"),
    "FMP4Encoder": ("pycore.pyutils.video_stream", "FMP4Encoder"),
    "VideoFrame": ("pycore.pyutils.video_stream", "VideoFrame"),
    "VideoFormat": ("pycore.pyutils.video_stream", "VideoFormat"),
    "VideoStreamHandler": (
        "pycore.pyutils.video_stream",
        "VideoStreamHandler",
    ),
    "H264Config": ("pycore.pyutils.video_stream", "H264Config"),
    "FMP4EncoderComplete": (
        "pycore.pyutils.video_stream",
        "FMP4EncoderComplete",
    ),
    "H264Frame": ("pycore.pyutils.video_stream", "H264Frame"),
    "MediaCompressor": (
        "pycore.pyutils.image_tools.media_compressor",
        "MediaCompressor",
    ),
    "get_media_compressor": (
        "pycore.pyutils.image_tools.media_compressor",
        "get_media_compressor",
    ),
    "CompressionStats": (
        "pycore.pyutils.image_tools.media_compressor",
        "CompressionStats",
    ),
    "CompressionTask": (
        "pycore.pyutils.image_tools.media_compressor",
        "CompressionTask",
    ),
    "QueueStats": (
        "pycore.pyutils.image_tools.media_compressor",
        "QueueStats",
    ),
    "SimplePrimaryServer": (
        "pycore.pyutils.launcher.device_sync",
        "SimplePrimaryServer",
    ),
    "SimpleClient": ("pycore.pyutils.launcher.device_sync", "SimpleClient"),
    "SimpleDeviceScanner": (
        "pycore.pyutils.launcher.device_sync",
        "SimpleDeviceScanner",
    ),
    "get_device_sync_config": (
        "pycore.pyutils.launcher.device_sync",
        "get_global_config",
    ),
    "browser_manager": ("pycore.pyutils.pybrowser", "browser_manager"),
    "web_server_manager": ("pycore.pyutils.web", "web_server_manager"),
    "yolo_manager": ("pycore.pyutils.ultralytics", "yolo_manager"),
    "mcp_server_manager": ("pycore.pyutils.mcp", "mcp_server_manager"),
    "rpc_manager": ("pycore.pyutils.rpc_v2", "rpc_manager"),
    "wsrpc_manager": ("pycore.pyutils.wsrpc", "wsrpc_manager"),
    "WebSocketManager": ("pycore.pyutils.wsrpc", "WebSocketManager"),
    "ensure_tk_root_in_taskbar": (
        "pycore.pyutils.desktop.tk_taskbar",
        "ensure_tk_root_in_taskbar",
    ),
    "set_windows_app_user_model_id": (
        "pycore.pyutils.desktop.tk_taskbar",
        "set_windows_app_user_model_id",
    ),
    "UIConfig": ("pycore.pyutils.native_ui", "UIConfig"),
    "SignalType": ("pycore.pyutils.native_ui", "SignalType"),
    "Signal": ("pycore.pyutils.native_ui", "Signal"),
    "WindowState": ("pycore.pyutils.native_ui", "WindowState"),
    "SignalManager": ("pycore.pyutils.native_ui", "SignalManager"),
    "TaskTimer": ("pycore.pyutils.native_ui", "TaskTimer"),
    "TimerTask": ("pycore.pyutils.native_ui", "TimerTask"),
    "MainThreadExecutor": (
        "pycore.pyutils.native_ui",
        "MainThreadExecutor",
    ),
    "TkinterStartupThread": (
        "pycore.pyutils.native_ui",
        "TkinterStartupThread",
    ),
    "ColorPrintCapture": (
        "pycore.pyutils.native_ui",
        "ColorPrintCapture",
    ),
    "launch_app_with_startup": (
        "pycore.pyutils.native_ui",
        "launch_app_with_startup",
    ),
}

_AVAILABILITY = {
    "OCR_AVAILABLE": "ocr_manager",
    "EDGE_TTS_AVAILABLE": "edge_tts_manager",
    "AZURE_SPEECH_AVAILABLE": "azure_speech_manager",
    "DEVICE_MANAGER_AVAILABLE": "DeviceManager",
    "DEVICE_CONTROL_AVAILABLE": "ADBManager",
    "GROUP_CONTROL_AVAILABLE": "GroupController",
    "VIDEO_STREAM_AVAILABLE": "VideoDecoder",
    "MEDIA_COMPRESSOR_AVAILABLE": "MediaCompressor",
    "DEVICE_SYNC_AVAILABLE": "SimplePrimaryServer",
    "BROWSER_AVAILABLE": "browser_manager",
    "WEB_SERVER_AVAILABLE": "web_server_manager",
    "YOLO_AVAILABLE": "yolo_manager",
    "MCP_AVAILABLE": "mcp_server_manager",
    "RPC_AVAILABLE": "rpc_manager",
    "WSRPC_AVAILABLE": "wsrpc_manager",
    "NATIVE_UI_AVAILABLE": "UIConfig",
}

_NATIVE_EXPORTS = {
    "UIConfig",
    "SignalType",
    "Signal",
    "WindowState",
    "SignalManager",
    "TaskTimer",
    "TimerTask",
    "MainThreadExecutor",
    "TkinterStartupThread",
    "ColorPrintCapture",
    "launch_app_with_startup",
}

__all__ = [
    "get_available_utilities",
    *_EXPORTS,
    *_AVAILABILITY,
]


def _load_export(name: str):
    module_name, attribute_name = _EXPORTS[name]
    return getattr(import_module(module_name), attribute_name)


def __getattr__(name: str):
    if name in _AVAILABILITY:
        export_name = _AVAILABILITY[name]
        if export_name in _NATIVE_EXPORTS and os.getenv("PYUTILS_LOAD_GUI", "0") != "1":
            value = False
        else:
            try:
                value = _load_export(export_name) is not None
            except Exception:
                value = False
        globals()[name] = value
        return value

    export = _EXPORTS.get(name)
    if export is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    if name in _NATIVE_EXPORTS and os.getenv("PYUTILS_LOAD_GUI", "0") != "1":
        value = None
    else:
        try:
            value = _load_export(name)
        except Exception:
            value = None
    globals()[name] = value
    return value


def get_available_utilities():
    """Return feature availability without importing unrelated utility domains."""
    return {
        "ocr": __getattr__("OCR_AVAILABLE"),
        "edge_tts": __getattr__("EDGE_TTS_AVAILABLE"),
        "azure_speech": __getattr__("AZURE_SPEECH_AVAILABLE"),
        "device_manager": __getattr__("DEVICE_MANAGER_AVAILABLE"),
        "device_control": __getattr__("DEVICE_CONTROL_AVAILABLE"),
        "group_control": __getattr__("GROUP_CONTROL_AVAILABLE"),
        "video_stream": __getattr__("VIDEO_STREAM_AVAILABLE"),
        "media_compressor": __getattr__("MEDIA_COMPRESSOR_AVAILABLE"),
        "device_sync": __getattr__("DEVICE_SYNC_AVAILABLE"),
        "browser": __getattr__("BROWSER_AVAILABLE"),
        "web_server": __getattr__("WEB_SERVER_AVAILABLE"),
        "yolo": __getattr__("YOLO_AVAILABLE"),
        "mcp": __getattr__("MCP_AVAILABLE"),
        "rpc": __getattr__("RPC_AVAILABLE"),
        "wsrpc": __getattr__("WSRPC_AVAILABLE"),
        "native_ui": __getattr__("NATIVE_UI_AVAILABLE"),
    }


def __dir__():
    return sorted(set(globals()) | set(__all__))
