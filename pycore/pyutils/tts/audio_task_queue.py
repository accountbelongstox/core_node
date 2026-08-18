# -*- coding: utf-8 -*-
"""In-process task ordering shared by Laravel audio workers."""

import heapq
from typing import Any, Dict, List, Optional, Set, Tuple

from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method


class AudioTaskQueue:
    """Order head-ticket queues by queue_position and preserve FIFO ties."""

    def __init__(self, queue_name: str = "audio") -> None:
        self._heap: List[Tuple[int, int, Dict[str, Any]]] = []
        self._active_keys: Set[str] = set()
        self._seq = 0
        init_serialized_owner(
            self,
            f"tts.audio_queue.{queue_name}",
            f"AudioTaskQueueState.{queue_name}",
        )

    def _order(self, task: Dict[str, Any], sequence: int) -> Tuple[int, int]:
        try:
            queue_position = int(task.get("queue_position") or 0)
        except (TypeError, ValueError):
            queue_position = 0
        return -queue_position, sequence

    @serialized_method
    def push(self, task: Dict[str, Any]) -> bool:
        """Add one execution attempt or refresh a queued duplicate's order."""
        task_key = self._task_key(task)
        if task_key and task_key in self._active_keys:
            for index, entry in enumerate(self._heap):
                queued_task = entry[2]
                if self._task_key(queued_task) != task_key:
                    continue
                order = self._order(task, entry[1])
                if order < entry[:2]:
                    self._heap[index] = (*order, dict(task))
                    heapq.heapify(self._heap)
                return False
            return False
        order = self._order(task, self._seq)
        heapq.heappush(self._heap, (*order, task))
        if task_key:
            self._active_keys.add(task_key)
        self._seq += 1
        return True

    @serialized_method
    def pop(self) -> Optional[Dict[str, Any]]:
        """Pop the current queue head or return None."""
        if not self._heap:
            return None
        return heapq.heappop(self._heap)[2]

    @serialized_method
    def complete(self, task: Dict[str, Any]) -> None:
        task_key = self._task_key(task)
        if task_key:
            self._active_keys.discard(task_key)

    @serialized_method
    def contains(self, task: Dict[str, Any]) -> bool:
        task_key = self._task_key(task)
        return bool(task_key and task_key in self._active_keys)

    @serialized_method
    def active_count(self) -> int:
        return len(self._active_keys)

    @staticmethod
    def _task_key(task: Dict[str, Any]) -> str:
        task_id = str(task.get("task_id") or "").strip()
        if not task_id:
            return ""
        raw_attempt = task.get("retry_count")
        attempt = int(raw_attempt) if isinstance(raw_attempt, int) else 0
        return f"{task_id}:{max(0, attempt)}"

    @serialized_method
    def move_to_head(self, task_id: Any, queue_position: int) -> bool:
        task_key = str(task_id or "").strip()
        if not task_key:
            return False
        try:
            position = int(queue_position)
        except (TypeError, ValueError):
            return False
        for index, entry in enumerate(self._heap):
            task = entry[2]
            if str(task.get("task_id") or "").strip() != task_key:
                continue
            task["queue_position"] = position
            self._heap[index] = (-position, entry[1], task)
            heapq.heapify(self._heap)
            return True
        return False

    def __len__(self) -> int:
        return len(self._heap)


__all__ = ["AudioTaskQueue"]
