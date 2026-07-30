# -*- coding: utf-8 -*-
"""HTTP Routes for video_extract — native UI path (no router.invoke)."""


from pycore.pyctl.desktop.video_extract_service import video_extract_service
from pycore.pyctl.desktop.video_extract_models import (
    VideoExtractOpenRequest,
    VideoExtractRequest,
    VideoExtractSegmentsRequest,
)
from pycore.callmodule.rpc_routes.route_names import (
    UI_VIDEO_EXTRACT_CAPABILITIES,
    UI_VIDEO_EXTRACT_OPEN,
    UI_VIDEO_EXTRACT_PREVIEW,
    UI_VIDEO_EXTRACT_START,
    UI_VIDEO_EXTRACT_SEGMENTS,
    UI_VIDEO_EXTRACT_GET_TASK,
    UI_VIDEO_EXTRACT_CANCEL_TASK,
    UI_VIDEO_EXTRACT_PAUSE_TASK,
    UI_VIDEO_EXTRACT_RESUME_TASK,
)
from pycore.pyctl.desktop.task_manager import task_manager


def register_local_video_extract_routes(server):
    """Register HTTP controllers."""

    server.post(
        name=UI_VIDEO_EXTRACT_CAPABILITIES,
        handler=video_extract_service.capabilities,
    )

    def open_handler(params, request_id, context):
        return video_extract_service.open(VideoExtractOpenRequest(**(params or {})))

    def preview_handler(params, request_id, context):
        return video_extract_service.preview(VideoExtractRequest(**(params or {})))

    def start_handler(params, request_id, context):
        return video_extract_service.start(VideoExtractRequest(**(params or {})))

    def segments_handler(params, request_id, context):
        return video_extract_service.segments(VideoExtractSegmentsRequest(**(params or {})))

    server.post(name=UI_VIDEO_EXTRACT_OPEN, handler=open_handler)
    server.post(name=UI_VIDEO_EXTRACT_PREVIEW, handler=preview_handler)
    server.post(name=UI_VIDEO_EXTRACT_START, handler=start_handler)
    server.post(name=UI_VIDEO_EXTRACT_SEGMENTS, handler=segments_handler)

    def get_task_handler(params, request_id, context):
        params = params or {}
        task_id = str(params.get("task_id") or params.get("id") or "")
        if not task_id:
            return {"success": False, "error": "task_id is required"}
        return task_manager.get_task_response(task_id)

    server.post(name=UI_VIDEO_EXTRACT_GET_TASK, handler=get_task_handler)

    def cancel_task_handler(params, request_id, context):
        params = params or {}
        task_id = str(params.get("task_id") or params.get("id") or "")
        if not task_id:
            return {"success": False, "error": "task_id is required"}
        return task_manager.cancel_task(task_id)

    server.post(name=UI_VIDEO_EXTRACT_CANCEL_TASK, handler=cancel_task_handler)

    def pause_task_handler(params, request_id, context):
        params = params or {}
        task_id = str(params.get("task_id") or params.get("id") or "")
        if not task_id:
            return {"success": False, "error": "task_id is required"}
        return task_manager.pause_task(task_id)

    server.post(name=UI_VIDEO_EXTRACT_PAUSE_TASK, handler=pause_task_handler)

    def resume_task_handler(params, request_id, context):
        params = params or {}
        task_id = str(params.get("task_id") or params.get("id") or "")
        if not task_id:
            return {"success": False, "error": "task_id is required"}
        return task_manager.resume_task(task_id)

    server.post(name=UI_VIDEO_EXTRACT_RESUME_TASK, handler=resume_task_handler)


