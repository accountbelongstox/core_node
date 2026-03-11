# -*- coding: utf-8 -*-
"""
Registry for ROSBOT task start/stop. Used so controller and d3_extension_thread can trigger
start/stop without importing rosbot_task_processor (avoids circular import with flow_bn_only).
"""
from typing import Callable, Optional

_start_rosbot_task_fn: Optional[Callable[[], None]] = None
_stop_rosbot_task_fn: Optional[Callable[[], None]] = None


def register_start_rosbot_task(fn: Callable[[], None]) -> None:
    """Register the start_rosbot_task implementation. Called by rosbot_task_processor on load."""
    global _start_rosbot_task_fn
    _start_rosbot_task_fn = fn


def register_stop_rosbot_task(fn: Callable[[], None]) -> None:
    """Register the stop_rosbot_task implementation. Called by rosbot_task_processor on load."""
    global _stop_rosbot_task_fn
    _stop_rosbot_task_fn = fn


def get_start_rosbot_task() -> Optional[Callable[[], None]]:
    """Return the registered start_rosbot_task callable, or None if not yet registered."""
    return _start_rosbot_task_fn


def get_stop_rosbot_task() -> Optional[Callable[[], None]]:
    """Return the registered stop_rosbot_task callable, or None if not yet registered."""
    return _stop_rosbot_task_fn
