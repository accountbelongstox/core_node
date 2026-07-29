#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Global Task models + queue.

Merged from the former task_models / global_task_queue modules so the task
data model and its THREAD_BUS-backed priority facade live in one module.

Contents:
- TaskState / TaskPriority / Task   - task data model
- GlobalTaskQueue / get_global_task_queue - THREAD_BUS priority facade

Only uses Python standard library and the foundational THREAD_BUS.
"""

import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method


_TASK_MAP_SIGNAL = 'heartbeat.tasks.map'
_TASK_STATS_SIGNAL = 'heartbeat.tasks.stats'
_TASK_QUEUE_PREFIX = 'heartbeat.tasks.priority'


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
    Global THREAD_BUS-backed priority task queue

    Each priority owns one THREAD_BUS queue. Consumers scan priorities from
    urgent to low, preserving the public queue API without shared locks.
    """

    def __init__(self, max_size: int = 10000):
        """
        Initialize global task queue

        Args:
            max_size: Maximum queue size (default: 10000)
        """
        self._max_size = max_size
        if THREAD_BUS.get_signal(_TASK_MAP_SIGNAL) is None:
            THREAD_BUS.signal(_TASK_MAP_SIGNAL, {})
        if THREAD_BUS.get_signal(_TASK_STATS_SIGNAL) is None:
            THREAD_BUS.signal(_TASK_STATS_SIGNAL, {
                'total_added': 0,
                'total_removed': 0,
            })
        init_serialized_owner(self, "global_task_queue.state", "GlobalTaskQueueState")

    def put(self, task: Task, block: bool = True, timeout: Optional[float] = None) -> bool:
        """
        Add task to queue

        Args:
            task: Task to add
            block: Block if queue is full (default: True)
            timeout: Timeout in seconds (default: None)

        Returns:
            True if task was added, False otherwise

        """
        wait_started = time.time()
        while self.is_full():
            if not block:
                return False
            if timeout is not None and time.time() - wait_started >= timeout:
                return False
            time.sleep(0.01)

        queue_name = self._queue_name(task.priority)
        THREAD_BUS.send_message(queue_name, task)
        self._record_added(task)
        return True

    @serialized_method
    def _record_added(self, task: Task) -> None:
        task_map = dict(THREAD_BUS.get_signal(_TASK_MAP_SIGNAL, {}) or {})
        task_map[task.task_id] = task
        THREAD_BUS.signal(_TASK_MAP_SIGNAL, task_map)
        self._increment_stat('total_added')

    def get(self, block: bool = True, timeout: Optional[float] = None) -> Optional[Task]:
        """
        Get highest priority task from queue

        Args:
            block: Block if queue is empty (default: True)
            timeout: Timeout in seconds (default: None)

        Returns:
            Task if available, None otherwise
        """
        wait_started = time.time()
        while True:
            for priority in TaskPriority:
                task = THREAD_BUS.receive_message(self._queue_name(priority))
                if task is not None:
                    self._increment_stat('total_removed')
                    return task

            if not block:
                return None
            if timeout is not None and time.time() - wait_started >= timeout:
                return None
            time.sleep(0.01)

    @serialized_method
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
        task_map = THREAD_BUS.get_signal(_TASK_MAP_SIGNAL, {}) or {}
        task = task_map.get(task_id)
        if task and task.state == TaskState.PENDING:
            task.mark_cancelled()
            THREAD_BUS.signal(_TASK_MAP_SIGNAL, dict(task_map))
            return True
        return False

    @serialized_method
    def get_task(self, task_id: str) -> Optional[Task]:
        """
        Get task by ID

        Args:
            task_id: Task ID

        Returns:
            Task if found, None otherwise
        """
        task_map = THREAD_BUS.get_signal(_TASK_MAP_SIGNAL, {}) or {}
        return task_map.get(task_id)

    @serialized_method
    def cleanup_completed(self, max_keep: int = 1000):
        """
        Clean up completed/failed/cancelled tasks from map

        Args:
            max_keep: Maximum number of completed tasks to keep
        """
        task_map = THREAD_BUS.get_signal(_TASK_MAP_SIGNAL, {}) or {}
        completed_tasks = [
            (task_id, task) for task_id, task in task_map.items()
            if task.state in (
                TaskState.COMPLETED,
                TaskState.FAILED,
                TaskState.CANCELLED,
            )
        ]
        if len(completed_tasks) <= max_keep:
            return

        completed_tasks.sort(key=lambda item: item[1].completed_at or 0)
        remove_ids = {
            task_id for task_id, _task in completed_tasks[:-max_keep]
        }
        THREAD_BUS.signal(_TASK_MAP_SIGNAL, {
            task_id: task
            for task_id, task in task_map.items()
            if task_id not in remove_ids
        })

    def size(self) -> int:
        """Get current queue size"""
        return sum(
            THREAD_BUS.queue_size(self._queue_name(priority))
            for priority in TaskPriority
        )

    def is_empty(self) -> bool:
        """Check if queue is empty"""
        return self.size() == 0

    def is_full(self) -> bool:
        """Check if queue is full"""
        return self.size() >= self._max_size

    @serialized_method
    def get_stats(self) -> Dict[str, int]:
        """
        Get queue statistics

        Returns:
            Dictionary with queue statistics
        """
        task_map = THREAD_BUS.get_signal(_TASK_MAP_SIGNAL, {}) or {}
        stats = THREAD_BUS.get_signal(_TASK_STATS_SIGNAL, {}) or {}
        state_counts = {}
        for task in task_map.values():
            state = task.state.value
            state_counts[state] = state_counts.get(state, 0) + 1

        return {
            'queue_size': self.size(),
            'total_tasks': len(task_map),
            'total_added': stats.get('total_added', 0),
            'total_removed': stats.get('total_removed', 0),
            'max_size': self._max_size,
            'is_full': self.is_full(),
            'state_counts': state_counts,
        }

    @serialized_method
    def get_pending_tasks(self) -> List[Task]:
        """
        Get list of all pending tasks

        Returns:
            List of pending tasks
        """
        task_map = THREAD_BUS.get_signal(_TASK_MAP_SIGNAL, {}) or {}
        return [
            task for task in task_map.values()
            if task.state == TaskState.PENDING
        ]

    @serialized_method
    def get_running_tasks(self) -> List[Task]:
        """
        Get list of all running tasks

        Returns:
            List of running tasks
        """
        task_map = THREAD_BUS.get_signal(_TASK_MAP_SIGNAL, {}) or {}
        return [
            task for task in task_map.values()
            if task.state == TaskState.RUNNING
        ]

    @serialized_method
    def clear(self):
        """Clear all tasks from queue and map"""
        for priority in TaskPriority:
            THREAD_BUS.clear_queue(self._queue_name(priority))
        THREAD_BUS.signal(_TASK_MAP_SIGNAL, {})

    @staticmethod
    def _queue_name(priority: TaskPriority) -> str:
        """Return the THREAD_BUS queue key for one priority."""
        return f"{_TASK_QUEUE_PREFIX}.{priority.value}"

    @serialized_method
    def _increment_stat(self, name: str) -> None:
        """Publish one updated queue counter."""
        stats = dict(THREAD_BUS.get_signal(_TASK_STATS_SIGNAL, {}) or {})
        stats[name] = stats.get(name, 0) + 1
        THREAD_BUS.signal(_TASK_STATS_SIGNAL, stats)


_global_task_queue = GlobalTaskQueue()
def get_global_task_queue() -> GlobalTaskQueue:
    """
    Get global task queue singleton

    Returns:
        GlobalTaskQueue singleton instance
    """
    return _global_task_queue


__all__ = [
    'Task',
    'TaskState',
    'TaskPriority',
    'GlobalTaskQueue',
    'get_global_task_queue',
]
