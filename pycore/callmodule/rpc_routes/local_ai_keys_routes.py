# -*- coding: utf-8 -*-
"""
RPC Routes for ai_keys
"""

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_AI_KEYS_LIST_KEYS,
    UI_AI_KEYS_SET_KEY,
    UI_AI_KEYS_RESET_COOLDOWN,
    UI_AI_KEYS_DELETE_KEY
)

def register_local_ai_keys_routes(server):
    """Register WS RPC handlers."""
    
    async def list_keys_handler(params, request_id, context):
        # TODO: Implement native RPC handler for list_keys
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_AI_KEYS_LIST_KEYS, handler=list_keys_handler, sync=False)

    async def set_key_handler(params, request_id, context):
        # TODO: Implement native RPC handler for set_key
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_AI_KEYS_SET_KEY, handler=set_key_handler, sync=False)

    async def reset_cooldown_handler(params, request_id, context):
        # TODO: Implement native RPC handler for reset_cooldown
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_AI_KEYS_RESET_COOLDOWN, handler=reset_cooldown_handler, sync=False)

    async def delete_key_handler(params, request_id, context):
        # TODO: Implement native RPC handler for delete_key
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_AI_KEYS_DELETE_KEY, handler=delete_key_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered ai_keys RPC routes")

__all__ = ["register_local_ai_keys_routes"]
