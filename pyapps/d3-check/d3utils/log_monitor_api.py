# -*- coding: utf-8 -*-
"""
Log monitor API: set_log_file, set_rosbot_running.
Thin delegate so callers can set monitored file / rosbot state without importing log_monitor
(avoids circular import). Implementation registered by log_monitor when it loads.

Where log-driven lives (logs.txt change → print + events):
  - File: LOGS_FILE_PATH (RoS-BoT/Logs/logs.txt). Set via set_log_file() when starting.
  - Driven only by watchdog _LogFileEventHandler.on_modified() → _read_and_process_new_lines(). Not called from tick.
  - _read_and_process_new_lines(): per line ColorPrint.info("[ROSBOT] " + line) [print]; then analyze_log_line(line) [analyze]. Real-time processing in watchdog observer thread. Flow is 2s tick in rosbot_task_processor (for timeout detection only).
"""
from typing import Callable, Optional

_get_monitor: Optional[Callable] = None
_get_last_log_modified_time: Optional[Callable[[], float]] = None


def register(get_monitor_fn: Callable) -> None:
    """Called by lifecycle on load."""
    global _get_monitor
    _get_monitor = get_monitor_fn


def register_get_last_log_modified_time(fn: Callable[[], float]) -> None:
    """Called by lifecycle on load."""
    global _get_last_log_modified_time
    _get_last_log_modified_time = fn


def set_log_file(file_path: str) -> None:
    if _get_monitor is not None:
        _get_monitor().set_log_file(file_path)


def set_rosbot_running(running: bool) -> None:
    if _get_monitor is not None:
        _get_monitor().set_rosbot_running(running)


def get_last_log_modified_time() -> float:
    """Return last log mtime; 0.0 if not registered or not initialized."""
    if _get_last_log_modified_time is not None:
        return _get_last_log_modified_time()
    return 0.0
