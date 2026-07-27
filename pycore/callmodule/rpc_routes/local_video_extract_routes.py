# -*- coding: utf-8 -*-
"""RPC Routes for video_extract — native UI path (no router.invoke)."""

import asyncio

from pycore import ColorPrint
from pycore.callmodule.controllers.local_processing import VideoExtractController
from pycore.callmodule.rpc_routes.route_names import (
    UI_VIDEO_EXTRACT_CAPABILITIES,
    UI_VIDEO_EXTRACT_GET_TASK,
    UI_VIDEO_EXTRACT_CANCEL_TASK,
    UI_VIDEO_EXTRACT_PAUSE_TASK,
    UI_VIDEO_EXTRACT_RESUME_TASK,
)
from pycore.pyctl.desktop.task_manager import get_task_manager

_controller = VideoExtractController()


def _get_task_sync(task_id: str):
    task = get_task_manager().get_task(task_id)
    if not task:
        return {"success": False, "error": "task not found"}
    return {"success": True, "task": task.to_dict()}


def _flag_task(task_id: str, attr: str, value, message: str):
    task = get_task_manager().get_task(task_id)
    if not task:
        return {"success": False, "error": "task not found"}
    setattr(task, attr, value)
    return {"success": True, "message": message}


def register_local_video_extract_routes(server):
    """Register WS RPC handlers."""

    async def capabilities_handler(params, request_id, context):
        return await asyncio.to_thread(_controller.capabilities)

    server.route(name=UI_VIDEO_EXTRACT_CAPABILITIES, handler=capabilities_handler, sync=False)

    async def get_task_handler(params, request_id, context):
        params = params or {}
        task_id = str(params.get("task_id") or params.get("id") or "")
        if not task_id:
            return {"success": False, "error": "task_id is required"}
        return await asyncio.to_thread(_get_task_sync, task_id)

    server.route(name=UI_VIDEO_EXTRACT_GET_TASK, handler=get_task_handler, sync=False)

    async def cancel_task_handler(params, request_id, context):
        params = params or {}
        task_id = str(params.get("task_id") or params.get("id") or "")
        if not task_id:
            return {"success": False, "error": "task_id is required"}
        return await asyncio.to_thread(
            _flag_task, task_id, "_cancel", True, "cancel requested",
        )

    server.route(name=UI_VIDEO_EXTRACT_CANCEL_TASK, handler=cancel_task_handler, sync=False)

    async def pause_task_handler(params, request_id, context):
        params = params or {}
        task_id = str(params.get("task_id") or params.get("id") or "")
        if not task_id:
            return {"success": False, "error": "task_id is required"}
        return await asyncio.to_thread(
            _flag_task, task_id, "_pause", True, "pause requested",
        )

    server.route(name=UI_VIDEO_EXTRACT_PAUSE_TASK, handler=pause_task_handler, sync=False)

    async def resume_task_handler(params, request_id, context):
        params = params or {}
        task_id = str(params.get("task_id") or params.get("id") or "")
        if not task_id:
            return {"success": False, "error": "task_id is required"}
        return await asyncio.to_thread(
            _flag_task, task_id, "_pause", False, "resume requested",
        )

    server.route(name=UI_VIDEO_EXTRACT_RESUME_TASK, handler=resume_task_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered video_extract RPC routes")


__all__ = ["register_local_video_extract_routes"]
