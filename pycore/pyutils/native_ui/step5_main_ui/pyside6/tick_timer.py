#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TickTimer - Qt-signal-emitting periodic timer.

A TickTimerThread emits a Qt Signal on each tick; emission crosses into the
Qt event loop, so slots run on the Qt main thread. Distinct from the Qt-free
step7_managers/timer_manager, which cannot marshal ticks into Qt.
"""

import threading
from typing import Optional

from PySide6.QtCore import QObject, Signal

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS

JOIN_TIMEOUT_SECONDS = 2.0
DELETED_QOBJECT_MARKERS = ("Signal source has been deleted", "wrapped C/C++ object")


class TickTimerThread(threading.Thread):
    """Emit owner.tick every interval until the stop signal is published."""

    def __init__(self, owner: "TickTimer") -> None:
        super().__init__(name="PySideTickTimerThread", daemon=True)
        self.owner = owner

    def run(self) -> None:
        owner = self.owner
        try:
            while not THREAD_BUS.wait_signal(owner.stop_signal, timeout=owner.interval):
                owner.tick.emit()
        except RuntimeError as e:
            if not any(marker in str(e) for marker in DELETED_QOBJECT_MARKERS):
                ColorPrint.red(f"[TickTimer] tick emit failed interval={owner.interval}: {e}")


class TickTimer(QObject):
    """Periodic tick signal driven by a background thread."""

    tick = Signal()

    def __init__(self, interval: float = 1.0, parent: Optional[QObject] = None):
        super().__init__(parent)
        self.interval = interval
        self.stop_signal = f"native_ui.tick_timer.stop.{id(self)}"
        self._thread: Optional[TickTimerThread] = None

    def start(self):
        if self.is_running():
            return
        THREAD_BUS.clear_signal(self.stop_signal)
        self._thread = TickTimerThread(self)
        self._thread.start()

    def stop(self):
        THREAD_BUS.signal(self.stop_signal, True)
        if self.is_running():
            self._thread.join(timeout=JOIN_TIMEOUT_SECONDS)

    def is_running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()
