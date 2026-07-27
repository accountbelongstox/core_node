# -*- coding: utf-8 -*-
"""
RPC Routes for heartbeat_workers
"""

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_HEARTBEAT_WORKERS_STATUS,
    UI_HEARTBEAT_WORKERS_CONFIG
)

def register_local_heartbeat_workers_routes(server):
    """Register WS RPC handlers."""
    
    async def status_handler(params, request_id, context):
        # TODO: Implement native RPC handler for status
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_HEARTBEAT_WORKERS_STATUS, handler=status_handler, sync=False)

    async def config_handler(params, request_id, context):
        # TODO: Implement native RPC handler for config
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_HEARTBEAT_WORKERS_CONFIG, handler=config_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered heartbeat_workers RPC routes")

__all__ = ["register_local_heartbeat_workers_routes"]
