# -*- coding: utf-8 -*-
"""
RPC Routes for logs
"""

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_LOGS_CLEAR_LOGS,
    UI_LOGS_GET_LOG_STATS,
    UI_LARAVEL_LOGS_SNAPSHOT,
    UI_LARAVEL_LOGS_REFRESH,
)
from pycore.callmodule.services.laravel_log_mirror_service import get_laravel_log_mirror_service
import asyncio

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

    async def laravel_logs_snapshot_handler(params, request_id, context):
        service = get_laravel_log_mirror_service()
        return await asyncio.to_thread(service.get_snapshot)

    server.route(name=UI_LARAVEL_LOGS_SNAPSHOT, handler=laravel_logs_snapshot_handler, sync=False)

    async def laravel_logs_refresh_handler(params, request_id, context):
        service = get_laravel_log_mirror_service()
        # Trigger poll asynchronously
        asyncio.create_task(asyncio.to_thread(service.poll_once))
        return {"success": True, "data": {"status": "refresh_requested"}}

    server.route(name=UI_LARAVEL_LOGS_REFRESH, handler=laravel_logs_refresh_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered logs RPC routes")

__all__ = ["register_management_logs_routes"]
