# -*- coding: utf-8 -*-
"""
RPC Routes for task_center
"""

import asyncio
from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_TASK_CENTER_GET,
    UI_TASK_CENTER_GET_QUEUE_CENTER_SNAPSHOT,
    UI_TASK_CENTER_SET_QUEUE_CENTER_CONTROL,
    UI_TASK_CENTER_GET_LOCAL_TASK_DETAIL,
    UI_TASK_CENTER_GET_REMOTE_TASK_DETAIL
)
from pycore.callmodule.controllers.local_processing.task_center_controller import (
    get_task_center,
    get_queue_center_snapshot,
    set_queue_center_control,
    get_local_task_detail,
    get_remote_task_detail,
    QueueCenterControlRequest
)

def register_local_task_center_routes(server):
    """Register WS RPC handlers."""

    async def get_task_center_handler(params, request_id, context):
        return await asyncio.to_thread(get_task_center)

    server.route(name=UI_TASK_CENTER_GET, handler=get_task_center_handler, sync=False)
    
    async def get_queue_center_snapshot_handler(params, request_id, context):
        return await asyncio.to_thread(get_queue_center_snapshot)
        
    server.route(name=UI_TASK_CENTER_GET_QUEUE_CENTER_SNAPSHOT, handler=get_queue_center_snapshot_handler, sync=False)

    async def set_queue_center_control_handler(params, request_id, context):
        params = params or {}
        control_name = params.get("control_name")
        if not control_name:
            return {"success": False, "error": "control_name is required"}
        req = QueueCenterControlRequest(
            enabled=params.get("enabled", False),
            requested_by=params.get("requested_by"),
            reason=params.get("reason"),
            graceful_stop=params.get("graceful_stop", False)
        )
        try:
            return await asyncio.to_thread(set_queue_center_control, control_name, req)
        except Exception as e:
            return {"success": False, "error": str(e)}
        
    server.route(name=UI_TASK_CENTER_SET_QUEUE_CENTER_CONTROL, handler=set_queue_center_control_handler, sync=False)

    async def get_local_task_detail_handler(params, request_id, context):
        params = params or {}
        task_id = params.get("task_id")
        if not task_id:
            return {"success": False, "error": "task_id is required"}
        try:
            return await asyncio.to_thread(get_local_task_detail, task_id)
        except Exception as e:
            return {"success": False, "error": str(e)}
        
    server.route(name=UI_TASK_CENTER_GET_LOCAL_TASK_DETAIL, handler=get_local_task_detail_handler, sync=False)

    async def get_remote_task_detail_handler(params, request_id, context):
        params = params or {}
        task_id = params.get("task_id")
        if not task_id:
            return {"success": False, "error": "task_id is required"}
        try:
            return await asyncio.to_thread(get_remote_task_detail, task_id)
        except Exception as e:
            return {"success": False, "error": str(e)}
        
    server.route(name=UI_TASK_CENTER_GET_REMOTE_TASK_DETAIL, handler=get_remote_task_detail_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered task_center RPC routes")

__all__ = ["register_local_task_center_routes"]
