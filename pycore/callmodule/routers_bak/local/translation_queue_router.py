# -*- coding: utf-8 -*-
"""
Translation Queue router (monitor + control proxy).

Endpoints (prefix /api/local/translation/queue) backing the pycore UI's view of
Laravel's translation queue:

  GET  /api/local/translation/queue[?refresh=1]
       -> the cached queue snapshot:
          { summary:{pending,processing,completed,failed,total},
            items:[ { task_id, words, word_count, language, target_language,
                      priority, status, created_at, age_seconds, assigned_to,
                      recently_bumped:bool } ],
            laravel_reachable:bool, age_ms:float }
       The snapshot is maintained by the QueueMonitorService heartbeat callback
       (~5s); ?refresh=1 forces a fresh poll before returning.

  POST /api/local/translation/queue/priority  { task_id, priority }
       -> proxy to Laravel .../queue/priority; returns its result envelope.

  POST /api/local/translation/queue/stack
       { words, language, target_language, priority? }
       -> proxy to Laravel .../queue/stack; returns its result envelope.

  GET  /api/local/translation/queue/tasks/{task_id}
       -> proxy Laravel GET /api/task/{taskId}/status (full global_tasks detail).

All work is delegated to the QueueMonitorService singleton, which owns the shared
Laravel base-URL discovery (reused from the translation worker) and the third-party
`requests` access. This router does no networking itself.
"""

from typing import Any, List, Optional, Union

import fastapi
from pydantic import BaseModel, Field

from pycore.callmodule.services import (
    get_queue_monitor_service,
    get_translation_worker_service,
)
from pycore.callmodule.callmodule_config import Config
from pycore.pyheartbeat import get_heartbeat_system

router = fastapi.APIRouter(
    prefix="/api/local/translation/queue",
    tags=["Local Processing - Translation Queue"],
)


def _monitor():
    """Resolve the QueueMonitorService singleton (shares the worker's base URL)."""
    return get_queue_monitor_service(
        laravel_api_url=Config.LARAVEL_WORKER_API_URL,
        bump_ttl_seconds=Config.TRANSLATION_QUEUE_BUMP_TTL_SECONDS,
    )


# -------------------- request models --------------------

class QueuePriorityRequest(BaseModel):
    """Body for POST .../queue/priority — bump (or set) a task's priority."""
    task_id: Union[str, int] = Field(..., description="Laravel queue task id.")
    priority: int = Field(..., description="New priority (higher = processed sooner).")


class QueueStackRequest(BaseModel):
    """Body for POST .../queue/stack — enqueue a new translation request."""
    words: List[str] = Field(..., description="Words/phrases to translate.")
    language: str = Field(..., description="Source language code (e.g. 'en').")
    target_language: str = Field(..., description="Target language code (e.g. 'zh').")
    priority: Optional[int] = Field(None, description="Optional initial priority.")


# -------------------- routes --------------------

@router.get("")
async def get_queue(refresh: int = 0):
    """
    Return the cached translation-queue snapshot (with `recently_bumped` flags,
    `laravel_reachable`, and `age_ms`). Pass ?refresh=1 to force a fresh poll.
    """
    return _monitor().get_snapshot(refresh=bool(refresh))


@router.post("/priority")
async def set_priority(request: QueuePriorityRequest):
    """Proxy a priority bump/set to Laravel; returns its result envelope."""
    return _monitor().set_priority(request.task_id, request.priority)


@router.post("/stack")
async def stack(request: QueueStackRequest):
    """Proxy a new translation request (stack) to Laravel; returns its result."""
    result = _monitor().stack(
        words=request.words,
        language=request.language,
        target_language=request.target_language,
        priority=request.priority,
    )
    if (
        result.get("success") is not False
        and get_heartbeat_system().is_callback_enabled("translation_worker")
    ):
        get_translation_worker_service().poll_once()
    return result


@router.get("/tasks/{task_id}")
async def get_task_detail(task_id: str):
    """
    Proxy Laravel GET /api/task/{taskId}/status — full global_tasks detail
    (payload, result, error, lifecycle timestamps) for the Translation Queue tab.
    """
    return _monitor().get_task_detail(task_id)
