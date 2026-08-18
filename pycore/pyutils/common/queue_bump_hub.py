# -*- coding: utf-8 -*-
"""
Shared priority-bump event hub for all queue lanes.

Non-audio lane monitors record priority increases here so the Queue Center UI
can show bubble toasts without mixing them with audio queue-head events.
"""

import time
from collections import deque
from typing import Any, Callable, Deque, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method

_MAX_EVENTS = 60
_BUMP_TTL_S = 30.0


class QueueBumpHub:
    """Ring buffer of recent priority bumps across lanes (singleton)."""

    def __init__(self) -> None:
        self._events: Deque[Dict[str, Any]] = deque(maxlen=_MAX_EVENTS)
        self._active_until: Dict[str, float] = {}
        # Zero-internal-import observer registry (mirrors LaravelHttpRecorder):
        # listeners (e.g. the rpc_v2 HTTP event bridge) register callables here so
        # this hub stays import-safe for every lane producer.
        self._callbacks: List[Callable[[Dict[str, Any]], None]] = []
        init_serialized_owner(self, "queue_bump_hub.state", "QueueBumpHubState")

    @serialized_method
    def register_callback(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        """Register a listener called with each bump record. Never raises."""
        if callback not in self._callbacks:
            self._callbacks.append(callback)

    @serialized_method
    def unregister_callback(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        if callback in self._callbacks:
            self._callbacks = [cb for cb in self._callbacks if cb is not callback]

    @serialized_method
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
        self._active_until[bump_key] = now + _BUMP_TTL_S
        self._events.appendleft(entry)
        callbacks = list(self._callbacks)
        ColorPrint.blue(
            f"[QueueBump] {lane_key}: '{entry['label']}' priority "
            f"{old_priority}->{new_priority}"
        )
        # Fan out to observers; a listener must never break the recording path.
        for cb in callbacks:
            try:
                cb(dict(entry))
            except Exception:
                pass

    @serialized_method
    def is_bumped(self, lane: str, item_id: str) -> bool:
        bump_key = f"{(lane or '').strip()}:{str(item_id or '').strip()}"
        now = time.monotonic()
        exp = self._active_until.get(bump_key)
        return bool(exp and exp > now)

    @serialized_method
    def snapshot(self, limit: int = 30) -> Dict[str, Any]:
        """Recent bump events + keys still within the active TTL."""
        now = time.monotonic()
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


queue_bump_hub = QueueBumpHub()
