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
from typing import Any, Callable, Dict, List, Optional

import fastapi
from pydantic import BaseModel

from pycore.pyheartbeat import get_heartbeat_system
from pycore.pyctl.desktop.task_manager import get_task_manager
from pycore.callmodule.services.sync.laravel_endpoint_manager import (
    get_laravel_endpoint_manager,
)
from pycore.callmodule.services import (
    get_queue_monitor_service,
    get_translation_worker_service,
)
from pycore.callmodule.callmodule_config import Config
from pycore.callmodule.routers.local.assist_router import (
    ConfigRequest,
    assist_config,
    assist_status,
)
from pycore.callmodule.routers.local.heartbeat_workers_router import status as workers_status
from pycore.callmodule.routers.local.queue_overview_router import get_queue_overview
from pycore.callmodule.routers.local.sentence_audio_router import queue_snapshot
from pycore.callmodule.routers.local.task_history_router import get_recent_tasks
from pycore.callmodule.routers.local.tts_status_router import status as tts_status
from pycore.callmodule.services.queue_center_contract import (
    CALLBACK_QUEUE_ROLES,
    QUEUE_CATEGORY_CATALOG,
    build_fast_lane,
)
from pycore.callmodule.services.sentence_audio_auto import (
    apply_auto_start as apply_sentence_auto_start,
    get_status as sentence_audio_status,
)
from pycore.callmodule.services.word_tts_auto import (
    apply_auto_start as apply_word_auto_start,
    get_status as word_tts_status,
)

router = fastapi.APIRouter(
    prefix="/api/local/task-center",
    tags=["Local Processing - Task Center"],
)

# How each heartbeat callback relates to Laravel's translation queue flow.
# Callbacks absent from this map are pure scheduled jobs with no queue role
# (queue_role = None). Mirrors laravel_main TaskCenterController's
# TIMER_QUEUE_ROLES (its scheduler→queue relationship metadata).
# Local TaskManager status vocabulary (Task statuses in pyctl task_manager).
_LOCAL_TASK_STATUSES = ("pending", "processing", "completed", "failed")

# How many recent local task records the aggregate includes.
_RECENT_TASK_LIMIT = 20
_SNAPSHOT_HISTORY_LIMIT = 200


class QueueCenterControlRequest(BaseModel):
    enabled: bool

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
            "queue_role": CALLBACK_QUEUE_ROLES.get(name),
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
    subset (worker_id / registered / inflight_tasks / done_words_cached) and the
    fast-lane signals block.
    """
    snapshot = _monitor().get_snapshot(refresh=False)
    worker_status = _worker().get_status()
    # Snapshot age in seconds, derived from the monitor's age_ms (the queue
    # monitor exposes age_ms; sentence_queue_monitor exposes snapshot_age_s) so
    # the hub can judge staleness without triangulating timestamps.
    age_ms = snapshot.get("age_ms")
    snapshot_age_s = round(age_ms / 1000.0, 1) if isinstance(age_ms, (int, float)) else None

    return {
        "laravel_reachable": snapshot.get("laravel_reachable", False),
        "laravel_endpoint": get_laravel_endpoint_manager().peek_stored_base_url(),
        "laravel_active_endpoint": get_laravel_endpoint_manager().get_active_base_url(),
        "laravel_snapshot_age_s": snapshot_age_s,
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
        "categories": list(QUEUE_CATEGORY_CATALOG),
        # Fast-lane signals (capabilities / processor_types / pending_fast / …).
        "fast_lane": build_fast_lane(),
    }


def _capture_slice(
    name: str,
    factory: Callable[[], Any],
    errors: Dict[str, str],
) -> Any:
    """Capture one snapshot slice without losing the remaining control plane."""
    try:
        return factory()
    except Exception as exc:  # noqa: BLE001
        errors[name] = str(exc)
        return None


def _control_state(
    assist: Optional[Dict[str, Any]],
    workers: Optional[Dict[str, Any]],
    word_audio: Optional[Dict[str, Any]],
    sentence_audio: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """Expose configured intent separately from effective callback state."""
    assist = assist or {}
    workers = workers or {}
    callbacks = {
        row.get("name"): bool(row.get("enabled"))
        for row in workers.get("callbacks", [])
        if isinstance(row, dict) and row.get("name")
    }
    capabilities = assist.get("capabilities") or {}
    master = bool(assist.get("enabled"))
    return {
        "assist": {
            "configured": master,
            "running": bool(assist.get("running")),
            "owner": "assist",
        },
        "translation": {
            "configured": master and bool(capabilities.get("translation", True)),
            "running": bool(callbacks.get("translation_worker")),
            "owner": "pycore.google_translation_worker",
        },
        "word_audio": {
            "configured": bool((word_audio or {}).get("auto_start")),
            "running": bool((word_audio or {}).get("heartbeat_enabled")),
            "owner": "pycore.word_tts_auto",
        },
        "sentence_audio": {
            "configured": bool((sentence_audio or {}).get("auto_start")),
            "running": bool((sentence_audio or {}).get("heartbeat_enabled")),
            "owner": "pycore.sentence_audio_auto",
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


@router.get("/snapshot")
def get_queue_center_snapshot():
    """Return one versioned Queue Center snapshot for every page section.

    All panels receive the same generation timestamp, endpoint selection and
    per-slice error map. Laravel-backed services use their shared cached
    monitors; only the overview performs its existing TTL-bounded refresh.
    """
    errors: Dict[str, str] = {}
    task_center = {
        "scheduler": _scheduler_section(),
        "local_tasks": _local_tasks_section(),
        "remote_queue": _remote_queue_section(),
    }
    translation = _capture_slice(
        "translation", lambda: _monitor().get_snapshot(refresh=False), errors
    )
    word_audio = _capture_slice("word_audio", word_tts_status, errors)
    sentence_audio = _capture_slice("sentence_audio", sentence_audio_status, errors)
    workers = _capture_slice("workers", workers_status, errors)
    assist = _capture_slice(
        "assist", lambda: assist_status(include_laravel=False), errors
    )
    overview = _capture_slice("overview", get_queue_overview, errors)
    sentence_queue = _capture_slice("sentence_queue", queue_snapshot, errors)
    tts = _capture_slice("tts", lambda: tts_status(refresh=0), errors)
    recent = _capture_slice(
        "recent",
        lambda: get_recent_tasks(limit=_SNAPSHOT_HISTORY_LIMIT),
        errors,
    )
    generated_at = datetime.now(timezone.utc).isoformat()
    task_center["timestamp"] = generated_at
    remote = task_center["remote_queue"]

    return {
        "success": not errors,
        "schema_version": 1,
        "generated_at": generated_at,
        "source": {
            "pycore_reachable": True,
            "laravel_reachable": bool(remote.get("laravel_reachable")),
            "laravel_stored_endpoint": remote.get("laravel_endpoint"),
            "laravel_active_endpoint": remote.get("laravel_active_endpoint"),
            "laravel_snapshot_age_s": remote.get("laravel_snapshot_age_s"),
        },
        "controls": _control_state(assist, workers, word_audio, sentence_audio),
        "data": {
            "task_center": task_center,
            "translation": translation,
            "word_audio": word_audio,
            "sentence_audio": sentence_audio,
            "workers": workers,
            "assist": assist,
            "tts": tts,
            "overview": overview,
            "sentence_queue": sentence_queue,
            "recent": recent,
        },
        "errors": errors,
    }


@router.post("/controls/{control_name}")
def set_queue_center_control(control_name: str, req: QueueCenterControlRequest):
    """Apply one named, persistent Queue Center control and return fresh state."""
    enabled = bool(req.enabled)
    if control_name == "assist":
        result = assist_config(ConfigRequest(enabled=enabled))
    elif control_name == "translation":
        result = assist_config(ConfigRequest(
            enabled=True if enabled else None,
            # Both translation lanes share one heartbeat worker. Keep their
            # persisted intent aligned so OFF actually stops that worker and
            # ON enables the Google-first lane plus its configured fallback.
            capabilities={"translation": enabled, "ai_translate": enabled},
        ))
    elif control_name == "word_audio":
        assist_config(ConfigRequest(
            enabled=True if enabled else None,
            capabilities={"tts": enabled},
        ))
        result = {"ok": True, "status": apply_word_auto_start(enabled)}
    elif control_name == "sentence_audio":
        assist_config(ConfigRequest(
            enabled=True if enabled else None,
            capabilities={"sentence_audio": enabled},
        ))
        result = {"ok": True, "status": apply_sentence_auto_start(enabled)}
    else:
        raise fastapi.HTTPException(
            status_code=404, detail=f"Unknown Queue Center control: {control_name}"
        )

    return {"success": True, "control": control_name, "enabled": enabled, "result": result}


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
    return monitor.get_task_full_detail(task_id)
