# -*- coding: utf-8 -*-
"""
Unified priority-bump event hub for all queue lanes.

Translation monitor, sentence-audio monitor, and future lane monitors record
priority increases here so the Queue Center UI can show bubble toasts for ANY
lane — not only translation tasks.
"""

import threading
import time
from collections import deque
from typing import Any, Deque, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

_MAX_EVENTS = 60
_BUMP_TTL_S = 30.0


class QueueBumpHub:
    """Ring buffer of recent priority bumps across lanes (singleton)."""

    _instance: Optional["QueueBumpHub"] = None
    _instance_lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            with cls._instance_lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        if getattr(self, "_initialized", False):
            return
        self._lock = threading.Lock()
        self._events: Deque[Dict[str, Any]] = deque(maxlen=_MAX_EVENTS)
        self._active_until: Dict[str, float] = {}
        self._initialized = True

    def record(
        self,
        lane: str,
        item_id: str,
        label: str,
        old_priority: Any,
        new_priority: Any,
        meta: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Record one priority increase and flag it active for the bump TTL."""
        lane_key = (lane or "unknown").strip() or "unknown"
        item_key = str(item_id or "").strip() or "?"
        bump_key = f"{lane_key}:{item_key}"
        now = time.monotonic()
        entry = {
            "lane": lane_key,
            "item_id": item_key,
            "label": (label or item_key)[:120],
            "old_priority": old_priority,
            "new_priority": new_priority,
            "meta": dict(meta or {}),
            "at": int(time.time()),
            "recently_bumped": True,
        }
        with self._lock:
            self._active_until[bump_key] = now + _BUMP_TTL_S
            self._events.appendleft(entry)
        ColorPrint.blue(
            f"[QueueBump] {lane_key}: '{entry['label']}' priority "
            f"{old_priority}->{new_priority}"
        )

    def is_bumped(self, lane: str, item_id: str) -> bool:
        bump_key = f"{(lane or '').strip()}:{str(item_id or '').strip()}"
        now = time.monotonic()
        with self._lock:
            exp = self._active_until.get(bump_key)
            return bool(exp and exp > now)

    def snapshot(self, limit: int = 30) -> Dict[str, Any]:
        """Recent bump events + keys still within the active TTL."""
        now = time.monotonic()
        with self._lock:
            self._active_until = {
                k: v for k, v in self._active_until.items() if v > now
            }
            events = list(self._events)[: max(1, min(limit, _MAX_EVENTS))]
            active = list(self._active_until.keys())
        return {
            "events": events,
            "active_bumps": active,
            "ttl_seconds": int(_BUMP_TTL_S),
        }


def get_queue_bump_hub() -> QueueBumpHub:
    return QueueBumpHub()
