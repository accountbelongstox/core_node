# -*- coding: utf-8 -*-
"""
Queue Overview router — the unified, never-blind queue snapshot (contract A).

GET /api/local/queue/overview is the pycore hub view the FE pycore-manager
Queue Center "Overview" tab consumes (PcQueueOverview in pycoreTypes.ts). pycore
is the hub: it merges the cached Laravel translation-queue snapshot
(QueueMonitorService — NO forced refresh, no network I/O on the request path)
with its own worker registry + fast-lane signals, and ALWAYS emits one card per
catalog category (zeros when empty) so the overview is never blind to a lane
that exists in Laravel's GlobalTask vocabulary — including ai_translate and
subtitle_search.

Response shape (PcQueueOverview):

  {
    success: true,
    generated_at: <iso8601>,
    laravel_reachable: bool,
    categories: [ { key, label, handler, pending, processing, leased, total,
                    by_language?, sample? } ],   # one per _CATEGORY_CATALOG row
    workers:    [ { id, kind, processor_types, online, last_seen, claimed } ],
    engines:    { translation:{priority:[...]} , ... },   # pycore-local engines
    fast_lane:  { capabilities, processor_types, queue_depth,
                  pending_fast, pending_urgent, registered },
  }

The catalog + count keys are SHARED with task_center_router (single source of
truth) so the two task-center surfaces never drift. This router does NO network
I/O itself — everything comes from in-process singletons.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List

import fastapi

from pycore.callmodule.services import (
    get_queue_monitor_service,
    get_translation_worker_service,
)
from pycore.callmodule.callmodule_config import Config
from .task_center_router import (
    _CATEGORY_CATALOG,
    _COUNT_KEYS,
    _fast_lane_block,
)

router = fastapi.APIRouter(
    prefix="/api/local/queue",
    tags=["Local Processing - Queue Overview"],
)


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


def _zero_counts() -> Dict[str, int]:
    """An all-zero per-category count block (every _COUNT_KEYS field)."""
    return {key: 0 for key in _COUNT_KEYS}


def _category_counts(summary: Dict[str, Any]) -> Dict[str, Dict[str, int]]:
    """
    Map the cached translation-queue summary onto the catalog's count keys.

    Only the translation lanes have live counts in the cached snapshot
    (word_translation / ai_translate share Laravel's translation summary);
    every other catalog category degrades to zeros until its own counter is
    wired (the overview must still show the card). `summary` is the Laravel
    {pending,processing,completed,failed,total,...} block — `leased` maps from
    `assigned`/`leased` when present.
    """
    def _num(value: Any) -> int:
        try:
            return int(value or 0)
        except (TypeError, ValueError):
            return 0

    translation = {
        "pending": _num(summary.get("pending")),
        "processing": _num(summary.get("processing")),
        "leased": _num(summary.get("leased", summary.get("assigned"))),
        "total": _num(summary.get("total")),
    }

    counts: Dict[str, Dict[str, int]] = {}
    for row in _CATEGORY_CATALOG:
        key = row["key"]
        if key == "word_translation":
            counts[key] = dict(translation)
        else:
            counts[key] = _zero_counts()
    return counts


def _categories(summary: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Build one card per catalog row (zeros when the lane has no live count)."""
    counts = _category_counts(summary)
    cards: List[Dict[str, Any]] = []
    for row in _CATEGORY_CATALOG:
        card: Dict[str, Any] = {
            "key": row["key"],
            "label": row["label"],
            "handler": row["handler"],
        }
        card.update(counts.get(row["key"], _zero_counts()))
        cards.append(card)
    return cards


def _workers() -> List[Dict[str, Any]]:
    """
    The registered-worker registry. Only this node's translation worker is
    locally introspectable; chrome/internal workers register Laravel-side and
    are surfaced there. Degrades to a single self entry (or none when the
    worker is not registered).
    """
    status = _worker().get_status()
    worker_id = status.get("worker_id")
    if not worker_id:
        return []
    return [
        {
            "id": worker_id,
            "kind": "pycore",
            "processor_types": status.get("processor_types", []) or [],
            "online": bool(status.get("registered", False)),
            "last_seen": None,
            "claimed": int(status.get("inflight_tasks", 0) or 0),
        }
    ]


def _engines() -> Dict[str, Any]:
    """
    pycore-local engine status per capability. Kept minimal/static here — the
    rich per-engine priority chains live behind /api/local/capabilities; this
    block only advertises the worker's translation provider so the overview
    card is populated.
    """
    status = _worker().get_status()
    provider = status.get("provider")
    return {
        "translation": {"priority": [provider] if provider else []},
    }


@router.get("/overview")
async def get_queue_overview():
    """
    Return the unified queue overview (PcQueueOverview). One poll for the whole
    Overview tab: every catalog category as a card (zeros when empty), the
    worker registry, pycore-local engines, and the fast-lane signals block.
    Reads only in-process singletons — no network I/O on the request path.
    """
    snapshot = _monitor().get_snapshot(refresh=False)
    summary = snapshot.get("summary", {}) or {}

    return {
        "success": True,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "laravel_reachable": snapshot.get("laravel_reachable", False),
        "categories": _categories(summary),
        "workers": _workers(),
        "engines": _engines(),
        "fast_lane": _fast_lane_block(),
    }
