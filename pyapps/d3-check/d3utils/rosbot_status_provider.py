#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ROSBOT status provider: extended status (not_found | running | paused) and game_interface_data update.
running = process exists, no window; paused = has window.
"""

from typing import Optional, Dict, Any

from pycore.pyfoundations.color_print import ColorPrint
from share.game_interface_data import get_game_interface_data

from d3utils.rosbot_manager import get_rosbot_manager


def _get_rosbot_detection() -> Dict[str, Any]:
    """Get extended status: not_found | running | paused. Returns dict with status and window_info."""
    return get_rosbot_manager().get_rosbot_detection()


def refresh_rosbot_status() -> Optional[Dict[str, Any]]:
    """
    Detect ROSBOT extended status and update game_interface_data (rosbot_extended_status, rosbot_window_found).
    Returns window info if status is paused, else None.
    """
    game_data = get_game_interface_data()
    detection = _get_rosbot_detection()
    status = detection.get("status", "not_found")
    game_data.set_rosbot_extended_status(status)
    ColorPrint.gray(f"[RosbotStatusProvider] ROSBOT extended status: {status}")
    return detection.get("window_info")


def get_current_rosbot_window() -> Optional[Dict[str, Any]]:
    """Immediate check: return current ROSBOT window info or None."""
    return get_rosbot_manager().get_rosbot_window()
