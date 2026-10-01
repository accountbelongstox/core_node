# -*- coding: utf-8 -*-
"""Laravel delivery diff + batch client (W7 contract,
docs_fix/REQUIREMENTS_20260927_LARAVEL_DIFF_DELIVERY_REDIS_INDEX.md).

  * ``info``         - ``GET delivery/info`` per server id: supported diff
                       kinds and limits (cached); a server without it is a
                       legacy server (the outbox falls back per server).
  * ``diff``         - ``POST delivery/diff`` in chunks of the server's
                       limit; a chunk the server could not finish inside its
                       time budget is resent from ``next_index``. Every
                       answer is progress; only an idle window without any
                       processed item fails.
  * ``upload_batch`` - ``POST delivery/batch`` manifest, offset-v1 content
                       through ``laravel_progress_uploader``, then polls the
                       batch until ``done``; ``processed`` changes are
                       progress, only an idle window fails.

Every request uses the progress-driven transfer contract (no fixed total
deadline) and carries ``machine_id``.
"""

import hashlib
import time
import uuid
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.http_client import HttpTransferProgress
from pycore.pyutils.common.queue_center_contract import (
    QUEUE_CENTER_DELIVERY,
    http_transfer_contract,
)
from pycore.pyutils.laravel.client import laravel_client, laravel_envelope
from pycore.pyutils.common.client_key_auth import get_pycore_machine_id
from pycore.pyutils.laravel.progress_upload import laravel_progress_uploader


# W7 contract values (config/queue_center_contract.json #delivery).
_DELIVERY_ROUTES = QUEUE_CENTER_DELIVERY["routes"]
_DELIVERY_ERROR_CODES = QUEUE_CENTER_DELIVERY["error_codes"]
_DELIVERY_BATCH_LIMITS = QUEUE_CENTER_DELIVERY["batch_limits"]
DELIVERY_INFO_PATH = str(_DELIVERY_ROUTES["info"])
DELIVERY_DIFF_PATH = str(_DELIVERY_ROUTES["diff"])
DELIVERY_BATCH_PATH = str(_DELIVERY_ROUTES["batch"])
DELIVERY_BATCH_CONTENT_PATH = str(_DELIVERY_ROUTES["batch_content"])
DELIVERY_BATCH_STATUS_PATH = str(_DELIVERY_ROUTES["batch_status"])
DIFF_KIND_WORD_AUDIO = "word_audio"
DIFF_KIND_SENTENCE_AUDIO = "sentence_audio"
DIFF_KIND_ORCH_OUTPUT = "orch_output"
DIFF_KIND_ARTICLE = "article"
NEED_MISSING = str(QUEUE_CENTER_DELIVERY["diff_reasons"]["missing"])
NEED_STALE = str(QUEUE_CENTER_DELIVERY["diff_reasons"]["stale"])
BATCH_STATE_AWAITING_CONTENT = str(QUEUE_CENTER_DELIVERY["batch_states"]["awaiting_content"])
BATCH_STATE_DONE = str(QUEUE_CENTER_DELIVERY["batch_states"]["done"])
BATCH_STORED_STATUSES = tuple(QUEUE_CENTER_DELIVERY["batch_stored_statuses"])
BATCH_TERMINAL_REJECTIONS = tuple(QUEUE_CENTER_DELIVERY["batch_terminal_rejections"])
ERROR_BATCH_NOT_FOUND = str(_DELIVERY_ERROR_CODES["batch_not_found"])
ERROR_BATCH_CONTENT_MISMATCH = str(_DELIVERY_ERROR_CODES["batch_content_mismatch"])
# Fallback limits used before delivery/info answers, or when it omits one.
DEFAULT_DIFF_LIMITS = {
    str(kind): int(limit) for kind, limit in QUEUE_CENTER_DELIVERY["diff_item_limits"].items()
}
DEFAULT_DIFF_LIMIT = int(QUEUE_CENTER_DELIVERY["diff_item_limit_default"])
DEFAULT_BATCH_LIMITS = {
    key: int(_DELIVERY_BATCH_LIMITS[key]) for key in ("items", "item_bytes", "total_bytes")
}
BATCH_MIN_ITEM_BYTES = int(_DELIVERY_BATCH_LIMITS["min_item_bytes"])
BATCH_MANIFEST_ATTEMPTS = 2
INFO_TTL_SECONDS = 600.0
INFO_SIGNAL_PREFIX = "laravel.delivery.info"
MIN_POLL_SECONDS = 0.5

ProgressCallback = Callable[[Dict[str, Any]], None]


def _failure(response: Any, body: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "success": False,
        "status": int(response.status_code),
        "error_code": str(body.get("error_code") or ""),
        "error": f"HTTP {response.status_code} {body.get('error_code') or body.get('error') or ''}".strip(),
    }


class LaravelDeliveryDiffClient:
    """Stateless W7 diff / batch calls; per-server info cached on THREAD_BUS."""

    @staticmethod
    def _contract() -> Dict[str, Any]:
        return http_transfer_contract()

    def info(self, base_url: str, server_id: str) -> Dict[str, Any]:
        """``{available, kinds, limits}`` of one server (cached per id)."""
        signal = f"{INFO_SIGNAL_PREFIX}.{server_id}"
        cached = THREAD_BUS.get_signal(signal)
        if isinstance(cached, dict) and time.monotonic() - float(cached.get("observed_at") or 0) < INFO_TTL_SECONDS:
            return cached
        response = laravel_client.get(
            DELIVERY_INFO_PATH, base_url=base_url, params={"machine_id": get_pycore_machine_id()},
        )
        body = laravel_envelope(response)
        data = body.get("data") if isinstance(body.get("data"), dict) else {}
        info = {
            "available": response.status_code < 400 and bool(body.get("success")),
            "server_id": str(data.get("server_id") or server_id),
            "kinds": [str(kind) for kind in (data.get("kinds") or [])],
            "limits": data.get("limits") if isinstance(data.get("limits"), dict) else {},
            "index": data.get("index") if isinstance(data.get("index"), dict) else {},
            "status": int(response.status_code),
            "observed_at": time.monotonic(),
        }
        THREAD_BUS.signal(signal, info)
        return info

    def supports(self, base_url: str, server_id: str, kind: str) -> bool:
        if not server_id or not base_url:
            return False
        info = self.info(base_url, server_id)
        return bool(info["available"]) and kind in info["kinds"]

    def _diff_limit(self, base_url: str, server_id: str, kind: str) -> int:
        limits = (self.info(base_url, server_id).get("limits") or {}).get("diff") or {}
        return max(1, int(limits.get(kind) or DEFAULT_DIFF_LIMITS.get(kind) or DEFAULT_DIFF_LIMIT))

    def diff(
        self,
        base_url: str,
        server_id: str,
        kind: str,
        items: List[Dict[str, Any]],
        progress: Optional[ProgressCallback] = None,
    ) -> Dict[str, Any]:
        """Diff one inventory against the server. Returns ``{success,
        need: [{key, reason}], rejected, tasks, present, backend}``."""
        limit = self._diff_limit(base_url, server_id, kind)
        session_id = uuid.uuid4().hex
        chunk_count = max(1, (len(items) + limit - 1) // limit)
        contract = self._contract()
        stall = HttpTransferProgress(float(contract["idle_timeout_seconds"]))
        result: Dict[str, Any] = {"success": True, "need": [], "rejected": [], "tasks": [], "present": 0, "backend": ""}
        processed_total = 0
        for chunk_index in range(chunk_count):
            pending = items[chunk_index * limit:(chunk_index + 1) * limit]
            while pending:
                response = laravel_client.post(
                    DELIVERY_DIFF_PATH, base_url=base_url,
                    json={
                        "machine_id": get_pycore_machine_id(), "kind": kind, "items": pending,
                        "session_id": session_id, "chunk_index": chunk_index, "chunk_count": chunk_count,
                    }, log_line=False,
                )
                body = laravel_envelope(response)
                if response.status_code >= 400 or not body.get("success"):
                    return _failure(response, body)
                data = body.get("data") if isinstance(body.get("data"), dict) else {}
                processed = max(0, int(data.get("processed") or 0))
                result["need"].extend(entry for entry in (data.get("need") or []) if isinstance(entry, dict))
                result["rejected"].extend(entry for entry in (data.get("rejected") or []) if isinstance(entry, dict))
                result["tasks"].extend(entry for entry in (data.get("tasks") or []) if isinstance(entry, dict))
                result["present"] += int(data.get("present") or 0)
                result["backend"] = str(data.get("backend") or result["backend"])
                processed_total += processed
                stall.advance(processed_total)
                if progress is not None:
                    progress({"processed": processed_total, "total": len(items), "backend": result["backend"]})
                if data.get("complete", True):
                    break
                next_index = int(data.get("next_index") or 0)
                if next_index <= 0 and stall.stalled():
                    return {"success": False, "error": f"delivery diff made no progress for kind {kind}"}
                pending = pending[max(0, next_index):]
        ColorPrint.cyan(
            f"[LaravelDelivery] diff {kind} @ {base_url}: items={len(items)} present={result['present']} "
            f"need={len(result['need'])} rejected={len(result['rejected'])} backend={result['backend'] or '?'}"
        )
        return result

    # ------------------------------------------------------------------ #
    # batch upload                                                        #
    # ------------------------------------------------------------------ #
    def batch_limits(self, base_url: str, server_id: str) -> Dict[str, int]:
        limits = (self.info(base_url, server_id).get("limits") or {}).get("batch") or {}
        return {key: int(limits.get(key) or default) for key, default in DEFAULT_BATCH_LIMITS.items()}

    def batchable(self, base_url: str, server_id: str, size: int) -> bool:
        return BATCH_MIN_ITEM_BYTES <= int(size) <= self.batch_limits(base_url, server_id)["item_bytes"]

    def split_batches(self, base_url: str, server_id: str, items: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
        """Split ``[{..., content}]`` into batches within the server limits."""
        limits = self.batch_limits(base_url, server_id)
        batches: List[List[Dict[str, Any]]] = []
        current: List[Dict[str, Any]] = []
        current_bytes = 0
        for item in items:
            size = len(item["content"])
            if current and (len(current) >= limits["items"] or current_bytes + size > limits["total_bytes"]):
                batches.append(current)
                current, current_bytes = [], 0
            current.append(item)
            current_bytes += size
        if current:
            batches.append(current)
        return batches

    def upload_batch(
        self,
        base_url: str,
        kind: str,
        items: List[Dict[str, Any]],
        progress: Optional[ProgressCallback] = None,
    ) -> Dict[str, Any]:
        """Store ``[{key, content, text?, provider?, cleaned_word?}]`` (one
        server batch). Returns ``{success, results: {key: status}, error}``."""
        manifest = [
            {
                "key": item["key"],
                "sha256": hashlib.sha256(item["content"]).hexdigest(),
                "bytes": len(item["content"]),
                **{field: item[field] for field in ("text", "provider", "cleaned_word") if item.get(field)},
            }
            for item in items
        ]
        content = b"".join(item["content"] for item in items)
        outcome: Dict[str, Any] = {"success": False, "error": "delivery batch not attempted"}
        for _attempt in range(BATCH_MANIFEST_ATTEMPTS):
            outcome = self._upload_batch_once(base_url, kind, manifest, content, progress)
            if outcome["success"] or outcome.get("error_code") not in (ERROR_BATCH_NOT_FOUND, ERROR_BATCH_CONTENT_MISMATCH):
                return outcome
        return outcome

    def _upload_batch_once(
        self, base_url: str, kind: str, manifest: List[Dict[str, Any]], content: bytes,
        progress: Optional[ProgressCallback],
    ) -> Dict[str, Any]:
        machine_id = get_pycore_machine_id()
        contract = self._contract()
        response = laravel_client.post(
            DELIVERY_BATCH_PATH, base_url=base_url,
            json={"machine_id": machine_id, "kind": kind, "items": manifest},
        )
        body = laravel_envelope(response)
        if response.status_code >= 400 or not body.get("success"):
            return _failure(response, body)
        batch = body.get("data") if isinstance(body.get("data"), dict) else {}
        batch_id = str(batch.get("batch_id") or "")
        if not batch_id:
            return {"success": False, "error": "delivery batch response has no batch_id"}
        if str(batch.get("state") or "") == BATCH_STATE_AWAITING_CONTENT:
            receipt = laravel_progress_uploader.upload(
                DELIVERY_BATCH_CONTENT_PATH.replace("{batch_id}", batch_id), content,
                base_url=base_url, params={"machine_id": machine_id},
                progress_callback=progress, reason=f"delivery_batch_{kind}",
            )
            if not receipt.get("upload_complete"):
                return {"success": False, "error": f"delivery batch {batch_id} content upload incomplete"}
        return self._await_batch(base_url, batch_id, machine_id, contract, progress)

    @staticmethod
    def _await_batch(
        base_url: str, batch_id: str, machine_id: str, contract: Dict[str, Any], progress: Optional[ProgressCallback],
    ) -> Dict[str, Any]:
        stall = HttpTransferProgress(float(contract["idle_timeout_seconds"]))
        poll_seconds = max(MIN_POLL_SECONDS, float(contract["retry_interval_ms"]) / 1000.0)
        while not THREAD_BUS.is_shutdown_requested():
            response = laravel_client.get(
                DELIVERY_BATCH_STATUS_PATH.replace("{batch_id}", batch_id), base_url=base_url,
                params={"machine_id": machine_id}, log_line=False,
            )
            body = laravel_envelope(response)
            if response.status_code >= 400 or not body.get("success"):
                return _failure(response, body)
            data = body.get("data") if isinstance(body.get("data"), dict) else {}
            processed = int(data.get("processed") or 0)
            stall.advance(processed)
            if progress is not None:
                progress({"phase": "processing", "processed": processed, "total": int(data.get("total") or 0)})
            if str(data.get("state") or "") == BATCH_STATE_DONE:
                return {
                    "success": True,
                    "batch_id": batch_id,
                    "results": {
                        str(entry.get("key") or ""): str(entry.get("status") or "")
                        for entry in (data.get("results") or []) if isinstance(entry, dict)
                    },
                }
            if stall.stalled():
                return {"success": False, "error": f"delivery batch {batch_id} stalled at {processed} items"}
            time.sleep(poll_seconds)
        return {"success": False, "error": "shutdown requested"}


laravel_delivery_diff_client = LaravelDeliveryDiffClient()


__all__ = [
    "BATCH_STORED_STATUSES",
    "BATCH_TERMINAL_REJECTIONS",
    "DIFF_KIND_ARTICLE",
    "DIFF_KIND_ORCH_OUTPUT",
    "DIFF_KIND_SENTENCE_AUDIO",
    "DIFF_KIND_WORD_AUDIO",
    "NEED_MISSING",
    "NEED_STALE",
    "laravel_delivery_diff_client",
]
