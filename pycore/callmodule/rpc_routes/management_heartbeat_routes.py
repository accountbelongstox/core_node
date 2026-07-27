# -*- coding: utf-8 -*-
"""
RPC Routes for heartbeat
"""

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_HEARTBEAT_GET_CALLBACK_STATUS
)

def register_management_heartbeat_routes(server):
    """Register WS RPC handlers."""
    
    async def get_callback_status_handler(params, request_id, context):
        # TODO: Implement native RPC handler for get_callback_status
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_HEARTBEAT_GET_CALLBACK_STATUS, handler=get_callback_status_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered heartbeat RPC routes")

__all__ = ["register_management_heartbeat_routes"]
