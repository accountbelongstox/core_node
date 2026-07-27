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
from pycore.callmodule.services.queue_monitor_service import get_queue_monitor_service
from pycore.callmodule.services.translation_worker.worker import (
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
_CONTROL_SCOPE_BY_NAME = {
    "assist": "assist_translation",
    "translation": "assist_translation",
    "assist_translation": "assist_translation",
    "word_audio": "word_audio",
    "sentence_audio": "sentence_audio",
}

_CONTROL_INTENTS: Dict[str, Dict[str, Any]] = {}
_SECTION_SCOPE_ORDER = (
    "heartbeat",
    "assist_translation",
    "word_audio",
    "sentence_audio",
    "media_image",
)
_MEDIA_CATEGORY_HINTS = ("image", "cover", "poster", "screenshot", "book", "media")
_MEDIA_WORKER_HINTS = _MEDIA_CATEGORY_HINTS


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


def _to_int(value: Any, default: int = 0) -> int:
    if isinstance(value, bool):
        return 1 if value else 0
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return int(value)
    if isinstance(value, str):
        v = value.strip()
        return int(v) if v and v.isdigit() else default
    return default


def _to_last_seen(value: Any) -> str | None:
    if not value:
        return None
    if isinstance(value, str):
        text = value.strip()
        return text or None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc).isoformat()
    return None


def _normalize_error_code(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    parts = value.strip().split(":")
    if not parts:
        return None
    code = parts[0].strip()
    return code.lower().replace(" ", "_") if code else None


def _extract_control_intent(name: str) -> Dict[str, Any]:
    return _CONTROL_INTENTS.get(name, {}).copy()


def _normalize_control_intent(control_name: str) -> Dict[str, Any]:
    scope_name = _CONTROL_SCOPE_BY_NAME.get(control_name, control_name)
    intent = _extract_control_intent(scope_name)
    if not intent:
        intent = _extract_control_intent(control_name)
    normalized_request = intent.get("requested")
    if normalized_request is not None:
        normalized_request = _to_bool(normalized_request)
    return {
        "requested_by": intent.get("requested_by"),
        "requested": normalized_request,
        "reason": intent.get("reason"),
        "graceful_stop": _to_bool(intent.get("graceful_stop"), False),
    }


def _record_control_intent(control_name: str, req: QueueCenterControlRequest) -> None:
    # [gpt-5.3-codex-spark:LEGACY-START]
    # Old behavior did not persist UI intent, making requested/on/off state
    # appear derived from callbacks and prone to race conditions.
    # New behavior stores explicit requested intent for idempotent UI/backend
    # reconciliation and scoped behavior alignment (assist + translation).
    # [gpt-5.3-codex-spark:LEGACY-END]
    scope_name = _CONTROL_SCOPE_BY_NAME.get(control_name, control_name)
    payload = {
        "requested_by": (req.requested_by or "user"),
        "requested": _to_bool(req.enabled),
        "reason": req.reason,
        "graceful_stop": _to_bool(req.graceful_stop),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    _CONTROL_INTENTS[scope_name] = payload
    if scope_name != control_name:
        _CONTROL_INTENTS[control_name] = payload


def _resolve_lifecycle(
    configured: bool,
    requested: Optional[bool],
    has_signal: bool,
    error_code: str | None,
) -> str:
    if error_code:
        return "error"
    if requested is True:
        return "on" if has_signal else "starting"
    if requested is False:
        return "starting" if has_signal else "off"
    if configured:
        return "on" if has_signal else "starting"
    return "on" if has_signal else "off"


def _section_lifecycle(
    raw: Dict[str, Any],
    configured: bool,
    has_signal: bool,
    requested_by: str | None,
) -> str:
    requested = raw.get("requested")
    if isinstance(requested, bool):
        return _resolve_lifecycle(configured, requested, has_signal, raw.get("error_code"))
    if requested is not None:
        return _resolve_lifecycle(configured, _to_bool(requested), has_signal, raw.get("error_code"))
    if raw.get("requested_by") or requested_by == "user":
        return _resolve_lifecycle(configured, raw.get("requested"), has_signal, raw.get("error_code"))
    return _resolve_lifecycle(configured, None, has_signal, raw.get("error_code"))


def _is_media_category(value: Dict[str, Any]) -> bool:
    key = str(value.get("key", "")).lower()
    label = str(value.get("label", "")).lower()
    merged = f"{key} {label}"
    return any(token in merged for token in _MEDIA_CATEGORY_HINTS)


def _worker_is_media(raw: Dict[str, Any]) -> bool:
    for processor in (raw.get("processor_types") or []):
        text = str(processor).lower()
        if any(token in text for token in _MEDIA_WORKER_HINTS):
            return True
    return False


def _sum_numbers(rows: List[Dict[str, Any]], field: str) -> int:
    return sum(_to_int(row.get(field)) for row in rows if isinstance(row, dict))


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
    assist_intent = _normalize_control_intent("assist")
    translation_intent = _normalize_control_intent("translation")
    word_audio_intent = _normalize_control_intent("word_audio")
    sentence_intent = _normalize_control_intent("sentence_audio")
    callbacks = {
        row.get("name"): bool(row.get("enabled"))
        for row in workers.get("callbacks", [])
        if isinstance(row, dict) and row.get("name")
    }
    capabilities = assist.get("capabilities") or {}
    master = bool(assist.get("enabled"))
    word_audio_requested = (
        word_audio_intent["requested"]
        if isinstance(word_audio_intent.get("requested"), bool)
        else bool((word_audio or {}).get("auto_start"))
    )
    sentence_audio_requested = (
        sentence_intent["requested"]
        if isinstance(sentence_intent.get("requested"), bool)
        else bool((sentence_audio or {}).get("auto_start"))
    )
    word_audio_configured = (
        master and bool(capabilities.get("tts", True)) and word_audio_requested
    )
    sentence_audio_configured = (
        master
        and bool(capabilities.get("sentence_audio", True))
        and sentence_audio_requested
    )
    translation_configured = master and (
        bool(capabilities.get("translation", True))
        or bool(capabilities.get("ai_translate", True))
    )
    return {
        "assist": {
            "configured": master,
            "running": bool(assist.get("running")),
            "owner": "assist",
            "requested_by": assist_intent["requested_by"] or translation_intent["requested_by"] or "system",
            "requested": (
                assist_intent["requested"]
                if isinstance(assist_intent.get("requested"), bool)
                else translation_intent["requested"]
                if isinstance(translation_intent.get("requested"), bool)
                else None
            ),
            "reason": assist_intent["reason"] or translation_intent["reason"],
            "graceful_stop": _to_bool(assist_intent["graceful_stop"]) or _to_bool(translation_intent["graceful_stop"]),
        },
        "translation": {
            "configured": translation_configured,
            "running": translation_configured
            and bool(callbacks.get("translation_worker")),
            "owner": "pycore.google_translation_worker",
            "requested_by": translation_intent["requested_by"] or "system",
            "requested": translation_intent["requested"] if isinstance(translation_intent.get("requested"), bool) else None,
            "reason": translation_intent["reason"],
            "graceful_stop": _to_bool(translation_intent["graceful_stop"]),
        },
        "word_audio": {
            "configured": word_audio_configured,
            "requested": word_audio_requested,
            "running": word_audio_configured
            and bool((word_audio or {}).get("heartbeat_enabled")),
            "owner": "pycore.word_tts_auto",
            "requested_by": word_audio_intent["requested_by"] or "system",
            "reason": word_audio_intent["reason"],
            "graceful_stop": _to_bool(word_audio_intent["graceful_stop"]),
        },
        "sentence_audio": {
            "configured": sentence_audio_configured,
            "requested": sentence_audio_requested,
            "running": sentence_audio_configured
            and bool((sentence_audio or {}).get("heartbeat_enabled")),
            "owner": "pycore.sentence_audio_auto",
            "requested_by": sentence_intent["requested_by"] or "system",
            "reason": sentence_intent["reason"],
            "graceful_stop": _to_bool(sentence_intent["graceful_stop"]),
        },
    }


def _build_section_contracts(
    controls: Dict[str, Any],
    errors: Dict[str, str],
    generated_at: str,
    overview: Optional[Dict[str, Any]],
    task_center_snapshot: Dict[str, Any],
    translation: Optional[Dict[str, Any]],
    word_audio: Optional[Dict[str, Any]],
    sentence_audio: Optional[Dict[str, Any]],
    sentence_queue: Optional[Dict[str, Any]],
    assist: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Build explicit section contracts for the Queue Center UI.
    The frontend treats this as the single authoritative section state.
    """
    # [gpt-5.3-codex-spark:LEGACY-START]
    # Legacy behavior derived queue/heartbeat state inside the UI.
    # New backend contract now owns those fields so all tabs consume one source.
    # [gpt-5.3-codex-spark:LEGACY-END]
    overview_categories = (
        overview.get("categories") if isinstance(overview, dict) else []
    ) or []
    if not isinstance(overview_categories, list):
        overview_categories = []
    overview_workers = (
        overview.get("workers") if isinstance(overview, dict) else []
    ) if isinstance(overview, dict) else []
    if not isinstance(overview_workers, list):
        overview_workers = []
    callbacks = task_center_snapshot.get("scheduler", {}).get("callbacks", [])
    if not isinstance(callbacks, list):
        callbacks = []

    assist_control = controls.get("assist", {})
    translation_control = controls.get("translation", {})
    word_control = controls.get("word_audio", {})
    sentence_control = controls.get("sentence_audio", {})

    def _toggle_fields(
        control: Dict[str, Any],
        requested_by_default: str = "system",
        paused_if_requested_off: bool = True,
    ) -> Dict[str, Any]:
        requested = control.get("requested")
        error_code = _normalize_error_code(control.get("error_code"))
        requested_by = control.get("requested_by") or requested_by_default
        running_signal = _to_bool(control.get("running"))
        has_control = _to_bool(control.get("configured"))
        lifecycle = _resolve_lifecycle(
            configured=has_control,
            requested=requested if isinstance(requested, bool) else None,
            has_signal=running_signal,
            error_code=error_code,
        )
        paused_by_user = False
        if isinstance(requested, bool) and requested is False and requested_by == "user" and paused_if_requested_off:
            paused_by_user = True
        return {
            "requested_by": requested_by,
            "paused_by_user": paused_by_user,
            "enabled": bool(running_signal or has_control),
            "reason": control.get("reason"),
            "graceful_stop": _to_bool(control.get("graceful_stop")),
            "lifecycle": lifecycle,
        }

    heartbeat_error = errors.get("heartbeat")
    heartbeat_online = False
    heartbeat_claimed = 0
    heartbeat_last_heartbeat = None
    for worker in overview_workers:
        if isinstance(worker, dict):
            heartbeat_claimed += _to_int(worker.get("claimed"))
            heartbeat_last_heartbeat = (
                _to_last_seen(worker.get("last_seen")) or heartbeat_last_heartbeat
            )
            heartbeat_online = heartbeat_online or _to_bool(worker.get("online"))
    heartbeat_pending = 0
    heartbeat_processing = 0
    for row in callbacks:
        if not isinstance(row, dict):
            continue
        heartbeat_pending += 1
        heartbeat_processing += _to_int(row.get("run_count"))
        if _to_bool(row.get("enabled")):
            heartbeat_online = True
    heartbeat_contract = {
        "type": "heartbeat",
        "category": "heartbeat_workers",
        "queue": {
            "pending": heartbeat_pending,
            "processing": heartbeat_processing,
            "leased": 0,
            "total": heartbeat_pending,
        },
        "worker": {
            "online": heartbeat_online,
            "claimed": heartbeat_claimed,
            "ok": None,
            "fail": None,
            "last_heartbeat": heartbeat_last_heartbeat,
        },
        "toggle": {
            "requested_by": "system",
            "paused_by_user": None,
            "enabled": heartbeat_online,
            "reason": _normalize_error_code(heartbeat_error),
            "graceful_stop": False,
        },
        "lifecycle": _resolve_lifecycle(
            configured=heartbeat_online,
            requested=heartbeat_online,
            has_signal=heartbeat_online,
            error_code=_normalize_error_code(heartbeat_error),
        )
        if heartbeat_error
        else ("on" if heartbeat_online else "off"),
        "error_code": _normalize_error_code(heartbeat_error),
        "last_error": heartbeat_error,
        "updated_at": generated_at,
    }

    media_rows = [row for row in overview_categories if _is_media_category(row)]
    media_contract = {
        "type": "media_image",
        "category": "media_image",
        "queue": {
            "pending": _sum_numbers(media_rows, "pending"),
            "processing": _sum_numbers(media_rows, "processing"),
            "leased": _sum_numbers(media_rows, "leased"),
            "total": _sum_numbers(media_rows, "total"),
        },
        "worker": {
            "online": any(_to_bool(worker.get("online")) for worker in overview_workers if isinstance(worker, dict) and _worker_is_media(worker)),
            "claimed": sum(
                _to_int(worker.get("claimed"))
                for worker in overview_workers
                if isinstance(worker, dict) and _worker_is_media(worker)
            ),
            "ok": None,
            "fail": None,
            "last_heartbeat": max(
                filter(
                    None,
                    (
                        _to_last_seen(worker.get("last_seen"))
                        for worker in overview_workers
                        if isinstance(worker, dict) and _worker_is_media(worker)
                    ),
                ),
                default=None,
            ),
        },
        "toggle": {
            "requested_by": "system",
            "paused_by_user": False,
            "enabled": any(
                _to_bool(worker.get("online"))
                for worker in overview_workers
                if isinstance(worker, dict) and _worker_is_media(worker)
            ),
            "reason": _normalize_error_code(
                errors.get("image") or errors.get("poster") or errors.get("media_image")
            ),
            "graceful_stop": False,
        },
        "lifecycle": (
            "error"
            if errors.get("image") or errors.get("poster") or errors.get("media_image")
            else (
                "on"
                if any(
                    _to_bool(worker.get("online"))
                    for worker in overview_workers
                    if isinstance(worker, dict) and _worker_is_media(worker)
                )
                else "off"
            )
        ),
        "error_code": _normalize_error_code(errors.get("image") or errors.get("poster") or errors.get("media_image")),
        "last_error": errors.get("image") or errors.get("poster") or errors.get("media_image"),
        "updated_at": generated_at,
    }

    assist_laravel = (assist or {}).get("laravel_status", {}) if isinstance(assist, dict) else {}
    assist_summary = translation.get("summary", {}) if isinstance(translation, dict) else {}
    assist_queue = {
        "pending": (
            _to_int(assist_summary.get("pending"))
            + _to_int((assist_laravel.get("tts") or {}).get("pending", 0))
            + _to_int((assist_laravel.get("cover") or {}).get("pending", 0))
            + _to_int((assist_laravel.get("poster") or {}).get("pending", 0))
        ),
        "processing": (
            _to_int(assist_summary.get("processing"))
            + _to_int((assist_laravel.get("tts") or {}).get("processing", 0))
            + _to_int((assist_laravel.get("cover") or {}).get("processing", 0))
            + _to_int((assist_laravel.get("poster") or {}).get("processing", 0))
        ),
        "leased": (
            _to_int((assist_laravel.get("tts") or {}).get("leased", 0))
            + _to_int((assist_laravel.get("cover") or {}).get("leased", 0))
            + _to_int((assist_laravel.get("poster") or {}).get("leased", 0))
        ),
        "total": (
            _to_int(assist_summary.get("total"))
            + _to_int((assist_laravel.get("tts") or {}).get("total", 0))
            + _to_int((assist_laravel.get("cover") or {}).get("total", 0))
            + _to_int((assist_laravel.get("poster") or {}).get("total", 0))
        ),
    }
    assist_error = errors.get("assist") or errors.get("translation")
    assist_toggle = _toggle_fields(assist_control)
    assist_contract = {
        "type": "assist_translation",
        "category": "assist_translation",
        "queue": assist_queue,
        "worker": {
            "online": _to_bool(assist_control.get("running")),
            "claimed": _to_int((assist_control.get("counters") or {}).get("claimed", 0)),
            "ok": _to_int((assist_control.get("counters") or {}).get("submitted", 0)),
            "fail": _to_int((assist_control.get("counters") or {}).get("failures", 0)),
            "last_heartbeat": _to_last_seen(assist_control.get("last_cycle_at")),
        },
        "toggle": {
            **assist_toggle,
            "error": _normalize_error_code(assist_error),
        },
        "lifecycle": _resolve_lifecycle(
            configured=_to_bool(assist_control.get("configured")),
            requested=assist_control.get("requested") if isinstance(assist_control.get("requested"), bool) else None,
            has_signal=_to_bool(assist_control.get("running")),
            error_code=_normalize_error_code(assist_error),
        ),
        "error_code": _normalize_error_code(assist_error),
        "last_error": assist_error,
        "updated_at": generated_at,
    }

    word_laravel = (word_audio or {}).get("laravel", {}) if isinstance(word_audio, dict) else {}
    word_worker = (word_audio or {}).get("worker", {}) if isinstance(word_audio, dict) else {}
    word_error = errors.get("word_audio")
    word_toggle = _toggle_fields(word_control)
    word_contract = {
        "type": "word_audio",
        "category": "word_audio",
        "queue": {
            "pending": _to_int(word_laravel.get("pending")),
            "processing": 0,
            "leased": _to_int(word_laravel.get("leased")),
            "total": _to_int(word_laravel.get("pending")) + _to_int(word_laravel.get("leased")),
        },
        "worker": {
            "online": _to_bool((word_audio or {}).get("heartbeat_enabled", False)) if isinstance(word_audio, dict) else False,
            "claimed": _to_int(word_worker.get("total_claimed")),
            "ok": _to_int(word_worker.get("total_succeeded")),
            "fail": _to_int(word_worker.get("total_failed")),
            "last_heartbeat": _to_last_seen(word_worker.get("last_seen")),
        },
        "toggle": word_toggle,
        "lifecycle": _resolve_lifecycle(
            configured=_to_bool(word_control.get("configured")),
            requested=word_control.get("requested") if isinstance(word_control.get("requested"), bool) else None,
            has_signal=_to_bool(word_audio.get("heartbeat_enabled")) if isinstance(word_audio, dict) else False,
            error_code=_normalize_error_code(word_error),
        ),
        "error_code": _normalize_error_code(word_error),
        "last_error": word_error,
        "updated_at": generated_at,
    }

    sentence_laravel = (sentence_audio or {}).get("laravel", {}) if isinstance(sentence_audio, dict) else {}
    sentence_worker = (sentence_audio or {}).get("worker", {}) if isinstance(sentence_audio, dict) else {}
    sentence_queue_data = (
        sentence_queue.get("queue", {}) if isinstance(sentence_queue, dict) else {}
    )
    sentence_items = sentence_queue_data.get("items", [])
    if not isinstance(sentence_items, list):
        sentence_items = []
    sentence_pending = _to_int(sentence_queue_data.get("total"))
    if not sentence_pending:
        sentence_pending = len(sentence_items)
    sentence_error = errors.get("sentence_audio") or errors.get("sentence")
    sentence_toggle = _toggle_fields(sentence_control)
    sentence_contract = {
        "type": "sentence_audio",
        "category": "sentence_audio",
        "queue": {
            "pending": sentence_pending,
            "processing": _to_int(sentence_worker.get("processing")),
            "leased": _to_int(sentence_laravel.get("leased")),
            "total": _to_int(sentence_queue_data.get("total")) or sentence_pending,
        },
        "worker": {
            "online": _to_bool((sentence_audio or {}).get("heartbeat_enabled", False))
            if isinstance(sentence_audio, dict)
            else False,
            "claimed": _to_int(sentence_worker.get("total_claimed")),
            "ok": _to_int(sentence_worker.get("total_succeeded")),
            "fail": _to_int(sentence_worker.get("total_failed")),
            "last_heartbeat": _to_last_seen(sentence_worker.get("last_seen")),
        },
        "toggle": sentence_toggle,
        "lifecycle": _resolve_lifecycle(
            configured=_to_bool(sentence_control.get("configured")),
            requested=sentence_control.get("requested")
            if isinstance(sentence_control.get("requested"), bool)
            else None,
            has_signal=_to_bool((sentence_audio or {}).get("heartbeat_enabled")),
            error_code=_normalize_error_code(sentence_error),
        ),
        "error_code": _normalize_error_code(sentence_error),
        "last_error": sentence_error,
        "updated_at": generated_at,
    }

    # [gpt-5.3-codex-spark:LEGACY-START]
    # assist_translation and translation share one heartbeat lane in current UI
    # wiring, so keep both controls mapped to the same section contract.
    # [gpt-5.3-codex-spark:LEGACY-END]
    return {
        "heartbeat": heartbeat_contract,
        "assist_translation": assist_contract,
        "word_audio": word_contract,
        "sentence_audio": sentence_contract,
        "media_image": media_contract,
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
    controls = _control_state(assist, workers, word_audio, sentence_audio)
    section_contracts = _build_section_contracts(
        controls=controls,
        errors=errors,
        generated_at=generated_at,
        overview=overview,
        task_center_snapshot=task_center,
        translation=translation,
        word_audio=word_audio,
        sentence_audio=sentence_audio,
        sentence_queue=sentence_queue,
        assist=assist,
    )

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


@router.post("/controls/{control_name}")
def set_queue_center_control(control_name: str, req: QueueCenterControlRequest):
    """Apply one named, persistent Queue Center control and return fresh state."""
    enabled = bool(req.enabled)
    if control_name not in {"assist", "assist_translation", "translation", "word_audio", "sentence_audio"}:
        raise fastapi.HTTPException(
            status_code=404, detail=f"Unknown Queue Center control: {control_name}"
        )

    requested_by = (
        req.requested_by.strip()
        if isinstance(req.requested_by, str) and req.requested_by.strip()
        else "user"
    )
    _record_control_intent(
        control_name,
        QueueCenterControlRequest(
            enabled=req.enabled,
            requested_by=requested_by,
            reason=req.reason,
            graceful_stop=req.graceful_stop,
        ),
    )
    # [gpt-5.3-codex-spark:LEGACY-START]
    # Previously `assist_translation` was not accepted as a control name, so
    # callers had to choose between `assist` and `translation`.
    # Keep a canonical alias to guarantee both tabs target the same control
    # state machine regardless of entrypoint.
    # [gpt-5.3-codex-spark:LEGACY-END]
    if control_name == "assist" or control_name == "assist_translation":
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

    return {
        "success": True,
        "control": control_name,
        "enabled": enabled,
        "requested_by": requested_by,
        "graceful_stop": req.graceful_stop,
        "result": result,
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
    return monitor.get_task_full_detail(task_id)
