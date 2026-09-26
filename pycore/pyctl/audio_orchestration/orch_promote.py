# -*- coding: utf-8 -*-
"""Audio-orchestration Part1 fill (LOCAL ONLY) for words AND sentences.

A manifest's local-cache misses are exactly what this machine still needs.
Each miss enters Part1 of its OWN lane queue — missing words into the
word_audio Queue, missing sentences into the sentence_audio Queue — as a
pycore-local task owned by the orchestration task (the tracker owner), so
the fill is visible per lane (Part1 / Part2 / whole Queue) and per task.

The resolver then ``take_local``s its items chunk by chunk, generates them,
and ``settle_local``s the outcome; items a lane worker already popped are
awaited instead of generated twice. The promotion NEVER notifies Laravel
(wordnew owns the Part2 path).

Binding: docs_fix/REQUIREMENTS_20260926_AUDIO_ORCH_QUEUE_STATE_DRIVEN.md §5.2/§5.5.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.queue_center_contract import audio_dedup_key
from pycore.pyutils.tts.audio_queue_center import (
    AUDIO_QUEUE_LANE_BY_KIND,
    LOCAL_SOURCE_ORCHESTRATION,
    audio_queue_center,
    build_local_task,
)


def resource_lane(resource: Dict[str, Any]) -> str:
    """The lane (queue) a manifest resource belongs to."""
    return AUDIO_QUEUE_LANE_BY_KIND.get(str(resource.get("kind") or ""), "")


def resource_queue_key(resource: Dict[str, Any]) -> str:
    """Canonical whole-Queue dedup key of one manifest resource (ONE helper)."""
    return audio_dedup_key(
        resource_lane(resource),
        resource.get("language"),
        resource.get("text"),
    )


def promote_missing_to_queue_head(
    misses: List[Dict[str, Any]],
    base_url: Optional[str] = None,
    owner: str = "",
) -> Dict[str, Any]:
    """Fill Part1 of each lane with the task's missing resources (local tasks)."""
    items_by_lane: Dict[str, List[Dict[str, Any]]] = {}
    for resource in misses:
        lane = resource_lane(resource)
        text = str(resource.get("text") or "").strip()
        language = str(resource.get("language") or "").strip()
        task = build_local_task(lane, language, text, LOCAL_SOURCE_ORCHESTRATION, base_url=str(base_url or ""))
        if task is None:
            continue
        items_by_lane.setdefault(lane, []).append({"language": language, "text": text, "task": task})

    summary: Dict[str, Any] = {"success": True, "queues": {}, "promoted": 0}
    for lane, items in items_by_lane.items():
        result = audio_queue_center.promote_local_head(
            lane, items, wake=False, owner=owner,
        )
        summary["queues"][lane] = {
            "requested": len(items),
            "promoted": int(result.get("promoted") or 0),
            "inserted": int(result.get("inserted") or 0),
            "claimed": int(result.get("claimed") or 0),
            "success": bool(result.get("success")),
        }
        summary["promoted"] += int(result.get("promoted") or 0)
        if not result.get("success"):
            summary["success"] = False
        ColorPrint.green(
            f"[AudioOrch] Part1 fill {lane}: requested={len(items)} "
            f"promoted={summary['queues'][lane]['promoted']} "
            f"inserted={summary['queues'][lane]['inserted']} owner={owner or '-'}"
        )
    return summary


__all__ = [
    "promote_missing_to_queue_head",
    "resource_lane",
    "resource_queue_key",
]
