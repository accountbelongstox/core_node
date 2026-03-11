#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Battle.net status provider: window detection and dynamic state (on_login_screen, disconnected, normal_available).
Uses shared refresh flow from status_provider_common. Region (Asia/CN) is resolved at startup; get_battlenet_operation()
returns an operation bound to that region so get_dynamic_state() uses only the known region. Region detection uses
d3utils.battlenet_region_judge.BattlenetRegionJudge; Asia login UI details in d3utils.battlenet_asia_ops.
"""

import json
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple

from pycore.pyfoundations.color_print import ColorPrint
from share.game_interface_data import get_game_interface_data
from providor.providor_index import get_config_value_safe, set_config_value_async, BATTLE_NET_CONFIG_PATH
from providor.constants.common import (
    BATTLE_NET_CONFIG_SERVICES_KEY,
    BATTLE_NET_CONFIG_LAST_LOGIN_REGION_KEY,
    BATTLE_NET_CONFIG_REGION_CN,
)

from d3utils.battlenet_manager import get_battlenet_manager
from d3utils.battlenet_operation import get_battlenet_operation
from d3utils.status_provider_common import refresh_window_state


def _find_last_login_region_recursive(obj):
    """Recursively find Services.LastLoginRegion; config key containing Services is dynamic (e.g. install ID)."""
    if not isinstance(obj, dict):
        return None
    services = obj.get(BATTLE_NET_CONFIG_SERVICES_KEY, {})
    if isinstance(services, dict) and BATTLE_NET_CONFIG_LAST_LOGIN_REGION_KEY in services:
        val = services[BATTLE_NET_CONFIG_LAST_LOGIN_REGION_KEY]
        if isinstance(val, str) and val.strip():
            return val.strip()
        return val if isinstance(val, str) else None
    for v in obj.values():
        found = _find_last_login_region_recursive(v)
        if found:
            return found
    return None


def _read_region_from_battlenet_config() -> Optional[str]:
    """
    Read Battle.net region from config file. Services.LastLoginRegion is under a dynamic key (install ID), search recursively.
    Returns "cn" if LastLoginRegion is CN (case-insensitive), "asia" otherwise, or None if not found/invalid.
    """
    config_path = Path(BATTLE_NET_CONFIG_PATH)
    if not config_path.exists():
        ColorPrint.gray(f"[BattlenetStatusProvider] _read_region_from_battlenet_config: config missing path={config_path}")
        return None
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            raw_text = f.read()
    except OSError as e:
        ColorPrint.yellow(f"[BattlenetStatusProvider] _read_region_from_battlenet_config: read file error {e}")
        return None
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as e:
        ColorPrint.yellow(f"[BattlenetStatusProvider] _read_region_from_battlenet_config: JSON error {e}")
        ColorPrint.gray(f"[BattlenetStatusProvider] config file raw text (first 2000 chars):\n{raw_text[:2000]}")
        return None
    if not isinstance(data, dict):
        ColorPrint.gray(f"[BattlenetStatusProvider] _read_region_from_battlenet_config: root not dict, keys={list(data.keys()) if hasattr(data, 'keys') else type(data).__name__}")
        ColorPrint.gray(f"[BattlenetStatusProvider] config file raw text (first 2000 chars):\n{raw_text[:2000]}")
        return None
    last_login_region = _find_last_login_region_recursive(data)
    ColorPrint.gray(
        f"[BattlenetStatusProvider] _read_region_from_battlenet_config: read LastLoginRegion={repr(last_login_region)}"
    )
    if not last_login_region or not isinstance(last_login_region, str):
        ColorPrint.gray(
            f"[BattlenetStatusProvider] _read_region_from_battlenet_config: LastLoginRegion empty/invalid raw={repr(last_login_region)}, printing full config as debug:"
        )
        ColorPrint.gray(f"[BattlenetStatusProvider] --- Battle.net.config full text ---\n{raw_text}\n--- end ---")
        return None
    # CN region -> "cn"; non-CN (KR/US/EU/TW etc.) -> "asia"
    is_cn = last_login_region.strip().upper() == BATTLE_NET_CONFIG_REGION_CN
    result = "cn" if is_cn else "asia"
    ColorPrint.gray(
        f"[BattlenetStatusProvider] _read_region_from_battlenet_config: LastLoginRegion={repr(last_login_region)} -> {result}"
    )
    return result


def ensure_battlenet_region_from_config() -> None:
    """
    Resolve Battle.net region from config only (no UI). When game_data.battlenet_region is None:
    1) Read Battle.net.config file (Services.LastLoginRegion): CN -> "cn", non-CN (KR/US/EU/TW etc.) -> "asia";
    2) If not found, read ros_settings.battlenet_region_cache.
    Sets game_data.battlenet_region and optionally ros_settings.battlenet_region_cache when read from file.
    Call before using get_battlenet_region() when region must be config-based.
    """
    game_data = get_game_interface_data()
    if game_data.get_battlenet_region() is not None:
        return
    config_region = _read_region_from_battlenet_config()
    if config_region in ("asia", "cn"):
        game_data.set_battlenet_region(config_region)
        set_config_value_async("ros_settings.battlenet_region_cache", config_region)
        return
    cached = get_config_value_safe("ros_settings.battlenet_region_cache")
    if cached in ("asia", "cn"):
        game_data.set_battlenet_region(cached)


def _find_battlenet_windows() -> List[Dict[str, Any]]:
    """Find Battle.net windows via BattleNetManager. Returns list; empty if none found."""
    return get_battlenet_manager().find_windows(match_mode="in", use_cache=True)


def _detect_battlenet_dynamic(found: bool, window_info_or_none: Optional[Dict[str, Any]]) -> Tuple[bool, bool, bool]:
    """
    Detect Battle.net dynamic state: (on_login_screen, disconnected, normal_available).
    Region is initialized from Battle.net.config file during game data initialization.
    If region is not set, try reading from config file or cache as fallback.
    UI detection is no longer used for region detection (only for dynamic state).
    """
    if not found:
        return (False, False, False)
    ensure_battlenet_region_from_config()
    game_data = get_game_interface_data()
    preferred_region = game_data.get_battlenet_region()
    try:
        op = get_battlenet_operation()
        on_login, disconnected, normal_available, _play_name, _connecting, _region_detected = op.get_dynamic_state()
        # Region is no longer updated from UI detection; it's set from config file during initialization
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


def _refresh_battlenet_status_internal() -> tuple[Optional[Dict[str, Any]], bool]:
    """
    Internal: Detect Battle.net window and dynamic state; update game_interface_data via shared refresh flow.
    Returns (Battle.net window info or None, state_changed: bool).
    """
    game_data = get_game_interface_data()
    windows = _find_battlenet_windows()
    window_info: Optional[Dict[str, Any]] = windows[0] if windows else None
    win_label = "ok" if window_info else "no"

    def set_running(g: Any, found: bool) -> bool:
        return g.set_battlenet_status(found)

    def set_dynamic(g: Any, on_login: bool, disconnected: bool, third: bool) -> bool:
        return g.set_battlenet_dynamic_status(
            on_login_screen=on_login, disconnected=disconnected, normal_available=third
        )

    def progress_refresh(step: str) -> None:
        ColorPrint.gray_refresh(f"[BN] {win_label} {step}")

    state_changed = refresh_window_state(
        game_data,
        window_info,
        set_running_fn=set_running,
        set_dynamic_fn=set_dynamic,
        detect_dynamic_fn=_detect_battlenet_dynamic,
        apply_geometry_fn=None,
        log_prefix="[BattlenetStatusProvider]",
        progress_refresh=progress_refresh,
    )
    return (window_info, state_changed)


def refresh_battlenet_status() -> Optional[Dict[str, Any]]:
    """
    Detect Battle.net window and dynamic state; update game_interface_data via shared refresh flow.
    No geometry to apply (unlike D3). Returns Battle.net window info or None (backward compatible).
    """
    window_info, _ = _refresh_battlenet_status_internal()
    return window_info


def get_current_battlenet_window() -> Optional[Dict[str, Any]]:
    """Immediate check: return current Battle.net window info or None."""
    windows = _find_battlenet_windows()
    return windows[0] if windows else None
