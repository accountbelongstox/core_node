# -*- coding: utf-8 -*-
"""
RPC Routes for version
"""

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_VERSION_VERSION
)

def register_local_version_routes(server):
    """Register WS RPC handlers."""
    
    async def version_handler(params, request_id, context):
        # TODO: Implement native RPC handler for version
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_VERSION_VERSION, handler=version_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered version RPC routes")

__all__ = ["register_local_version_routes"]
