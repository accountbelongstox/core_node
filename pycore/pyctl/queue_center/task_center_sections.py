# -*- coding: utf-8 -*-
"""Build Queue Center service sections from the canonical category registry.

Category membership comes only from config/queue_center_contract.json through
queue_center_contract.py. This is the only backend section implementation; the
TypeScript client parses its output and does not rebuild business metrics.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

from pycore.pyutils.common.queue_center_contract import (
    QUEUE_CATEGORY_CATALOG,
    QueueCenterScope,
    QueueCenterSectionContract,
    QueueCenterToggleEnvelope,
    build_empty_queue_contract,
    category_keys_for_scope,
)
from pycore.pyutils.common.strtools.normalization import to_bool


def _to_int(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _to_last_seen(value: Any) -> Optional[str]:
    if isinstance(value, str) and value.strip():
        return value.strip()
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc).isoformat()
    return None


def _error_code(value: Any) -> Optional[str]:
    if not isinstance(value, str) or not value.strip():
        return None
    return value.strip().split(":", 1)[0].strip().lower().replace(" ", "_") or None


def _lifecycle(control: Dict[str, Any], error: Optional[str]) -> str:
    if error:
        return "error"
    configured = to_bool(control.get("configured"))
    running = to_bool(control.get("running"))
    requested = control.get("requested")
    if requested is False:
        return "starting" if running else "off"
    if requested is True or configured:
        return "on" if running else "starting"
    return "on" if running else "off"


def _toggle(control: Dict[str, Any]) -> QueueCenterToggleEnvelope:
    requested = control.get("requested")
    requested_by = str(control.get("requested_by") or "system")
    return {
        "requested_by": requested_by,
        "enabled": to_bool(control.get("configured")),
        "reason": str(control.get("reason")) if control.get("reason") else None,
        "graceful_stop": to_bool(control.get("graceful_stop")),
        "paused_by_user": bool(requested is False and requested_by == "user"),
    }


def _categories_for_scope(
    scope: QueueCenterScope,
    categories: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    keys = set(category_keys_for_scope(scope))
    return [row for row in categories if isinstance(row, dict) and row.get("key") in keys]


def _queue(rows: Iterable[Dict[str, Any]]) -> Dict[str, int]:
    values = list(rows)
    return {
        field: sum(_to_int(row.get(field)) for row in values)
        for field in ("pending", "processing", "leased", "total")
    }


def _worker_tokens(scope: QueueCenterScope) -> set[str]:
    keys = set(category_keys_for_scope(scope))
    tokens = set(keys)
    for definition in QUEUE_CATEGORY_CATALOG:
        if definition.get("key") in keys and definition.get("capability"):
            tokens.add(str(definition["capability"]))
    return tokens


def _workers_for_scope(
    scope: QueueCenterScope,
    workers: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    tokens = _worker_tokens(scope)
    if not tokens:
        return []
    matched: List[Dict[str, Any]] = []
    for worker in workers:
        processors = {str(value) for value in worker.get("processor_types", [])}
        if processors.intersection(tokens):
            matched.append(worker)
    return matched


def _worker_metrics(workers: List[Dict[str, Any]], running: bool = False) -> Dict[str, Any]:
    heartbeats = [
        _to_last_seen(worker.get("last_seen"))
        for worker in workers
        if isinstance(worker, dict)
    ]
    return {
        "online": running or any(to_bool(worker.get("online")) for worker in workers),
        "claimed": sum(_to_int(worker.get("claimed")) for worker in workers),
        "ok": None,
        "fail": None,
        "last_heartbeat": max((value for value in heartbeats if value), default=None),
    }


def _observed_at(overview: Dict[str, Any], generated_at: str) -> str:
    value = overview.get("observed_at") or overview.get("generated_at")
    return str(value) if value else generated_at


def _build_queue_section(
    scope: QueueCenterScope,
    controls: Dict[str, Any],
    errors: Dict[str, str],
    categories: List[Dict[str, Any]],
    workers: List[Dict[str, Any]],
    overview: Dict[str, Any],
    generated_at: str,
) -> QueueCenterSectionContract:
    control = controls.get(scope, {})
    error = errors.get(scope) or (
        errors.get("assist") or errors.get("translation")
        if scope == "assist_translation"
        else errors.get(scope.replace("_audio", ""))
    )
    matching_workers = _workers_for_scope(scope, workers)
    contract = build_empty_queue_contract(scope, _observed_at(overview, generated_at))
    contract.update({
        "queue": _queue(_categories_for_scope(scope, categories)),
        "worker": _worker_metrics(matching_workers, to_bool(control.get("running"))),
        "toggle": _toggle(control),
        "lifecycle": _lifecycle(control, error),
        "error_code": _error_code(error),
        "last_error": error,
        "age_s": float(overview["age_s"]) if isinstance(overview.get("age_s"), (int, float)) else None,
        "stale": to_bool(overview.get("stale")),
    })
    return contract


def build_section_contracts(
    controls: Dict[str, Any],
    errors: Dict[str, str],
    generated_at: str,
    overview: Optional[Dict[str, Any]],
    task_center_snapshot: Dict[str, Any],
) -> Dict[str, QueueCenterSectionContract]:
    overview = overview if isinstance(overview, dict) else {}
    categories = overview.get("categories") if isinstance(overview.get("categories"), list) else []
    workers = overview.get("workers") if isinstance(overview.get("workers"), list) else []
    callbacks = task_center_snapshot.get("scheduler", {}).get("callbacks", [])
    callbacks = callbacks if isinstance(callbacks, list) else []
    heartbeat_error = errors.get("heartbeat") or errors.get("workers")
    heartbeat = build_empty_queue_contract("heartbeat", generated_at)
    heartbeat_online = any(to_bool(row.get("enabled")) for row in callbacks if isinstance(row, dict))
    heartbeat.update({
        # Heartbeat is runtime health, not a queue. Queue metrics stay zero.
        "worker": {
            "online": heartbeat_online,
            "claimed": 0,
            "ok": None,
            "fail": None,
            "last_heartbeat": None,
        },
        "toggle": {
            "requested_by": "system",
            "enabled": heartbeat_online,
            "reason": None,
            "graceful_stop": False,
            "paused_by_user": None,
        },
        "lifecycle": "error" if heartbeat_error else ("on" if heartbeat_online else "off"),
        "error_code": _error_code(heartbeat_error),
        "last_error": heartbeat_error,
    })

    result: Dict[str, QueueCenterSectionContract] = {"heartbeat": heartbeat}
    for scope in ("assist_translation", "word_audio", "sentence_audio", "media_image"):
        result[scope] = _build_queue_section(
            scope,
            controls,
            errors,
            categories,
            workers,
            overview,
            generated_at,
        )
    return result


__all__ = ["build_section_contracts"]
