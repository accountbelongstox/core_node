# -*- coding: utf-8 -*-
"""
Task Center controller — one aggregate view over pycore's task layers.

Pycore mirrors Laravel's task-center overview data (which aggregates
its Octane-timer SCHEDULER layer + global_tasks/workers QUEUE layer). pycore
has the SAME two-layer structure:

  - SCHEDULER layer: PyHeartbeat callbacks (in-process tick scheduler), each
    annotated with its role in the translation queue flow (queue_role);
  - LOCAL TASK records: the pyctl TaskManager (voice-subtitle/local async
    tasks with pending/processing/completed/failed statuses);
  - REMOTE QUEUE view: pycore's cached perspective on Laravel's global
    translation queue (QueueMonitorService snapshot) + the translation
    worker's registration/inflight status.

RPC v2 routes:

  ui.task_center.get_task_center
      -> { scheduler, local_tasks, remote_queue, timestamp }

  ui.task_center.get_local_task_detail
      -> { success:true, task:{ task_id, task_type, status, progress,
             input_data, result, error, created_at, updated_at, ... } }

Local runtime data comes from in-process singletons. The canonical overview
service may call Laravel through pycore's server-side HTTP client; UI callers
always use the RPC v2 routes above.
"""

import time
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from pydantic import BaseModel

from pycore.pyheartbeat import get_heartbeat_system
from pycore import ColorPrint
from pycore.pyctl.desktop.task_manager import get_task_manager
from pycore.callmodule.services.queue_monitor_service import get_queue_monitor_service
from pycore.callmodule.services.translation_worker.worker import (
    get_translation_worker_service,
)
from pycore.callmodule.callmodule_config import Config
from pycore.callmodule.controllers.local_processing.task_center_assist import (
    queue_snapshot,
    tts_status,
    workers_status,
)
from pycore.callmodule.controllers.local_processing.task_history_controller import (
    get_recent_tasks,
)
from pycore.callmodule.services.assist_service import assist_config, assist_status
from pycore.callmodule.services.queue_center_contract import (
    CALLBACK_QUEUE_ROLES,
    QUEUE_CATEGORY_CATALOG,
    QUEUE_CENTER_SCHEMA_VERSION,
)
from pycore.callmodule.services.queue_center_control_service import (
    get_control_intent,
    normalize_control_name,
    record_control_intent,
)
from pycore.callmodule.services.queue_overview_service import (
    build_fast_lane,
    get_queue_overview,
)
from pycore.callmodule.services.sync.laravel_endpoint_manager import (
    get_laravel_endpoint_manager,
)
from pycore.callmodule.services.sentence_audio_auto import (
    apply_auto_start as apply_sentence_auto_start,
    get_status as sentence_audio_status,
)
from pycore.callmodule.services.word_tts_auto import (
    apply_auto_start as apply_word_auto_start,
    get_status as word_tts_status,
)
from pycore.callmodule.controllers.local_processing.task_center_sections import (
    build_section_contracts as _build_section_contracts,
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
    requested_by: Optional[str] = None
    reason: Optional[str] = None
    graceful_stop: bool = False


def _to_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        v = value.strip().lower()
        return v in {"1", "true", "yes", "on"}
    return default


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


def _remote_queue_section(
    monitor_snapshot: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    pycore's view of Laravel's global translation queue: the cached monitor
    snapshot (NO forced refresh — no network I/O here) + a worker-status
    subset (worker_id / registered / inflight_tasks / done_words_cached) and the
    fast-lane signals block.

    If ``monitor_snapshot`` is provided (pre-computed by the caller to avoid a
    duplicate serialized RPC) it is used directly; otherwise the monitor is
    queried once here.
    """
    snapshot = monitor_snapshot if monitor_snapshot is not None else _monitor().get_snapshot(refresh=False)
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
            "api_url": worker_status.get("api_url"),
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
    request_id: str = "",
) -> Any:
    """Capture one snapshot slice without losing the remaining control plane."""
    start_time = time.monotonic()
    try:
        result = factory()
        elapsed_ms = int((time.monotonic() - start_time) * 1000)
        
        # Log slice timing and source
        source = "unknown"
        cache_age_ms = None
        laravel_url = None
        http_status = None
        result_status = "success"
        
        if isinstance(result, dict):
            source = result.get("source", "local")
            cache_age_ms = result.get("age_ms")
            if "laravel_endpoint" in result:
                laravel_url = result["laravel_endpoint"]
            if "http_status" in result:
                http_status = result["http_status"]
            if "success" in result and not result["success"]:
                result_status = "failed"
                if "error" in result:
                    errors[name] = result["error"]
                
        ColorPrint.cyan(
            f"[QueueCenter] Slice '{name}' completed in {elapsed_ms}ms "
            f"(request_id: {request_id}, source: {source}, status: {result_status}, "
            f"cache_age_ms: {cache_age_ms}, laravel_url: {laravel_url}, http_status: {http_status})"
        )
        
        return result
    except Exception as exc:  # noqa: BLE001
        elapsed_ms = int((time.monotonic() - start_time) * 1000)
        errors[name] = str(exc)
        ColorPrint.red(f"[QueueCenter] Slice '{name}' failed in {elapsed_ms}ms (request_id: {request_id}): {exc}")
        return None


def _control_state(
    assist: Optional[Dict[str, Any]],
    workers: Optional[Dict[str, Any]],
    word_audio: Optional[Dict[str, Any]],
    sentence_audio: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """Return only canonical controls from config/queue_center_contract.json."""
    assist = assist or {}
    workers = workers or {}
    translation_intent = get_control_intent("assist_translation")
    word_audio_intent = get_control_intent("word_audio")
    sentence_intent = get_control_intent("sentence_audio")
    callbacks = {
        row.get("name"): bool(row.get("enabled"))
        for row in workers.get("callbacks", [])
        if isinstance(row, dict) and row.get("name")
    }
    capabilities = assist.get("capabilities") or {}
    master = bool(assist.get("enabled"))
    word_audio_configured = master and bool(capabilities.get("tts", True))
    sentence_audio_configured = master and bool(capabilities.get("sentence_audio", True))
    translation_configured = master and (
        bool(capabilities.get("translation", True))
        or bool(capabilities.get("ai_translate", True))
    )
    return {
        "assist_translation": {
            "configured": translation_configured,
            "running": translation_configured
            and bool(callbacks.get("translation_worker")),
            "owner": "pycore.assist_service",
            "requested_by": translation_intent.get("requested_by") or "system",
            "requested": translation_intent.get("requested") if isinstance(translation_intent.get("requested"), bool) else None,
            "reason": translation_intent.get("reason"),
            "graceful_stop": _to_bool(translation_intent.get("graceful_stop")),
        },
        "word_audio": {
            "configured": word_audio_configured,
            "requested": word_audio_intent.get("requested") if isinstance(word_audio_intent.get("requested"), bool) else None,
            "running": word_audio_configured
            and bool((word_audio or {}).get("heartbeat_enabled")),
            "owner": "pycore.word_tts_auto",
            "requested_by": word_audio_intent.get("requested_by") or "system",
            "reason": word_audio_intent.get("reason"),
            "graceful_stop": _to_bool(word_audio_intent.get("graceful_stop")),
        },
        "sentence_audio": {
            "configured": sentence_audio_configured,
            "requested": sentence_intent.get("requested") if isinstance(sentence_intent.get("requested"), bool) else None,
            "running": sentence_audio_configured
            and bool((sentence_audio or {}).get("heartbeat_enabled")),
            "owner": "pycore.sentence_audio_auto",
            "requested_by": sentence_intent.get("requested_by") or "system",
            "reason": sentence_intent.get("reason"),
            "graceful_stop": _to_bool(sentence_intent.get("graceful_stop")),
        },
    }


# -------------------- routes --------------------

def get_task_center():
    """
    Return the unified task-center aggregate (one poll for the whole page):
    scheduler (PyHeartbeat + queue-role annotations), local_tasks (pyctl
    TaskManager recent + counts), and remote_queue (cached Laravel queue
    snapshot + worker status). Symmetric with laravel_main's
    Laravel task-center overview.
    """
    return {
        "scheduler": _scheduler_section(),
        "local_tasks": _local_tasks_section(),
        "remote_queue": _remote_queue_section(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def get_queue_center_snapshot():
    """Return one versioned Queue Center snapshot for every page section.

    All panels receive the same generation timestamp, endpoint selection and
    per-slice error map. Laravel-backed services use their shared cached
    monitors; only the overview performs its existing TTL-bounded refresh.

    Every sub-call is wrapped in _capture_slice so a single failing service
    never kills the whole RPC. The monitor snapshot is computed ONCE and
    reused across the remote_queue section and the translation slice to avoid
    a redundant serialized RPC round-trip.
    """
    request_id = str(int(time.time() * 1000))
    errors: Dict[str, str] = {}
    # --- Compute the monitor snapshot ONCE so remote_queue and translation
    # slices share the same result instead of each issuing a serialized call.
    translation = _capture_slice(
        "translation", lambda: _monitor().get_snapshot(refresh=False), errors, request_id
    )
    # Scheduler and local_tasks are wrapped to prevent their failures from
    # propagating to the calling thread and aborting the entire RPC.
    scheduler = _capture_slice("scheduler", _scheduler_section, errors, request_id)
    local_tasks = _capture_slice("local_tasks", _local_tasks_section, errors, request_id)
    remote_queue = _capture_slice(
        "remote_queue", lambda: _remote_queue_section(translation), errors, request_id
    )
    task_center: Dict[str, Any] = {
        "scheduler": scheduler or {},
        "local_tasks": local_tasks or {},
        "remote_queue": remote_queue or {},
    }
    word_audio = _capture_slice("word_audio", word_tts_status, errors, request_id)
    sentence_audio = _capture_slice("sentence_audio", sentence_audio_status, errors, request_id)
    workers = _capture_slice("workers", workers_status, errors, request_id)
    assist = _capture_slice(
        "assist", lambda: assist_status(include_laravel=False), errors, request_id
    )
    overview = _capture_slice("overview", get_queue_overview, errors, request_id)
    sentence_queue = _capture_slice("sentence_queue", queue_snapshot, errors, request_id)
    tts = _capture_slice("tts", lambda: tts_status(refresh=0), errors, request_id)
    recent = _capture_slice(
        "recent",
        lambda: get_recent_tasks(limit=_SNAPSHOT_HISTORY_LIMIT),
        errors,
        request_id
    )
    generated_at = datetime.now(timezone.utc).isoformat()
    task_center["timestamp"] = generated_at
    remote = task_center["remote_queue"]
    controls = _control_state(assist, workers, word_audio, sentence_audio)
    section_contracts = _build_section_contracts(
        controls=controls,
        errors=errors,
        generated_at=generated_at,
        overview=overview,
        task_center_snapshot=task_center,
    )

    return {
        "success": not errors,
        "schema_version": QUEUE_CENTER_SCHEMA_VERSION,
        "generated_at": generated_at,
        "source": {
            "pycore_reachable": True,
            "laravel_reachable": bool((remote or {}).get("laravel_reachable"))
            or bool((overview or {}).get("laravel_reachable")),
            "laravel_stored_endpoint": (remote or {}).get("laravel_endpoint"),
            "laravel_active_endpoint": (remote or {}).get("laravel_active_endpoint"),
            "laravel_snapshot_age_s": (remote or {}).get("laravel_snapshot_age_s"),
        },
        "controls": controls,
        "section_contracts": section_contracts,
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


def set_queue_center_control(control_name: str, req: QueueCenterControlRequest):
    """Apply one named, persistent Queue Center control and return fresh state."""
    enabled = bool(req.enabled)
    canonical_name = normalize_control_name(control_name)
    requested_by = (
        req.requested_by.strip()
        if isinstance(req.requested_by, str) and req.requested_by.strip()
        else "user"
    )
    record_control_intent(
        canonical_name,
        enabled,
        requested_by=requested_by,
        reason=req.reason,
        graceful_stop=req.graceful_stop,
    )
    errors: List[str] = []
    result: Dict[str, Any] = {}

    if canonical_name == "assist_translation":
        result = assist_config({
            "enabled": True if enabled else None,
            "capabilities": {"translation": enabled, "ai_translate": enabled},
        })
    elif canonical_name == "word_audio":
        assist_result = assist_config({
            "enabled": True if enabled else None,
            "capabilities": {"tts": enabled},
        })
        status = apply_word_auto_start(enabled)
        result = {"ok": True, "status": status, "assist": assist_result}
        if isinstance(assist_result, dict):
            if assist_result.get("success") is False:
                errors.extend(list(assist_result.get("errors") or []))
                if assist_result.get("error") and assist_result.get("error") not in errors:
                    errors.append(str(assist_result["error"]))
        if isinstance(status, dict) and status.get("error"):
            errors.append(str(status["error"]))
            result["ok"] = False
    elif canonical_name == "sentence_audio":
        assist_result = assist_config({
            "enabled": True if enabled else None,
            "capabilities": {"sentence_audio": enabled},
        })
        status = apply_sentence_auto_start(enabled)
        result = {"ok": True, "status": status, "assist": assist_result}
        if isinstance(assist_result, dict):
            if assist_result.get("success") is False:
                errors.extend(list(assist_result.get("errors") or []))
                if assist_result.get("error") and assist_result.get("error") not in errors:
                    errors.append(str(assist_result["error"]))
        if isinstance(status, dict) and status.get("error"):
            errors.append(str(status["error"]))
            result["ok"] = False

    if canonical_name == "assist_translation":
        if isinstance(result, dict):
            if result.get("success") is False:
                errors.extend(list(result.get("errors") or []))
                if result.get("error") and result.get("error") not in errors:
                    errors.append(str(result["error"]))

    success = not errors
    payload: Dict[str, Any] = {
        "success": success,
        "control": canonical_name,
        "enabled": enabled,
        "requested_by": requested_by,
        "graceful_stop": req.graceful_stop,
        "result": result,
    }
    if errors:
        payload["error"] = "; ".join(errors)
        payload["errors"] = errors
    return payload


def get_local_task_detail(task_id: str):
    """
    Return one pyctl TaskManager record (full input_data / result / error).

    Symmetric with laravel_main GET /api/task/{taskId}/status — the pycore
    Queue Center UI uses this for the Task Queue tab detail modal.
    """
    task = get_task_manager().get_task(task_id)
    if not task:
        raise ValueError(f"Task not found: {task_id}")
    return {"success": True, "task": task.to_dict()}


def get_remote_task_detail(task_id: str):
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
