# -*- coding: utf-8 -*-
"""
RPC Routes for engines_load_status
"""

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_ENGINES_LOAD_STATUS_LOAD_STATUS
)

def register_local_engines_load_status_routes(server):
    """Register WS RPC handlers."""
    
    async def load_status_handler(params, request_id, context):
        # TODO: Implement native RPC handler for load_status
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_ENGINES_LOAD_STATUS_LOAD_STATUS, handler=load_status_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered engines_load_status RPC routes")

__all__ = ["register_local_engines_load_status_routes"]
