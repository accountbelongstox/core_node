# -*- coding: utf-8 -*-
"""Pycore package facade with side-effect-free compatibility exports."""

from importlib import import_module
from typing import Dict, Tuple


__version__ = "1.0.0"

_EXPORTS: Dict[str, Tuple[str, str]] = {
    "ColorPrint": ("pycore.pyfoundations", "ColorPrint"),
    "ENCYCLOPEDIA": ("pycore.pyfoundations", "ENCYCLOPEDIA"),
    "EventBus": ("pycore.pyfoundations", "EventBus"),
    "EventTypes": ("pycore.pyfoundations", "EventTypes"),
    "Event": ("pycore.pyfoundations", "Event"),
    "UserDataStore": ("pycore.pyfoundations", "UserDataStore"),
    "get_user_data_store": ("pycore.pyfoundations", "get_user_data_store"),
    "GlobalVarManager": ("pycore.pygvar", "GlobalVarManager"),
    "THREAD_BUS": ("pycore.pyfoundations", "THREAD_BUS"),
    "AndroidDevice": ("pycore.pyutils.device", "AndroidDevice"),
    "ScrcpyDevice": ("pycore.pyutils.device", "ScrcpyDevice"),
    "DeviceInfo": ("pycore.pyutils.device", "DeviceInfo"),
    "ServerParams": ("pycore.pyutils.device", "ServerParams"),
    "VideoCodec": ("pycore.pyutils.device", "VideoCodec"),
    "ADBManager": ("pycore.pyutils.device", "ADBManager"),
    "ADBDevice": ("pycore.pyutils.device", "ADBDevice"),
    "DeviceManager": ("pycore.pyutils", "DeviceManager"),
    "DeviceState": ("pycore.pyutils", "DeviceState"),
    "TouchEvent": ("pycore.pyutils", "TouchEvent"),
    "KeyEvent": ("pycore.pyutils", "KeyEvent"),
    "MessageBuilder": ("pycore.pyutils", "MessageBuilder"),
    "GroupController": ("pycore.pyutils", "GroupController"),
    "AllSyncStrategy": ("pycore.pyutils", "AllSyncStrategy"),
    "TouchOnlySyncStrategy": ("pycore.pyutils", "TouchOnlySyncStrategy"),
    "H264Decoder": ("pycore.pyutils", "H264Decoder"),
    "FMP4Encoder": ("pycore.pyutils", "FMP4Encoder"),
    "VideoFrame": ("pycore.pyutils", "VideoFrame"),
    "VideoFormat": ("pycore.pyutils", "VideoFormat"),
    "VideoStreamHandler": ("pycore.pyutils", "VideoStreamHandler"),
    "H264Config": ("pycore.pyutils", "H264Config"),
    "FMP4EncoderComplete": ("pycore.pyutils", "FMP4EncoderComplete"),
    "H264Frame": ("pycore.pyutils", "H264Frame"),
    "WebSocketManager": ("pycore.pyutils", "WebSocketManager"),
}

__all__ = ["get_gpu_info", *_EXPORTS]


def get_gpu_info():
    """Return cached GPU information without initializing unrelated features."""
    encyclopedia_module = import_module(
        "pycore.pyfoundations.pybasecommon.encyclopedia"
    )
    return encyclopedia_module.ENCYCLOPEDIA.get("pycore_gpu_info")


def __getattr__(name: str):
    export = _EXPORTS.get(name)
    if export is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    module_name, attribute_name = export
    value = getattr(import_module(module_name), attribute_name)
    globals()[name] = value
    return value


def __dir__():
    return sorted(set(globals()) | set(__all__))
