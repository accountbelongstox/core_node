"""
Matrix API - RPC v2 WebSocket Edition

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
