# -*- coding: utf-8 -*-
"""
RPC Routes for task_settings
"""

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_TASK_SETTINGS_CHAINS,
    UI_TASK_SETTINGS_UPDATE_CHAIN
)

def register_local_task_settings_routes(server):
    """Register WS RPC handlers."""
    
    async def chains_handler(params, request_id, context):
        # TODO: Implement native RPC handler for chains
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_TASK_SETTINGS_CHAINS, handler=chains_handler, sync=False)

    async def update_chain_handler(params, request_id, context):
        # TODO: Implement native RPC handler for update_chain
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_TASK_SETTINGS_UPDATE_CHAIN, handler=update_chain_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered task_settings RPC routes")

__all__ = ["register_local_task_settings_routes"]
