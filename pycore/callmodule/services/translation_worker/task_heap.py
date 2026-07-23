# -*- coding: utf-8 -*-
"""
TaskHeap - per-backend priority heap + jittered fast-drain burst.

Extracted (behavior-preserving) from the former translation_worker_service.py monolith.

REUSE-FIRST (per plan): instead of a 3rd copy of the heap mechanics, this imports
``_PriorityQueue`` from tts_sentence_worker_service.py and EXTENDS it to per-backend
keying - one ``_PriorityQueue`` instance per Laravel base URL, so distinct backends
never interleave. ``_PriorityQueue`` already encapsulates the ``(-priority, seq)``
min-heap + FIFO tie-break as single GIL-atomic heapq calls; TaskHeap adds the
per-backend routing, the inflight-skip on enqueue, the dispatch-on-drain, and the
jittered fast-drain burst.

The heap operations are tightly coupled to worker state (inflight tracking,
_dispatch, _pull_tasks, circuit breaker, api_url, fast-drain knobs), so TaskHeap
holds a ``worker`` reference. This is CIRCULAR-IMPORT SAFE: task_heap.py imports
ONLY tts_sentence_worker_service (for _PriorityQueue) + stdlib - it NEVER imports
worker.py; it receives the worker instance at construction time.

Rule §4 (no manual locks):
  ``_heaps`` mutations are single GIL-atomic dict ops (setdefault/get), and
  ``_PriorityQueue`` is itself lock-free, so enqueue/drain need no TaskHeap-level
  lock; the worker's inflight guard stays the only serialization on enqueue.
  Fast-drain lifecycle state travels through THREAD_BUS. The burst runs on a
  named Thread subclass (TranslateFastDrainThread), never a bare Thread spawn.
"""

import random
import time
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method, start_bus_task
from pycore.pyfoundations.thread_bus import THREAD_BUS
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
        self._fast_drain_signal = f"translation.fast_drain.active.{id(self)}"
        THREAD_BUS.signal(self._fast_drain_signal, False)
        init_serialized_owner(self, "translation.task_heap", "TranslationTaskHeapState")

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

    @serialized_method
    def enqueue_tasks(self, base: str, tasks: List[Dict[str, Any]]) -> int:
        """Push claimed tasks onto ``base``'s priority heap (max-by-priority).

        Skips a task already in flight (so a re-pull of an unreleased claim does not
        double-enqueue). Returns the number actually enqueued.
        """
        added = 0
        pq = self._heaps.get(base)
        if pq is None:
            pq = _PriorityQueue()
            self._heaps[base] = pq
        for task in tasks:
            pq.push(task)
            added += 1
        return added

    @serialized_method
    def drain_heap(self, base: str) -> List[Dict[str, Any]]:
        """Return every queued task for ``base``, highest priority first."""
        tasks: List[Dict[str, Any]] = []
        while True:
            pq = self._heaps.get(base)
            if pq is None:
                return tasks
            task = pq.pop()
            if task is None:
                return tasks
            tasks.append(task)

    @serialized_method
    def depth(self) -> int:
        """Total queued (claimed-but-undispatched) tasks across all backends."""
        # Rule §4: lock-free snapshot; the worst-case race is a stale count.
        return sum(len(pq) for pq in self._heaps.values())

    @serialized_method
    def per_backend_depth(self) -> Dict[str, int]:
        """Per-backend queued depth (for get_queue_status)."""
        # Rule §4: lock-free snapshot; the worst-case race is a stale count.
        return {b: len(pq) for b, pq in self._heaps.items()}

    def is_fast_drain_active(self) -> bool:
        """Whether a fast-drain burst thread is currently running."""
        return bool(THREAD_BUS.get_signal(self._fast_drain_signal, False))

    # -------------------- jittered fast-drain burst --------------------

    @serialized_method
    def maybe_start_fast_drain(self, pending_fast: int) -> None:
        """Arm a fast-drain burst when pending_fast>0 and none is already running."""
        if pending_fast <= 0:
            return
        # Rule §4: plain GIL-atomic flag, no lock - poll_once (heartbeat thread)
        # is the only ARMER here (the burst thread only ever resets to False),
        # so check-then-set cannot double-spawn.
        if THREAD_BUS.get_signal(self._fast_drain_signal, False):
            return
        THREAD_BUS.signal(self._fast_drain_signal, True)
        start_bus_task(
            self._fast_drain_loop,
            thread_name="TranslateFastDrainThread",
        )

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
            state = worker._fast_drain_snapshot()
            deadline = time.monotonic() + state["drain_window"]
            while time.monotonic() < deadline:
                state = worker._fast_drain_snapshot()
                if not state["registered"] or worker._circuit_is_open():
                    break
                base = state["api_url"]
                tasks = worker._pull_tasks(base, wait=0)
                state = worker._fast_drain_snapshot()
                if tasks:
                    self.enqueue_tasks(base, tasks)
                    for task in self.drain_heap(base):
                        worker._dispatch(task)
                    # A productive pull extends the burst window.
                    deadline = time.monotonic() + state["drain_window"]
                if state["pending_fast"] <= 0 and not tasks:
                    break
                jitter = random.uniform(0, max(0.0, state["poll_jitter"]))
                time.sleep(state["poll_interval"] + jitter)
        except Exception as e:
            ColorPrint.yellow(f"{worker._log_prefix} fast-drain loop error: {e}")
        finally:
            THREAD_BUS.signal(self._fast_drain_signal, False)
