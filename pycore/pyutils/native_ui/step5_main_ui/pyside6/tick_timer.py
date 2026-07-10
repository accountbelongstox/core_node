#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TickTimer - standalone Qt-signal-emitting periodic timer.

Runs a background thread that emits a Qt Signal on each tick. Used by the
PySide6 framework for periodic UI tasks. Emision crosses into the Qt event
loop, so slots always run on the Qt main thread regardless of which thread
called start().

The RuntimeError swallow guards against emitting after the underlying C++
QObject has been deleted (e.g. during teardown): the timer thread simply
exits instead of raising.

NOTE: This is deliberately a Qt-signal-emitting timer and is NOT replaced by
step7_managers/timer_manager.TimerManager, which is Qt-free (callback-based)
and therefore cannot marshal ticks into the Qt main thread.
"""

import time
import threading
from typing import Optional

from PySide6.QtCore import QObject, Signal


class TickTimer(QObject):
    """
    Tick timer for periodic tasks. Runs in a separate thread and emits a Qt
    signal on each tick (thread-safe marshalling into the Qt event loop).
    """

    # Signal to emit on each tick
    tick = Signal()

    def __init__(self, interval: float = 1.0, parent: Optional[QObject] = None):
        """
        Initialize tick timer.

        Args:
            interval: Tick interval in seconds
            parent: Parent QObject
        """
        super().__init__(parent)

        self.interval = interval
        self._running = False
        self._thread: Optional[threading.Thread] = None

    def start(self):
        """Start tick timer thread."""
        if self._running:
            return

        self._running = True
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self):
        """Stop tick timer thread."""
        self._running = False

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)

    def _run(self):
        """Tick timer thread main loop."""
        while self._running:
            try:
                self.tick.emit()
            except RuntimeError as e:
                if "Signal source has been deleted" in str(e) or "wrapped C/C++ object" in str(e):
                    break
                raise
            # Sleep in small steps so we can exit promptly when _running becomes False
            for _ in range(int(self.interval / 0.1) or 1):
                if not self._running:
                    return
                time.sleep(0.1)
