# -*- coding: utf-8 -*-
"""
Queue bump events router — cross-lane priority increase notifications.

GET /api/local/queue/bumps — recent bumps from translation, sentence_audio, etc.
"""

import fastapi

from pycore.callmodule.services.queue_bump_hub import get_queue_bump_hub

router = fastapi.APIRouter(prefix="/api/local/queue", tags=["Local Processing - Queue"])


@router.get("/bumps")
def list_bumps(limit: int = 30):
    hub = get_queue_bump_hub()
    snap = hub.snapshot(limit=max(1, min(limit, 60)))
    return {"success": True, **snap}
