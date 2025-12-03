"""API routes module"""

from .config_routes import router as config_router
from .device_routes import router as device_router
from .health_routes import router as health_router
from .recording_routes import router as recording_router
from .screen_routes import router as screen_router
from .group_routes import router as group_router
from .file_routes import router as file_router
from .unified_ws import router as unified_ws_router

__all__ = [
    'config_router',
    'device_router',
    'health_router',
    'unified_ws_router',  # Unified WebSocket endpoint at /ws
    'recording_router',
    'screen_router',
    'group_router',
    'file_router'
]
