# -*- coding: utf-8 -*-
"""
Audio-orchestration task change push (``audio_orchestration.tasks.changed``).

Published on the THREAD_BUS and bridged to the browser by the shared
thread-bus → HTTP event delivery listener (thread_bus_routes). Payload:
``{task_id, source, status}``. Only status TRANSITIONS are pushed (create,
generating, done/failed/draft, delete); fine-grained progress stays on the
task progress route so the event stream never carries per-resource traffic.
"""

from typing import Any, Dict

from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals

from pycore.pyctl.audio_orchestration import orch_sources

TASK_STATUS_DELETED = "deleted"


class _TaskStatusOwner:
    """Last pushed status per task (THREAD_BUS-backed state owner)."""

    def __init__(self) -> None:
        self._statuses: Dict[str, str] = {}
        init_serialized_owner(self, "audio_orchestration.task_status", "AudioOrchTaskStatus")

    @serialized_method
    def transition(self, task_id: str, status: str) -> bool:
        if self._statuses.get(task_id) == status:
            return False
        if status == TASK_STATUS_DELETED:
            self._statuses.pop(task_id, None)
        else:
            self._statuses[task_id] = status
        return True


_task_status_owner = _TaskStatusOwner()


def publish_task_changed(task: Dict[str, Any], status: str = "") -> None:
    """Push one task status transition; repeated statuses are dropped."""
    task_id = str(task.get("task_id") or "")
    status = str(status or task.get("status") or "")
    if not task_id or not _task_status_owner.transition(task_id, status):
        return
    THREAD_BUS.trigger_event(
        BusSignals.AUDIO_ORCH_TASKS_CHANGED,
        {"task_id": task_id, "source": orch_sources.task_source(task), "status": status},
        async_mode=True,
    )


__all__ = ["TASK_STATUS_DELETED", "publish_task_changed"]
