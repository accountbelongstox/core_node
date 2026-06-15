# -*- coding: utf-8 -*-
"""
Capability status router.

Endpoints (prefix /api/local/capabilities):
  GET  /status   -> capabilities_status(): CUDA/GPU readiness + free-library
                    availability (translation / TTS / OCR / STT).
  GET  /info     -> system_info(): pycore constants (FIXED IN CODE) + the static
                    directories pycore uses (read-only display).
  POST /open-dir -> open one of those static directories in the OS file manager.
                    Takes a KEY (allow-listed), never an arbitrary path.

Cheap: library checks use find_spec (no heavy import / no install) and CUDA is
the cached nvidia-smi detector. Complements the per-feature endpoints
(/api/local/ai/*, /ocr/status, /tts/status, /system/resources).
"""

import fastapi
from pydantic import BaseModel

from pycore.pyutils.common.capabilities import (
    capabilities_status,
    resolve_static_dir,
    system_info,
)
from pycore.pyutils.common.system_launcher import open_dir

router = fastapi.APIRouter(prefix="/api/local/capabilities", tags=["Local Processing - Capabilities"])


class OpenDirRequest(BaseModel):
    """Open a static directory by its registry KEY (not a free-form path)."""
    key: str


@router.get("/status")
def status():
    """CUDA/GPU readiness + free-library availability snapshot."""
    return capabilities_status()


@router.get("/info")
def info():
    """Read-only pycore constants + static directories (fixed in code)."""
    return system_info()


@router.post("/open-dir")
def open_directory(req: OpenDirRequest):
    """
    Open a known static directory in the OS file manager.

    The path is resolved from an allow-list by KEY, so this can only ever reveal
    one of pycore's own static directories — never an arbitrary path.
    """
    path = resolve_static_dir(req.key)
    if path is None:
        return {"success": False, "error": f"Unknown directory key: {req.key}"}
    if not path.exists():
        return {"success": False, "error": f"Directory does not exist yet: {path}"}
    if open_dir(path):
        return {"success": True, "message": f"Opened {path}"}
    return {"success": False, "error": f"Failed to open {path}"}
