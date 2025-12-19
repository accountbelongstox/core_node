#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Global Task Queue

Thread-safe priority queue for global task scheduling.
Only uses Python standard library (no third-party dependencies).
"""

import queue
import threading
from typing import Dict, Optional, List
from pycore.pyfoundations.task_models import Task, TaskState


class GlobalTaskQueue:
    """
    Global thread-safe priority task queue

    Uses queue.PriorityQueue for zero-lock thread safety.
    Shared by all application threads for task submission.
    """

    def __init__(self, max_size: int = 10000):
        """
        Initialize global task queue

        Args:
            max_size: Maximum queue size (default: 10000)
        """
        self._queue = queue.PriorityQueue(maxsize=max_size)
        self._task_map: Dict[str, Task] = {}
        self._map_lock = threading.Lock()
        self._max_size = max_size
        self._total_added = 0
        self._total_removed = 0

    def put(self, task: Task, block: bool = True, timeout: Optional[float] = None) -> bool:
        """
        Add task to queue

        Args:
            task: Task to add
            block: Block if queue is full (default: True)
            timeout: Timeout in seconds (default: None)

        Returns:
            True if task was added, False otherwise

        Raises:
            queue.Full: If queue is full and block=False
        """
        try:
            self._queue.put(
                (task.priority.value, task.created_at, task),
                block=block,
                timeout=timeout
            )

            with self._map_lock:
                self._task_map[task.task_id] = task
                self._total_added += 1

            return True

        except queue.Full:
            if not block:
                raise
            return False

    def get(self, block: bool = True, timeout: Optional[float] = None) -> Optional[Task]:
        """
        Get highest priority task from queue

        Args:
            block: Block if queue is empty (default: True)
            timeout: Timeout in seconds (default: None)

        Returns:
            Task if available, None otherwise
        """
        try:
            _, _, task = self._queue.get(block=block, timeout=timeout)
            self._total_removed += 1
            return task

        except queue.Empty:
            return None

    def remove(self, task_id: str) -> bool:
        """
        Remove task from task map (used for cancellation)

        Note: Cannot remove from PriorityQueue efficiently,
        so we just remove from map and mark as cancelled.

        Args:
            task_id: Task ID to remove

        Returns:
            True if task was found and marked cancelled
        """
        with self._map_lock:
            task = self._task_map.get(task_id)
            if task and task.state == TaskState.PENDING:
                task.mark_cancelled()
                return True
            return False

    def get_task(self, task_id: str) -> Optional[Task]:
        """
        Get task by ID

        Args:
            task_id: Task ID

        Returns:
            Task if found, None otherwise
        """
        with self._map_lock:
            return self._task_map.get(task_id)

    def cleanup_completed(self, max_keep: int = 1000):
        """
        Clean up completed/failed/cancelled tasks from map

        Args:
            max_keep: Maximum number of completed tasks to keep
        """
        with self._map_lock:
            completed_tasks = [
                (task_id, task) for task_id, task in self._task_map.items()
                if task.state in (TaskState.COMPLETED, TaskState.FAILED, TaskState.CANCELLED)
            ]

            if len(completed_tasks) > max_keep:
                completed_tasks.sort(key=lambda x: x[1].completed_at or 0)
                to_remove = completed_tasks[:-max_keep]

                for task_id, _ in to_remove:
                    del self._task_map[task_id]

    def size(self) -> int:
        """Get current queue size"""
        return self._queue.qsize()

    def is_empty(self) -> bool:
        """Check if queue is empty"""
        return self._queue.empty()

    def is_full(self) -> bool:
        """Check if queue is full"""
        return self._queue.full()

    def get_stats(self) -> Dict[str, int]:
        """
        Get queue statistics

        Returns:
            Dictionary with queue statistics
        """
        with self._map_lock:
            state_counts = {}
            for task in self._task_map.values():
                state = task.state.value
                state_counts[state] = state_counts.get(state, 0) + 1

            return {
                'queue_size': self.size(),
                'total_tasks': len(self._task_map),
                'total_added': self._total_added,
                'total_removed': self._total_removed,
                'max_size': self._max_size,
                'is_full': self.is_full(),
                'state_counts': state_counts
            }

    def get_pending_tasks(self) -> List[Task]:
        """
        Get list of all pending tasks

        Returns:
            List of pending tasks
        """
        with self._map_lock:
            return [
                task for task in self._task_map.values()
                if task.state == TaskState.PENDING
            ]

    def get_running_tasks(self) -> List[Task]:
        """
        Get list of all running tasks

        Returns:
            List of running tasks
        """
        with self._map_lock:
            return [
                task for task in self._task_map.values()
                if task.state == TaskState.RUNNING
            ]

    def clear(self):
        """Clear all tasks from queue and map"""
        while not self._queue.empty():
            try:
                self._queue.get_nowait()
            except queue.Empty:
                break

        with self._map_lock:
            self._task_map.clear()


_global_task_queue: Optional[GlobalTaskQueue] = None
_queue_lock = threading.Lock()


def get_global_task_queue() -> GlobalTaskQueue:
    """
    Get global task queue singleton

    Returns:
        GlobalTaskQueue singleton instance
    """
    global _global_task_queue

    if _global_task_queue is None:
        with _queue_lock:
            if _global_task_queue is None:
                _global_task_queue = GlobalTaskQueue()

    return _global_task_queue


__all__ = [
    'GlobalTaskQueue',
    'get_global_task_queue'
]
