"""Idle state tracking utilities."""

from __future__ import annotations

import logging
import threading
import time
from enum import Enum, auto
from typing import Callable, List, Optional

from .activity import ActivityEvent, ActivityType

LOGGER = logging.getLogger(__name__)


class IdleState(Enum):
    ACTIVE = auto()
    IDLE = auto()


class IdleStateMonitor:
    """Track activity events and emit idle/active transitions."""

    def __init__(self, timeout_seconds: float = 30.0) -> None:
        self.timeout_seconds = timeout_seconds
        self._state = IdleState.ACTIVE
        self._last_activity = time.monotonic()
        self._listeners: List[Callable[[IdleState], None]] = []
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def add_listener(self, callback: Callable[[IdleState], None]) -> None:
        self._listeners.append(callback)

    def remove_listener(self, callback: Callable[[IdleState], None]) -> None:
        if callback in self._listeners:
            self._listeners.remove(callback)

    def notify_activity(self, event: ActivityEvent | None = None) -> None:
        self._last_activity = event.timestamp if event else time.monotonic()
        if self._state is IdleState.IDLE:
            self._set_state(IdleState.ACTIVE)

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, name="IdleStateMonitor", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=1)
        self._thread = None

    def _run(self) -> None:
        while not self._stop_event.is_set():
            now = time.monotonic()
            elapsed = now - self._last_activity
            if elapsed >= self.timeout_seconds and self._state is IdleState.ACTIVE:
                self._set_state(IdleState.IDLE)
            time.sleep(0.5)

    def _set_state(self, new_state: IdleState) -> None:
        if self._state is new_state:
            return
        self._state = new_state
        for callback in list(self._listeners):
            try:
                callback(new_state)
            except Exception:  # pragma: no cover - logging path
                LOGGER.exception("Idle listener raised an error")
