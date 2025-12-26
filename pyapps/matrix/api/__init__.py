"""
Matrix API - RPC v2 WebSocket Edition

<<<<<<< HEAD
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
=======
All Matrix APIs are exposed as RPC v2 WebSocket routes.

Connection:
    ws://localhost:48000/rpc/ws

Protocol:
    RPC v2 (request/response with ACK mechanism)

Usage:
    from pyapps.matrix.api.main import register_all_routes

    # Called by pylauncher via rpc_init_callback
    register_all_routes(rpc_server)
"""

from .main import register_all_routes

__all__ = ['register_all_routes']
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
