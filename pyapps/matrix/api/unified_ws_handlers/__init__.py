"""Unified WebSocket Handlers - Namespace handlers for unified WebSocket protocol"""

from .base_handler import BaseHandler, HandlerRegistry
from .device_handler import DeviceHandler
from .screen_handler import ScreenHandler
from .file_handler import FileHandler
from .recording_handler import RecordingHandler
from .group_handler import GroupHandler
from .config_handler import ConfigHandler
from .control_handler import ControlHandler
from .video_handler import VideoHandler
from .system_handler import SystemHandler

__all__ = [
    'BaseHandler',
    'HandlerRegistry',
    'DeviceHandler',
    'ScreenHandler',
    'FileHandler',
    'RecordingHandler',
    'GroupHandler',
    'ConfigHandler',
    'ControlHandler',
    'VideoHandler',
    'SystemHandler',
]
