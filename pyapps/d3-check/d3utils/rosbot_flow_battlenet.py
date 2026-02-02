# -*- coding: utf-8 -*-
"""
Battle.net ready flow (tick-driven).
States match ROSBOT_FLOW_MERMAID.md: BN_Entry -> BN_Win -> BN_First/BN_Start -> ... -> BN_Confirmed.
Each tick: if current node is wait, return without transition; else execute one step and transition.
"""

import time
from enum import Enum
from typing import Optional, Tuple

from providor.common_imports import ColorPrint
from providor.app_constants import (
    BN_FLOW_WAIT_AFTER_START_SEC,
    BN_FLOW_WAIT_ELEMENT_MAX_TICKS,
    BN_FLOW_OAUTH_WAIT_SEC,
    BN_FLOW_EXIT_WAIT_SEC,
)
from d3utils.battlenet_manager import get_battlenet_manager, get_battlenet_window_titles
from d3utils.battlenet_operation import get_battlenet_operation
from share.oauth_callback import is_oauth_done, reset_oauth_done


class BNNode(str, Enum):
    """Battle.net ready flow nodes (ROSBOT_FLOW_MERMAID.md)."""
    BN_Entry = "BN_Entry"
    BN_Win = "BN_Win"
    BN_Start = "BN_Start"
    BN_Wait = "BN_Wait"
    BN_WaitResult = "BN_WaitResult"
    BN_UI = "BN_UI"
    BN_Login1 = "BN_Login1"
    BN_Login2 = "BN_Login2"
    BN_First = "BN_First"
    BN_Act = "BN_Act"
    BN_Poll = "BN_Poll"
    BN_Exit = "BN_Exit"
    BN_ExitWait = "BN_ExitWait"
    BN_Confirmed = "BN_Confirmed"


# Flow state (module-level; reset when flow master off)
_current_node: BNNode = BNNode.BN_Entry
_wait_until: float = 0.0
_wait_ticks: int = 0
_oauth_wait_until: float = 0.0
# When tick flow reaches BN_Confirmed, set this so ensure_battlenet_started_and_login_check skips BN part
_battlenet_tick_confirmed: bool = False


def set_battlenet_tick_confirmed() -> None:
    """Set when tick flow reaches BN_Confirmed; ensure_battlenet_started_and_login_check skips BN and runs D3 part."""
    global _battlenet_tick_confirmed
    _battlenet_tick_confirmed = True


def get_and_clear_battlenet_tick_confirmed() -> bool:
    """Return and clear tick-confirmed flag (called by ensure_battlenet_started_and_login_check)."""
    global _battlenet_tick_confirmed
    v = _battlenet_tick_confirmed
    _battlenet_tick_confirmed = False
    return v


def reset_battlenet_flow_state() -> None:
    """Reset flow to entry (e.g. when flow master turns off)."""
    global _current_node, _wait_until, _wait_ticks, _oauth_wait_until, _battlenet_tick_confirmed
    _current_node = BNNode.BN_Entry
    _wait_until = 0.0
    _wait_ticks = 0
    _oauth_wait_until = 0.0
    _battlenet_tick_confirmed = False


def get_battlenet_flow_node() -> BNNode:
    """Current node (for debug)."""
    return _current_node


def tick_battlenet_ready_flow() -> Tuple[bool, str]:
    """
    Run one step of Battle.net ready flow. Call every 2s tick when flow master on.
    Returns (done, result): done=True when flow exits (confirmed or not); result in ("confirmed", "exit", "wait").
    """
    global _current_node, _wait_until, _wait_ticks, _oauth_wait_until

    bn_path = get_battlenet_manager().get_path()
    if not bn_path:
        ColorPrint.yellow("[BNFlow] No battlenet path, skip")
        return True, "exit"

    op = get_battlenet_operation()
    now = time.monotonic()

    # ----- BN_Entry: always go to BN_Win -----
    if _current_node == BNNode.BN_Entry:
        _current_node = BNNode.BN_Win
        return False, ""

    # ----- BN_Win: has Battle.net window? -----
    if _current_node == BNNode.BN_Win:
        windows = get_battlenet_manager().find_windows(use_cache=False)
        if not windows:
            _current_node = BNNode.BN_Start
            return False, ""
        _current_node = BNNode.BN_First
        return False, ""

    # ----- BN_Start: start Battle.net then wait -----
    if _current_node == BNNode.BN_Start:
        ColorPrint.blue("[BNFlow] No window, starting Battle.net...")
        get_battlenet_manager().start(bn_path)
        _wait_until = now + BN_FLOW_WAIT_AFTER_START_SEC
        _current_node = BNNode.BN_Wait
        _wait_ticks = 0
        return False, ""

    # ----- BN_Wait: wait until exact element appears (or timeout) -----
    if _current_node == BNNode.BN_Wait:
        if now < _wait_until:
            return False, "wait"
        _wait_ticks += 1
        if _wait_ticks > BN_FLOW_WAIT_ELEMENT_MAX_TICKS:
            ColorPrint.yellow("[BNFlow] BN_Wait: element timeout (W8), exit and restart")
            _current_node = BNNode.BN_Exit
            return False, ""
        try:
            on_login, disconnected, normal_available = op.get_dynamic_state()
            if on_login or disconnected or normal_available:
                _current_node = BNNode.BN_WaitResult
                return False, ""
        except Exception:
            pass
        return False, "wait"

    # ----- BN_WaitResult: found element -> BN_UI -----
    if _current_node == BNNode.BN_WaitResult:
        _current_node = BNNode.BN_UI
        return False, ""

    # ----- BN_UI: current screen? login -> BN_Login1, main -> BN_Confirmed -----
    if _current_node == BNNode.BN_UI:
        on_login, disconnected, normal_available = op.get_dynamic_state()
        if normal_available:
            _current_node = BNNode.BN_Confirmed
            return True, "confirmed"
        if on_login:
            _current_node = BNNode.BN_Login1
            return False, ""
        if disconnected:
            _current_node = BNNode.BN_Exit
            return False, ""
        ColorPrint.yellow("[BNFlow] BN_UI: unknown state, exit and restart")
        _current_node = BNNode.BN_Exit
        return False, ""

    # ----- BN_Login1: step 1 agree + NetEase, then BN_Login2 -----
    if _current_node == BNNode.BN_Login1:
        op.activate_window()
        time.sleep(0.2)
        if not op.perform_cn_login_flow():
            ColorPrint.yellow("[BNFlow] CN login flow (agree+NetEase) failed")
            _current_node = BNNode.BN_Exit
            return False, ""
        reset_oauth_done()
        _oauth_wait_until = now + BN_FLOW_OAUTH_WAIT_SEC
        _current_node = BNNode.BN_Login2
        return False, ""

    # ----- BN_Login2: wait for oauth or timeout -----
    if _current_node == BNNode.BN_Login2:
        if is_oauth_done():
            _current_node = BNNode.BN_Confirmed
            return True, "confirmed"
        if now >= _oauth_wait_until:
            ColorPrint.yellow("[BNFlow] OAuth wait timeout (30s)")
            _current_node = BNNode.BN_Exit
            return False, ""
        return False, "wait"

    # ----- BN_First: first screen login or browser-wait? -> BN_Exit, else BN_Act -----
    if _current_node == BNNode.BN_First:
        if op.is_on_login_screen() or op.is_on_browser_login_wait_screen():
            ColorPrint.blue("[BNFlow] First screen is login or browser-wait, exit and restart")
            _current_node = BNNode.BN_Exit
            return False, ""
        _current_node = BNNode.BN_Act
        return False, ""

    # ----- BN_Act: activate window -> BN_Poll -----
    if _current_node == BNNode.BN_Act:
        get_battlenet_manager().activate_window()
        time.sleep(0.5)
        _current_node = BNNode.BN_Poll
        return False, ""

    # ----- BN_Poll: poll result -> BN_Confirmed or BN_Exit -----
    if _current_node == BNNode.BN_Poll:
        on_login, disconnected, normal_available = op.get_dynamic_state()
        if normal_available:
            ColorPrint.blue("[BNFlow] Battle.net confirmed logged in (UI)")
            _current_node = BNNode.BN_Confirmed
            return True, "confirmed"
        if disconnected:
            ColorPrint.blue("[BNFlow] Battle.net disconnected, exit and restart")
            _current_node = BNNode.BN_Exit
            return False, ""
        if on_login:
            _current_node = BNNode.BN_Login1
            return False, ""
        ColorPrint.yellow("[BNFlow] BN_Poll: unknown state (W15b/W15c), exit and restart")
        _current_node = BNNode.BN_Exit
        return False, ""

    # ----- BN_Exit: kill Battle.net -> BN_ExitWait (no blocking in task thread) -----
    if _current_node == BNNode.BN_Exit:
        ColorPrint.blue("[BNFlow] Exiting Battle.net, back to entry")
        get_battlenet_manager().kill()
        _wait_until = now + BN_FLOW_EXIT_WAIT_SEC
        _current_node = BNNode.BN_ExitWait
        return False, ""

    # ----- BN_ExitWait: wait until exit settle then BN_Entry -----
    if _current_node == BNNode.BN_ExitWait:
        if now < _wait_until:
            return False, "wait"
        _current_node = BNNode.BN_Entry
        return False, ""

    return False, ""
