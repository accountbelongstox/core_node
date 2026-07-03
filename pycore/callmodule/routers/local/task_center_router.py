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

# ----------------------------------------------------------------------------
# Unified-queue category catalog — the canonical list of task types the queue
# overview surfaces so it is NEVER "blind" to a lane that exists in Laravel's
# GlobalTask vocabulary. Each row is {key,label,handler}: `key` is the Laravel
# task_type, `label` is the FE-friendly name, `handler` names who actually
# processes the work ('chrome' = the MCP browser host, 'pycore' = this node's
# local engines, 'ai' = a remote/internal AI worker, 'any' = whichever worker
# advertises the matching capability claims it — fast lane).
#
# Mirrors the FE pycore-manager Task Center (PcQueueCategory {key,label,handler}
# in pycoreTypes.ts). Count keys are per-category numeric and INDEPENDENT of the
# catalog keys (a category may report zeros). Keep `_COUNT_KEYS` in sync with
# the FE PcQueueCategory numeric fields (pending/processing/leased/total).
_CATEGORY_CATALOG: List[Dict[str, str]] = [
    {"key": "word_translation", "label": "Word Translation", "handler": "any"},
    {"key": "ai_translate", "label": "AI Translate", "handler": "any"},
    {"key": "word_media", "label": "Word Media", "handler": "chrome"},
    {"key": "word_audio", "label": "Word Audio", "handler": "pycore"},
    {"key": "sentence_audio", "label": "Sentence Audio", "handler": "pycore"},
    {"key": "subtitle_search", "label": "Subtitle Search", "handler": "pycore"},
    {"key": "poster", "label": "Poster", "handler": "pycore"},
    {"key": "gemini_image", "label": "Gemini Image", "handler": "chrome"},
    {"key": "notebooklm", "label": "NotebookLM", "handler": "chrome"},
    {"key": "gemini_chat", "label": "Gemini Chat", "handler": "chrome"},
]

# Per-category numeric fields the overview emits for every catalog row (zeros
# when nothing is queued). MUST stay in lockstep with the FE PcQueueCategory
# numeric members — adding a count here means adding it on the FE too.
_COUNT_KEYS = ("pending", "processing", "leased", "total")


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


def _fast_lane_block() -> Dict[str, Any]:
    """
    Surface the worker's fast-lane signals for the Task Center's "fast lane"
    card: the worker's advertised capabilities/processor_types plus the live
    fast/urgent backlog and priority-heap depth it last observed from Laravel's
    pull/heartbeat responses.

    Sourced from the worker's ``get_queue_status()`` (added by the pycore-worker
    leg). That method may not exist on the recovered baseline yet — reference it
    DEFENSIVELY: degrade to ``{}`` on absence/error so the Task Center never 500s
    just because the worker upgrade has not landed. Field names mirror the worker
    contract (capabilities / processor_types / queue_depth / pending_fast /
    pending_urgent) consumed by the FE pycore-manager Task Center.
    """
    worker = _worker()
    raw: Dict[str, Any] = {}
    getter = getattr(worker, "get_queue_status", None)
    if callable(getter):
        try:
            result = getter()
            if isinstance(result, dict):
                raw = result
        except Exception:
            raw = {}

    # Best-effort fall-backs from the always-present get_status() so the block
    # is still meaningful before the worker's get_queue_status() lands.
    status = worker.get_status()

    return {
        "capabilities": raw.get("capabilities", status.get("capabilities", [])),
        "processor_types": raw.get(
            "processor_types", status.get("processor_types", [])
        ),
        "queue_depth": raw.get("queue_depth", status.get("inflight_tasks", 0)),
        "pending_fast": raw.get("pending_fast", 0),
        "pending_urgent": raw.get("pending_urgent", 0),
        "registered": raw.get("registered", status.get("registered", False)),
    }


def _remote_queue_section() -> Dict[str, Any]:
    """
    pycore's view of Laravel's global translation queue: the cached monitor
    snapshot (NO forced refresh — no network I/O here) + a worker-status
    subset (worker_id / registered / inflight_tasks / done_words_cached) and the
    fast-lane signals block.
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
        # Catalog of every task type the queue overview is aware of (so the UI
        # is not blind to ai_translate / subtitle_search / poster / …).
        "categories": list(_CATEGORY_CATALOG),
        # Fast-lane signals (capabilities / processor_types / pending_fast / …).
        "fast_lane": _fast_lane_block(),
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


@router.get("/tasks/{task_id}/detail")
async def get_remote_task_detail(task_id: str):
    """
    Proxy Laravel GET /api/task/{taskId}/detail — the RICHER detail bundle
    (task + events + phase) the FE TaskDetailModal drilldown consumes, distinct
    from the leaner /status proxy in translation_queue_router.

    Forwards to the worker's live Laravel base URL via the shared
    QueueMonitorService (which owns the third-party `requests` access and the
    base-URL discovery). Returns a uniform envelope:
        { success:bool, task:<dict>?, error:str?, laravel_reachable:bool }

    The monitor exposes a generic detail proxy when present; older monitors only
    expose the /status proxy (get_task_detail). Reference the richer hook
    defensively and fall back so the endpoint never 500s on an un-upgraded
    monitor.
    """
    monitor = _monitor()
    detail_getter = getattr(monitor, "get_task_full_detail", None)
    if callable(detail_getter):
        try:
            return detail_getter(task_id)
        except Exception:
            pass
    # Fallback: the /status proxy still yields the global_tasks row, which the
    # FE can render even without the events/phase bundle.
    return monitor.get_task_detail(task_id)
