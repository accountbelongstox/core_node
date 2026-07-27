# -*- coding: utf-8 -*-
"""
Queue Center section-contract builders extracted from task_center_controller.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pycore.callmodule.services.queue_center_contract import (
    QUEUE_CATEGORY_CATALOG,
    QueueCenterSectionContract,
    QueueCenterToggleEnvelope,
)

_MEDIA_CATEGORY_HINTS = ("image", "cover", "poster", "screenshot", "book", "media")


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


def _is_media_category(value: Dict[str, Any]) -> bool:
    key = str(value.get("key", "")).lower()
    label = str(value.get("label", "")).lower()
    merged = f"{key} {label}"
    return any(token in merged for token in _MEDIA_CATEGORY_HINTS)


def _worker_is_media(raw: Dict[str, Any]) -> bool:
    for processor in (raw.get("processor_types") or []):
        text = str(processor).lower()
        if any(token in text for token in _MEDIA_CATEGORY_HINTS):
            return True
    return False


def _sum_numbers(rows: List[Dict[str, Any]], field: str) -> int:
    return sum(_to_int(row.get(field)) for row in rows if isinstance(row, dict))


def build_section_contracts(
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
) -> Dict[str, QueueCenterSectionContract]:
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
    ) -> QueueCenterToggleEnvelope:
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
    heartbeat_contract: QueueCenterSectionContract = {
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
        ) if heartbeat_error else ("on" if heartbeat_online else "off"),
        "error_code": _normalize_error_code(heartbeat_error),
        "last_error": heartbeat_error,
        "updated_at": generated_at,
    }

    media_rows = [row for row in overview_categories if _is_media_category(row)]
    media_contract: QueueCenterSectionContract = {
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
            "claimed": sum(_to_int(worker.get("claimed")) for worker in overview_workers if isinstance(worker, dict) and _worker_is_media(worker)),
            "ok": None,
            "fail": None,
            "last_heartbeat": max(
                filter(None, (_to_last_seen(worker.get("last_seen")) for worker in overview_workers if isinstance(worker, dict) and _worker_is_media(worker))),
                default=None,
            ),
        },
        "toggle": {
            "requested_by": "system",
            "paused_by_user": False,
            "enabled": any(_to_bool(worker.get("online")) for worker in overview_workers if isinstance(worker, dict) and _worker_is_media(worker)),
            "reason": _normalize_error_code(errors.get("image") or errors.get("poster") or errors.get("media_image")),
            "graceful_stop": False,
        },
        "lifecycle": (
            "error" if errors.get("image") or errors.get("poster") or errors.get("media_image")
            else ("on" if any(_to_bool(worker.get("online")) for worker in overview_workers if isinstance(worker, dict) and _worker_is_media(worker)) else "off")
        ),
        "error_code": _normalize_error_code(errors.get("image") or errors.get("poster") or errors.get("media_image") or errors.get("overview")),
        "last_error": errors.get("image") or errors.get("poster") or errors.get("media_image") or errors.get("overview"),
        "updated_at": generated_at,
    }

    assist_laravel = (assist or {}).get("laravel_status", {}) if isinstance(assist, dict) else {}
    assist_summary = translation.get("summary", {}) if isinstance(translation, dict) else {}
    assist_queue = {
        "pending": (_to_int(assist_summary.get("pending")) + _to_int((assist_laravel.get("tts") or {}).get("pending", 0)) + _to_int((assist_laravel.get("cover") or {}).get("pending", 0)) + _to_int((assist_laravel.get("poster") or {}).get("pending", 0))),
        "processing": (_to_int(assist_summary.get("processing")) + _to_int((assist_laravel.get("tts") or {}).get("processing", 0)) + _to_int((assist_laravel.get("cover") or {}).get("processing", 0)) + _to_int((assist_laravel.get("poster") or {}).get("processing", 0))),
        "leased": (_to_int(assist_summary.get("leased")) + _to_int((assist_laravel.get("tts") or {}).get("leased", 0)) + _to_int((assist_laravel.get("cover") or {}).get("leased", 0)) + _to_int((assist_laravel.get("poster") or {}).get("leased", 0))),
        "total": (_to_int(assist_summary.get("total")) + _to_int((assist_laravel.get("tts") or {}).get("total", 0)) + _to_int((assist_laravel.get("cover") or {}).get("total", 0)) + _to_int((assist_laravel.get("poster") or {}).get("total", 0))),
    }
    assist_error = errors.get("assist") or errors.get("translation") or errors.get("overview")
    assist_toggle = _toggle_fields(assist_control)
    assist_contract: QueueCenterSectionContract = {
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
        "toggle": {**assist_toggle, "error": _normalize_error_code(assist_error)},
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
    word_contract: QueueCenterSectionContract = {
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
    sentence_queue_data = (sentence_queue.get("queue", {}) if isinstance(sentence_queue, dict) else {})
    sentence_items = sentence_queue_data.get("items", [])
    if not isinstance(sentence_items, list):
        sentence_items = []
    sentence_pending = _to_int(sentence_queue_data.get("total"))
    if not sentence_pending:
        sentence_pending = len(sentence_items)
    sentence_error = errors.get("sentence_audio") or errors.get("sentence")
    sentence_toggle = _toggle_fields(sentence_control)
    sentence_contract: QueueCenterSectionContract = {
        "type": "sentence_audio",
        "category": "sentence_audio",
        "queue": {
            "pending": sentence_pending,
            "processing": _to_int(sentence_worker.get("processing")),
            "leased": _to_int(sentence_laravel.get("leased")),
            "total": _to_int(sentence_queue_data.get("total")) or sentence_pending,
        },
        "worker": {
            "online": _to_bool((sentence_audio or {}).get("heartbeat_enabled", False)) if isinstance(sentence_audio, dict) else False,
            "claimed": _to_int(sentence_worker.get("total_claimed")),
            "ok": _to_int(sentence_worker.get("total_succeeded")),
            "fail": _to_int(sentence_worker.get("total_failed")),
            "last_heartbeat": _to_last_seen(sentence_worker.get("last_seen")),
        },
        "toggle": sentence_toggle,
        "lifecycle": _resolve_lifecycle(
            configured=_to_bool(sentence_control.get("configured")),
            requested=sentence_control.get("requested") if isinstance(sentence_control.get("requested"), bool) else None,
            has_signal=_to_bool((sentence_audio or {}).get("heartbeat_enabled")),
            error_code=_normalize_error_code(sentence_error),
        ),
        "error_code": _normalize_error_code(sentence_error),
        "last_error": sentence_error,
        "updated_at": generated_at,
    }

    return {
        "heartbeat": heartbeat_contract,
        "assist_translation": assist_contract,
        "word_audio": word_contract,
        "sentence_audio": sentence_contract,
        "media_image": media_contract,
    }


__all__ = ["build_section_contracts"]
