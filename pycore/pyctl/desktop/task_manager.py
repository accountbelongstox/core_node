# -*- coding: utf-8 -*-
"""
Task Manager for Voice Subtitle System

Manages async tasks with progress tracking.
"""

import time
import threading
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass, asdict
from enum import Enum

from pycore import ColorPrint


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
        """Convert to dictionary"""
        return asdict(self)

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


class TaskManager:
    """
    Task Manager

    Features:
    - Create and track async tasks
    - Progress updates
    - Task history (keep last 100 tasks)
    - Thread-safe operations
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
        self.lock = threading.Lock()

        ColorPrint.green("[TaskManager] Initialized")

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
        task_id = self._generate_task_id(task_type)

        task = Task(
            task_id=task_id,
            task_type=task_type,
            status=TaskStatus.PENDING.value,
            progress=0,
            input_data=input_data,
            estimated_time=estimated_time
        )

        with self.lock:
            self.tasks[task_id] = task
            self.task_history.append(task_id)

            # Keep only max_history tasks
            if len(self.task_history) > self.max_history:
                oldest_id = self.task_history.pop(0)
                if oldest_id in self.tasks:
                    del self.tasks[oldest_id]

        ColorPrint.blue(f"[TaskManager] Created task: {task_id} ({task_type})")
        return task_id

    def get_task(self, task_id: str) -> Optional[Task]:
        """Get task by ID"""
        with self.lock:
            return self.tasks.get(task_id)

    def update_task_progress(self, task_id: str, progress: int, status: Optional[str] = None):
        """Update task progress"""
        with self.lock:
            task = self.tasks.get(task_id)
            if task:
                task.update_progress(progress, status)
                ColorPrint.blue(f"[TaskManager] Task {task_id}: {progress}%")

    def complete_task(self, task_id: str, result: Dict):
        """Mark task as completed"""
        with self.lock:
            task = self.tasks.get(task_id)
            if task:
                task.set_completed(result)
                ColorPrint.green(f"[TaskManager] Task completed: {task_id}")

    def fail_task(self, task_id: str, error: str):
        """Mark task as failed"""
        with self.lock:
            task = self.tasks.get(task_id)
            if task:
                task.set_failed(error)
                ColorPrint.red(f"[TaskManager] Task failed: {task_id} - {error}")

    def get_all_tasks(self) -> List[Dict]:
        """Get all tasks in history order"""
        with self.lock:
            return [
                self.tasks[task_id].to_dict()
                for task_id in reversed(self.task_history)
                if task_id in self.tasks
            ]

    def get_recent_tasks(self, limit: int = 50) -> List[Dict]:
        """Get recent N tasks"""
        with self.lock:
            recent_ids = list(reversed(self.task_history))[:limit]
            return [
                self.tasks[task_id].to_dict()
                for task_id in recent_ids
                if task_id in self.tasks
            ]

    def execute_task(
        self,
        task_id: str,
        executor: Callable[[Task], Dict]
    ):
        """
        Execute task in background thread

        Args:
            task_id: Task ID
            executor: Function that executes the task and returns result
        """
        def _run():
            task = self.get_task(task_id)
            if not task:
                ColorPrint.red(f"[TaskManager] Task not found: {task_id}")
                return

            try:
                # Set to processing
                self.update_task_progress(task_id, 0, TaskStatus.PROCESSING.value)

                # Execute task
                result = executor(task)

                # Mark as completed
                self.complete_task(task_id, result)

            except Exception as e:
                ColorPrint.red(f"[TaskManager] Task execution error: {e}")
                import traceback
                traceback.print_exc()
                self.fail_task(task_id, str(e))

        # Run in background thread
        thread = threading.Thread(target=_run, daemon=True, name=f"Task-{task_id}")
        thread.start()

    def _generate_task_id(self, task_type: str) -> str:
        """Generate unique task ID"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        unique_id = str(uuid.uuid4())[:8]
        return f"task_{task_type}_{timestamp}_{unique_id}"


# Global singleton
_task_manager: Optional[TaskManager] = None
_task_manager_lock = threading.Lock()


def get_task_manager() -> TaskManager:
    """Get global task manager instance"""
    global _task_manager

    if _task_manager is None:
        with _task_manager_lock:
            if _task_manager is None:
                _task_manager = TaskManager()

    return _task_manager
