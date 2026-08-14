#!/usr/bin/env python3
"""In-memory Qwen3-TTS FIFO queue used by the standalone API server.

Submission order is the only local order: Laravel's Queue Center owns which
job is submitted first (queue_position head tickets), so this queue must not
re-order accepted synthesis work behind a second priority authority."""
from __future__ import annotations

import asyncio
import os
import time
import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Any, Callable, Deque, Dict, List, Optional

DEFAULT_QUEUE_MAX = 200
DEFAULT_RESULT_TTL_S = 900.0
DEFAULT_RESULT_MAX = 200
DEFAULT_TASK_TIMEOUT_S = 900.0
TERMINAL_STATES = {"done", "failed", "cancelled"}


def _env_int(name: str, default: int, minimum: int = 1) -> int:
    raw = (os.environ.get(name) or "").strip()
    try:
        return max(minimum, int(raw)) if raw else default
    except ValueError:
        return default


def _env_float(name: str, default: float, minimum: float = 1.0) -> float:
    raw = (os.environ.get(name) or "").strip()
    try:
        return max(minimum, float(raw)) if raw else default
    except ValueError:
        return default


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class QueueFullError(RuntimeError):
    """Raised when the configured active-job limit has been reached."""


class QwenQueue:
    """One event-loop-owned FIFO queue with authoritative job state."""

    def __init__(
        self,
        synthesize_batch: Callable[[List[Dict[str, Any]]], List[Dict[str, Any]]],
        max_parallel: Callable[[], int],
        logger: Callable[[str], None],
        event_publisher: Optional[Callable[[str, Dict[str, Any]], None]] = None,
    ) -> None:
        self._synthesize_batch = synthesize_batch
        self._max_parallel = max_parallel
        self._logger = logger
        self._event_publisher = event_publisher
        self._queue_max = _env_int("QWEN3TTS_QUEUE_MAX", DEFAULT_QUEUE_MAX)
        self._result_ttl_s = _env_float(
            "QWEN3TTS_QUEUE_RESULT_TTL_S", DEFAULT_RESULT_TTL_S
        )
        self._result_max = _env_int("QWEN3TTS_QUEUE_RESULT_MAX", DEFAULT_RESULT_MAX)
        self._task_timeout_s = _env_float(
            "QWEN3TTS_TASK_TIMEOUT_S", DEFAULT_TASK_TIMEOUT_S
        )
        self._jobs: Dict[str, Dict[str, Any]] = {}
        self._client_jobs: Dict[str, str] = {}
        self._queue: Deque[str] = deque()
        self._seq = 0
        self._instance_id = uuid.uuid4().hex
        self._wake = asyncio.Event()
        self._stopping = False
        self._consumer: Optional[asyncio.Task] = None
        self._completed_count = 0
        self._failed_count = 0
        self._total_elapsed_ms = 0

    @property
    def queue_max(self) -> int:
        return self._queue_max

    @property
    def task_timeout_s(self) -> float:
        return self._task_timeout_s

    async def start(self) -> None:
        if self._consumer is not None and not self._consumer.done():
            return
        self._stopping = False
        self._consumer = asyncio.create_task(
            self._consume(), name="qwen3tts-queue-consumer"
        )

    async def stop(self) -> None:
        self._stopping = True
        self._wake.set()
        consumer = self._consumer
        self._consumer = None
        if consumer is not None:
            consumer.cancel()
            try:
                await consumer
            except asyncio.CancelledError:
                pass

    async def submit(self, params: Dict[str, Any]) -> Dict[str, Any]:
        self._cleanup()
        text = str(params.get("text") or "").strip()
        if not text:
            raise ValueError("empty text")
        client_job_id = str(
            params.get("client_job_id") or params.get("job_id") or ""
        ).strip()
        existing_id = self._client_jobs.get(client_job_id) if client_job_id else None
        if existing_id and existing_id in self._jobs:
            return self._public_job(self._jobs[existing_id], include_summary=False)
        active = sum(
            1 for job in self._jobs.values() if job.get("status") not in TERMINAL_STATES
        )
        if active >= self._queue_max:
            raise QueueFullError(f"queue full ({active}/{self._queue_max})")

        job_id = client_job_id or uuid.uuid4().hex
        if job_id in self._jobs:
            return self._public_job(self._jobs[job_id], include_summary=False)
        now = _utc_now()
        job: Dict[str, Any] = {
            "job_id": job_id,
            "client_job_id": client_job_id or None,
            "text": text,
            "language": str(params.get("language") or "en").strip() or "en",
            "speaker": str(params.get("speaker") or "").strip() or None,
            "instruct": str(params.get("instruct") or "").strip() or None,
            "format": "wav" if str(params.get("format") or "mp3").lower() == "wav" else "mp3",
            "submitted_at": now,
            "started_at": None,
            "finished_at": None,
            "status": "pending",
            "elapsed_ms": None,
            "error": None,
            "result": None,
            "_audio": None,
            "_media_type": None,
            "_terminal_monotonic": None,
            "_started_monotonic": None,
            "_cancel_requested": False,
        }
        self._jobs[job_id] = job
        if client_job_id:
            self._client_jobs[client_job_id] = job_id
        self._queue.append(job_id)
        self._emit("queue.job.queued", job)
        self._wake.set()
        return self._public_job(job, include_summary=False)

    async def cancel(self, job_id: str) -> bool:
        job = self._jobs.get(str(job_id or "").strip())
        if job is None or job.get("status") in TERMINAL_STATES:
            return False
        if job.get("status") == "pending":
            self._finish_cancelled(job)
        else:
            job["_cancel_requested"] = True
        return True

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        self._cleanup()
        return self._jobs.get(str(job_id or "").strip())

    def status(self) -> Dict[str, Any]:
        self._cleanup()
        jobs = sorted(
            self._jobs.values(),
            key=lambda item: str(item.get("submitted_at") or ""),
            reverse=True,
        )
        counts = {
            state: sum(1 for job in jobs if job.get("status") == state)
            for state in ("pending", "running", "done", "failed", "cancelled")
        }
        synthesized = self._completed_count + self._failed_count
        running_elapsed = [
            max(
                0,
                round(
                    (time.monotonic() - float(job.get("_started_monotonic") or 0))
                    * 1000
                ),
            )
            for job in jobs
            if job.get("status") == "running" and job.get("_started_monotonic")
        ]
        oldest_running_ms = max(running_elapsed, default=0)
        consumer_running = bool(
            self._consumer is not None and not self._consumer.done()
        )
        return {
            "queue_max": self._queue_max,
            "task_timeout_s": self._task_timeout_s,
            "result_ttl_s": self._result_ttl_s,
            "seq": self._seq,
            "instance_id": self._instance_id,
            "consumer_running": consumer_running,
            "oldest_running_ms": oldest_running_ms,
            "stalled": bool(
                not consumer_running
                or oldest_running_ms > round(self._task_timeout_s * 1000)
            ),
            "counts": counts,
            "jobs": [self._public_job(job) for job in jobs],
            "synthesized_count": synthesized,
            "completed_count": self._completed_count,
            "failed_count": self._failed_count,
            "average_elapsed_ms": round(self._total_elapsed_ms / synthesized) if synthesized else 0,
        }

    async def _consume(self) -> None:
        while not self._stopping:
            limit = await asyncio.to_thread(self._max_parallel)
            batch = self._take_batch(limit)
            if not batch:
                self._wake.clear()
                if self._queue:
                    self._wake.set()
                    continue
                await self._wake.wait()
                continue
            started = time.monotonic()
            for job in batch:
                job["status"] = "running"
                job["started_at"] = _utc_now()
                job["_started_monotonic"] = time.monotonic()
                self._emit("queue.job.running", job)
            try:
                results = await asyncio.wait_for(
                    asyncio.to_thread(self._synthesize_batch, batch),
                    timeout=self._task_timeout_s,
                )
                self._apply_results(batch, results, started)
            except asyncio.TimeoutError:
                self._fail_batch(batch, f"task timed out after {self._task_timeout_s:g}s", started)
            except Exception as exc:  # noqa: BLE001
                self._fail_batch(batch, str(exc), started)

    def _take_batch(self, max_parallel: int) -> List[Dict[str, Any]]:
        first = self._pop_pending()
        if first is None:
            return []
        limit = max(1, int(max_parallel or 1))
        language = first.get("language")
        batch = [first]
        while self._queue and len(batch) < limit:
            job_id = self._queue[0]
            job = self._jobs.get(job_id)
            if job is None or job.get("status") != "pending":
                self._queue.popleft()
                continue
            if job.get("language") != language:
                break
            self._queue.popleft()
            batch.append(job)
        return batch

    def _pop_pending(self) -> Optional[Dict[str, Any]]:
        while self._queue:
            job_id = self._queue.popleft()
            job = self._jobs.get(job_id)
            if job is not None and job.get("status") == "pending":
                return job
        return None

    def _apply_results(
        self,
        batch: List[Dict[str, Any]],
        results: List[Dict[str, Any]],
        started: float,
    ) -> None:
        elapsed_ms = round((time.monotonic() - started) * 1000)
        for index, job in enumerate(batch):
            if job.get("_cancel_requested"):
                self._finish_cancelled(job, elapsed_ms)
                continue
            result = results[index] if index < len(results) else {"ok": False, "error": "missing batch result"}
            job["elapsed_ms"] = elapsed_ms
            job["finished_at"] = _utc_now()
            job["_terminal_monotonic"] = time.monotonic()
            if result.get("ok"):
                audio = result.get("audio") or b""
                job["status"] = "done"
                job["_audio"] = audio
                job["_media_type"] = result.get("media_type") or "application/octet-stream"
                job["speaker"] = result.get("speaker") or job.get("speaker")
                job["result"] = {
                    "bytes": len(audio),
                    "format": job.get("format"),
                    "result_url": f"/queue/result/{job['job_id']}",
                }
                self._completed_count += 1
                self._total_elapsed_ms += elapsed_ms
                self._emit("queue.job.completed", job)
            else:
                job["status"] = "failed"
                job["error"] = str(result.get("error") or "synthesis failed")
                self._failed_count += 1
                self._total_elapsed_ms += elapsed_ms
                self._emit("queue.job.failed", job)

    def _fail_batch(
        self, batch: List[Dict[str, Any]], error: str, started: float
    ) -> None:
        elapsed_ms = round((time.monotonic() - started) * 1000)
        self._logger(f"[queue] batch failed: {error}")
        for job in batch:
            if job.get("_cancel_requested"):
                self._finish_cancelled(job, elapsed_ms)
                continue
            job["status"] = "failed"
            job["error"] = error
            job["elapsed_ms"] = elapsed_ms
            job["finished_at"] = _utc_now()
            job["_terminal_monotonic"] = time.monotonic()
            self._failed_count += 1
            self._total_elapsed_ms += elapsed_ms
            self._emit("queue.job.failed", job)

    def _finish_cancelled(self, job: Dict[str, Any], elapsed_ms: int = 0) -> None:
        job["status"] = "cancelled"
        job["elapsed_ms"] = elapsed_ms
        job["finished_at"] = _utc_now()
        job["_terminal_monotonic"] = time.monotonic()
        self._emit("queue.job.cancelled", job)

    def _emit(self, event_name: str, job: Dict[str, Any]) -> None:
        self._seq += 1
        public = self._public_job(job)
        event = {
            "type": "event",
            "event": event_name,
            "seq": self._seq,
            "instance_id": self._instance_id,
            "job_id": job["job_id"],
            "client_job_id": job.get("client_job_id"),
            "ok": job.get("status") == "done",
            "status": job.get("status"),
            "elapsed_ms": job.get("elapsed_ms"),
            "error": job.get("error"),
            "result_url": public.get("result_url"),
            "job": public,
        }
        if self._event_publisher is not None:
            try:
                self._event_publisher(event_name, dict(event))
            except Exception as exc:  # noqa: BLE001
                self._logger(f"[queue] event publication failed: {exc}")

    def _public_job(
        self, job: Dict[str, Any], include_summary: bool = True
    ) -> Dict[str, Any]:
        result = job.get("result") if isinstance(job.get("result"), dict) else {}
        public = {
            "job_id": job.get("job_id"),
            "client_job_id": job.get("client_job_id"),
            "language": job.get("language"),
            "speaker": job.get("speaker"),
            "format": job.get("format"),
            "submitted_at": job.get("submitted_at"),
            "started_at": job.get("started_at"),
            "finished_at": job.get("finished_at"),
            "status": job.get("status"),
            "elapsed_ms": job.get("elapsed_ms"),
            "running_elapsed_ms": (
                max(
                    0,
                    round(
                        (
                            time.monotonic()
                            - float(job.get("_started_monotonic") or 0)
                        ) * 1000
                    ),
                )
                if job.get("status") == "running" and job.get("_started_monotonic")
                else None
            ),
            "error": job.get("error"),
            "result_url": result.get("result_url"),
            "result_bytes": result.get("bytes"),
        }
        if include_summary:
            public["text_summary"] = str(job.get("text") or "")[:120]
        return public

    def _cleanup(self) -> None:
        now = time.monotonic()
        terminal = [
            job for job in self._jobs.values() if job.get("status") in TERMINAL_STATES
        ]
        terminal.sort(key=lambda item: float(item.get("_terminal_monotonic") or 0), reverse=True)
        keep_ids = {str(job["job_id"]) for job in terminal[: self._result_max]}
        for job in terminal:
            terminal_at = float(job.get("_terminal_monotonic") or now)
            if job["job_id"] in keep_ids and now - terminal_at <= self._result_ttl_s:
                continue
            self._jobs.pop(str(job["job_id"]), None)
            client_job_id = str(job.get("client_job_id") or "")
            if client_job_id and self._client_jobs.get(client_job_id) == job["job_id"]:
                self._client_jobs.pop(client_job_id, None)


__all__ = ["QueueFullError", "QwenQueue"]
