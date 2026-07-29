# -*- coding: utf-8 -*-
"""
LogMonitorThread: watchdog-driven read of logs.txt. All logic in this module.
No dependency on rosbot_flow_f3_* or any flow/history modules. Those (F3 baseline, started_at,
timeout_restart, etc.) are for reading history / flow (ROSBOT_FLOW_MERMAID), not for log.txt.
This monitor only reads logs.txt on watchdog on_modified and emits LOG_LINE; it does not write.

Created by ThreadRegistry at app start. BUS only (LOG_LINE, LOG_MONITOR_INIT). File exists and is read-only for us; no lock.
"""
import os
import queue
import threading
import time
from pathlib import Path
from typing import Any, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.third_party.api import get_third_package_watchdog
from providor.constants.common import LOG_LINE, LOG_MONITOR_INIT

_POLL_INTERVAL_SEC = 2.0

_watchdog_mod = get_third_package_watchdog()
if _watchdog_mod is not None:
    _Observer = _watchdog_mod.observers.Observer
    _FileSystemEventHandler = _watchdog_mod.events.FileSystemEventHandler
else:
    _Observer = None
    _FileSystemEventHandler = object


def _format_mtime(ts: float) -> str:
    if ts <= 0:
        return "-"
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(ts))


def _emit_init_message(path: str, last_modified: float) -> None:
    THREAD_BUS.trigger_event(LOG_MONITOR_INIT, f"[LogMonitor] init path={path!r} last_modified={_format_mtime(last_modified)}")


class _LogFileEventHandler(_FileSystemEventHandler):
    def __init__(self, thread: "LogMonitorThread") -> None:
        if _FileSystemEventHandler is not object:
            super().__init__()
        self._thread = thread

    def on_modified(self, event: Any) -> None:
        if getattr(event, "is_directory", False):
            return
        path = self._thread._current_path
        if not path:
            return
        src = os.path.normpath(os.path.abspath(event.src_path))
        log_path = os.path.normpath(os.path.abspath(path))
        if os.path.normcase(src) != os.path.normcase(log_path):
            return
        self._thread._read_new_lines()


class LogMonitorThread(threading.Thread):
    """
    Native thread (inherits threading.Thread). Watchdog-driven: on_modified -> _read_new_lines.
    Must call Thread.__init__ before any other attribute (Python requirement).
    """

    def __init__(self, initial_path: str):
        threading.Thread.__init__(self, daemon=True, name="LogMonitorThread")
        self._initial_path = initial_path
        self._cmd_queue: queue.Queue = queue.Queue()
        self._stop = threading.Event()
        self._current_path: Optional[str] = None
        self._last_position = 0
        self._last_modified = 0.0
        self._log_initialized = False
        self._observer: Any = None

    @property
    def last_modified(self) -> float:
        return self._last_modified

    @property
    def initialized(self) -> bool:
        return self._log_initialized

    @property
    def log_file_path(self) -> Optional[str]:
        return self._current_path

    def set_log_file(self, file_path: str) -> None:
        self._cmd_queue.put(("path", file_path))

    def request_stop(self) -> None:
        self._stop.set()
        self._cmd_queue.put(("stop", None))

    def stop_watching(self) -> None:
        self.request_stop()
        if self.is_alive():
            self.join(timeout=5.0)

    def set_rosbot_running(self, _running: bool) -> None:
        pass

    def _read_new_lines(self) -> None:
        path = self._current_path
        if not path or not os.path.isfile(path):
            return
        current_size = os.path.getsize(path)
        current_modified = os.path.getmtime(path)
        pos = self._last_position
        if pos < 0:
            pos = 0
        if current_size < pos:
            pos = 0
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            f.seek(pos)
            new_content = f.read()
            self._last_position = f.tell()
        if not new_content:
            return
        self._last_modified = current_modified
        for line in new_content.strip().split("\n"):
            if line and line.strip():
                THREAD_BUS.trigger_event(LOG_LINE, line)

    def _apply_path(self, file_path: str) -> bool:
        if self._current_path == file_path and self._log_initialized:
            return False
        self._stop_observer()
        if not os.path.exists(file_path):
            THREAD_BUS.trigger_event(LOG_MONITOR_INIT, f"[LogMonitor] Log file not found: {file_path}")
            return False
        self._current_path = file_path
        self._last_position = os.path.getsize(file_path)
        self._last_modified = os.path.getmtime(file_path)
        self._log_initialized = True
        _emit_init_message(self._current_path, self._last_modified)
        if _Observer is not None:
            self._start_observer()
        return True

    def _start_observer(self) -> None:
        if _Observer is None or not self._current_path or self._observer is not None:
            return
        watch_dir = str(Path(self._current_path).resolve().parent)
        if not watch_dir or not os.path.isdir(watch_dir):
            return
        self._observer = _Observer()
        self._observer.schedule(_LogFileEventHandler(self), watch_dir, recursive=False)
        self._observer.start()

    def _stop_observer(self) -> None:
        if self._observer is None:
            return
        self._observer.stop()
        self._observer.join(timeout=3.0)
        self._observer = None

    def run(self) -> None:
        self._apply_path(self._initial_path)
        while not self._stop.is_set():
            try:
                cmd, arg = self._cmd_queue.get(timeout=_POLL_INTERVAL_SEC)
            except queue.Empty:
                if self._log_initialized and self._current_path and os.path.getmtime(self._current_path) > self._last_modified:
                    self._read_new_lines()
                continue
            if cmd == "stop":
                break
            if cmd == "path" and isinstance(arg, str):
                self._apply_path(arg)
        self._stop_observer()


def register_log_monitor_init_handler() -> None:
    """Register LOG_MONITOR_INIT handler to print init message. Call once at startup."""
    def _on_init(data: Any) -> None:
        if isinstance(data, str) and data:
            ColorPrint.blue(data)
    THREAD_BUS.register_event_handler(LOG_MONITOR_INIT, _on_init, priority=50)
