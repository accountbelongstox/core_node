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

from pycore.pyfoundations.serialized_worker import start_bus_task
from typing import Any, Optional

from PySide6.QtCore import QObject, Signal
from pycore import THREAD_BUS


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
        self._running_signal = f"native_ui.tick_timer.running.{id(self)}"
        self._stop_signal = f"native_ui.tick_timer.stop.{id(self)}"
        THREAD_BUS.signal(self._running_signal, False)
        THREAD_BUS.signal(self._stop_signal, False)
        self._thread: Optional[Any] = None

    def start(self):
        """Start tick timer thread."""
        if THREAD_BUS.get_signal(self._running_signal, False):
            return

        THREAD_BUS.signal(self._stop_signal, False)
        THREAD_BUS.signal(self._running_signal, True)
        self._thread = start_bus_task(
            self._run,
            thread_name="PySideTickTimerThread",
        )

    def stop(self):
        """Stop tick timer thread."""
        THREAD_BUS.signal(self._stop_signal, True)
        THREAD_BUS.signal(self._running_signal, False)

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)

    def _run(self):
        """Tick timer thread main loop."""
        try:
            while THREAD_BUS.get_signal(self._running_signal, False):
                self.tick.emit()
                if THREAD_BUS.wait_signal(self._stop_signal, timeout=self.interval):
                    break
        except RuntimeError as e:
            if "Signal source has been deleted" not in str(e) and "wrapped C/C++ object" not in str(e):
                raise
        finally:
            THREAD_BUS.signal(self._running_signal, False)
