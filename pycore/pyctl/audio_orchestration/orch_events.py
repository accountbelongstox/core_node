# -*- coding: utf-8 -*-
"""
Audio-orchestration task change push (``audio_orchestration.tasks.changed``).

Published on the THREAD_BUS and bridged to the browser by the shared
thread-bus -> HTTP event delivery listener (thread_bus_routes) and to relay
devices. Two payloads:
- status transition ``{task_id, source, status}`` (create, generating,
  done/failed/draft, delete; repeated statuses dropped);
- progress delta ``{task_id, source, status, progress}`` with ``progress`` in the
  queue-center ``progress_template`` shape over the task's segments, at most
  once per PROGRESS_MIN_INTERVAL_SECONDS per task.
"""

import time
from typing import Any, Dict

from pycore.pyfoundations.time_utils import utc_now_iso

from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals

from pycore.pyctl.audio_orchestration import orch_sources

TASK_STATUS_DELETED = "deleted"
PROGRESS_MIN_INTERVAL_SECONDS = 1.0
_SEGMENT_DONE = "done"
_SEGMENT_FAILED = "failed"


class _TaskStatusOwner:
    """Last pushed status per task (THREAD_BUS-backed state owner)."""

    def __init__(self) -> None:
        self._statuses: Dict[str, str] = {}
        self._progress: Dict[str, tuple] = {}
        init_serialized_owner(self, "audio_orchestration.task_status", "AudioOrchTaskStatus")

    @serialized_method
    def transition(self, task_id: str, status: str) -> bool:
        if self._statuses.get(task_id) == status:
            return False
        if status == TASK_STATUS_DELETED:
            self._statuses.pop(task_id, None)
            self._progress.pop(task_id, None)
        else:
            self._statuses[task_id] = status
        return True

    @serialized_method
    def progress_due(self, task_id: str, counts: tuple) -> bool:
        """True when the counts changed and the task's last push is older than
        PROGRESS_MIN_INTERVAL_SECONDS (a terminal count set always passes)."""
        now = time.monotonic()
        last = self._progress.get(task_id)
        if last is not None and last[1] == counts:
            return False
        total, done, failed, _pending = counts
        complete = total > 0 and done + failed >= total
        if last is not None and not complete and now - last[0] < PROGRESS_MIN_INTERVAL_SECONDS:
            return False
        self._progress[task_id] = (now, counts)
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


def segment_progress(task: Dict[str, Any]) -> Dict[str, Any]:
    """The task's segments in the progress_template shape."""
    segments = task.get("segments") or []
    done = sum(1 for segment in segments if segment.get("status") == _SEGMENT_DONE)
    failed = sum(1 for segment in segments if segment.get("status") == _SEGMENT_FAILED)
    total = len(segments)
    return {
        "total": total,
        "done": done,
        "failed": failed,
        "pending": max(0, total - done - failed),
        "cursor": None,
        "updated_at": utc_now_iso(),
    }


def publish_task_progress(task: Dict[str, Any]) -> None:
    """Push the task's segment progress when it changed, throttled per task."""
    task_id = str(task.get("task_id") or "")
    if not task_id:
        return
    progress = segment_progress(task)
    counts = (progress["total"], progress["done"], progress["failed"], progress["pending"])
    if not _task_status_owner.progress_due(task_id, counts):
        return
    THREAD_BUS.trigger_event(
        BusSignals.AUDIO_ORCH_TASKS_CHANGED,
        {
            "task_id": task_id,
            "source": orch_sources.task_source(task),
            "status": str(task.get("status") or ""),
            "progress": progress,
        },
        async_mode=True,
    )


__all__ = [
    "PROGRESS_MIN_INTERVAL_SECONDS",
    "TASK_STATUS_DELETED",
    "publish_task_changed",
    "publish_task_progress",
    "segment_progress",
]
