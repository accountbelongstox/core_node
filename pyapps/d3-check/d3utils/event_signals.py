#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Event signals - shared event names and triggers used by shutdown_manager, event_center, d3_extension_thread.
"""

from typing import Optional

from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from providor.constants.common import (
    EXTENSION_SHUTDOWN,
    EXTENSION_ROSBOT_STARTED,
    EXTENSION_ROSBOT_STOPPED,
)


def trigger_extension_shutdown() -> None:
    """Trigger extension shutdown via THREAD_BUS. Called by shutdown_manager."""
    THREAD_BUS.trigger_event(EXTENSION_SHUTDOWN, None)


def trigger_extension_rosbot_started(
    success: bool, error: Optional[Exception] = None, ran_e_block: bool = False
) -> None:
    """Trigger from D3 extension thread when login check done. ran_e_block=True when E1-E6 were run in extension (panel must not call start_rosbot_task)."""
    THREAD_BUS.trigger_event(EXTENSION_ROSBOT_STARTED, (success, error, ran_e_block))


def trigger_extension_rosbot_stopped() -> None:
    """Trigger from D3 extension thread when stop done. Called by d3_extension_thread."""
    THREAD_BUS.trigger_event(EXTENSION_ROSBOT_STOPPED, None)
