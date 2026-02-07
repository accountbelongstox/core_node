#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ROSBOT status provider: extended status (not_found | running | paused) and game_interface_data update. All lookup via same-dir exe flow (see docs/ROSBOT_LOOKUP_FLOW.md). running = process, no window; paused = has window.
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
    Detect ROSBOT extended status and update game_interface_data (rosbot_extended_status, rosbot_window_found, rosbot_found_exe_name, rosbot_found_window_title).
    Returns window info if status is paused, else None.
    """
    game_data = get_game_interface_data()
    detection = _get_rosbot_detection()
    status = detection.get("status", "not_found")
    game_data.set_rosbot_extended_status(status)

    exe_name = ""
    window_title = ""
    if status != "not_found":
        mgr = get_rosbot_manager()
        procs = mgr.get_running_rosbot_processes()
        first = procs[0] if procs else None
        if first:
            exe_name = first.get("exe_name") or ""
            winfo = detection.get("window_info") or (first.get("window_info") if first else None)
            window_title = (winfo.get("title") or "") if winfo else ""
    game_data.set_rosbot_found_display(exe_name, window_title)

    return detection.get("window_info")


def get_current_rosbot_window() -> Optional[Dict[str, Any]]:
    """Immediate check: return current ROSBOT window info or None."""
    return get_rosbot_manager().get_rosbot_window()
