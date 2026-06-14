# -*- coding: utf-8 -*-
"""
System resources router.

Exposes a lightweight live CPU / memory / GPU snapshot for the desktop UI's
resource meters (e.g. on the Video Extract screen).

Endpoint (prefix /api/local/system):
  GET /resources -> {success, cpu_percent, mem{used_mb,total_mb,percent}, gpus[]}
"""

import fastapi

from ...controllers.local_processing import VideoExtractController

router = fastapi.APIRouter(prefix="/api/local/system", tags=["Local Processing - System"])
controller = VideoExtractController()


@router.get("/resources")
async def system_resources():
    """CPU%, memory, and best-effort per-GPU utilization/memory."""
    return controller.system_resources()
