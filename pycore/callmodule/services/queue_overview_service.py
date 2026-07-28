# -*- coding: utf-8 -*-
"""Single Queue Center overview implementation.

The UI reaches this service through RPC v2. This pycore service may read the
selected Laravel endpoint over HTTP, then normalizes Laravel metrics against
``config/queue_center_contract.json`` before returning them.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List

from pycore.callmodule.callmodule_config import Config
from pycore.callmodule.controllers.local_processing.task_center_assist import (
    fetch_assist_overview,
)
from pycore.callmodule.services.queue_center_contract import (
    QUEUE_CATEGORY_CATALOG,
    QUEUE_COUNT_KEYS,
)
from pycore.callmodule.services.queue_monitor_service import get_queue_monitor_service
from pycore.callmodule.services.translation_worker.worker import (
    get_translation_worker_service,
)


def _monitor():
    return get_queue_monitor_service(
        laravel_api_url=Config.LARAVEL_WORKER_API_URL,
        bump_ttl_seconds=Config.TRANSLATION_QUEUE_BUMP_TTL_SECONDS,
    )


def _worker():
    return get_translation_worker_service(laravel_api_url=Config.LARAVEL_WORKER_API_URL)


def _number(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _zero_counts() -> Dict[str, int]:
    return {key: 0 for key in QUEUE_COUNT_KEYS}


def _fallback_counts(summary: Dict[str, Any]) -> Dict[str, Dict[str, int]]:
    return {
        "word_translation": {
            "pending": _number(summary.get("pending")),
            "processing": _number(summary.get("processing")),
            "leased": _number(summary.get("leased", summary.get("assigned"))),
            "total": _number(summary.get("total")),
        }
    }


def _normalize_categories(
    live_categories: List[Dict[str, Any]],
    summary: Dict[str, Any],
) -> List[Dict[str, Any]]:
    live_by_key = {
        str(row.get("key")): row
        for row in live_categories
        if isinstance(row, dict) and row.get("key")
    }
    fallback = _fallback_counts(summary)
    categories: List[Dict[str, Any]] = []
    for definition in QUEUE_CATEGORY_CATALOG:
        key = str(definition["key"])
        live = live_by_key.get(key, {})
        row: Dict[str, Any] = {
            "key": key,
            "label": str(definition["label"]),
            "capability": definition.get("capability"),
            "primary_handler": str(definition["primary_handler"]),
            "claimants": list(definition.get("claimants") or []),
            "active_handlers": list(live.get("active_handlers") or []),
            **_zero_counts(),
        }
        counts = live if live else fallback.get(key, {})
        for field in QUEUE_COUNT_KEYS:
            row[field] = _number(counts.get(field))
        for field in ("by_language", "by_status", "sample", "engine"):
            if field in live:
                row[field] = live[field]
        categories.append(row)
    return categories


def _merge_workers(laravel: List[Dict[str, Any]], local: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    workers: List[Dict[str, Any]] = []
    seen = set()
    for worker in (laravel or []) + (local or []):
        worker_id = worker.get("id") if isinstance(worker, dict) else None
        if worker_id and worker_id in seen:
            continue
        if worker_id:
            seen.add(worker_id)
        if isinstance(worker, dict):
            workers.append(worker)
    return workers


def _workers() -> List[Dict[str, Any]]:
    status = _worker().get_status()
    worker_id = status.get("worker_id")
    if not worker_id:
        return []
    return [{
        "id": worker_id,
        "kind": "pycore",
        "name": "pycore-translation-worker",
        "processor_types": status.get("processor_types", []) or [],
        "online": bool(status.get("registered", False)),
        "last_seen": None,
        "claimed": _number(status.get("inflight_tasks")),
    }]


def _engines() -> Dict[str, Any]:
    provider = _worker().get_status().get("provider")
    return {"translation": {"priority": [provider] if provider else []}}


def build_fast_lane() -> Dict[str, Any]:
    """Build runtime fast-lane status; contract metadata remains dependency-free."""
    worker = _worker()
    raw: Dict[str, Any] = {}
    getter = getattr(worker, "get_queue_status", None)
    if callable(getter):
        try:
            result = getter()
            if isinstance(result, dict):
                raw = result
        except Exception:  # noqa: BLE001
            raw = {}
    status = worker.get_status()
    return {
        "capabilities": raw.get("capabilities", status.get("capabilities", [])),
        "processor_types": raw.get("processor_types", status.get("processor_types", [])),
        "queue_depth": raw.get("queue_depth", status.get("inflight_tasks", 0)),
        "pending_fast": raw.get("pending_fast", 0),
        "pending_urgent": raw.get("pending_urgent", 0),
        "registered": raw.get("registered", status.get("registered", False)),
    }


def get_queue_overview() -> Dict[str, Any]:
    """Return the only canonical overview used by both RPC and hub snapshot."""
    monitor_snapshot = _monitor().get_snapshot(refresh=False)
    summary = monitor_snapshot.get("summary", {}) or {}
    assist = fetch_assist_overview()
    live_categories = assist.get("categories") if isinstance(assist, dict) else []
    if not isinstance(live_categories, list):
        live_categories = []
    laravel_workers = assist.get("workers") if isinstance(assist, dict) else []
    if not isinstance(laravel_workers, list):
        laravel_workers = []
    age_ms = monitor_snapshot.get("age_ms")
    assist_source = assist.get("source") if isinstance(assist, dict) else None
    assist_reachable = assist_source == "laravel" and not bool(assist.get("stale"))

    return {
        "success": True,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "observed_at": assist.get("observed_at") if isinstance(assist, dict) else None,
        "age_s": assist.get("age_s") if isinstance(assist, dict) else None,
        "stale": bool(assist.get("stale")) if isinstance(assist, dict) else False,
        "source": assist.get("source", "pycore_fallback") if isinstance(assist, dict) else "pycore_fallback",
        "degraded": bool(assist.get("degraded")) if isinstance(assist, dict) else True,
        "diagnostics": assist.get("diagnostics") if isinstance(assist, dict) else None,
        "http_status": assist.get("http_status") if isinstance(assist, dict) else None,
        "laravel_endpoint": assist.get("laravel_endpoint") if isinstance(assist, dict) else None,
        "laravel_reachable": bool(monitor_snapshot.get("laravel_reachable")) or assist_reachable,
        "laravel_snapshot_age_s": (
            round(age_ms / 1000.0, 1) if isinstance(age_ms, (int, float)) else None
        ),
        "categories": _normalize_categories(live_categories, summary),
        "workers": _merge_workers(laravel_workers, _workers()),
        "engines": _engines(),
        "fast_lane": build_fast_lane(),
        **({"error": assist.get("error")} if isinstance(assist, dict) and assist.get("error") else {}),
    }


__all__ = ["build_fast_lane", "get_queue_overview"]
