#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Global Task Models

Foundation classes for task-based scheduling system.
Only uses Python standard library (no third-party dependencies).
"""

import uuid
import time
from enum import Enum
from typing import Any, Dict, Optional, Callable
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


__all__ = [
    'Task',
    'TaskState',
    'TaskPriority'
]
