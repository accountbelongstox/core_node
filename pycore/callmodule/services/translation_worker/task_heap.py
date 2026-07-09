# -*- coding: utf-8 -*-
"""
TaskHeap - per-backend priority heap + jittered fast-drain burst.

Extracted (behavior-preserving) from the former translation_worker_service.py monolith.

REUSE-FIRST (per plan): instead of a 3rd copy of the heap mechanics, this imports
``_PriorityQueue`` from tts_sentence_worker_service.py and EXTENDS it to per-backend
keying - one ``_PriorityQueue`` instance per Laravel base URL, so distinct backends
never interleave. ``_PriorityQueue`` already encapsulates the ``(-priority, seq)``
min-heap + its own lock + FIFO tie-break; TaskHeap adds the per-backend routing,
the inflight-skip on enqueue, the dispatch-on-drain, and the jittered fast-drain
burst.

The heap operations are tightly coupled to worker state (inflight tracking,
_dispatch, _pull_tasks, circuit breaker, api_url, fast-drain knobs), so TaskHeap
holds a ``worker`` reference. This is CIRCULAR-IMPORT SAFE: task_heap.py imports
ONLY tts_sentence_worker_service (for _PriorityQueue) + stdlib - it NEVER imports
worker.py; it receives the worker instance at construction time.

Lock ordering (deadlock-free):
  TaskHeap._lock (outer) -> worker._inflight_lock (mid, enqueue only) ->
  _PriorityQueue._lock (inner). _PriorityQueue never calls back into TaskHeap or
  the worker, and _dispatch/_pull_tasks run OUTSIDE TaskHeap._lock (matching the
  original, which released _heap_lock before dispatch).
"""

import random
import threading
import time
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
# REUSE the sibling's priority-queue primitive (single max-heap on priority with
# FIFO tie-break) rather than copying a 3rd heap implementation.
from pycore.callmodule.services.tts_sentence_worker_service import _PriorityQueue


class TaskHeap:
    """Per-backend priority heap of CLAIMED-but-unprocessed tasks + fast-drain burst."""

    def __init__(self, worker) -> None:
        self._worker = worker
        # base_url -> _PriorityQueue (one max-heap per backend so distinct
        # backends never interleave; FIFO tie-break is per-backend, which is
        # behaviorally identical to the original global seq since drain is
        # per-backend and tasks from different backends are never compared).
        self._heaps: Dict[str, "_PriorityQueue"] = {}
        self._lock = threading.Lock()
        # Fast-drain burst guard so only ONE burst thread runs at a time.
        self._fast_drain_active = False
        self._fast_drain_lock = threading.Lock()

    @staticmethod
    def task_priority(task: Dict[str, Any]) -> int:
        """Numeric priority of a pulled task (default 0). Higher drains first.

        Kept for API parity/traceability; _PriorityQueue.push internalizes the
        same non-numeric-safe parse.
        """
        try:
            return int(task.get("priority") or 0)
        except (TypeError, ValueError):
            return 0

    def enqueue_tasks(self, base: str, tasks: List[Dict[str, Any]]) -> int:
        """Push claimed tasks onto ``base``'s priority heap (max-by-priority).

        Skips a task already in flight (so a re-pull of an unreleased claim does not
        double-enqueue). Returns the number actually enqueued.
        """
        added = 0
        now = time.monotonic()
        with self._lock:
            pq = self._heaps.get(base)
            if pq is None:
                pq = _PriorityQueue()
                self._heaps[base] = pq
            for task in tasks:
                task_id = task.get("task_id")
                with self._worker._inflight_lock:
                    self._worker._purge_inflight_locked(now)
                    deadline = self._worker._inflight.get(task_id)
                    if deadline is not None and deadline > now:
                        continue  # still being processed
                pq.push(task)  # _PriorityQueue handles (-priority, seq) + its own lock
                added += 1
        return added

    def drain_heap(self, base: str) -> None:
        """Dispatch every queued task for ``base``, highest priority first."""
        while True:
            with self._lock:
                pq = self._heaps.get(base)
                if pq is None:
                    return
                task = pq.pop()  # None when empty; acquires pq._lock inside self._lock
            if task is None:
                return
            # Dispatch OUTSIDE self._lock (matches original: release heap lock first).
            self._worker._dispatch(task)

    def depth(self) -> int:
        """Total queued (claimed-but-undispatched) tasks across all backends."""
        with self._lock:
            return sum(len(pq) for pq in self._heaps.values())

    def per_backend_depth(self) -> Dict[str, int]:
        """Per-backend queued depth (for get_queue_status)."""
        with self._lock:
            return {b: len(pq) for b, pq in self._heaps.items()}

    def is_fast_drain_active(self) -> bool:
        """Whether a fast-drain burst thread is currently running."""
        return self._fast_drain_active

    # -------------------- jittered fast-drain burst --------------------

    def maybe_start_fast_drain(self) -> None:
        """Arm a fast-drain burst when pending_fast>0 and none is already running."""
        if self._worker._pending_fast <= 0:
            return
        with self._fast_drain_lock:
            if self._fast_drain_active:
                return
            self._fast_drain_active = True
        threading.Thread(
            target=self._fast_drain_loop, daemon=True, name="translate-fast-drain",
        ).start()

    def _fast_drain_loop(self) -> None:
        """Burst-PULL the fast lane while pending_fast persists.

        This loop ONLY pulls (wait=0) at TRANSLATION_FAST_POLL_INTERVAL with a small
        random jitter so N workers do not synchronize their pulls - it never sends a
        heartbeat (the ~12s heartbeat callback keeps the lease/registration fresh;
        duplicating it here would only add load). Claimed tasks are folded onto the
        per-backend priority heap and drained immediately. The burst runs for at most
        TRANSLATION_FAST_DRAIN_WINDOW, then yields back to the heartbeat cadence; a
        fresh pending_fast signal re-arms it.
        """
        worker = self._worker
        try:
            deadline = time.monotonic() + worker.TRANSLATION_FAST_DRAIN_WINDOW
            while time.monotonic() < deadline:
                if not worker._registered or worker._circuit_is_open():
                    break
                base = worker.api_url
                tasks = worker._pull_tasks(base, wait=0)
                if tasks:
                    self.enqueue_tasks(base, tasks)
                    self.drain_heap(base)
                    # A productive pull extends the burst window.
                    deadline = time.monotonic() + worker.TRANSLATION_FAST_DRAIN_WINDOW
                if worker._pending_fast <= 0 and not tasks:
                    break
                jitter = random.uniform(0, max(0.0, worker.TRANSLATION_FAST_POLL_JITTER))
                time.sleep(worker.TRANSLATION_FAST_POLL_INTERVAL + jitter)
        except Exception as e:
            ColorPrint.yellow(f"{worker._log_prefix} fast-drain loop error: {e}")
        finally:
            with self._fast_drain_lock:
                self._fast_drain_active = False
