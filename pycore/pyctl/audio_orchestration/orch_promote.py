# -*- coding: utf-8 -*-
"""Audio-orchestration queue-head self-promotion (Part1 fill, LOCAL ONLY).

When a manifest resolves its resources, the local-cache misses are the set
this machine still needs. Promoting that set means filling Part1 of this
machine's shared audio queue (``audio_queue_center``): the lane workers
drain Part1 before Part2, so the misses are synthesized first instead of
walking the catalog-order backlog.

Direction is pycore-local ONLY: the promotion NEVER notifies Laravel.
wordnew is the sole actor that notifies Laravel of head moves (the Part2
fill path: wordnew -> Laravel -> Mercure/diff -> pycore). Part1 is empty
by default; it is (re)built each time an orchestration manifest resolves.
"""

from __future__ import annotations

import hashlib
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.tts.audio_queue_center import audio_queue_center

_QUEUE_WORD_AUDIO = "word_audio"
_QUEUE_SENTENCE_AUDIO = "sentence_audio"


def _promotion_item(
    resource: Dict[str, Any],
    base_url: Optional[str],
) -> Optional[Dict[str, Any]]:
    """One manifest resource -> ``{queue, item}`` for the library promote.

    ``item`` carries the raw identity fields; the canonical dedup key is
    computed inside the library with the ONE contract helper (mirroring
    ``QueueCenterService::dedupKeyFor``)."""
    kind = str(resource.get("kind") or "")
    text = str(resource.get("text") or "").strip()
    language = str(resource.get("language") or "").strip()
    if not text or not language:
        return None
    if kind == "sentence":
        return {"queue": _QUEUE_SENTENCE_AUDIO, "item": {"language": language, "text": text}}
    if kind == "word":
        md5 = hashlib.md5(text.lower().encode("utf-8")).hexdigest()
        resource_key = str(resource.get("resource_id") or md5).strip()
        task = {
            "task_id": f"word-orchestration-{language}-{resource_key}",
            "task_type": _QUEUE_WORD_AUDIO,
            "payload": {
                "word": text,
                "content": text,
                "language": language,
                "md5": md5,
            },
            "_local_source": "orchestration",
        }
        if base_url:
            task["_laravel_base_url"] = str(base_url)
        return {
            "queue": _QUEUE_WORD_AUDIO,
            "item": {
                "language": language,
                "text": text,
                "md5": md5,
                "task": task,
            },
        }
    return None


def promote_missing_to_queue_head(
    misses: List[Dict[str, Any]],
    base_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Enqueue-or-move every missing manifest resource to the local queue
    head — the Part1 fill path of the shared audio queue library.

    Never raises or mutates Laravel. Word misses carry a local queue task so a
    previously unseen identity really enters Part1; the resolver batch-fills
    the cache before waking the worker, which then consumes the same task as a
    cache hit. Sentence misses only promote an already queued remote task.
    """
    items_by_queue: Dict[str, List[Dict[str, Any]]] = {}
    for resource in misses:
        item = _promotion_item(resource, base_url)
        if item is None:
            continue
        items_by_queue.setdefault(item["queue"], []).append(item["item"])

    summary: Dict[str, Any] = {"success": True, "queues": {}, "promoted": 0}
    for queue, items in items_by_queue.items():
        result = audio_queue_center.promote_local_head(queue, items, wake=False)
        summary["queues"][queue] = {
            "requested": len(items),
            "promoted": int(result.get("promoted") or 0),
            "claimed": int(result.get("claimed") or 0),
            "success": bool(result.get("success")),
        }
        summary["promoted"] += int(result.get("promoted") or 0)
        if not result.get("success"):
            summary["success"] = False
        ColorPrint.green(
            f"[AudioOrch] promoted {queue} head (Part1): requested={len(items)} "
            f"promoted={summary['queues'][queue]['promoted']} "
            f"claimed={summary['queues'][queue]['claimed']}"
        )
    return summary


__all__ = ["promote_missing_to_queue_head"]
