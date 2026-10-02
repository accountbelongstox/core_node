# -*- coding: utf-8 -*-
"""Work-lease intake of one audio lane (word_audio / sentence_audio).

The lane holds only its leased batch plus a prefetch: it claims when its
open items fall to the prefetch level, declares the languages its pinned
engines speak (Laravel leases nothing else), renews held leases, releases
rows that failed and everything it holds when the lane stops or starts.
Leased rows enter the lane Queue as Part2 ``lease`` items; any generation of
the same identity (lane, orchestration) settles the row.
"""

from typing import Any, Dict, List, Optional

from pycore.pyfoundations.backoff_wait import Backoff
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.http_client import redacted_http_error
from pycore.pyutils.common.queue_center_contract import audio_dedup_key_from_task
from pycore.pyutils.tts.audio_queue_center import audio_queue_center
from pycore.pyutils.tts.audio_queue_model import (
    LOCAL_SOURCE_LEASE,
    LOCAL_SOURCE_MANUAL,
    LOCAL_SOURCE_ORCHESTRATION,
    build_local_task,
)
from pycore.pyutils.tts.engine_policy import lane_capability
from pycore.pyutils.tts.runtime_profile import WORD_BATCH_PROFILE
from pycore.pyctl.laravel.worker.work_leases import (
    BATCH_MAX,
    EMPTY_RETRY_AFTER_SECONDS,
    LEASE_TTL_SECONDS,
    LeaseBook,
    WANT_MAX,
    work_lease_client,
)

LEASE_RETRY_INITIAL_SECONDS = 5.0
LEASE_RETRY_MAX_SECONDS = 120.0
_WANT_SOURCES = (LOCAL_SOURCE_ORCHESTRATION, LOCAL_SOURCE_MANUAL)


class AudioLaneLeases:
    """Lease intake composed into one audio lane worker."""

    def __init__(self, worker: Any) -> None:
        self._worker = worker
        self._lane = str(worker.QUEUE_KEY)
        self._book = LeaseBook(worker.STATE_OWNER_NAME)
        self._backoff = Backoff(LEASE_RETRY_INITIAL_SECONDS, LEASE_RETRY_MAX_SECONDS)
        self._base_url = ""
        self._error_logged = ""
        self._pooled_logged: List[Dict[str, Any]] = []

    # -------------------- capability --------------------

    def capability(self) -> Dict[str, List[str]]:
        """Engines and languages this node declares for the lane."""
        return lane_capability(WORD_BATCH_PROFILE if self._lane == "word_audio" else "sentence")

    # -------------------- wiring --------------------

    def settled(self, outcomes: Dict[str, bool]) -> None:
        """Queue-center hook: identities reached a terminal state."""
        if self._book.settle(outcomes):
            self._worker.request_pull()

    def due(self) -> bool:
        """Cheap heartbeat check: a renew, release or claim is due."""
        if not self._worker._is_enabled():
            return bool(self._book.held_ids())
        if self._worker._lane_halt_requested():
            return False
        if self._book.renew_due():
            return True
        return not self._worker.intake_stopped() and self._book.claim_due(self._floor(), False)

    def _floor(self) -> int:
        concurrency, _engine = self._worker._effective_concurrency()
        return max(1, int(concurrency))

    # -------------------- cycle --------------------

    def tick(self, urgent: bool = False) -> Dict[str, Any]:
        """One lease round (runs inside the worker's coalesced pull cycle)."""
        worker = self._worker
        if not worker._is_enabled():
            if self._book.held_ids():
                self.release_all("lane_disabled")
            return {"leased": 0}
        if worker._lane_halt_requested():
            return {"leased": 0}
        base_url = worker.active_base_url()
        urgent = urgent and not worker.intake_stopped()
        if self._base_url and self._base_url != base_url:
            self.release_all("endpoint_changed")
        self._base_url = base_url
        try:
            self._flush_releases(base_url)
            if not worker.intake_stopped() and self._book.claim_due(self._floor(), urgent):
                return self._claim(base_url)
            due = self._book.renew_due()
            if due:
                self._apply_renewal(work_lease_client.renew(base_url, worker.worker_id, due))
            return {"leased": 0}
        except (OSError, RuntimeError, ValueError) as exc:
            error = redacted_http_error(exc)
            self._book.defer_claim(self._backoff.next_delay())
            if error != self._error_logged:
                self._error_logged = error
                ColorPrint.yellow(f"{worker.log_prefix} work lease unavailable ({error}); working the held batch")
            return {"leased": 0, "error": error}

    def _claim(self, base_url: str) -> Dict[str, Any]:
        worker = self._worker
        capability = self.capability()
        open_keys = self._book.open_keys()
        request = {
            "worker_id": worker.worker_id,
            "compute_class": worker.compute_identity["compute_class"],
            "throughput_per_hour": {self._lane: max(self._book.throughput_per_hour(), worker.capacity_per_hour())},
            "lanes": {self._lane: {**capability, "max_items": max(0, BATCH_MAX - len(open_keys))}},
            "want": self._want(open_keys),
            "lease_ids": self._book.held_ids(),
        }
        data = work_lease_client.claim(base_url, request)
        self._backoff.reset()
        self._error_logged = ""
        self._apply_renewal(data)
        lease_id = str(data.get("lease_id") or "")
        tasks: List[Dict[str, Any]] = []
        book_items: List[Dict[str, Any]] = []
        for item in data.get("items") or []:
            task = self._task(item, base_url) if isinstance(item, dict) else None
            if task is None:
                continue
            tasks.append(task)
            book_items.append({"key": audio_dedup_key_from_task(task, self._lane), "lane": self._lane, "row_id": item["row_id"]})
        if lease_id and book_items:
            self._book.add(lease_id, float(data.get("ttl_seconds") or LEASE_TTL_SECONDS), book_items)
        admitted = audio_queue_center.accept_leased(self._lane, tasks)
        retry_after = 0.0 if tasks else float(data.get("retry_after_seconds") or EMPTY_RETRY_AFTER_SECONDS)
        pooled = [entry for entry in data.get("pooled") or [] if isinstance(entry, dict)]
        self._book.note_claim(retry_after, pooled)
        if pooled != self._pooled_logged:
            self._pooled_logged = pooled
            if pooled:
                ColorPrint.gray(f"{worker.log_prefix} pooled (not leasable here): {pooled}")
        if tasks:
            ColorPrint.blue(
                f"{worker.log_prefix} leased {len(tasks)} row(s) lease={lease_id} "
                f"inserted={admitted['inserted']} merged={admitted['merged']} held={len(open_keys) + len(tasks)}"
            )
            worker._start_drain()
        return {"leased": len(tasks), **admitted}

    def _task(self, item: Dict[str, Any], base_url: str) -> Optional[Dict[str, Any]]:
        if str(item.get("lane") or self._lane) != self._lane or item.get("row_id") in (None, ""):
            return None
        language = str(item.get("language") or "")
        text = str(item.get("text") or "")
        if self._lane == "sentence_audio":
            task = build_local_task(
                self._lane, language, text, LOCAL_SOURCE_LEASE, base_url,
                extra_payload={"content_id": str(item.get("content_id") or "")} if item.get("content_id") else None,
            )
        else:
            task = build_local_task(
                self._lane, language, text, LOCAL_SOURCE_LEASE, base_url,
                extra_payload={"dict_row_id": int(item["row_id"])}, md5=str(item.get("md5") or ""),
            )
        if task is not None:
            task["queue_position"] = int(item.get("priority") or 0)
        return task

    def _want(self, open_keys: set) -> List[Dict[str, str]]:
        """Content this node's orchestration queued locally: Laravel leases
        those rows here first, so no other node generates them."""
        want: List[Dict[str, str]] = []
        for task in audio_queue_center.get_head(self._lane, WANT_MAX):
            if str(task.get("_local_source") or "") not in _WANT_SOURCES:
                continue
            if audio_dedup_key_from_task(task, self._lane) in open_keys:
                continue
            payload = task.get("payload") or {}
            content_key = str(payload.get("content_id") or "") if self._lane == "sentence_audio" else str(payload.get("md5") or "")
            if content_key:
                want.append({"lane": self._lane, "language": str(payload.get("language") or ""), "content_key": content_key})
        return want

    def _apply_renewal(self, data: Dict[str, Any]) -> None:
        progress = data.get("progress") if isinstance(data.get("progress"), dict) else {}
        if isinstance(progress.get(self._lane), dict):
            self._worker.record_queue_progress(self._lane, progress[self._lane])
        for entry in data.get("renewed") or []:
            if isinstance(entry, dict) and entry.get("lease_id"):
                self._book.renewed(str(entry["lease_id"]), float(entry.get("ttl_seconds") or LEASE_TTL_SECONDS))
        lost = [str(lease_id) for lease_id in data.get("lost") or [] if lease_id]
        if lost:
            dropped = audio_queue_center.drop_leased(self._lane, self._book.lost(lost))
            ColorPrint.yellow(f"{self._worker.log_prefix} lease lost: {lost} (dropped {dropped} unstarted row(s))")

    def _flush_releases(self, base_url: str) -> None:
        rows = self._book.take_releases()
        if not rows:
            return
        try:
            work_lease_client.release(
                base_url, self._worker.worker_id, rows=[{"lane": row["lane"], "row_id": row["row_id"]} for row in rows],
            )
        except (OSError, RuntimeError, ValueError):
            self._book.requeue_releases(rows)
            raise

    def release_all(self, reason: str) -> None:
        """Free every lease of this worker (lane start/stop, endpoint switch);
        unstarted leased rows leave the Queue."""
        base_url = self._base_url or self._worker.active_base_url()
        keys = self._book.clear()
        dropped = audio_queue_center.drop_leased(self._lane, keys) if keys else 0
        try:
            released = work_lease_client.release(base_url, self._worker.worker_id)
        except (OSError, RuntimeError, ValueError) as exc:
            ColorPrint.gray(
                f"{self._worker.log_prefix} lease release ({reason}) deferred to expiry: {redacted_http_error(exc)}"
            )
            return
        if released or dropped:
            ColorPrint.blue(f"{self._worker.log_prefix} released {released} leased row(s) ({reason}); dropped {dropped} queued")

    def status(self) -> Dict[str, Any]:
        return {**self._book.status(), **self.capability()}


__all__ = ["AudioLaneLeases"]
