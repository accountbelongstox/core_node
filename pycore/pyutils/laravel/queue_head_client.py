# -*- coding: utf-8 -*-
"""Queue Center head-promotion client (Laravel queue_center_queue_head endpoints).

Wraps the single and batch head-promotion routes so ANY pycore actor
(orchestration, workers, tools) can enqueue-or-move a word/sentence set to the
Laravel queue head. Semantics mirror QueueCenterService::moveToHead: a live
duplicate is moved, an absent item is created once — concurrent Laravel/pycore
promotions race safely on the live-dedup unique index plus locked monotonic
head tickets. Offline tolerance: transport/HTTP failures degrade to a
``success=False`` result and local-only ordering; callers never raise.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.queue_center_contract import queue_center_endpoint
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.worker_result_delivery import short_http_error

# Contract diff_delivery.producer_batch_limits caps one batch call (word_audio
# 100; sentence_audio falls back to data_segment_limit 128). Chunk below both.
BATCH_CHUNK_SIZE = 100
HEAD_POST_TIMEOUT_SECONDS = 30


class QueueHeadClient:
    """Enqueue-or-move items to a Queue Center queue head."""

    @staticmethod
    def promote(
        queue: str,
        dedup_key: str,
        payload: Optional[Dict[str, Any]] = None,
        base_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Single-item promotion. Returns the endpoint result dict with an
        added ``success`` flag; never raises."""
        queue = str(queue or "").strip()
        dedup_key = str(dedup_key or "").strip()
        if not queue or not dedup_key:
            return {"success": False, "error": "queue and dedup_key are required"}
        try:
            resp = laravel_client.post(
                queue_center_endpoint("queue_center_queue_head", queue=queue),
                base_url=base_url,
                json={"dedup_key": dedup_key, "payload": payload or {}},
                timeout=HEAD_POST_TIMEOUT_SECONDS,
            )
            body = resp.json() if resp.content else {}
        except Exception as exc:  # noqa: BLE001
            ColorPrint.yellow(
                f"[QueueHead] promote {queue}:{dedup_key} failed: {short_http_error(exc)}"
            )
            return {"success": False, "error": short_http_error(exc)}
        if resp.status_code != 200 or not isinstance(body, dict) or body.get("success") is False:
            return {"success": False, "error": f"HTTP {resp.status_code}"}
        result = body.get("data") if isinstance(body.get("data"), dict) else {}
        return {"success": True, **result}

    @staticmethod
    def promote_batch(
        queue: str,
        items: List[Dict[str, Any]],
        base_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Batch promotion of ``[{dedup_key, payload?}, ...]``, chunked under
        the contract producer batch limit. Returns an aggregate:
        ``{success, queue, results, moved, created, promoted}`` where
        ``results`` carries every per-item entry (task_id, queue_position,
        created, head_action). Partial chunks failing transport are logged and
        skipped — the remaining chunks still promote."""
        queue = str(queue or "").strip()
        normalized = [
            {"dedup_key": str(item.get("dedup_key") or "").strip(),
             "payload": item.get("payload") if isinstance(item.get("payload"), dict) else {}}
            for item in items
            if isinstance(item, dict) and str(item.get("dedup_key") or "").strip()
        ]
        aggregate: Dict[str, Any] = {
            "success": True,
            "queue": queue,
            "results": [],
            "moved": 0,
            "created": 0,
            "promoted": 0,
        }
        if not queue or not normalized:
            aggregate["success"] = False
            aggregate["error"] = "queue and items are required"
            return aggregate

        for chunk_start in range(0, len(normalized), BATCH_CHUNK_SIZE):
            chunk = normalized[chunk_start:chunk_start + BATCH_CHUNK_SIZE]
            try:
                resp = laravel_client.post(
                    queue_center_endpoint("queue_center_queue_head_batch", queue=queue),
                    base_url=base_url,
                    json={"items": chunk},
                    timeout=HEAD_POST_TIMEOUT_SECONDS,
                )
                body = resp.json() if resp.content else {}
            except Exception as exc:  # noqa: BLE001
                aggregate["success"] = False
                ColorPrint.yellow(
                    f"[QueueHead] batch {queue} items {chunk_start + 1}-"
                    f"{chunk_start + len(chunk)} failed: {short_http_error(exc)}"
                )
                continue
            data = body.get("data") if isinstance(body, dict) else None
            if resp.status_code != 200 or not isinstance(data, dict):
                aggregate["success"] = False
                ColorPrint.yellow(
                    f"[QueueHead] batch {queue} items {chunk_start + 1}-"
                    f"{chunk_start + len(chunk)} -> HTTP {resp.status_code}"
                )
                continue
            results = data.get("results") if isinstance(data.get("results"), list) else []
            aggregate["results"].extend(results)
            aggregate["moved"] += int(data.get("moved") or 0)
            aggregate["created"] += int(data.get("created") or 0)

        aggregate["promoted"] = sum(
            1 for entry in aggregate["results"] if isinstance(entry, dict) and entry.get("ok")
        )
        return aggregate


queue_head_client = QueueHeadClient()


__all__ = ["BATCH_CHUNK_SIZE", "queue_head_client"]
