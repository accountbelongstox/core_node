# -*- coding: utf-8 -*-
"""
RPC Routes for logs
"""

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_LOGS_CLEAR_LOGS,
    UI_LOGS_GET_LOG_STATS
)

def register_management_logs_routes(server):
    """Register WS RPC handlers."""
    
    async def clear_logs_handler(params, request_id, context):
        # TODO: Implement native RPC handler for clear_logs
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_LOGS_CLEAR_LOGS, handler=clear_logs_handler, sync=False)

    async def get_log_stats_handler(params, request_id, context):
        # TODO: Implement native RPC handler for get_log_stats
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_LOGS_GET_LOG_STATS, handler=get_log_stats_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered logs RPC routes")

__all__ = ["register_management_logs_routes"]
