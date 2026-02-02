# -*- coding: utf-8 -*-
"""
Battle.net ready flow (tick-driven).
States match ROSBOT_FLOW_MERMAID.md: BN_Entry -> BN_Win -> BN_First/BN_Start -> ... -> BN_Confirmed.
Each tick: if current node is wait, return without transition; else execute one step and transition.

首次启动首界面（B2 有窗口时当前界面，B4 判定）仅区分两种状态：
1. 登陆页：客户端内同意条款、网易账号登录页（UI 含「需要登陆」「您同意」「使用网易账号登录或注册」等）。
2. 等待浏览器返回页：弹窗「使用浏览器完成登录。/取消」。
B4「当前是否为登陆界面？」：上述两种任一为真 → 是 → B5 退出战网；否则 → 否 → B6 激活、轮询 UI（B13 每 tick 查控件树）。
"""

import time
from enum import Enum
from typing import Optional, Tuple

from pycore.pyfoundations.color_print import ColorPrint
from providor.app_constants import (
    BN_FLOW_WAIT_AFTER_START_SEC,
    BN_FLOW_POLL_TIMEOUT_SEC,
    BN_FLOW_OAUTH_WAIT_SEC,
    BN_FLOW_EXIT_WAIT_SEC,
)
from d3utils.battlenet_manager import get_battlenet_manager
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
_b7_poll_deadline: float = 0.0  # B7 poll phase: timeout at this time (2 min from first poll tick)
_oauth_wait_until: float = 0.0
# When tick flow reaches BN_Confirmed, set this so ensure_battlenet_started_and_login_check skips BN part
_battlenet_tick_confirmed: bool = False
# True once flow has returned (True, "confirmed") this run; gates D3 window detection until BN is OK
_bn_flow_ever_confirmed: bool = False


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
    global _current_node, _wait_until, _b7_poll_deadline, _oauth_wait_until, _battlenet_tick_confirmed, _bn_flow_ever_confirmed
    _current_node = BNNode.BN_Entry
    _wait_until = 0.0
    _b7_poll_deadline = 0.0
    _oauth_wait_until = 0.0
    _battlenet_tick_confirmed = False
    _bn_flow_ever_confirmed = False


def get_bn_flow_ever_confirmed() -> bool:
    """True once this run has reached BN_Confirmed; D3 window detection only after this."""
    return _bn_flow_ever_confirmed


def get_battlenet_flow_node() -> BNNode:
    """Current node (for debug)."""
    return _current_node


def tick_battlenet_ready_flow() -> Tuple[bool, str]:
    """
    Run one step of Battle.net ready flow. Call every 2s tick when flow master on.
    Returns (done, result): done=True when flow exits (confirmed or not); result in ("confirmed", "exit", "wait").
    """
    global _current_node, _wait_until, _b7_poll_deadline, _oauth_wait_until, _bn_flow_ever_confirmed

    bn_path = get_battlenet_manager().get_path()
    if not bn_path:
        ColorPrint.yellow("[BNFlow] No battlenet path, skip")
        return True, "exit"

    op = get_battlenet_operation()
    now = time.monotonic()

    def _save_ui_snapshot(node: str, reason: str) -> None:
        try:
            op.save_ui_elements_snapshot(node, reason)
        except Exception:
            pass

    # ----- [B1] BN_Entry -----
    if _current_node == BNNode.BN_Entry:
        ColorPrint.blue("[BNFlow] flow B1→B2 | reason: entry, check Battle.net window")
        _current_node = BNNode.BN_Win
        return False, ""

    # ----- [B2] BN_Win -----
    if _current_node == BNNode.BN_Win:
        windows = get_battlenet_manager().find_windows(use_cache=False)
        if not windows:
            ColorPrint.blue("[BNFlow] flow B2→B3 | reason: no window, start Battle.net")
            _current_node = BNNode.BN_Start
            return False, ""
        _save_ui_snapshot("B2", "B2_has_window")
        ColorPrint.blue("[BNFlow] flow B2→B4 | reason: has window, check if current is login page (flowchart B4)")
        _current_node = BNNode.BN_First
        return False, ""

    # ----- [B3] BN_Start -----
    if _current_node == BNNode.BN_Start:
        ColorPrint.blue("[BNFlow] flow B3→B7 | reason: started Battle.net, wait %ss then poll elements" % int(BN_FLOW_WAIT_AFTER_START_SEC))
        get_battlenet_manager().start(bn_path)
        _wait_until = now + BN_FLOW_WAIT_AFTER_START_SEC
        _b7_poll_deadline = 0.0
        _current_node = BNNode.BN_Wait
        return False, ""

    # ----- [B7] BN_Wait -----
    if _current_node == BNNode.BN_Wait:
        if now < _wait_until:
            ColorPrint.gray("[BNFlow] flow B7 skip this tick | reason: wait deadline not reached, wait")
            return False, "wait"
        if _b7_poll_deadline == 0.0:
            _b7_poll_deadline = now + BN_FLOW_POLL_TIMEOUT_SEC
        if now >= _b7_poll_deadline:
            ColorPrint.yellow("[BNFlow] flow B7→B5 | reason: [B8] timeout no elements found (%ds = 2 min), exit and restart" % int(BN_FLOW_POLL_TIMEOUT_SEC))
            _current_node = BNNode.BN_Exit
            _b7_poll_deadline = 0.0
            return False, ""
        _save_ui_snapshot("B7", "B7_poll_elements")
        try:
            on_login, disconnected, normal_available = op.get_dynamic_state()
            elem_ready = normal_available or disconnected or (on_login and op.is_login_screen_ready())
            if elem_ready:
                if op.is_login_failed_screen():
                    ColorPrint.yellow("[BNFlow] flow B7→B5 | reason: login failed (Continue Offline/Cancel), exit Battle.net and back to B1")
                    _current_node = BNNode.BN_Exit
                    return False, ""
                ColorPrint.blue("[BNFlow] flow B7→B8→B9 | reason: operable UI found (main/disconnected/login-ready), first screen B9")
                _current_node = BNNode.BN_WaitResult
                _b7_poll_deadline = 0.0
                return False, ""
        except Exception as e:
            ColorPrint.gray("[BNFlow] flow B7 skip this tick | reason: get_dynamic_state error: %s" % e)
        ColorPrint.gray("[BNFlow] flow B7 skip this tick | reason: no operable elements yet (may still be loading), wait")
        return False, "wait"

    # ----- [B8] BN_WaitResult -----
    if _current_node == BNNode.BN_WaitResult:
        _save_ui_snapshot("B8", "B8_to_B9")
        ColorPrint.blue("[BNFlow] flow B8→B9 | reason: elements found, enter first screen B9")
        _current_node = BNNode.BN_UI
        return False, ""

    # ----- [B9] BN_UI first screen -----
    if _current_node == BNNode.BN_UI:
        _save_ui_snapshot("B9", "B9_first_screen")
        if op.is_login_failed_screen():
            ColorPrint.yellow("[BNFlow] flow B9→B5 | reason: login failed (Continue Offline/Cancel), exit Battle.net and back to B1")
            _current_node = BNNode.BN_Exit
            return False, ""
        ColorPrint.blue("[BNFlow] flow B9 first screen | reason: decide current UI (login/main/disconnected/other)")
        on_login, disconnected, normal_available = op.get_dynamic_state()
        if normal_available:
            ColorPrint.green("[BNFlow] flow B9→B12 continue | reason: main/logged-in (D3 tab+Play visible), confirmed")
            _current_node = BNNode.BN_Confirmed
            _bn_flow_ever_confirmed = True
            return True, "confirmed"
        if on_login:
            ColorPrint.blue("[BNFlow] flow B9→B10 | reason: login screen, step1 agree and confirm")
            _current_node = BNNode.BN_Login1
            return False, ""
        if disconnected:
            ColorPrint.blue("[BNFlow] flow B9→B5 | reason: disconnected, exit and restart")
            _current_node = BNNode.BN_Exit
            return False, ""
        ColorPrint.yellow("[BNFlow] flow B9→B5 | reason: unknown state, exit and restart")
        _current_node = BNNode.BN_Exit
        return False, ""

    # ----- [B10] BN_Login1 -----
    if _current_node == BNNode.BN_Login1:
        _save_ui_snapshot("B10", "B10_agree_netease")
        ColorPrint.blue("[BNFlow] flow B10 run | reason: step1 agree+NetEase; either way go B11 wait OAuth (timeout %ds = 2 min)" % int(BN_FLOW_OAUTH_WAIT_SEC))
        op.activate_window()
        time.sleep(0.2)
        if not op.perform_cn_login_flow():
            ColorPrint.yellow("[BNFlow] flow B10→B11 | reason: agree/NetEase failed, still go B11 wait OAuth return")
        else:
            ColorPrint.blue("[BNFlow] flow B10→B11 | reason: agree/NetEase done, wait OAuth return (timeout %ds = 2 min)" % int(BN_FLOW_OAUTH_WAIT_SEC))
        reset_oauth_done()
        _oauth_wait_until = now + BN_FLOW_OAUTH_WAIT_SEC
        _current_node = BNNode.BN_Login2
        return False, ""

    # ----- [B11] BN_Login2 -----
    if _current_node == BNNode.BN_Login2:
        _save_ui_snapshot("B11", "B11_wait_oauth")
        if op.is_login_failed_screen():
            ColorPrint.yellow("[BNFlow] flow B11→B5 | reason: login failed (Continue Offline/Cancel), exit Battle.net and back to B1")
            _current_node = BNNode.BN_Exit
            return False, ""
        if is_oauth_done():
            ColorPrint.green("[BNFlow] flow B11→B12 continue | reason: OAuth returned, confirmed")
            _current_node = BNNode.BN_Confirmed
            _bn_flow_ever_confirmed = True
            return True, "confirmed"
        if now >= _oauth_wait_until:
            ColorPrint.yellow("[BNFlow] flow B11→B5 | reason: OAuth timeout %ds (2 min) reached, exit and restart" % int(BN_FLOW_OAUTH_WAIT_SEC))
            _current_node = BNNode.BN_Exit
            return False, ""
        ColorPrint.gray("[BNFlow] flow B11 skip this tick | reason: waiting OAuth return, wait")
        return False, "wait"

    # ----- [B4] BN_First: 首次启动首界面两种状态（登陆页 / 等待浏览器返回页），是→B5 否→B6 -----
    if _current_node == BNNode.BN_First:
        _save_ui_snapshot("B4", "B4_first_check")
        if op.is_login_failed_screen():
            ColorPrint.yellow("[BNFlow] flow B4→B5 | reason: login failed (Continue Offline/Cancel), exit Battle.net and back to B1")
            _current_node = BNNode.BN_Exit
            return False, ""
        if op.is_on_browser_login_wait_screen():
            ColorPrint.blue("[BNFlow] flow B4→B5 | reason: browser login wait popup, exit Battle.net (flowchart)")
            _current_node = BNNode.BN_Exit
            return False, ""
        if op.is_on_login_screen():
            ColorPrint.blue("[BNFlow] flow B4→B5 | reason: current is login page (flowchart: 是→退出战网), exit then B1→B3→B7→B9→B10")
            _current_node = BNNode.BN_Exit
            return False, ""
        ColorPrint.blue("[BNFlow] flow B4→B6 | reason: current not login page (flowchart: 否→激活、轮询 UI)")
        _current_node = BNNode.BN_Act
        return False, ""

    # ----- [B6] BN_Act -----
    if _current_node == BNNode.BN_Act:
        _save_ui_snapshot("B6", "B6_to_B13")
        ColorPrint.blue("[BNFlow] flow B6→B13 | reason: window activated, enter B13 poll state")
        get_battlenet_manager().activate_window()
        time.sleep(0.5)
        _current_node = BNNode.BN_Poll
        return False, ""

    # ----- [B13] BN_Poll -----
    if _current_node == BNNode.BN_Poll:
        _save_ui_snapshot("B13", "B13_poll")
        if op.is_login_failed_screen():
            ColorPrint.yellow("[BNFlow] flow B13→B5 | reason: login failed (Continue Offline/Cancel), exit Battle.net and back to B1")
            _current_node = BNNode.BN_Exit
            return False, ""
        on_login, disconnected, normal_available = op.get_dynamic_state()
        if normal_available:
            ColorPrint.green("[BNFlow] flow B13→B16 continue | reason: [B14] poll logged-in (D3 tab+Play visible), confirmed")
            _current_node = BNNode.BN_Confirmed
            _bn_flow_ever_confirmed = True
            return True, "confirmed"
        if disconnected:
            ColorPrint.blue("[BNFlow] flow B13→B5 | reason: [B15a] disconnected, exit and restart")
            _current_node = BNNode.BN_Exit
            return False, ""
        if on_login:
            ColorPrint.blue("[BNFlow] flow B13→B10 | reason: poll result login screen, go B10/B11")
            _current_node = BNNode.BN_Login1
            return False, ""
        ColorPrint.yellow("[BNFlow] flow B13→B5 | reason: [B15b/B15c] timeout no elements or unknown state, exit and restart")
        _current_node = BNNode.BN_Exit
        return False, ""

    # ----- [B5] BN_Exit -----
    if _current_node == BNNode.BN_Exit:
        _save_ui_snapshot("B5", "B5_exit")
        ColorPrint.blue("[BNFlow] flow B5→B5w | reason: kill Battle.net, wait %ss then back to B1" % int(BN_FLOW_EXIT_WAIT_SEC))
        get_battlenet_manager().kill()
        _wait_until = now + BN_FLOW_EXIT_WAIT_SEC
        _current_node = BNNode.BN_ExitWait
        return False, ""

    # ----- [B5w] BN_ExitWait -----
    if _current_node == BNNode.BN_ExitWait:
        if now < _wait_until:
            ColorPrint.gray("[BNFlow] flow B5w skip this tick | reason: waiting Battle.net exit (%ss), wait" % int(BN_FLOW_EXIT_WAIT_SEC))
            return False, "wait"
        ColorPrint.blue("[BNFlow] flow B5w→B1 | reason: Battle.net exited, back to entry B1")
        _current_node = BNNode.BN_Entry
        return False, ""

    return False, ""
