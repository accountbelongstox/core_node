"""API routes module"""

from .device_routes import router as device_router
from .health_routes import router as health_router
from .ws_routes import router as ws_router

__all__ = ['device_router', 'health_router', 'ws_router']
