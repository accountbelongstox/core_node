"""Global input monitoring utilities."""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from enum import Enum, auto
from typing import Callable, List, Optional, Sequence

try:
    from pynput import keyboard as pynput_keyboard
    from pynput import mouse as pynput_mouse
except Exception:  # pragma: no cover - optional dependency
    pynput_mouse = None
    pynput_keyboard = None

LOGGER = logging.getLogger(__name__)


class ActivityType(Enum):
    """Kind of user interaction."""

    MOUSE_MOVE = auto()
    MOUSE_CLICK = auto()
    MOUSE_SCROLL = auto()
    KEYBOARD = auto()


@dataclass(frozen=True)
class ActivityEvent:
    """Descriptor for a single activity event."""

    timestamp: float
    activity_type: ActivityType
    payload: tuple


class GlobalInputMonitor:
    """Observe global mouse/keyboard inputs and emit ActivityEvents."""

    def __init__(self, enable_keyboard: bool = False) -> None:
        self.enable_keyboard = enable_keyboard and pynput_keyboard is not None
        self._mouse_listener = None
        self._keyboard_listener = None
        self._callbacks: List[Callable[[ActivityEvent], None]] = []
        self._lock = threading.Lock()

    def add_listener(self, callback: Callable[[ActivityEvent], None]) -> None:
        with self._lock:
            self._callbacks.append(callback)

    def remove_listener(self, callback: Callable[[ActivityEvent], None]) -> None:
        with self._lock:
            if callback in self._callbacks:
                self._callbacks.remove(callback)

    def start(self) -> None:
        if not pynput_mouse:
            LOGGER.warning("pynput is not available; global input monitoring is disabled.")
            return

        if not self._mouse_listener:
            self._mouse_listener = pynput_mouse.Listener(
                on_move=self._handle_move,
                on_click=self._handle_click,
                on_scroll=self._handle_scroll,
            )
            self._mouse_listener.start()

        if self.enable_keyboard and not self._keyboard_listener and pynput_keyboard:
            self._keyboard_listener = pynput_keyboard.Listener(on_press=self._handle_keyboard)
            self._keyboard_listener.start()

    def stop(self) -> None:
        for listener in (self._mouse_listener, self._keyboard_listener):
            if listener:
                listener.stop()
        self._mouse_listener = None
        self._keyboard_listener = None

    # Mouse handlers -----------------------------------------------------
    def _handle_move(self, x: int, y: int) -> None:
        self._emit(ActivityType.MOUSE_MOVE, (x, y))

    def _handle_click(self, x: int, y: int, button, pressed: bool) -> None:  # pragma: no cover - callback signature
        if pressed:
            self._emit(ActivityType.MOUSE_CLICK, (x, y, str(button)))

    def _handle_scroll(self, x: int, y: int, dx: int, dy: int) -> None:  # pragma: no cover - callback signature
        self._emit(ActivityType.MOUSE_SCROLL, (x, y, dx, dy))

    def _handle_keyboard(self, key) -> None:  # pragma: no cover - callback signature
        if key is None:
            return
        self._emit(ActivityType.KEYBOARD, (str(key),))

    # -------------------------------------------------------------------
    def _emit(self, activity_type: ActivityType, payload: Sequence) -> None:
        if not self._callbacks:
            return
        event = ActivityEvent(timestamp=time.monotonic(), activity_type=activity_type, payload=tuple(payload))
        with self._lock:
            callbacks = list(self._callbacks)
        for callback in callbacks:
            try:
                callback(event)
            except Exception:  # pragma: no cover - logging path
                LOGGER.exception("Activity listener raised an error")
