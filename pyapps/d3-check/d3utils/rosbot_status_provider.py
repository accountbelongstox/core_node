#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ROSBOT status provider: extended status (not_found | running | paused) and game_interface_data update.
running = process exists, zero visible windows. paused = any visible window (main UI or popup dialog). All lookup via same-dir exe flow (docs/ROSBOT_LOOKUP_FLOW.md).
"""

from typing import Optional, Dict, Any

from pycore.pyfoundations.color_print import ColorPrint
from share.game_interface_data import get_game_interface_data

from d3utils.rosbot_flow_rosbot_exit_state import mark_rosbot_exit_reason_when_process_gone
from d3utils.rosbot_manager import get_rosbot_manager
from d3utils.rosbot_operation import get_rosbot_operation


def _get_rosbot_detection() -> Dict[str, Any]:
    """Get extended status: not_found | running | paused. Returns dict with status and window_info."""
    return get_rosbot_manager().get_rosbot_detection()


def _refresh_rosbot_status_internal() -> tuple[Optional[Dict[str, Any]], bool]:
    """
    Internal: Detect ROSBOT extended status and update game_interface_data.
    When status goes from running/paused to not_found, mark exit reason here (no duration; F3 timeout path marks with duration for test record).
    Returns (window info if status is paused else None, state_changed: bool).
    """
    game_data = get_game_interface_data()
    prev_status = game_data.rosbot_extended_status
    detection = _get_rosbot_detection()
    if not isinstance(detection, dict):
        detection = {}
    status = detection.get("status", "not_found")
    if prev_status in ("running", "paused") and status == "not_found":
        mark_rosbot_exit_reason_when_process_gone()
    status_changed = game_data.set_rosbot_extended_status(status)
    has_main_ui = status == "paused"
    main_ui_changed = game_data.set_rosbot_has_main_ui(has_main_ui)

    exe_name = detection.get("exe_name") or ""
    winfo = detection.get("window_info")
    window_title = (winfo.get("title") or "") if isinstance(winfo, dict) else ""
    display_changed = game_data.set_rosbot_found_display(exe_name, window_title)

    pids = detection.get("pids") or []
    ui_state = get_rosbot_operation().get_ui_state(pids=pids if pids else None)
    # set_rosbot_ui_need_key doesn't notify (main thread only reads), so no need to track change
    game_data.set_rosbot_ui_need_key(
        ui_state.get("need_key_input", False),
        (ui_state.get("message") or "").strip(),
    )

    state_changed = status_changed or display_changed or main_ui_changed
    return (detection.get("window_info"), state_changed)


def refresh_rosbot_status() -> Optional[Dict[str, Any]]:
    """
    Detect ROSBOT extended status and update game_interface_data (rosbot_extended_status, rosbot_window_found, rosbot_found_exe_name, rosbot_found_window_title).
    Single lookup: get_rosbot_detection() returns status, window_info, exe_name, pids; no second get_running_rosbot_processes(). get_ui_state(pids=...) reuses pids to avoid re-enumeration.
    Returns window info if status is paused, else None (backward compatible).
    """
    window_info, _ = _refresh_rosbot_status_internal()
    return window_info


def get_current_rosbot_window() -> Optional[Dict[str, Any]]:
    """Immediate check: return current ROSBOT window info or None."""
    return get_rosbot_manager().get_rosbot_window()
