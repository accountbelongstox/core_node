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

from pycore.pyfoundations.color_print import ColorPrint
from share.game_interface_data import get_game_interface_data
from timers.timer_manager import register_task
from d3utils.d3_status_provider import refresh_d3_status, get_current_d3_window
from d3utils.battlenet_status_provider import refresh_battlenet_status
from d3utils.rosbot_status_provider import refresh_rosbot_status

from providor.app_constants import DEFAULT_INTERVAL

# Global window monitor state
_callbacks: List[Callable] = []
_last_window_found = False



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
        ColorPrint.blue(
            f"[WindowMonitor] Added callback: {callback.__name__}"
        )


def remove_callback(callback: Callable):
    """
    Remove callback

    Args:
        callback: Callback function to remove
    """
    global _callbacks

    if callback in _callbacks:
        _callbacks.remove(callback)
        ColorPrint.blue(
            f"[WindowMonitor] Removed callback: {callback.__name__}"
        )


def register_status_ui(callback: Callable):
    """
    Register status UI with timer-driven data: register callback on game_interface_data.
    Timer calls d3_status_provider and battlenet_status_provider; when they update state, this callback(state) is invoked. D3/Battle.net state independent of rosbot.
    First check is run by controller when UI is ready (start_timer_loop_after_ui_ready), not here, to avoid callbacks before status widgets exist.
    Callback signature: callback(state: dict); state has battlenet_window_found, d3_running, rosbot_running, map_type, game_stage, and dynamic flags.
    Called from controller (timer and UI are sibling modules; no cross-import).
    """
    get_game_interface_data().register_callback(callback)
    ColorPrint.blue(f"[WindowMonitor] Status UI registered: {callback.__name__}")


def _notify_callbacks(window_info: Optional[dict]):
    """
    Notify all registered callbacks with window information

    Args:
        window_info: Window information dictionary or None if not found
    """
    global _callbacks

    for callback in _callbacks:
        try:
            callback(window_info)
        except Exception as e:
            ColorPrint.red(
                f"[WindowMonitor] Error in callback {callback.__name__}: {e}"
            )


def check_window():
    """
    Timer callback: refresh Battle.net then D3 then ROSBOT status (flow B1→B16 before A5; each provider owns its logic), then notify D3 window info callbacks.
    Always push current game state to status UI so UI updates even when no field changed (fixes race: first callback may run before status widgets exist).
    """
    global _last_window_found

    try:
        g = get_game_interface_data()
        bn_only = g.ensure_battlenet_only_master_enabled
        flow_master = g.rosbot_flow_master_enabled
        skip_d3 = bn_only and not flow_master

        ColorPrint.blue("[Refresh] Refreshing status (Battle.net + D3 + ROSBOT)...")
        refresh_battlenet_status()
        g = get_game_interface_data()
        bn_found = g.battlenet_window_found
        ColorPrint.blue(f"[Refresh] Battle.net: {'found' if bn_found else 'not found'}")

        d3_info = None
        if not skip_d3:
            d3_info = refresh_d3_status()
            g = get_game_interface_data()
            d3_running = g.d3_running
            ColorPrint.blue(f"[Refresh] D3: {'found' if d3_running else 'not found'}")
        else:
            ColorPrint.gray("[Refresh] Ensure Battle.net only: skip D3 detection")

        refresh_rosbot_status()
        g = get_game_interface_data()

        g.notify_state_sync()
        ColorPrint.blue("[Refresh] State pushed to UI")

        _notify_callbacks(d3_info)

        if d3_info:
            if not _last_window_found:
                ColorPrint.green(
                    f"[WindowMonitor] Diablo III window found: "
                    f"'{d3_info['title']}' ({d3_info['width']}x{d3_info['height']})"
                )
                _last_window_found = True
        else:
            if _last_window_found:
                ColorPrint.yellow("[WindowMonitor] Diablo III window not found")
                _last_window_found = False

    except Exception as e:
        ColorPrint.red(f"[WindowMonitor] Error checking window: {e}")


def get_current_window_info() -> Optional[dict]:
    """Immediate check: return current D3 window info or None. Uses d3_status_provider."""
    try:
        return get_current_d3_window()
    except Exception as e:
        ColorPrint.red(f"[WindowMonitor] Error getting current window: {e}")
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
        callback=check_window,
        enabled=enabled
    )

    if success:
        ColorPrint.green(
            f"[WindowMonitor] Registered with timer manager "
            f"(interval={interval}s, enabled={enabled})"
        )

    return success


# Initialize on module import
ColorPrint.blue("[WindowMonitor] Module initialized (static global)")
