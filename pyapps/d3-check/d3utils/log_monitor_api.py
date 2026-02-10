# -*- coding: utf-8 -*-
"""
Log monitor API: set_log_file, set_rosbot_running.
Thin delegate so rosbot_task_processor (and others) can set log file / rosbot state
without importing log_monitor (avoids circular import: log_monitor -> log_analyzer -> ... -> rosbot_task_processor -> log_monitor).
Implementation is registered by log_monitor when it loads.
"""
from typing import Callable, Optional

_get_monitor: Optional[Callable] = None


def register(get_monitor_fn: Callable) -> None:
    """Register the get_log_monitor() from log_monitor. Called by log_monitor on load."""
    global _get_monitor
    _get_monitor = get_monitor_fn


def set_log_file(file_path: str) -> None:
    """Set the log file to monitor. No-op if log_monitor not yet registered."""
    if _get_monitor is not None:
        _get_monitor().set_log_file(file_path)


def set_rosbot_running(running: bool) -> None:
    """Set ROSBOT running status. No-op if log_monitor not yet registered."""
    if _get_monitor is not None:
        _get_monitor().set_rosbot_running(running)
