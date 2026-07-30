# -*- coding: utf-8 -*-
"""
TaskHeap - per-backend priority heap + jittered fast-drain burst.

Extracted (behavior-preserving) from the former translation_worker_service.py monolith.

REUSE-FIRST: instead of a third copy of the heap mechanics, this imports
``SentencePriorityQueue`` from the sentence-worker support component and extends
it to per-backend keying. One queue per Laravel base URL prevents interleaving.
``SentencePriorityQueue`` encapsulates the ``(-priority, seq)``
min-heap + FIFO tie-break on its own state owner; TaskHeap adds the
per-backend routing, the inflight-skip on enqueue, the dispatch-on-drain, and the
jittered fast-drain burst.

The heap operations are tightly coupled to worker state (inflight tracking,
_dispatch, _pull_tasks, circuit breaker, api_url, fast-drain knobs), so TaskHeap
holds a ``worker`` reference. This is CIRCULAR-IMPORT SAFE: task_heap.py imports
ONLY the sentence-worker support component + stdlib; it never imports worker.py
and receives the worker instance at construction time.

Rule §4: TaskHeap and every ``SentencePriorityQueue`` use THREAD_BUS-backed state
owners. Fast-drain lifecycle state and task startup also travel through the bus.
"""

import random
import time
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method, start_bus_task
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyctl.tts.sentence_worker_support import SentencePriorityQueue


class TaskHeap:
    """Per-backend priority heap of CLAIMED-but-unprocessed tasks + fast-drain burst."""

    def __init__(self, worker) -> None:
        self._worker = worker
        # base_url -> SentencePriorityQueue (one max-heap per backend so distinct
        # backends never interleave; FIFO tie-break is per-backend, which is
        # behaviorally identical to the original global seq since drain is
        # per-backend and tasks from different backends are never compared).
        self._heaps: Dict[str, "SentencePriorityQueue"] = {}
        self._fast_drain_signal = f"translation.fast_drain.active.{id(self)}"
        THREAD_BUS.signal(self._fast_drain_signal, False)
        init_serialized_owner(self, "translation.task_heap", "TranslationTaskHeapState")

    @staticmethod
    def task_priority(task: Dict[str, Any]) -> int:
        """Numeric priority of a pulled task (default 0). Higher drains first.

        Kept for API parity/traceability; SentencePriorityQueue.push handles the
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
            pq = SentencePriorityQueue()
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

    def depth(self) -> int:
        """Total queued (claimed-but-undispatched) tasks across all backends."""
        try:
            queues = list(self._heaps.values())
        except RuntimeError:
            queues = []
        return sum(len(queue) for queue in queues)

    def per_backend_depth(self) -> Dict[str, int]:
        """Per-backend queued depth (for get_queue_status)."""
        try:
            queues = list(self._heaps.items())
        except RuntimeError:
            queues = []
        return {base: len(queue) for base, queue in queues}

    def is_fast_drain_active(self) -> bool:
        """Whether a fast-drain burst thread is currently running."""
        return bool(THREAD_BUS.get_signal(self._fast_drain_signal, False))

    # -------------------- jittered fast-drain burst --------------------

    @serialized_method
    def maybe_start_fast_drain(self, pending_fast: int) -> None:
        """Arm a fast-drain burst when pending_fast>0 and none is already running."""
        if pending_fast <= 0:
            return
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
