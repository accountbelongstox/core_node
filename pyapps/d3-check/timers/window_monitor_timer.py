#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Window Monitor Timer
Periodically calls window status providers, detects D3/Battle.net windows and updates game_interface_data; status UI receives updates via game_interface_data callbacks (independent of ROSBOT running).
"""

import os
import sys
import threading
from typing import Optional, List, Callable

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
sys.path.insert(0, project_root)

from share.game_interface_data import get_game_interface_data
from d3utils.rosbot_task_processor import run_full_status_refresh
from timers.timer_manager import register_task
from d3utils.d3_status_provider import get_current_d3_window
from d3utils.tick_driver import register_inactive_refresh

from providor.constants.common import DEFAULT_INTERVAL

# Global window monitor state
_callbacks: List[Callable] = []
_last_window_found = False
# When True, do not run full refresh again when flow inactive (startup already did one; flow-driven runs when flow active).
_inactive_refresh_done = False



def add_callback(callback: Callable):
    """
    Add callback for window status updates

    Callback signature: callback(window_info: Optional[Dict])
    where window_info contains: hwnd, title, rect, width, height, etc.

    Args:
        callback: Callback function to add
    """
    global _callbacks

    if callback not in _callbacks:
        _callbacks.append(callback)


def remove_callback(callback: Callable):
    """
    Remove callback

    Args:
        callback: Callback function to remove
    """
    global _callbacks

    if callback in _callbacks:
        _callbacks.remove(callback)


def register_status_ui(callback: Callable):
    """
    Register status UI with timer-driven data: register callback on game_interface_data.
    Timer calls d3_status_provider and battlenet_status_provider; when they update state, this callback(state) is invoked. D3/Battle.net state independent of rosbot.
    First check is run by controller when UI is ready (start_timer_loop_after_ui_ready), not here, to avoid callbacks before status widgets exist.
    Callback signature: callback(state: dict); state has battlenet_window_found, d3_running, rosbot_running, map_type, game_stage, and dynamic flags.
    Called from controller (timer and UI are sibling modules; no cross-import).
    """
    get_game_interface_data().register_callback(callback)


def _notify_callbacks(window_info: Optional[dict]):
    """Notify all registered callbacks with D3 window info (hwnd, rect, etc.)."""
    global _callbacks
    for callback in _callbacks:
        try:
            callback(window_info)
        except Exception:
            pass


def notify_window_callbacks(window_info: Optional[dict]) -> None:
    """Public API: notify D3 window callbacks after a full refresh. Reusable from initial check or manual refresh."""
    _notify_callbacks(window_info)


def mark_inactive_refresh_done() -> None:
    """Mark that the one-time inactive refresh has been done (startup). Timer will not run full refresh again when flow inactive."""
    global _inactive_refresh_done
    _inactive_refresh_done = True


def refresh_window_status_if_inactive() -> None:
    """
    Run full refresh at most once (idempotent). When to call is driven by tick/flow; this module does not check flow state.
    """
    global _last_window_found, _inactive_refresh_done
    if _inactive_refresh_done:
        return
    d3_info = run_full_status_refresh()
    _notify_callbacks(d3_info)
    _last_window_found = bool(d3_info)
    _inactive_refresh_done = True


register_inactive_refresh(refresh_window_status_if_inactive)


def check_window() -> None:
    """Deprecated alias for refresh_window_status_if_inactive."""
    refresh_window_status_if_inactive()


def get_current_window_info() -> Optional[dict]:
    """Immediate check: return current D3 window info or None. Uses d3_status_provider."""
    try:
        return get_current_d3_window()
    except Exception as e:
        return None


def initialize_and_register(interval: float = DEFAULT_INTERVAL, enabled: bool = True):
    """
    Initialize window monitor and register with timer manager

    Args:
        interval: Monitoring interval in seconds (default: 10.0)
        enabled: Whether to enable the timer immediately (default: True)

    Returns:
        True if registered successfully, False otherwise
    """
    success = register_task(
        name="window_monitor",
        interval=interval,
        callback=refresh_window_status_if_inactive,
        enabled=enabled
    )

    return success
