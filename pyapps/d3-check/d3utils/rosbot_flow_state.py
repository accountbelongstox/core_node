# -*- coding: utf-8 -*-
"""
Flow state: single source of truth for flow_master and bn_only (FLOW_STATE_ARCHITECTURE).
Syncs to game_interface_data for UI. Tick entry only invokes flow libraries; flow libraries
call third-party libs and update state from return values (Approach 3).
"""
from share.game_interface_data import get_game_interface_data

_flow_master_enabled: bool = False
_bn_only_enabled: bool = False


def get_flow_master_enabled() -> bool:
    return _flow_master_enabled


def get_bn_only_enabled() -> bool:
    return _bn_only_enabled


def is_flow_active() -> bool:
    """True when the flow tick should run (flow_master or bn_only)."""
    return _flow_master_enabled or _bn_only_enabled


def set_flow_master_enabled(enabled: bool) -> None:
    global _flow_master_enabled
    if _flow_master_enabled != enabled:
        _flow_master_enabled = enabled
        get_game_interface_data().set_rosbot_flow_master_enabled(enabled)


def set_bn_only_enabled(enabled: bool) -> None:
    global _bn_only_enabled
    if _bn_only_enabled != enabled:
        _bn_only_enabled = enabled
        get_game_interface_data().set_ensure_battlenet_only_master_enabled(enabled)
