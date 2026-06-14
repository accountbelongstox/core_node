# -*- coding: utf-8 -*-
"""
Task Center router — ONE aggregate view over pycore's task layers.

pycore mirrors laravel_main's GET /api/task-center/overview (which aggregates
its Octane-timer SCHEDULER layer + global_tasks/workers QUEUE layer). pycore
has the SAME two-layer structure:

  - SCHEDULER layer: PyHeartbeat callbacks (in-process tick scheduler), each
    annotated with its role in the translation queue flow (queue_role);
  - LOCAL TASK records: the pyctl TaskManager (voice-subtitle/local async
    tasks with pending/processing/completed/failed statuses);
  - REMOTE QUEUE view: pycore's cached perspective on Laravel's global
    translation queue (QueueMonitorService snapshot) + the translation
    worker's registration/inflight status.

Endpoint (prefix /api/local/task-center):

  GET /api/local/task-center
      -> { scheduler, local_tasks, remote_queue, timestamp }

  GET /api/local/task-center/tasks/{task_id}
      -> { success:true, task:{ task_id, task_type, status, progress,
             input_data, result, error, created_at, updated_at, ... } }

All data comes from in-process singletons (heartbeat system, TaskManager,
QueueMonitorService cached snapshot, TranslationWorkerService status) — this
router does NO network I/O. Detail/control endpoints stay where they are
(/api/heartbeat/*, /voice-subtitle/*, /api/local/translation/queue/*) — this
is the composition layer, not a replacement.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import fastapi

from pycore.pyheartbeat import get_heartbeat_system
from pycore.pyctl.desktop.task_manager import get_task_manager
from pycore.callmodule.services import (
    get_queue_monitor_service,
    get_translation_worker_service,
)
from pycore.callmodule.callmodule_config import Config

router = fastapi.APIRouter(
    prefix="/api/local/task-center",
    tags=["Local Processing - Task Center"],
)

# How each heartbeat callback relates to Laravel's translation queue flow.
# Callbacks absent from this map are pure scheduled jobs with no queue role
# (queue_role = None). Mirrors laravel_main TaskCenterController's
# TIMER_QUEUE_ROLES (its scheduler→queue relationship metadata).
_CALLBACK_QUEUE_ROLES: Dict[str, str] = {
    "translation_worker": "consumer",         # pulls + translates queue tasks
    "translation_queue_monitor": "monitor",   # polls/caches the queue snapshot
    "translation_ws_client": "signal",        # real-time Reverb push supervisor
    "tts_queue_poller": "consumer",           # pulls TTS queue tasks
}

# Local TaskManager status vocabulary (Task statuses in pyctl task_manager).
_LOCAL_TASK_STATUSES = ("pending", "processing", "completed", "failed")

# How many recent local task records the aggregate includes.
_RECENT_TASK_LIMIT = 20


def _monitor():
    """Resolve the QueueMonitorService singleton (shares the worker's base URL)."""
    return get_queue_monitor_service(
        laravel_api_url=Config.LARAVEL_WORKER_API_URL,
        bump_ttl_seconds=Config.TRANSLATION_QUEUE_BUMP_TTL_SECONDS,
    )


def _worker():
    """Resolve the TranslationWorkerService singleton (same base URL source)."""
    return get_translation_worker_service(
        laravel_api_url=Config.LARAVEL_WORKER_API_URL,
    )


# -------------------- section builders --------------------

def _scheduler_section() -> Dict[str, Any]:
    """
    PyHeartbeat = pycore's scheduler layer (mirrors laravel_main's Octane
    timer section). Heartbeat counters + per-callback stats annotated with
    each callback's queue_role.
    """
    stats = get_heartbeat_system().get_stats()
    heartbeat_stats: Dict[str, Any] = stats.get("heartbeat", {}) or {}
    raw_callbacks: Dict[str, Any] = heartbeat_stats.get("callbacks", {}) or {}

    callbacks: List[Dict[str, Any]] = []
    for name, info in raw_callbacks.items():
        callbacks.append({
            "name": name,
            "enabled": info.get("enabled", False),
            "interval": info.get("interval", 0),
            "run_count": info.get("run_count", 0),
            "queue_role": _CALLBACK_QUEUE_ROLES.get(name),
        })

    # Heartbeat counters (total_ticks, uptime, running, ...) without the raw
    # callbacks dict — those are surfaced as the annotated list above.
    heartbeat = {k: v for k, v in heartbeat_stats.items() if k != "callbacks"}

    return {"heartbeat": heartbeat, "callbacks": callbacks}


def _local_tasks_section() -> Dict[str, Any]:
    """
    pyctl TaskManager = local task records: the most recent task dicts plus
    status counts computed over the full retained history.
    """
    manager = get_task_manager()
    all_tasks = manager.get_all_tasks()

    counts: Dict[str, int] = {status: 0 for status in _LOCAL_TASK_STATUSES}
    for task in all_tasks:
        status = task.get("status")
        if status in counts:
            counts[status] += 1

    return {
        "recent": manager.get_recent_tasks(limit=_RECENT_TASK_LIMIT),
        "counts": counts,
    }


def _remote_queue_section() -> Dict[str, Any]:
    """
    pycore's view of Laravel's global translation queue: the cached monitor
    snapshot (NO forced refresh — no network I/O here) + a worker-status
    subset (worker_id / registered / inflight_tasks / done_words_cached).
    """
    snapshot = _monitor().get_snapshot(refresh=False)
    worker_status = _worker().get_status()

    return {
        "laravel_reachable": snapshot.get("laravel_reachable", False),
        "ws_connected": snapshot.get("ws_connected", False),
        "summary": snapshot.get("summary", {}),
        "age_ms": snapshot.get("age_ms"),
        "worker": {
            "worker_id": worker_status.get("worker_id"),
            "registered": worker_status.get("registered", False),
            "inflight_tasks": worker_status.get("inflight_tasks", 0),
            "done_words_cached": worker_status.get("done_words_cached", 0),
        },
    }


# -------------------- routes --------------------

@router.get("")
async def get_task_center():
    """
    Return the unified task-center aggregate (one poll for the whole page):
    scheduler (PyHeartbeat + queue-role annotations), local_tasks (pyctl
    TaskManager recent + counts), and remote_queue (cached Laravel queue
    snapshot + worker status). Symmetric with laravel_main's
    GET /api/task-center/overview.
    """
    return {
        "scheduler": _scheduler_section(),
        "local_tasks": _local_tasks_section(),
        "remote_queue": _remote_queue_section(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/tasks/{task_id}")
async def get_local_task_detail(task_id: str):
    """
    Return one pyctl TaskManager record (full input_data / result / error).

    Symmetric with laravel_main GET /api/task/{taskId}/status — the pycore
    Queue Center UI uses this for the Task Queue tab detail modal.
    """
    task = get_task_manager().get_task(task_id)
    if not task:
        raise fastapi.HTTPException(status_code=404, detail=f"Task not found: {task_id}")
    return {"success": True, "task": task.to_dict()}
