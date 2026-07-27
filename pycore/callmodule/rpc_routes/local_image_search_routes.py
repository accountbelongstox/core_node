# -*- coding: utf-8 -*-
"""
RPC Routes for image_search
"""

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_IMAGE_SEARCH_STATUS,
    UI_IMAGE_SEARCH_SEARCH_AI,
    UI_IMAGE_SEARCH_COMPARE,
    UI_IMAGE_SEARCH_HISTORY,
    UI_IMAGE_SEARCH_DELETE_HISTORY,
    UI_IMAGE_SEARCH_CLEAR_HISTORY
)

def register_local_image_search_routes(server):
    """Register WS RPC handlers."""
    
    async def status_handler(params, request_id, context):
        # TODO: Implement native RPC handler for status
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_IMAGE_SEARCH_STATUS, handler=status_handler, sync=False)

    async def search_ai_handler(params, request_id, context):
        # TODO: Implement native RPC handler for search_ai
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_IMAGE_SEARCH_SEARCH_AI, handler=search_ai_handler, sync=False)

    async def compare_handler(params, request_id, context):
        # TODO: Implement native RPC handler for compare
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_IMAGE_SEARCH_COMPARE, handler=compare_handler, sync=False)

    async def history_handler(params, request_id, context):
        # TODO: Implement native RPC handler for history
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_IMAGE_SEARCH_HISTORY, handler=history_handler, sync=False)

    async def delete_history_handler(params, request_id, context):
        # TODO: Implement native RPC handler for delete_history
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_IMAGE_SEARCH_DELETE_HISTORY, handler=delete_history_handler, sync=False)

    async def clear_history_handler(params, request_id, context):
        # TODO: Implement native RPC handler for clear_history
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_IMAGE_SEARCH_CLEAR_HISTORY, handler=clear_history_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered image_search RPC routes")

__all__ = ["register_local_image_search_routes"]
