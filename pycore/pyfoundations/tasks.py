#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Global Task models + queue.

Merged from the former task_models / global_task_queue modules so the task
data model and its thread-safe priority queue live in ONE leaf module that
depends only on the Python standard library (no pyfoundations siblings).

Contents:
- TaskState / TaskPriority / Task   - task data model
- GlobalTaskQueue / get_global_task_queue - thread-safe priority queue singleton

Only uses Python standard library (no third-party dependencies).
"""

import uuid
import time
import queue
import threading
from enum import Enum
from typing import Any, Dict, Optional, Callable, List
from dataclasses import dataclass, field


class TaskState(Enum):
    """Task execution states"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskPriority(Enum):
    """Task priority levels (lower value = higher priority)"""
    URGENT = 0      # Highest priority (immediate execution)
    CRITICAL = 1    # Critical tasks (system-level)
    HIGH = 2        # High priority tasks
    NORMAL = 3      # Normal priority (default)
    LOW = 4         # Low priority tasks


@dataclass
class Task:
    """
    Global task model

    Represents a unit of work to be executed by the heartbeat scheduler.
    """

    task_type: str
    task_data: Dict[str, Any]
    priority: TaskPriority = TaskPriority.NORMAL
    task_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    state: TaskState = TaskState.PENDING
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    error: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3
    callback: Optional[Callable] = None
    error_callback: Optional[Callable] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __lt__(self, other):
        """Comparison for priority queue (lower priority value = higher precedence)"""
        if not isinstance(other, Task):
            return NotImplemented
        return self.priority.value < other.priority.value

    def mark_running(self):
        """Mark task as running"""
        self.state = TaskState.RUNNING
        self.started_at = time.time()

    def mark_completed(self):
        """Mark task as completed"""
        self.state = TaskState.COMPLETED
        self.completed_at = time.time()

    def mark_failed(self, error: str):
        """Mark task as failed"""
        self.state = TaskState.FAILED
        self.error = error
        self.completed_at = time.time()

    def mark_cancelled(self):
        """Mark task as cancelled"""
        self.state = TaskState.CANCELLED
        self.completed_at = time.time()

    def can_retry(self) -> bool:
        """Check if task can be retried"""
        return self.retry_count < self.max_retries

    def increment_retry(self):
        """Increment retry counter and reset state"""
        self.retry_count += 1
        self.state = TaskState.PENDING
        self.started_at = None
        self.error = None

    def get_duration(self) -> Optional[float]:
        """Get task execution duration"""
        if self.started_at and self.completed_at:
            return self.completed_at - self.started_at
        return None

    def to_dict(self) -> Dict[str, Any]:
        """Convert task to dictionary"""
        return {
            'task_id': self.task_id,
            'task_type': self.task_type,
            'state': self.state.value,
            'priority': self.priority.value,
            'created_at': self.created_at,
            'started_at': self.started_at,
            'completed_at': self.completed_at,
            'error': self.error,
            'retry_count': self.retry_count,
            'max_retries': self.max_retries,
            'duration': self.get_duration(),
            'metadata': self.metadata
        }


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
    'Task',
    'TaskState',
    'TaskPriority',
    'GlobalTaskQueue',
    'get_global_task_queue',
]
