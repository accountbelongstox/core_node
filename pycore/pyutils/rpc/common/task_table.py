#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Task Table - Stores async task processing state

Manages async RPC tasks with status tracking, client association,
and result storage for both HTTP and WebSocket requests.

This is designed for LONG-RUNNING TASKS where:
- Tasks are submitted and return immediately (no waiting)
- HTTP mode: Clients poll for task completion
- WebSocket mode: Server pushes results when complete
- Failed push attempts are stored in inventory for reconnection

Features:
- Task ID storage
- Status tracking (pending → processing → completed/failed)
- Client association (WebSocket client_id or HTTP session)
- Result storage
- Protocol tracking ('websocket' or 'http')
- Retry tracking for push notifications
"""

import time
import threading
from typing import Dict, Optional, Any, List
from dataclasses import dataclass, field
from enum import Enum

from pycore import ColorPrint


class RequestStatus(Enum):
    """Task processing status

    Status flow:
    PENDING → PROCESSING → COMPLETED/FAILED → NOTIFIED/STORED
    """
    PENDING = 'pending'
    PROCESSING = 'processing'
    COMPLETED = 'completed'
    FAILED = 'failed'
    NOTIFIED = 'notified'  # Successfully notified client (WebSocket push or HTTP poll)
    ACK_PENDING = 'ack_pending'  # Waiting for client ACK confirmation
    ACK_RECEIVED = 'ack_received'  # Client confirmed receipt
    STORED = 'stored'  # Stored in inventory table after notification failure


@dataclass
class Task:
    """Async Task data structure

    Represents a long-running async task submitted via RPC.
    """
    request_id: str  # Task ID (keeping request_id for backward compatibility)
    route: str
    params: Dict[str, Any]
    client_id: Optional[str] = None
    protocol: str = 'unknown'  # 'websocket' or 'http'
    status: RequestStatus = RequestStatus.PENDING
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    result: Optional[Any] = None
    error: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3
    retry_interval: float = 3.0
    last_notify_attempt: Optional[float] = None
    notify_attempts: int = 0

    # Backward compatibility
    @property
    def client_type(self) -> str:
        """Alias for protocol (backward compatibility)"""
        return self.protocol


class TaskTable:
    """
    Task Table - Manages async RPC tasks

    Stores all incoming async tasks with their processing state,
    allowing tracking, retry, and inventory storage.

    Design Philosophy:
    - Tasks are submitted and stored immediately (no waiting)
    - HTTP clients poll for completion
    - WebSocket server pushes results when complete
    - Failed push → stored in inventory → retry on reconnect

    Usage:
        table = TaskTable(max_size=10000000)
        task = table.create_task(task_id, route, params, client_id, 'websocket')
        table.update_status(task_id, RequestStatus.PROCESSING)
        table.set_result(task_id, result)
    """

    def __init__(self, max_size: int = 10000000):
        """
        Initialize Task Table

        Args:
            max_size: Maximum number of tasks to store
        """
        self.max_size = max_size
        self.tasks: Dict[str, Task] = {}
        self._lock = threading.RLock()
        self._cleanup_running = False

    def create_task(
        self,
        task_id: str,
        route: str,
        params: Dict[str, Any],
        client_id: Optional[str] = None,
        protocol: str = 'unknown'
    ) -> Task:
        """
        Create a new async task

        Args:
            task_id: Task ID (unique identifier)
            route: Route name
            params: Task parameters
            client_id: Client ID (WebSocket client_id or HTTP session_id)
            protocol: Protocol type ('websocket' or 'http')

        Returns:
            Created Task
        """
        with self._lock:
            # Check size limit
            if len(self.tasks) >= self.max_size:
                self._cleanup_oldest()

            task = Task(
                request_id=task_id,
                route=route,
                params=params,
                client_id=client_id,
                protocol=protocol,
                status=RequestStatus.PENDING
            )

            self.tasks[task_id] = task

            return task

    # Backward compatibility methods
    def create_event(self, request_id: str, route: str, params: Dict[str, Any],
                    client_id: Optional[str] = None, client_type: str = 'unknown') -> Task:
        """Backward compatibility: create_event → create_task"""
        return self.create_task(request_id, route, params, client_id, client_type)

    def get_task(self, task_id: str) -> Optional[Task]:
        """Get task by ID"""
        with self._lock:
            return self.tasks.get(task_id)

    def get_event(self, request_id: str) -> Optional[Task]:
        """Backward compatibility: get_event → get_task"""
        return self.get_task(request_id)

    def has_task(self, task_id: str) -> bool:
        """Check if task exists"""
        with self._lock:
            return task_id in self.tasks

    def has_event(self, request_id: str) -> bool:
        """Backward compatibility: has_event → has_task"""
        return self.has_task(request_id)

    def update_status(self, task_id: str, status: RequestStatus):
        """Update task status"""
        with self._lock:
            task = self.tasks.get(task_id)
            if task:
                task.status = status
                if status == RequestStatus.PROCESSING and not task.started_at:
                    task.started_at = time.time()
                elif status in [RequestStatus.COMPLETED, RequestStatus.FAILED]:
                    task.completed_at = time.time()

    def set_result(self, task_id: str, result: Any, error: Optional[str] = None):
        """
        Set task result

        Args:
            task_id: Task ID
            result: Result data
            error: Error message if failed
        """
        with self._lock:
            task = self.tasks.get(task_id)
            if task:
                task.result = result
                task.error = error
                if error:
                    task.status = RequestStatus.FAILED
                else:
                    task.status = RequestStatus.COMPLETED
                task.completed_at = time.time()

    def increment_notify_attempt(self, task_id: str) -> int:
        """Increment notification attempt count"""
        with self._lock:
            task = self.tasks.get(task_id)
            if task:
                task.notify_attempts += 1
                task.last_notify_attempt = time.time()
                return task.notify_attempts
            return 0

    def can_retry_notify(self, task_id: str) -> bool:
        """Check if notification can be retried"""
        with self._lock:
            task = self.tasks.get(task_id)
            if task:
                return task.notify_attempts < task.max_retries
            return False

    def mark_notified(self, task_id: str):
        """Mark task as successfully notified"""
        with self._lock:
            task = self.tasks.get(task_id)
            if task:
                task.status = RequestStatus.NOTIFIED

    def mark_stored(self, task_id: str):
        """Mark task as stored in inventory"""
        with self._lock:
            task = self.tasks.get(task_id)
            if task:
                task.status = RequestStatus.STORED

    def get_tasks_by_client(self, client_id: str) -> List[Task]:
        """Get all tasks for a client"""
        with self._lock:
            return [
                task for task in self.tasks.values()
                if task.client_id == client_id
            ]

    def get_events_by_client(self, client_id: str) -> List[Task]:
        """Backward compatibility: get_events_by_client → get_tasks_by_client"""
        return self.get_tasks_by_client(client_id)

    def get_pending_notifications(self, client_id: Optional[str] = None) -> List[Task]:
        """
        Get tasks that need notification

        Args:
            client_id: Optional client ID filter

        Returns:
            List of tasks that are completed but not notified
        """
        with self._lock:
            tasks = []
            for task in self.tasks.values():
                if task.status == RequestStatus.COMPLETED:
                    if client_id is None or task.client_id == client_id:
                        tasks.append(task)
            return tasks

    def delete_task(self, task_id: str) -> bool:
        """Delete task"""
        with self._lock:
            if task_id in self.tasks:
                del self.tasks[task_id]
                return True
            return False

    def delete_event(self, request_id: str) -> bool:
        """Backward compatibility: delete_event → delete_task"""
        return self.delete_task(request_id)

    def _cleanup_oldest(self):
        """Remove oldest task when size limit reached"""
        if not self.tasks:
            return

        oldest_id = min(
            self.tasks.keys(),
            key=lambda k: self.tasks[k].created_at
        )
        del self.tasks[oldest_id]

    def cleanup(self, max_age: float = 3600.0) -> int:
        """
        Clean up old tasks

        Args:
            max_age: Maximum age in seconds

        Returns:
            Number of tasks cleaned
        """
        with self._lock:
            now = time.time()
            cleaned = 0
            expired_ids = []

            for task_id, task in self.tasks.items():
                # Clean up old notified/stored tasks
                if task.status in [RequestStatus.NOTIFIED, RequestStatus.STORED]:
                    if now - task.completed_at > max_age:
                        expired_ids.append(task_id)
                # Clean up very old pending/processing tasks (stuck requests)
                elif task.status in [RequestStatus.PENDING, RequestStatus.PROCESSING]:
                    if now - task.created_at > max_age * 2:
                        expired_ids.append(task_id)

            for task_id in expired_ids:
                del self.tasks[task_id]
                cleaned += 1

            # Also check size limit
            while len(self.tasks) > self.max_size:
                self._cleanup_oldest()
                cleaned += 1

            return cleaned

    def get_stats(self) -> Dict[str, Any]:
        """Get task table statistics"""
        with self._lock:
            stats = {
                'total': len(self.tasks),
                'max_size': self.max_size,
                'by_status': {},
                'by_protocol': {}
            }

            for task in self.tasks.values():
                status = task.status.value
                stats['by_status'][status] = stats['by_status'].get(status, 0) + 1

                protocol = task.protocol
                stats['by_protocol'][protocol] = stats['by_protocol'].get(protocol, 0) + 1

            return stats


# Default global task table
default_task_table = TaskTable(max_size=10000000)

# Backward compatibility aliases
RequestEvent = Task
RequestEventTable = TaskTable
default_request_event_table = default_task_table

__all__ = [
    'TaskTable',
    'Task',
    'RequestStatus',
    'default_task_table',
    # Backward compatibility
    'RequestEventTable',
    'RequestEvent',
    'default_request_event_table'
]
