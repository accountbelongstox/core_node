# -*- coding: utf-8 -*-
"""
RPC Routes for system_resources
"""

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_SYSTEM_RESOURCES_SYSTEM_RESOURCES
)

def register_local_system_resources_routes(server):
    """Register WS RPC handlers."""
    
    async def system_resources_handler(params, request_id, context):
        # TODO: Implement native RPC handler for system_resources
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_SYSTEM_RESOURCES_SYSTEM_RESOURCES, handler=system_resources_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered system_resources RPC routes")

__all__ = ["register_local_system_resources_routes"]
