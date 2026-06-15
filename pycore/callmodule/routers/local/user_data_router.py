# -*- coding: utf-8 -*-
"""
User Data router.

Endpoints (prefix /api/local/user-data):
  GET  /system-settings          -> persisted system settings
  POST /system-settings          -> replace system settings (broadcasts to UI)
  GET  /video-extract            -> video-extract history/state
  POST /video-extract/add        -> add/refresh a source (stacks, dedupes)
  POST /video-extract/remove     -> remove a source by path
  POST /video-extract/options    -> persist last-used extraction options
"""

import fastapi

from ...controllers.local_processing import UserDataController
from ...models.local_processing.user_data_models import (
    SystemSettingsRequest,
    SystemSettingsResponse,
    VideoExtractHistoryResponse,
    VideoExtractAddRequest,
    VideoExtractRemoveRequest,
    VideoExtractOptionsRequest,
    PickPathRequest,
    PickPathResponse,
    OkResponse,
)

router = fastapi.APIRouter(prefix="/api/local/user-data", tags=["Local Processing - User Data"])
controller = UserDataController()


@router.get("/system-settings", response_model=SystemSettingsResponse)
async def get_system_settings():
    """Return the persisted system settings (settings = None when empty)."""
    return controller.get_system_settings()


@router.post("/system-settings", response_model=SystemSettingsResponse)
async def set_system_settings(request: SystemSettingsRequest):
    """Replace the system settings and broadcast the change live to the UI."""
    return controller.set_system_settings(request.settings)


@router.get("/video-extract", response_model=VideoExtractHistoryResponse)
async def get_video_extract():
    """Return the video-extract history/state (seeded on first access)."""
    return controller.get_video_extract()


@router.post("/video-extract/add", response_model=VideoExtractHistoryResponse)
async def add_video_extract(request: VideoExtractAddRequest):
    """Add (or refresh) a source; entries stack and dedupe by normalized path."""
    return controller.add_video_extract(request.path, request.mode)


@router.post("/video-extract/remove", response_model=VideoExtractHistoryResponse)
async def remove_video_extract(request: VideoExtractRemoveRequest):
    """Remove a source from the history (matched by normalized path)."""
    return controller.remove_video_extract(request.path)


@router.post("/video-extract/options", response_model=OkResponse)
async def set_options(request: VideoExtractOptionsRequest):
    """Persist the last-used extraction options."""
    return controller.set_options(request.options)


@router.post("/pick-path", response_model=PickPathResponse)
async def pick_path(request: PickPathRequest):
    """Open a native OS folder/file dialog and return the chosen absolute path."""
    return controller.pick_path(request.mode, request.initial)
