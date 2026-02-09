# -*- coding: utf-8 -*-
"""
Registry for ROSBOT task start/stop. Used so controller layer can trigger start_rosbot_task
without importing rosbot_task_processor (avoids circular import with flow_bn_only).
"""
from typing import Callable, Optional

_start_rosbot_task_fn: Optional[Callable[[], None]] = None


def register_start_rosbot_task(fn: Callable[[], None]) -> None:
    """Register the start_rosbot_task implementation. Called by rosbot_task_processor on load."""
    global _start_rosbot_task_fn
    _start_rosbot_task_fn = fn


def get_start_rosbot_task() -> Optional[Callable[[], None]]:
    """Return the registered start_rosbot_task callable, or None if not yet registered."""
    return _start_rosbot_task_fn
