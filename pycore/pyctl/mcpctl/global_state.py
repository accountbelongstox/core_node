# -*- coding: utf-8 -*-
"""
MCP Backend Global State Manager

Thread-safe global state tracking for MCP backend:
- Processing state (IDLE / BUSY)
- Active task counter
- Shutdown permission logic

Used by SingletonDetector to decide whether to allow replacement:
- IDLE state → Allow new instance to replace this one
- BUSY state → Reject replacement, new instance connects as SECONDARY
"""

import threading
from enum import Enum
from typing import Dict, Any
from dataclasses import dataclass
import time


class ProcessingState(Enum):
    """MCP Backend processing state"""
    IDLE = "idle"      # No active processing
    BUSY = "busy"      # Currently processing tasks


@dataclass
class StateSnapshot:
    """Snapshot of current state"""
    state: ProcessingState
    active_tasks: int
    can_shutdown: bool
    uptime_seconds: float
    last_task_timestamp: float
    message: str


class MCPGlobalState:
    """
    Thread-safe global state manager for MCP backend

    State transitions:
    - IDLE → BUSY: When task starts
    - BUSY → IDLE: When all tasks complete

    Shutdown permission:
    - IDLE: Allow replacement (can_shutdown=True)
    - BUSY: Reject replacement (can_shutdown=False)
    """

    def __init__(self):
        """Initialize state manager"""
        self._lock = threading.Lock()
        self._state = ProcessingState.IDLE
        self._active_tasks = 0
        self._start_time = time.time()
        self._last_task_time = 0.0

    def begin_task(self, task_id: str = None) -> None:
        """
        Mark beginning of task processing

        Args:
            task_id: Optional task identifier for logging
        """
        with self._lock:
            self._active_tasks += 1
            self._last_task_time = time.time()
            if self._active_tasks > 0:
                self._state = ProcessingState.BUSY

    def end_task(self, task_id: str = None) -> None:
        """
        Mark end of task processing

        Args:
            task_id: Optional task identifier for logging
        """
        with self._lock:
            self._active_tasks = max(0, self._active_tasks - 1)
            if self._active_tasks == 0:
                self._state = ProcessingState.IDLE

    def is_idle(self) -> bool:
        """
        Check if backend is idle

        Returns:
            True if no active tasks
        """
        with self._lock:
            return self._state == ProcessingState.IDLE

    def is_busy(self) -> bool:
        """
        Check if backend is busy

        Returns:
            True if has active tasks
        """
        with self._lock:
            return self._state == ProcessingState.BUSY

    def can_shutdown(self) -> bool:
        """
        Check if shutdown is allowed

        Shutdown allowed when:
        - State is IDLE
        - No active tasks

        Returns:
            True if shutdown allowed
        """
        with self._lock:
            return self._state == ProcessingState.IDLE and self._active_tasks == 0

    def get_snapshot(self) -> StateSnapshot:
        """
        Get current state snapshot

        Returns:
            StateSnapshot with current state
        """
        with self._lock:
            uptime = time.time() - self._start_time

            # Determine message
            if self._state == ProcessingState.IDLE:
                message = "Backend is idle, replacement allowed"
            else:
                message = f"Backend is busy with {self._active_tasks} active tasks, replacement denied"

            return StateSnapshot(
                state=self._state,
                active_tasks=self._active_tasks,
                can_shutdown=self.can_shutdown(),
                uptime_seconds=uptime,
                last_task_timestamp=self._last_task_time,
                message=message
            )

    def to_dict(self) -> Dict[str, Any]:
        """
        Get state as dictionary (for protocol messages)

        Returns:
            Dictionary representation
        """
        snapshot = self.get_snapshot()
        return {
            "state": snapshot.state.value,
            "active_tasks": snapshot.active_tasks,
            "can_shutdown": snapshot.can_shutdown,
            "uptime_seconds": snapshot.uptime_seconds,
            "last_task_timestamp": snapshot.last_task_timestamp,
            "message": snapshot.message
        }


# ============================================================
# Global Singleton Instance
# ============================================================

_global_state_instance: MCPGlobalState = None
_instance_lock = threading.Lock()


def get_global_state() -> MCPGlobalState:
    """
    Get global state singleton instance

    Returns:
        MCPGlobalState singleton
    """
    global _global_state_instance
    if _global_state_instance is None:
        with _instance_lock:
            if _global_state_instance is None:
                _global_state_instance = MCPGlobalState()
    return _global_state_instance


# ============================================================
# Convenience Functions
# ============================================================

def mark_task_begin(task_id: str = None):
    """Mark task begin (convenience function)"""
    get_global_state().begin_task(task_id)


def mark_task_end(task_id: str = None):
    """Mark task end (convenience function)"""
    get_global_state().end_task(task_id)


def is_backend_idle() -> bool:
    """Check if backend is idle (convenience function)"""
    return get_global_state().is_idle()


def is_backend_busy() -> bool:
    """Check if backend is busy (convenience function)"""
    return get_global_state().is_busy()


def can_backend_shutdown() -> bool:
    """Check if backend can shutdown (convenience function)"""
    return get_global_state().can_shutdown()


def get_backend_state_dict() -> Dict[str, Any]:
    """Get backend state as dict (convenience function)"""
    return get_global_state().to_dict()
