# -*- coding: utf-8 -*-
"""
Task Manager for Voice Subtitle System

Manages async tasks with progress tracking.
"""

import os
import time
import threading
import uuid
import asyncio
import inspect
from datetime import datetime
from typing import Dict, List, Optional, Callable, Union, Coroutine
from dataclasses import dataclass
from enum import Enum

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.serialized_worker import (
    SerializedSingletonProvider,
    SerializedWorkerThread,
    call_serialized,
)


_TASK_STATE_QUEUE = 'pyctl.desktop.task_manager.state'
_TASK_EXECUTION_QUEUE = 'pyctl.desktop.task_manager.execute'
_TASK_STATE_WORKER = SerializedWorkerThread(
    _TASK_STATE_QUEUE,
    'DesktopTaskStateThread',
)
_TASK_STATE_WORKER.start()


class TaskStatus(Enum):
    """Task status enum"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class TaskType(Enum):
    """Task type enum"""
    TEXT = "text"
    IMAGE = "image"
    VOICE = "voice"


@dataclass
class Task:
    """Task data structure"""
    task_id: str
    task_type: str  # text, image, voice
    status: str     # pending, processing, completed, failed
    progress: int   # 0-100
    input_data: Dict  # Original input (text, image_path, etc.)
    result: Optional[Dict] = None
    error: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""
    estimated_time: Optional[int] = None  # seconds

    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.now().isoformat()
        if not self.updated_at:
            self.updated_at = datetime.now().isoformat()

    def to_dict(self) -> Dict:
        """
        Convert to dictionary (manual serialization to avoid deepcopy issues)

        Note: asdict() tries to deepcopy all fields, which fails if input_data
        or result contains non-serializable objects (like async functions).
        """
        return {
            'task_id': self.task_id,
            'task_type': self.task_type,
            'status': self.status,
            'progress': self.progress,
            'input_data': self._safe_copy_dict(self.input_data),
            'result': self._safe_copy_dict(self.result) if self.result else None,
            'error': self.error,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'estimated_time': self.estimated_time
        }

    def _safe_copy_dict(self, data: Dict) -> Dict:
        """
        Safely copy dictionary, handling non-serializable objects

        Args:
            data: Dictionary to copy

        Returns:
            Dict: Shallow copy with repr() for non-serializable values
        """
        result = {}
        for key, value in data.items():
            try:
                # Try to use basic types directly
                if isinstance(value, (str, int, float, bool, type(None))):
                    result[key] = value
                elif isinstance(value, (list, tuple)):
                    result[key] = list(value)
                elif isinstance(value, dict):
                    result[key] = dict(value)
                else:
                    # For complex objects, use string representation
                    result[key] = str(value)
            except Exception:
                # Fallback to repr for any problematic values
                result[key] = repr(value)
        return result

    def update_progress(self, progress: int, status: Optional[str] = None):
        """Update task progress"""
        self.progress = progress
        if status:
            self.status = status
        self.updated_at = datetime.now().isoformat()

    def set_completed(self, result: Dict):
        """Mark task as completed"""
        self.status = TaskStatus.COMPLETED.value
        self.progress = 100
        self.result = result
        self.updated_at = datetime.now().isoformat()

    def set_failed(self, error: str):
        """Mark task as failed"""
        self.status = TaskStatus.FAILED.value
        self.error = error
        self.updated_at = datetime.now().isoformat()

    def clone(self) -> "Task":
        """Return a detached task snapshot for THREAD_BUS consumers."""
        return Task(
            task_id=self.task_id,
            task_type=self.task_type,
            status=self.status,
            progress=self.progress,
            input_data=dict(self.input_data),
            result=dict(self.result) if self.result else None,
            error=self.error,
            created_at=self.created_at,
            updated_at=self.updated_at,
            estimated_time=self.estimated_time,
        )


class TaskExecutionThread(threading.Thread):
    """Consume task executions from THREAD_BUS with fixed concurrency."""

    def __init__(self, worker_index: int) -> None:
        super().__init__(
            daemon=True,
            name=f'DesktopTaskExecutionThread-{worker_index}',
        )

    def run(self) -> None:
        while not THREAD_BUS.is_shutdown_requested():
            payload = THREAD_BUS.receive_message(
                _TASK_EXECUTION_QUEUE,
                block=True,
                timeout=0.1,
            )
            if not isinstance(payload, dict):
                continue
            manager = payload.get('manager')
            task = payload.get('task')
            executor = payload.get('executor')
            if manager is None or task is None or executor is None:
                continue
            manager._execute_task_payload(task, executor)


class TaskManager:
    """
    Task Manager

    Features:
    - Create and track async tasks
    - Progress updates
    - Task history (keep last 100 tasks)
    - THREAD_BUS-serialized state and execution
    """

    def __init__(self, max_history: int = 100):
        """
        Initialize task manager

        Args:
            max_history: Maximum number of tasks to keep in history
        """
        self.tasks: Dict[str, Task] = {}
        self.task_history: List[str] = []  # Task IDs in order
        self.max_history = max_history

        # Bound concurrent task execution: a burst of remote_image tasks must not
        # spawn dozens of simultaneous threads that all hammer a rate-limited AI
        # provider (the 429 flood). Excess tasks queue on the pool instead of each
        # spawning its own thread. Configurable via PYCORE_TASK_MAX_CONCURRENCY
        # (default 4 — conservative, in line with free-tier AI RPM limits).
        try:
            _max_workers = int(os.environ.get("PYCORE_TASK_MAX_CONCURRENCY", "4"))
        except ValueError:
            _max_workers = 4
        self.max_workers = max(1, _max_workers)
        for worker_index in range(self.max_workers):
            TaskExecutionThread(worker_index).start()

        ColorPrint.green(
            f"[TaskManager] Initialized (max concurrency {self.max_workers})")

    def create_task(
        self,
        task_type: str,
        input_data: Dict,
        estimated_time: Optional[int] = None
    ) -> str:
        """
        Create a new task

        Args:
            task_type: Task type (text, image, voice)
            input_data: Input data for the task
            estimated_time: Estimated completion time in seconds

        Returns:
            task_id: Unique task identifier
        """
        return call_serialized(
            _TASK_STATE_QUEUE,
            self._create_task,
            task_type,
            input_data,
            estimated_time,
        )

    def _create_task(
        self,
        task_type: str,
        input_data: Dict,
        estimated_time: Optional[int],
    ) -> str:
        """Create a task on the state-owner thread."""
        task_id = self._generate_task_id(task_type)

        task = Task(
            task_id=task_id,
            task_type=task_type,
            status=TaskStatus.PENDING.value,
            progress=0,
            input_data=input_data,
            estimated_time=estimated_time
        )

        self.tasks[task_id] = task
        self.task_history.append(task_id)

        if len(self.task_history) > self.max_history:
            terminal = (TaskStatus.COMPLETED.value, TaskStatus.FAILED.value)
            for _ in range(len(self.task_history)):
                oldest_id = self.task_history[0]
                oldest_task = self.tasks.get(oldest_id)
                if oldest_task and oldest_task.status not in terminal:
                    self.task_history.pop(0)
                    self.task_history.append(oldest_id)
                    continue
                self.task_history.pop(0)
                self.tasks.pop(oldest_id, None)
                break

        ColorPrint.blue(f"[TaskManager] Created task: {task_id} ({task_type})")
        return task_id

    def get_task(self, task_id: str) -> Optional[Task]:
        """Get task by ID"""
        return call_serialized(_TASK_STATE_QUEUE, self._get_task, task_id)

    def _get_task(self, task_id: str) -> Optional[Task]:
        """Return a detached task snapshot on the state-owner thread."""
        task = self.tasks.get(task_id)
        return task.clone() if task else None

    def update_task_progress(self, task_id: str, progress: int, status: Optional[str] = None):
        """Update task progress"""
        call_serialized(
            _TASK_STATE_QUEUE,
            self._update_task_progress,
            task_id,
            progress,
            status,
        )

    def _update_task_progress(
        self,
        task_id: str,
        progress: int,
        status: Optional[str],
    ) -> None:
        """Update progress on the state-owner thread."""
        task = self.tasks.get(task_id)
        if task:
            task.update_progress(progress, status)
            ColorPrint.blue(f"[TaskManager] Task {task_id}: {progress}%")

    def patch_task(
        self,
        task_id: str,
        progress: Optional[int] = None,
        status: Optional[str] = None,
        result_patch: Optional[Dict] = None,
        error: Optional[str] = None,
    ) -> None:
        """Merge live fields into an in-flight task (progress/result/error)."""
        call_serialized(
            _TASK_STATE_QUEUE,
            self._patch_task,
            task_id,
            progress,
            status,
            result_patch,
            error,
        )

    def _patch_task(
        self,
        task_id: str,
        progress: Optional[int],
        status: Optional[str],
        result_patch: Optional[Dict],
        error: Optional[str],
    ) -> None:
        """Patch a task on the state-owner thread."""
        task = self.tasks.get(task_id)
        if not task:
            return
        if progress is not None:
            task.progress = progress
        if status:
            task.status = status
        if error is not None:
            task.error = error
        if result_patch:
            if task.result is None:
                task.result = {}
            task.result.update(result_patch)
        task.updated_at = datetime.now().isoformat()

    def complete_task(self, task_id: str, result: Dict):
        """Mark task as completed"""
        call_serialized(_TASK_STATE_QUEUE, self._complete_task, task_id, result)

    def _complete_task(self, task_id: str, result: Dict) -> None:
        """Complete a task on the state-owner thread."""
        task = self.tasks.get(task_id)
        if task:
            task.set_completed(result)
            ColorPrint.green(f"[TaskManager] Task completed: {task_id}")

    def fail_task(self, task_id: str, error: str):
        """Mark task as failed"""
        call_serialized(_TASK_STATE_QUEUE, self._fail_task, task_id, error)

    def _fail_task(self, task_id: str, error: str) -> None:
        """Fail a task on the state-owner thread."""
        task = self.tasks.get(task_id)
        if task:
            task.set_failed(error)
            ColorPrint.red(f"[TaskManager] Task failed: {task_id} - {error}")

    def get_all_tasks(self) -> List[Dict]:
        """Get all tasks in history order"""
        return call_serialized(_TASK_STATE_QUEUE, self._get_all_tasks)

    def _get_all_tasks(self) -> List[Dict]:
        """Build the task history snapshot on the state-owner thread."""
        return [
            self.tasks[task_id].to_dict()
            for task_id in reversed(self.task_history)
            if task_id in self.tasks
        ]

    def get_recent_tasks(self, limit: int = 50) -> List[Dict]:
        """Get recent N tasks"""
        return call_serialized(_TASK_STATE_QUEUE, self._get_recent_tasks, limit)

    def _get_recent_tasks(self, limit: int) -> List[Dict]:
        """Build a recent task snapshot on the state-owner thread."""
        recent_ids = list(reversed(self.task_history))[:limit]
        return [
            self.tasks[task_id].to_dict()
            for task_id in recent_ids
            if task_id in self.tasks
        ]

    def execute_task(
        self,
        task_id: str,
        executor: Union[Callable[[Task], Dict], Callable[[Task], Coroutine]]
    ):
        """
        Execute task in background thread

        Args:
            task_id: Task ID
            executor: Function (sync or async) that executes the task and returns result
        """
        task = self.get_task(task_id)
        task_type = task.task_type if task else "?"
        if task is None:
            ColorPrint.red(f"[TaskManager] Task not found: {task_id}")
            return
        THREAD_BUS.send_message(_TASK_EXECUTION_QUEUE, {
            'manager': self,
            'task': task,
            'executor': executor,
        })
        ColorPrint.cyan(
            f"[TaskManager] Queued task {task_id} (type={task_type}; "
            f"<= {self.max_workers} concurrent)")

    def _execute_task_payload(
        self,
        task: Task,
        executor: Union[Callable[[Task], Dict], Callable[[Task], Coroutine]],
    ) -> None:
        """Execute one bus-delivered task on a fixed worker thread."""
        task_id = task.task_id
        self.update_task_progress(task_id, 0, TaskStatus.PROCESSING.value)
        ColorPrint.blue(f"[TaskManager] Executing task {task_id}...")
        try:
            if inspect.iscoroutinefunction(executor):
                result = asyncio.run(executor(task))
            else:
                result = executor(task)
        except Exception as exc:
            ColorPrint.red(f"[TaskManager] Task {task_id} executor crashed: {exc}")
            self.fail_task(task_id, str(exc))
            return
        ColorPrint.green(f"[TaskManager] Task {task_id} executor completed")
        self.complete_task(task_id, result)

    def _generate_task_id(self, task_type: str) -> str:
        """Generate unique task ID"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        unique_id = str(uuid.uuid4())[:8]
        return f"task_{task_type}_{timestamp}_{unique_id}"


_TASK_MANAGER_PROVIDER = SerializedSingletonProvider(
    TaskManager,
    "desktop.task_manager.provider",
    "DesktopTaskManagerProvider",
)


def get_task_manager() -> TaskManager:
    """Get global task manager instance"""
    return _TASK_MANAGER_PROVIDER.get()
