# -*- coding: utf-8 -*-
"""
RPC Routes for local_config
"""

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_LOCAL_CONFIG_UPDATE_CONFIG
)

def register_local_local_config_routes(server):
    """Register WS RPC handlers."""
    
    async def update_config_handler(params, request_id, context):
        # TODO: Implement native RPC handler for update_config
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_LOCAL_CONFIG_UPDATE_CONFIG, handler=update_config_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered local_config RPC routes")

__all__ = ["register_local_local_config_routes"]
