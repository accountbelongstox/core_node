#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Window Monitor Timer
Monitors Diablo III window status every 10 seconds and updates game interface data
"""

import os
import sys
from typing import Optional, List, Callable

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
sys.path.insert(0, project_root)

# Add ncore to path for window_finder
ncore_path = os.path.join(os.path.dirname(project_root), 'ncore', 'pytools')
sys.path.insert(0, ncore_path)

from providor.common_imports import ColorPrint
from providor.providor_index import DIABLO_III_WINDOW_TITLES
from share.game_interface_data import get_game_interface_data
from pyutils.common.window_finder import WindowFinder

# Global window monitor state
DEFAULT_INTERVAL = 10.0
_callbacks: List[Callable] = []
_last_window_found = False
_game_data = get_game_interface_data()


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
    Check Diablo III window status (called by timer)

    This function is registered as the timer callback.
    """
    global _last_window_found, _game_data

    try:
        # Use WindowFinder to search for Diablo III windows
        windows = WindowFinder.find_windows_by_titles(
            titles=DIABLO_III_WINDOW_TITLES,
            match_mode="in",  # Match if title contains any of the strings
            use_cache=True
        )

        if windows:
            # Get first matched window
            window_info = windows[0]

            # Update game interface data
            _update_game_data(window_info)

            # Notify callbacks
            _notify_callbacks(window_info)

            # Log if status changed
            if not _last_window_found:
                ColorPrint.green(
                    f"[WindowMonitor] Diablo III window found: "
                    f"'{window_info['title']}' "
                    f"({window_info['width']}x{window_info['height']})"
                )
                _last_window_found = True

        else:
            # Window not found
            _update_game_data(None)
            _notify_callbacks(None)

            # Log if status changed
            if _last_window_found:
                ColorPrint.yellow(
                    "[WindowMonitor] Diablo III window not found"
                )
                _last_window_found = False

    except Exception as e:
        ColorPrint.red(f"[WindowMonitor] Error checking window: {e}")


def _update_game_data(window_info: Optional[dict]):
    """
    Update game interface data with window information

    Args:
        window_info: Window information dictionary or None
    """
    global _game_data

    try:
        if window_info:
            # Extract window information
            rect = window_info['rect']
            width = window_info['width']
            height = window_info['height']

            # Update fullscreen size (assuming game window size)
            _game_data.fullscreen_size = (width, height)

            # Calculate window offset (left, top)
            window_offset = (rect[0], rect[1])
            _game_data.window_offset = window_offset

            # Optional: Store additional window metadata
            # (Not part of original D3InterfaceData, but could be useful)
            if not hasattr(_game_data, '_window_hwnd'):
                _game_data._window_hwnd = window_info['hwnd']
                _game_data._window_title = window_info['title']

        else:
            # Window not found - reset window data
            _game_data.fullscreen_size = (0, 0)
            _game_data.window_offset = (0, 0)

            if hasattr(_game_data, '_window_hwnd'):
                _game_data._window_hwnd = None
                _game_data._window_title = None

    except Exception as e:
        ColorPrint.red(
            f"[WindowMonitor] Error updating game data: {e}"
        )


def get_current_window_info() -> Optional[dict]:
    """
    Get current window information (immediate check, not from timer)

    Returns:
        Window information dictionary or None if not found
    """
    try:
        windows = WindowFinder.find_windows_by_titles(
            titles=DIABLO_III_WINDOW_TITLES,
            match_mode="in",
            use_cache=True
        )

        if windows:
            return windows[0]
        else:
            return None

    except Exception as e:
        ColorPrint.red(
            f"[WindowMonitor] Error getting current window: {e}"
        )
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
    # Import timer manager (static global)
    from timers.timer_manager import register_task

    # Register with timer manager
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
