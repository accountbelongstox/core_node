# -*- coding: utf-8 -*-
"""
Video Extract router.

Endpoints (prefix /api/local/video-extract):
  GET  /capabilities       -> whisper models/languages + supported extensions
  POST /open               -> reveal a path in the OS file manager / default app
  POST /preview            -> dry-run scan (what would be processed)
  POST /start              -> queue an async extraction task, returns task_id
  GET  /tasks/{task_id}    -> task status + live progress snapshot
  POST /tasks/{task_id}/cancel -> cooperative cancel
  POST /tasks/{task_id}/pause  -> cooperative pause
  POST /tasks/{task_id}/resume -> resume a paused task
  POST /segments               -> smart-segmentation mapping for a processed video
"""

import fastapi

from ...controllers.local_processing import VideoExtractController
from ...models.local_processing.video_extract_models import (
    VideoExtractRequest,
    VideoExtractStartResponse,
    VideoExtractPreviewResponse,
    VideoExtractOpenRequest,
    VideoExtractOpenResponse,
    VideoExtractSegmentsRequest,
    VideoExtractSegmentsResponse,
)
from pycore.pyctl.desktop.task_manager import get_task_manager

router = fastapi.APIRouter(prefix="/api/local/video-extract", tags=["Local Processing - Video Extract"])
controller = VideoExtractController()


@router.get("/capabilities")
async def capabilities():
    """Installed whisper models + supported languages (drives the UI dropdowns)."""
    return controller.capabilities()


@router.post("/open", response_model=VideoExtractOpenResponse)
async def open_path(request: VideoExtractOpenRequest):
    """Reveal a path in the OS file manager / open a file with its default app."""
    return controller.open(request)


@router.post("/preview", response_model=VideoExtractPreviewResponse)
async def preview(request: VideoExtractRequest):
    """Dry-run scan: list the videos that would be processed (writes nothing)."""
    return controller.preview(request)


@router.post("/start", response_model=VideoExtractStartResponse)
async def start(request: VideoExtractRequest):
    """Queue an extraction job; returns a task_id to poll for progress."""
    return controller.start(request)


@router.post("/segments", response_model=VideoExtractSegmentsResponse)
async def segments(request: VideoExtractSegmentsRequest):
    """Return the smart-segmentation mapping.json for a processed (>5 min) video."""
    return controller.segments(request)


@router.get("/tasks/{task_id}")
async def get_task(task_id: str):
    """Poll a job's status + latest progress snapshot."""
    task = get_task_manager().get_task(task_id)
    if not task:
        return {"success": False, "error": "task not found"}
    return {"success": True, "task": task.to_dict()}


@router.post("/tasks/{task_id}/cancel")
async def cancel_task(task_id: str):
    """Request cooperative cancellation of a running job."""
    task = get_task_manager().get_task(task_id)
    if not task:
        return {"success": False, "error": "task not found"}
    setattr(task, "_cancel", True)
    return {"success": True, "message": "cancel requested"}


@router.post("/tasks/{task_id}/pause")
async def pause_task(task_id: str):
    """Request cooperative pause of a running job (mirrors /cancel)."""
    task = get_task_manager().get_task(task_id)
    if not task:
        return {"success": False, "error": "task not found"}
    setattr(task, "_pause", True)
    return {"success": True, "message": "pause requested"}


@router.post("/tasks/{task_id}/resume")
async def resume_task(task_id: str):
    """Resume a previously paused job."""
    task = get_task_manager().get_task(task_id)
    if not task:
        return {"success": False, "error": "task not found"}
    setattr(task, "_pause", False)
    return {"success": True, "message": "resume requested"}
