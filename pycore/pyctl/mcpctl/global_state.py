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

import time
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict

from pycore.pyfoundations.thread_bus import THREAD_BUS
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method


_STATE_SIGNAL = 'pyctl.mcp.global_state'


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
        self._start_time = time.time()
        init_serialized_owner(
            self,
            "mcp.global_state.owner",
            "MCPGlobalStateOwner",
        )
        if THREAD_BUS.get_signal(_STATE_SIGNAL) is None:
            THREAD_BUS.signal(_STATE_SIGNAL, {
                'state': ProcessingState.IDLE,
                'active_tasks': 0,
                'last_task_time': 0.0,
            })

    @serialized_method
    def begin_task(self, task_id: str = None) -> None:
        """
        Mark beginning of task processing

        Args:
            task_id: Optional task identifier for logging
        """
        state = dict(THREAD_BUS.get_signal(_STATE_SIGNAL, {}) or {})
        active_tasks = int(state.get('active_tasks') or 0) + 1
        THREAD_BUS.signal(_STATE_SIGNAL, {
            'state': ProcessingState.BUSY,
            'active_tasks': active_tasks,
            'last_task_time': time.time(),
        })

    @serialized_method
    def end_task(self, task_id: str = None) -> None:
        """
        Mark end of task processing

        Args:
            task_id: Optional task identifier for logging
        """
        state = dict(THREAD_BUS.get_signal(_STATE_SIGNAL, {}) or {})
        active_tasks = max(0, int(state.get('active_tasks') or 0) - 1)
        THREAD_BUS.signal(_STATE_SIGNAL, {
            **state,
            'state': (
                ProcessingState.IDLE
                if active_tasks == 0 else ProcessingState.BUSY
            ),
            'active_tasks': active_tasks,
        })

    @serialized_method
    def is_idle(self) -> bool:
        """
        Check if backend is idle

        Returns:
            True if no active tasks
        """
        state = THREAD_BUS.get_signal(_STATE_SIGNAL, {}) or {}
        return state.get('state') == ProcessingState.IDLE

    @serialized_method
    def is_busy(self) -> bool:
        """
        Check if backend is busy

        Returns:
            True if has active tasks
        """
        state = THREAD_BUS.get_signal(_STATE_SIGNAL, {}) or {}
        return state.get('state') == ProcessingState.BUSY

    @serialized_method
    def can_shutdown(self) -> bool:
        """
        Check if shutdown is allowed

        Shutdown allowed when:
        - State is IDLE
        - No active tasks

        Returns:
            True if shutdown allowed
        """
        state = THREAD_BUS.get_signal(_STATE_SIGNAL, {}) or {}
        return (
            state.get('state') == ProcessingState.IDLE
            and int(state.get('active_tasks') or 0) == 0
        )

    @serialized_method
    def get_snapshot(self) -> StateSnapshot:
        """
        Get current state snapshot

        Returns:
            StateSnapshot with current state
        """
        state = THREAD_BUS.get_signal(_STATE_SIGNAL, {}) or {}
        processing_state = state.get('state', ProcessingState.IDLE)
        active_tasks = int(state.get('active_tasks') or 0)
        if processing_state == ProcessingState.IDLE:
            message = "Backend is idle, replacement allowed"
        else:
            message = (
                f"Backend is busy with {active_tasks} active tasks, "
                "replacement denied"
            )

        return StateSnapshot(
            state=processing_state,
            active_tasks=active_tasks,
            can_shutdown=(
                processing_state == ProcessingState.IDLE
                and active_tasks == 0
            ),
            uptime_seconds=time.time() - self._start_time,
            last_task_timestamp=float(state.get('last_task_time') or 0.0),
            message=message,
        )

    @serialized_method
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

_global_state_instance = MCPGlobalState()


def get_global_state() -> MCPGlobalState:
    """
    Get global state singleton instance

    Returns:
        MCPGlobalState singleton
    """
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
