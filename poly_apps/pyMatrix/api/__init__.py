"""API routes module"""

from .config_routes import router as config_router
from .device_routes import router as device_router
from .health_routes import router as health_router
from .ws_routes import router as ws_router
from .recording_routes import router as recording_router
from .screen_routes import router as screen_router
from .group_routes import router as group_router
from .file_routes import router as file_router

__all__ = ['config_router', 'device_router', 'health_router', 'ws_router', 'recording_router', 'screen_router', 'group_router', 'file_router']
