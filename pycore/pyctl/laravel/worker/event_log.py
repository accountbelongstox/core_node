# -*- coding: utf-8 -*-
"""Bounded worker activity log on a THREAD_BUS state owner: drain threads
append, status and the event-page route read keyset pages."""

from collections import deque
from typing import Any, Deque, Dict, Optional

from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyutils.common.keyset_cursor import KeysetKey, keyset_page

EVENT_LOG_CAPACITY = 80


class WorkerEventLog:
    """Newest-first events with a monotonic id (the keyset sort key)."""

    def __init__(self, name: str, capacity: int = EVENT_LOG_CAPACITY) -> None:
        self._events: Deque[Dict[str, Any]] = deque(maxlen=max(1, int(capacity)))
        self._revision = 0
        init_serialized_owner(self, f"laravel.worker.event_log.{name}", f"{name}EventLogThread")

    @serialized_method
    def append(self, entry: Dict[str, Any]) -> int:
        """Stamp the next id on ``entry``, keep it, return the id."""
        self._revision += 1
        stored = dict(entry, id=self._revision)
        self._events.appendleft(stored)
        return self._revision

    @serialized_method
    def page(self, after: Optional[KeysetKey], limit: int) -> Dict[str, Any]:
        return {
            **keyset_page(list(self._events), after, limit, lambda event: (int(event["id"]), int(event["id"]))),
            "total": len(self._events),
            "revision": self._revision,
        }

    @serialized_method
    def counters(self) -> Dict[str, int]:
        return {"event_count": len(self._events), "event_revision": self._revision}


__all__ = ["EVENT_LOG_CAPACITY", "WorkerEventLog"]
