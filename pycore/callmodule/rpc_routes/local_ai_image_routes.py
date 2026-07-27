# -*- coding: utf-8 -*-
"""
RPC Routes for ai_image
"""

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_AI_IMAGE_IMAGE,
    UI_AI_IMAGE_IMAGE_TEST,
    UI_AI_IMAGE_IMAGE_HISTORY,
    UI_AI_IMAGE_IMAGE_HISTORY_FILE,
    UI_AI_IMAGE_IMAGE_HISTORY_REVEAL,
    UI_AI_IMAGE_IMAGE_HISTORY_DELETE,
    UI_AI_IMAGE_IMAGE_HISTORY_CLEAR
)

def register_local_ai_image_routes(server):
    """Register WS RPC handlers."""
    
    async def image_handler(params, request_id, context):
        # TODO: Implement native RPC handler for image
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_AI_IMAGE_IMAGE, handler=image_handler, sync=False)

    async def image_test_handler(params, request_id, context):
        # TODO: Implement native RPC handler for image_test
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_AI_IMAGE_IMAGE_TEST, handler=image_test_handler, sync=False)

    async def image_history_handler(params, request_id, context):
        # TODO: Implement native RPC handler for image_history
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_AI_IMAGE_IMAGE_HISTORY, handler=image_history_handler, sync=False)

    async def image_history_file_handler(params, request_id, context):
        # TODO: Implement native RPC handler for image_history_file
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_AI_IMAGE_IMAGE_HISTORY_FILE, handler=image_history_file_handler, sync=False)

    async def image_history_reveal_handler(params, request_id, context):
        # TODO: Implement native RPC handler for image_history_reveal
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_AI_IMAGE_IMAGE_HISTORY_REVEAL, handler=image_history_reveal_handler, sync=False)

    async def image_history_delete_handler(params, request_id, context):
        # TODO: Implement native RPC handler for image_history_delete
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_AI_IMAGE_IMAGE_HISTORY_DELETE, handler=image_history_delete_handler, sync=False)

    async def image_history_clear_handler(params, request_id, context):
        # TODO: Implement native RPC handler for image_history_clear
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_AI_IMAGE_IMAGE_HISTORY_CLEAR, handler=image_history_clear_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered ai_image RPC routes")

__all__ = ["register_local_ai_image_routes"]
