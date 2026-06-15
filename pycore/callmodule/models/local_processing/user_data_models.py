# -*- coding: utf-8 -*-
"""
User-data models (request/response).

Back the unified user-data store (pycore/pyfoundations/user_data_store.py) over
HTTP: persistent system settings and the Video Extraction history/state. The
store persists atomically to ~/.core_node/config/user_data.json.

Sections used:
  * "system_settings" - free-form settings dict (theme, etc.), broadcast live
    to the UI on save via THREAD_BUS "system_settings_update".
  * "video_extract"   - { base_dir: str, entries: [{path, mode, added_at}],
                          last_options: dict }.
"""

from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class OkResponse(BaseModel):
    """Generic success/error acknowledgement."""
    success: bool
    error: Optional[str] = None


# --------------------------------------------------------------------------- #
# System settings                                                             #
# --------------------------------------------------------------------------- #
class SystemSettingsRequest(BaseModel):
    """Request to replace the persisted system settings."""
    settings: dict = Field(..., description="Full system settings dict to persist.")


class SystemSettingsResponse(BaseModel):
    """The persisted system settings (or None when nothing is stored yet)."""
    success: bool
    settings: Optional[dict] = Field(None, description="Stored settings dict, or None if empty.")
    error: Optional[str] = None


# --------------------------------------------------------------------------- #
# Video-extract history / state                                               #
# --------------------------------------------------------------------------- #
class VideoExtractHistoryEntry(BaseModel):
    """A single remembered video-extract source (folder or file)."""
    path: str = Field(..., description="Absolute path to a folder or video file.")
    mode: Literal["folder", "file"] = Field(..., description="'folder' (recursive) or 'file'.")
    added_at: Optional[float] = Field(None, description="Unix timestamp when last added/updated.")


class VideoExtractHistoryResponse(BaseModel):
    """The full video-extract state: base dir, stacked entries, last options."""
    success: bool
    base_dir: str = Field("", description="Default working directory for new entries.")
    entries: List[VideoExtractHistoryEntry] = Field(
        default_factory=list, description="Remembered sources (oldest first).")
    last_options: dict = Field(
        default_factory=dict, description="Last-used extraction options (non-path fields).")
    error: Optional[str] = None


class VideoExtractAddRequest(BaseModel):
    """Request to add (or refresh) a source in the history."""
    path: str = Field(..., description="Absolute path to a folder or video file.")
    mode: Literal["folder", "file"] = Field("folder", description="'folder' or 'file'.")


class VideoExtractRemoveRequest(BaseModel):
    """Request to remove a source from the history (matched by normalized path)."""
    path: str = Field(..., description="Absolute path previously added.")


class VideoExtractOptionsRequest(BaseModel):
    """Request to persist the last-used extraction options."""
    options: dict = Field(..., description="Last-used extraction options (non-path fields).")


# --------------------------------------------------------------------------- #
# Native folder/file picker                                                    #
# --------------------------------------------------------------------------- #
class PickPathRequest(BaseModel):
    """Request to open a native OS dialog and return the chosen absolute path."""
    mode: Literal["folder", "file"] = Field("folder", description="Pick a 'folder' or a 'file'.")
    initial: Optional[str] = Field(None, description="Directory to open the dialog at.")


class PickPathResponse(BaseModel):
    """Result of a native path picker (path is None when canceled/unavailable)."""
    success: bool
    path: Optional[str] = Field(None, description="Chosen absolute path, or None.")
    canceled: bool = Field(False, description="True if the user dismissed the dialog.")
    error: Optional[str] = None
