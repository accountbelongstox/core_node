# -*- coding: utf-8 -*-
"""Queue Center head-promotion client (Laravel queue_center_queue_head endpoints).

Wraps the single and batch head-promotion routes so ANY pycore actor
(orchestration, workers, tools) can enqueue-or-move a word/sentence set to the
Laravel queue head. Semantics mirror QueueCenterService::moveToHead: a live
duplicate is moved, an absent item is created once — concurrent Laravel/pycore
promotions race safely on the live-dedup unique index plus locked monotonic
head tickets.

Offline-first contract: a promotion attempted while Laravel is unreachable is
NOT dropped — every failed item is persisted in a durable per-(endpoint, queue,
dedup_key) backlog (SQLite record store) and replayed at the first opportunity:
after the next successful batch, and on the Laravel online edge signal consumed
by the orchestration delivery loop. Replay posts through the same idempotent
batch endpoint, so duplicate replays race safely. Callers never raise.
"""

from __future__ import annotations

import hashlib
import time
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.system_paths import APP_CONFIG_DIR
from pycore.pyutils.common.durable_record_store import open_record_store
from pycore.pyutils.common.queue_center_contract import queue_center_endpoint
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager
from pycore.pyutils.laravel.worker_result_delivery import short_http_error

# Contract diff_delivery.producer_batch_limits caps one batch call (word_audio
# 100; sentence_audio falls back to data_segment_limit 128). Chunk below both.
BATCH_CHUNK_SIZE = 100
HEAD_POST_TIMEOUT_SECONDS = 30
# Replay uses a shorter timeout and a per-call chunk cap so a still-down
# Laravel never stalls the caller on a large backlog.
FLUSH_POST_TIMEOUT_SECONDS = 10
FLUSH_MAX_CHUNKS_PER_QUEUE = 10
PENDING_PROMOTIONS_FILE = "queue_head_pending_promotions.sqlite3"
# A probe result this fresh and unhealthy skips a replay attempt outright.
HEALTH_TTL_SECONDS = 30.0


def _pending_scope(base_url: Optional[str]) -> str:
    return str(base_url or "").strip().rstrip("/").lower()


class _PendingPromotionStore:
    """Durable backlog of head promotions attempted while Laravel was down.

    One row per (endpoint scope, queue, dedup_key); re-requesting the same key
    only refreshes the payload. Replay is idempotent server-side, so no leases
    are needed — a crashed replay simply replays again.
    """

    def __init__(self) -> None:
        self._store: Any = None
        init_serialized_owner(
            self,
            "laravel.queue_head_pending",
            "QueueHeadPendingPromotionsState",
        )

    def _records(self) -> Any:
        if self._store is None:
            self._store = open_record_store(APP_CONFIG_DIR / PENDING_PROMOTIONS_FILE)
        return self._store

    @staticmethod
    def _key(scope: str, queue: str, dedup_key: str) -> str:
        return hashlib.sha1(f"{scope}|{queue}|{dedup_key}".encode("utf-8")).hexdigest()

    @serialized_method
    def remember(self, scope: str, queue: str, items: List[Dict[str, Any]]) -> int:
        now = time.time()
        store = self._records()
        stored = 0
        with store.transaction():
            for item in items:
                dedup_key = str(item.get("dedup_key") or "").strip()
                if not dedup_key:
                    continue
                key = self._key(scope, queue, dedup_key)
                row = store.get(key) or {}
                store._write(key, {
                    "queue": queue,
                    "dedup_key": dedup_key,
                    "payload": item.get("payload") if isinstance(item.get("payload"), dict) else {},
                    "base_url_scope": scope,
                    "created_at": float(row.get("created_at") or now),
                    "updated_at": now,
                    "attempts": int(row.get("attempts") or 0),
                })
                stored += 1
        return stored

    @serialized_method
    def pending(self, scope: Optional[str] = None, queue: Optional[str] = None) -> List[Dict[str, Any]]:
        rows = [
            dict(row, _key=key)
            for key, row in self._records().records().items()
            if isinstance(row, dict)
            and (scope is None or str(row.get("base_url_scope") or "") == scope)
            and (queue is None or str(row.get("queue") or "") == queue)
        ]
        rows.sort(key=lambda row: float(row.get("created_at") or 0))
        return rows

    @serialized_method
    def delete_keys(self, keys: List[str]) -> None:
        store = self._records()
        with store.transaction():
            for key in keys:
                store.delete(key)

    @serialized_method
    def bump_attempts(self, keys: List[str]) -> None:
        store = self._records()
        now = time.time()
        with store.transaction():
            for key in keys:
                row = store.get(key)
                if not row:
                    continue
                row["attempts"] = int(row.get("attempts") or 0) + 1
                row["updated_at"] = now
                store._write(key, row)


_pending_promotions = _PendingPromotionStore()


def _remember_pending(scope: str, queue: str, items: List[Dict[str, Any]]) -> int:
    """Persist failed promotion items for replay on reconnect; never raises."""
    try:
        return _pending_promotions.remember(scope, queue, items)
    except Exception as exc:  # noqa: BLE001
        ColorPrint.red(f"[QueueHead] pending promotion store failed for {queue}: {exc}")
        return 0


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
        added ``success`` flag; never raises. A failed attempt is persisted
        and replayed by the next successful batch or reconnect flush."""
        queue = str(queue or "").strip()
        dedup_key = str(dedup_key or "").strip()
        if not queue or not dedup_key:
            return {"success": False, "error": "queue and dedup_key are required"}
        resolved_base = str(base_url or laravel_endpoint_manager.get_active_base_url() or "").rstrip("/")
        item = {"dedup_key": dedup_key, "payload": payload or {}}
        try:
            resp = laravel_client.post(
                queue_center_endpoint("queue_center_queue_head", queue=queue),
                base_url=resolved_base or None,
                json={"dedup_key": dedup_key, "payload": payload or {}},
                timeout=HEAD_POST_TIMEOUT_SECONDS,
            )
            body = resp.json() if resp.content else {}
        except Exception as exc:  # noqa: BLE001
            _remember_pending(_pending_scope(resolved_base), queue, [item])
            ColorPrint.yellow(
                f"[QueueHead] promote {queue}:{dedup_key} deferred: {short_http_error(exc)}"
            )
            return {"success": False, "deferred": True, "error": short_http_error(exc)}
        if resp.status_code != 200 or not isinstance(body, dict) or body.get("success") is False:
            _remember_pending(_pending_scope(resolved_base), queue, [item])
            return {"success": False, "deferred": True, "error": f"HTTP {resp.status_code}"}
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
        ``{success, queue, results, moved, created, promoted, deferred}`` where
        ``results`` carries every per-item entry (task_id, queue_position,
        created, head_action). Chunks failing transport are persisted into the
        durable pending backlog (``deferred`` counts them) instead of being
        dropped; once a batch goes through cleanly, the older backlog for this
        queue replays first (``flushed`` summarizes that replay)."""
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
            "deferred": 0,
        }
        if not queue or not normalized:
            aggregate["success"] = False
            aggregate["error"] = "queue and items are required"
            return aggregate

        resolved_base = str(base_url or laravel_endpoint_manager.get_active_base_url() or "").rstrip("/")
        scope = _pending_scope(resolved_base)
        transport_ok = True
        for chunk_start in range(0, len(normalized), BATCH_CHUNK_SIZE):
            chunk = normalized[chunk_start:chunk_start + BATCH_CHUNK_SIZE]
            try:
                resp = laravel_client.post(
                    queue_center_endpoint("queue_center_queue_head_batch", queue=queue),
                    base_url=resolved_base or None,
                    json={"items": chunk},
                    timeout=HEAD_POST_TIMEOUT_SECONDS,
                )
                body = resp.json() if resp.content else {}
            except Exception as exc:  # noqa: BLE001
                aggregate["success"] = False
                transport_ok = False
                aggregate["deferred"] += _remember_pending(scope, queue, chunk)
                ColorPrint.yellow(
                    f"[QueueHead] batch {queue} items {chunk_start + 1}-"
                    f"{chunk_start + len(chunk)} deferred: {short_http_error(exc)}"
                )
                continue
            data = body.get("data") if isinstance(body, dict) else None
            if resp.status_code != 200 or not isinstance(data, dict):
                aggregate["success"] = False
                transport_ok = False
                aggregate["deferred"] += _remember_pending(scope, queue, chunk)
                ColorPrint.yellow(
                    f"[QueueHead] batch {queue} items {chunk_start + 1}-"
                    f"{chunk_start + len(chunk)} deferred: HTTP {resp.status_code}"
                )
                continue
            results = data.get("results") if isinstance(data.get("results"), list) else []
            aggregate["results"].extend(results)
            aggregate["moved"] += int(data.get("moved") or 0)
            aggregate["created"] += int(data.get("created") or 0)

        aggregate["promoted"] = sum(
            1 for entry in aggregate["results"] if isinstance(entry, dict) and entry.get("ok")
        )
        if transport_ok:
            # Laravel is reachable: replay any older offline backlog for this
            # queue so previously deferred items re-enter the head order.
            flushed = QueueHeadClient.flush_pending(queue=queue, base_url=resolved_base or None)
            aggregate["flushed"] = {
                "promoted": int(flushed.get("promoted") or 0),
                "remaining": int(flushed.get("remaining") or 0),
                "success": bool(flushed.get("success")),
            }
        return aggregate

    @staticmethod
    def flush_pending(
        queue: Optional[str] = None,
        base_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Replay durably stored promotions against Laravel, oldest first.

        Called after a successful batch and on the Laravel online edge. A
        fresh unhealthy probe skips the replay without touching the backlog;
        transport failures stop the affected queue's replay and keep its rows
        for the next trigger. Never raises.
        """
        summary: Dict[str, Any] = {"success": True, "promoted": 0, "remaining": 0, "queues": {}}
        resolved_base = str(base_url or laravel_endpoint_manager.get_active_base_url() or "").rstrip("/")
        scope = _pending_scope(resolved_base)
        try:
            rows = _pending_promotions.pending(scope=scope or None, queue=queue or None)
            if not rows:
                return summary
            if scope:
                health = laravel_endpoint_manager.last_probe_result(scope)
                checked_ms = int(health.get("last_checked") or 0)
                if (
                    checked_ms
                    and time.time() - checked_ms / 1000.0 <= HEALTH_TTL_SECONDS
                    and not health.get("healthy")
                ):
                    summary["success"] = False
                    summary["skipped"] = "laravel_unhealthy"
                    summary["remaining"] = len(rows)
                    return summary
            by_queue: Dict[str, List[Dict[str, Any]]] = {}
            for row in rows:
                by_queue.setdefault(str(row.get("queue") or ""), []).append(row)
            for queue_name, queue_rows in by_queue.items():
                if not queue_name:
                    continue
                queue_summary = {"success": True, "promoted": 0, "remaining": 0}
                chunks = [
                    queue_rows[start:start + BATCH_CHUNK_SIZE]
                    for start in range(0, len(queue_rows), BATCH_CHUNK_SIZE)
                ][:FLUSH_MAX_CHUNKS_PER_QUEUE]
                for chunk in chunks:
                    keys = [str(row.get("_key") or "") for row in chunk]
                    payload = [
                        {"dedup_key": str(row.get("dedup_key") or ""),
                         "payload": row.get("payload") if isinstance(row.get("payload"), dict) else {}}
                        for row in chunk
                    ]
                    try:
                        resp = laravel_client.post(
                            queue_center_endpoint("queue_center_queue_head_batch", queue=queue_name),
                            base_url=resolved_base or None,
                            json={"items": payload},
                            timeout=FLUSH_POST_TIMEOUT_SECONDS,
                        )
                        body = resp.json() if resp.content else {}
                    except Exception as exc:  # noqa: BLE001
                        queue_summary["success"] = False
                        _pending_promotions.bump_attempts(keys)
                        ColorPrint.yellow(
                            f"[QueueHead] pending replay {queue_name} paused: {short_http_error(exc)}"
                        )
                        break
                    data = body.get("data") if isinstance(body, dict) else None
                    if resp.status_code != 200 or not isinstance(data, dict):
                        queue_summary["success"] = False
                        _pending_promotions.bump_attempts(keys)
                        ColorPrint.yellow(
                            f"[QueueHead] pending replay {queue_name} -> HTTP {resp.status_code}"
                        )
                        break
                    results = data.get("results") if isinstance(data.get("results"), list) else []
                    ok_keys = {
                        str(entry.get("dedup_key") or "")
                        for entry in results
                        if isinstance(entry, dict) and entry.get("ok")
                    }
                    done_keys = [
                        str(row.get("_key") or "")
                        for row in chunk
                        if str(row.get("dedup_key") or "") in ok_keys
                    ]
                    kept_keys = [key for key in keys if key and key not in done_keys]
                    if done_keys:
                        _pending_promotions.delete_keys(done_keys)
                    if kept_keys:
                        _pending_promotions.bump_attempts(kept_keys)
                    queue_summary["promoted"] += len(done_keys)
                queue_summary["remaining"] = len(
                    _pending_promotions.pending(scope=scope or None, queue=queue_name)
                )
                summary["queues"][queue_name] = queue_summary
                summary["promoted"] += queue_summary["promoted"]
                summary["remaining"] += queue_summary["remaining"]
                if not queue_summary["success"]:
                    summary["success"] = False
        except Exception as exc:  # noqa: BLE001
            ColorPrint.red(f"[QueueHead] pending replay failed: {exc}")
            summary["success"] = False
            summary["error"] = str(exc)
            return summary
        if summary["promoted"] or summary["remaining"]:
            ColorPrint.green(
                f"[QueueHead] offline promotion replay: promoted={summary['promoted']} "
                f"remaining={summary['remaining']}"
            )
        return summary


queue_head_client = QueueHeadClient()


__all__ = ["BATCH_CHUNK_SIZE", "queue_head_client", "QueueHeadClient"]
