# -*- coding: utf-8 -*-
"""In-process sentence/audio task priority queue (max-heap on ``priority``).

Moved verbatim from the retired pyctl/tts/sentence_worker_support.py. Consumers:
the Laravel-pulled audio workers (pyctl/tts/laravel_audio_worker.py) and the
translation worker's former per-backend task heap (retired with the pull loop).
"""

import heapq
from typing import Any, Dict, List, Optional, Set, Tuple

from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method


class SentencePriorityQueue:
    """In-process max-heap on ``priority`` with FIFO tie-break by claim order.

    heapq is a MIN-heap, so the key is ``(-priority, seq)``: higher priority is
    popped first, and within an equal priority the earliest-claimed item (lowest
    monotonic ``seq``) wins — preserving FIFO across all claim batches.

    Rule §4: queue operations execute on one THREAD_BUS-backed state owner.
    """

    def __init__(self) -> None:
        self._heap: List[Tuple[int, int, Dict[str, Any]]] = []
        self._queued_keys: Set[str] = set()
        self._seq = 0
        init_serialized_owner(self, "tts.priority_queue", "TTSPriorityQueueState")

    @serialized_method
    def push(self, task: Dict[str, Any]) -> bool:
        """Add one execution attempt, updating a duplicate's queued priority."""
        try:
            priority = int(task.get("priority") or 0)
        except (TypeError, ValueError):
            priority = 0
        task_key = self._task_key(task)
        if task_key and task_key in self._queued_keys:
            for index, (negative_priority, sequence, queued_task) in enumerate(self._heap):
                if self._task_key(queued_task) != task_key:
                    continue
                if -negative_priority < priority:
                    self._heap[index] = (-priority, sequence, dict(task))
                    heapq.heapify(self._heap)
                return False
        heapq.heappush(self._heap, (-priority, self._seq, task))
        if task_key:
            self._queued_keys.add(task_key)
        self._seq += 1
        return True

    @serialized_method
    def pop(self) -> Optional[Dict[str, Any]]:
        """Pop the highest-priority task (FIFO within equal priority), or None."""
        if not self._heap:
            return None
        task = heapq.heappop(self._heap)[2]
        task_key = self._task_key(task)
        if task_key:
            self._queued_keys.discard(task_key)
        return task

    @serialized_method
    def contains(self, task: Dict[str, Any]) -> bool:
        """Return whether the same task execution attempt is already queued."""
        task_key = self._task_key(task)
        return bool(task_key and task_key in self._queued_keys)

    @staticmethod
    def _task_key(task: Dict[str, Any]) -> str:
        task_id = str(task.get("task_id") or "").strip()
        if not task_id:
            return ""
        raw_attempt = task.get("retry_count")
        attempt = int(raw_attempt) if isinstance(raw_attempt, int) else 0
        return f"{task_id}:{max(0, attempt)}"

    @serialized_method
    def bump(self, content_id: str, language: str, priority: int) -> bool:
        """Re-key the queued task matching content_id+language to ``priority``.

        heapq has no decrease-key; the heap holds at most a few claim batches,
        so a full heapify after mutating the one entry is the simple correct
        move. Returns True when a matching queued entry was found and re-keyed.
        """
        try:
            new_priority = int(priority)
        except (TypeError, ValueError):
            return False
        for index, (_neg, seq, task) in enumerate(self._heap):
            payload = task.get("payload") if isinstance(task.get("payload"), dict) else {}
            cid = (
                task.get("content_id")
                or task.get("sentence_id")
                or payload.get("content_id")
                or payload.get("hash")
                or ""
            )
            lang = task.get("language") or payload.get("language") or ""
            if str(cid) == str(content_id) and str(lang) == str(language):
                task["priority"] = new_priority
                self._heap[index] = (-new_priority, seq, task)
                heapq.heapify(self._heap)
                return True
        return False

    def __len__(self) -> int:
        return len(self._heap)
