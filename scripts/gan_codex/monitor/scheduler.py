"""Simple scheduler for periodic discovery."""

from __future__ import annotations

import logging
import threading
import time
from typing import Callable, Optional

LOGGER = logging.getLogger(__name__)


class DiscoveryScheduler:
    """Periodically execute a callback to refresh terminal instances."""

    def __init__(self, interval_seconds: float, task: Callable[[], None]) -> None:
        self.interval_seconds = interval_seconds
        self.task = task
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, name="TerminalDiscoveryScheduler", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=1)
        self._thread = None

    def _run(self) -> None:
        while not self._stop_event.is_set():
            start = time.perf_counter()
            try:
                self.task()
            except Exception:  # pragma: no cover - log on failure
                LOGGER.exception("Discovery task failed.")
            elapsed = time.perf_counter() - start
            sleep_time = max(0.1, self.interval_seconds - elapsed)
            self._stop_event.wait(timeout=sleep_time)
