#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Battle.net status provider: Battle.net window detection and dynamic state (on_login_screen, disconnected, normal_available).
Uses shared refresh flow from status_provider_common; owns Battle.net-specific find and detect logic.
"""

from typing import Optional, List, Dict, Any, Tuple

from providor.common_imports import ColorPrint
from share.game_interface_data import get_game_interface_data

from d3utils.battlenet_manager import get_battlenet_manager
from d3utils.battlenet_operation import get_battlenet_operation
from d3utils.status_provider_common import refresh_window_state


def _find_battlenet_windows() -> List[Dict[str, Any]]:
    """Find Battle.net windows via BattleNetManager. Returns list; empty if none found."""
    return get_battlenet_manager().find_windows(match_mode="in", use_cache=True)


def _detect_battlenet_dynamic(found: bool, window_info_or_none: Optional[Dict[str, Any]]) -> Tuple[bool, bool, bool]:
    """
    Detect Battle.net dynamic state: (on_login_screen, disconnected, normal_available).
    Uses UI Automation only (get_dynamic_state: one enumeration, no screenshot/OCR).
    Priority for UI: disconnected > on_login_screen > normal_available; only one is True.
    """
    if not found:
        return (False, False, False)
    try:
        op = get_battlenet_operation()
        on_login, disconnected, normal_available = op.get_dynamic_state()
        if disconnected:
            return (False, True, False)
        if on_login:
            return (True, False, False)
        if normal_available:
            return (False, False, True)
        return (False, False, False)
    except Exception as e:
        ColorPrint.red(f"[BattlenetStatusProvider] detect_dynamic error: {e}")
        return (False, False, False)


def refresh_battlenet_status() -> Optional[Dict[str, Any]]:
    """
    Detect Battle.net window and dynamic state; update game_interface_data via shared refresh flow.
    No geometry to apply (unlike D3). Returns Battle.net window info or None.
    """
    game_data = get_game_interface_data()
    windows = _find_battlenet_windows()
    window_info: Optional[Dict[str, Any]] = windows[0] if windows else None

    def set_running(g: Any, found: bool) -> None:
        g.set_battlenet_status(found)

    def set_dynamic(g: Any, on_login: bool, disconnected: bool, third: bool) -> None:
        g.set_battlenet_dynamic_status(
            on_login_screen=on_login, disconnected=disconnected, normal_available=third
        )

    refresh_window_state(
        game_data,
        window_info,
        set_running_fn=set_running,
        set_dynamic_fn=set_dynamic,
        detect_dynamic_fn=_detect_battlenet_dynamic,
        apply_geometry_fn=None,
        log_prefix="[BattlenetStatusProvider]",
    )
    ColorPrint.gray(f"[BattlenetStatusProvider] Battle.net window: {'found' if window_info else 'not found'}")
    return window_info


def get_current_battlenet_window() -> Optional[Dict[str, Any]]:
    """Immediate check: return current Battle.net window info or None."""
    windows = _find_battlenet_windows()
    return windows[0] if windows else None
