# -*- coding: utf-8 -*-
"""
D – Launch D3 from Battle.net (ROSBOT_FLOW_MERMAID.md).
All D-block steps defined here for alignment with doc.
Full orchestration: controller.login_try_screenshot_controller.ensure_battlenet_started_and_login_check.
"""
from enum import Enum
from typing import Optional, Tuple, Any

from providor.providor_index import CONFIG
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

from d3utils.battlenet_manager import get_battlenet_manager
from d3utils.d3_manager import get_d3_manager
from d3utils.rosbot_flow_f3_baseline import set_f3_rosbot_started_at
from d3utils.rosbot_manager import get_rosbot_manager


class DBlockStep(str, Enum):
    """D block steps (ROSBOT_FLOW_MERMAID.md D launch D3 from Battle.net)."""
    D1_Entry = "D1_Entry"
    D4_Activate = "D4_Activate"
    D4w_Wait = "D4w_Wait"
    D5_UI = "D5_UI"
    D6_HasWin = "D6_HasWin"
    D_Fail = "D_Fail"
    D7_FindTab = "D7_FindTab"
    D8_TabOk = "D8_TabOk"
    D9_ClickTab = "D9_ClickTab"
    D10_UIState = "D10_UIState"
    D11w_WaitPlay = "D11w_WaitPlay"
    D11_Click = "D11_Click"
    D12_Sleep = "D12_Sleep"
    D12b_Poll = "D12b_Poll"
    D13_HasD3Win = "D13_HasD3Win"
    D13b_RestartD3 = "D13b_RestartD3"
    D14_Restart = "D14_Restart"
    D14w_Wait = "D14w_Wait"


def run_d1_entry() -> bool:
    """[D1] Entry. Returns True if D branch should run (caller: after C12 or no C)."""
    return True


def run_d2_start_bn_if_needed(bn_path: str) -> None:
    """[D2] Start Battle.net if no window. Caller passes bn_path from config."""
    windows = get_battlenet_manager().find_windows(use_cache=False)
    if not windows and bn_path:
        get_battlenet_manager().start(bn_path)


def run_d3_end_d3_if_running() -> None:
    """[D3] End D3 process if running; [D3w] wait 5s is caller responsibility."""
    get_d3_manager().kill_if_running()


def run_d4_activate_bn() -> bool:
    """[D4] Activate Battle.net window; [D4w] wait 1s is caller responsibility. Returns True if activated."""
    return get_battlenet_manager().activate_window()


def run_d6_has_win() -> bool:
    """[D6] Has Battle.net window? Delegates to battlenet_manager.find_windows."""
    return len(get_battlenet_manager().find_windows(use_cache=False)) > 0


def run_d13_has_d3_win() -> bool:
    """[D13] D3 window found within 10s? Delegates to d3_manager.is_running (caller polls)."""
    return get_d3_manager().is_running()


def run_d18_kill_then_start_rosbot(start_rosbot_task_fn, run_after_rosbot_start_fn) -> bool:
    """
    [D18a] Kill existing ROSBOT. [D18b] If config auto_start_rosbot, start and run after-start automation.
    Caller passes start_rosbot_task_fn (e.g. start_rosbot_task) and run_after_rosbot_start_fn (e.g. run_after_rosbot_start).
    Returns True if started (or not configured).
    """
    get_rosbot_manager().kill_if_running()
    if not CONFIG.get("ros_settings", {}).get("auto_start_rosbot", True):
        return True
    if get_rosbot_manager().start():
        set_f3_rosbot_started_at()
        start_rosbot_task_fn()
        run_after_rosbot_start_fn(do_debug=True, do_tab=True, do_start_botting=True)
        return True
    return False


# D5-D12, D16a-D17: in controller (UI identify, D3 tab, Play, poll D3 10s, start-game click).
# D13 No -> D13b (restart D3) -> D14 -> D14w -> B2; D13 Yes -> C1. See ROSBOT_FLOW_STEP_INDEX.md.
# TODO: D13b explicit step (restart D3) when D13 finds no D3 window.
