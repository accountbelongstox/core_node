#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Battle.net status provider: window detection and dynamic state (on_login_screen, disconnected, normal_available).
Uses shared refresh flow from status_provider_common. Region (Asia/CN) is resolved at startup; get_battlenet_operation()
returns an operation bound to that region so get_dynamic_state() uses only the known region. Region detection uses
d3utils.battlenet_region_judge.BattlenetRegionJudge; Asia login UI details in d3utils.battlenet_asia_ops.
"""

from typing import Optional, List, Dict, Any, Tuple

from pycore.pyfoundations.color_print import ColorPrint
from share.game_interface_data import get_game_interface_data
from providor.providor_index import get_config_value_safe, set_config_value_async

from d3utils.battlenet_manager import get_battlenet_manager
from d3utils.battlenet_operation import get_battlenet_operation
from d3utils.status_provider_common import refresh_window_state


def _find_battlenet_windows() -> List[Dict[str, Any]]:
    """Find Battle.net windows via BattleNetManager. Returns list; empty if none found."""
    return get_battlenet_manager().find_windows(match_mode="in", use_cache=True)


def _detect_battlenet_dynamic(found: bool, window_info_or_none: Optional[Dict[str, Any]]) -> Tuple[bool, bool, bool]:
    """
    Detect Battle.net dynamic state: (on_login_screen, disconnected, normal_available).
    Uses preferred_region from cache when set so we try only that region; on match updates region and persists cache.
    """
    if not found:
        return (False, False, False)
    game_data = get_game_interface_data()
    if game_data.get_battlenet_region() is None:
        cached = get_config_value_safe("ros_settings.battlenet_region_cache")
        if cached in ("asia", "cn"):
            game_data.set_battlenet_region(cached)
    preferred_region = game_data.get_battlenet_region()
    try:
        op = get_battlenet_operation()
        ColorPrint.gray("[BattlenetStatusProvider] progress: get_dynamic_state (UI enum)...")
        on_login, disconnected, normal_available, _play_name, _connecting, region_detected = op.get_dynamic_state()
        ColorPrint.gray("[BattlenetStatusProvider] progress: get_dynamic_state done")
        if region_detected in ("asia", "cn"):
            game_data.set_battlenet_region(region_detected)
            set_config_value_async("ros_settings.battlenet_region_cache", region_detected)
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
    ColorPrint.gray("[BattlenetStatusProvider] progress: find_windows...")
    windows = _find_battlenet_windows()
    window_info: Optional[Dict[str, Any]] = windows[0] if windows else None
    ColorPrint.gray(f"[BattlenetStatusProvider] Battle.net window: {'found' if window_info else 'not found'}")
    ColorPrint.gray("[BattlenetStatusProvider] progress: refresh_window_state (set_running + detect_dynamic + set_dynamic)...")

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
    ColorPrint.gray("[BattlenetStatusProvider] progress: refresh_window_state done")
    return window_info


def get_current_battlenet_window() -> Optional[Dict[str, Any]]:
    """Immediate check: return current Battle.net window info or None."""
    windows = _find_battlenet_windows()
    return windows[0] if windows else None
