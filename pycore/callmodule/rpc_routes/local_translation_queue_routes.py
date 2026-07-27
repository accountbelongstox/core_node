# -*- coding: utf-8 -*-
"""
RPC Routes for translation_queue
"""

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_TRANSLATION_QUEUE_SET_PRIORITY,
    UI_TRANSLATION_QUEUE_STACK,
    UI_TRANSLATION_QUEUE_GET_TASK_DETAIL
)

def register_local_translation_queue_routes(server):
    """Register WS RPC handlers."""
    
    async def set_priority_handler(params, request_id, context):
        # TODO: Implement native RPC handler for set_priority
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_TRANSLATION_QUEUE_SET_PRIORITY, handler=set_priority_handler, sync=False)

    async def stack_handler(params, request_id, context):
        # TODO: Implement native RPC handler for stack
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_TRANSLATION_QUEUE_STACK, handler=stack_handler, sync=False)

    async def get_task_detail_handler(params, request_id, context):
        # TODO: Implement native RPC handler for get_task_detail
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_TRANSLATION_QUEUE_GET_TASK_DETAIL, handler=get_task_detail_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered translation_queue RPC routes")

__all__ = ["register_local_translation_queue_routes"]
