# -*- coding: utf-8 -*-
"""
Battle.net ready flow (tick-driven).
States match ROSBOT_FLOW_MERMAID.md: BN_Entry -> BN_Win -> BN_First/BN_Start -> ... -> BN_Confirmed.
Each tick: if current node is wait, return without transition; else execute one step and transition.

First-launch UI (when B2 has window, B4 decision): two states only.
1. Login page: in-client agreement + NetEase login (UI contains "need login", "you agree", "NetEase login or register", etc.).
2. Browser-wait page: popup "Complete login in browser / Cancel".
B4 "Is current the login UI?": either true -> yes -> B5 exit Battle.net; else -> no -> B6 activate, poll UI (B13 each tick inspects control tree).
"""

import time
from enum import Enum
from typing import Optional, Tuple

from pycore.pyfoundations.color_print import ColorPrint
from providor.constants.common import (
    BN_FLOW_WAIT_AFTER_START_SEC,
    BN_FLOW_POLL_TIMEOUT_SEC,
    BN_FLOW_OAUTH_WAIT_SEC,
    BN_FLOW_EXIT_WAIT_SEC,
    BROWSER_LOGIN_FALLBACK_TIMEOUT_SEC,
)
from share.game_interface_data import get_game_interface_data, set_request_d_block_from_b7
from share.asia_credentials import (
    get_asia_credentials,
    is_asia_credentials_dialog_pending,
    schedule_asia_credentials_dialog,
)
from share.oauth_callback import reset_oauth_done, notify_oauth_done
from d3utils.tick_driver import get_flow_tick_from_global
from d3utils.browser_login_ocr_flow import run_one_poll
from d3utils.battlenet_manager import get_battlenet_manager
from d3utils.battlenet_operation import get_battlenet_operation
from d3utils.rosbot_flow_state import get_bn_only_enabled
from d3utils.event_center import trigger_extension_rosbot_start
from d3utils.shutdown_manager import register_shutdown_hook
from d3utils.rosbot_flow.flow_bn_block_state import (
    BNNode,
    B7_TRIGGER_D_AFTER_SKIPS,
    B7_TRIGGER_D_COOLDOWN_SEC,
    get_bn_block_ctx,
    get_current_step,
    reset_bn_block_state,
    is_bn_flow_in_login_phase as _is_bn_flow_in_login_phase,
    get_and_clear_battlenet_tick_confirmed as _get_and_clear_battlenet_tick_confirmed,
)

# B11 browser OCR wait: timeout by flow tick (1 tick = 2s), not wall-clock
B11_TICK_INTERVAL_SEC = 2.0
B11_MAX_TICKS = max(1, int(BROWSER_LOGIN_FALLBACK_TIMEOUT_SEC / B11_TICK_INTERVAL_SEC))

# Nodes that require wall-clock or tick wait; when we transition to these, return so next tick runs them. Otherwise continue same tick.
_WAIT_NODES = frozenset({BNNode.BN_Wait, BNNode.BN_Login2, BNNode.BN_ExitWait})


def _get_bn_preferred_region() -> Optional[str]:
    """Return cached Battle.net region (asia/cn) for get_dynamic_state."""
    return get_game_interface_data().get_battlenet_region()


def reset_flow_master_bn_block() -> None:
    """Reset Flow-master's BN block to entry (e.g. when flow master turns off)."""
    reset_bn_block_state(False)


def reset_battlenet_flow_state() -> None:
    """Deprecated alias for reset_flow_master_bn_block. Use reset_flow_master_bn_block."""
    reset_flow_master_bn_block()


def get_battlenet_flow_node(for_bn_only: bool = False) -> BNNode:
    """Current node (for debug). for_bn_only True=BN-only flow, False=Flow-master flow."""
    return get_current_step(for_bn_only)


def is_bn_flow_in_login_phase() -> bool:
    """True if either flow is on a login screen (for callers that do not care which flow)."""
    return _is_bn_flow_in_login_phase(True) or _is_bn_flow_in_login_phase(False)


def get_and_clear_battlenet_tick_confirmed() -> bool:
    """Clear both flows' tick-confirmed and return True if either was set."""
    return _get_and_clear_battlenet_tick_confirmed(True) or _get_and_clear_battlenet_tick_confirmed(False)


def tick_battlenet_ready_flow(no_activate: bool = False) -> Tuple[bool, str]:
    """
    Run Battle.net ready flow. Call every 2s tick when flow master on.
    When UI is operable, runs multiple steps in the same tick (e.g. B9→B10→agree+NetEase+browser OCR)
    without waiting for the next tick; only returns when a wait node (BN_Wait, BN_Login2, BN_ExitWait) or done.
    no_activate: when True (ensure_battlenet_only mode), do not activate window; UI detection only.
    Returns (done, result): done=True when flow exits; result in ("confirmed", "exit", "wait").
    Each flow uses its own BN block state (two flows can run at the same time).
    """
    for_bn_only = no_activate
    ctx = get_bn_block_ctx(for_bn_only)
    if no_activate and not get_bn_only_enabled():
        ColorPrint.gray("[BNFlow] flow aborted | reason: Ensure Battle.net only disabled this tick")
        reset_bn_block_state(True)
        return True, "exit"
    bn_path = get_battlenet_manager().get_path()
    if not bn_path:
        ColorPrint.yellow("[BNFlow] No battlenet path, skip")
        return True, "exit"

    op = get_battlenet_operation()
    now = time.monotonic()

    def _save_ui_snapshot(node: str, reason: str) -> None:
        op.save_ui_elements_snapshot(node, reason)

    while True:
        ColorPrint.gray(f"[BNFlow] progress: tick_battlenet_ready_flow node={ctx.get_current_step().value}")
        # ----- [B1] BN_Entry -> B2_HasWin
        if ctx.get_current_step() == BNNode.BN_Entry:
            ColorPrint.blue("[BNFlow] flow B1→B2 | reason: entry (F1 No->B2 per diagram), check Battle.net window this tick")
            ctx.set_current_step(BNNode.BN_Win)
            continue

        # ----- [B2] BN_Win -----
        if ctx.get_current_step() == BNNode.BN_Win:
            # Use same-tick refresh result to avoid redundant find_windows (one read per tick)
            has_window = get_game_interface_data().battlenet_window_found
            if not has_window:
                ColorPrint.blue("[BNFlow] flow B2→B3 | reason: no window, start Battle.net")
                ctx.set_current_step(BNNode.BN_Start)
                continue
            ColorPrint.gray("[BNFlow] progress: B2 has window (from refresh)")
            _save_ui_snapshot("B2", "B2_has_window")
            ColorPrint.blue("[BNFlow] flow B2→B4 | reason: has window, check if current is login page (flowchart B4)")
            ctx.set_current_step(BNNode.BN_First)
            continue

        # ----- [B3] BN_Start -----
        if ctx.get_current_step() == BNNode.BN_Start:
            ColorPrint.blue("[BNFlow] flow B3→B7 | reason: started Battle.net, wait %ss then poll elements" % int(BN_FLOW_WAIT_AFTER_START_SEC))
            get_battlenet_manager().start(bn_path)
            ctx.set_wait_until(now + BN_FLOW_WAIT_AFTER_START_SEC)
            ctx.set_b7_poll_deadline(0.0)
            ctx.set_b7_skip_count(0)
            ctx.set_current_step(BNNode.BN_Wait)
            return False, ""

        # ----- [B7] BN_Wait -----
        if ctx.get_current_step() == BNNode.BN_Wait:
            if now < ctx.get_wait_until():
                ColorPrint.gray("[BNFlow] flow B7 skip this tick | reason: wait deadline not reached, wait")
                return False, "wait"
            if ctx.get_b7_poll_deadline() == 0.0:
                ctx.set_b7_poll_deadline(now + BN_FLOW_POLL_TIMEOUT_SEC)
            if now >= ctx.get_b7_poll_deadline():
                ColorPrint.yellow("[BNFlow] flow B7→B5 | reason: [B8] timeout no elements found (%ds = 2 min), exit and restart" % int(BN_FLOW_POLL_TIMEOUT_SEC))
                ctx.set_b5_entry_reason("B7_timeout_no_elements")
                ctx.set_current_step(BNNode.BN_Exit)
                ctx.set_b7_poll_deadline(0.0)
                ctx.set_b7_skip_count(0)
                continue
            _save_ui_snapshot("B7", "B7_poll_elements")
            ColorPrint.gray("[BNFlow] progress: B7 get_dynamic_state...")
            on_login, disconnected, normal_available, *_ = op.get_dynamic_state()
            elem_ready = normal_available or disconnected or (on_login and (op.is_login_screen_ready() or op.is_on_asia_login_screen()))
            if elem_ready:
                ctx.set_b7_skip_count(0)
                if op.is_login_failed_screen():
                    ColorPrint.yellow("[BNFlow] flow B7→B5 | reason: login failed (Continue Offline/Cancel), exit Battle.net and back to B1")
                    ctx.set_b5_entry_reason("B7_login_failed")
                    ctx.set_current_step(BNNode.BN_Exit)
                    continue
                ColorPrint.blue("[BNFlow] flow B7→B8→B9 | reason: operable UI found (main/disconnected/login-ready), first screen B9")
                ctx.set_current_step(BNNode.BN_WaitResult)
                ctx.set_b7_poll_deadline(0.0)
                continue
            if op.try_close_popup():
                ColorPrint.gray("[BNFlow] flow B7 skip this tick | reason: closed popup, wait next tick")
                return False, "wait"
            ctx.set_b7_skip_count(ctx.get_b7_skip_count() + 1)
            if ctx.get_b7_skip_count() >= B7_TRIGGER_D_AFTER_SKIPS and (now - ctx.get_b7_last_trigger_time()) >= B7_TRIGGER_D_COOLDOWN_SEC:
                ColorPrint.blue("[BNFlow] flow B7: no operable elements for %d ticks -> trigger D block (D3 tab, Play, region)" % ctx.get_b7_skip_count())
                set_request_d_block_from_b7()
                trigger_extension_rosbot_start()
                ctx.set_b7_skip_count(0)
                ctx.set_b7_last_trigger_time(now)
            ColorPrint.gray("[BNFlow] flow B7 skip this tick | reason: no operable elements yet (may still be loading), wait")
            return False, "wait"

        # ----- [B8] BN_WaitResult -----
        if ctx.get_current_step() == BNNode.BN_WaitResult:
            _save_ui_snapshot("B8", "B8_to_B9")
            ColorPrint.blue("[BNFlow] flow B8→B9 | reason: elements found, enter first screen B9")
            ctx.set_current_step(BNNode.BN_UI)
            continue

        # ----- [B9] BN_UI first screen -----
        if ctx.get_current_step() == BNNode.BN_UI:
            if not get_game_interface_data().battlenet_window_found:
                ColorPrint.blue("[BNFlow] flow B9→B2 | reason: no window this tick, re-check (avoid unknown→B5)")
                ctx.set_current_step(BNNode.BN_Win)
                continue
            _save_ui_snapshot("B9", "B9_first_screen")
            if op.is_login_failed_screen():
                ColorPrint.yellow("[BNFlow] flow B9→B5 | reason: login failed (Continue Offline/Cancel), exit Battle.net and back to B1")
                ctx.set_b5_entry_reason("B9_login_failed")
                ctx.set_current_step(BNNode.BN_Exit)
                continue
            ColorPrint.blue("[BNFlow] flow B9 first screen | reason: decide current UI (login/main/disconnected/other)")
            ColorPrint.gray("[BNFlow] progress: B9 get_dynamic_state...")
            on_login, disconnected, normal_available, play_button_name, connecting, *_ = op.get_dynamic_state()
            if connecting:
                ColorPrint.gray("[BNFlow] connecting, keep wait")
                return False, "wait"
            if normal_available:
                _play_label = "Playing" if (play_button_name and ("Playing" in (play_button_name or "") or "\u6b63\u5728" in (play_button_name or ""))) else "Play"
                ColorPrint.green("[BNFlow] flow B9→B12 continue | reason: main/logged-in (D3 tab+%s visible), confirmed" % _play_label)
                ctx.set_current_step(BNNode.BN_Confirmed)
                ctx.set_bn_flow_ever_confirmed(True)
                return True, "confirmed"
            if on_login:
                if op.is_on_browser_login_wait_screen():
                    ColorPrint.blue("[BNFlow] flow B9→B5 | reason: browser login wait popup, exit Battle.net (flowchart)")
                    ctx.set_b5_entry_reason("B9_browser_login_wait")
                    ctx.set_current_step(BNNode.BN_Exit)
                    continue
                region = _get_bn_preferred_region()
                if region == "asia":
                    ColorPrint.blue("[BNFlow] flow B9→BN_LoginAsia | reason: region Asia, run Asia login")
                    ctx.set_current_step(BNNode.BN_LoginAsia)
                else:
                    ColorPrint.blue("[BNFlow] flow B9→B10 | reason: login screen (CN), step1 agree and confirm")
                    ctx.set_current_step(BNNode.BN_Login1)
                continue
            if disconnected:
                ColorPrint.blue("[BNFlow] flow B9→B5 | reason: disconnected, exit and restart")
                ctx.set_b5_entry_reason("B9_disconnected")
                ctx.set_current_step(BNNode.BN_Exit)
                continue
            # [B9 other/unknown] Consistent with doc B13 other->B15c->B6: unknown state do not kill Battle.net, B6 first then activate poll
            ColorPrint.blue("[BNFlow] flow B9→B6 | reason: unknown state (flowchart B15c→B6), re-activate and poll")
            ctx.set_current_step(BNNode.BN_Act)
            continue

        # ----- [B10] BN_Login1 -----
        # Agree + NetEase click immediately (no wait for next tick); then same-tick try browser OCR once.
        if ctx.get_current_step() == BNNode.BN_Login1:
            _save_ui_snapshot("B10", "B10_agree_netease")
            ColorPrint.blue("[BNFlow] flow B10 run | reason: step1 agree+NetEase immediately, then B11 browser OCR")
            if not no_activate:
                op.activate_window()
                time.sleep(0.2)
            if not op.perform_cn_login_flow(wait_after_netease_sec=0):
                ColorPrint.yellow("[BNFlow] flow B10→B11 | reason: agree/NetEase failed, still go B11 wait OAuth return")
            else:
                ColorPrint.blue("[BNFlow] flow B10→B11 | reason: agree/NetEase done, same-tick try browser OCR")
            reset_oauth_done()
            ctx.set_oauth_wait_until(now + BN_FLOW_OAUTH_WAIT_SEC)
            ctx.set_browser_fallback_deadline(0.0)
            ctx.set_b11_deadline_tick(0)
            current_tick = get_flow_tick_from_global()
            ctx.set_b11_deadline_tick(current_tick + B11_MAX_TICKS)
            status = run_one_poll(float("inf"), notify_oauth_done=notify_oauth_done)
            if status == "success":
                ColorPrint.green("[BNFlow] flow B10→B12 same-tick | reason: browser OCR success right after agree")
                ctx.set_b11_deadline_tick(0)
                ctx.set_current_step(BNNode.BN_Confirmed)
                ctx.set_bn_flow_ever_confirmed(True)
                return True, "confirmed"
            ctx.set_current_step(BNNode.BN_Login2)
            return False, ""

            # ----- [B11] BN_Login2 -----
        # No Tampermonkey: find browser -> center region -> OCR login/agree buttons -> wait until success or tick-based timeout.
        if ctx.get_current_step() == BNNode.BN_Login2:
            _save_ui_snapshot("B11", "B11_browser_ocr")
            if op.is_login_failed_screen():
                ColorPrint.yellow("[BNFlow] flow B11→B5 | reason: login failed (Continue Offline/Cancel), exit Battle.net and back to B1")
                ctx.set_b5_entry_reason("B11_login_failed")
                ctx.set_current_step(BNNode.BN_Exit)
                continue
            current_tick = get_flow_tick_from_global()
            if ctx.get_b11_deadline_tick() == 0:
                ctx.set_b11_deadline_tick(current_tick + B11_MAX_TICKS)
                ColorPrint.blue("[BNFlow] flow B11 | find browser, OCR center region, click (timeout %d ticks = %ds)" % (B11_MAX_TICKS, int(BROWSER_LOGIN_FALLBACK_TIMEOUT_SEC)))
            if current_tick >= ctx.get_b11_deadline_tick():
                ColorPrint.yellow("[BNFlow] flow B11→B5 | reason: browser OCR timeout (%d ticks), exit and restart" % B11_MAX_TICKS)
                ctx.set_b5_entry_reason("B11_browser_fallback_timeout")
                ctx.set_b11_deadline_tick(0)
                ctx.set_current_step(BNNode.BN_Exit)
                continue
            status = run_one_poll(float("inf"), notify_oauth_done=notify_oauth_done)  # timeout decided by tick above, not by run_one_poll
            if status == "success":
                ColorPrint.green("[BNFlow] flow B11→B12 continue | reason: browser OCR success, confirmed")
                ctx.set_b11_deadline_tick(0)
                ctx.set_current_step(BNNode.BN_Confirmed)
                ctx.set_bn_flow_ever_confirmed(True)
                return True, "confirmed"
            ColorPrint.gray("[BNFlow] flow B11 skip this tick | reason: browser OCR polling (find browser, OCR center, click), wait")
            return False, "wait"

            # ----- [BN_LoginAsia] Asia login -----
        if ctx.get_current_step() == BNNode.BN_LoginAsia:
            if is_asia_credentials_dialog_pending():
                ColorPrint.gray("[BNFlow] flow BN_LoginAsia skip | reason: credentials dialog open, skip tick until closed")
                return False, "wait"
            creds = get_asia_credentials()
            if creds is None:
                schedule_asia_credentials_dialog()
                ColorPrint.gray("[BNFlow] flow BN_LoginAsia skip | reason: no cached credentials, dialog scheduled once")
                return False, "wait"
            _save_ui_snapshot("BN_LoginAsia", "asia_login")
            email, password = creds
            if not no_activate:
                op.activate_window()
                time.sleep(0.2)
            if op.is_on_asia_login_screen():
                ok = op.perform_asia_login_fill_and_submit(email, password)
                if ok:
                    ColorPrint.blue("[BNFlow] flow BN_LoginAsia | reason: fill whatever present + submit done, re-poll UI")
            ctx.set_current_step(BNNode.BN_UI)
            continue

            # ----- [B4] BN_First -----
        if ctx.get_current_step() == BNNode.BN_First:
            _save_ui_snapshot("B4", "B4_first_check")
            if op.is_login_failed_screen():
                ColorPrint.yellow("[BNFlow] flow B4→B5 | reason: login failed (Continue Offline/Cancel), exit Battle.net and back to B1")
                ctx.set_b5_entry_reason("B4_login_failed")
                ctx.set_current_step(BNNode.BN_Exit)
                continue
            if op.is_on_browser_login_wait_screen():
                ColorPrint.blue("[BNFlow] flow B4→B5 | reason: browser login wait popup, exit Battle.net (flowchart)")
                ctx.set_b5_entry_reason("B4_browser_login_wait")
                ctx.set_current_step(BNNode.BN_Exit)
                continue
            # Use same-tick refresh result for login page (no extra UI enum)
            is_login = get_game_interface_data().battlenet_on_login_screen
            if is_login:
                ColorPrint.blue("[BNFlow] flow B4→B5 | reason: current is login page (CN/Asia), exit then B1→B3→B7→B9→B10/BN_LoginAsia")
                ctx.set_b5_entry_reason("B4_login_page_CN_Asia")
                ctx.set_current_step(BNNode.BN_Exit)
                continue
            ColorPrint.blue("[BNFlow] flow B4→B6 | reason: current not login page (flowchart: no->activate, poll UI)")
            ctx.set_current_step(BNNode.BN_Act)
            continue

            # ----- [B6] BN_Act -----
        if ctx.get_current_step() == BNNode.BN_Act:
            _save_ui_snapshot("B6", "B6_to_WaitPlay_or_B13")
            if not no_activate:
                get_battlenet_manager().activate_window()
                if op.click_d3_tab():
                    ColorPrint.blue("[BNFlow] flow B6→BN_WaitPlay | reason: clicked D3 tab, wait Play only (skip full UI traverse)")
                    ctx.set_b13_poll_deadline(now + 8.0)
                    ctx.set_current_step(BNNode.BN_WaitPlay)
                    continue
                ColorPrint.blue("[BNFlow] flow B6→B13 | reason: D3 tab not found or already selected, enter B13 poll")
            else:
                ColorPrint.blue("[BNFlow] flow B6→B13 | reason: UI poll only (no activate), enter B13 poll state")
            ctx.set_current_step(BNNode.BN_Poll)
            continue

            # ----- [BN_WaitPlay] after tab click: only poll Play then click, no full get_dynamic_state -----
        if ctx.get_current_step() == BNNode.BN_WaitPlay:
            if op.click_play_button_if_visible(force_refresh=True):
                ColorPrint.green("[BNFlow] flow BN_WaitPlay→BN_Confirmed | reason: Play visible, clicked (skip full traverse)")
                ctx.set_current_step(BNNode.BN_Confirmed)
                ctx.set_bn_flow_ever_confirmed(True)
                return True, "confirmed"
            if now >= ctx.get_b13_poll_deadline():
                ColorPrint.blue("[BNFlow] flow BN_WaitPlay→B13 | reason: wait Play timeout, full poll")
                ctx.set_b13_poll_deadline(now + BN_FLOW_POLL_TIMEOUT_SEC)
                ctx.set_current_step(BNNode.BN_Poll)
                continue
            return False, "wait"

            # ----- [B13] BN_Poll -----
        if ctx.get_current_step() == BNNode.BN_Poll:
            if ctx.get_b13_poll_deadline() == 0.0:
                ctx.set_b13_poll_deadline(now + BN_FLOW_POLL_TIMEOUT_SEC)
            _save_ui_snapshot("B13", "B13_poll")
            if op.is_login_failed_screen():
                ColorPrint.yellow("[BNFlow] flow B13→B5 | reason: login failed (Continue Offline/Cancel), exit Battle.net and back to B1")
                ctx.set_b5_entry_reason("B13_login_failed")
                ctx.set_current_step(BNNode.BN_Exit)
                continue
            on_login, disconnected, normal_available, play_button_name, connecting, *_ = op.get_dynamic_state()
            if connecting:
                ColorPrint.gray("[BNFlow] connecting, keep wait")
                return False, "wait"
            if normal_available:
                _play_label = "Playing" if (play_button_name and ("Playing" in (play_button_name or "") or "\u6b63\u5728" in (play_button_name or ""))) else "Play"
                ColorPrint.green("[BNFlow] flow B13→B16 continue | reason: [B14] poll logged-in (D3 tab+%s visible), confirmed" % _play_label)
                ctx.set_current_step(BNNode.BN_Confirmed)
                ctx.set_bn_flow_ever_confirmed(True)
                return True, "confirmed"
            if disconnected:
                ColorPrint.blue("[BNFlow] flow B13→B5 | reason: [B15a] disconnected, exit and restart")
                ctx.set_b5_entry_reason("B13_disconnected")
                ctx.set_current_step(BNNode.BN_Exit)
                continue
            if op.is_on_browser_login_wait_screen():
                ColorPrint.blue("[BNFlow] flow B13→B5 | reason: browser login wait popup, exit Battle.net (flowchart)")
                ctx.set_b5_entry_reason("B13_browser_login_wait")
                ctx.set_current_step(BNNode.BN_Exit)
                continue
            if on_login:
                region = _get_bn_preferred_region()
                if region == "asia":
                    ColorPrint.blue("[BNFlow] flow B13→BN_LoginAsia | reason: region Asia, go Asia login")
                    ctx.set_current_step(BNNode.BN_LoginAsia)
                else:
                    ColorPrint.blue("[BNFlow] flow B13→B10 | reason: poll result login screen (CN), go B10/B11")
                    ctx.set_current_step(BNNode.BN_Login1)
                continue
            if now >= ctx.get_b13_poll_deadline():
                ColorPrint.yellow("[BNFlow] flow B13→B5 | reason: [B15b] timeout no elements (%ds), exit and restart" % int(BN_FLOW_POLL_TIMEOUT_SEC))
                ctx.set_b13_poll_deadline(0.0)
                ctx.set_b5_entry_reason("B13_timeout_no_elements")
                ctx.set_current_step(BNNode.BN_Exit)
                continue
            # [B15c] Unknown state: D3 tab may be present but Play not in tree (e.g. Asia main web view). Click D3 tab then re-activate.
            if not no_activate and op.click_d3_tab():
                ColorPrint.blue("[BNFlow] flow B13→B6 | reason: [B15c] unknown state, clicked D3 tab (Asia/CN), re-activate and poll")
            else:
                ColorPrint.blue("[BNFlow] flow B13→B6 | reason: [B15c] unknown state, re-activate and poll (flowchart B15c→B6)")
            ctx.set_b13_poll_deadline(0.0)
            ctx.set_current_step(BNNode.BN_Act)
            continue

            # ----- [BN_Confirmed] Main UI: close in-UI floating popup (ad) if present; stay confirmed or re-detect -----
        if ctx.get_current_step() == BNNode.BN_Confirmed:
            if not get_game_interface_data().battlenet_window_found:
                ctx.set_current_step(BNNode.BN_Win)
                continue
            if op.try_close_popup():
                ColorPrint.gray("[BNFlow] flow BN_Confirmed: closed in-UI popup (floating ad), wait next tick")
                return False, "wait"
            on_login, disconnected, normal_available, play_button_name, connecting, *_ = op.get_dynamic_state()
            if connecting:
                return False, "wait"
            if normal_available:
                return True, "confirmed"
            if on_login:
                ctx.set_current_step(BNNode.BN_UI)
                continue
            if disconnected:
                ctx.set_b5_entry_reason("BN_Confirmed_disconnected")
                ctx.set_current_step(BNNode.BN_Exit)
                continue
            ctx.set_current_step(BNNode.BN_UI)
            continue

            # ----- [B5] BN_Exit -----
        if ctx.get_current_step() == BNNode.BN_Exit:
            _save_ui_snapshot("B5", "B5_exit")
            entry_reason = ctx.get_b5_entry_reason() or "exit"
            ColorPrint.blue("[BNFlow] flow B5→B5w | reason: %s -> kill Battle.net, wait %ss then back to B1" % (entry_reason, int(BN_FLOW_EXIT_WAIT_SEC)))
            get_battlenet_manager().kill()
            ctx.set_wait_until(now + BN_FLOW_EXIT_WAIT_SEC)
            ctx.set_current_step(BNNode.BN_ExitWait)
            return False, ""

        # ----- [B5w] BN_ExitWait -----
        if ctx.get_current_step() == BNNode.BN_ExitWait:
            if now < ctx.get_wait_until():
                ColorPrint.gray("[BNFlow] flow B5w skip this tick | reason: waiting Battle.net exit (%ss), wait" % int(BN_FLOW_EXIT_WAIT_SEC))
                return False, "wait"
            ColorPrint.blue("[BNFlow] flow B5w→B1 | reason: Battle.net exited, back to entry B1")
            ctx.set_current_step(BNNode.BN_Entry)
            continue

        return False, ""


# Register so shutdown_manager runs this during execute_shutdown (no direct import of this module from shutdown_manager).
register_shutdown_hook(reset_flow_master_bn_block)
