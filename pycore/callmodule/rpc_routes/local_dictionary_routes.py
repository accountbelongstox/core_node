# -*- coding: utf-8 -*-
"""
RPC Routes for dictionary
"""

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_DICTIONARY_DICTIONARY_STATUS,
    UI_DICTIONARY_DICTIONARY_LOOKUP
)

def register_local_dictionary_routes(server):
    """Register WS RPC handlers."""
    
    async def dictionary_status_handler(params, request_id, context):
        # TODO: Implement native RPC handler for dictionary_status
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_DICTIONARY_DICTIONARY_STATUS, handler=dictionary_status_handler, sync=False)

    async def dictionary_lookup_handler(params, request_id, context):
        # TODO: Implement native RPC handler for dictionary_lookup
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_DICTIONARY_DICTIONARY_LOOKUP, handler=dictionary_lookup_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered dictionary RPC routes")

__all__ = ["register_local_dictionary_routes"]
