#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D3 status provider: D3 window detection and dynamic state (on_login_screen, disconnected, in_game).
Uses shared refresh flow from status_provider_common; owns D3-specific find and detect logic.
Disconnected: SIFT match of d3_disconnected template (providor.app_constants.D3_DISCONNECTED_TEMPLATE_NAME) in D3 window.
"""

from typing import Optional, List, Dict, Any, Tuple

from pycore.pyfoundations.color_print import ColorPrint
from providor.providor_index import DIABLO_III_WINDOW_TITLES
from share.game_interface_data import get_game_interface_data, get_screen_resolution
from pycore.pyutils.common.window_finder import WindowFinder

from providor.app_constants import D3_DISCONNECTED_TEMPLATE_NAME
from d3utils.d3_scaled_template_matcher import get_d3_scaled_template_matcher as get_scaled_template_matcher
from d3utils.screenshot_provider import get_screenshot_provider
from d3utils.status_provider_common import refresh_window_state


def _find_d3_windows() -> List[Dict[str, Any]]:
    """Find D3 windows by title. Returns list; empty if none found."""
    return WindowFinder.find_windows_by_titles(
        titles=DIABLO_III_WINDOW_TITLES,
        match_mode="in",
        use_cache=True,
    )


def _detect_d3_dynamic(found: bool, window_info_or_none: Optional[Dict[str, Any]]) -> Tuple[bool, bool, bool]:
    """
    Detect D3 dynamic state: (on_login_screen, disconnected, in_game).
    Priority for display: disconnected > on_login_screen > in_game.
    Disconnected: SIFT match of d3_disconnected template in D3 window; found => (False, True, False).
    Uses screenshot_provider (window capture by title) to avoid "screen grab failed" when window is minimized.
    """
    if not found or not window_info_or_none:
        return (False, False, False)
    try:
        provider = get_screenshot_provider()
        sd = provider.gen(use_optimized_capture=True, window_titles=list(DIABLO_III_WINDOW_TITLES))
        if sd is None or sd.game_window_image is None:
            return (False, False, False)
        window_image = sd.game_window_image
        matcher = get_scaled_template_matcher()
        result = matcher.match_template_auto_scale(window_image, D3_DISCONNECTED_TEMPLATE_NAME)
        if result.get("total_matches", 0) > 0:
            return (False, True, False)
    except Exception as e:
        ColorPrint.red(f"[D3StatusProvider] _detect_d3_dynamic error: {e}")
    return (False, False, False)


def _apply_d3_geometry(game_data: Any, window_info_or_none: Optional[Dict[str, Any]]) -> None:
    """Apply or clear D3 window geometry on game_data."""
    if window_info_or_none:
        rect = window_info_or_none["rect"]
        screen_width, screen_height = get_screen_resolution()
        game_data.fullscreen_size = (screen_width, screen_height)
        game_data.window_offset = (rect[0], rect[1])
        if not hasattr(game_data, "_window_hwnd"):
            game_data._window_hwnd = window_info_or_none["hwnd"]
            game_data._window_title = window_info_or_none["title"]
    else:
        game_data.fullscreen_size = (0, 0)
        game_data.window_offset = (0, 0)
        if hasattr(game_data, "_window_hwnd"):
            game_data._window_hwnd = None
            game_data._window_title = None


def refresh_d3_status() -> Optional[Dict[str, Any]]:
    """
    Detect D3 window and dynamic state; update game_interface_data via shared refresh flow.
    Returns D3 window info or None.
    """
    game_data = get_game_interface_data()
    windows = _find_d3_windows()
    window_info: Optional[Dict[str, Any]] = windows[0] if windows else None

    def set_running(g: Any, found: bool) -> None:
        g.set_d3_status(found)

    def set_dynamic(g: Any, on_login: bool, disconnected: bool, third: bool) -> None:
        g.set_d3_dynamic_status(on_login_screen=on_login, disconnected=disconnected, in_game=third)

    refresh_window_state(
        game_data,
        window_info,
        set_running_fn=set_running,
        set_dynamic_fn=set_dynamic,
        detect_dynamic_fn=_detect_d3_dynamic,
        apply_geometry_fn=_apply_d3_geometry,
        log_prefix="[D3StatusProvider]",
    )
    return window_info


def get_current_d3_window() -> Optional[Dict[str, Any]]:
    """Immediate check: return current D3 window info or None."""
    windows = _find_d3_windows()
    return windows[0] if windows else None
