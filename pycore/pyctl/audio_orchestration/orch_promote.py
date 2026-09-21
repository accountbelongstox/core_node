# -*- coding: utf-8 -*-
"""Audio-orchestration queue-head self-promotion (collaboration with Laravel).

When a manifest resolves its resources, the local-cache misses are the set
this machine still needs. Promoting that set to the Laravel Queue Center head
BEFORE generation means any online audio worker (this machine's lanes or a
peer's) drains exactly those items next, instead of walking the catalog-order
backlog. Laravel gateways (wordnew UI resource requests) promote the same way,
so both sides race on the same enqueue-or-move contract: a live duplicate is
moved, an absent item is created once, never a second live row per dedup key.

After the backend accepts the batch, the returned head tickets are applied to
the LOCAL lane queues too (same path as the realtime head event), so this
pycore's own workers pop the missing resources first even before the next
diff sync.

Offline-first: a promotion attempted while Laravel is unreachable is persisted
by the queue-head client (deferred) and replayed on the reconnect edge, so the
missed set still reaches the shared queue head once the backend returns; local
generation of the misses proceeds regardless.
"""

from __future__ import annotations

import hashlib
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.strtools.normalization import media_content_id
from pycore.pyutils.laravel.queue_head_client import queue_head_client
from pycore.pyctl.queue_center.lane_registry import lane_worker

_QUEUE_WORD_AUDIO = "word_audio"
_QUEUE_SENTENCE_AUDIO = "sentence_audio"


def _dedup_key(queue: str, language: str, content_id: str) -> str:
    """Mirrors QueueCenterService::dedupKeyFor: "{lang}:{contentId}"."""
    return f"{language.strip().lower()}:{content_id.strip()}"


def _promotion_item(resource: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    kind = str(resource.get("kind") or "")
    text = str(resource.get("text") or "").strip()
    language = str(resource.get("language") or "").strip()
    if not text or not language:
        return None
    if kind == "sentence":
        content_id = media_content_id(text)
        return {
            "queue": _QUEUE_SENTENCE_AUDIO,
            "dedup_key": _dedup_key(_QUEUE_SENTENCE_AUDIO, language, content_id),
            "payload": {"text": text, "language": language, "content_id": content_id},
        }
    if kind == "word":
        digest = hashlib.md5(text.lower().encode("utf-8")).hexdigest()
        return {
            "queue": _QUEUE_WORD_AUDIO,
            "dedup_key": _dedup_key(_QUEUE_WORD_AUDIO, language, digest),
            "payload": {"word": text, "language": language, "md5": digest},
        }
    return None


def _apply_local_head_order(queue: str, results: List[Dict[str, Any]]) -> int:
    """Mirror the promoted head tickets into this process's lane worker, the
    same move the realtime ``{queue}_head`` event performs. Unknown task ids
    are harmless: the bounded diff segment store just records the ticket."""
    worker = lane_worker(queue)
    if worker is None:
        return 0
    applied = 0
    for entry in results:
        if not isinstance(entry, dict) or not entry.get("ok"):
            continue
        task_id = str(entry.get("task_id") or "").strip()
        if not task_id:
            continue
        worker.set_cached_task_head(task_id, int(entry.get("queue_position") or 0))
        applied += 1
    if applied:
        worker.request_pull(prefer_remote=True)
    return applied


def promote_missing_to_queue_head(
    misses: List[Dict[str, Any]],
    base_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Enqueue-or-move every missing manifest resource to its Laravel queue
    head, then apply the same head order to the local lane queues. Never
    raises and never blocks generation on a Laravel outage — failed chunks
    are durably deferred by the queue-head client and replayed on reconnect,
    while the resolver still generates the misses itself.
    """
    items_by_queue: Dict[str, List[Dict[str, Any]]] = {}
    for resource in misses:
        item = _promotion_item(resource)
        if item is None:
            continue
        items_by_queue.setdefault(item["queue"], []).append(item)

    summary: Dict[str, Any] = {"success": True, "queues": {}, "promoted": 0, "deferred": 0}
    for queue, items in items_by_queue.items():
        result = queue_head_client.promote_batch(
            queue,
            [{"dedup_key": item["dedup_key"], "payload": item["payload"]} for item in items],
            base_url=base_url,
        )
        applied = _apply_local_head_order(queue, result.get("results") or [])
        flushed = result.get("flushed") if isinstance(result.get("flushed"), dict) else {}
        summary["queues"][queue] = {
            "requested": len(items),
            "promoted": int(result.get("promoted") or 0),
            "created": int(result.get("created") or 0),
            "moved": int(result.get("moved") or 0),
            "deferred": int(result.get("deferred") or 0),
            "replayed": int(flushed.get("promoted") or 0),
            "local_head_applied": applied,
            "success": bool(result.get("success")),
        }
        summary["promoted"] += int(result.get("promoted") or 0)
        summary["deferred"] += int(result.get("deferred") or 0)
        if not result.get("success"):
            summary["success"] = False
        ColorPrint.green(
            f"[AudioOrch] promoted {queue} head: requested={len(items)} "
            f"promoted={summary['queues'][queue]['promoted']} "
            f"created={summary['queues'][queue]['created']} "
            f"deferred={summary['queues'][queue]['deferred']} "
            f"local_applied={applied}"
        )
    return summary


__all__ = ["promote_missing_to_queue_head"]
