#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D3 status provider: D3 window detection and dynamic state (on_login_screen, disconnected, in_game).
Uses shared refresh flow from status_provider_common; owns D3-specific find and detect logic.
Disconnected: SIFT match of d3_disconnected template (providor.constants.d3.D3_DISCONNECTED_TEMPLATE_NAME) in D3 window.
"""

from typing import Optional, List, Dict, Any, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from share.game_interface_data import get_game_interface_data, get_screen_resolution

from d3utils.d3_manager import get_d3_manager
from d3utils.d3_start_game_and_teleport_waiter import capture_and_detect_all_d3_states
from d3utils.f3_refresh_line import is_f3_refresh_silent
from d3utils.status_provider_common import refresh_window_state


def _find_d3_windows() -> List[Dict[str, Any]]:
    """Find D3 windows (by exe when d3_path set, else by title). Returns list; empty if none found."""
    return get_d3_manager().find_windows()


def _detect_d3_dynamic(found: bool, window_info_or_none: Optional[Dict[str, Any]]) -> Tuple[bool, bool, bool]:
    """
    Detect D3 dynamic state: (on_login_screen, disconnected, in_game).
    Reuses capture_and_detect_all_d3_states (one capture, all templates) and uses disconnected result.
    """
    if not found or not window_info_or_none:
        return (False, False, False)
    _sd, state_dict = capture_and_detect_all_d3_states(
        window_titles=tuple(get_d3_manager().get_capture_titles())
    )
    disconnected = state_dict.get("disconnected", False)
    return (False, disconnected, False)


def _apply_d3_geometry(game_data: Any, window_info_or_none: Optional[Dict[str, Any]]) -> None:
    """Apply or clear D3 window geometry on game_data."""
    if window_info_or_none:
        rect = window_info_or_none["rect"]
        screen_width, screen_height = get_screen_resolution()
        game_data.fullscreen_size = (screen_width, screen_height)
        game_data.window_offset = (rect[0], rect[1])
        game_data._window_hwnd = window_info_or_none["hwnd"]
        game_data._window_title = window_info_or_none["title"]
    else:
        game_data.fullscreen_size = (0, 0)
        game_data.window_offset = (0, 0)
        game_data._window_hwnd = None
        game_data._window_title = None


def _refresh_d3_status_internal(*, skip_dynamic: bool = False) -> tuple[Optional[Dict[str, Any]], bool]:
    """
    Internal: Detect D3 window and optionally dynamic state; update game_interface_data.
    Returns (D3 window info or None, state_changed: bool).
    """
    game_data = get_game_interface_data()
    windows = _find_d3_windows()
    window_info: Optional[Dict[str, Any]] = windows[0] if windows else None
    win_label = "ok" if window_info else "no"
    if window_info and not skip_dynamic:
        get_d3_manager().prime_window_cache_for_capture()

    def set_running(g: Any, found: bool) -> bool:
        return g.set_d3_status(found)

    def set_dynamic(g: Any, on_login: bool, disconnected: bool, third: bool) -> bool:
        return g.set_d3_dynamic_status(on_login_screen=on_login, disconnected=disconnected, in_game=third)

    def progress_refresh(step: str) -> None:
        ColorPrint.gray_refresh(f"[D3] {win_label} {step}")

    silent = is_f3_refresh_silent()
    detect_fn = (_noop_detect_dynamic if skip_dynamic else _detect_d3_dynamic)
    state_changed = refresh_window_state(
        game_data,
        window_info,
        set_running_fn=set_running,
        set_dynamic_fn=set_dynamic,
        detect_dynamic_fn=detect_fn,
        apply_geometry_fn=_apply_d3_geometry,
        log_prefix="[D3StatusProvider]",
        progress_refresh=(lambda s: None) if silent else progress_refresh,
        skip_final_newline=silent,
    )
    return (window_info, state_changed)


def refresh_d3_status(*, skip_dynamic: bool = False) -> Optional[Dict[str, Any]]:
    """
    Detect D3 window and optionally dynamic state; update game_interface_data.
    skip_dynamic=True: only find window + geometry (no screenshot/SIFT). Use for status refresh (startup, manual). Flow uses skip_dynamic=False.
    Returns D3 window info or None (backward compatible).
    """
    window_info, _ = _refresh_d3_status_internal(skip_dynamic=skip_dynamic)
    return window_info


def _noop_detect_dynamic(_found: bool, _window_info_or_none: Optional[Dict[str, Any]]) -> Tuple[bool, bool, bool]:
    """No capture, no SIFT. Used by status refresh path only."""
    return (False, False, False)


def get_current_d3_window() -> Optional[Dict[str, Any]]:
    """Immediate check: return current D3 window info or None."""
    windows = _find_d3_windows()
    return windows[0] if windows else None
